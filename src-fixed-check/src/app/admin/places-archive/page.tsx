"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { useRouter } from "next/navigation";
import {
  TRIP_TYPE_GROUPS,
  CUISINE_TAGS,
  SEASON_OPTIONS,
  CHILD_AGE_OPTIONS,
  BUDGET_TIER_OPTIONS,
} from "@/services/places/tripTaxonomy";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { DataTable, SearchInput, FilterSelect, type Column } from "@/screens/admin/shared/DataTable";
import { Drawer, DrawerSection, AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { Badge } from "@/screens/admin/shared/Primitives";
import { ChipToggleGroup, TriStateToggle } from "@/screens/admin/shared/ChipToggleGroup";

interface Place {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  price_level: number | null;
  estimated_visit_minutes: number | null;
  image_urls: string[];
  opening_hours: string[] | null;
  tags: string[];
  phone: string | null;
  website: string | null;
  google_maps_url: string | null;
  trip_type_tags: string[];
  cuisine_tags: string[];
  kosher: boolean | null;
  accessible: boolean | null;
  seasons: string[];
  suitable_child_ages: string[];
  budget_tier: string | null;
}

const ADMIN_SECRET_HEADER = "x-admin-secret";

const CATEGORIES = TRIP_TYPE_GROUPS.map((g) => g.id);

type EditForm = {
  name: string;
  category: string;
  city: string;
  country: string;
  address: string;
  short_description: string;
  phone: string;
  website: string;
  latitude: string;
  longitude: string;
  estimated_visit_minutes: string;
  tags: string;
  opening_hours: string;
  image_urls: string;
  trip_type_tags: string[];
  sub_tags: string[];
  cuisine_tags: string[];
  kosher: boolean | null;
  accessible: boolean | null;
  seasons: string[];
  suitable_child_ages: string[];
  budget_tier: string;
};

function placeToForm(p: Place): EditForm {
  return {
    name: p.name,
    category: p.category,
    city: p.city ?? "",
    country: p.country ?? "",
    address: p.address ?? "",
    short_description: p.short_description ?? "",
    phone: p.phone ?? "",
    website: p.website ?? "",
    latitude: p.latitude?.toString() ?? "",
    longitude: p.longitude?.toString() ?? "",
    estimated_visit_minutes: p.estimated_visit_minutes?.toString() ?? "",
    tags: (p.tags ?? []).join(", "),
    opening_hours: (p.opening_hours ?? []).join("\n"),
    image_urls: (p.image_urls ?? []).join("\n"),
    trip_type_tags: p.trip_type_tags ?? [],
    sub_tags: [],
    cuisine_tags: p.cuisine_tags ?? [],
    kosher: p.kosher,
    accessible: p.accessible,
    seasons: p.seasons ?? [],
    suitable_child_ages: p.suitable_child_ages ?? [],
    budget_tier: p.budget_tier ?? "",
  };
}

function formToPatchBody(f: EditForm) {
  return {
    name: f.name,
    category: f.category,
    city: f.city || null,
    country: f.country || null,
    address: f.address || null,
    short_description: f.short_description || null,
    phone: f.phone || null,
    website: f.website || null,
    latitude: f.latitude ? Number(f.latitude) : null,
    longitude: f.longitude ? Number(f.longitude) : null,
    estimated_visit_minutes: f.estimated_visit_minutes ? Number(f.estimated_visit_minutes) : null,
    tags: f.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    opening_hours: f.opening_hours
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean),
    image_urls: f.image_urls
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean),
    trip_type_tags: Array.from(new Set([...f.trip_type_tags, ...f.sub_tags])),
    cuisine_tags: f.cuisine_tags,
    kosher: f.kosher,
    accessible: f.accessible,
    seasons: f.seasons,
    suitable_child_ages: f.suitable_child_ages,
    budget_tier: f.budget_tier || null,
  };
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export default function AdminPlacesPage() {
  const { secret: adminSecret } = useAdminSecret();
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

const [bulkCity, setBulkCity] = useState("");
  const [bulkCategory, setBulkCategory] = useState(CATEGORIES[0]);
  const [bulkSubTag, setBulkSubTag] = useState(""); // ריק = כל הקטגוריה, לא תת-תגית ספציפית
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ fetched: number; saved: number; skipped: number } | null>(null);

  const bulkCategoryGroup = TRIP_TYPE_GROUPS.find((g) => g.id === bulkCategory);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [suggestingTags, setSuggestingTags] = useState(false);

  const [bulkTagging, setBulkTagging] = useState(false);
  const [bulkTagResult, setBulkTagResult] = useState<{ total: number; tagged: number; failed: number } | null>(null);

const [filterCategory, setFilterCategory] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterTripType, setFilterTripType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filterUntaggedOnly, setFilterUntaggedOnly] = useState(false);


  const uniqueCities = Array.from(new Set(places.map((p) => p.city).filter(Boolean))) as string[];
  const uniqueCountries = Array.from(new Set(places.map((p) => p.country).filter(Boolean))) as string[];

const filteredPlaces = places.filter((p) => {
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (filterCity && p.city !== filterCity) return false;
    if (filterCountry && p.country !== filterCountry) return false;
    if (filterTripType && !(p.trip_type_tags ?? []).includes(filterTripType)) return false;
    if (filterUntaggedOnly && (p.trip_type_tags ?? []).length > 0) return false;
    return true;
  });

  const untaggedCount = places.filter((p) => (p.trip_type_tags ?? []).length === 0).length;

  async function loadPlaces() {
    if (!adminSecret) return;
    const res = await fetch("/api/admin/places", {
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    });
    const data = await res.json();
    if (res.ok) setPlaces(data.places ?? []);
  }

  useEffect(() => {
    loadPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSecret]);

  async function handleAdd() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/places", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setName("");
      await loadPlaces();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setLoading(false);
    }
  }

async function handleBulkAdd() {
    if (!bulkCity.trim()) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const selectedSubTag = bulkCategoryGroup?.subTags.find((t) => t.id === bulkSubTag);
      const res = await fetch("/api/admin/collect-places", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({
          city: bulkCity,
          category: bulkCategory,
          subTagId: selectedSubTag?.id,
          subTagQuery: selectedSubTag?.label,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      setBulkResult(data);
      await loadPlaces();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setBulkLoading(false);
    }
  }

async function handleBulkTag(mode: "untagged" | "all") {
    const confirmText =
      mode === "all"
        ? "לתייג מחדש את כל המקומות (כולל כאלה שכבר תויגו)? זה ירוץ באצוות של 15 בכל פעם וידרוס תיוג קיים."
        : "להריץ תיוג אוטומטי על כל המקומות שעדיין לא תויגו? זה ירוץ באצוות של 15 בכל פעם.";
    if (!confirm(confirmText)) return;

    setBulkTagging(true);
    let totalTagged = 0;
    let totalFailed = 0;
    let afterId: string | null = null;
    try {
while (true) {
        const res: Response = await fetch("/api/admin/places/bulk-suggest-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
          body: JSON.stringify({ mode, afterId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "שגיאה");

        totalTagged += data.tagged;
        totalFailed += data.failed;
        afterId = data.lastId ?? afterId;
        setBulkTagResult({ total: totalTagged + totalFailed + data.remaining, tagged: totalTagged, failed: totalFailed });

        if (data.processedNow === 0 || data.remaining === 0) break;
      }
      await loadPlaces();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setBulkTagging(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("למחוק את המקום הזה?")) return;
    const res = await fetch(`/api/admin/places/${id}`, {
      method: "DELETE",
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(`המחיקה נכשלה: ${data.error ?? res.status}`);
      return;
    }
    await loadPlaces();
  }

  function startEdit(place: Place) {
    router.push(`/admin/places/${place.id}`);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setEditForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/places/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(formToPatchBody(editForm)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירה");
      setEditingId(null);
      setEditForm(null);
      await loadPlaces();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSavingEdit(false);
    }
  }

  async function suggestTagsWithClaude(id: string) {
    setSuggestingTags(true);
    try {
      const res = await fetch(`/api/admin/places/${id}/suggest-tags`, {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בהצעת תיוג");
      const s = data.suggestion;
      setEditForm((f) =>
        f
          ? {
              ...f,
              trip_type_tags: s.trip_type_tags ?? f.trip_type_tags,
              sub_tags: s.sub_tags ?? [],
              cuisine_tags: s.cuisine_tags ?? f.cuisine_tags,
              kosher: s.kosher ?? f.kosher,
              accessible: s.accessible ?? f.accessible,
              seasons: s.seasons ?? f.seasons,
              suitable_child_ages: s.suitable_child_ages ?? f.suitable_child_ages,
              budget_tier: s.budget_tier ?? f.budget_tier,
            }
          : f
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSuggestingTags(false);
    }
  }

  const columns: Column<Place>[] = [
    {
      key: "name",
      header: "מקום",
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="flex items-center gap-2.5">
          {p.image_urls?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image_urls[0]} alt="" className="h-9 w-9 rounded-[var(--admin-radius-sm)] object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--admin-radius-sm)] text-[13px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
              ◆
            </span>
          )}
          <span className="font-medium">{p.name}</span>
        </div>
      ),
    },
    { key: "category", header: "קטגוריה", sortValue: (p) => p.category, render: (p) => getCategoryLabel(p.category) },
    { key: "city", header: "עיר", sortValue: (p) => p.city ?? "", render: (p) => p.city ?? "—" },
    { key: "rating", header: "דירוג", sortValue: (p) => p.rating ?? 0, render: (p) => (p.rating ? `⭐ ${p.rating}` : "—"), align: "right" },
    {
      key: "tags",
      header: "תיוג",
      sortValue: (p) => (p.trip_type_tags ?? []).length,
      render: (p) =>
        (p.trip_type_tags ?? []).length > 0 ? (
          <Badge tone="success">מתויג ({p.trip_type_tags.length})</Badge>
        ) : (
          <Badge tone="warning">לא תויג</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      render: (p) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(p.id);
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
            🗄️ ארכיון - מקומות ואטרקציות (גרסה ישנה)
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            נשמר לצפייה/עריכה בלבד - זרימת העבודה הפעילה עברה ל-Dashboard החדש + AI Discovery. מציג {filteredPlaces.length.toLocaleString()} מתוך {places.length.toLocaleString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {/* הוספה בודדת + בכמות + תיוג אוטומטי - שלושה כלים קומפקטיים בשורה אחת */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ToolCard title="הוספה בודדת">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם המקום"
              className={adminInputClass + " flex-1"}
              style={adminInputStyle}
            />
            <AdminButton onClick={handleAdd} disabled={loading}>
              {loading ? "מוסיף..." : "הוסף"}
            </AdminButton>
          </div>
        </ToolCard>

        <ToolCard title="הוספה בכמות (עיר + קטגוריה)">
          <div className="flex flex-col gap-2">
            <input
              value={bulkCity}
              onChange={(e) => setBulkCity(e.target.value)}
              placeholder="עיר (למשל: תל אביב)"
              className={adminInputClass}
              style={adminInputStyle}
            />
            <div className="flex gap-2">
              <select
                value={bulkCategory}
                onChange={(e) => {
                  setBulkCategory(e.target.value);
                  setBulkSubTag("");
                }}
                className={adminInputClass + " flex-1"}
                style={adminInputStyle}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {getCategoryLabel(c)}
                  </option>
                ))}
              </select>
              <AdminButton onClick={handleBulkAdd} disabled={bulkLoading}>
                {bulkLoading ? "אוסף..." : "הוסף"}
              </AdminButton>
            </div>
            {bulkResult && (
              <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                נמצאו {bulkResult.fetched} · נשמרו {bulkResult.saved} · דולגו {bulkResult.skipped}
              </p>
            )}
          </div>
        </ToolCard>

        <ToolCard title="תיוג אוטומטי בכמות">
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <AdminButton variant="secondary" onClick={() => handleBulkTag("untagged")} disabled={bulkTagging}>
                {bulkTagging ? "מתייג..." : `🤖 תייג לא-מתויגים (${untaggedCount})`}
              </AdminButton>
            </div>
            <AdminButton variant="secondary" onClick={() => handleBulkTag("all")} disabled={bulkTagging}>
              🔄 תייג הכל מחדש
            </AdminButton>
            {bulkTagResult && (
              <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                סה&quot;כ {bulkTagResult.total} · תויגו {bulkTagResult.tagged} · נכשלו {bulkTagResult.failed}
              </p>
            )}
          </div>
        </ToolCard>
      </div>

      {/* פילטרים */}
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={searchText} onChange={setSearchText} placeholder="חיפוש לפי שם מקום..." />
        <FilterSelect value={filterCity} onChange={setFilterCity} placeholder="כל הערים" options={uniqueCities.map((c) => ({ value: c, label: c }))} />
        <FilterSelect value={filterCountry} onChange={setFilterCountry} placeholder="כל המדינות" options={uniqueCountries.map((c) => ({ value: c, label: c }))} />
        <FilterSelect
          value={filterTripType}
          onChange={setFilterTripType}
          placeholder="כל סוגי המסלול"
          options={TRIP_TYPE_GROUPS.map((g) => ({ value: g.id, label: `${g.emoji} ${g.label}` }))}
        />
        <label className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
          <input type="checkbox" checked={filterUntaggedOnly} onChange={(e) => setFilterUntaggedOnly(e.target.checked)} className="h-4 w-4 rounded" />
          רק לא מתויגים
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={filteredPlaces}
        keyFor={(p) => p.id}
        onRowClick={startEdit}
        emptyMessage="לא נמצאו מקומות תואמים"
      />

      <Drawer
        open={!!editingId && !!editForm}
        onClose={cancelEdit}
        title={editForm?.name || "עריכת מקום"}
        subtitle={editForm ? `${getCategoryLabel(editForm.category)} · ${editForm.city || "—"}` : undefined}
        width={560}
        footer={
          editingId && (
            <>
              <AdminButton variant="secondary" onClick={cancelEdit}>
                ביטול
              </AdminButton>
              <AdminButton variant="secondary" onClick={() => suggestTagsWithClaude(editingId)} disabled={suggestingTags}>
                {suggestingTags ? "Claude חושב..." : "🤖 הצע תיוג עם Claude"}
              </AdminButton>
              <AdminButton onClick={() => saveEdit(editingId)} disabled={savingEdit}>
                {savingEdit ? "שומר..." : "שמור שינויים"}
              </AdminButton>
            </>
          )
        }
      >
        {editForm && (
          <div className="flex flex-col">
            <DrawerSection title="פרטי בסיס">
              <AdminField label="שם">
                <input value={editForm.name} onChange={(e) => updateField("name", e.target.value)} className={adminInputClass} style={adminInputStyle} />
              </AdminField>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <AdminField label="עיר">
                  <input value={editForm.city} onChange={(e) => updateField("city", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
                <AdminField label="מדינה">
                  <input value={editForm.country} onChange={(e) => updateField("country", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="כתובת">
                  <input value={editForm.address} onChange={(e) => updateField("address", e.target.value)} className={adminInputClass} style={adminInputStyle} />
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
            </DrawerSection>

            <DrawerSection title="תיאור ופרטים">
              <AdminField label="תיאור קצר">
                <textarea value={editForm.short_description} onChange={(e) => updateField("short_description", e.target.value)} rows={2} className={adminInputClass} style={adminInputStyle} />
              </AdminField>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <AdminField label="טלפון">
                  <input value={editForm.phone} onChange={(e) => updateField("phone", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
                <AdminField label="אתר אינטרנט">
                  <input value={editForm.website} onChange={(e) => updateField("website", e.target.value)} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="זמן ביקור משוער (בדקות)">
                  <input value={editForm.estimated_visit_minutes} onChange={(e) => updateField("estimated_visit_minutes", e.target.value)} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
              </div>
              <div className="mt-3">
                <AdminField label="שעות פעילות (שורה לכל יום)">
                  <textarea value={editForm.opening_hours} onChange={(e) => updateField("opening_hours", e.target.value)} rows={3} className={adminInputClass} style={adminInputStyle} />
                </AdminField>
              </div>
            </DrawerSection>

            <DrawerSection title="מדיה">
              <AdminField label="תגיות חופשיות (מופרדות בפסיק)">
                <input value={editForm.tags} onChange={(e) => updateField("tags", e.target.value)} className={adminInputClass} style={adminInputStyle} />
              </AdminField>
              <div className="mt-3">
                <AdminField label="תמונות (כתובת URL אחת בכל שורה)">
                  <textarea value={editForm.image_urls} onChange={(e) => updateField("image_urls", e.target.value)} rows={3} className={adminInputClass + " admin-mono"} style={adminInputStyle} />
                </AdminField>
                {editForm.image_urls && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {editForm.image_urls
                      .split("\n")
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .map((url, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={url} alt="" className="h-12 w-12 rounded-[var(--admin-radius-sm)] object-cover" style={{ border: "1px solid var(--admin-border)" }} />
                      ))}
                  </div>
                )}
              </div>
            </DrawerSection>

            <DrawerSection title="סיווג ותגיות">
              <div className="flex flex-col gap-3">
                {TRIP_TYPE_GROUPS.map((group) => (
                  <div key={group.id}>
                    <button
                      type="button"
                      onClick={() => updateField("trip_type_tags", toggleInArray(editForm.trip_type_tags, group.id))}
                      className="mb-1.5 rounded-full border px-2.5 py-1 text-[12.5px] font-medium transition"
                      style={{
                        borderColor: editForm.trip_type_tags.includes(group.id) ? "var(--admin-accent)" : "var(--admin-border)",
                        background: editForm.trip_type_tags.includes(group.id) ? "var(--admin-accent-soft)" : "transparent",
                        color: editForm.trip_type_tags.includes(group.id) ? "var(--admin-accent)" : "var(--admin-ink)",
                      }}
                    >
                      {group.emoji} {group.label}
                    </button>
                    {editForm.trip_type_tags.includes(group.id) && (
                      <div className="ps-3">
                        <ChipToggleGroup
                          options={group.subTags}
                          selected={editForm.sub_tags}
                          onToggle={(id) => updateField("sub_tags", toggleInArray(editForm.sub_tags, id))}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </DrawerSection>

            <DrawerSection title="סוג מטבח">
              <ChipToggleGroup options={CUISINE_TAGS} selected={editForm.cuisine_tags} onToggle={(id) => updateField("cuisine_tags", toggleInArray(editForm.cuisine_tags, id))} />
            </DrawerSection>

            <DrawerSection title="כשרות ונגישות">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    כשר
                  </p>
                  <TriStateToggle value={editForm.kosher} onChange={(v) => updateField("kosher", v)} />
                </div>
                <div>
                  <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    נגישות
                  </p>
                  <TriStateToggle value={editForm.accessible} onChange={(v) => updateField("accessible", v)} />
                </div>
              </div>
            </DrawerSection>

            <DrawerSection title="עונות וגילאים">
              <p className="mb-1.5 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                עונות מתאימות
              </p>
              <ChipToggleGroup options={SEASON_OPTIONS} selected={editForm.seasons} onToggle={(id) => updateField("seasons", toggleInArray(editForm.seasons, id))} />
              <p className="mb-1.5 mt-3 text-[12.5px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                גילאי ילדים מתאימים
              </p>
              <ChipToggleGroup
                options={CHILD_AGE_OPTIONS}
                selected={editForm.suitable_child_ages}
                onToggle={(id) => updateField("suitable_child_ages", toggleInArray(editForm.suitable_child_ages, id))}
              />
            </DrawerSection>

            <DrawerSection title="תקציב">
              <select value={editForm.budget_tier} onChange={(e) => updateField("budget_tier", e.target.value)} className={adminInputClass} style={adminInputStyle}>
                <option value="">לא צוין</option>
                {BUDGET_TIER_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </DrawerSection>

            <DrawerSection title="מחיקה">
              <AdminButton
                variant="danger"
                onClick={() => {
                  const id = editingId;
                  cancelEdit();
                  if (id) handleDelete(id);
                }}
              >
                מחק מקום זה
              </AdminButton>
            </DrawerSection>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function ToolCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[var(--admin-radius-lg)] border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
        {title}
      </p>
      {children}
    </div>
  );
}
