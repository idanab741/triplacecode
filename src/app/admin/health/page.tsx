"use client";

import Link from "next/link";
import { useState } from "react";
import type { HealthData, HealthCheck, Severity, FixAction } from "@/services/admin/insights/health";
import { useAdminData, useAdminFetch } from "@/screens/admin/kit/useAdminData";
import { fmt, pctOf } from "@/screens/admin/kit/format";
import { PageHeader, Card, CardHeader, Segmented, Button, Pill, Meter, LoadingGrid, ErrorBanner, UpdatedAt, Empty, type Tone } from "@/screens/admin/kit/ui";
import { Icon, type IconName } from "@/screens/admin/kit/Icon";

const SEVERITY: Record<Severity, { label: string; tone: Tone; icon: IconName }> = {
  critical: { label: "קריטי", tone: "danger", icon: "alertCircle" },
  warning: { label: "אזהרה", tone: "warning", icon: "alert" },
  info: { label: "לשיפור", tone: "neutral", icon: "info" },
};

const AREAS = [
  { value: "all", label: "הכל" },
  { value: "system", label: "מערכת" },
  { value: "operations", label: "תפעול" },
  { value: "content", label: "תוכן" },
  { value: "users", label: "משתמשים" },
] as const;

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? "var(--admin-success)" : score >= 50 ? "var(--admin-warning)" : "var(--admin-danger)";
  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg width={132} height={132} viewBox="0 0 132 132" role="img" aria-label={`ציון בריאות ${score} מתוך 100`}>
        <circle cx={66} cy={66} r={r} fill="none" stroke="var(--admin-bg-sunken)" strokeWidth={12} />
        <circle cx={66} cy={66} r={r} fill="none" stroke={tone} strokeWidth={12} strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 66 66)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="admin-num text-[34px] font-semibold leading-none">{score}</span>
        <span className="mt-1 text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
          מתוך 100
        </span>
      </div>
    </div>
  );
}

interface FixPreview {
  check: HealthCheck;
  changed: number;
  preview: { id: string; label: string; meta?: string }[];
}

export default function HealthPage() {
  const { data, error, loading, reload, updatedAt } = useAdminData<HealthData>("/api/admin/insights/health");
  const request = useAdminFetch();
  const [area, setArea] = useState<(typeof AREAS)[number]["value"]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [preview, setPreview] = useState<FixPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function startFix(check: HealthCheck) {
    if (!check.fix) return;
    setBusy(true);
    try {
      const res = await request<{ changed: number; preview: FixPreview["preview"] }>("/api/admin/insights/health/fix", {
        method: "POST",
        body: JSON.stringify({ action: check.fix.action, dryRun: true }),
      });
      setPreview({ check, ...res });
    } catch (err) {
      setToast(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  async function applyFix(action: FixAction) {
    setBusy(true);
    try {
      const res = await request<{ changed: number }>("/api/admin/insights/health/fix", { method: "POST", body: JSON.stringify({ action, dryRun: false }) });
      setToast(`תוקן: ${fmt(res.changed)} רשומות עודכנו`);
      setPreview(null);
      await reload();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  }

  const checks = (data?.checks ?? []).filter((c) => area === "all" || c.area === area);

  return (
    <div>
      <PageHeader
        icon="health"
        title="בריאות המערכת"
        subtitle="סריקה אוטומטית של כל הבעיות: תקלות תשתית, תפעול תקוע, איכות תוכן ונתוני משתמשים - עם תיקון בלחיצה היכן שבטוח"
        actions={<UpdatedAt at={updatedAt} loading={loading} onRefresh={reload} />}
      />

      {toast && (
        <div className="mb-4 flex items-center justify-between rounded-[var(--admin-radius-md)] px-4 py-3 text-[13px]" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}>
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="סגור">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      )}
      {!data && loading && <LoadingGrid tiles={4} />}

      {data && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="flex items-center gap-6">
              <ScoreRing score={data.score} />
              <div className="flex flex-col gap-2">
                <div className="text-[15px] font-semibold">
                  {data.score >= 80 ? "המערכת במצב טוב" : data.score >= 50 ? "יש כמה דברים לטפל בהם" : "נדרש טיפול דחוף"}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="danger" icon="alertCircle">
                    {data.counts.critical} קריטי
                  </Pill>
                  <Pill tone="warning" icon="alert">
                    {data.counts.warning} אזהרות
                  </Pill>
                  <Pill icon="info">{data.counts.info} לשיפור</Pill>
                </div>
                <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                  הציון יורד 12 נק׳ לכל בעיה קריטית, 4 לאזהרה ו-1 לשיפור
                </p>
              </div>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader
                title="שלמות נתוני המקומות"
                subtitle={`${fmt(data.places.active)} מקומות פעילים · ${fmt(data.places.legacy)} בארכיון (לא נספרים)`}
                icon="database"
                action={<Button size="sm" href="/admin/places" icon="external">למקומות</Button>}
              />
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {data.places.completeness.map((c) => (
                  <div key={c.key} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span style={{ color: "var(--admin-ink-secondary)" }}>{c.label}</span>
                      <span className="admin-num font-semibold">{c.pct}%</span>
                    </div>
                    <Meter value={c.pct} tone={c.pct >= 95 ? "success" : c.pct >= 75 ? "accent" : "warning"} label={c.label} />
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented value={area} onChange={setArea} options={AREAS} />
            <span className="text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              {checks.length} ממצאים
            </span>
          </div>

          {checks.length === 0 ? (
            <Card>
              <Empty icon="checkCircle" text="אין בעיות פתוחות באזור הזה" />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {checks.map((c) => {
                const sev = SEVERITY[c.severity];
                const isOpen = open === c.id;
                const share = c.total ? pctOf(c.count, c.total) : null;
                return (
                  <Card key={c.id} padded={false}>
                    <div className="flex flex-wrap items-start gap-4 p-4">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--admin-radius-sm)]"
                        style={{ background: `var(--admin-${sev.tone === "neutral" ? "info" : sev.tone}-soft)`, color: `var(--admin-${sev.tone === "neutral" ? "info" : sev.tone})` }}
                      >
                        <Icon name={sev.icon} size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[14.5px] font-semibold">{c.title}</h3>
                          <Pill tone={sev.tone}>{sev.label}</Pill>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--admin-ink-secondary)" }}>
                          {c.description}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="admin-num text-[24px] font-semibold leading-none">{fmt(c.count)}</span>
                        {share !== null && (
                          <span className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                            {share}% מתוך {fmt(c.total!)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t px-4 py-2.5" style={{ borderColor: "var(--admin-border)" }}>
                      {c.samples.length > 0 && (
                        <Button size="sm" variant="ghost" icon={isOpen ? "chevronDown" : "chevronLeft"} onClick={() => setOpen(isOpen ? null : c.id)}>
                          {isOpen ? "הסתר דוגמאות" : `הצג דוגמאות (${c.samples.length})`}
                        </Button>
                      )}
                      <span className="flex-1" />
                      {c.href && (
                        <Button size="sm" href={c.href} icon="external">
                          פתח מסך
                        </Button>
                      )}
                      {c.fix && (
                        <Button size="sm" variant="primary" icon="wrench" disabled={busy} onClick={() => startFix(c)}>
                          {c.fix.label}
                        </Button>
                      )}
                    </div>
                    {isOpen && (
                      <ul className="border-t px-4 py-2" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface-hover)" }}>
                        {c.samples.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                            {s.href ? (
                              <Link href={s.href} className="truncate font-medium hover:underline">
                                {s.label}
                              </Link>
                            ) : (
                              <span className="admin-mono truncate">{s.label}</span>
                            )}
                            {s.meta && (
                              <span className="shrink-0 truncate text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                                {s.meta}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" onMouseDown={() => !busy && setPreview(null)}>
          <div
            className="admin-fade-in w-full max-w-lg rounded-[var(--admin-radius-lg)] border p-5"
            style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-lg)" }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="אישור תיקון"
          >
            <h3 className="text-[16px] font-semibold">{preview.check.fix?.confirm}</h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
              תצוגה מקדימה: {fmt(preview.changed)} רשומות ישתנו. שום דבר עוד לא נשמר.
            </p>
            <ul className="admin-scrollbar mt-4 max-h-64 overflow-y-auto rounded-[var(--admin-radius-sm)] border" style={{ borderColor: "var(--admin-border)" }}>
              {preview.preview.slice(0, 100).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 border-b px-3 py-2 text-[12.5px] last:border-b-0" style={{ borderColor: "var(--admin-border)" }}>
                  <span className="truncate">{p.label}</span>
                  {p.meta && <span style={{ color: "var(--admin-ink-secondary)" }}>{p.meta}</span>}
                </li>
              ))}
              {preview.preview.length === 0 && (
                <li className="px-3 py-4 text-center text-[12.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                  אין מה לתקן כרגע
                </li>
              )}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => setPreview(null)} disabled={busy}>
                ביטול
              </Button>
              <Button variant="primary" icon="check" disabled={busy || preview.changed === 0} onClick={() => preview.check.fix && applyFix(preview.check.fix.action)}>
                {busy ? "מתקן..." : `אשר ותקן ${fmt(preview.changed)}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
