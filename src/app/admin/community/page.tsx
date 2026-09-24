"use client";

import Link from "next/link";
import { useState } from "react";
import type { CommunityData } from "@/services/admin/insights/community";
import { useAdminData, useAdminFetch, useStoredRange } from "@/screens/admin/kit/useAdminData";
import { RANGE_OPTIONS, type RangeValue, fmt, timeAgo } from "@/screens/admin/kit/format";
import { PageHeader, Card, CardHeader, Segmented, Button, Pill, Avatar, LoadingGrid, ErrorBanner, UpdatedAt, Empty, Delta, SectionLabel } from "@/screens/admin/kit/ui";
import { BarList, ColumnChart, Sparkline, StackedBar } from "@/screens/admin/kit/charts";
import { Icon } from "@/screens/admin/kit/Icon";

const CATEGORY_HE: Record<string, string> = {
  restaurant: "מסעדה",
  attraction: "אטרקציה",
  nature: "טבע",
  nightlife: "חיי לילה",
  hotel: "מלון",
  shopping: "קניות",
  food: "אוכל",
  sleep: "לינה",
};

export default function CommunityPage() {
  const [range, setRange] = useStoredRange<RangeValue>("triplace_admin_range", "30d");
  const { data, error, loading, reload, updatedAt } = useAdminData<CommunityData>(`/api/admin/insights/community?range=${range}`);
  const request = useAdminFetch();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(id: string, body: Record<string, unknown>, doneLabel: string) {
    setBusyId(id);
    setActionError(null);
    try {
      await request("/api/admin/insights/community/moderate", { method: "POST", body: JSON.stringify({ ...body, id }) });
      setDone((d) => ({ ...d, [id]: doneLabel }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        icon="community"
        title="קהילה ומודרציה"
        subtitle="פעילות חברתית, יוצרי תוכן מובילים ותור אישור לתוכן שמשתמשים שולחים"
        actions={
          <>
            <UpdatedAt at={updatedAt} loading={loading} onRefresh={reload} />
            <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} />
          </>
        }
      />
      {(error || actionError) && (
        <div className="mb-4">
          <ErrorBanner message={(error || actionError)!} onRetry={error ? reload : undefined} />
        </div>
      )}
      {!data && loading && <LoadingGrid tiles={8} />}

      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {data.metrics.map((m) => (
              <Card key={m.key} style={{ padding: 16 }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    {m.label}
                  </span>
                  <Delta value={m.deltaPct} />
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <div className="admin-num text-[24px] font-semibold leading-none">{fmt(m.value)}</div>
                    <div className="mt-1 text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                      {fmt(m.users)} משתמשים
                    </div>
                  </div>
                  <Sparkline values={m.spark} label={m.label} width={80} height={28} />
                </div>
              </Card>
            ))}
          </div>

          <Card id="submissions">
            <CardHeader
              title="ממתין לאישור"
              subtitle="הצעות מקומות ו-TripAdd שמשתמשים שלחו. אישור/דחייה מעדכנים את הסטטוס שהמשתמש רואה."
              icon="checkCircle"
              action={<Pill tone={data.submissions.length ? "warning" : "success"}>{data.submissions.length} פתוחים</Pill>}
            />
            {data.submissions.length === 0 ? (
              <Empty icon="checkCircle" text="אין תוכן שממתין לאישור" />
            ) : (
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {data.submissions.map((s) => {
                  const handled = done[s.id];
                  return (
                    <li key={s.id} className="flex gap-3 rounded-[var(--admin-radius-md)] border p-3" style={{ borderColor: "var(--admin-border)", opacity: handled ? 0.55 : 1 }}>
                      {s.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-[8px] object-cover" />
                      ) : (
                        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[8px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
                          <Icon name="place" size={20} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[14px] font-semibold">{s.name}</span>
                          <Pill tone="accent">{s.kind === "tripadd" ? "TripAdd" : "הצעת מקום"}</Pill>
                          <Pill>{CATEGORY_HE[s.category] ?? s.category}</Pill>
                          {s.googleMatch && <Pill tone={s.googleMatch === "matched" ? "success" : "warning"}>{s.googleMatch === "matched" ? "תואם Google" : "לא תואם Google"}</Pill>}
                        </div>
                        <div className="mt-1 text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                          {[s.city, s.address].filter(Boolean).join(" · ") || "ללא כתובת"}
                          {s.rating ? ` · ${s.rating}★` : ""}
                        </div>
                        {s.description && (
                          <p className="mt-1 line-clamp-2 text-[12.5px]" style={{ color: "var(--admin-ink)" }}>
                            {s.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                            {s.submittedBy} · {timeAgo(s.at)}
                          </span>
                          {handled ? (
                            <Pill tone={handled === "אושר" ? "success" : "danger"}>{handled}</Pill>
                          ) : (
                            <span className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="danger"
                                icon="x"
                                disabled={busyId === s.id}
                                onClick={() => {
                                  const reason = prompt("סיבת דחייה (תוצג למשתמש, אופציונלי):");
                                  if (reason === null) return;
                                  void act(s.id, { action: "reject_submission", kind: s.kind, reason }, "נדחה");
                                }}
                              >
                                דחה
                              </Button>
                              <Button size="sm" variant="primary" icon="check" disabled={busyId === s.id} onClick={() => act(s.id, { action: "approve_submission", kind: s.kind }, "אושר")}>
                                אשר
                              </Button>
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader title="יוצרי תוכן מובילים" subtitle="פוסטים, ביקורות, סטוריז ולייקים שקיבלו" icon="star" />
              {data.topCreators.length === 0 ? (
                <Empty text="אין פעילות בתקופה" />
              ) : (
                <ul className="flex flex-col gap-1">
                  {data.topCreators.map((c) => (
                    <li key={c.id}>
                      <Link href={`/admin/users?user=${c.id}`} className="flex items-center gap-3 rounded-[var(--admin-radius-sm)] px-2 py-1.5 transition hover:bg-[var(--admin-bg-surface-hover)]">
                        <Avatar name={c.name} url={c.avatarUrl} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{c.name}</span>
                        <span className="flex gap-2 text-[11.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
                          <span title="פוסטים">📝 {c.posts}</span>
                          <span title="ביקורות">★ {c.reviews}</span>
                          <span title="לייקים שקיבלו">♥ {c.likesReceived}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="סוגי פוסטים" subtitle="בתקופה" icon="layers" />
              {data.postTypes.length ? <StackedBar parts={data.postTypes} /> : <Empty text="אין פוסטים בתקופה" />}
              <div className="mt-6">
                <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--admin-ink-faint)" }}>
                  התפלגות דירוגים בביקורות
                </div>
                <ColumnChart labels={data.ratingDist.map((r) => r.label)} values={data.ratingDist.map((r) => r.value)} height={140} valueLabel="ביקורות לפי דירוג" />
              </div>
            </Card>
            <Card>
              <CardHeader title="ביקורות נמוכות אחרונות" subtitle="דירוג 1-2 - שווה לבדוק" icon="alert" />
              {data.lowReviews.length === 0 ? (
                <Empty icon="checkCircle" text="אין ביקורות נמוכות" />
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.lowReviews.map((r) => (
                    <li key={r.id} className="rounded-[var(--admin-radius-sm)] px-2 py-1.5" style={{ background: "var(--admin-bg-sunken)" }}>
                      <div className="flex items-center justify-between gap-2 text-[12.5px]">
                        <Link href={`/admin/places/${r.placeId}`} className="truncate font-semibold hover:underline">
                          {r.placeName}
                        </Link>
                        <Pill tone="danger">{r.rating}★</Pill>
                      </div>
                      {r.comment && <p className="mt-0.5 line-clamp-2 text-[12.5px]">{r.comment}</p>}
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--admin-ink-faint)" }}>
                        {r.userName} · {timeAgo(r.at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <SectionLabel>פוסטים אחרונים</SectionLabel>
          <Card padded={false}>
            {data.recentPosts.length === 0 ? (
              <Empty text="אין פוסטים" />
            ) : (
              <ul>
                {data.recentPosts.map((p) => {
                  const hidden = done[p.id];
                  return (
                    <li key={p.id} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0" style={{ borderColor: "var(--admin-border)", opacity: hidden ? 0.5 : 1 }}>
                      <Avatar name={p.authorName} url={p.avatarUrl} size={34} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                          <Link href={`/admin/users?user=${p.authorId}`} className="font-semibold hover:underline">
                            {p.authorName}
                          </Link>
                          <Pill>{p.type}</Pill>
                          {p.mediaCount > 0 && <Pill icon="image">{p.mediaCount}</Pill>}
                          <span style={{ color: "var(--admin-ink-faint)" }}>{timeAgo(p.at)}</span>
                        </div>
                        <p className="mt-1 line-clamp-3 text-[13.5px] leading-relaxed">{p.text || <span style={{ color: "var(--admin-ink-faint)" }}>(ללא טקסט)</span>}</p>
                      </div>
                      {hidden ? (
                        <Pill tone="danger">הוסתר</Pill>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="eyeOff"
                          disabled={busyId === p.id}
                          onClick={() => {
                            if (confirm("להסתיר את הפוסט מהפיד? (מחיקה רכה - ניתן לשחזר ב-DB)")) void act(p.id, { action: "hide_post" }, "הוסתר");
                          }}
                        >
                          הסתר
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="פעילות חברתית - השוואה" subtitle="סך הפעולות בתקופה לפי סוג" icon="pulse" />
            <BarList items={data.metrics.map((m) => ({ label: m.label, value: m.value }))} color="var(--admin-chart-5)" />
          </Card>
        </div>
      )}
    </div>
  );
}
