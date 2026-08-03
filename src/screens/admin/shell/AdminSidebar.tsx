"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "./navConfig";

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="admin-scrollbar flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r"
      style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)" }}
    >
      <div className="flex items-center gap-2 px-5 py-5">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[var(--admin-radius-sm)] text-[13px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #4a9eff, #1877f2)" }}
        >
          T
        </span>
        <span className="text-[14.5px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          TRIPLACE <span style={{ color: "var(--admin-ink-faint)", fontWeight: 500 }}>Admin</span>
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 px-3 pb-6">
        {ADMIN_NAV.map((group) => (
          <div key={group.title} className="flex flex-col gap-0.5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
              {group.title}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between rounded-[var(--admin-radius-sm)] px-3 py-2 text-[13.5px] font-medium transition"
                  style={{
                    background: active ? "var(--admin-accent-soft)" : "transparent",
                    color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "var(--admin-bg-surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className="text-[13px] leading-none">
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                  {item.status === "soon" && (
                    <span className="admin-mono rounded-full px-1.5 py-0.5 text-[9.5px] font-medium" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
                      בקרוב
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
