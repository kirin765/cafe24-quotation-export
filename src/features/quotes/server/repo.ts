import type postgres from "postgres";
import { db } from "@/lib/db";
import {
  DEFAULT_SUPPLIER,
  createDocumentNumber,
  createEmptyItem,
  newId,
  validateDocument,
  type DocumentValidation,
  type QuoteAdjustment,
  type QuoteDocument,
  type QuoteItem,
  type SupplierInfo,
} from "@/features/quotes/model";

export type QuoteDraftSummary = {
  id: string;
  documentNumber: string;
  version: number;
  revision: number;
  recipientCompany: string;
  itemCount: number;
  total: number;
  versionCount: number;
  updatedAt: string;
};

export type VersionSummary = {
  id: string;
  version: number;
  documentNumber: string;
  subtotal: number;
  adjustment: number;
  total: number;
  confirmedAt: string;
};

export type AuditEvent = {
  event: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type SavedDraft = {
  id: string;
  revision: number;
  version: number;
  updatedAt: string;
  doc: QuoteDocument;
};

export type SaveDraftResult =
  | { ok: true; revision: number; updatedAt: string }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; current: SavedDraft };

export type ConfirmResult =
  | { ok: true; versionId: string; version: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict"; current: SavedDraft }
  | { ok: false; reason: "invalid"; validation: DocumentValidation };

class DatabaseUnavailableError extends Error {
  constructor() {
    super("DATABASE_URL이 설정되지 않아 저장 기능을 쓸 수 없습니다.");
    this.name = "DatabaseUnavailableError";
  }
}

export const isDatabaseUnavailable = (error: unknown) =>
  error instanceof DatabaseUnavailableError;

/** 서버리스 연결을 재사용하는 클라이언트. 트랜잭션 안에서는 asSql(tx)로 넘긴다. */
type AnySql = postgres.Sql | postgres.TransactionSql;
const asSql = (query: AnySql): postgres.Sql => query as postgres.Sql;

function connect(): postgres.Sql {
  const sql = db();
  if (!sql) {
    throw new DatabaseUnavailableError();
  }
  return sql;
}

let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  const sql = connect();
  ready ??= (async () => {
    await sql`
      create table if not exists quote_shops (
        mall_id text primary key,
        shop_number integer not null default 1,
        installed_at timestamptz not null default now(),
        uninstalled_at timestamptz
      )`;
    await sql`
      create table if not exists quote_settings (
        mall_id text primary key,
        supplier jsonb not null,
        updated_at timestamptz not null default now()
      )`;
    await sql`
      create table if not exists quote_drafts (
        id uuid primary key,
        mall_id text not null,
        document_number text not null,
        revision integer not null default 1,
        version integer not null default 0,
        recipient_company text not null default '',
        valid_until text not null default '',
        delivery_terms text not null default '',
        price_condition text not null default '',
        notes text not null default '',
        adjustment_description text,
        adjustment_amount bigint,
        supplier jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        deleted_at timestamptz
      )`;
    await sql`
      create unique index if not exists quote_drafts_number_key
        on quote_drafts (mall_id, document_number)`;
    await sql`
      create index if not exists quote_drafts_list_idx
        on quote_drafts (mall_id, updated_at desc)`;
    await sql`
      create table if not exists quote_items (
        id bigserial primary key,
        draft_id uuid not null,
        client_item_id text not null,
        row_order integer not null,
        item_code text not null default '',
        product_name text not null,
        option_name text not null default '',
        quantity integer not null,
        unit_price bigint not null
      )`;
    await sql`
      create index if not exists quote_items_draft_idx on quote_items (draft_id, row_order)`;
    await sql`
      create table if not exists quote_versions (
        id uuid primary key,
        mall_id text not null,
        draft_id uuid not null,
        document_number text not null,
        version integer not null,
        document jsonb not null,
        subtotal bigint not null,
        adjustment bigint not null,
        total bigint not null,
        confirmed_at timestamptz not null default now()
      )`;
    await sql`
      create unique index if not exists quote_versions_key
        on quote_versions (mall_id, document_number, version)`;
    await sql`
      create index if not exists quote_versions_draft_idx
        on quote_versions (draft_id, version desc)`;
    await sql`
      create table if not exists quote_audit_events (
        id bigserial primary key,
        mall_id text not null,
        draft_id uuid,
        version_id uuid,
        event text not null,
        detail jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )`;
    await sql`
      create index if not exists quote_audit_events_idx
        on quote_audit_events (mall_id, created_at desc)`;
  })();
  return ready;
}

export function createEmptyQuoteDocument(now: Date = new Date()): QuoteDocument {
  return {
    documentNumber: createDocumentNumber(now),
    version: 1,
    createdAt: now.toISOString(),
    recipientCompany: "",
    supplier: { ...DEFAULT_SUPPLIER },
    validUntil: "",
    deliveryTerms: "",
    priceCondition: "부가세 별도 금액입니다.",
    notes: "",
    items: [createEmptyItem()],
    adjustment: null,
  };
}

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

type DraftRow = {
  id: string;
  revision: number;
  version: number;
  document_number: string;
  recipient_company: string;
  valid_until: string;
  delivery_terms: string;
  price_condition: string;
  notes: string;
  adjustment_description: string | null;
  adjustment_amount: string | null;
  supplier: SupplierInfo;
  created_at: Date;
  updated_at: Date;
};

type ItemRow = {
  client_item_id: string;
  item_code: string;
  product_name: string;
  option_name: string;
  quantity: number;
  unit_price: string;
};

function toDocument(row: DraftRow, items: ItemRow[]): QuoteDocument {
  const adjustment: QuoteAdjustment | null =
    row.adjustment_description === null && row.adjustment_amount === null
      ? null
      : {
          description: row.adjustment_description ?? "",
          amount: toNumber(row.adjustment_amount ?? 0),
        };

  return {
    documentNumber: row.document_number,
    version: row.version + 1,
    createdAt: row.created_at.toISOString(),
    recipientCompany: row.recipient_company,
    supplier: row.supplier,
    validUntil: row.valid_until,
    deliveryTerms: row.delivery_terms,
    priceCondition: row.price_condition,
    notes: row.notes,
    items: items.map((item) => ({
      id: item.client_item_id,
      itemCode: item.item_code,
      productName: item.product_name,
      optionName: item.option_name,
      quantity: item.quantity,
      unitPrice: toNumber(item.unit_price),
    })),
    adjustment,
  };
}

async function writeItems(
  sql: postgres.Sql,
  draftId: string,
  items: readonly QuoteItem[],
): Promise<void> {
  await sql`delete from quote_items where draft_id = ${draftId}`;
  for (const [index, item] of items.entries()) {
    await sql`
      insert into quote_items
        (draft_id, client_item_id, row_order, item_code, product_name, option_name, quantity, unit_price)
      values (
        ${draftId}, ${item.id}, ${index}, ${item.itemCode}, ${item.productName},
        ${item.optionName}, ${item.quantity}, ${item.unitPrice}
      )`;
  }
}

async function recordAudit(
  sql: postgres.Sql,
  event: {
    mallId: string;
    draftId?: string;
    versionId?: string;
    event: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await sql`
    insert into quote_audit_events (mall_id, draft_id, version_id, event, detail)
    values (
      ${event.mallId}, ${event.draftId ?? null}, ${event.versionId ?? null},
      ${event.event}, ${sql.json((event.detail ?? {}) as unknown as postgres.JSONValue)}
    )`;
}

async function readDraft(
  sql: postgres.Sql,
  mallId: string,
  draftId: string,
): Promise<SavedDraft | null> {
  const [row] = await sql<DraftRow[]>`
    select id, revision, version, document_number, recipient_company, valid_until,
           delivery_terms, price_condition, notes, adjustment_description,
           adjustment_amount::text as adjustment_amount, supplier, created_at, updated_at
    from quote_drafts
    where id = ${draftId} and mall_id = ${mallId} and deleted_at is null`;
  if (!row) {
    return null;
  }
  const items = await sql<ItemRow[]>`
    select client_item_id, item_code, product_name, option_name, quantity,
           unit_price::text as unit_price
    from quote_items where draft_id = ${draftId} order by row_order asc`;
  return {
    id: row.id,
    revision: row.revision,
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
    doc: toDocument(row, items),
  };
}

/**
 * 견적 번호는 `QYYYYMMDD-NNNN` 형식으로 몰·날짜별 일련번호를 쓴다. 사람이 읽고 말하기 쉬워야
 * 하기 때문이다. 동시 생성으로 번호가 겹치면 즉시 다음 번호로 넘어간다(대기하지 않는다).
 * 최종 방어는 (mall_id, document_number) 유니크 인덱스다.
 */
async function allocateDocumentNumber(sql: postgres.Sql, mallId: string): Promise<string> {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const prefix = `Q${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count from quote_drafts
    where mall_id = ${mallId} and document_number like ${`${prefix}-%`}`;

  let sequence = row.count + 1;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${prefix}-${String(sequence).padStart(4, "0")}`;
    const [existing] = await sql`
      select 1 from quote_drafts
      where mall_id = ${mallId} and document_number = ${candidate}`;
    if (!existing) {
      return candidate;
    }
    sequence += 1;
  }
  return `${prefix}-${newId().slice(0, 4).toUpperCase()}`;
}

export async function listDrafts(mallId: string, keyword = ""): Promise<QuoteDraftSummary[]> {
  const sql = connect();
  await ensureSchema();
  const like = `%${keyword.trim()}%`;
  const rows = await sql<
    {
      id: string;
      document_number: string;
      version: number;
      revision: number;
      recipient_company: string;
      item_count: string;
      total: string;
      version_count: string;
      updated_at: Date;
    }[]
  >`
    select d.id, d.document_number, d.version, d.revision, d.recipient_company, d.updated_at,
           coalesce(i.item_count, 0)::text as item_count,
           (coalesce(i.subtotal, 0) + coalesce(d.adjustment_amount, 0))::text as total,
           coalesce(v.version_count, 0)::text as version_count
    from quote_drafts d
    left join (
      select draft_id, count(*) as item_count, sum(quantity * unit_price) as subtotal
      from quote_items group by draft_id
    ) i on i.draft_id = d.id
    left join (
      select draft_id, count(*) as version_count from quote_versions group by draft_id
    ) v on v.draft_id = d.id
    where d.mall_id = ${mallId}
      and d.deleted_at is null
      and (${keyword.trim()} = '' or d.recipient_company ilike ${like} or d.document_number ilike ${like})
    order by d.updated_at desc
    limit 100`;

  return rows.map((row) => ({
    id: row.id,
    documentNumber: row.document_number,
    version: row.version,
    revision: row.revision,
    recipientCompany: row.recipient_company,
    itemCount: toNumber(row.item_count),
    total: toNumber(row.total),
    versionCount: toNumber(row.version_count),
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function createDraft(mallId: string, source?: QuoteDocument): Promise<SavedDraft> {
  const sql = connect();
  await ensureSchema();
  const documentNumber = await allocateDocumentNumber(sql, mallId);
  const supplier = await getSupplier(mallId);
  const doc: QuoteDocument = source
    ? { ...source, documentNumber, version: 1, supplier }
    : { ...createEmptyQuoteDocument(), supplier };

  const [row] = await sql<{ id: string; updated_at: Date }[]>`
    insert into quote_drafts
      (id, mall_id, document_number, revision, version, recipient_company, valid_until,
       delivery_terms, price_condition, notes, adjustment_description, adjustment_amount, supplier)
    values (
      ${newId()}, ${mallId}, ${documentNumber}, 1, 0, ${doc.recipientCompany}, ${doc.validUntil},
      ${doc.deliveryTerms}, ${doc.priceCondition}, ${doc.notes},
      ${doc.adjustment?.description ?? null}, ${doc.adjustment?.amount ?? null},
      ${sql.json(doc.supplier as unknown as postgres.JSONValue)}
    )
    returning id, updated_at`;

  await writeItems(sql, row.id, doc.items);
  await sql`
    insert into quote_shops (mall_id) values (${mallId})
    on conflict (mall_id) do update set uninstalled_at = null`;
  await recordAudit(sql, {
    mallId,
    draftId: row.id,
    event: "created",
    detail: { documentNumber, itemCount: doc.items.length },
  });

  const created = await readDraft(sql, mallId, row.id);
  if (!created) {
    throw new Error("초안을 만들지 못했습니다.");
  }
  return created;
}

export const getDraft = async (mallId: string, draftId: string) => {
  const sql = connect();
  await ensureSchema();
  return readDraft(sql, mallId, draftId);
};

export async function saveDraft(
  mallId: string,
  draftId: string,
  doc: QuoteDocument,
  expectedRevision: number,
): Promise<SaveDraftResult> {
  const sql = connect();
  await ensureSchema();

  return sql.begin(async (tx) => {
    const [current] = await tx<{ revision: number }[]>`
      select revision from quote_drafts
      where id = ${draftId} and mall_id = ${mallId} and deleted_at is null
      for update`;
    if (!current) {
      return { ok: false, reason: "not_found" } as const;
    }
    if (current.revision !== expectedRevision) {
      const latest = await readDraft(asSql(tx), mallId, draftId);
      if (!latest) {
        return { ok: false, reason: "not_found" } as const;
      }
      return { ok: false, reason: "conflict", current: latest } as const;
    }

    const [updated] = await tx<{ revision: number; updated_at: Date }[]>`
      update quote_drafts set
        revision = revision + 1,
        recipient_company = ${doc.recipientCompany},
        valid_until = ${doc.validUntil},
        delivery_terms = ${doc.deliveryTerms},
        price_condition = ${doc.priceCondition},
        notes = ${doc.notes},
        adjustment_description = ${doc.adjustment?.description ?? null},
        adjustment_amount = ${doc.adjustment?.amount ?? null},
        supplier = ${tx.json(doc.supplier as unknown as postgres.JSONValue)},
        updated_at = now()
      where id = ${draftId} and mall_id = ${mallId}
      returning revision, updated_at`;

    await writeItems(asSql(tx), draftId, doc.items);
    await recordAudit(asSql(tx), {
      mallId,
      draftId,
      event: "updated",
      detail: { revision: updated.revision, itemCount: doc.items.length },
    });

    return {
      ok: true,
      revision: updated.revision,
      updatedAt: updated.updated_at.toISOString(),
    } as const;
  });
}

export async function confirmDraft(
  mallId: string,
  draftId: string,
  expectedRevision: number,
): Promise<ConfirmResult> {
  const sql = connect();
  await ensureSchema();

  return sql.begin(async (tx) => {
    const [current] = await tx<{ revision: number }[]>`
      select revision from quote_drafts
      where id = ${draftId} and mall_id = ${mallId} and deleted_at is null
      for update`;
    if (!current) {
      return { ok: false, reason: "not_found" } as const;
    }
    if (current.revision !== expectedRevision) {
      const latest = await readDraft(asSql(tx), mallId, draftId);
      if (!latest) {
        return { ok: false, reason: "not_found" } as const;
      }
      return { ok: false, reason: "conflict", current: latest } as const;
    }

    const draft = await readDraft(asSql(tx), mallId, draftId);
    if (!draft) {
      return { ok: false, reason: "not_found" } as const;
    }

    const validation = validateDocument(draft.doc);
    if (!validation.valid) {
      return { ok: false, reason: "invalid", validation } as const;
    }

    const [seq] = await tx<{ next: number }[]>`
      select coalesce(max(version), 0) + 1 as next from quote_versions
      where mall_id = ${mallId} and document_number = ${draft.doc.documentNumber}`;
    const version = seq.next;
    const versionId = newId();

    await tx`
      insert into quote_versions
        (id, mall_id, draft_id, document_number, version, document, subtotal, adjustment, total)
      values (
        ${versionId}, ${mallId}, ${draftId}, ${draft.doc.documentNumber}, ${version},
        ${tx.json({ ...draft.doc, version } as unknown as postgres.JSONValue)},
        ${validation.subtotal}, ${validation.adjustmentAmount}, ${validation.total}
      )`;

    await tx`
      update quote_drafts set version = ${version}, revision = revision + 1, updated_at = now()
      where id = ${draftId} and mall_id = ${mallId}`;

    await recordAudit(asSql(tx), {
      mallId,
      draftId,
      versionId,
      event: "confirmed",
      detail: { version, itemCount: draft.doc.items.length, total: validation.total },
    });

    return { ok: true, versionId, version } as const;
  });
}

export async function duplicateDraft(
  mallId: string,
  draftId: string,
): Promise<SavedDraft | null> {
  const sql = connect();
  await ensureSchema();
  const source = await readDraft(sql, mallId, draftId);
  if (!source) {
    return null;
  }
  const copy = await createDraft(mallId, {
    ...source.doc,
    items: source.doc.items.map((item) => ({ ...item, id: newId() })),
  });
  await recordAudit(sql, {
    mallId,
    draftId: copy.id,
    event: "duplicated",
    detail: { sourceDraftId: draftId, sourceDocumentNumber: source.doc.documentNumber },
  });
  return copy;
}

export async function deleteDraft(mallId: string, draftId: string): Promise<boolean> {
  const sql = connect();
  await ensureSchema();
  const rows = await sql`
    update quote_drafts set deleted_at = now(), updated_at = now()
    where id = ${draftId} and mall_id = ${mallId} and deleted_at is null
    returning id`;
  if (rows.length === 0) {
    return false;
  }
  await recordAudit(sql, { mallId, draftId, event: "deleted", detail: {} });
  return true;
}

export async function listVersions(mallId: string, draftId: string): Promise<VersionSummary[]> {
  const sql = connect();
  await ensureSchema();
  const rows = await sql<
    {
      id: string;
      version: number;
      document_number: string;
      subtotal: string;
      adjustment: string;
      total: string;
      confirmed_at: Date;
    }[]
  >`
    select id, version, document_number, subtotal::text as subtotal,
           adjustment::text as adjustment, total::text as total, confirmed_at
    from quote_versions
    where mall_id = ${mallId} and draft_id = ${draftId}
    order by version desc`;
  return rows.map((row) => ({
    id: row.id,
    version: row.version,
    documentNumber: row.document_number,
    subtotal: toNumber(row.subtotal),
    adjustment: toNumber(row.adjustment),
    total: toNumber(row.total),
    confirmedAt: row.confirmed_at.toISOString(),
  }));
}

export async function getVersion(
  mallId: string,
  versionId: string,
): Promise<{ summary: VersionSummary; draftId: string; doc: QuoteDocument } | null> {
  const sql = connect();
  await ensureSchema();
  const [row] = await sql<
    {
      id: string;
      version: number;
      document_number: string;
      draft_id: string;
      document: QuoteDocument;
      subtotal: string;
      adjustment: string;
      total: string;
      confirmed_at: Date;
    }[]
  >`
    select id, version, document_number, draft_id, document, subtotal::text as subtotal,
           adjustment::text as adjustment, total::text as total, confirmed_at
    from quote_versions
    where id = ${versionId} and mall_id = ${mallId}`;
  if (!row) {
    return null;
  }
  return {
    draftId: row.draft_id,
    summary: {
      id: row.id,
      version: row.version,
      documentNumber: row.document_number,
      subtotal: toNumber(row.subtotal),
      adjustment: toNumber(row.adjustment),
      total: toNumber(row.total),
      confirmedAt: row.confirmed_at.toISOString(),
    },
    doc: row.document,
  };
}

export async function listAuditEvents(mallId: string, draftId: string): Promise<AuditEvent[]> {
  const sql = connect();
  await ensureSchema();
  const rows = await sql<{ event: string; detail: Record<string, unknown>; created_at: Date }[]>`
    select event, detail, created_at from quote_audit_events
    where mall_id = ${mallId} and draft_id = ${draftId}
    order by created_at desc limit 30`;
  return rows.map((row) => ({
    event: row.event,
    detail: row.detail,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function recordExport(mallId: string, draftId: string, format: string): Promise<void> {
  const sql = connect();
  await ensureSchema();
  await recordAudit(sql, { mallId, draftId, event: "exported", detail: { format } });
}

export async function getSupplier(mallId: string): Promise<SupplierInfo> {
  const sql = connect();
  await ensureSchema();
  const [row] = await sql<{ supplier: SupplierInfo }[]>`
    select supplier from quote_settings where mall_id = ${mallId}`;
  return row?.supplier ?? { ...DEFAULT_SUPPLIER };
}

export async function saveSupplier(mallId: string, supplier: SupplierInfo): Promise<void> {
  const sql = connect();
  await ensureSchema();
  await sql`
    insert into quote_settings (mall_id, supplier)
    values (${mallId}, ${sql.json(supplier as unknown as postgres.JSONValue)})
    on conflict (mall_id) do update set supplier = excluded.supplier, updated_at = now()`;
}

export { DatabaseUnavailableError, recordAudit };
