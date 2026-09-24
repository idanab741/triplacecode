"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, findNavItem } from "./navConfig";
import { Icon } from "@/screens/admin/kit/Icon";
import { useAdminData } from "@/screens/admin/kit/useAdminData";

interface Badges {
  support: number;
  submissions: number;
}

export function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const active = findNavItem(pathname);
  const { data: badges } = useAdminData<Badges>("/api/admin/insights/badges", { refreshMs: 60000 });

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} aria-hidden />}
      <aside
        className={`admin-side-scroll fixed inset-y-0 right-0 z-40 flex w-64 shrink-0 flex-col overflow-y-auto transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ background: "var(--admin-side-bg)", borderLeft: "1px solid var(--admin-side-border)" }}
        aria-label="ניווט אדמין"
      >
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[15px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, #4a9eff 0%, #1f6fe5 55%, #6a5cff 100%)", boxShadow: "0 6px 16px -6px rgba(74,158,255,0.7)" }}
          >
            T
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-wide text-white">TRIPLACE</div>
            <div className="text-[11.5px]" style={{ color: "var(--admin-side-ink-faint)" }}>
              Control Center
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-5 px-3 pb-6 pt-2">
          {ADMIN_NAV.map((group) => (
            <div key={group.title} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wide" style={{ color: "var(--admin-side-ink-faint)" }}>
                {group.title}
              </p>
              {group.items.map((item) => {
                const isActive = active?.href === item.href;
                const count = item.badge ? (badges?.[item.badge] ?? 0) : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    aria-current={isActive ? "page" : undefined}
                    className="group relative flex items-center justify-between rounded-[var(--admin-radius-sm)] px-3 py-2 text-[13.5px] transition-colors hover:bg-[var(--admin-side-bg-hover)]"
                    style={{
                      background: isActive ? "var(--admin-side-active)" : undefined,
                      color: isActive ? "#ffffff" : "var(--admin-side-ink)",
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {isActive && <span className="absolute inset-y-1.5 right-0 w-[3px] rounded-full" style={{ background: "#4a9eff" }} />}
                    <span className="flex items-center gap-2.5">
                      <Icon name={item.icon} size={16} style={{ color: isActive ? "#7fb6ff" : "var(--admin-side-ink-faint)" }} />
                      {item.label}
                    </span>
                    {count > 0 && (
                      <span
                        className="admin-num min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[11px] font-semibold"
                        style={{ background: item.badge === "support" ? "#e5484d" : "#2a4a80", color: "#fff" }}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mx-3 mb-4 rounded-[var(--admin-radius-md)] px-3 py-3 text-[12px]" style={{ background: "var(--admin-side-bg-hover)", color: "var(--admin-side-ink)" }}>
          <div className="flex items-center gap-2">
            <span className="admin-live-dot" />
            נתונים חיים מ-Supabase
          </div>
          <div className="mt-1" style={{ color: "var(--admin-side-ink-faint)" }}>
            ⌘K לחיפוש מהיר בכל המערכת
          </div>
        </div>
      </aside>
    </>
  );
}
