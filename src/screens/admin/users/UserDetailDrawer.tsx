"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { Drawer, AdminButton } from "@/screens/admin/shared/Drawer";
import { Badge } from "@/screens/admin/shared/Primitives";
import type { UserDetail } from "./types";

const ADMIN_SECRET_HEADER = "x-admin-secret";

const PREF_LABELS: Record<string, string> = {
  culinary_styles: "סגנונות אוכל",
  dietary_restrictions: "הגבלות תזונה",
  kosher: "כשר",
  accessibility: "נגישות",
  transportation: "תחבורה",
  interests: "תחומי עניין",
  accommodation_types: "סוגי לינה",
  vacation_preferences: "העדפות חופשה",
};

const TIMELINE_ICON: Record<string, string> = {
  account: "👤",
  trip: "🧳",
  tripmatch: "❤️",
  trippy: "✨",
  interaction: "⭐",
  support: "💬",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL");
}
function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL");
}

export function UserDetailDrawer({ userId, onClose, onDeleted }: { userId: string | null; onClose: () => void; onDeleted: () => void }) {
  const { secret: adminSecret } = useAdminSecret();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["account", "activity"]));
  const [suspending, setSuspending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !adminSecret) return;
    setDetail(null);
    setLoading(true);
    setError(null);
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
    setActionError(null);
    fetch(`/api/admin/users/${userId}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "שגיאה בטעינת נתוני המשתמש");
        setDetail(json);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה לא ידועה"))
      .finally(() => setLoading(false));
  }, [userId, adminSecret]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSuspendToggle() {
    if (!detail) return;
    setSuspending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${detail.account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ action: detail.account.isBanned ? "restore" : "suspend" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "הפעולה נכשלה");
      setDetail((d) => (d ? { ...d, account: { ...d.account, isBanned: data.isBanned } } : d));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "הפעולה נכשלה");
    } finally {
      setSuspending(false);
    }
  }

  async function handleDelete() {
    if (!detail || deleteConfirmText !== "DELETE") return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${detail.account.id}`, { method: "DELETE", headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "המחיקה נכשלה");
      onDeleted();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "המחיקה נכשלה");
      setDeleting(false);
    }
  }

  function handleExport() {
    if (!detail) return;
    const url = `/api/admin/users/${detail.account.id}/export`;
    fetch(url, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `triplace-user-${detail.account.email || detail.account.id}.csv`;
        a.click();
      });
  }

  return (
    <Drawer
      open={!!userId}
      onClose={onClose}
      title={detail?.account.fullName || "משתמש"}
      subtitle={detail?.account.email}
      width={560}
      footer={
        <AdminButton variant="secondary" onClick={onClose}>
          סגור
        </AdminButton>
      }
    >
      {loading && (
        <div className="flex flex-col gap-3">
          <div className="admin-skeleton h-16 w-full" />
          <div className="admin-skeleton h-24 w-full" />
          <div className="admin-skeleton h-24 w-full" />
        </div>
      )}

      {!loading && error && (
        <p className="text-[13px]" style={{ color: "var(--admin-danger)" }}>
          {error}
        </p>
      )}

      {!loading && detail && (
        <div className="flex flex-col">
          {/* Header badges */}
          <div className="mb-5 flex flex-wrap gap-1.5">
            <Badge tone={detail.account.isAnonymous ? "neutral" : "accent"}>{detail.account.isAnonymous ? "אורח" : "רשום"}</Badge>
            <Badge tone={detail.account.isBanned ? "danger" : "success"}>{detail.account.isBanned ? "מושעה" : "פעיל"}</Badge>
            <Badge tone={detail.account.onboarding.main ? "success" : "warning"}>{detail.account.onboarding.main ? "Onboarding הושלם" : "Onboarding לא הושלם"}</Badge>
            {detail.tokens && <Badge tone="accent">✦ {detail.tokens.balance} טריפים</Badge>}
          </div>

          {/* 2. Account */}
          <Section title="פרטי חשבון" id="account" expanded={expanded} onToggle={toggle}>
            <Field label="User ID">
              <span className="admin-mono text-[11.5px]">{detail.account.id}</span>
            </Field>
            <Field label="Email">{detail.account.email || "—"}</Field>
            <Field label="עיר / מדינה">{detail.account.city ? `${detail.account.city}${detail.account.country ? `, ${detail.account.country}` : ""}` : "—"}</Field>
            <Field label="גיל">{detail.account.age ?? "—"}</Field>
            <Field label="נרשם/ה ב-">{fmtDateTime(detail.account.signupDate)}</Field>
            <Field label="התחברות אחרונה">{fmtDateTime(detail.account.lastLogin)}</Field>
            <Field label="קוד הזמנה אישי">{detail.account.inviteCode ?? "—"}</Field>
            {detail.account.referredBy && <Field label="הוזמן ע״י">{detail.account.referredBy}</Field>}
          </Section>

          {/* 3. Activity Overview */}
          <Section title="סקירת פעילות" id="activity" expanded={expanded} onToggle={toggle}>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="מסלולים" value={detail.trips.built.length} />
              <MiniStat label="Likes" value={detail.likes.length} />
              <MiniStat label="Saves" value={detail.saves.length} />
              <MiniStat label="TripMatch" value={detail.tripMatch.sessionsCount} />
              <MiniStat label="Trippy AI" value={detail.trippyAi.resultsCount} />
              <MiniStat label="פניות שירות" value={detail.support.conversationsCount} />
            </div>
          </Section>

          {/* 5. Preferences */}
          <Section title="העדפות" id="preferences" expanded={expanded} onToggle={toggle}>
            {detail.preferences ? (
              Object.entries(detail.preferences)
                .filter(([k]) => !["id", "created_at", "updated_at", "onboarding_completed_at"].includes(k))
                .map(([key, value]) => (
                  <Field key={key} label={PREF_LABELS[key] ?? key}>
                    {Array.isArray(value) ? (
                      value.length > 0 ? (
                        <div className="flex flex-wrap justify-end gap-1">
                          {value.map((v) => (
                            <Badge key={String(v)}>{String(v)}</Badge>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )
                    ) : typeof value === "boolean" ? (
                      value ? "כן" : "לא"
                    ) : (
                      String(value ?? "—")
                    )}
                  </Field>
                ))
            ) : (
              <EmptyNote text="לא נשמרו העדפות עבור המשתמש הזה." />
            )}
          </Section>

          {/* 6. Onboarding */}
          <Section title="Onboarding" id="onboarding" expanded={expanded} onToggle={toggle}>
            <Field label="Onboarding ראשי">
              <Badge tone={detail.account.onboarding.main ? "success" : "warning"}>{detail.account.onboarding.main ? "הושלם" : "לא הושלם"}</Badge>
            </Field>
            <Field label="Onboarding TripMatch">
              <Badge tone={detail.account.onboarding.tripmatch ? "success" : "warning"}>{detail.account.onboarding.tripmatch ? "הושלם" : "לא הושלם"}</Badge>
            </Field>
            <Field label="Onboarding בניית טיול">
              <Badge tone={detail.account.onboarding.tripbuilding ? "success" : "warning"}>{detail.account.onboarding.tripbuilding ? "הושלם" : "לא הושלם"}</Badge>
            </Field>
            <Field label="Onboarding העדפות">
              <Badge tone={detail.account.onboarding.preferences ? "success" : "warning"}>{detail.account.onboarding.preferences ? "הושלם" : "לא הושלם"}</Badge>
            </Field>
          </Section>

          {/* 9. Search History - לא קיים במערכת, מוצג בכנות */}
          <Section title="היסטוריית חיפושים" id="search" expanded={expanded} onToggle={toggle}>
            <EmptyNote text={detail.searchHistory.note} />
          </Section>

          {/* 10. Free Text */}
          <Section title="טקסט חופשי שהוזן" id="freetext" expanded={expanded} onToggle={toggle}>
            {detail.freeText.length > 0 ? (
              <div className="flex flex-col gap-2">
                {detail.freeText.map((f, i) => (
                  <div key={i} className="rounded-[var(--admin-radius-sm)] p-3" style={{ background: "var(--admin-bg-sunken)" }}>
                    <p className="text-[13px]" style={{ color: "var(--admin-ink)" }}>
                      "{f.text}"
                    </p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--admin-ink-faint)" }}>
                      {f.screen} · {fmtDateTime(f.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote text="המשתמש לא הזין טקסט חופשי (Trippy AI)." />
            )}
          </Section>

          {/* 14. Trips */}
          <Section title="מסלולים" id="trips" expanded={expanded} onToggle={toggle}>
            {detail.trips.built.length > 0 ? (
              detail.trips.built.map((t) => (
                <Field key={t.id} label={t.destination ?? t.tripType}>
                  {fmtDate(t.createdAt)} {t.isSaved && <Badge tone="success">נשמר</Badge>}
                </Field>
              ))
            ) : (
              <EmptyNote text="אין מסלולים." />
            )}
            {detail.trips.drafts.length > 0 && (
              <>
                <p className="mt-3 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
                  טיוטות בתהליך
                </p>
                {detail.trips.drafts.map((t) => (
                  <Field key={t.id} label={t.tripType}>
                    <Badge tone="neutral">{t.status}</Badge>
                  </Field>
                ))}
              </>
            )}
          </Section>

          {/* 11. Likes */}
          <Section title="Likes" id="likes" expanded={expanded} onToggle={toggle}>
            {detail.likes.length > 0 ? (
              detail.likes.slice(0, 15).map((l, i) => (
                <Field key={i} label={l.name}>
                  {[l.category, l.city].filter(Boolean).join(" · ") || fmtDate(l.createdAt)}
                </Field>
              ))
            ) : (
              <EmptyNote text="אין Likes." />
            )}
          </Section>

          {/* 12. Saves */}
          <Section title="Saves" id="saves" expanded={expanded} onToggle={toggle}>
            {detail.saves.length > 0 ? (
              detail.saves.slice(0, 15).map((s, i) => (
                <Field key={i} label={s.name}>
                  {[s.category, s.city].filter(Boolean).join(" · ") || fmtDate(s.createdAt)}
                </Field>
              ))
            ) : (
              <EmptyNote text="אין מקומות שמורים." />
            )}
          </Section>

          {/* 13. TripMatch */}
          <Section title="TripMatch" id="tripmatch" expanded={expanded} onToggle={toggle}>
            {detail.tripMatch.sessionsCount > 0 ? (
              <>
                <Field label="Sessions">{detail.tripMatch.sessionsCount}</Field>
                <Field label="כרטיסים שנצפו">{detail.tripMatch.cardsViewed}</Field>
                <Field label="Swipe ימינה / שמאלה">{`${detail.tripMatch.swipeRight} / ${detail.tripMatch.swipeLeft}`}</Field>
                <Field label="Matches">{detail.tripMatch.matches}</Field>
                <Field label="ערים">{detail.tripMatch.cities.join(", ") || "—"}</Field>
                <Field label="קטגוריות">{detail.tripMatch.categories.join(", ") || "—"}</Field>
              </>
            ) : (
              <EmptyNote text="המשתמש לא השתמש ב-TripMatch." />
            )}
          </Section>

          {/* 15. Trippy AI */}
          <Section title="Trippy AI" id="trippy" expanded={expanded} onToggle={toggle}>
            {detail.trippyAi.resultsCount > 0 ? (
              <>
                <Field label="מספר שיחות">{detail.trippyAi.resultsCount}</Field>
                <Field label="שימוש אחרון">{fmtDateTime(detail.trippyAi.lastUsed)}</Field>
                {detail.trippyAi.results.slice(0, 8).map((r) => (
                  <Field key={r.id} label={r.title ?? r.city ?? "—"}>
                    {r.stopsCount} תחנות · {fmtDate(r.createdAt)}
                  </Field>
                ))}
              </>
            ) : (
              <EmptyNote text="המשתמש לא השתמש ב-Trippy AI." />
            )}
          </Section>

          {/* Destination Scores (User Score) */}
          {detail.destinationScores.length > 0 && (
            <Section title="ציוני התאמת יעדים" id="scores" expanded={expanded} onToggle={toggle}>
              {detail.destinationScores.map((d) => (
                <Field key={d.destinationId} label={d.destinationName}>
                  <span className="admin-mono">{d.score}</span>
                </Field>
              ))}
            </Section>
          )}

          {/* 20. Notifications */}
          <Section title="התראות" id="notifications" expanded={expanded} onToggle={toggle}>
            <Field label="סה״כ / לא נקראו">{`${detail.notifications.total} / ${detail.notifications.unread}`}</Field>
            {detail.notifications.items.slice(0, 8).map((n) => (
              <Field key={n.id} label={n.title}>
                <Badge tone={n.isRead ? "neutral" : "accent"}>{n.isRead ? "נקרא" : "לא נקרא"}</Badge>
              </Field>
            ))}
          </Section>

          {/* 21. Support */}
          <Section title="שירות לקוחות" id="support" expanded={expanded} onToggle={toggle}>
            {detail.support.conversationsCount > 0 ? (
              <>
                <Field label="פניות">{detail.support.conversationsCount}</Field>
                <Field label="סטטוס אחרון">{detail.support.lastStatus}</Field>
                {detail.support.lastMessage && <Field label="הודעה אחרונה">{detail.support.lastMessage.message.slice(0, 60)}</Field>}
              </>
            ) : (
              <EmptyNote text="אין פניות שירות לקוחות." />
            )}
          </Section>

          {/* 22. Segments - לא קיים במערכת */}
          <Section title="Segments" id="segments" expanded={expanded} onToggle={toggle}>
            <EmptyNote text={detail.segments.note} />
          </Section>

          {/* 18. Activity Timeline */}
          <Section title="ציר זמן פעילות" id="timeline" expanded={expanded} onToggle={toggle}>
            {detail.activityTimeline.length > 0 ? (
              <div className="flex flex-col gap-2">
                {detail.activityTimeline.slice(0, 30).map((e) => (
                  <div key={e.id} className="flex items-start gap-2 border-b py-2 text-[12.5px]" style={{ borderColor: "var(--admin-border)" }}>
                    <span>{TIMELINE_ICON[e.type] ?? "•"}</span>
                    <div className="min-w-0 flex-1">
                      <p style={{ color: "var(--admin-ink)" }}>{e.title}</p>
                      {e.subtitle && (
                        <p className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                          {e.subtitle}
                        </p>
                      )}
                    </div>
                    <span className="admin-mono shrink-0 text-[11px]" style={{ color: "var(--admin-ink-faint)" }}>
                      {fmtDateTime(e.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyNote text="אין פעילות רשומה." />
            )}
          </Section>

          {/* 19. Admin Actions */}
          <Section title="פעולות" id="actions" expanded={expanded} onToggle={toggle}>
            <div className="flex flex-wrap gap-2">
              <AdminButton variant="secondary" onClick={handleExport}>
                ייצוא נתוני משתמש (CSV)
              </AdminButton>
              <AdminButton variant="secondary" onClick={handleSuspendToggle} disabled={suspending}>
                {suspending ? "מעדכן..." : detail.account.isBanned ? "שחזור חשבון" : "השעיית חשבון"}
              </AdminButton>
              <span className="rounded-[var(--admin-radius-sm)] px-3 py-2 text-[12.5px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
                הוספה ל-Segment — בקרוב
              </span>
            </div>
            {actionError && (
              <p className="mt-2 text-[12.5px]" style={{ color: "var(--admin-danger)" }}>
                {actionError}
              </p>
            )}
          </Section>

          {/* 20. Danger Zone */}
          <div className="mt-2 rounded-[var(--admin-radius-lg)] border p-4" style={{ borderColor: "var(--admin-danger)" }}>
            <p className="mb-1 text-[12.5px] font-semibold" style={{ color: "var(--admin-danger)" }}>
              Danger Zone
            </p>
            <p className="mb-3 text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
              מחיקת משתמש היא פעולה בלתי הפיכה - כל הנתונים (מסלולים, Likes, שיחות שירות, יתרת טריפים ועוד) יימחקו לצמיתות.
            </p>
            {!deleteConfirmOpen ? (
              <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="text-[12.5px] font-medium" style={{ color: "var(--admin-danger)" }}>
                מחיקת משתמש...
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-[var(--admin-radius-sm)] p-3" style={{ background: "var(--admin-danger-soft)" }}>
                <p className="text-[12.5px] font-medium" style={{ color: "var(--admin-danger)" }}>
                  {detail.account.fullName || "ללא שם"} · {detail.account.email}
                </p>
                <p className="text-[12px]" style={{ color: "var(--admin-ink)" }}>
                  הקלידו <span className="admin-mono font-bold">DELETE</span> כדי לאשר מחיקה סופית.
                </p>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13.5px] outline-none"
                  style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-danger)", color: "var(--admin-ink)" }}
                  placeholder="DELETE"
                />
                <div className="flex gap-2">
                  <AdminButton variant="danger" onClick={handleDelete} disabled={deleteConfirmText !== "DELETE" || deleting}>
                    {deleting ? "מוחק..." : "מחק לצמיתות"}
                  </AdminButton>
                  <AdminButton variant="secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
                    ביטול
                  </AdminButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function Section({
  title,
  id,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  id: string;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = expanded.has(id);
  return (
    <div className="mb-2 border-b" style={{ borderColor: "var(--admin-border)" }}>
      <button type="button" onClick={() => onToggle(id)} className="flex w-full items-center justify-between py-3 text-right">
        <span className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
          {title}
        </span>
        <span className="text-[11px]" style={{ color: "var(--admin-ink-faint)" }}>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>
      {isOpen && <div className="flex flex-col gap-1 pb-4">{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="shrink-0" style={{ color: "var(--admin-ink-secondary)" }}>
        {label}
      </span>
      <span className="text-left font-medium" style={{ color: "var(--admin-ink)" }}>
        {children}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--admin-radius-sm)] p-2.5 text-center" style={{ background: "var(--admin-bg-sunken)" }}>
      <p className="admin-mono text-[16px] font-semibold" style={{ color: "var(--admin-ink)" }}>
        {value}
      </p>
      <p className="text-[10.5px]" style={{ color: "var(--admin-ink-faint)" }}>
        {label}
      </p>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <p className="rounded-[var(--admin-radius-sm)] p-3 text-[12.5px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
      {text}
    </p>
  );
}
