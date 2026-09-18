"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

/** Drawer נגלל מהצד - לעריכת/צפייה בפרטי ישות (משתמש, מקום, יעד וכו').
 *  נסגר ב-Escape ובלחיצה על הרקע. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = 480,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal>
      <div className="absolute inset-0 admin-fade-in" style={{ background: "rgba(10,10,12,0.35)" }} onClick={onClose} />
      <div
        className="admin-fade-in admin-scrollbar relative flex h-full flex-col overflow-y-auto border-l"
        style={{ width, maxWidth: "100vw", background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-lg)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: "var(--admin-border)" }}>
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: "var(--admin-ink)" }}>
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--admin-radius-sm)] transition"
            style={{ color: "var(--admin-ink-secondary)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-bg-sunken)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ✕
          </button>
        </div>

        <div className="flex-1 px-6 py-5">{children}</div>

        {footer && (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** קטע בתוך Drawer - כותרת + תוכן, לחלוקה ברורה של טופס ארוך. */
export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3">
      <h3 className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function AdminButton({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--admin-accent)", color: "#fff" },
    secondary: { background: "var(--admin-bg-sunken)", color: "var(--admin-ink)" },
    danger: { background: "var(--admin-danger-soft)", color: "var(--admin-danger)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-[var(--admin-radius-sm)] px-4 py-2 text-[13.5px] font-medium transition active:scale-[0.98] disabled:opacity-50"
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

export function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export const adminInputClass =
  "w-full rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none transition focus:ring-2";

export const adminInputStyle: React.CSSProperties = {
  background: "var(--admin-bg-surface)",
  borderColor: "var(--admin-border)",
  color: "var(--admin-ink)",
};
