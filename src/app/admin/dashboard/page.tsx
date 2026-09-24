"use client";

import Link from "next/link";
import { useState } from "react";
import type { OverviewData } from "@/services/admin/insights/overview";
import { useAdminData, useStoredRange } from "@/screens/admin/kit/useAdminData";
import { RANGE_OPTIONS, type RangeValue, fmt, fmtPct, timeAgo } from "@/screens/admin/kit/format";
import { PageHeader, Card, CardHeader, Segmented, StatTile, MiniStat, Avatar, LoadingGrid, ErrorBanner, UpdatedAt, Empty, Pill } from "@/screens/admin/kit/ui";
import { TrendChart, BarList, Funnel, Heatmap, CohortTable, StackedBar, SERIES_COLORS } from "@/screens/admin/kit/charts";
import { Icon, type IconName } from "@/screens/admin/kit/Icon";

const KPI_ICONS: Record<string, IconName> = { signups: "users", active: "pulse", trips: "route", tripmatch: "heart", social: "community", tokens: "coins" };
const FEED_ICONS: Record<string, IconName> = {
  signup: "users",
  trip: "route",
  trippy: "sparkles",
  tripmatch: "heart",
  post: "community",
  comment: "community",
  review: "star",
  story: "image",
  favorite: "heart",
  like: "heart",
  dm: "community",
  follow: "users",
};

export default function DashboardPage() {
  const [range, setRange] = useStoredRange<RangeValue>("triplace_admin_range", "30d");
  const { data, error, loading, reload, updatedAt } = useAdminData<OverviewData>(`/api/admin/insights/overview?range=${range}`, { refreshMs: 120000 });
  const [metric, setMetric] = useState("active");

  return (
    <div>
      <PageHeader
        icon="dashboard"
        title="מרכז שליטה"
        subtitle="תמונת מצב חיה של TRIPLACE - משתמשים, שימוש, קהילה ובעיות שדורשות טיפול"
        actions={
          <>
            <UpdatedAt at={updatedAt} loading={loading} onRefresh={reload} />
            <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} />
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      )}
      {!data && loading && <LoadingGrid tiles={6} />}

      {data && (
        <div className="flex flex-col gap-4">
          {data.attention.length > 0 && (
            <Card style={{ padding: 14 }}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="ml-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                  <Icon name="alert" size={16} style={{ color: "var(--admin-warning)" }} />
                  דורש טיפול
                </span>
                {data.attention.map((a) => (
                  <Link
                    key={a.id}
                    href={a.href}
                    className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] transition hover:opacity-80"
                    style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
                  >
                    <span
                      className="admin-num rounded-full px-1.5 text-[11.5px] font-semibold"
                      style={{
                        background: a.tone === "danger" ? "var(--admin-danger-soft)" : a.tone === "warning" ? "var(--admin-warning-soft)" : "var(--admin-bg-sunken)",
                        color: a.tone === "danger" ? "var(--admin-danger)" : a.tone === "warning" ? "var(--admin-warning)" : "var(--admin-ink-secondary)",
                      }}
                    >
                      {a.count}
                    </span>
                    {a.label}
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <Card className="flex flex-col justify-between gap-5 xl:col-span-1" style={{ background: "linear-gradient(160deg, var(--admin-bg-surface) 0%, var(--admin-accent-soft) 140%)" }}>
              <div>
                <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                  <Icon name="users" size={15} />
                  משתמשים רשומים
                </div>
                <div className="admin-num mt-3 text-[52px] font-semibold leading-none tracking-tight">{fmt(data.totals.registered)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
                  <Pill tone="success" icon="arrowUp">
                    {fmt(data.totals.newThisPeriod)} בתקופה
                  </Pill>
                  <span>+ {fmt(data.totals.guests)} אורחים</span>
                </div>
              </div>
              <div>
                <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--admin-ink-faint)" }}>
                  מעורבות (Stickiness)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="יומי" value={fmt(data.stickiness.dau)} />
                  <MiniStat label="שבועי" value={fmt(data.stickiness.wau)} />
                  <MiniStat label="חודשי" value={fmt(data.stickiness.mau)} />
                </div>
                <p className="mt-2 text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                  יחס יומי/חודשי: <b className="admin-num">{fmtPct(data.stickiness.dauMauPct, 1)}</b>
                  <span style={{ color: "var(--admin-ink-faint)" }}> · מעל 20% נחשב טוב</span>
                </p>
              </div>
            </Card>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
              {data.kpis.map((k) => (
                <StatTile key={k.key} label={k.label} value={k.value} delta={k.deltaPct} spark={k.spark} icon={KPI_ICONS[k.key]} hint={k.hint} />
              ))}
            </div>
          </div>

          <Card>
            <CardHeader
              title="פעילות לאורך זמן"
              subtitle={`חלוקה ${data.chart.granularity === "day" ? "יומית" : data.chart.granularity === "week" ? "שבועית" : "חודשית"} · שעון ישראל`}
              action={<Segmented size="sm" value={metric} onChange={setMetric} options={data.chart.series.map((s) => ({ value: s.key, label: s.label }))} />}
            />
            {(() => {
              const idx = data.chart.series.findIndex((s) => s.key === metric);
              const s = data.chart.series[Math.max(0, idx)];
              return <TrendChart labels={data.chart.labels} series={[{ ...s, color: SERIES_COLORS[Math.max(0, idx)] }]} height={280} />;
            })()}
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader title="משפך הפעלה" subtitle="כל המשתמשים הרשומים, מאז ההשקה" icon="zap" />
              <Funnel steps={data.funnel} />
            </Card>
            <Card>
              <CardHeader title="מה בונים" subtitle="טיולים שנפתחו בתקופה לפי סוג" icon="route" />
              <BarList items={data.productMix} />
            </Card>
            <Card>
              <CardHeader title="ערים מבוקשות" subtitle="TripMatch + Trippy AI" icon="place" />
              <BarList items={data.topCities} color="var(--admin-chart-3)" />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="מתי המשתמשים פעילים" subtitle="פעולות לפי יום ושעה בתקופה" icon="clock" />
              <Heatmap grid={data.heatmap} />
            </Card>
            <Card>
              <CardHeader title="איך נרשמים" subtitle="כל החשבונות לפי ספק" icon="users" />
              <StackedBar parts={data.providers} />
              <div className="mt-6">
                <div className="mb-3 text-[12px] font-semibold" style={{ color: "var(--admin-ink-faint)" }}>
                  פעולות לפי סוג (בתקופה)
                </div>
                <BarList items={data.byKind.slice(0, 7)} color="var(--admin-chart-2)" />
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="שימור לפי קוהורטות" subtitle="אחוז מכל שבוע הרשמה שחזר ופעל בשבועות הבאים" icon="refresh" />
              <CohortTable cohorts={data.cohorts} />
            </Card>
            <Card>
              <CardHeader title="המשתמשים הפעילים ביותר" subtitle="מספר פעולות בתקופה" icon="star" />
              {data.topUsers.length === 0 ? (
                <Empty text="אין פעילות בתקופה" />
              ) : (
                <ul className="flex flex-col gap-1">
                  {data.topUsers.map((u, i) => (
                    <li key={u.id}>
                      <Link href={`/admin/users?user=${u.id}`} className="flex items-center gap-3 rounded-[var(--admin-radius-sm)] px-2 py-1.5 transition hover:bg-[var(--admin-bg-surface-hover)]">
                        <span className="admin-num w-4 text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                          {i + 1}
                        </span>
                        <Avatar name={u.name} url={u.avatarUrl} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{u.name}</span>
                        <span className="admin-num text-[13px] font-semibold">{fmt(u.value)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="פיד פעילות חי" subtitle="מתעדכן אוטומטית כל 2 דקות" icon="pulse" action={<span className="admin-live-dot" />} />
            {data.feed.length === 0 ? (
              <Empty text="אין פעילות עדיין" />
            ) : (
              <ul className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                {data.feed.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--admin-border)" }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-secondary)" }}>
                      <Icon name={FEED_ICONS[e.kind] ?? "pulse"} size={14} />
                    </span>
                    <div className="min-w-0 flex-1 text-[13px]">
                      <Link href={`/admin/users?user=${e.userId}`} className="font-semibold hover:underline">
                        {e.userName}
                      </Link>{" "}
                      <span style={{ color: "var(--admin-ink-secondary)" }}>· {e.label}</span>
                    </div>
                    <span className="shrink-0 text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                      {timeAgo(e.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {data.warnings.length > 0 && (
            <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
              חלק ממקורות הנתונים לא נטענו: {data.warnings.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
