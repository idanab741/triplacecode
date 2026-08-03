"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Skeleton } from "./Primitives";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  width?: string;
  align?: "left" | "right" | "center";
}

/** טבלת נתונים גנרית: מיון בלחיצה על כותרת עמודה, שורה לחיצה, מצב טעינה
 *  (Skeleton), ומצב ריק. משמשת גם למשתמשים וגם למקומות. */
export function DataTable<T>({
  columns,
  rows,
  keyFor,
  onRowClick,
  loading,
  emptyMessage = "אין תוצאות",
  selectable,
  selectedKeys,
  onToggleSelect,
}: {
  columns: Column<T>[];
  rows: T[];
  keyFor: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = (() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  })();

  function toggleSort(col: Column<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  }

  return (
    <div className="overflow-hidden rounded-[var(--admin-radius-lg)] border" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
      <div className="admin-scrollbar overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--admin-border)" }}>
              {selectable && <th className="w-10 px-4 py-3" />}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--admin-ink-faint)", width: col.width, textAlign: col.align ?? "left", cursor: col.sortValue ? "pointer" : "default" }}
                  onClick={() => toggleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {sortKey === col.key && <span className="admin-mono">{sortDir === "asc" ? "↑" : "↓"}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                  {selectable && (
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-16 text-center" style={{ color: "var(--admin-ink-secondary)" }}>
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!loading &&
              sorted.map((row) => {
                const key = keyFor(row);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className="transition"
                    style={{ borderBottom: "1px solid var(--admin-border)", cursor: onRowClick ? "pointer" : "default" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-bg-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {selectable && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedKeys?.has(key) ?? false}
                          onChange={() => onToggleSelect?.(key)}
                          className="h-4 w-4 rounded"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3" style={{ color: "var(--admin-ink)", textAlign: col.align ?? "left" }}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "חיפוש..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-ink-faint)" }}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded-[var(--admin-radius-sm)] border py-2 pl-9 pr-3 text-[13.5px] outline-none transition focus:ring-2"
        style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
      />
    </div>
  );
}

export function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none transition"
      style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: value ? "var(--admin-ink)" : "var(--admin-ink-faint)" }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
