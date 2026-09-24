"use client";

import type { ContentData } from "@/services/admin/insights/content";
import { useAdminData, useStoredRange } from "@/screens/admin/kit/useAdminData";
import { RANGE_OPTIONS, type RangeValue, fmt, pctOf } from "@/screens/admin/kit/format";
import { PageHeader, Card, CardHeader, Segmented, StatTile, MiniStat, Button, LoadingGrid, ErrorBanner, UpdatedAt, Pill } from "@/screens/admin/kit/ui";
import { TrendChart, BarList, StackedBar, ColumnChart } from "@/screens/admin/kit/charts";

export default function ContentPage() {
  const [range, setRange] = useStoredRange<RangeValue>("triplace_admin_range", "30d");
  const { data, error, loading, reload, updatedAt } = useAdminData<ContentData>(`/api/admin/insights/content?range=${range}`);

  return (
    <div>
      <PageHeader
        icon="content"
        title="מלאי תוכן"
        subtitle="כל מה שיש במאגר: מקומות, יעדים, מהדורות וטקסונומיה - מאיפה הגיע ואיפה חסר"
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
      {!data && loading && <LoadingGrid tiles={4} />}

      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="מקומות פעילים" value={data.totals.active} icon="place" hint={`${fmt(data.totals.legacy)} נוספים בארכיון`} />
            <StatTile label="נוספו בתקופה" value={data.totals.addedThisPeriod} icon="sparkles" spark={data.added.series[0].values} />
            <StatTile label="יעדים" value={data.totals.destinations} icon="globe" hint={`${fmt(data.totals.hotDestinations)} מסומנים כיעדים חמים`} />
            <StatTile label="מהדורות יעד" value={data.totals.editions} icon="layers" hint={`${fmt(data.totals.publishedEditions)} מפורסמות`} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="קצב הוספת מקומות" subtitle="כל המקורות (כולל ארכיון)" icon="sparkles" />
              <TrendChart labels={data.added.labels} series={data.added.series} height={240} />
              {data.added.bySource.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--admin-ink-faint)" }}>
                    מקור המקומות שנוספו בתקופה
                  </div>
                  <StackedBar parts={data.added.bySource} />
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="לפי קטגוריה ראשית" subtitle="מקומות פעילים" icon="tag" />
              <BarList
                items={data.byCategory.map((c) => ({
                  label: c.label,
                  value: c.value,
                  sub: `${pctOf(c.value, data.totals.active) ?? 0}%`,
                  color: c.key === "invalid" ? "var(--admin-danger)" : undefined,
                }))}
              />
              {data.invalidCategories.length > 0 && (
                <div className="mt-4 rounded-[var(--admin-radius-sm)] p-3" style={{ background: "var(--admin-danger-soft)" }}>
                  <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--admin-danger)" }}>
                    ערכי קטגוריה לא תקניים
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.invalidCategories.map((c) => (
                      <Pill key={c.label} tone="danger">
                        <span className="admin-mono">{c.label}</span> · {c.value}
                      </Pill>
                    ))}
                  </div>
                  <div className="mt-3">
                    <Button size="sm" href="/admin/places" icon="wrench">
                      תקן בכלי הסיווג
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Card>
              <CardHeader title="מדינות" subtitle="מקומות פעילים" icon="globe" />
              <BarList items={data.byCountry.map((c) => ({ ...c, color: c.label === "ללא מדינה" ? "var(--admin-danger)" : undefined }))} />
            </Card>
            <Card>
              <CardHeader title="ערים מובילות" subtitle="מקומות פעילים" icon="place" />
              <BarList items={data.byCity} color="var(--admin-chart-3)" />
            </Card>
            <Card>
              <CardHeader title="מקורות" subtitle="איך המקומות נכנסו למאגר" icon="database" />
              <BarList items={data.bySource} color="var(--admin-chart-2)" />
              <div className="mt-6">
                <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--admin-ink-faint)" }}>
                  התפלגות דירוג Google
                </div>
                <ColumnChart labels={data.ratingBands.map((r) => r.label)} values={data.ratingBands.map((r) => r.value)} height={140} valueLabel="מקומות לפי דירוג" />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="מבנה המערכת" subtitle="ישויות תומכות" icon="layers" />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <MiniStat label="מונחי טקסונומיה פעילים" value={fmt(data.totals.taxonomyTerms)} />
              <MiniStat label="שדות לפי סוג מקום" value={fmt(data.totals.fieldDefs)} />
              <MiniStat label="ביקורות על מקומות" value={fmt(data.totals.reviews)} />
              <MiniStat label="שמירות ולייקים" value={fmt(data.totals.favorites)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" href="/admin/places" icon="place">
                ניהול מקומות
              </Button>
              <Button size="sm" href="/admin/destinations" icon="globe">
                יעדים
              </Button>
              <Button size="sm" href="/admin/taxonomy" icon="tag">
                טקסונומיה
              </Button>
              <Button size="sm" href="/admin/discovery" icon="sparkles">
                AI Discovery
              </Button>
              <Button size="sm" href="/admin/health" icon="health">
                בעיות איכות
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
