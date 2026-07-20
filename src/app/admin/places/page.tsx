"use client";

import { useEffect, useState } from "react";
import {
  TRIP_TYPE_GROUPS,
  CUISINE_TAGS,
  SEASON_OPTIONS,
  CHILD_AGE_OPTIONS,
  BUDGET_TIER_OPTIONS,
} from "@/services/places/tripTaxonomy";
import { getCategoryLabel } from "@/utils/categoryLabels";

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
  const [adminSecret, setAdminSecret] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bulkCity, setBulkCity] = useState("");
  const [bulkCategory, setBulkCategory] = useState(CATEGORIES[0]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ fetched: number; saved: number; skipped: number } | null>(null);

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
      const res = await fetch("/api/admin/collect-places", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ city: bulkCity, category: bulkCategory }),
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
        const res = await fetch("/api/admin/places/bulk-suggest-tags", {
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
    setEditingId(place.id);
    setEditForm(placeToForm(place));
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

  return (
    <div className="mx-auto max-w-3xl p-6" dir="rtl">
      <h1 className="mb-4 text-xl font-bold">מאגר מקומות - אדמין</h1>

      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium">סיסמת אדמין</label>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
      </div>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם המקום (הוספה בודדת)"
          className="flex-1 rounded border border-gray-300 px-3 py-2"
        />
        <button
          onClick={handleAdd}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? "מוסיף..." : "הוסף"}
        </button>
      </div>

      <div className="mb-8 rounded border border-gray-200 p-3">
        <p className="mb-2 text-sm font-medium">הוספה בכמות (עיר + קטגוריה)</p>
        <div className="flex flex-wrap gap-2">
          <input
            value={bulkCity}
            onChange={(e) => setBulkCity(e.target.value)}
            placeholder="עיר (למשל: תל אביב)"
            className="flex-1 rounded border border-gray-300 px-3 py-2"
          />
   <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {getCategoryLabel(c)}
              </option>
            ))}
          </select>
          <button
            onClick={handleBulkAdd}
            disabled={bulkLoading}
            className="rounded bg-purple-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {bulkLoading ? "אוסף..." : "הוסף בכמות"}
          </button>
        </div>
        {bulkResult && (
          <p className="mt-2 text-sm text-gray-600">
            נמצאו {bulkResult.fetched} · נשמרו {bulkResult.saved} · דולגו {bulkResult.skipped}
          </p>
        )}
      </div>

  <div className="mb-6 rounded border border-gray-200 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">תיוג אוטומטי בכמות</p>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkTag("untagged")}
              disabled={bulkTagging}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {bulkTagging ? "מתייג..." : "🤖 תייג לא-מתויגים"}
            </button>
            <button
              onClick={() => handleBulkTag("all")}
              disabled={bulkTagging}
              className="rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {bulkTagging ? "מתייג..." : "🔄 תייג הכל מחדש"}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          "תייג לא-מתויגים" - רק מקומות בלי תגיות. "תייג הכל מחדש" - דורס תיוג קיים (חוץ ממקומות שנערכו ידנית).
        </p>
        {bulkTagResult && (
          <p className="mt-2 text-sm text-gray-600">
            סה"כ {bulkTagResult.total} · תויגו {bulkTagResult.tagged} · נכשלו {bulkTagResult.failed}
          </p>
        )}
      </div>

<input
        type="text"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="חיפוש לפי שם מקום..."
        className="mb-3 w-full rounded border border-gray-300 px-3 py-2"
      />

 <div className="mb-6 grid grid-cols-2 gap-2 rounded border border-gray-200 p-3 sm:grid-cols-3">
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">כל הערים</option>
          {uniqueCities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterCountry}
          onChange={(e) => setFilterCountry(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">כל המדינות</option>
          {uniqueCountries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterTripType}
          onChange={(e) => setFilterTripType(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">כל סוגי המסלול</option>
          {TRIP_TYPE_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.emoji} {g.label}
            </option>
          ))}
        </select>
 </div>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={filterUntaggedOnly}
          onChange={(e) => setFilterUntaggedOnly(e.target.checked)}
        />
        הצג רק מקומות שעדיין לא תויגו ({untaggedCount} מתוך {places.length})
      </label>

      {error && <p className="mb-4 text-red-600">{error}</p>}

      <p className="mb-2 text-sm text-gray-500">
        מציג {filteredPlaces.length} מתוך {places.length}
      </p>

      <div className="space-y-3">
        {filteredPlaces.map((place) => (
          <div key={place.id} className="rounded border border-gray-200 p-3">
            {editingId === place.id && editForm ? (
              <div className="flex flex-col gap-3 text-sm">
                <label className="flex flex-col gap-0.5">
                  שם
                  <input
                    value={editForm.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1"
                  />
                </label>

<div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5">
                    עיר
                    <input
                      value={editForm.city}
                      onChange={(e) => updateField("city", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    מדינה
                    <input
                      value={editForm.country}
                      onChange={(e) => updateField("country", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-0.5">
                  כתובת
                  <input
                    value={editForm.address}
                    onChange={(e) => updateField("address", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5">
                    Latitude
                    <input
                      value={editForm.latitude}
                      onChange={(e) => updateField("latitude", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    Longitude
                    <input
                      value={editForm.longitude}
                      onChange={(e) => updateField("longitude", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-0.5">
                  תיאור קצר
                  <textarea
                    value={editForm.short_description}
                    onChange={(e) => updateField("short_description", e.target.value)}
                    rows={2}
                    className="rounded border border-gray-300 px-2 py-1"
                  />
                </label>

                <label className="flex flex-col gap-0.5">
                  שעות פעילות (שורה לכל יום)
                  <textarea
                    value={editForm.opening_hours}
                    onChange={(e) => updateField("opening_hours", e.target.value)}
                    rows={3}
                    className="rounded border border-gray-300 px-2 py-1"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-0.5">
                    טלפון
                    <input
                      value={editForm.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    אתר אינטרנט
                    <input
                      value={editForm.website}
                      onChange={(e) => updateField("website", e.target.value)}
                      className="rounded border border-gray-300 px-2 py-1"
                    />
                  </label>
                </div>

                <label className="flex flex-col gap-0.5">
                  זמן ביקור משוער (בדקות)
                  <input
                    value={editForm.estimated_visit_minutes}
                    onChange={(e) => updateField("estimated_visit_minutes", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1"
                  />
                </label>

                <label className="flex flex-col gap-0.5">
                  תגיות חופשיות (מופרדות בפסיק)
                  <input
                    value={editForm.tags}
                    onChange={(e) => updateField("tags", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1"
                  />
                </label>

                <label className="flex flex-col gap-0.5">
                  תמונות (כתובת URL אחת בכל שורה)
                  <textarea
                    value={editForm.image_urls}
                    onChange={(e) => updateField("image_urls", e.target.value)}
                    rows={3}
                    className="rounded border border-gray-300 px-2 py-1 font-mono text-xs"
                  />
                  {editForm.image_urls && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {editForm.image_urls
                        .split("\n")
                        .map((u) => u.trim())
                        .filter(Boolean)
                        .map((url, i) => (
                          <img key={i} src={url} alt="" className="h-12 w-12 rounded object-cover" />
                        ))}
                    </div>
                  )}
                </label>

                <hr className="my-2 border-gray-200" />

                <button
                  onClick={() => suggestTagsWithClaude(place.id)}
                  disabled={suggestingTags}
                  className="rounded bg-indigo-600 px-3 py-2 font-medium text-white disabled:opacity-50"
                >
                  {suggestingTags ? "Claude חושב..." : "🤖 הצע תיוג עם Claude"}
                </button>
                <p className="text-xs text-gray-500">
                  Claude ימלא את הסימונים למטה אוטומטית - סקרי ותתקני לפני שמירה.
                </p>

                <div>
                  <p className="mb-1 font-medium">סוג/י מסלול (בחירה מרובה)</p>
                  <div className="flex flex-col gap-2">
                    {TRIP_TYPE_GROUPS.map((group) => (
                      <div key={group.id} className="rounded border border-gray-200 p-2">
                        <label className="flex items-center gap-1.5 font-medium">
                          <input
                            type="checkbox"
                            checked={editForm.trip_type_tags.includes(group.id)}
                            onChange={() =>
                              updateField("trip_type_tags", toggleInArray(editForm.trip_type_tags, group.id))
                            }
                          />
                          {group.emoji} {group.label}
                        </label>
                        {editForm.trip_type_tags.includes(group.id) && (
                          <div className="mt-1 flex flex-wrap gap-2 ps-5 text-xs">
                            {group.subTags.map((tag) => (
                              <label key={tag.id} className="flex items-center gap-1">
                                <input
                                  type="checkbox"
                                  checked={editForm.sub_tags.includes(tag.id)}
                                  onChange={() => updateField("sub_tags", toggleInArray(editForm.sub_tags, tag.id))}
                                />
                                {tag.label}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-medium">סוג מטבח (אם רלוונטי)</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {CUISINE_TAGS.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={editForm.cuisine_tags.includes(tag.id)}
                          onChange={() => updateField("cuisine_tags", toggleInArray(editForm.cuisine_tags, tag.id))}
                        />
                        {tag.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 font-medium">כשר</p>
                    <div className="flex gap-2">
                      {[
                        { label: "כן", value: true },
                        { label: "לא", value: false },
                        { label: "לא ידוע", value: null },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          onClick={() => updateField("kosher", opt.value)}
                          className={`rounded px-2 py-1 text-xs ${
                            editForm.kosher === opt.value ? "bg-blue-600 text-white" : "bg-gray-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 font-medium">נגישות</p>
                    <div className="flex gap-2">
                      {[
                        { label: "כן", value: true },
                        { label: "לא", value: false },
                        { label: "לא ידוע", value: null },
                      ].map((opt) => (
                        <button
                          key={String(opt.value)}
                          onClick={() => updateField("accessible", opt.value)}
                          className={`rounded px-2 py-1 text-xs ${
                            editForm.accessible === opt.value ? "bg-blue-600 text-white" : "bg-gray-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-medium">עונות מתאימות</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {SEASON_OPTIONS.map((s) => (
                      <label key={s.id} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={editForm.seasons.includes(s.id)}
                          onChange={() => updateField("seasons", toggleInArray(editForm.seasons, s.id))}
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-1 font-medium">גילאי ילדים מתאימים</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {CHILD_AGE_OPTIONS.map((a) => (
                      <label key={a.id} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={editForm.suitable_child_ages.includes(a.id)}
                          onChange={() =>
                            updateField("suitable_child_ages", toggleInArray(editForm.suitable_child_ages, a.id))
                          }
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-0.5">
                  רמת תקציב
                  <select
                    value={editForm.budget_tier}
                    onChange={(e) => updateField("budget_tier", e.target.value)}
                    className="rounded border border-gray-300 px-2 py-1"
                  >
                    <option value="">לא צוין</option>
                    {BUDGET_TIER_OPTIONS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => saveEdit(place.id)}
                    disabled={savingEdit}
                    className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
                  >
                    {savingEdit ? "שומר..." : "שמור"}
                  </button>
                  <button onClick={cancelEdit} className="rounded bg-gray-200 px-3 py-1">
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {place.image_urls?.[0] && (
                  <img src={place.image_urls[0]} alt="" className="h-14 w-14 rounded object-cover" />
                )}
            <div className="flex-1">
                  <p className="font-medium">{place.name}</p>
                  <p className="text-sm text-gray-500">
                    {place.category} · {place.city ?? "—"} {place.rating ? `· ⭐ ${place.rating}` : ""}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${
                      (place.trip_type_tags ?? []).length > 0
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {(place.trip_type_tags ?? []).length > 0
                      ? `✅ מתויג (${place.trip_type_tags.length})`
                      : "⚠️ לא תויג"}
                  </span>
                </div>
                <button onClick={() => startEdit(place)} className="text-sm text-blue-600">
                  ערוך
                </button>
                <button onClick={() => handleDelete(place.id)} className="text-sm text-red-600">
                  מחק
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}