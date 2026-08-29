"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { StatCard, EmptyState } from "@/screens/admin/shared/Primitives";
import { LineChart, HorizontalBarChart } from "@/screens/admin/shared/Charts";
import { formatRelativeTimeHe } from "@/utils/relativeTime";

const ADMIN_SECRET_HEADER = "x-admin-secret";

type RangeKey = "today" | "7d" | "30d" | "3mo" | "1y";
type MetricKey = "users" | "active" | "routes" | "tripmatch" | "trippy";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "היום" },
  { value: "7d", label: "7 ימים" },
  { value: "30d", label: "30 ימים" },
  { value: "3mo", label: "3 חודשים" },
  { value: "1y", label: "שנה" },
];

const METRIC_OPTIONS: { value: MetricKey; label: string; color: string }[] = [
  { value: "users", label: "משתמשים חדשים", color: "var(--admin-chart-1)" },
  { value: "active", label: "משתמשים פעילים", color: "var(--admin-chart-2)" },
  { value: "routes", label: "מסלולים שנבנו", color: "var(--admin-chart-3)" },
  { value: "tripmatch", label: "TripMatch", color: "var(--admin-chart-4)" },
  { value: "trippy", label: "Trippy AI", color: "var(--admin-chart-5)" },
];

interface KpiValue {
  value: number;
  deltaPct: number | null;
}

interface DashboardData {
  range: RangeKey;
  kpis: {
    totalUsers: KpiValue;
    activeUsers: KpiValue;
    routesBuilt: KpiValue;
    tripMatchActivity: KpiValue;
    trippyAiUsage: KpiValue;
    tokensConsumed: KpiValue;
  };
  chart: {
    labels: string[];
    series: Record<MetricKey, number[]>;
  };
  needsAttention: { id: string; label: string; description: string; count: number; href: string }[];
  products: {
    tripMatch: { likes: number; matches: number; matchRatePct: number | null; popularDestinations: { label: string; value: number }[] };
    trippyAi: { usages: number; activeUsers: number; tokensConsumed: number };
  };
  recentActivity: { id: string; type: string; title: string; subtitle: string; timestamp: string; href: string }[];
}

const RECENT_ICON: Record<string, string> = {
  user: "👤",
  trip: "🧳",
  match: "❤️",
  trippy: "✨",
  support: "💬",
};

/**
 * Dashboard מרכזי של TRIPLACE Admin - עמוד סיכום בלבד (לא משכפל טבלאות/
 * עמודים קיימים). כל הנתונים אמיתיים (ר' /api/admin/dashboard-stats) -
 * Supabase Auth, trippy_ai_results, tripmatch_sessions,
 * token_transactions ("Tricks"="טריפים"), support_conversations,
 * discovery_jobs. *** בכוונה בלי Trip Builder הקלאסי (הוסר לפי בקשה
 * מפורשת - "לא רלוונטי"). אין Sidebar/ניווט חדש - רק תוכן העמוד עצמו.
 */
export default function DashboardPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [range, setRange] = useState<RangeKey>("30d");
  const [metric, setMetric] = useState<MetricKey>("users");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/dashboard-stats?range=${range}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת נתונים");
        setData(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה לא ידועה"))
      .finally(() => setLoading(false));
  }, [adminSecret, range]);

  const activeMetric = METRIC_OPTIONS.find((m) => m.value === metric)!;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            Dashboard
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            סקירה כללית של פעילות TRIPLACE
          </p>
        </div>
        <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>

      {!adminSecret && (
        <div className="rounded-[var(--admin-radius-lg)] border border-dashed p-10 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            הזן סיסמת אדמין כדי לטעון נתונים אמיתיים
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="admin-skeleton h-28 rounded-[var(--admin-radius-lg)]" />
          ))}
        </div>
      )}

      {data && (
        <>
          {/* 2. שורת KPI ראשית */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="סך המשתמשים" value={data.kpis.totalUsers.value.toLocaleString()} delta={data.kpis.totalUsers.deltaPct ?? undefined} deltaLabel="מהתקופה הקודמת" icon={<Icon path="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21a8 8 0 0 1 16 0" />} />
            <StatCard label="משתמשים פעילים" value={data.kpis.activeUsers.value.toLocaleString()} delta={data.kpis.activeUsers.deltaPct ?? undefined} deltaLabel="מהתקופה הקודמת" icon={<Icon path="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />} />
            <StatCard label="מסלולים שנבנו" value={data.kpis.routesBuilt.value.toLocaleString()} delta={data.kpis.routesBuilt.deltaPct ?? undefined} deltaLabel="מהתקופה הקודמת" icon={<Icon path="M9 20 3 17V4l6 3m0 13 6-3m-6 3V7m6 10 6 3V7l-6-3m0 13V4m0 3-6-3" />} />
            <StatCard label="פעילות TripMatch" value={data.kpis.tripMatchActivity.value.toLocaleString()} delta={data.kpis.tripMatchActivity.deltaPct ?? undefined} deltaLabel="מהתקופה הקודמת" icon={<Icon path="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />} />
            <StatCard label="שימוש ב-Trippy AI" value={data.kpis.trippyAiUsage.value.toLocaleString()} delta={data.kpis.trippyAiUsage.deltaPct ?? undefined} deltaLabel="מהתקופה הקודמת" icon={<Icon path="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-9 9-2 2m0-13 2 2m9 9 2 2" />} />
            <StatCard label="שימוש בטריפים" value={data.kpis.tokensConsumed.value.toLocaleString()} delta={data.kpis.tokensConsumed.deltaPct ?? undefined} deltaLabel="מהתקופה הקודמת" icon={<Icon path="M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" />} />
          </div>

          {/* 3. גרף פעילות מרכזי */}
          <ChartCard title="פעילות TRIPLACE" subtitle="מסלולים שנבנו = Trippy AI + TripMatch בלבד">
            <div className="mb-4">
              <SegmentedControl options={METRIC_OPTIONS.map((m) => ({ value: m.value, label: m.label }))} value={metric} onChange={setMetric} />
            </div>
            <LineChart labels={data.chart.labels} series={[{ label: activeMetric.label, color: activeMetric.color, values: data.chart.series[metric] }]} height={160} />
          </ChartCard>

          {/* 4. "דורש את תשומת לבך" */}
          <ChartCard title="דורש את תשומת לבך" subtitle="פריטים שממתינים לטיפול שלכם כרגע">
            {data.needsAttention.length === 0 ? (
              <EmptyState icon={<span>✅</span>} title="הכל תחת שליטה" description="אין כרגע שום דבר שדורש את תשומת לבכם." />
            ) : (
              <div className="flex flex-col gap-2">
                {data.needsAttention.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="flex items-center justify-between rounded-[var(--admin-radius-sm)] border px-4 py-3 transition"
                    style={{ borderColor: "var(--admin-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-bg-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div>
                      <p className="text-[13.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
                        {item.label}
                      </p>
                      <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                        {item.description}
                      </p>
                    </div>
                    <span
                      className="admin-mono flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[12.5px] font-semibold"
                      style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}
                    >
                      {item.count}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </ChartCard>

          {/* 5. אזור פעילות מוצר */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="TripMatch" subtitle="בטווח שנבחר">
              <div className="flex flex-col gap-3">
                <MiniStat label="לייקים" value={data.products.tripMatch.likes} />
                <MiniStat label="Matches" value={data.products.tripMatch.matches} />
                <MiniStat label="שיעור Match" value={data.products.tripMatch.matchRatePct != null ? `${data.products.tripMatch.matchRatePct}%` : "—"} />
              </div>
              {data.products.tripMatch.popularDestinations.length > 0 && (
                <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--admin-border)" }}>
                  <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
                    יעדים פופולריים (לפי Likes)
                  </p>
                  <HorizontalBarChart data={data.products.tripMatch.popularDestinations} color="var(--admin-chart-4)" />
                </div>
              )}
            </ChartCard>
            <ChartCard title="Trippy AI" subtitle="בטווח שנבחר">
              <div className="flex flex-col gap-3">
                <MiniStat label="שימושים" value={data.products.trippyAi.usages} />
                <MiniStat label="משתמשים פעילים" value={data.products.trippyAi.activeUsers} />
                <MiniStat label="טריפים שנצרכו" value={data.products.trippyAi.tokensConsumed} />
              </div>
            </ChartCard>
          </div>

          {/* 6. פעילות אחרונה */}
          <ChartCard title="פעילות אחרונה" subtitle="האירועים האחרונים במערכת">
            {data.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-[13px]" style={{ color: "var(--admin-ink-faint)" }}>
                אין עדיין פעילות
              </p>
            ) : (
              <div className="flex flex-col">
                {data.recentActivity.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-3 border-b py-2.5 transition last:border-b-0"
                    style={{ borderColor: "var(--admin-border)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-bg-surface-hover)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px]" style={{ background: "var(--admin-bg-sunken)" }}>
                      {RECENT_ICON[item.type] ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium" style={{ color: "var(--admin-ink)" }}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className="truncate text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="admin-mono shrink-0 text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                      {formatRelativeTimeHe(item.timestamp)}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </ChartCard>
        </>
      )}
    </div>
  );
}

function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-[var(--admin-radius-sm)] border p-1" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="rounded-[var(--admin-radius-sm)] px-3 py-1.5 text-[12.5px] font-medium transition"
            style={{ background: active ? "var(--admin-accent)" : "transparent", color: active ? "#fff" : "var(--admin-ink-secondary)" }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
        {label}
      </span>
      <span className="admin-mono text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="admin-fade-in flex flex-col gap-4 rounded-[var(--admin-radius-lg)] border p-5" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
      <div>
        <h3 className="text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          {title}
        </h3>
        <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
          {subtitle}
        </p>
      </div>
      {children}
    </div>
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
