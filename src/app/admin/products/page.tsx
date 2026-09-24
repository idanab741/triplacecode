"use client";

import Link from "next/link";
import type { ProductsData } from "@/services/admin/insights/products";
import { useAdminData, useStoredRange } from "@/screens/admin/kit/useAdminData";
import { RANGE_OPTIONS, type RangeValue, fmt, fmtPct, timeAgo } from "@/screens/admin/kit/format";
import { PageHeader, Card, CardHeader, Segmented, StatTile, MiniStat, Pill, LoadingGrid, ErrorBanner, UpdatedAt, Empty, SectionLabel } from "@/screens/admin/kit/ui";
import { TrendChart, BarList, StackedBar, SERIES_COLORS } from "@/screens/admin/kit/charts";
import { Icon } from "@/screens/admin/kit/Icon";

function PlaceList({ items, unit }: { items: { id: string; name: string; city: string | null; imageUrl: string | null; value: number }[]; unit: string }) {
  if (!items.length) return <Empty text="אין נתונים בתקופה" />;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 rounded-[var(--admin-radius-sm)] px-1 py-1.5">
          <span className="admin-num w-4 text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
            {i + 1}
          </span>
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-[6px] object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
              <Icon name="image" size={14} />
            </span>
          )}
          <Link href={`/admin/places/${p.id}`} className="min-w-0 flex-1 hover:underline">
            <span className="block truncate text-[13px] font-medium">{p.name}</span>
            {p.city && (
              <span className="block truncate text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                {p.city}
              </span>
            )}
          </Link>
          <span className="admin-num shrink-0 text-[13px] font-semibold">
            {fmt(p.value)} <span className="text-[11px] font-normal" style={{ color: "var(--admin-ink-faint)" }}>{unit}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ProductsPage() {
  const [range, setRange] = useStoredRange<RangeValue>("triplace_admin_range", "30d");
  const { data, error, loading, reload, updatedAt } = useAdminData<ProductsData>(`/api/admin/insights/products?range=${range}`);

  return (
    <div>
      <PageHeader
        icon="products"
        title="מוצרים ו-AI"
        subtitle="איך משתמשים ב-TripMatch, ב-Trippy AI וב-Trip Builder - ואיפה הם נופלים"
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
      {!data && loading && <LoadingGrid tiles={4} blocks={3} />}

      {data && (
        <div className="flex flex-col gap-4">
          {/* ---------------- TripMatch ---------------- */}
          <SectionLabel>TripMatch</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="סשנים" value={data.tripMatch.sessions} delta={data.tripMatch.sessionsDelta} spark={data.tripMatch.series[0].values} icon="heart" />
            <StatTile label="משתמשים ייחודיים" value={data.tripMatch.uniqueUsers} icon="users" />
            <StatTile label="שיעור Like" value={fmtPct(data.tripMatch.likeRatePct)} icon="zap" hint={`${fmt(data.tripMatch.likes)} לייקים מול ${fmt(data.tripMatch.rejects)} דחיות`} />
            <StatTile label="החלקות לסשן" value={data.tripMatch.avgSwipes ?? "—"} icon="pulse" hint={`${fmt(data.tripMatch.zeroSwipeSessions)} סשנים ננטשו בלי אף החלקה`} />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="סשנים לאורך זמן" subtitle={`${fmt(data.tripMatch.convertedToTrip)} סשנים הפכו לטיול בתקופה`} icon="heart" />
              <TrendChart labels={data.labels} series={data.tripMatch.series} height={230} />
            </Card>
            <Card>
              <CardHeader title="המקומות הכי אהובים" subtitle="לפי לייקים ב-TripMatch" icon="star" />
              <PlaceList items={data.tripMatch.topLiked.slice(0, 7)} unit="לייקים" />
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="ערים ב-TripMatch" icon="place" />
              <BarList items={data.tripMatch.topCities} />
            </Card>
            <Card>
              <CardHeader title="קטגוריות שנבחרו" icon="tag" />
              <BarList items={data.tripMatch.topCategories} color="var(--admin-chart-3)" />
            </Card>
          </div>

          {/* ---------------- Trippy AI ---------------- */}
          <SectionLabel>Trippy AI</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="טיולים שנוצרו" value={data.trippy.generations} delta={data.trippy.generationsDelta} spark={data.trippy.series[0].values} icon="sparkles" />
            <StatTile label="משתמשים ייחודיים" value={data.trippy.uniqueUsers} icon="users" />
            <StatTile
              label="שיעור כשל ביצירה"
              value={fmtPct(data.trippy.failureRatePct)}
              icon="alert"
              hint={`${fmt(data.trippy.failures)} החזרי טריפים מתוך ${fmt(data.trippy.attempts)} ניסיונות - כל החזר = יצירה שנכשלה`}
            />
            <StatTile label="נשמרו ע״י המשתמש" value={fmtPct(data.trippy.savedPct)} icon="heart" />
          </div>
          {data.trippy.failureRatePct !== null && data.trippy.failureRatePct >= 20 && (
            <div className="flex items-start gap-3 rounded-[var(--admin-radius-md)] px-4 py-3 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
              <Icon name="alertCircle" size={17} />
              <span>
                <b>{data.trippy.failureRatePct}% מהניסיונות ליצור טיול ב-Trippy AI נכשלו בתקופה.</b> זה אחוז גבוה - כדאי לבדוק את הלוגים של קריאות ה-AI
                (timeouts, JSON לא תקין, מכסות API).
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="מה המשתמשים מבקשים" subtitle="הבקשות האחרונות בטקסט חופשי" icon="community" />
              {data.trippy.recentPrompts.length === 0 ? (
                <Empty text="אין בקשות עדיין" />
              ) : (
                <ul className="flex flex-col divide-y" style={{ borderColor: "var(--admin-border)" }}>
                  {data.trippy.recentPrompts.map((p) => (
                    <li key={p.id} className="py-2.5" style={{ borderColor: "var(--admin-border)" }}>
                      <div className="flex items-center justify-between gap-3 text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                        <span className="font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                          {p.userName}
                          {p.title ? ` · ${p.title}` : ""}
                        </span>
                        <span>{timeAgo(p.at)}</span>
                      </div>
                      <p className="mt-1 text-[13.5px] leading-relaxed">{p.text || <span style={{ color: "var(--admin-ink-faint)" }}>(ללא טקסט חופשי)</span>}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader title="יצירות מול כשלונות" icon="sparkles" />
                <TrendChart labels={data.labels} series={data.trippy.series.map((s, i) => ({ ...s, color: SERIES_COLORS[i === 0 ? 0 : 1] }))} height={180} />
              </Card>
              <Card>
                <CardHeader title="יעדים ב-Trippy" icon="globe" />
                <BarList items={data.trippy.topCities} color="var(--admin-chart-3)" />
              </Card>
            </div>
          </div>

          {/* ---------------- Trip Builder ---------------- */}
          <SectionLabel>Trip Builder</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="בניות שהתחילו" value={data.tripBuilder.started} delta={data.tripBuilder.startedDelta} spark={data.tripBuilder.series[0].values} icon="route" />
            <StatTile label="שיעור השלמה" value={fmtPct(data.tripBuilder.completionPct)} icon="checkCircle" hint={`${fmt(data.tripBuilder.completed)} טיולים הושלמו`} />
            <StatTile label="נשמרו מתוך שהושלמו" value={fmtPct(data.tripBuilder.savedPct)} icon="heart" />
            <StatTile label="משתמשים ייחודיים" value={data.tripBuilder.uniqueUsers} icon="users" />
          </div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2" padded={false}>
              <div className="p-5 pb-2">
                <CardHeader title="לפי סוג טיול" subtitle="כמה התחילו, כמה הושלמו ואיפה נוטשים" icon="layers" />
              </div>
              {data.tripBuilder.byType.length === 0 ? (
                <Empty text="אין בניות בתקופה" />
              ) : (
                <div className="admin-scrollbar overflow-x-auto px-2 pb-3">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ color: "var(--admin-ink-faint)" }}>
                        <th className="px-3 py-2 font-medium">סוג</th>
                        <th className="px-3 py-2 font-medium">התחילו</th>
                        <th className="px-3 py-2 font-medium">הושלמו</th>
                        <th className="px-3 py-2 font-medium">נשמרו</th>
                        <th className="w-[30%] px-3 py-2 font-medium">השלמה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tripBuilder.byType.map((t) => (
                        <tr key={t.key} className="border-t" style={{ borderColor: "var(--admin-border)" }}>
                          <td className="px-3 py-2.5 font-medium">{t.label}</td>
                          <td className="admin-num px-3 py-2.5">{fmt(t.started)}</td>
                          <td className="admin-num px-3 py-2.5">{fmt(t.completed)}</td>
                          <td className="admin-num px-3 py-2.5">{fmt(t.saved)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--admin-bg-sunken)" }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${t.completionPct ?? 0}%`, background: (t.completionPct ?? 0) >= 70 ? "var(--admin-success)" : "var(--admin-warning)" }}
                                />
                              </div>
                              <span className="admin-num w-10 text-left text-[12px] font-semibold">{fmtPct(t.completionPct)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card>
              <CardHeader title="סטטוס הבניות" subtitle="בתקופה" icon="pulse" />
              {data.tripBuilder.statusBreakdown.length ? <StackedBar parts={data.tripBuilder.statusBreakdown} /> : <Empty text="אין נתונים" />}
              <div className="mt-5">
                <TrendChart labels={data.labels} series={data.tripBuilder.series} height={160} />
              </div>
            </Card>
          </div>

          {/* ---------------- Tokens + Favorites ---------------- */}
          <SectionLabel>כלכלת טריפים ושמירות</SectionLabel>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader
                title="מערכת הטריפים"
                icon="coins"
                action={data.tokens.promoUnlimited ? <Pill tone="warning">מבצע: ללא הגבלה</Pill> : <Pill tone="success">פעילה</Pill>}
              />
              {data.tokens.promoUnlimited && (
                <p className="mb-4 rounded-[var(--admin-radius-sm)] px-3 py-2 text-[12.5px] leading-relaxed" style={{ background: "var(--admin-warning-soft)", color: "var(--admin-warning)" }}>
                  כרגע UNLIMITED_TRIPS_PROMO=true - אף פעולה לא מחויבת. הנתונים כאן הם היסטוריה מלפני המבצע.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <MiniStat label="נצרכו בתקופה" value={fmt(data.tokens.spent)} />
                <MiniStat label="הוחזרו" value={fmt(data.tokens.refunded)} tone={data.tokens.refunded ? "warning" : undefined} />
                <MiniStat label="הקצאה חודשית" value={fmt(data.tokens.monthlyAllowance)} />
                {data.tokens.costs.map((c) => (
                  <MiniStat key={c.key} label={`עלות: ${c.label}`} value={fmt(c.value)} />
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="תנועות לפי סוג" subtitle="בתקופה" icon="coins" />
              <BarList items={data.tokens.byType.map((t) => ({ label: t.label, value: t.count, sub: `${t.amount > 0 ? "+" : ""}${t.amount}` }))} color="var(--admin-chart-4)" />
            </Card>
            <Card>
              <CardHeader title="המקומות הכי נשמרים" subtitle="לייק + שמירה, כל הזמנים" icon="heart" />
              <PlaceList items={data.favorites.slice(0, 7)} unit="שמירות" />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
