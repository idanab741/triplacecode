"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { DataTable, type Column } from "@/screens/admin/shared/DataTable";
import { Drawer, DrawerSection, AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { Badge } from "@/screens/admin/shared/Primitives";
import { NotificationCard } from "@/screens/notifications/NotificationCard";

/**
 * *** תכונה חדשה (MASTER PROMPT - "src/app/admin/notifications/page.tsx
 * כרגע Coming Soon. יש להפוך אותו למסך ניהול אמיתי"): מסך CRUD מלא
 * להודעות מערכת (persistent notifications, ר' migration 0059) - לא
 * לפעילות המחושבת (טיול מתקרב/נשמר), שאין לה בכלל מה לנהל ב-Admin.
 * משתמש באותם patterns בדיוק כמו שאר עמודי ה-Admin (DataTable/Drawer/
 * useAdminSecret) - לא Admin UI חדש.
 */

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  image_url: string | null;
  icon: string | null;
  priority: "normal" | "important" | "urgent";
  status: "active" | "disabled";
  action_url: string | null;
  action_label: string | null;
  user_id: string | null;
  push_enabled: boolean;
  published_at: string;
  expires_at: string | null;
  created_at: string;
}

interface NotificationForm {
  title: string;
  description: string;
  imageUrl: string;
  icon: string;
  priority: "normal" | "important" | "urgent";
  status: "active" | "disabled";
  actionUrl: string;
  actionLabel: string;
  audience: "everyone" | "specific";
  userId: string;
  publishedAt: string; // datetime-local string
  expiresAt: string; // datetime-local string, empty = none
  pushEnabled: boolean;
}

const ADMIN_SECRET_HEADER = "x-admin-secret";

const EMPTY_FORM: NotificationForm = {
  title: "",
  description: "",
  imageUrl: "",
  icon: "",
  priority: "normal",
  status: "active",
  actionUrl: "",
  actionLabel: "",
  audience: "everyone",
  userId: "",
  publishedAt: "",
  expiresAt: "",
  pushEnabled: false,
};

function priorityTone(priority: AdminNotification["priority"]): "neutral" | "accent" | "danger" {
  if (priority === "urgent") return "danger";
  if (priority === "important") return "accent";
  return "neutral";
}

function priorityLabel(priority: AdminNotification["priority"]): string {
  if (priority === "urgent") return "דחוף";
  if (priority === "important") return "חשוב";
  return "רגיל";
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

export default function NotificationsAdminPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NotificationForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // *** תוספת (בקשה מפורשת - "אפשרות להעלות תמונה מהמחשב שתופיע שם
  // ברקע"): מצב העלאה נפרד מ-saving הכללי - כדי שהתצוגה תדע להראות
  // "מעלה..." ליד שדה התמונה ספציפית, לא לנעול את כל הטופס.
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function load() {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינה");
      setNotifications(data.notifications ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setUploadError(null);
    setDrawerOpen(true);
  }

  function openEdit(n: AdminNotification) {
    setEditingId(n.id);
    setForm({
      title: n.title,
      description: n.description,
      imageUrl: n.image_url ?? "",
      icon: n.icon ?? "",
      priority: n.priority,
      status: n.status,
      actionUrl: n.action_url ?? "",
      actionLabel: n.action_label ?? "",
      audience: n.user_id ? "specific" : "everyone",
      userId: n.user_id ?? "",
      publishedAt: toDatetimeLocal(n.published_at),
      expiresAt: toDatetimeLocal(n.expires_at),
      pushEnabled: n.push_enabled,
    });
    setUploadError(null);
    setDrawerOpen(true);
  }

  function updateField<K extends keyof NotificationForm>(key: K, value: NotificationForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleImageFileSelected(file: File) {
    setUploadError(null);
    setUploadingImage(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/notifications/upload-image", {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
        body,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "העלאת התמונה נכשלה");
      updateField("imageUrl", data.imageUrl);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      alert("יש להזין כותרת");
      return;
    }
    setSaving(true);
    const body = {
      title: form.title,
      description: form.description,
      imageUrl: form.imageUrl || null,
      icon: form.icon || null,
      priority: form.priority,
      status: form.status,
      actionUrl: form.actionUrl || null,
      actionLabel: form.actionLabel || null,
      userId: form.audience === "specific" ? form.userId || null : null,
      pushEnabled: form.pushEnabled,
      publishedAt: fromDatetimeLocal(form.publishedAt) ?? new Date().toISOString(),
      expiresAt: fromDatetimeLocal(form.expiresAt),
    };
    try {
      const res = await fetch(editingId ? `/api/admin/notifications/${editingId}` : "/api/admin/notifications", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירה");
      setDrawerOpen(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus(n: AdminNotification) {
    const nextStatus = n.status === "active" ? "disabled" : "active";
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, status: nextStatus } : x)));
    const res = await fetch(`/api/admin/notifications/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) {
      await load();
      alert("העדכון נכשל");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק את ההודעה הזו לצמיתות?")) return;
    const res = await fetch(`/api/admin/notifications/${id}`, { method: "DELETE", headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`המחיקה נכשלה: ${data.error ?? res.status}`);
      return;
    }
    await load();
  }

  const columns: Column<AdminNotification>[] = [
    {
      key: "title",
      header: "כותרת",
      sortValue: (n) => n.title,
      render: (n) => (
        <div className="flex items-center gap-2.5">
          {n.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.image_url} alt="" className="h-9 w-9 rounded-[var(--admin-radius-sm)] object-cover" />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius-sm)] text-[15px]"
              style={{ background: "var(--admin-bg-sunken)" }}
            >
              {n.icon || "📢"}
            </span>
          )}
          <span className="font-medium">{n.title}</span>
        </div>
      ),
    },
    { key: "status", header: "סטטוס", sortValue: (n) => n.status, render: (n) => <Badge tone={n.status === "active" ? "success" : "neutral"}>{n.status === "active" ? "פעיל" : "מושבת"}</Badge> },
    { key: "audience", header: "קהל", render: (n) => (n.user_id ? "משתמש ספציפי" : "כולם") },
    { key: "priority", header: "עדיפות", sortValue: (n) => n.priority, render: (n) => <Badge tone={priorityTone(n.priority)}>{priorityLabel(n.priority)}</Badge> },
    { key: "published_at", header: "פרסום", sortValue: (n) => n.published_at, render: (n) => new Date(n.published_at).toLocaleDateString("he-IL") },
    { key: "expires_at", header: "תפוגה", render: (n) => (n.expires_at ? new Date(n.expires_at).toLocaleDateString("he-IL") : "—") },
    {
      key: "actions",
      header: "",
      render: (n) => (
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => handleToggleStatus(n)} className="text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
            {n.status === "active" ? "השבת" : "הפעל"}
          </button>
          <button type="button" onClick={() => handleDelete(n.id)} className="text-[12.5px] font-medium" style={{ color: "var(--admin-danger)" }}>
            מחק
          </button>
        </div>
      ),
    },
  ];

  const previewItem = {
    id: "preview",
    category: "system" as const,
    priority: form.priority,
    title: form.title || "כותרת ההודעה",
    description: form.description || "תיאור ההודעה יופיע כאן.",
    imageUrl: form.imageUrl || null,
    icon: form.icon || "📢",
    actionUrl: form.actionUrl || null,
    actionLabel: form.actionLabel || null,
    timestamp: new Date().toISOString(),
    isRead: false,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            הודעות מערכת
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {adminSecret ? `${notifications.length.toLocaleString()} הודעות` : "ניהול הודעות שמופיעות במרכז הפעילות של המשתמשים"}
          </p>
        </div>
        {adminSecret && <AdminButton onClick={openCreate}>+ הודעה חדשה</AdminButton>}
      </div>

      {!adminSecret && (
        <div className="rounded-[var(--admin-radius-lg)] border border-dashed p-10 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            יש להזין סיסמת Admin כדי לנהל הודעות מערכת.
          </p>
        </div>
      )}

      {adminSecret && error && (
        <div className="rounded-[var(--admin-radius-lg)] p-4 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {adminSecret && (
        <DataTable
          columns={columns}
          rows={notifications}
          keyFor={(n) => n.id}
          onRowClick={openEdit}
          loading={loading}
          emptyMessage="אין הודעות מערכת עדיין"
        />
      )}

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editingId ? "עריכת הודעה" : "הודעה חדשה"}
        subtitle='תופיע במרכז הפעילות ("מה חדש?") של המשתמשים הרלוונטיים'
        footer={
          <>
            <AdminButton variant="secondary" onClick={() => setDrawerOpen(false)}>
              ביטול
            </AdminButton>
            <AdminButton onClick={handleSave} disabled={saving}>
              {saving ? "שומר..." : "שמור"}
            </AdminButton>
          </>
        }
      >
        <DrawerSection title="תוכן">
          <AdminField label="כותרת">
            <input className={adminInputClass} style={adminInputStyle} value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="גרסה חדשה של TRIPLACE" />
          </AdminField>
          <AdminField label="תיאור">
            <textarea
              className={adminInputClass}
              style={adminInputStyle}
              rows={3}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="הוספנו אפשרויות חדשות לתכנון הטיול שלכם."
            />
          </AdminField>
          <AdminField label="תמונה">
            <div className="flex flex-col gap-2">
              {/* *** תוספת (בקשה מפורשת - "אפשרות להעלות תמונה מהמחשב
                  שתופיע שם ברקע" - במקום/בנוסף לאייקון): תצוגה מקדימה
                  + כפתור העלאה מהמחשב, לצד שדה ה-URL הקיים (למשל אם
                  יש כבר קישור חיצוני מוכן - לא כל תמונה חייבת עלייה). */}
              {form.imageUrl && (
                <div className="relative h-24 w-24 overflow-hidden rounded-[var(--admin-radius-sm)]" style={{ background: "var(--admin-bg-sunken)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => updateField("imageUrl", "")}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                    aria-label="הסר תמונה"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label
                  className="inline-flex cursor-pointer items-center rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[13px] font-medium transition"
                  style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
                >
                  {uploadingImage ? "מעלה..." : "העלאת תמונה מהמחשב"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploadingImage}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFileSelected(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              {uploadError && (
                <p className="text-[12px]" style={{ color: "var(--admin-danger)" }}>
                  {uploadError}
                </p>
              )}
              <AdminField label="או קישור URL (אופציונלי)">
                <input
                  className={adminInputClass}
                  style={adminInputStyle}
                  value={form.imageUrl}
                  onChange={(e) => updateField("imageUrl", e.target.value)}
                  placeholder="https://..."
                />
              </AdminField>
            </div>
          </AdminField>
          <AdminField label="אייקון (אימוג'י, אופציונלי - fallback כשאין תמונה)">
            <input className={adminInputClass} style={adminInputStyle} value={form.icon} onChange={(e) => updateField("icon", e.target.value)} placeholder="✨" />
          </AdminField>
        </DrawerSection>

        <DrawerSection title="קריאה לפעולה">
          <AdminField label="טקסט הכפתור">
            <input className={adminInputClass} style={adminInputStyle} value={form.actionLabel} onChange={(e) => updateField("actionLabel", e.target.value)} placeholder="לגלות מה חדש" />
          </AdminField>
          <AdminField label="קישור (route פנימי או URL)">
            <input className={adminInputClass} style={adminInputStyle} value={form.actionUrl} onChange={(e) => updateField("actionUrl", e.target.value)} placeholder="/ai" />
          </AdminField>
        </DrawerSection>

        <DrawerSection title="הגדרות">
          <AdminField label="עדיפות">
            <select className={adminInputClass} style={adminInputStyle} value={form.priority} onChange={(e) => updateField("priority", e.target.value as NotificationForm["priority"])}>
              <option value="normal">רגיל</option>
              <option value="important">חשוב</option>
              <option value="urgent">דחוף</option>
            </select>
          </AdminField>
          <AdminField label="סטטוס">
            <select className={adminInputClass} style={adminInputStyle} value={form.status} onChange={(e) => updateField("status", e.target.value as NotificationForm["status"])}>
              <option value="active">פעיל</option>
              <option value="disabled">מושבת</option>
            </select>
          </AdminField>
          <AdminField label="קהל יעד">
            <select className={adminInputClass} style={adminInputStyle} value={form.audience} onChange={(e) => updateField("audience", e.target.value as NotificationForm["audience"])}>
              <option value="everyone">כולם</option>
              <option value="specific">משתמש ספציפי</option>
            </select>
          </AdminField>
          {form.audience === "specific" && (
            <AdminField label="מזהה משתמש (user_id)">
              <input className={adminInputClass} style={adminInputStyle} value={form.userId} onChange={(e) => updateField("userId", e.target.value)} placeholder="uuid" />
            </AdminField>
          )}
          <AdminField label="תאריך פרסום">
            <input type="datetime-local" className={adminInputClass} style={adminInputStyle} value={form.publishedAt} onChange={(e) => updateField("publishedAt", e.target.value)} />
          </AdminField>
          <AdminField label="תאריך תפוגה (אופציונלי)">
            <input type="datetime-local" className={adminInputClass} style={adminInputStyle} value={form.expiresAt} onChange={(e) => updateField("expiresAt", e.target.value)} />
          </AdminField>
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
            <input type="checkbox" checked={form.pushEnabled} onChange={(e) => updateField("pushEnabled", e.target.checked)} />
            הפעל Push (כשתהיה תשתית זמינה)
          </label>
        </DrawerSection>

        <DrawerSection title="תצוגה מקדימה">
          <div className="rounded-[var(--admin-radius-lg)] border p-2" style={{ borderColor: "var(--admin-border)", background: "var(--color-bg-secondary, #F7F8FA)" }}>
            <NotificationCard item={previewItem} onOpen={() => {}} />
          </div>
        </DrawerSection>
      </Drawer>
    </div>
  );
}
