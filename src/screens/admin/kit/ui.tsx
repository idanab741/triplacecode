"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { fmt, timeAgo } from "./format";
import { Sparkline } from "./charts";

const surface: CSSProperties = {
  background: "var(--admin-bg-surface)",
  borderColor: "var(--admin-border)",
  boxShadow: "var(--admin-shadow-sm)",
};

export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: IconName }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-[var(--admin-radius-md)]" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}>
            <Icon name={icon} size={20} />
          </span>
        )}
        <div>
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight" style={{ color: "var(--admin-ink)" }}>
            {title}
          </h1>
          {subtitle && (
            <div className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", style, padded = true, id }: { children: ReactNode; className?: string; style?: CSSProperties; padded?: boolean; id?: string }) {
  return (
    <section id={id} className={`admin-fade-in min-w-0 rounded-[var(--admin-radius-lg)] border ${padded ? "p-5" : ""} ${className}`} style={{ ...surface, ...style }}>
      {children}
    </section>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: string; subtitle?: ReactNode; action?: ReactNode; icon?: IconName }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-[160px] flex-1 items-center gap-2">
        {icon && <Icon name={icon} size={16} style={{ color: "var(--admin-ink-faint)" }} />}
        <div className="min-w-0">
          <h2 className="text-[14.5px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            {title}
          </h2>
          {subtitle && (
            <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md" }: { value: T; onChange: (v: T) => void; options: readonly { value: T; label: string }[]; size?: "sm" | "md" }) {
  return (
    <div role="tablist" className="inline-flex rounded-[var(--admin-radius-sm)] border p-0.5" style={{ background: "var(--admin-bg-sunken)", borderColor: "var(--admin-border)" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-[6px] font-medium transition ${size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"}`}
            style={{
              background: active ? "var(--admin-bg-surface)" : "transparent",
              color: active ? "var(--admin-ink)" : "var(--admin-ink-secondary)",
              boxShadow: active ? "var(--admin-shadow-sm)" : "none",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  icon,
  disabled,
  href,
  size = "md",
  type = "button",
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  disabled?: boolean;
  href?: string;
  size?: "sm" | "md";
  type?: "button" | "submit";
}) {
  const styles: Record<string, CSSProperties> = {
    primary: { background: "var(--admin-accent)", color: "var(--admin-accent-ink)", borderColor: "transparent" },
    secondary: { background: "var(--admin-bg-surface)", color: "var(--admin-ink)", borderColor: "var(--admin-border)" },
    ghost: { background: "transparent", color: "var(--admin-ink-secondary)", borderColor: "transparent" },
    danger: { background: "var(--admin-danger-soft)", color: "var(--admin-danger)", borderColor: "transparent" },
  };
  const cls = `inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--admin-radius-sm)] border font-medium transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${
    size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"
  }`;
  const inner = (
    <>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} style={styles[variant]}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} style={styles[variant]}>
      {inner}
    </button>
  );
}

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: "var(--admin-bg-sunken)", fg: "var(--admin-ink-secondary)" },
  accent: { bg: "var(--admin-accent-soft)", fg: "var(--admin-accent)" },
  success: { bg: "var(--admin-success-soft)", fg: "var(--admin-success)" },
  warning: { bg: "var(--admin-warning-soft)", fg: "var(--admin-warning)" },
  danger: { bg: "var(--admin-danger-soft)", fg: "var(--admin-danger)" },
};

export function Pill({ children, tone = "neutral", icon }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium" style={{ background: t.bg, color: t.fg }}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

/** שינוי באחוזים מול התקופה הקודמת. goodWhenUp=false הופך צבעים (למשל כשלונות). */
export function Delta({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value === null) return <Pill tone="accent">חדש</Pill>;
  if (value === 0) return <Pill>ללא שינוי</Pill>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <Pill tone={good ? "success" : "danger"} icon={up ? "arrowUp" : "arrowDown"}>
      <span className="admin-num" dir="ltr">
        {Math.abs(value)}%
      </span>
    </Pill>
  );
}

/** אריח מדד: לייבל, מספר, שינוי מול תקופה קודמת ו-sparkline. */
export function StatTile({
  label,
  value,
  delta,
  spark,
  hint,
  icon,
  suffix,
  goodWhenUp,
  sparkLabel,
}: {
  label: string;
  value: number | string;
  delta?: number | null;
  spark?: number[];
  hint?: string;
  icon?: IconName;
  suffix?: string;
  goodWhenUp?: boolean;
  sparkLabel?: string;
}) {
  return (
    <Card className="flex flex-col gap-3" style={{ padding: 18 }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--admin-ink-secondary)" }} title={hint}>
          {icon && <Icon name={icon} size={15} style={{ color: "var(--admin-ink-faint)" }} />}
          {label}
        </span>
        {delta !== undefined && <Delta value={delta} goodWhenUp={goodWhenUp} />}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="admin-num text-[28px] font-semibold leading-none tracking-tight" style={{ color: "var(--admin-ink)" }}>
          {typeof value === "number" ? fmt(value) : value}
          {suffix && (
            <span className="mr-1 text-[15px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
              {suffix}
            </span>
          )}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} label={sparkLabel ?? label} />}
      </div>
      {hint && (
        <p className="text-[11.5px] leading-snug" style={{ color: "var(--admin-ink-faint)" }}>
          {hint}
        </p>
      )}
    </Card>
  );
}

/** מספר קטן + תווית, לשורות סיכום בתוך כרטיסים. */
export function MiniStat({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: Tone; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[var(--admin-radius-md)] px-3 py-2.5" style={{ background: "var(--admin-bg-sunken)" }}>
      <span className="truncate text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
        {label}
      </span>
      <span className="admin-num text-[19px] font-semibold leading-none" style={{ color: tone ? TONES[tone].fg : "var(--admin-ink)" }}>
        {value}
      </span>
      {sub && (
        <span className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function Avatar({ name, url, size = 28 }: { name: string; url?: string | null; size?: number }) {
  const initial = name.replace("@", "").trim().charAt(0) || "?";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42, background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

export function Meter({ value, tone = "accent", label }: { value: number; tone?: Tone; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = tone === "accent" ? "var(--admin-chart-1)" : TONES[tone].fg;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--admin-bg-sunken)" }} role="meter" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

export function LoadingGrid({ tiles = 4, blocks = 2 }: { tiles?: number; blocks?: number }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <div key={i} className="admin-skeleton h-[132px]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {Array.from({ length: blocks }).map((_, i) => (
          <div key={i} className={`admin-skeleton h-[320px] ${i === 0 ? "xl:col-span-2" : ""}`} />
        ))}
      </div>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--admin-radius-md)] border px-4 py-3 text-[13px]" style={{ background: "var(--admin-danger-soft)", borderColor: "transparent", color: "var(--admin-danger)" }}>
      <span className="flex items-center gap-2">
        <Icon name="alertCircle" size={16} />
        {message}
      </span>
      {onRetry && (
        <Button size="sm" variant="secondary" icon="refresh" onClick={onRetry}>
          נסה שוב
        </Button>
      )}
    </div>
  );
}

export function Empty({ text, icon = "info" }: { text: string; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-[13px]" style={{ color: "var(--admin-ink-faint)" }}>
      <Icon name={icon} size={22} />
      {text}
    </div>
  );
}

export function UpdatedAt({ at, loading, onRefresh }: { at: number | null; loading: boolean; onRefresh: () => void }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex items-center gap-1.5 rounded-[var(--admin-radius-sm)] px-2 py-1.5 text-[12px] transition hover:opacity-80"
      style={{ color: "var(--admin-ink-secondary)" }}
      title="רענון"
    >
      <Icon name="refresh" size={13} className={loading ? "animate-spin" : ""} />
      {at ? `עודכן ${timeAgo(new Date(at).toISOString())}` : "טוען..."}
    </button>
  );
}

export function LinkRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-[var(--admin-radius-sm)] px-2 py-2 transition hover:bg-[var(--admin-bg-surface-hover)]">
      {children}
      <Icon name="chevronLeft" size={14} style={{ color: "var(--admin-ink-faint)" }} />
    </Link>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 mt-2 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
      {children}
    </h3>
  );
}
