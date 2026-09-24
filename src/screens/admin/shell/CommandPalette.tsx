"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/screens/admin/kit/Icon";
import { useAdminFetch } from "@/screens/admin/kit/useAdminData";
import { ADMIN_NAV_FLAT } from "./navConfig";
import type { SearchHit } from "@/services/admin/insights/search";

interface Row {
  key: string;
  title: string;
  subtitle: string;
  href: string;
  icon: IconName;
  imageUrl?: string | null;
  section: string;
}

const HIT_ICON: Record<SearchHit["type"], IconName> = { user: "users", place: "place", destination: "globe" };
const HIT_SECTION: Record<SearchHit["type"], string> = { user: "משתמשים", place: "מקומות", destination: "יעדים" };

/** חיפוש גלובלי (⌘K / Ctrl+K): מסכים, משתמשים, מקומות ויעדים. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const request = useAdminFetch();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const term = q.trim();
  const visibleHits = useMemo(() => (term.length < 2 ? [] : hits), [term, hits]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (term.length < 2) return;
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const body = await request<{ hits: SearchHit[] }>(`/api/admin/insights/search?q=${encodeURIComponent(term)}`);
        setHits(body.hits);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(t);
  }, [term, request]);

  const rows: Row[] = useMemo(() => {
    const lower = term.toLowerCase();
    const pages = ADMIN_NAV_FLAT.filter((i) => !lower || `${i.label} ${i.keywords ?? ""}`.toLowerCase().includes(lower)).map((i) => ({
      key: `nav:${i.href}`,
      title: i.label,
      subtitle: i.group,
      href: i.href,
      icon: i.icon,
      section: "מסכים",
    }));
    const found = visibleHits.map((h) => ({ key: `${h.type}:${h.id}`, title: h.title, subtitle: h.subtitle, href: h.href, icon: HIT_ICON[h.type], imageUrl: h.imageUrl, section: HIT_SECTION[h.type] }));
    return [...(lower ? pages.slice(0, 5) : pages), ...found];
  }, [term, visibleHits]);

  function go(row: Row | undefined) {
    if (!row) return;
    onClose();
    router.push(row.href);
  }

  let lastSection = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        className="admin-fade-in w-full max-w-xl overflow-hidden rounded-[var(--admin-radius-lg)] border"
        style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-lg)" }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="חיפוש גלובלי"
      >
        <div className="flex items-center gap-3 border-b px-4" style={{ borderColor: "var(--admin-border)" }}>
          <Icon name="search" size={17} style={{ color: "var(--admin-ink-faint)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(rows.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                go(rows[Math.min(cursor, rows.length - 1)]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="חפשו משתמש, מקום, יעד או מסך..."
            className="h-14 flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: "var(--admin-ink)" }}
          />
          {loading && term.length >= 2 && <Icon name="refresh" size={14} className="animate-spin" style={{ color: "var(--admin-ink-faint)" }} />}
          <kbd className="rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-faint)" }}>
            Esc
          </kbd>
        </div>
        <ul className="admin-scrollbar max-h-[55vh] overflow-y-auto p-2">
          {rows.length === 0 && (
            <li className="px-3 py-8 text-center text-[13px]" style={{ color: "var(--admin-ink-faint)" }}>
              {term.length >= 2 && !loading ? "לא נמצאו תוצאות" : "הקלידו לפחות 2 תווים"}
            </li>
          )}
          {rows.map((row, i) => {
            const header = row.section !== lastSection ? row.section : null;
            lastSection = row.section;
            return (
              <li key={row.key}>
                {header && (
                  <div className="px-3 pb-1 pt-2 text-[11px] font-semibold" style={{ color: "var(--admin-ink-faint)" }}>
                    {header}
                  </div>
                )}
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(row)}
                  className="flex w-full items-center gap-3 rounded-[var(--admin-radius-sm)] px-3 py-2 text-right"
                  style={{ background: i === cursor ? "var(--admin-accent-soft)" : "transparent" }}
                >
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-[6px] object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-secondary)" }}>
                      <Icon name={row.icon} size={15} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
                      {row.title}
                    </span>
                    {row.subtitle && (
                      <span className="block truncate text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                        {row.subtitle}
                      </span>
                    )}
                  </span>
                  {i === cursor && <Icon name="chevronLeft" size={14} style={{ color: "var(--admin-accent)" }} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
