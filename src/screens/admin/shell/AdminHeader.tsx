"use client";

import { usePathname } from "next/navigation";
import { ADMIN_NAV_FLAT } from "./navConfig";
import { useAdminSecret } from "./AdminAuthContext";

export function AdminHeader({ dark, onToggleDark }: { dark: boolean; onToggleDark: () => void }) {
  const pathname = usePathname();
  const current = ADMIN_NAV_FLAT.find((i) => pathname === i.href || pathname?.startsWith(i.href + "/"));
  const { clearSecret } = useAdminSecret();

  return (
    <header
      className="flex h-14 shrink-0 items-center justify-between border-b px-6"
      style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
    >
      <div className="flex items-center gap-2 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
        <span>Admin</span>
        <span style={{ color: "var(--admin-ink-faint)" }}>/</span>
        <span className="font-medium" style={{ color: "var(--admin-ink)" }}>
          {current?.label ?? ""}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-ink-faint)" }}>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            placeholder="חיפוש גלובלי... (⌘K)"
            className="w-64 rounded-[var(--admin-radius-sm)] border py-1.5 pl-9 pr-3 text-[13px] outline-none"
            style={{ background: "var(--admin-bg-sunken)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
          />
        </div>

        <button
          type="button"
          onClick={onToggleDark}
          aria-label="החלף מצב כהה"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--admin-radius-sm)] text-[14px] transition"
          style={{ color: "var(--admin-ink-secondary)", background: "var(--admin-bg-sunken)" }}
        >
          {dark ? "☀" : "☾"}
        </button>

        <button
          type="button"
          onClick={() => {
            if (confirm("להתנתק? תצטרך להזין שוב את סיסמת האדמין.")) clearSecret();
          }}
          className="rounded-[var(--admin-radius-sm)] px-2.5 py-1.5 text-[12.5px] font-medium transition"
          style={{ color: "var(--admin-ink-secondary)", background: "var(--admin-bg-sunken)" }}
        >
          התנתק
        </button>

        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #4a9eff, #1877f2)" }}
        >
          A
        </div>
      </div>
    </header>
  );
}
