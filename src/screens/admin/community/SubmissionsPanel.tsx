"use client";

import { useEffect, useState } from "react";
import type { AdminSubmission, SubmissionKind, SubmissionStatus } from "@/services/admin/insights/submissions";
import { useAdminData, useAdminFetch } from "@/screens/admin/kit/useAdminData";
import { Card, CardHeader, Segmented, Button, Pill, Empty, ErrorBanner } from "@/screens/admin/kit/ui";
import { Icon } from "@/screens/admin/kit/Icon";
import { timeAgo } from "@/screens/admin/kit/format";
import { SubmissionEditor } from "./SubmissionEditor";

interface ListResponse {
  submissions: AdminSubmission[];
  counts: Record<SubmissionStatus, number>;
  categories: Record<SubmissionKind, { value: string; label: string }[]>;
}

type Tab = SubmissionStatus | "all";

const STATUS_PILL: Record<SubmissionStatus, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "ממתין", tone: "warning" },
  approved: { label: "מאושר", tone: "success" },
  rejected: { label: "נדחה", tone: "danger" },
};

/** ניהול תוכן שמשתמשים העלו (הצעות מקומות + TripAdd): צפייה, עריכה מלאה
 *  כולל תיקון מיקום, אישור ודחייה - גם אחרי שכבר אושר. */
export function SubmissionsPanel() {
  const [tab, setTab] = useState<Tab>("pending");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useAdminData<ListResponse>(`/api/admin/insights/submissions?status=${tab}&q=${encodeURIComponent(q)}`);
  const request = useAdminFetch();
  const [editing, setEditing] = useState<AdminSubmission | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  async function moderate(s: AdminSubmission, action: "approve_submission" | "reject_submission", reason?: string) {
    setBusyId(s.id);
    setActionError(null);
    try {
      await request("/api/admin/insights/community/moderate", { method: "POST", body: JSON.stringify({ action, kind: s.kind, id: s.id, reason }) });
      setToast(action === "approve_submission" ? `"${s.name}" אושר` : `"${s.name}" נדחה`);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setBusyId(null);
    }
  }

  const counts = data?.counts;
  const tabs = [
    { value: "pending" as const, label: `ממתינים${counts ? ` · ${counts.pending}` : ""}` },
    { value: "approved" as const, label: `אושרו${counts ? ` · ${counts.approved}` : ""}` },
    { value: "rejected" as const, label: `נדחו${counts ? ` · ${counts.rejected}` : ""}` },
    { value: "all" as const, label: "הכל" },
  ];

  return (
    <Card id="submissions">
      <CardHeader
        title="תוכן שמשתמשים העלו"
        subtitle="הצעות מקומות ו-TripAdd. אפשר לערוך כל פרט - כולל תיקון מיקום על המפה - לאשר או לדחות."
        icon="checkCircle"
        action={counts && <Pill tone={counts.pending ? "warning" : "success"}>{counts.pending} ממתינים</Pill>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={tab} onChange={setTab} options={tabs} />
        <div className="relative w-full sm:w-64">
          <Icon name="search" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-ink-faint)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, עיר או כתובת"
            className="w-full rounded-[var(--admin-radius-sm)] border py-1.5 pl-3 pr-8 text-[13px] outline-none"
            style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
          />
        </div>
      </div>

      {toast && (
        <div className="mb-3 flex items-center justify-between rounded-[var(--admin-radius-sm)] px-3 py-2 text-[13px]" style={{ background: "var(--admin-success-soft)", color: "var(--admin-success)" }}>
          <span className="flex items-center gap-2">
            <Icon name="checkCircle" size={15} />
            {toast}
          </span>
          <button type="button" onClick={() => setToast(null)} aria-label="סגור">
            <Icon name="x" size={14} />
          </button>
        </div>
      )}
      {(error || actionError) && (
        <div className="mb-3">
          <ErrorBanner message={(error || actionError)!} onRetry={error ? reload : undefined} />
        </div>
      )}

      {!data && loading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="admin-skeleton h-[120px]" />
          ))}
        </div>
      ) : data && data.submissions.length === 0 ? (
        <Empty icon="checkCircle" text={q ? "לא נמצאו תוצאות" : tab === "pending" ? "אין תוכן שממתין לאישור" : "אין פריטים"} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2" style={{ opacity: loading ? 0.6 : 1 }}>
          {data?.submissions.map((s) => {
            const photo = s.photos[0] ?? s.googlePhotoUrl;
            const category = data.categories[s.kind].find((c) => c.value === s.category)?.label ?? s.category;
            const st = STATUS_PILL[s.status];
            return (
              <li key={`${s.kind}:${s.id}`} className="flex gap-3 rounded-[var(--admin-radius-md)] border p-3" style={{ borderColor: "var(--admin-border)" }}>
                <button type="button" onClick={() => setEditing(s)} className="relative shrink-0" aria-label={`ערוך את ${s.name}`}>
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="h-20 w-20 rounded-[8px] object-cover" />
                  ) : (
                    <span className="flex h-20 w-20 items-center justify-center rounded-[8px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
                      <Icon name="place" size={22} />
                    </span>
                  )}
                  {s.photos.length > 1 && (
                    <span className="admin-num absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 text-[10.5px] text-white">+{s.photos.length - 1}</span>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[14px] font-semibold">{s.name}</span>
                    <Pill tone="accent">{s.kind === "tripadd" ? "TripAdd" : "הצעת מקום"}</Pill>
                    <Pill>{category}</Pill>
                    {tab !== "pending" && <Pill tone={st.tone}>{st.label}</Pill>}
                    {s.googleMatch === "manual" ? (
                      <Pill tone="accent" icon="place">
                        מיקום תוקן ידנית
                      </Pill>
                    ) : s.googleMatch ? (
                      <Pill tone={s.googleMatch === "matched" ? "success" : "warning"}>{s.googleMatch === "matched" ? "תואם Google" : "לא תואם Google"}</Pill>
                    ) : null}
                    {(s.latitude == null || s.longitude == null) && <Pill tone="danger">בלי מיקום</Pill>}
                  </div>
                  <div className="mt-1 truncate text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                    {[s.subcategory, s.address || s.city].filter(Boolean).join(" · ") || "ללא כתובת"}
                    {s.rating ? ` · ${s.rating}★` : ""}
                  </div>
                  {s.description && <p className="mt-1 line-clamp-2 text-[12.5px]">{s.description}</p>}
                  {s.status === "rejected" && s.rejectionReason && (
                    <p className="mt-1 text-[12px]" style={{ color: "var(--admin-danger)" }}>
                      סיבת דחייה: {s.rejectionReason}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                      {s.submittedBy} · {timeAgo(s.createdAt)}
                    </span>
                    <span className="flex gap-1.5">
                      <Button size="sm" icon="wrench" onClick={() => setEditing(s)}>
                        ערוך
                      </Button>
                      {s.status !== "rejected" && (
                        <Button
                          size="sm"
                          variant="danger"
                          icon="x"
                          disabled={busyId === s.id}
                          onClick={() => {
                            const reason = prompt("סיבת דחייה (תוצג למשתמש, אופציונלי):");
                            if (reason !== null) void moderate(s, "reject_submission", reason);
                          }}
                        >
                          דחה
                        </Button>
                      )}
                      {s.status !== "approved" && (
                        <Button size="sm" variant="primary" icon="check" disabled={busyId === s.id} onClick={() => moderate(s, "approve_submission")}>
                          אשר
                        </Button>
                      )}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && data && (
        <SubmissionEditor
          key={`${editing.kind}:${editing.id}`}
          submission={editing}
          categories={data.categories[editing.kind]}
          onClose={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setToast(message);
            void reload();
          }}
        />
      )}
    </Card>
  );
}
