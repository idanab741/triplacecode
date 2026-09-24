"use client";

import { usePathname } from "next/navigation";
import { findNavItem } from "./navConfig";
import { useAdminSecret } from "./AdminAuthContext";
import { Icon } from "@/screens/admin/kit/Icon";

export function AdminHeader({ dark, onToggleDark, onOpenSearch, onOpenMenu }: { dark: boolean; onToggleDark: () => void; onOpenSearch: () => void; onOpenMenu: () => void }) {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const { clearSecret } = useAdminSecret();
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius-sm)] border transition hover:opacity-80";
  const iconBtnStyle = { color: "var(--admin-ink-secondary)", background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)" };

  return (
    <header
      className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur md:px-6"
      style={{ borderColor: "var(--admin-border)", background: "color-mix(in srgb, var(--admin-bg) 85%, transparent)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onOpenMenu} className={`${iconBtn} lg:hidden`} style={iconBtnStyle} aria-label="פתח תפריט">
          <Icon name="menu" size={17} />
        </button>
        <div className="flex min-w-0 items-center gap-2 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
          <span className="hidden sm:inline">{current?.group ?? "אדמין"}</span>
          <Icon name="chevronLeft" size={13} className="hidden sm:block" style={{ color: "var(--admin-ink-faint)" }} />
          <span className="truncate font-semibold" style={{ color: "var(--admin-ink)" }}>
            {current?.label ?? ""}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="hidden h-9 w-72 items-center justify-between gap-2 whitespace-nowrap rounded-[var(--admin-radius-sm)] border px-3 text-[13px] transition hover:opacity-90 md:flex"
          style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink-faint)" }}
        >
          <span className="flex items-center gap-2">
            <Icon name="search" size={15} />
            חיפוש בכל המערכת...
          </span>
          <kbd className="admin-num whitespace-nowrap rounded border px-1.5 text-[11px]" style={{ borderColor: "var(--admin-border)" }} dir="ltr">
            {isMac ? "⌘K" : "Ctrl K"}
          </kbd>
        </button>
        <button type="button" onClick={onOpenSearch} className={`${iconBtn} md:hidden`} style={iconBtnStyle} aria-label="חיפוש">
          <Icon name="search" size={16} />
        </button>
        <button type="button" onClick={onToggleDark} className={iconBtn} style={iconBtnStyle} aria-label={dark ? "מצב בהיר" : "מצב כהה"} title={dark ? "מצב בהיר" : "מצב כהה"}>
          <Icon name={dark ? "sun" : "moon"} size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm("להתנתק מהאדמין? תצטרכו להזין שוב את הסיסמה.")) clearSecret();
          }}
          className={iconBtn}
          style={iconBtnStyle}
          aria-label="התנתקות"
          title="התנתקות"
        >
          <Icon name="logout" size={16} />
        </button>
      </div>
    </header>
  );
}
