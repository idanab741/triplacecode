"use client";

import { useEffect, useState } from "react";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { PLACE_CATEGORIES } from "@/constants/placeCategories";
import { CUISINE_TAGS, PLACE_TYPE_TAGS, TRIPMATCH_TAGS, DNA_TAGS } from "@/constants/placeTagOptions";
import { DataTable, SearchInput, FilterSelect, type Column } from "@/screens/admin/shared/DataTable";
import { Drawer, AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { Badge } from "@/screens/admin/shared/Primitives";
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
  tripmatch_scores: Record<string, number>;
  dna_scores: Record<string, number>;
  kosher: boolean | null;
  accessible: boolean | null;
  seasons: string[];
  suitable_child_ages: string[];
  budget_tier: string | null;
}

const ADMIN_SECRET_HEADER = "x-admin-secret";

/** טופס העריכה של הפופ-אפ - שדות "עובדתיים" (שם/עיר/מדינה/תיאור/דירוג/
 *  כתובת/תמונה/אתר/טלפון) בתוספת קטגוריה + תגיות + ציוני התאמה, בדיוק
 *  כמו שהתבקש: "השם, מדינה, עיר, תיאור קצר, דירוג, כתובת, תמונה לשינוי,
 *  אתר אינטרנט, טלפון, וכמובן הקטגוריות מתחת... וגם התאמות". */
type EditForm = {
  name: string;
  category: string;
  city: string;
  country: string;
  address: string;
  short_description: string;
  phone: string;
  website: string;
  rating: string;
  image_urls: string[];
  tags: string[];
  cuisine_tags: string[];
  tripmatch_scores: Record<string, number>;
  dna_scores: Record<string, number>;
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
    rating: p.rating?.toString() ?? "",
    image_urls: p.image_urls ?? [],
    tags: p.tags ?? [],
    cuisine_tags: p.cuisine_tags ?? [],
    tripmatch_scores: p.tripmatch_scores ?? {},
    dna_scores: p.dna_scores ?? {},
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
    rating: f.rating ? Number(f.rating) : null,
    image_urls: f.image_urls,
    tags: f.tags,
    cuisine_tags: f.cuisine_tags,
    tripmatch_scores: f.tripmatch_scores,
    dna_scores: f.dna_scores,
  };
}

type MissingFilter = "tags" | "matching" | "description" | "website" | "rating" | "address" | null;

export default function AdminPlacesPage() {
  const { secret: adminSecret } = useAdminSecret();
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [aiFixingOne, setAiFixingOne] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");

  const [aiFixingMissing, setAiFixingMissing] = useState(false);
  const [aiFixMissingProgress, setAiFixMissingProgress] = useState({ done: 0, total: 0 });

  const [bulkReclassifying, setBulkReclassifying] = useState(false);
  const [bulkReclassifyResult, setBulkReclassifyResult] = useState<{ total: number; reclassified: number; unchanged: number; failed: number } | null>(null);

  const [bulkCityFilling, setBulkCityFilling] = useState(false);
  const [bulkCityResult, setBulkCityResult] = useState<{ total: number; filled: number; notFound: number } | null>(null);

  const [filterCategory, setFilterCategory] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterTripType, setFilterTripType] = useState("");
  const [searchText, setSearchText] = useState("");
  const [missingFilter, setMissingFilter] = useState<MissingFilter>(null);

  const uniqueCities = Array.from(new Set(places.map((p) => p.city).filter(Boolean))) as string[];
  const uniqueCountries = Array.from(new Set(places.map((p) => p.country).filter(Boolean))) as string[];

  const hasMatching = (p: Place) => Object.keys(p.tripmatch_scores ?? {}).length > 0 || Object.keys(p.dna_scores ?? {}).length > 0;

  // *** דשבורד למעלה - "לכמה מקומות אין תיוג/התאמות/אתר/דירוג/כתובת" ***
  const stats = {
    total: places.length,
    noTags: places.filter((p) => (p.tags ?? []).length === 0).length,
    noMatching: places.filter((p) => !hasMatching(p)).length,
    noDescription: places.filter((p) => !p.short_description || !p.short_description.trim()).length,
    noWebsite: places.filter((p) => !p.website).length,
    noRating: places.filter((p) => !p.rating).length,
    noAddress: places.filter((p) => !p.address).length,
  };

  const filteredPlaces = places.filter((p) => {
    if (searchText && !p.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    // "כשר" הוא ערך מיוחד ברשימת הקטגוריות של "מסעדה" (ר' discoveryConfigV2.ts) -
    // בניגוד לשאר תתי-הקטגוריות שם, זה לא נשמר בשדה category/subcategory של
    // המקום, אלא בשדה הבוליאני kosher (אותו שדה שנאכף באופן מחייב במאגר
    // המועמדים למשתמש קצה - ר' candidatePoolService.ts). לכן כשבוחרים אותו כאן
    // מסננים לפי kosher===true, לא לפי השוואת category רגילה.
    if (filterCategory === "kosher") {
      if (p.kosher !== true) return false;
    } else if (filterCategory && p.category !== filterCategory) {
      return false;
    }
    if (filterCity && p.city !== filterCity) return false;
    if (filterCountry && p.country !== filterCountry) return false;
    if (filterTripType && !(p.trip_type_tags ?? []).includes(filterTripType)) return false;
    if (missingFilter === "tags" && (p.tags ?? []).length > 0) return false;
    if (missingFilter === "description" && p.short_description && p.short_description.trim()) return false;
    if (missingFilter === "matching" && hasMatching(p)) return false;
    if (missingFilter === "website" && p.website) return false;
    if (missingFilter === "rating" && p.rating) return false;
    if (missingFilter === "address" && p.address) return false;
    return true;
  });

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

  async function handleBulkReclassifyCategory() {
    if (selectedIds.size === 0) {
      alert("קודם צריך לסמן ✓ את המקומות שרוצים לסווג מחדש (כדי לא להריץ AI סתם על מקומות שכבר מסווגים נכון).");
      return;
    }
    if (!confirm(`לסווג מחדש עם AI את הקטגוריה הראשית של ${selectedIds.size} המקומות המסומנים?`)) return;

    setBulkReclassifying(true);
    setBulkReclassifyResult(null);
    try {
      const res: Response = await fetch("/api/admin/places/bulk-reclassify-category", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה");

      setBulkReclassifyResult({
        total: data.reclassified + data.unchanged + data.failed,
        reclassified: data.reclassified,
        unchanged: data.unchanged,
        failed: data.failed,
      });
      if (data.errors?.length > 0) {
        alert(`חלק מהמקומות נכשלו. דוגמאות לשגיאות:\n\n${data.errors.join("\n")}`);
      }
      setSelectedIds(new Set());
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
    setBulkCityResult(null);
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

  /** "✨ תקן עם AI" בדשבורד - רץ ברצף (לא Promise.all, כדי לא להציף את
   *  Claude) על כל המקומות שתואמים כרגע לפילטר "חסר" הפעיל (תיוג/התאמות),
   *  קורא לאותו endpoint בדיוק כמו הכפתור הבודד בפופ-אפ. */
  async function handleAiFixMissing() {
    const ids = filteredPlaces.map((p) => p.id);
    if (ids.length === 0) return;
    const filterLabel = missingFilter === "tags" ? "ללא תיוג" : missingFilter === "matching" ? "ללא התאמות" : "ללא תיאור";
    if (!confirm(`להריץ AI על ${ids.length} המקומות המוצגים כרגע (${filterLabel})?`)) return;

    setAiFixingMissing(true);
    setAiFixMissingProgress({ done: 0, total: ids.length });
    try {
      for (let i = 0; i < ids.length; i++) {
        try {
          await fetch(`/api/admin/places/${ids[i]}/suggest-scores`, {
            method: "POST",
            headers: { [ADMIN_SECRET_HEADER]: adminSecret },
          });
        } catch {
          // ממשיכים גם אם מקום בודד נכשל
        }
        setAiFixMissingProgress({ done: i + 1, total: ids.length });
      }
      await loadPlaces();
    } finally {
      setAiFixingMissing(false);
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
    if (editingId === id) closeEditor();
    await loadPlaces();
  }

  function startEdit(place: Place) {
    setEditingId(place.id);
    setEditForm(placeToForm(place));
    setNewImageUrl("");
  }

  function closeEditor() {
    setEditingId(null);
    setEditForm(null);
    setNewImageUrl("");
  }

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setEditForm((f) => (f ? { ...f, [key]: value } : f));
  }

  function toggleFormArray(field: "tags" | "cuisine_tags", key: string) {
    setEditForm((f) => {
      if (!f) return f;
      const current = f[field];
      const next = current.includes(key) ? current.filter((v) => v !== key) : [...current, key];
      return { ...f, [field]: next };
    });
  }

  function toggleFormScore(field: "tripmatch_scores" | "dna_scores", key: string) {
    setEditForm((f) => {
      if (!f) return f;
      const current = f[field];
      const isOn = (current[key] ?? 0) > 0;
      const next = { ...current };
      if (isOn) delete next[key];
      else next[key] = 100;
      return { ...f, [field]: next };
    });
  }

  async function saveEdit() {
    if (!editingId || !editForm) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/places/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(formToPatchBody(editForm)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שגיאה בשמירה");
      closeEditor();
      await loadPlaces();
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setSavingEdit(false);
    }
  }

  /** "✨ מלא הכל עם AI" בפופ-אפ - אותו suggest-scores בדיוק כמו בעמוד
   *  Discovery, רק על מקום אחד. שומר ישירות ל-DB ואז מרענן את הטופס
   *  הפתוח עם התוצאה - לא צריך "שמור שינויים" בנפרד בשביל זה. */
  async function handleAiFixOne() {
    if (!editingId) return;
    setAiFixingOne(true);
    try {
      const res = await fetch(`/api/admin/places/${editingId}/suggest-scores`, {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "השלמת AI נכשלה");
      setEditForm(placeToForm(data.place));
      setPlaces((prev) => prev.map((p) => (p.id === editingId ? data.place : p)));
    } catch (e) {
      alert(e instanceof Error ? e.message : "שגיאה לא ידועה");
    } finally {
      setAiFixingOne(false);
    }
  }

  function addImageUrl() {
    const url = newImageUrl.trim();
    if (!url || !editForm) return;
    updateField("image_urls", [url, ...editForm.image_urls]);
    setNewImageUrl("");
  }

  function removeImageUrl(idx: number) {
    if (!editForm) return;
    updateField(
      "image_urls",
      editForm.image_urls.filter((_, i) => i !== idx)
    );
  }

  const columns: Column<Place>[] = [
    {
      key: "name",
      header: "מקום",
      sortValue: (p) => p.name,
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.image_urls?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image_urls[0]} alt="" className="h-14 w-14 shrink-0 rounded-[var(--admin-radius-md)] object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--admin-radius-md)] text-[16px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
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
      sortValue: (p) => (p.tags ?? []).length,
      render: (p) =>
        (p.tags ?? []).length > 0 ? (
          <Badge tone="success">מתויג ({p.tags.length})</Badge>
        ) : (
          <Badge tone="warning">לא תויג</Badge>
        ),
    },
    {
      key: "matching",
      header: "התאמות",
      sortValue: (p) => Object.keys(p.tripmatch_scores ?? {}).length + Object.keys(p.dna_scores ?? {}).length,
      render: (p) =>
        hasMatching(p) ? (
          <Badge tone="success">✓</Badge>
        ) : (
          <Badge tone="warning">חסר</Badge>
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

  function StatPill({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-start gap-0.5 rounded-[var(--admin-radius-md)] border px-4 py-2.5 text-right transition"
        style={{
          borderColor: active ? "var(--admin-accent)" : "var(--admin-border)",
          background: active ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
        }}
      >
        <span className="text-[19px] font-bold" style={{ color: count > 0 ? "var(--admin-danger)" : "var(--admin-ink)" }}>
          {count}
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          {label}
        </span>
      </button>
    );
  }

  return (
    <div dir="rtl" className="flex flex-col gap-5">
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
            onClick={handleBulkReclassifyCategory}
            disabled={bulkReclassifying || selectedIds.size === 0}
            className="rounded-[var(--admin-radius-sm)] border px-3.5 py-2 text-[13.5px] font-medium disabled:opacity-40"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
            title={selectedIds.size === 0 ? "סמן ✓ מקומות ברשימה קודם - הכפתור פועל רק על המסומנים. שים לב: זה מתקן רק את הקטגוריה הראשית (מסעדות/חיי לילה/אטרקציות/טבע/מלונות) - לא תיוג או התאמות, לאלה יש את הכפתור בדשבורד למעלה." : "מריץ AI שבודק מחדש את הקטגוריה הראשית בלבד (לא תיוג/התאמות) של המקומות המסומנים"}
          >
            {bulkReclassifying ? "מסווג..." : `🏷️ סווג קטגוריות מחדש${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
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

      {/* דשבורד - "לכמה מקומות אין תיוג/התאמות/אתר/דירוג/כתובת", עם
          לחיצה שמסננת את הטבלה לאותם מקומות בדיוק. זו הדרך היחידה
          לתקן תיוג/התאמות בפועל - הכפתור "✨ תקן עם AI" כאן קורא לאותו
          endpoint שממלא גם קטגוריה/סוג-מקום/מטבח וגם TripMatch+DNA
          יחד (suggest-scores) - בניגוד לכפתור ישן שהיה כאן קודם
          ("תייג לא-מתויגים") שמילא שדה אחר לגמרי (trip_type_tags הישן)
          ולא היה משפיע בכלל על המספרים שמוצגים כאן. */}
      <div className="flex flex-wrap items-center gap-2.5">
        <StatPill label="סה״כ מקומות" count={stats.total} active={missingFilter === null} onClick={() => setMissingFilter(null)} />
        <StatPill label="ללא תיוג" count={stats.noTags} active={missingFilter === "tags"} onClick={() => setMissingFilter(missingFilter === "tags" ? null : "tags")} />
        <StatPill label="ללא התאמות" count={stats.noMatching} active={missingFilter === "matching"} onClick={() => setMissingFilter(missingFilter === "matching" ? null : "matching")} />
        <StatPill label="ללא תיאור" count={stats.noDescription} active={missingFilter === "description"} onClick={() => setMissingFilter(missingFilter === "description" ? null : "description")} />
        <StatPill label="ללא אתר" count={stats.noWebsite} active={missingFilter === "website"} onClick={() => setMissingFilter(missingFilter === "website" ? null : "website")} />
        <StatPill label="ללא דירוג" count={stats.noRating} active={missingFilter === "rating"} onClick={() => setMissingFilter(missingFilter === "rating" ? null : "rating")} />
        <StatPill label="ללא כתובת" count={stats.noAddress} active={missingFilter === "address"} onClick={() => setMissingFilter(missingFilter === "address" ? null : "address")} />

        {(missingFilter === "tags" || missingFilter === "matching" || missingFilter === "description") && filteredPlaces.length > 0 && (
          <button
            type="button"
            onClick={handleAiFixMissing}
            disabled={aiFixingMissing}
            className="rounded-[var(--admin-radius-md)] px-4 py-2.5 text-[13px] font-medium text-white"
            style={{ background: "var(--admin-accent)" }}
          >
            {aiFixingMissing ? `✨ מתקן... (${aiFixMissingProgress.done}/${aiFixMissingProgress.total})` : `✨ תקן עם AI (${filteredPlaces.length})`}
          </button>
        )}
        {missingFilter === null && (
          <span className="text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
            לחץ על "ללא תיוג" או "ללא התאמות" למעלה כדי לראות כפתור "✨ תקן עם AI" שממלא את שניהם יחד, רק על המקומות שבאמת חסרים.
          </span>
        )}
        {(missingFilter === "website" || missingFilter === "rating" || missingFilter === "address") && (
          <span className="text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
            שדה זה לא ניתן להשלמה אוטומטית - יש לערוך ידנית כל מקום (לחיצה על השורה).
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-[var(--admin-radius-sm)] px-4 py-2.5 text-[13px]" style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}>
          {error}
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
        <span className="flex-1" />
        <button
          type="button"
          onClick={() =>
            setSelectedIds((prev) => {
              const allFilteredSelected = filteredPlaces.length > 0 && filteredPlaces.every((p) => prev.has(p.id));
              if (allFilteredSelected) return new Set();
              return new Set(filteredPlaces.map((p) => p.id));
            })
          }
          className="text-[12.5px] font-medium underline"
          style={{ color: "var(--admin-accent)" }}
        >
          {filteredPlaces.length > 0 && filteredPlaces.every((p) => selectedIds.has(p.id)) ? "נקה בחירה" : `בחר הכל בתצוגה (${filteredPlaces.length})`}
        </button>
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

      {/* פופ-אפ עריכת מקום - נפתח בלחיצה על שורה, במקום ניווט לעמוד נפרד. */}
      <Drawer
        open={editingId !== null && editForm !== null}
        onClose={closeEditor}
        title={editForm?.name ?? ""}
        subtitle="עריכת מקום"
        width={560}
        footer={
          editingId && (
            <>
              <button
                type="button"
                onClick={() => handleDelete(editingId)}
                className="ml-auto text-[13px] font-medium"
                style={{ color: "var(--admin-danger)" }}
              >
                מחק מקום
              </button>
              <AdminButton variant="secondary" onClick={closeEditor}>
                ביטול
              </AdminButton>
              <AdminButton onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? "שומר..." : "שמור שינויים"}
              </AdminButton>
            </>
          )
        }
      >
        {editForm && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-[var(--admin-radius-lg)] border p-4" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
              <div>
                <p className="text-[13.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
                  ✨ מלא הכל עם AI
                </p>
                <p className="mt-0.5 text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                  קטגוריה, תיוג, מטבח, TripMatch ו-DNA - נשמר ישירות.
                </p>
              </div>
              <AdminButton variant="secondary" onClick={handleAiFixOne} disabled={aiFixingOne}>
                {aiFixingOne ? "מתקן..." : "✨ מלא עם AI"}
              </AdminButton>
            </div>

            {/* תמונה */}
            <div>
              {editForm.image_urls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editForm.image_urls[0]} alt="" className="h-48 w-full rounded-[var(--admin-radius-lg)] object-cover" />
              ) : (
                <div className="flex h-48 w-full items-center justify-center rounded-[var(--admin-radius-lg)]" style={{ background: "var(--admin-bg-sunken)" }}>
                  <span style={{ color: "var(--admin-ink-faint)" }}>אין תמונה</span>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  className={adminInputClass}
                  style={adminInputStyle}
                  placeholder="הוסף/החלף תמונה (URL)"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addImageUrl()}
                />
                <AdminButton variant="secondary" onClick={addImageUrl}>
                  הוסף
                </AdminButton>
              </div>
              {editForm.image_urls.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {editForm.image_urls.slice(1).map((url, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-14 w-14 rounded-[var(--admin-radius-sm)] object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImageUrl(i + 1)}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[11px] text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="שם המקום">
                <input className={adminInputClass} style={adminInputStyle} value={editForm.name} onChange={(e) => updateField("name", e.target.value)} />
              </AdminField>
              <AdminField label="דירוג">
                <input type="number" step="0.1" className={adminInputClass} style={adminInputStyle} value={editForm.rating} onChange={(e) => updateField("rating", e.target.value)} />
              </AdminField>
              <AdminField label="מדינה">
                <input className={adminInputClass} style={adminInputStyle} value={editForm.country} onChange={(e) => updateField("country", e.target.value)} />
              </AdminField>
              <AdminField label="עיר">
                <input className={adminInputClass} style={adminInputStyle} value={editForm.city} onChange={(e) => updateField("city", e.target.value)} />
              </AdminField>
              <div className="col-span-2">
                <AdminField label="כתובת">
                  <input className={adminInputClass} style={adminInputStyle} value={editForm.address} onChange={(e) => updateField("address", e.target.value)} />
                </AdminField>
              </div>
              <div className="col-span-2">
                <AdminField label="תיאור קצר">
                  <textarea className={adminInputClass} style={{ ...adminInputStyle, minHeight: 70 }} value={editForm.short_description} onChange={(e) => updateField("short_description", e.target.value)} />
                </AdminField>
              </div>
              <AdminField label="אתר אינטרנט">
                <input className={adminInputClass} style={adminInputStyle} value={editForm.website} onChange={(e) => updateField("website", e.target.value)} />
              </AdminField>
              <AdminField label="טלפון">
                <input className={adminInputClass} style={adminInputStyle} value={editForm.phone} onChange={(e) => updateField("phone", e.target.value)} />
              </AdminField>
            </div>

            {/* קטגוריה - חובה, אחת מ-5 בלבד */}
            <AdminField label="קטגוריה ראשית (חובה)">
              <select className={adminInputClass} style={adminInputStyle} value={editForm.category} onChange={(e) => updateField("category", e.target.value)}>
                {PLACE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </AdminField>

            <div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--admin-ink-secondary)" }}>
                קטגוריה / סוג מקום
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLACE_TYPE_TAGS.map((t) => {
                  const active = editForm.tags.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleFormArray("tags", t.key)}
                      className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition"
                      style={{
                        borderColor: active ? "var(--admin-accent)" : "var(--admin-border)",
                        background: active ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
                        color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--admin-ink-secondary)" }}>
                מטבח / סגנון קולינרי
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CUISINE_TAGS.map((t) => {
                  const active = editForm.cuisine_tags.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleFormArray("cuisine_tags", t.key)}
                      className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition"
                      style={{
                        borderColor: active ? "var(--admin-accent)" : "var(--admin-border)",
                        background: active ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
                        color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* התאמות - TripMatch + DNA */}
            <div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "#548235" }}>
                התאמות - TripMatch
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TRIPMATCH_TAGS.map((t) => {
                  const active = (editForm.tripmatch_scores[t.key] ?? 0) > 0;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleFormScore("tripmatch_scores", t.key)}
                      className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition"
                      style={{
                        borderColor: active ? "#548235" : "var(--admin-border)",
                        background: active ? "#54823522" : "var(--admin-bg-surface)",
                        color: active ? "#548235" : "var(--admin-ink-secondary)",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "#BF8F00" }}>
                התאמות - DNA
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DNA_TAGS.map((t) => {
                  const active = (editForm.dna_scores[t.key] ?? 0) > 0;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleFormScore("dna_scores", t.key)}
                      className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition"
                      style={{
                        borderColor: active ? "#BF8F00" : "var(--admin-border)",
                        background: active ? "#BF8F0022" : "var(--admin-bg-surface)",
                        color: active ? "#BF8F00" : "var(--admin-ink-secondary)",
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
