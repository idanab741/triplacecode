"use client";

import { useEffect, useState } from "react";
import { DataTable, SearchInput, FilterSelect, type Column } from "@/screens/admin/shared/DataTable";
import { Drawer, DrawerSection, AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { Badge } from "@/screens/admin/shared/Primitives";
import { ChipToggleGroup, TriStateToggle } from "@/screens/admin/shared/ChipToggleGroup";
import { SEASON_OPTIONS } from "@/services/places/tripTaxonomy";
import {
  type Destination,
  type DestinationEditForm,
  STATUS_OPTIONS,
  destinationToForm,
  formToPatchBody,
  toggleInArray,
} from "@/screens/admin/destinations/types";

const ADMIN_SECRET_HEADER = "x-admin-secret";

function statusTone(status: Destination["status"]): "neutral" | "success" | "warning" | "danger" | "accent" {
  switch (status) {
    case "published":
      return "success";
    case "approved":
      return "accent";
    case "review":
      return "warning";
    case "archived":
      return "danger";
    default:
      return "neutral";
  }
}

export default function DestinationsPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [creating, setCreating] = useState(false);

  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<DestinationEditForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadDestinations() {
    if (!adminSecret) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/destinations", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בטעינה");
      setDestinations(data.destinations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDestinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret]);

  async function handleCreate() {
    if (!newName.trim() || !newCountry.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ name: newName, country: newCountry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setNewName("");
      setNewCountry("");
      await loadDestinations();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק את היעד הזה?")) return;
    const res = await fetch(`/api/admin/destinations/${id}`, { method: "DELETE", headers: { [ADMIN_SECRET_HEADER]: adminSecret } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`המחיקה נכשלה: ${data.error ?? res.status}`);
      return;
    }
    await loadDestinations();
  }

  function startEdit(d: Destination) {
    setEditingId(d.id);
    setEditForm(destinationToForm(d));
  }
  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }
  function updateField<K extends keyof DestinationEditForm>(key: K, value: DestinationEditForm[K]) {
    setEditForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function saveEdit() {
    if (!editForm || !editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/destinations/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(formToPatchBody(editForm)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירה");
      cancelEdit();
      await loadDestinations();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSaving(false);
    }
  }

  const uniqueCountries = Array.from(new Set(destinations.map((d) => d.country).filter(Boolean)));
  const filtered = destinations.filter((d) => {
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCountry && d.country !== filterCountry) return false;
    if (filterStatus && d.status !== filterStatus) return false;
    return true;
  });

  const columns: Column<Destination>[] = [
    {
      key: "name",
      header: "יעד",
      sortValue: (d) => d.name,
      render: (d) => (
        <div className="flex items-center gap-2.5">
          {d.image_urls?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.image_urls[0]} alt="" className="h-9 w-9 rounded-[var(--admin-radius-sm)] object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius-sm)] text-[13px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
              ◇
            </span>
          )}
          <span className="font-medium">{d.name}</span>
        </div>
      ),
    },
    { key: "country", header: "מדינה", sortValue: (d) => d.country, render: (d) => d.country },
    { key: "rating", header: "דירוג", sortValue: (d) => d.internal_rating ?? 0, render: (d) => (d.internal_rating ? `⭐ ${d.internal_rating}` : "—"), align: "right" },
    { key: "status", header: "סטטוס", sortValue: (d) => d.status, render: (d) => <Badge tone={statusTone(d.status)}>{STATUS_OPTIONS.find((s) => s.id === d.status)?.label}</Badge> },
    {
      key: "actions",
      header: "",
      render: (d) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(d.id);
          }}
          className="text-[12.5px] font-medium"
          style={{ color: "var(--admin-danger)" }}
        >
          מחק
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            יעדים ומדינות
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {adminSecret ? `מציג ${filtered.length.toLocaleString()} מתוך ${destinations.length.toLocaleString()}` : "יעדים אמיתיים מ-Supabase"}
          </p>
        </div>
        <input type="password" value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} placeholder="סיסמת אדמין" className={adminInputClass} style={{ ...adminInputStyle, width: 200 }} />
      </div>

      {!adminSecret && (
        <div className="rounded-[var(--admin-radius-lg)] border border-dashed p-10 text-center" style={{ borderColor: "var(--admin-border)" }}>
          <p className="text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            הזן סיסמת אדמין כדי לטעון את היעדים
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
          {error.includes("column") && (
            <p className="mt-1 text-[12px]" style={{ color: "var(--admin-danger)" }}>
              נראה שחסרות עמודות בטבלה - הרץ את המיגרציה ב-<code className="admin-mono">supabase/migrations/destinations_full_fields.sql</code> דרך Supabase SQL Editor.
            </p>
          )}
        </div>
      )}

      {adminSecret && (
        <>
          <div className="flex flex-col gap-2 rounded-[var(--admin-radius-lg)] border p-4 sm:flex-row sm:items-center" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
            <p className="shrink-0 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
              הוספת יעד
            </p>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם היעד" className={adminInputClass + " flex-1"} style={adminInputStyle} />
            <input value={newCountry} onChange={(e) => setNewCountry(e.target.value)} placeholder="מדינה" className={adminInputClass + " flex-1"} style={adminInputStyle} />
            <AdminButton onClick={handleCreate} disabled={creating}>
              {creating ? "מוסיף..." : "הוסף"}
            </AdminButton>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SearchInput value={search} onChange={setSearch} placeholder="חיפוש לפי שם..." />
            <FilterSelect value={filterCountry} onChange={setFilterCountry} placeholder="כל המדינות" options={uniqueCountries.map((c) => ({ value: c, label: c }))} />
            <FilterSelect value={filterStatus} onChange={setFilterStatus} placeholder="כל הסטטוסים" options={STATUS_OPTIONS.map((s) => ({ value: s.id, label: s.label }))} />
          </div>

          <DataTable columns={columns} rows={filtered} keyFor={(d) => d.id} onRowClick={startEdit} loading={loading} emptyMessage="לא נמצאו יעדים תואמים" />
        </>
      )}

      <Drawer
        open={!!editingId && !!editForm}
        onClose={cancelEdit}
        title={editForm?.name || "עריכת יעד"}
        subtitle={editForm?.country}
        width={560}
        footer={
          <>
            <AdminButton variant="secondary" onClick={cancelEdit}>
              ביטול
            </AdminButton>
            <AdminButton onClick={saveEdit} disabled={saving}>
              {saving ? "שומר..." : "שמור שינויים"}
            </AdminButton>
          </>
        }
      >
        {editForm && (
          <div className="flex flex-col">
            <DrawerSection title="פרטי בסיס">
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="שם">
                  <input value={editForm.name} onChange={(e) => updateField("name", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
                <AdminField label="שם באנגלית">
                  <input value={editForm.name_en} onChange={(e) => updateField("name_en", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <AdminField label="מדינה">
                  <input value={editForm.country} onChange={(e) => updateField("country", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
                <AdminField label="סטטוס (Workflow)">
                  <select value={editForm.status} onChange={(e) => updateField("status", e.target.value as DestinationEditForm["status"])} className={adminInputClass} style={adminInputStyle}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="כתובת מלאה">
                  <input value={editForm.full_address} onChange={(e) => updateField("full_address", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <AdminField label="Latitude">
                  <input value={editForm.latitude} onChange={(e) => updateField("latitude", e.target.value)} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
                <AdminField label="Longitude">
                  <input value={editForm.longitude} onChange={(e) => updateField("longitude", e.target.value)} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="Google Place ID">
                  <input value={editForm.google_place_id} onChange={(e) => updateField("google_place_id", e.target.value)} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="תיאורים">
              <AdminField label="תיאור קצר">
                <textarea value={editForm.short_description} onChange={(e) => updateField("short_description", e.target.value)} rows={2} className={adminInputClass} style={adminInputStyle} />
              </AdminField>
              <div className="mt-3">
                <AdminField label="תיאור מלא">
                  <textarea value={editForm.full_description} onChange={(e) => updateField("full_description", e.target.value)} rows={4} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="תיאור ל-AI (לשימוש מנוע ההמלצות)">
                  <textarea value={editForm.ai_description} onChange={(e) => updateField("ai_description", e.target.value)} rows={3} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="ביקור ומחירים">
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="זמני ביקור מומלצים">
                  <input value={editForm.recommended_visit_times} onChange={(e) => updateField("recommended_visit_times", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
                <AdminField label="משך ביקור (דקות)">
                  <input value={editForm.visit_duration_minutes} onChange={(e) => updateField("visit_duration_minutes", e.target.value)} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="טווח מחירים">
                  <input value={editForm.price_range} onChange={(e) => updateField("price_range", e.target.value)} placeholder="₪ / ₪₪ / ₪₪₪" className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                  עונות מומלצות
                </p>
                <ChipToggleGroup options={SEASON_OPTIONS} selected={editForm.recommended_seasons} onToggle={(id) => updateField("recommended_seasons", toggleInArray(editForm.recommended_seasons, id))} />
              </div>
              <div className="mt-3">
                <AdminField label="הערות מזג אוויר">
                  <input value={editForm.weather_notes} onChange={(e) => updateField("weather_notes", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="שעות פתיחה (שורה לכל יום)">
                  <textarea value={editForm.opening_hours} onChange={(e) => updateField("opening_hours", e.target.value)} rows={3} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="דירוגים">
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="דירוג פנימי">
                  <input value={editForm.internal_rating} onChange={(e) => updateField("internal_rating", e.target.value)} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
                <AdminField label="דירוג Google">
                  <input value={editForm.google_rating} onChange={(e) => updateField("google_rating", e.target.value)} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="נגישות והתאמה">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    ילדים
                  </p>
                  <TriStateToggle value={editForm.kid_friendly} onChange={(v) => updateField("kid_friendly", v)} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    עגלות
                  </p>
                  <TriStateToggle value={editForm.stroller_friendly} onChange={(v) => updateField("stroller_friendly", v)} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    חיות מחמד
                  </p>
                  <TriStateToggle value={editForm.pet_friendly} onChange={(v) => updateField("pet_friendly", v)} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    כשר
                  </p>
                  <TriStateToggle value={editForm.kosher} onChange={(v) => updateField("kosher", v)} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    צורך בהזמנה מראש
                  </p>
                  <TriStateToggle value={editForm.reservation_required} onChange={(v) => updateField("reservation_required", v)} />
                </div>
              </div>
              <div className="mt-3">
                <AdminField label="מידע נגישות">
                  <input value={editForm.accessibility_info} onChange={(e) => updateField("accessibility_info", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="מידע חניה">
                  <input value={editForm.parking_info} onChange={(e) => updateField("parking_info", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="יצירת קשר">
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="טלפון">
                  <input value={editForm.phone} onChange={(e) => updateField("phone", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
                <AdminField label="אתר אינטרנט">
                  <input value={editForm.website_url} onChange={(e) => updateField("website_url", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="מדיה ותגיות">
              <AdminField label="תמונות (URL אחד בכל שורה)">
                <textarea value={editForm.image_urls} onChange={(e) => updateField("image_urls", e.target.value)} rows={3} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
              </AdminField>
              {editForm.image_urls && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {editForm.image_urls.split("\n").map((u) => u.trim()).filter(Boolean).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={url} alt="" className="h-12 w-12 rounded-[var(--admin-radius-sm)] object-cover" style={{ border: "1px solid var(--admin-border)" }} />
                  ))}
                </div>
              )}
              <div className="mt-3">
                <AdminField label="סרטונים (URL אחד בכל שורה)">
                  <textarea value={editForm.video_urls} onChange={(e) => updateField("video_urls", e.target.value)} rows={2} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="תגיות (מופרדות בפסיק)">
                  <input value={editForm.tags} onChange={(e) => updateField("tags", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="SEO">
              <AdminField label="כותרת SEO">
                <input value={editForm.seo_title} onChange={(e) => updateField("seo_title", e.target.value)} className={adminInputClass} style={adminInputStyle} />
              </AdminField>
              <div className="mt-3">
                <AdminField label="תיאור SEO">
                  <textarea value={editForm.seo_description} onChange={(e) => updateField("seo_description", e.target.value)} rows={2} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>
          </div>
        )}
      </Drawer>
    </div>
  );
}
