"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { DataTable, SearchInput, FilterSelect, type Column } from "@/screens/admin/shared/DataTable";
import { Badge } from "@/screens/admin/shared/Primitives";
import type { RealUser, UserFilters } from "@/screens/admin/users/types";
import { EMPTY_FILTERS } from "@/screens/admin/users/types";
import { UserDetailDrawer } from "@/screens/admin/users/UserDetailDrawer";

const ADMIN_SECRET_HEADER = "x-admin-secret";
const PAGE_SIZE = 25;

export default function UsersPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [tab, setTab] = useState<"registered" | "guest">("registered");
  const [counts, setCounts] = useState({ registered: 0, guest: 0 });
  const [users, setUsers] = useState<RealUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // debounce לחיפוש/עריכת פילטרים חופשיים (destination), כדי לא לירות
  // בקשה על כל תו - שאר הפילטרים (select/tab) יורים מיד.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [debouncedDestination, setDebouncedDestination] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(t);
  }, [filters.search]);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedDestination(filters.destination), 300);
    return () => clearTimeout(t);
  }, [filters.destination]);

  useEffect(() => {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ type: tab });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filters.account) params.set("account", filters.account);
    if (filters.registration) params.set("registration", filters.registration);
    if (filters.activity) params.set("activity", filters.activity);
    if (filters.trips) params.set("trips", filters.trips);
    if (debouncedDestination) params.set("destination", debouncedDestination);
    if (filters.interest) params.set("interest", filters.interest);
    if (filters.ageMin) params.set("ageMin", filters.ageMin);
    if (filters.ageMax) params.set("ageMax", filters.ageMax);

    fetch(`/api/admin/users?${params.toString()}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת משתמשים");
        setUsers(json.users ?? []);
        setCounts(json.counts ?? { registered: 0, guest: 0 });
        setPage(1);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה לא ידועה"))
      .finally(() => setLoading(false));
  }, [adminSecret, tab, debouncedSearch, filters.account, filters.registration, filters.activity, filters.trips, debouncedDestination, filters.interest, filters.ageMin, filters.ageMax]);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== "search" && v).length;

  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pagedUsers = useMemo(() => users.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [users, page]);

  const columns: Column<RealUser>[] = [
    {
      key: "name",
      header: "משתמש",
      sortValue: (u) => u.fullName ?? u.email,
      render: (u) => (
        <div className="flex items-center gap-2">
          {u.isBanned && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--admin-danger)" }} title="מושעה" />}
          <div>
            <p className="font-medium">{u.fullName || "ללא שם"}</p>
            <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
              {u.email || u.id}
            </p>
          </div>
        </div>
      ),
    },
    { key: "city", header: "עיר", sortValue: (u) => u.city ?? "", render: (u) => (u.city ? `${u.city}${u.country ? `, ${u.country}` : ""}` : "—") },
    {
      key: "onboarding",
      header: "Onboarding",
      sortValue: (u) => (u.onboardingCompleted ? 1 : 0),
      render: (u) => <Badge tone={u.onboardingCompleted ? "success" : "warning"}>{u.onboardingCompleted ? "הושלם" : "לא הושלם"}</Badge>,
    },
    { key: "trips", header: "מסלולים", sortValue: (u) => u.tripsBuilt, render: (u) => <span className="admin-mono">{u.tripsBuilt}</span>, align: "center" },
    { key: "likes", header: "Likes", sortValue: (u) => u.likes, render: (u) => <span className="admin-mono">{u.likes}</span>, align: "center" },
    { key: "saves", header: "Saves", sortValue: (u) => u.saves, render: (u) => <span className="admin-mono">{u.saves}</span>, align: "center" },
    {
      key: "lastActivity",
      header: "פעילות אחרונה",
      sortValue: (u) => u.lastActivity ?? "",
      render: (u) => <span className="admin-mono text-[12.5px]">{u.lastActivity ? new Date(u.lastActivity).toLocaleDateString("he-IL") : "—"}</span>,
    },
    { key: "signup", header: "נרשם ב-", sortValue: (u) => u.signupDate, render: (u) => <span className="admin-mono text-[12.5px]">{new Date(u.signupDate).toLocaleDateString("he-IL")}</span> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            משתמשים
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {adminSecret ? `${users.length.toLocaleString()} תוצאות` : "נתונים אמיתיים מ-Supabase Auth"}
          </p>
        </div>
      </div>

      {!adminSecret && (
        <div className="rounded-[var(--admin-radius-lg)] border border-dashed p-10 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            הזן סיסמת אדמין כדי לטעון את רשימת המשתמשים האמיתית
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {adminSecret && (
        <>
          {/* 1. USERS VS GUESTS - ברירת מחדל: רשומים בלבד, לא מעורבבים */}
          <div className="inline-flex w-fit gap-1 rounded-[var(--admin-radius-sm)] border p-1" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
            <button
              type="button"
              onClick={() => setTab("registered")}
              className="rounded-[var(--admin-radius-sm)] px-3.5 py-1.5 text-[13px] font-medium transition"
              style={{ background: tab === "registered" ? "var(--admin-accent)" : "transparent", color: tab === "registered" ? "#fff" : "var(--admin-ink-secondary)" }}
            >
              משתמשים <span className="admin-mono">{counts.registered}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("guest")}
              className="rounded-[var(--admin-radius-sm)] px-3.5 py-1.5 text-[13px] font-medium transition"
              style={{ background: tab === "guest" ? "var(--admin-accent)" : "transparent", color: tab === "guest" ? "#fff" : "var(--admin-ink-secondary)" }}
            >
              אורחים <span className="admin-mono">{counts.guest}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={filters.search} onChange={(v) => setFilters((f) => ({ ...f, search: v }))} placeholder="חיפוש לפי שם, email, User ID, עיר..." />
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              className="inline-flex items-center gap-1.5 rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13px] font-medium transition"
              style={{ borderColor: filtersOpen || activeFilterCount > 0 ? "var(--admin-accent)" : "var(--admin-border)", color: filtersOpen || activeFilterCount > 0 ? "var(--admin-accent)" : "var(--admin-ink-secondary)" }}
            >
              סינון {activeFilterCount > 0 && <span className="admin-mono">({activeFilterCount})</span>}
            </button>
            {activeFilterCount > 0 && (
              <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="text-[12.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                נקה סינונים
              </button>
            )}
          </div>

          {filtersOpen && (
            <div className="flex flex-wrap gap-2 rounded-[var(--admin-radius-lg)] border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
              <FilterSelect
                value={filters.account}
                onChange={(v) => setFilters((f) => ({ ...f, account: v }))}
                placeholder="חשבון"
                options={[
                  { value: "active", label: "פעיל" },
                  { value: "inactive", label: "מושעה" },
                  { value: "onboarding_complete", label: "Onboarding הושלם" },
                  { value: "onboarding_incomplete", label: "Onboarding לא הושלם" },
                ]}
              />
              <FilterSelect
                value={filters.registration}
                onChange={(v) => setFilters((f) => ({ ...f, registration: v }))}
                placeholder="הרשמה"
                options={[
                  { value: "today", label: "היום" },
                  { value: "7d", label: "7 ימים אחרונים" },
                  { value: "30d", label: "30 ימים אחרונים" },
                ]}
              />
              <FilterSelect
                value={filters.activity}
                onChange={(v) => setFilters((f) => ({ ...f, activity: v }))}
                placeholder="פעילות"
                options={[
                  { value: "today", label: "פעיל היום" },
                  { value: "7d", label: "פעיל ב-7 ימים" },
                  { value: "30d", label: "פעיל ב-30 ימים" },
                  { value: "inactive", label: "לא פעיל (30+ ימים)" },
                ]}
              />
              <FilterSelect
                value={filters.trips}
                onChange={(v) => setFilters((f) => ({ ...f, trips: v }))}
                placeholder="מסלולים"
                options={[
                  { value: "has", label: "יש מסלולים" },
                  { value: "none", label: "אין מסלולים" },
                ]}
              />
              <input
                value={filters.destination}
                onChange={(e) => setFilters((f) => ({ ...f, destination: e.target.value }))}
                placeholder="יעד (חיפש/בחר)..."
                className="rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none"
                style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
              />
              <input
                value={filters.interest}
                onChange={(e) => setFilters((f) => ({ ...f, interest: e.target.value }))}
                placeholder="תחום עניין..."
                className="rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none"
                style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
              />
              <input
                value={filters.ageMin}
                onChange={(e) => setFilters((f) => ({ ...f, ageMin: e.target.value }))}
                placeholder="גיל מ-"
                type="number"
                className="w-20 rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none"
                style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
              />
              <input
                value={filters.ageMax}
                onChange={(e) => setFilters((f) => ({ ...f, ageMax: e.target.value }))}
                placeholder="גיל עד"
                type="number"
                className="w-20 rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none"
                style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
              />
            </div>
          )}

          <DataTable columns={columns} rows={pagedUsers} keyFor={(u) => u.id} onRowClick={(u) => setActiveUserId(u.id)} loading={loading} emptyMessage="לא נמצאו משתמשים" />

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-[var(--admin-radius-sm)] border px-3 py-1.5 text-[13px] disabled:opacity-40"
                style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
              >
                הקודם
              </button>
              <span className="admin-mono text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
                עמוד {page} מתוך {pageCount}
              </span>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="rounded-[var(--admin-radius-sm)] border px-3 py-1.5 text-[13px] disabled:opacity-40"
                style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
              >
                הבא
              </button>
            </div>
          )}
        </>
      )}

      <UserDetailDrawer
        userId={activeUserId}
        onClose={() => setActiveUserId(null)}
        onDeleted={() => {
          setActiveUserId(null);
          setUsers((all) => all.filter((u) => u.id !== activeUserId));
        }}
      />
    </div>
  );
}
