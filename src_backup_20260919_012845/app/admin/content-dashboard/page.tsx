"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";

interface PlaceName {
  id: string;
  name: string;
}

const ADMIN_SECRET_HEADER = "x-admin-secret";

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** מסך "יעדים ומקומות": תיבה אחת ופשוטה שמציגה את רשימת שמות המקומות
 *  שקיימים במאגר, לעיון בלבד. במכוון בלי טבלת "לפי מודול" ובלי תגיות
 *  התאמת AI - כדי שהעמוד יהיה קריא במבט אחד, ובלי קישור/ניווט לשום מסך
 *  אחר באדמין (לא מסונכרן עם שום חלק אחר באפליקציה - רשימה עצמאית). */
export default function ContentDashboardPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [names, setNames] = useState<PlaceName[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!adminSecret) return;
    fetch("/api/admin/places?namesOnly=1", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setNames((data.places ?? []) as PlaceName[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת הנתונים"));
  }, [adminSecret]);

  const loading = names === null && !error;

  const filtered = useMemo(() => {
    if (!names) return [];
    const q = search.trim();
    if (!q) return names;
    return names.filter((p) => p.name.includes(q));
  }, [names, search]);

  return (
    <div dir="rtl" className="admin-fade-in flex flex-col gap-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            יעדים ומקומות
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            כל המקומות השמורים במאגר, לעיון מהיר
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/places"
            className="rounded-[var(--admin-radius-sm)] border px-3.5 py-2 text-[13.5px] font-medium transition hover:opacity-80"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
          >
            + הוסף מקום ידנית דרך Google
          </Link>
          <Link
            href="/admin/discovery"
            className="rounded-[var(--admin-radius-sm)] px-3.5 py-2 text-[13.5px] font-medium text-white transition hover:opacity-90"
            style={{ background: "var(--admin-accent)" }}
          >
            🤖 מצא מקומות באמצעות AI
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded-[var(--admin-radius-md)] px-4 py-3 text-[13.5px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </p>
      )}

      {/* תיבה אחת פשוטה - שמות בלבד, ללא קישור לשום מסך אחר */}
      <div
        className="flex flex-col overflow-hidden rounded-[var(--admin-radius-lg)] border"
        style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)", boxShadow: "var(--admin-shadow-sm)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--admin-border)" }}>
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-[var(--admin-radius-sm)]"
              style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
            >
              <MapPinIcon />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold leading-tight" style={{ color: "var(--admin-ink)" }}>
                מקומות בארכיון
              </h2>
              <p className="text-[12.5px] leading-tight" style={{ color: "var(--admin-ink-faint)" }}>
                {loading ? "טוען..." : `${filtered.length.toLocaleString("he-IL")} מתוך ${(names?.length ?? 0).toLocaleString("he-IL")} מקומות`}
              </p>
            </div>
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-ink-faint)" }}>
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש שם מקום..."
              className="w-64 rounded-[var(--admin-radius-sm)] border py-2 pr-9 pl-3 text-[13.5px] outline-none transition focus:ring-2"
              style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
            />
          </div>
        </div>

        <div className="admin-scrollbar max-h-[65vh] overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: "var(--admin-border)" }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="px-5 py-3" style={{ background: "var(--admin-bg-surface)" }}>
                  <div className="admin-skeleton h-4 w-3/4 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-16 text-center text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              {search ? `לא נמצא מקום בשם "${search}"` : "אין עדיין מקומות במאגר"}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: "var(--admin-border)" }}>
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="px-5 py-3 text-[13.5px]"
                  style={{ background: "var(--admin-bg-surface)", color: "var(--admin-ink)" }}
                >
                  {p.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
