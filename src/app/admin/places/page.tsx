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
import { DISCOVERY_BUCKETS } from "@/services/admin/discoveryConfigV2";
import Link from "next/link";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
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

  const [bulkReclassifying, setBulkReclassifying] = useState(false);
  const [bulkReclassifyResult, setBulkReclassifyResult] = useState<{ total: number; reclassified: number; unchanged: number; failed: number } | null>(null);

  const [bulkCityFilling, setBulkCityFilling] = useState(false);
  const [bulkCityResult, setBulkCityResult] = useState<{ total: number; filled: number; notFound: number } | null>(null);

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

  async function handleBulkReclassifyCategory() {
    if (!confirm("לסווג מחדש עם AI את הקטגוריה הראשית של כל המקומות שלא נערכו ידנית? זה ירוץ באצוות של 15 בכל פעם וידרוס את הקטגוריה הנוכחית שלהם.")) return;

    setBulkReclassifying(true);
    let totalReclassified = 0;
    let totalUnchanged = 0;
    let totalFailed = 0;
    let afterId: string | null = null;
    try {
      while (true) {
        const res: Response = await fetch("/api/admin/places/bulk-reclassify-category", {
          method: "POST",
          headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
          body: JSON.stringify({ mode: "all", afterId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "שגיאה");

        totalReclassified += data.reclassified;
        totalUnchanged += data.unchanged;
        totalFailed += data.failed;
        afterId = data.lastId ?? afterId;
        setBulkReclassifyResult({
          total: totalReclassified + totalUnchanged + totalFailed + data.remaining,
          reclassified: totalReclassified,
          unchanged: totalUnchanged,
          failed: totalFailed,
        });

        if (data.processedNow === 0 || data.remaining === 0) break;
      }
      await loadPlaces();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setBulkReclassifying(false);
    }
  }

  async function handleBulkFillCities() {
    if (!confirm("להשלים עיר אוטומטית (לפי קואורדינטות) לכל המקומות שחסרה להם עיר? זה ירוץ באצוות של 20 בכל פעם.")) return;

    setBulkCityFilling(true);
    let totalFilled = 0;
    let totalNotFound = 0;
    let afterId: string | null = null;
    try {
      while (true) {
        const res: Response = await fetch("/api/admin/places/backfill-cities", {
          method: "POST",
          headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
          body: JSON.stringify({ afterId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "שגיאה");

        totalFilled += data.filled;
        totalNotFound += data.notFound;
        afterId = data.lastId ?? afterId;
        setBulkCityResult({ total: totalFilled + totalNotFound + data.remaining, filled: totalFilled, notFound: totalNotFound });

        if (data.processedNow === 0 || data.remaining === 0) break;
      }
      await loadPlaces();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setBulkCityFilling(false);
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

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`למחוק ${selectedIds.size} מקומות? לא ניתן לבטל.`)) return;
    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/admin/places/${id}`, { method: "DELETE", headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
        )
      );
      setPlaces((prev) => prev.filter((p) => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            מקומות ואטרקציות
          </h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            מציג {filteredPlaces.length.toLocaleString()} מתוך {places.length.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deleting}
              className="rounded-[var(--admin-radius-sm)] px-3.5 py-2 text-[13.5px] font-medium"
              style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}
            >
              {deleting ? "מוחק..." : `🗑️ מחק נבחרים (${selectedIds.size})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleBulkTag("untagged")}
            disabled={bulkTagging}
            className="rounded-[var(--admin-radius-sm)] border px-3.5 py-2 text-[13.5px] font-medium"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
            title="מריץ AI על כל המקומות שעדיין אין להם תגיות בכלל"
          >
            {bulkTagging ? "מתייג..." : "✨ תייג לא-מתויגים"}
          </button>
          <button
            type="button"
            onClick={handleBulkReclassifyCategory}
            disabled={bulkReclassifying}
            className="rounded-[var(--admin-radius-sm)] border px-3.5 py-2 text-[13.5px] font-medium"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
            title="מריץ AI שבודק מחדש את הקטגוריה הראשית (מסעדות/חיי לילה/אטרקציות/טבע/מלונות) לפי שם ותיאור בפועל"
          >
            {bulkReclassifying ? "מסווג..." : "🏷️ סווג קטגוריות מחדש"}
          </button>
          <button
            type="button"
            onClick={handleBulkFillCities}
            disabled={bulkCityFilling}
            className="rounded-[var(--admin-radius-sm)] border px-3.5 py-2 text-[13.5px] font-medium"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
            title="משלים שם עיר לפי קואורדינטות, למקומות שנוצרו לפני שהתיקון הזה נוסף"
          >
            {bulkCityFilling ? "משלים ערים..." : "🌍 השלם ערים חסרות"}
          </button>
          <Link
            href="/admin/discovery"
            className="rounded-[var(--admin-radius-sm)] px-3.5 py-2 text-[13.5px] font-medium text-white"
            style={{ background: "var(--admin-accent)" }}
          >
            + הוסף מקום
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
        </div>
      )}

      {(bulkTagging || bulkTagResult) && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}>
          {bulkTagging ? "✨ מתייג..." : "✨ סיום תיוג:"}{" "}
          {bulkTagResult && `${bulkTagResult.tagged} תויגו, ${bulkTagResult.failed} נכשלו, מתוך ${bulkTagResult.total}`}
        </div>
      )}
      {(bulkReclassifying || bulkReclassifyResult) && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}>
          {bulkReclassifying ? "🏷️ מסווג קטגוריות..." : "🏷️ סיום סיווג:"}{" "}
          {bulkReclassifyResult &&
            `${bulkReclassifyResult.reclassified} שונו, ${bulkReclassifyResult.unchanged} נשארו זהות, ${bulkReclassifyResult.failed} נכשלו, מתוך ${bulkReclassifyResult.total}`}
        </div>
      )}
      {(bulkCityFilling || bulkCityResult) && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-accent-soft)", color: "var(--admin-accent)" }}>
          {bulkCityFilling ? "🌍 משלים ערים..." : "🌍 סיום השלמת ערים:"}{" "}
          {bulkCityResult && `${bulkCityResult.filled} הושלמו, ${bulkCityResult.notFound} לא זוהו, מתוך ${bulkCityResult.total}`}
        </div>
      )}

      {/* פילטרים - סוג טיול, קטגוריה (דינמית לפי סוג הטיול), מדינה, עיר.
          הוספת מקומות (בודד/AI Discovery) עברה לעמוד /admin/discovery -
          העמוד הזה עכשיו לצפייה/סינון/עריכה בלבד, לא הוספה. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput value={searchText} onChange={setSearchText} placeholder="חיפוש לפי שם מקום..." />
        <FilterSelect
          value={filterTripType}
          onChange={(v) => {
            setFilterTripType(v);
            setFilterCategory(""); // איפוס קטגוריה כשמחליפים סוג טיול - הרשימה תלויה בו
          }}
          placeholder="הכל"
          options={DISCOVERY_BUCKETS.map((t) => ({ value: t.key, label: `${t.emoji} ${t.label}` }))}
        />
        <FilterSelect
          value={filterCategory}
          onChange={setFilterCategory}
          placeholder="כל הקטגוריות"
          options={(DISCOVERY_BUCKETS.find((t) => t.key === filterTripType)?.categories ?? []).map((c) => ({ value: c.key, label: `${c.emoji} ${c.label}` }))}
        />
        <FilterSelect value={filterCountry} onChange={setFilterCountry} placeholder="כל המדינות" options={uniqueCountries.map((c) => ({ value: c, label: c }))} />
        <FilterSelect value={filterCity} onChange={setFilterCity} placeholder="כל הערים" options={uniqueCities.map((c) => ({ value: c, label: c }))} />
        <label className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
          <input type="checkbox" checked={filterUntaggedOnly} onChange={(e) => setFilterUntaggedOnly(e.target.checked)} />
          רק לא-מתויגים
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={filteredPlaces}
        keyFor={(p) => p.id}
        onRowClick={startEdit}
        emptyMessage="לא נמצאו מקומות תואמים"
        selectable
        selectedKeys={selectedIds}
        onToggleSelect={(id) =>
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
      />
    </div>
  );
}
