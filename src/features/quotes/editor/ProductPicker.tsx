"use client";

import { useCallback, useEffect, useState } from "react";
import type { Cafe24Product, Cafe24ProductOption } from "@/lib/cafe24";
import { newId, type QuoteItem } from "@/features/quotes/model";

type SessionInfo = {
  mallId: string | null;
  installed: boolean;
  storeKind: "postgres" | "memory";
  scopes: string;
  apiVersion: string;
};

export function ProductPicker({ onAdd }: { onAdd: (items: QuoteItem[]) => void }) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [products, setProducts] = useState<Cafe24Product[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [keyword, setKeyword] = useState("");
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const search = useCallback(async (nextKeyword: string) => {
    setSearching(true);
    setMessage(null);
    try {
      const query = new URLSearchParams({ limit: "40" });
      if (nextKeyword.trim() !== "") {
        query.set("q", nextKeyword.trim());
      }
      const res = await fetch(`/api/cafe24/products?${query}`);
      const body = (await res.json()) as {
        products?: Cafe24Product[];
        priceNote?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        setProducts([]);
        setMessage(body.message ?? "상품을 불러오지 못했습니다. 앱을 다시 실행해 주세요.");
        return;
      }
      setProducts(body.products ?? []);
      setPriceNote(body.priceNote ?? null);
      setSelected([]);
    } catch {
      setMessage("상품을 불러오지 못했습니다.");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cafe24/session")
      .then((res) => res.json() as Promise<SessionInfo>)
      .then((info) => {
        if (cancelled) {
          return;
        }
        setSession(info);
        if (info.installed) {
          void search("");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("연동 상태를 확인하지 못했습니다.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  const toggle = (productNo: number) => {
    setSelected((prev) =>
      prev.includes(productNo) ? prev.filter((value) => value !== productNo) : [...prev, productNo],
    );
  };

  const addSelected = async () => {
    setAdding(true);
    setMessage(null);
    const rows: QuoteItem[] = [];
    const failures: string[] = [];

    for (const productNo of selected) {
      const product = products.find((item) => item.product_no === productNo);
      if (!product) {
        continue;
      }
      let options: Cafe24ProductOption[] = [];
      try {
        const res = await fetch(`/api/cafe24/products/${productNo}/options`);
        if (res.ok) {
          const body = (await res.json()) as { options?: Cafe24ProductOption[] };
          options = body.options ?? [];
        } else {
          failures.push(product.product_name);
        }
      } catch {
        failures.push(product.product_name);
      }

      const optionLabels = options
        .map((option) => option.option_value.trim() || option.option_name.trim())
        .filter((label) => label !== "");

      const labels = optionLabels.length > 0 ? optionLabels : [""];
      for (const label of labels) {
        rows.push({
          id: newId(),
          itemCode: product.product_code,
          productName: product.product_name,
          optionName: label,
          quantity: 1,
          unitPrice: Math.max(0, Math.round(product.price)),
        });
      }
    }

    setAdding(false);

    if (rows.length === 0) {
      setMessage("추가할 상품을 선택해 주세요.");
      return;
    }

    onAdd(rows);
    setSelected([]);
    setMessage(
      failures.length > 0
        ? `${rows.length}개 행을 추가했습니다. 옵션을 못 가져온 상품: ${failures.join(", ")}`
        : `${rows.length}개 행을 추가했습니다. 수량과 단가를 확인해 주세요.`,
    );
  };

  if (!session) {
    return (
      <section className="rounded border border-neutral-300 bg-white p-4 text-xs text-neutral-500">
        연동 상태 확인 중…
      </section>
    );
  }

  if (!session.installed) {
    return (
      <section className="rounded border border-neutral-300 bg-white p-4">
        <h2 className="text-sm font-bold">Cafe24 상품 불러오기</h2>
        <p className="mt-2 text-xs text-neutral-600">
          설치된 쇼핑몰 세션이 없어 CSV와 수동 입력만 사용할 수 있습니다. Cafe24 관리자 &gt; 앱에서
          이 앱을 실행하면 상품을 바로 불러올 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded border border-neutral-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">Cafe24 상품 불러오기</h2>
        <span className="text-xs text-neutral-500">
          {session.mallId} · {session.scopes} · {session.apiVersion}
          {session.storeKind === "memory" ? " · 메모리 저장소(재배포 시 토큰 소실)" : ""}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          className="min-w-48 flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              void search(keyword);
            }
          }}
          placeholder="상품명으로 검색"
          value={keyword}
        />
        <button
          className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          disabled={searching}
          onClick={() => void search(keyword)}
          type="button"
        >
          {searching ? "검색 중…" : "검색"}
        </button>
        <button
          className="rounded border border-neutral-400 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          disabled={adding || selected.length === 0}
          onClick={() => void addSelected()}
          type="button"
        >
          {adding ? "추가 중…" : `선택 ${selected.length}개 견적에 추가`}
        </button>
      </div>

      {priceNote ? <p className="mt-2 text-xs text-amber-700">{priceNote}</p> : null}
      {message ? <p className="mt-2 text-xs text-neutral-700">{message}</p> : null}

      <div className="mt-3 max-h-72 overflow-y-auto rounded border border-neutral-200">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 bg-neutral-100">
            <tr className="text-left text-neutral-600">
              <th className="w-8 px-2 py-1">선택</th>
              <th className="px-2 py-1">상품명</th>
              <th className="w-24 px-2 py-1">품목 코드</th>
              <th className="w-24 px-2 py-1 text-right">판매가(제안)</th>
              <th className="w-16 px-2 py-1">판매</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td className="px-2 py-3 text-neutral-500" colSpan={5}>
                  {searching ? "불러오는 중…" : "조회된 상품이 없습니다."}
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr className="border-t border-neutral-200" key={product.product_no}>
                  <td className="px-2 py-1">
                    <input
                      checked={selected.includes(product.product_no)}
                      onChange={() => toggle(product.product_no)}
                      type="checkbox"
                    />
                  </td>
                  <td className="px-2 py-1">{product.product_name}</td>
                  <td className="px-2 py-1">{product.product_code}</td>
                  <td className="px-2 py-1 text-right">
                    {product.price.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-2 py-1">{product.selling === "T" ? "판매중" : "중지"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-neutral-500">
        옵션이 있는 상품은 옵션별로 행을 만들어 추가합니다. 같은 상품을 다시 추가해도 자동으로
        합치지 않습니다.
      </p>
    </section>
  );
}
