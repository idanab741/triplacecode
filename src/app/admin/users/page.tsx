"use client";

import { useEffect, useState } from "react";
import { DataTable, SearchInput, type Column } from "@/screens/admin/shared/DataTable";
import { Badge } from "@/screens/admin/shared/Primitives";
import { adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import type { RealUser } from "@/screens/admin/users/types";
import { UserDetailDrawer } from "@/screens/admin/users/UserDetailDrawer";

const ADMIN_SECRET_HEADER = "x-admin-secret";

export default function UsersPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [users, setUsers] = useState<RealUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeUser, setActiveUser] = useState<RealUser | null>(null);

  useEffect(() => {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    fetch("/api/admin/users", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת משתמשים");
        setUsers(json.users ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה לא ידועה"))
      .finally(() => setLoading(false));
  }, [adminSecret]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const haystack = `${u.fullName ?? ""} ${u.email}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const columns: Column<RealUser>[] = [
    {
      key: "name",
      header: "משתמש",
      sortValue: (u) => u.fullName ?? u.email,
      render: (u) => (
        <div>
          <p className="font-medium">{u.fullName || "ללא שם"}</p>
          <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
            {u.email}
          </p>
        </div>
      ),
    },
    { key: "type", header: "סוג", sortValue: (u) => (u.isAnonymous ? 1 : 0), render: (u) => <Badge tone={u.isAnonymous ? "neutral" : "accent"}>{u.isAnonymous ? "אורח" : "רשום"}</Badge> },
    { key: "trips", header: "מסלולים", sortValue: (u) => u.tripsBuilt, render: (u) => <span className="admin-mono">{u.tripsBuilt}</span>, align: "right" },
    { key: "signup", header: "נרשם ב-", sortValue: (u) => u.signupDate, render: (u) => <span className="admin-mono text-[12.5px]">{new Date(u.signupDate).toLocaleDateString("he-IL")}</span> },
    {
      key: "lastLogin",
      header: "התחברות אחרונה",
      sortValue: (u) => u.lastLogin ?? "",
      render: (u) => <span className="admin-mono text-[12.5px]">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString("he-IL") : "—"}</span>,
    },
    { key: "city", header: "עיר", sortValue: (u) => u.city ?? "", render: (u) => u.city ?? "—" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            משתמשים
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {adminSecret ? `${filtered.length.toLocaleString()} מתוך ${users.length.toLocaleString()} משתמשים אמיתיים` : "נתונים אמיתיים מ-Supabase Auth"}
          </p>
        </div>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="סיסמת אדמין"
          className={adminInputClass}
          style={{ ...adminInputStyle, width: 200 }}
        />
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
          <SearchInput value={search} onChange={setSearch} placeholder="חיפוש לפי שם או אימייל..." />
          <DataTable columns={columns} rows={filtered} keyFor={(u) => u.id} onRowClick={setActiveUser} loading={loading} emptyMessage="לא נמצאו משתמשים" />
        </>
      )}

      <UserDetailDrawer user={activeUser} onClose={() => setActiveUser(null)} />
    </div>
  );
}
