"use client";

import { useEffect, useRef, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { DataTable, SearchInput, type Column } from "@/screens/admin/shared/DataTable";
import { Drawer, AdminButton, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { Badge, EmptyState } from "@/screens/admin/shared/Primitives";

/**
 * *** תכונה חדשה - "פניות שירות לקוחות" (/admin/support): אותם patterns
 * בדיוק כמו admin/notifications ו-admin/users - DataTable + Drawer +
 * useAdminSecret, בלי UI חדש. הצ'אט המלא (הודעות המשתמש + תשובות Admin)
 * מוצג בתוך ה-Drawer, עם composer לתשובה בתחתית ה-footer שלו.
 */

const ADMIN_SECRET_HEADER = "x-admin-secret";

type SupportStatus = "open" | "waiting_for_admin" | "waiting_for_user" | "closed";

interface SupportListItem {
  id: string;
  userId: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  user: { id: string; email: string; fullName: string | null; avatarUrl: string | null };
  lastMessagePreview: string;
  unreadCount: number;
  hasUnread: boolean;
}

interface SupportMessage {
  id: string;
  conversationId: string;
  senderType: "user" | "admin";
  message: string;
  readAt: string | null;
  createdAt: string;
}

interface SupportCounts {
  open: number;
  waiting_for_admin: number;
  waiting_for_user: number;
  closed: number;
  unread: number;
}

const EMPTY_COUNTS: SupportCounts = { open: 0, waiting_for_admin: 0, waiting_for_user: 0, closed: 0, unread: 0 };

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "פתוחה",
  waiting_for_admin: "ממתינה למענה",
  waiting_for_user: "ממתינה למשתמש",
  closed: "סגורה",
};

const STATUS_TONE: Record<SupportStatus, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  open: "accent",
  waiting_for_admin: "danger",
  waiting_for_user: "success",
  closed: "neutral",
};

const STATUS_FILTERS: { value: "" | SupportStatus; label: string; countKey: keyof SupportCounts | null }[] = [
  { value: "", label: "הכל", countKey: null },
  { value: "open", label: "פתוחות", countKey: "open" },
  { value: "waiting_for_admin", label: "ממתינות למענה", countKey: "waiting_for_admin" },
  { value: "waiting_for_user", label: "ממתינות למשתמש", countKey: "waiting_for_user" },
  { value: "closed", label: "סגורות", countKey: "closed" },
];

function timeAgoHe(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (minutes < 1) return "עכשיו";
  if (minutes < 60) return `לפני ${minutes} דק'`;
  if (hours < 24) return `לפני ${hours} שע'`;
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

export default function SupportAdminPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [conversations, setConversations] = useState<SupportListItem[]>([]);
  const [counts, setCounts] = useState<SupportCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | SupportStatus>("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailUser, setDetailUser] = useState<SupportListItem["user"] | null>(null);
  const [detailConversation, setDetailConversation] = useState<{ status: SupportStatus; createdAt: string } | null>(null);
  const [detailMessages, setDetailMessages] = useState<SupportMessage[]>([]);
  const [statusSaving, setStatusSaving] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/support?${params.toString()}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינה");
      setConversations(data.conversations ?? []);
      setCounts(data.counts ?? EMPTY_COUNTS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret, search, statusFilter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detailMessages]);

  async function openConversation(row: SupportListItem) {
    setActiveId(row.id);
    setDrawerOpen(true);
    setDetailLoading(true);
    setDetailError(null);
    setReplyText("");
    setReplyError(null);
    try {
      const res = await fetch(`/api/admin/support/${row.id}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "טעינת השיחה נכשלה");
      setDetailUser(data.user);
      setDetailConversation(data.conversation);
      setDetailMessages(data.messages ?? []);
      load(); // מרענן את הרשימה כדי שה"unread" יתעדכן אחרי שסומן כנקרא
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "טעינת השיחה נכשלה");
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStatus(nextStatus: SupportStatus) {
    if (!activeId || statusSaving) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/admin/support/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "עדכון הסטטוס נכשל");
      setDetailConversation((c) => (c ? { ...c, status: nextStatus } : c));
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "עדכון הסטטוס נכשל");
    } finally {
      setStatusSaving(false);
    }
  }

  async function sendReply() {
    const trimmed = replyText.trim();
    if (!trimmed || !activeId || replySending) return;
    setReplySending(true);
    setReplyError(null);
    setReplyText("");
    try {
      const res = await fetch(`/api/admin/support/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שליחת התשובה נכשלה");
      setDetailMessages((all) => [...all, data.message]);
      setDetailConversation((c) => (c ? { ...c, status: "waiting_for_user" } : c));
      load();
    } catch (e) {
      setReplyText(trimmed); // לא לאבד את הטקסט שהנציג כתב
      setReplyError(e instanceof Error ? e.message : "שליחת התשובה נכשלה");
    } finally {
      setReplySending(false);
    }
  }

  const columns: Column<SupportListItem>[] = [
    {
      key: "user",
      header: "משתמש",
      sortValue: (r) => r.user.fullName ?? r.user.email,
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.hasUnread && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--admin-danger)" }} />}
          <div>
            <p className="font-medium">{r.user.fullName || "ללא שם"}</p>
            <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
              {r.user.email || "—"}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "preview",
      header: "הודעה אחרונה",
      render: (r) => (
        <p className="max-w-[280px] truncate" style={{ color: "var(--admin-ink-secondary)" }}>
          {r.lastMessagePreview || "—"}
        </p>
      ),
    },
    {
      key: "lastMessageAt",
      header: "עודכן",
      sortValue: (r) => r.lastMessageAt,
      render: (r) => <span className="admin-mono text-[12.5px]">{timeAgoHe(r.lastMessageAt)}</span>,
    },
    {
      key: "status",
      header: "סטטוס",
      sortValue: (r) => r.status,
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: "createdAt",
      header: "נפתחה ב-",
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="admin-mono text-[12.5px]">{new Date(r.createdAt).toLocaleDateString("he-IL")}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            פניות שירות לקוחות
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {adminSecret ? `${conversations.length.toLocaleString()} פניות` : "צ'אט שירות לקוחות בין משתמשים לצוות"}
          </p>
        </div>
      </div>

      {!adminSecret && (
        <div className="rounded-[var(--admin-radius-lg)] border border-dashed p-10 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            יש להזין סיסמת Admin כדי לנהל פניות שירות לקוחות.
          </p>
        </div>
      )}

      {adminSecret && error && (
        <div className="rounded-[var(--admin-radius-lg)] p-4 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {adminSecret && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.value;
                return (
                  <button
                    key={f.value || "all"}
                    type="button"
                    onClick={() => setStatusFilter(f.value)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition"
                    style={{
                      borderColor: active ? "var(--admin-accent)" : "var(--admin-border)",
                      background: active ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
                      color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
                    }}
                  >
                    {f.label}
                    {f.countKey && <span className="admin-mono">{counts[f.countKey]}</span>}
                  </button>
                );
              })}
            </div>
            <SearchInput value={search} onChange={setSearch} placeholder="חיפוש לפי שם, email או תוכן הודעה..." />
          </div>

          {!loading && conversations.length === 0 ? (
            <EmptyState icon={<span>💬</span>} title="אין עדיין פניות לשירות הלקוחות" description="פניות חדשות מהמשתמשים יופיעו כאן ברגע שיישלחו." />
          ) : (
            <DataTable columns={columns} rows={conversations} keyFor={(r) => r.id} onRowClick={openConversation} loading={loading} emptyMessage="לא נמצאו פניות תואמות" />
          )}
        </>
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={560}
        title={detailUser?.fullName || detailUser?.email || "פנייה"}
        subtitle={detailUser?.email && detailUser?.fullName ? detailUser.email : detailConversation ? `נפתחה ב-${new Date(detailConversation.createdAt).toLocaleDateString("he-IL")}` : undefined}
        footer={
          <div className="flex w-full flex-col gap-2">
            {replyError && <p className="text-[12.5px]" style={{ color: "var(--admin-danger)" }}>{replyError}</p>}
            <div className="flex items-end gap-2">
              <textarea
                className={`${adminInputClass} resize-none`}
                style={adminInputStyle}
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
                placeholder="כתבו תשובה ללקוח..."
                disabled={replySending || detailLoading}
              />
              <AdminButton onClick={sendReply} disabled={!replyText.trim() || replySending || detailLoading}>
                {replySending ? "שולח..." : "שליחה"}
              </AdminButton>
            </div>
          </div>
        }
      >
        {detailConversation && (
          <div className="mb-4 flex items-center justify-between gap-2 border-b pb-4" style={{ borderColor: "var(--admin-border)" }}>
            <Badge tone={STATUS_TONE[detailConversation.status]}>{STATUS_LABEL[detailConversation.status]}</Badge>
            <select
              className={adminInputClass}
              style={{ ...adminInputStyle, width: "auto" }}
              value={detailConversation.status}
              disabled={statusSaving}
              onChange={(e) => changeStatus(e.target.value as SupportStatus)}
            >
              {(Object.keys(STATUS_LABEL) as SupportStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        )}

        {detailLoading && (
          <div className="flex flex-col gap-3">
            <div className="admin-skeleton h-12 w-3/4" />
            <div className="admin-skeleton ms-auto h-8 w-1/2" />
          </div>
        )}

        {!detailLoading && detailError && (
          <p className="text-[13px]" style={{ color: "var(--admin-danger)" }}>
            {detailError}
          </p>
        )}

        {!detailLoading && !detailError && (
          <div className="flex flex-col gap-3">
            {detailMessages.length === 0 && (
              <p className="text-[13px]" style={{ color: "var(--admin-ink-faint)" }}>
                אין עדיין הודעות בשיחה הזו.
              </p>
            )}
            {detailMessages.map((m) => (
              <div key={m.id} className={`flex ${m.senderType === "admin" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] rounded-[var(--admin-radius-lg)] px-3.5 py-2.5"
                  style={{
                    background: m.senderType === "admin" ? "var(--admin-accent)" : "var(--admin-bg-sunken)",
                    color: m.senderType === "admin" ? "#fff" : "var(--admin-ink)",
                  }}
                >
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{m.message}</p>
                  <p className="mt-1 text-[10.5px] opacity-70">{new Date(m.createdAt).toLocaleString("he-IL")}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
