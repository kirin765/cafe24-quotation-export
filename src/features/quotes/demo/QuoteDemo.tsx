"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  createEmptyItem,
  formatDateTime,
  formatKrw,
  lineAmount,
  MAX_CSV_ROWS,
  parseIntegerInput,
  validateDocument,
  type QuoteDocument,
  type QuoteItem,
  type SupplierInfo,
} from "@/features/quotes/model";
import { parseItemCsv, type CsvCellError } from "@/features/quotes/csv";
import { documentToXlsx, xlsxFileName } from "@/features/quotes/xlsx";
import { saveDocument } from "@/features/quotes/storage";
import { createEmptyDocument, createSampleDocument } from "@/fixtures/samples";

type PendingImport = {
  source: string;
  items: QuoteItem[];
  errors: CsvCellError[];
  dataRowCount: number;
};

const inputClass =
  "w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900";

const SUPPLIER_FIELDS: { key: keyof SupplierInfo; label: string }[] = [
  { key: "companyName", label: "상호" },
  { key: "businessNumber", label: "사업자번호" },
  { key: "contactName", label: "담당자" },
  { key: "contactPhone", label: "연락처" },
  { key: "contactEmail", label: "이메일" },
  { key: "address", label: "주소" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-semibold text-neutral-600">{children}</span>;
}

function ErrorText({ message }: { message: string | undefined }) {
  if (!message) {
    return null;
  }
  return <p className="mt-0.5 text-xs text-red-600">{message}</p>;
}

export function QuoteDemo() {
  const [doc, setDoc] = useState<QuoteDocument>(() => createSampleDocument());
  const [exportAttempted, setExportAttempted] = useState(false);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [importHeaderError, setImportHeaderError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showSupplier, setShowSupplier] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(() => validateDocument(doc), [doc]);

  useEffect(() => {
    saveDocument(doc);
  }, [doc]);

  const documentError = (field: string) =>
    exportAttempted
      ? validation.documentErrors.find((error) => error.field === field)?.message
      : undefined;
  const totalError = documentError("total");
  const itemError = (index: number, field: keyof QuoteItem) =>
    exportAttempted ? validation.itemErrors[index]?.[field] : undefined;

  const issueCount =
    validation.documentErrors.length +
    validation.itemErrors.filter((errors) => Object.keys(errors).length > 0).length +
    (validation.adjustmentError ? 1 : 0);

  const update = (patch: Partial<QuoteDocument>) => {
    setDoc((prev) => ({ ...prev, ...patch }));
  };

  const updateSupplier = (key: keyof QuoteDocument["supplier"], value: string) => {
    setDoc((prev) => ({ ...prev, supplier: { ...prev.supplier, [key]: value } }));
  };

  const updateItem = (id: string, patch: Partial<QuoteItem>) => {
    setDoc((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const addItem = () => {
    setDoc((prev) => ({ ...prev, items: [...prev.items, createEmptyItem()] }));
  };

  const removeItem = (id: string) => {
    setDoc((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }));
  };

  const resetDraft = () => {
    setDoc(createEmptyDocument());
    setExportAttempted(false);
    setPendingImport(null);
    setImportHeaderError(null);
    setStatusMessage("빈 견적으로 초기화했습니다.");
  };

  const loadSample = () => {
    setDoc(createSampleDocument());
    setExportAttempted(false);
    setPendingImport(null);
    setImportHeaderError(null);
    setStatusMessage("합성 상품 10개 샘플을 불러왔습니다.");
  };

  const handleCsvText = (text: string, source: string) => {
    const result = parseItemCsv(text);
    setImportHeaderError(result.headerError);
    setStatusMessage(null);

    if (result.headerError) {
      setPendingImport(null);
      return;
    }

    if (result.errors.length > 0) {
      setPendingImport({
        source,
        items: result.items,
        errors: result.errors,
        dataRowCount: result.dataRowCount,
      });
      return;
    }

    applyImport(result.items, source, result.dataRowCount);
  };

  const applyImport = (items: QuoteItem[], source: string, dataRowCount: number) => {
    setDoc((prev) => ({ ...prev, items: [...prev.items, ...items] }));
    setPendingImport(null);
    setImportHeaderError(null);
    setStatusMessage(`${source}에서 ${items.length}행을 가져왔습니다. (데이터 ${dataRowCount}행)`);
  };

  const confirmPartialImport = () => {
    if (!pendingImport) {
      return;
    }
    const errorLines = new Set(pendingImport.errors.map((error) => error.line));
    applyImport(
      pendingImport.items,
      `${pendingImport.source} (오류 ${errorLines.size}행 제외)`,
      pendingImport.dataRowCount,
    );
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const text = await file.text();
    handleCsvText(text, file.name);
  };

  const downloadXlsx = () => {
    setExportAttempted(true);
    if (!validation.valid) {
      setStatusMessage("입력 오류를 수정한 뒤 다시 내보내세요.");
      return;
    }
    const bytes = documentToXlsx(doc);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = xlsxFileName(doc);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatusMessage(
      `${xlsxFileName(doc)} 파일을 만들었습니다. XLSX는 편집 가능하지만 합계가 자동 재계산되지 않습니다.`,
    );
  };

  const openPrint = () => {
    setExportAttempted(true);
    if (!validation.valid) {
      setStatusMessage("입력 오류를 수정한 뒤 인쇄 화면을 열어 주세요.");
      return;
    }
    saveDocument(doc);
    window.open("/demo/print", "_blank", "noopener,noreferrer");
  };

  const errorLines = pendingImport
    ? [...new Set(pendingImport.errors.map((error) => error.line))].sort((a, b) => a - b)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-bold">견적서 데모</h1>
          <p className="mt-1 text-xs text-neutral-600">
            Cafe24 상품 연동 없이 합성 데이터·CSV로 견적을 작성하고 XLSX와 인쇄용 PDF를 만듭니다.
            서버 저장 없이 이 브라우저 안에서만 동작합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded border border-neutral-400 bg-white px-3 py-1.5 text-xs font-semibold"
            onClick={loadSample}
            type="button"
          >
            합성 상품 10개 불러오기
          </button>
          <button
            className="rounded border border-neutral-400 bg-white px-3 py-1.5 text-xs font-semibold"
            onClick={resetDraft}
            type="button"
          >
            초기화
          </button>
        </div>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <span
          className={
            validation.valid
              ? "rounded bg-green-100 px-2 py-1 font-semibold text-green-800"
              : "rounded bg-amber-100 px-2 py-1 font-semibold text-amber-800"
          }
        >
          {validation.valid ? "내보내기 가능" : `확인 필요 ${issueCount}건`}
        </span>
        <span className="text-neutral-600">
          문서번호 {doc.documentNumber} · 버전 v{doc.version} · 작성시각{" "}
          {formatDateTime(doc.createdAt)}
        </span>
        {statusMessage ? <span className="text-neutral-800">{statusMessage}</span> : null}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-bold">문서 정보</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>문서 번호</FieldLabel>
                <input
                  className={inputClass}
                  onChange={(event) => update({ documentNumber: event.target.value })}
                  value={doc.documentNumber}
                />
                <ErrorText message={documentError("documentNumber")} />
              </label>
              <label className="block">
                <FieldLabel>버전</FieldLabel>
                <input
                  className={inputClass}
                  inputMode="numeric"
                  onChange={(event) =>
                    update({ version: Math.max(1, parseIntegerInput(event.target.value)) })
                  }
                  value={doc.version}
                />
                <ErrorText message={documentError("version")} />
              </label>
              <label className="block">
                <FieldLabel>수신 회사명 (필수)</FieldLabel>
                <input
                  className={inputClass}
                  onChange={(event) => update({ recipientCompany: event.target.value })}
                  value={doc.recipientCompany}
                />
                <ErrorText message={documentError("recipientCompany")} />
              </label>
              <label className="block">
                <FieldLabel>유효기한</FieldLabel>
                <input
                  className={inputClass}
                  onChange={(event) => update({ validUntil: event.target.value })}
                  placeholder="YYYY-MM-DD"
                  value={doc.validUntil}
                />
                <ErrorText message={documentError("validUntil")} />
              </label>
              <label className="block">
                <FieldLabel>납기·배송 조건</FieldLabel>
                <input
                  className={inputClass}
                  onChange={(event) => update({ deliveryTerms: event.target.value })}
                  value={doc.deliveryTerms}
                />
              </label>
              <label className="block">
                <FieldLabel>가격 조건 (세금 포함 여부 등)</FieldLabel>
                <input
                  className={inputClass}
                  onChange={(event) => update({ priceCondition: event.target.value })}
                  placeholder="예: 부가세 별도 금액입니다."
                  value={doc.priceCondition}
                />
              </label>
              <label className="block sm:col-span-2">
                <FieldLabel>비고</FieldLabel>
                <textarea
                  className={inputClass}
                  onChange={(event) => update({ notes: event.target.value })}
                  rows={2}
                  value={doc.notes}
                />
                <ErrorText message={documentError("notes")} />
              </label>
            </div>
            <button
              className="mt-3 text-xs font-semibold text-neutral-700 underline"
              onClick={() => setShowSupplier((prev) => !prev)}
              type="button"
            >
              {showSupplier ? "공급자 정보 닫기" : "공급자 정보 열기"}
            </button>
            {showSupplier ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {SUPPLIER_FIELDS.map((field) => (
                  <label className="block" key={field.key}>
                    <FieldLabel>{field.label}</FieldLabel>
                    <input
                      className={inputClass}
                      onChange={(event) => updateSupplier(field.key, event.target.value)}
                      value={doc.supplier[field.key]}
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </section>

          <section className="rounded border border-neutral-300 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold">품목 ({doc.items.length}행)</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded border border-neutral-400 bg-white px-3 py-1.5 text-xs font-semibold"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  CSV 파일 가져오기
                </button>
                <button
                  className="rounded border border-neutral-400 bg-white px-3 py-1.5 text-xs font-semibold"
                  onClick={() => setPasteOpen((prev) => !prev)}
                  type="button"
                >
                  CSV 붙여넣기
                </button>
                <button
                  className="rounded border border-neutral-400 bg-white px-3 py-1.5 text-xs font-semibold"
                  onClick={addItem}
                  type="button"
                >
                  빈 행 추가
                </button>
              </div>
            </div>
            <input
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            <p className="mt-2 text-xs text-neutral-500">
              열: item_code, product_name, option_name, quantity, unit_price · 최대 1MB ·{" "}
              {MAX_CSV_ROWS}행 · 품목 코드의 앞자리 0은 그대로 유지됩니다.
            </p>

            {pasteOpen ? (
              <div className="mt-3">
                <textarea
                  className={`${inputClass} font-mono`}
                  onChange={(event) => setPasteText(event.target.value)}
                  placeholder="item_code,product_name,option_name,quantity,unit_price"
                  rows={5}
                  value={pasteText}
                />
                <button
                  className="mt-2 rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white"
                  onClick={() => handleCsvText(pasteText, "붙여넣은 CSV")}
                  type="button"
                >
                  붙여넣은 CSV 확인
                </button>
              </div>
            ) : null}

            {importHeaderError ? (
              <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
                CSV를 가져오지 않았습니다. {importHeaderError}
              </p>
            ) : null}

            {pendingImport ? (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-xs">
                <p className="font-semibold text-amber-900">
                  {pendingImport.source}: 데이터 {pendingImport.dataRowCount}행 중 {errorLines.length}
                  행에 오류가 있습니다. 아무 행도 자동으로 가져오지 않았습니다.
                </p>
                <table className="mt-2 w-full border-collapse text-left">
                  <thead>
                    <tr className="text-amber-900">
                      <th className="border-b border-amber-300 py-1 pr-2">CSV 행</th>
                      <th className="border-b border-amber-300 py-1 pr-2">열</th>
                      <th className="border-b border-amber-300 py-1">내용</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingImport.errors.map((error, index) => (
                      <tr key={`${error.line}-${error.column}-${index}`}>
                        <td className="border-b border-amber-200 py-1 pr-2">{error.line}</td>
                        <td className="border-b border-amber-200 py-1 pr-2">{error.column}</td>
                        <td className="border-b border-amber-200 py-1">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 flex gap-2">
                  <button
                    className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    disabled={pendingImport.items.length === 0}
                    onClick={confirmPartialImport}
                    type="button"
                  >
                    오류 {errorLines.length}행 제외하고 {pendingImport.items.length}행 가져오기
                  </button>
                  <button
                    className="rounded border border-neutral-400 bg-white px-3 py-1.5 text-xs font-semibold"
                    onClick={() => setPendingImport(null)}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : null}
            <ErrorText message={documentError("items")} />

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-300 text-left text-xs text-neutral-600">
                    <th className="w-8 py-1">#</th>
                    <th className="w-32 py-1">품목 코드</th>
                    <th className="py-1">상품명 (필수)</th>
                    <th className="w-32 py-1">옵션</th>
                    <th className="w-24 py-1">수량</th>
                    <th className="w-28 py-1">단가(원)</th>
                    <th className="w-28 py-1 text-right">금액</th>
                    <th className="w-16 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item, index) => (
                    <tr className="border-b border-neutral-200 align-top" key={item.id}>
                      <td className="py-1 text-xs text-neutral-500">{index + 1}</td>
                      <td className="py-1 pr-1">
                        <input
                          className={inputClass}
                          onChange={(event) => updateItem(item.id, { itemCode: event.target.value })}
                          value={item.itemCode}
                        />
                        <ErrorText message={itemError(index, "itemCode")} />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            updateItem(item.id, { productName: event.target.value })
                          }
                          value={item.productName}
                        />
                        <ErrorText message={itemError(index, "productName")} />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          className={inputClass}
                          onChange={(event) =>
                            updateItem(item.id, { optionName: event.target.value })
                          }
                          value={item.optionName}
                        />
                        <ErrorText message={itemError(index, "optionName")} />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          className={`${inputClass} text-right`}
                          inputMode="numeric"
                          onChange={(event) =>
                            updateItem(item.id, { quantity: parseIntegerInput(event.target.value) })
                          }
                          value={item.quantity}
                        />
                        <ErrorText message={itemError(index, "quantity")} />
                      </td>
                      <td className="py-1 pr-1">
                        <input
                          className={`${inputClass} text-right`}
                          inputMode="numeric"
                          onChange={(event) =>
                            updateItem(item.id, { unitPrice: parseIntegerInput(event.target.value) })
                          }
                          value={item.unitPrice}
                        />
                        <ErrorText message={itemError(index, "unitPrice")} />
                      </td>
                      <td className="py-1 text-right text-sm whitespace-nowrap">
                        {lineAmount(item).toLocaleString("ko-KR")}
                      </td>
                      <td className="py-1 text-right">
                        <button
                          className="text-xs text-red-600 underline"
                          onClick={() => removeItem(item.id)}
                          type="button"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-bold">조정 금액</h2>
            <p className="mt-1 text-xs text-neutral-600">
              배송비나 일괄 할인처럼 품목에 담기 어려운 금액입니다. 설명을 반드시 입력하고, 할인은
              음수로 넣습니다.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>설명</FieldLabel>
                <input
                  className={inputClass}
                  disabled={!doc.adjustment}
                  onChange={(event) =>
                    update({
                      adjustment: doc.adjustment
                        ? { ...doc.adjustment, description: event.target.value }
                        : null,
                    })
                  }
                  placeholder="예: 배송비, 일괄 할인"
                  value={doc.adjustment?.description ?? ""}
                />
              </label>
              <label className="block">
                <FieldLabel>금액(원)</FieldLabel>
                <input
                  className={`${inputClass} text-right`}
                  disabled={!doc.adjustment}
                  inputMode="numeric"
                  onChange={(event) =>
                    update({
                      adjustment: doc.adjustment
                        ? { ...doc.adjustment, amount: parseIntegerInput(event.target.value, true) }
                        : null,
                    })
                  }
                  value={doc.adjustment?.amount ?? 0}
                />
              </label>
            </div>
            <ErrorText message={exportAttempted ? validation.adjustmentError ?? undefined : undefined} />
            <button
              className="mt-3 text-xs font-semibold text-neutral-700 underline"
              onClick={() =>
                update({ adjustment: doc.adjustment ? null : { description: "", amount: 0 } })
              }
              type="button"
            >
              {doc.adjustment ? "조정 금액 사용 안 함" : "조정 금액 추가"}
            </button>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-bold">미리보기 합계</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-600">상품 합계</dt>
                <dd>{formatKrw(validation.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-600">
                  조정 {doc.adjustment ? `(${doc.adjustment.description || "설명 없음"})` : ""}
                </dt>
                <dd>{formatKrw(validation.adjustmentAmount)}</dd>
              </div>
              <div className="flex justify-between border-t border-neutral-300 pt-2 text-base font-bold">
                <dt>견적 총액</dt>
                <dd>{formatKrw(validation.total)}</dd>
              </div>
            </dl>
            <ErrorText message={totalError} />
            <p className="mt-2 text-xs text-neutral-500">
              부가세는 자동 계산하지 않습니다. &lsquo;가격 조건&rsquo;에 세금 포함 여부를 적어 주세요.
            </p>
          </section>

          <section className="rounded border border-neutral-300 bg-white p-4">
            <h2 className="text-sm font-bold">내보내기</h2>
            <button
              className="mt-3 w-full rounded bg-neutral-900 px-3 py-2 text-sm font-semibold text-white"
              onClick={downloadXlsx}
              type="button"
            >
              XLSX 다운로드
            </button>
            <button
              className="mt-2 w-full rounded border border-neutral-400 bg-white px-3 py-2 text-sm font-semibold"
              onClick={openPrint}
              type="button"
            >
              인쇄 화면 열기 (PDF로 저장)
            </button>
            <p className="mt-2 text-xs text-neutral-500">
              PDF는 인쇄 전용 화면에서 브라우저의 &lsquo;PDF로 저장&rsquo;으로 만듭니다. 버튼 하나로
              PDF 파일을 직접 내려받는 기능은 아직 없습니다.
            </p>
            <p className="mt-2 text-xs text-neutral-500">
              XLSX는 수량·단가를 수정해도 합계가 자동 재계산되지 않습니다. 재계산이 필요하면 여기서
              수정 후 다시 내보내세요.
            </p>
          </section>

          <section className="rounded border border-neutral-300 bg-white p-4 text-xs text-neutral-600">
            <h2 className="text-sm font-bold text-neutral-900">계산 기준</h2>
            <p className="mt-2">행 금액 = 수량 × 단가</p>
            <p>상품 합계 = 행 금액 합계</p>
            <p>견적 총액 = 상품 합계 + 조정 금액 (0원 미만 불가)</p>
            <p className="mt-2">
              금액은 원 단위 정수로만 계산합니다. 화면·XLSX·PDF는 같은 문서 데이터를 사용합니다.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
