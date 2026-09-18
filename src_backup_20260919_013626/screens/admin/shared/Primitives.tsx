import type { ReactNode } from "react";

/** כרטיס מדד יחיד ל-Dashboard - מספר גדול, לייבל, ושינוי מגמה (חיובי/שלילי). */
export function StatCard({
  label,
  value,
  delta,
  deltaLabel = "מהחודש הקודם",
  icon,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  icon?: ReactNode;
}) {
  const isUp = typeof delta === "number" && delta >= 0;
  return (
    <div
      className="admin-fade-in flex flex-col gap-3 rounded-[var(--admin-radius-lg)] border p-5"
      style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-sm)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
          {label}
        </span>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--admin-radius-sm)]" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}>
            {icon}
          </span>
        )}
      </div>
      <div className="admin-mono text-[28px] font-semibold leading-none" style={{ color: "var(--admin-ink)" }}>
        {value}
      </div>
      {typeof delta === "number" && (
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span
            className="admin-mono flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium"
            style={{
              color: isUp ? "var(--admin-success)" : "var(--admin-danger)",
              background: isUp ? "var(--admin-success-soft)" : "var(--admin-danger-soft)",
            }}
          >
            {isUp ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
          <span style={{ color: "var(--admin-ink-faint)" }}>{deltaLabel}</span>
        </div>
      )}
    </div>
  );
}

/** תגית סטטוס קטנה (Published/Draft/Active/Blocked וכו'). */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "accent";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: "var(--admin-bg-sunken)", fg: "var(--admin-ink-secondary)" },
    success: { bg: "var(--admin-success-soft)", fg: "var(--admin-success)" },
    warning: { bg: "var(--admin-warning-soft)", fg: "var(--admin-warning)" },
    danger: { bg: "var(--admin-danger-soft)", fg: "var(--admin-danger)" },
    accent: { bg: "var(--admin-accent-soft)", fg: "var(--admin-accent)" },
  };
  const t = tones[tone];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

/** מצב ריק מעוצב - למסכי "בקרוב" ולטבלאות ללא תוצאות. לא Placeholder עצלן -
 *  זהו pattern לגיטימי במוצרי SaaS אמיתיים (Linear, Notion). */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[var(--admin-radius-lg)] border border-dashed px-6 py-20 text-center" style={{ borderColor: "var(--admin-border)" }}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
        {icon}
      </span>
      <h3 className="text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
        {title}
      </h3>
      <p className="max-w-sm text-[13.5px] leading-relaxed" style={{ color: "var(--admin-ink-secondary)" }}>
        {description}
      </p>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`admin-skeleton ${className}`} />;
}
