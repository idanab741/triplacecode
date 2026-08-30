"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { AdminButton, AdminField, DrawerSection, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { QUICK_CATEGORIES, type QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { PLACE_CATEGORIES } from "@/constants/placeCategories";
import { getCategoryLabel } from "@/utils/categoryLabels";
import {
  RESTAURANT_CATEGORY_KEYWORDS,
  ATTRACTION_CATEGORY_KEYWORDS,
  NATURE_CATEGORY_KEYWORDS,
  NIGHTLIFE_CATEGORY_KEYWORDS,
  HOTEL_CATEGORY_VALUE,
} from "@/constants/destinationCategoryKeywords";

const ADMIN_SECRET_HEADER = "x-admin-secret";

interface Place {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  city: string | null;
  image_urls: string[];
  rating: number | null;
  tags: string[] | null;
  trip_type_tags: string[] | null;
  cuisine_tags: string[] | null;
  /** true = קושר במפורש (destination_edition_places), false = נמצא
   *  אוטומטית לפי התאמת city/region למאגר (ר' API - אותה שאילתה בדיוק
   *  שהעמוד הציבורי /destination/[id] משתמש בה). קובע אם "הסרה" רלוונטית. */
  curated: boolean;
}

/**
 * *** תיקון (באג אמיתי - "למה הכל לא מסווג?"): ADMIN_DISCOVERY_SECTIONS
 * מכיל סקשנים רק ל-5 סוגי טיול ספציפיים (יומי/טבע/מסעדות וקפה/דייט/
 * חיי לילה) + weekend בנפרד - **אין בו בכלל ערך ל-"abroad"**. כל
 * destination_edition עם quick_category="abroad" קיבל ADMIN_DISCOVERY_
 * SECTIONS["abroad"]===undefined, כלומר "[]" - אף מקום לא יכול היה
 * להתאים לאף סקשן, אז הכול נפל תמיד ל"לא מסווג". התיקון: יעדים
 * (כמו כל היעדים בעמוד הזה) לא משתמשים ב-ADMIN_DISCOVERY_SECTIONS
 * בכלל - הם משתמשים בטקסונומיה שהעמוד הציבורי /destination/[id] כבר
 * משתמש בה בפועל לכל יעד: 5 קבוצות לפי מילות-מפתח ב-category
 * (מסעדות/אטרקציות/טבע/חיי לילה) + מלונות (category מדויק) - ר'
 * constants/destinationCategoryKeywords.ts, מקור אמת יחיד.
 */
const DESTINATION_SECTIONS: { id: string; emoji: string; title: string; matches: (place: Place) => boolean }[] = [
  { id: "hotels", emoji: "🏨", title: "מלונות", matches: (p) => p.category === HOTEL_CATEGORY_VALUE },
  { id: "restaurants", emoji: "🍽️", title: "מסעדות", matches: (p) => RESTAURANT_CATEGORY_KEYWORDS.some((kw) => p.category?.toLowerCase().includes(kw)) },
  { id: "attractions", emoji: "🎯", title: "אטרקציות", matches: (p) => ATTRACTION_CATEGORY_KEYWORDS.some((kw) => p.category?.toLowerCase().includes(kw)) },
  { id: "nature", emoji: "🌿", title: "טבע", matches: (p) => NATURE_CATEGORY_KEYWORDS.some((kw) => p.category?.toLowerCase().includes(kw)) },
  { id: "nightlife", emoji: "🌙", title: "חיי לילה", matches: (p) => NIGHTLIFE_CATEGORY_KEYWORDS.some((kw) => p.category?.toLowerCase().includes(kw)) },
];

interface Edition {
  id: string;
  destination_id: string;
  quick_category: QuickCategoryId;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  description: string | null;
  weather_notes: string | null;
  is_published: boolean;
  destinations: { id: string; name: string; country: string | null } | null;
}

/** מחזיר bucket סביר (מ-BUCKETS ב-admin/discovery) כברירת מחדל להוספה
 *  מרובה, לפי סוג הטיול של המהדורה - נקודת התחלה בלבד, ניתן לשינוי
 *  ידני בטופס עצמו (בדיוק כמו ב"טיול יומי -> מסעדות וקפה" שהוזכר
 *  בדוגמה - האדמין בוחר את הקטגוריה בפועל בכל הוספה). */
const DEFAULT_BUCKET_BY_QUICK_CATEGORY: Record<QuickCategoryId, string> = {
  abroad: "attractions",
  day_trip: "attractions",
  weekend: "hotels",
  nature_trip: "nature",
  restaurants_cafes: "restaurants",
  romantic_date: "attractions",
  nightlife: "nightlife",
};

export default function DestinationEditionPage() {
  const { secret: adminSecret } = useAdminSecret();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [edition, setEdition] = useState<Edition | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [attachQuery, setAttachQuery] = useState("");
  const [attachResults, setAttachResults] = useState<Place[]>([]);
  const [attaching, setAttaching] = useState(false);

  const [bulkBucket, setBulkBucket] = useState<string>("attractions");
  const [bulkFreeText, setBulkFreeText] = useState("");
  const [bulkQuantity, setBulkQuantity] = useState(20);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  function loadEdition() {
    if (!adminSecret || !id) return;
    fetch(`/api/admin/destination-editions/${id}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEdition(data.edition);
        setPlaces(data.places ?? []);
        setBulkBucket(DEFAULT_BUCKET_BY_QUICK_CATEGORY[data.edition.quick_category as QuickCategoryId] ?? "attractions");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת היעד"));
  }

  useEffect(loadEdition, [adminSecret, id]);

  function update<K extends keyof Edition>(key: K, value: Edition[K]) {
    setEdition((e) => (e ? { ...e, [key]: value } : e));
  }

  async function handleSave() {
    if (!edition) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/destination-editions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({
          title: edition.title,
          subtitle: edition.subtitle,
          image_url: edition.image_url,
          description: edition.description,
          weather_notes: edition.weather_notes,
          quick_category: edition.quick_category,
          is_published: edition.is_published,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEdition() {
    if (!confirm(`למחוק את "${edition?.title}"? האטרקציות עצמן יישארו במאגר.`)) return;
    await fetch(`/api/admin/destination-editions/${id}`, {
      method: "DELETE",
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    });
    router.push("/admin/place-console");
  }

  async function handleUnlinkPlace(placeId: string) {
    // עדכון אופטימי - מרגיש מיידי, ובלי לחכות לתשובת השרת לרענון הרשימה.
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    await fetch(`/api/admin/destination-editions/${id}/places/${placeId}`, {
      method: "DELETE",
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    }).catch(() => {});
  }

  useEffect(() => {
    if (!adminSecret || attachQuery.trim().length < 2) {
      setAttachResults([]);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/admin/places?q=${encodeURIComponent(attachQuery.trim())}`, {
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      })
        .then((res) => res.json())
        .then((data) => setAttachResults((data.places ?? []).slice(0, 8)))
        .catch(() => setAttachResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [adminSecret, attachQuery]);

  async function handleAttachExisting(place: Place) {
    setAttaching(true);
    try {
      await fetch(`/api/admin/destination-editions/${id}/places`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ placeId: place.id }),
      });
      setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
      setAttachQuery("");
      setAttachResults([]);
    } finally {
      setAttaching(false);
    }
  }

  /** "הוספה מרובה" - קוראת ישירות למנוע ה-AI Discovery הקיים
   *  (/api/admin/discovery-jobs/smart-search, אותו endpoint ש-
   *  admin/discovery כבר משתמש בו), ואז משייכת אוטומטית כל אטרקציה
   *  שנוצרה/נמצאה למהדורה הזו - כדי שלא יהיה צורך לצאת לעמוד Discovery
   *  הנפרד ולחזור לקשר ידנית. */
  async function handleBulkAdd() {
    if (!edition || bulkRunning) return;
    setBulkRunning(true);
    setBulkErrors([]);
    setError(null);
    try {
      const city = edition.title;
      const country = edition.destinations?.country ?? "";
      const text =
        bulkFreeText.trim() ||
        `${bulkQuantity} ${getCategoryLabel(bulkBucket)} ב${city}${edition.subtitle ? ` (${edition.subtitle})` : ""}`;

      const res = await fetch("/api/admin/discovery-jobs/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ freeText: text, country, city, bucket: bulkBucket }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newPlaces: Place[] = data.places ?? [];
      setBulkErrors(data.errors ?? []);

      if (newPlaces.length > 0) {
        await fetch(`/api/admin/destination-editions/${id}/places`, {
          method: "POST",
          headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
          body: JSON.stringify({ placeIds: newPlaces.map((p) => p.id) }),
        });
        setPlaces((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          return [...prev, ...newPlaces.filter((p) => !existingIds.has(p.id))];
        });
      }
      setBulkFreeText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההוספה המרובה נכשלה");
    } finally {
      setBulkRunning(false);
    }
  }

  if (error && !edition) {
    return (
      <div dir="rtl" className="p-6 text-[13.5px]" style={{ color: "var(--admin-danger)" }}>
        {error}
      </div>
    );
  }

  if (!edition) {
    return (
      <div dir="rtl" className="flex flex-col gap-4 p-6">
        <div className="admin-skeleton h-64 w-full rounded-[var(--admin-radius-lg)]" />
        <div className="admin-skeleton h-8 w-1/3 rounded" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="admin-fade-in flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
          <Link href="/admin/place-console" className="hover:underline">
            סוגי טיול
          </Link>
          <span>/</span>
          <span style={{ color: "var(--admin-ink)" }}>{edition.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-[12.5px]" style={{ color: "var(--admin-success)" }}>
              נשמר ✓
            </span>
          )}
          <AdminButton variant="danger" onClick={handleDeleteEdition}>
            מחיקת יעד
          </AdminButton>
          <AdminButton onClick={handleSave} disabled={saving}>
            {saving ? "שומר..." : "שמירה"}
          </AdminButton>
        </div>
      </div>

      {error && (
        <p
          className="rounded-[var(--admin-radius-md)] px-4 py-3 text-[13.5px]"
          style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* ============ צד שמאל (בגריד LTR של האדמין: העמודה הראשונה
            מוצגת מימין כי dir=rtl על הקונטיינר) - Preview חי, באותה
            שפה ויזואלית בדיוק כמו עמוד היעד באפליקציה. ============ */}
        <div
          dir="rtl"
          className="flex h-fit flex-col overflow-hidden rounded-[var(--admin-radius-lg)] border"
          style={{ borderColor: "var(--admin-border)", background: "#ffffff" }}
        >
          <div className="relative h-56 w-full">
            {edition.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={edition.image_url} alt={edition.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-100 text-4xl">🖼️</div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.3)_60%,transparent_100%)] p-4 pt-16">
              <p className="text-xl font-bold text-white">{edition.title}</p>
              {edition.subtitle && <p className="text-sm text-white/85">{edition.subtitle}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-4 px-5 py-4">
            {edition.description && <p className="text-sm leading-relaxed text-gray-700">{edition.description}</p>}

            {edition.weather_notes && (
              <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <span className="ml-1 font-semibold">מזג אוויר:</span>
                {edition.weather_notes}
              </div>
            )}

            <div>
              <h3 className="mb-2 text-[15px] font-semibold text-gray-900">
                אטרקציות
                <span className="mr-1.5 text-[12.5px] font-normal text-gray-400">({places.length})</span>
              </h3>
              {places.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                  אין עדיין אטרקציות משויכות ליעד הזה
                </div>
              ) : (
                <div className="-mx-5 overflow-x-auto ps-5 pb-1" style={{ scrollbarWidth: "none" }}>
                  <div className="flex gap-3">
                    {places.map((place) => (
                      <div key={place.id} className="w-32 shrink-0">
                        <div className="h-24 w-32 overflow-hidden rounded-2xl bg-gray-100">
                          {place.image_urls[0] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={place.image_urls[0]} alt={place.name} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-[13px] font-medium text-gray-900">{place.name}</p>
                        {place.rating != null && <p className="text-[11.5px] text-gray-400">★ {place.rating.toFixed(1)}</p>}
                      </div>
                    ))}
                    <div className="w-2 shrink-0" aria-hidden />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============ צד ימין - פאנל עריכה ============ */}
        <div className="flex flex-col gap-5">
          <div
            className="flex flex-col gap-4 rounded-[var(--admin-radius-lg)] border p-5"
            style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
          >
            <DrawerSection title="פרטי היעד">
              <div className="grid grid-cols-2 gap-3">
                <AdminField label="כותרת">
                  <input
                    value={edition.title}
                    onChange={(e) => update("title", e.target.value)}
                    className={adminInputClass}
                    style={adminInputStyle}
                  />
                </AdminField>
                <AdminField label="תת-כותרת / הקשר">
                  <input
                    value={edition.subtitle ?? ""}
                    onChange={(e) => update("subtitle", e.target.value)}
                    placeholder="לדוגמה: בכריסמס"
                    className={adminInputClass}
                    style={adminInputStyle}
                  />
                </AdminField>
              </div>

              <AdminField label="כתובת תמונה ראשית (URL)">
                <input
                  value={edition.image_url ?? ""}
                  onChange={(e) => update("image_url", e.target.value)}
                  placeholder="https://..."
                  className={adminInputClass}
                  style={adminInputStyle}
                />
              </AdminField>

              <AdminField label="תיאור">
                <textarea
                  value={edition.description ?? ""}
                  onChange={(e) => update("description", e.target.value)}
                  rows={3}
                  className={adminInputClass}
                  style={adminInputStyle}
                />
              </AdminField>

              <AdminField label="מזג אוויר (הערות תצוגה)">
                <input
                  value={edition.weather_notes ?? ""}
                  onChange={(e) => update("weather_notes", e.target.value)}
                  placeholder="לדוגמה: קר וסוער, 2-8 מעלות"
                  className={adminInputClass}
                  style={adminInputStyle}
                />
              </AdminField>

              <div className="grid grid-cols-2 gap-3">
                <AdminField label="סוג טיול">
                  <select
                    value={edition.quick_category}
                    onChange={(e) => update("quick_category", e.target.value as QuickCategoryId)}
                    className={adminInputClass}
                    style={adminInputStyle}
                  >
                    {QUICK_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {QUICK_CATEGORY_LABELS[c.id]}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="סטטוס">
                  <select
                    value={edition.is_published ? "1" : "0"}
                    onChange={(e) => update("is_published", e.target.value === "1")}
                    className={adminInputClass}
                    style={adminInputStyle}
                  >
                    <option value="1">מפורסם</option>
                    <option value="0">טיוטה</option>
                  </select>
                </AdminField>
              </div>
            </DrawerSection>
          </div>

          {/* אטרקציות - מקובצות לפי קטגוריה (Sections ויזואליים, דרישה
              מפורשת #7/#8) - לא רשימה שטוחה אחת. מקומות שלא תואמים אף
              סקשן מוכר של סוג הטיול הזה מופיעים תחת "לא מסווג" - כדי
              שאף אטרקציה משויכת לא "תיעלם" רק כי היא לא תויגה כראוי. */}
          <div className="flex flex-col gap-6">
            {edition &&
              (() => {
                const grouped = DESTINATION_SECTIONS
                  .map((section) => ({ section, items: places.filter((p) => section.matches(p)) }))
                  .filter((g) => g.items.length > 0);
                const groupedIds = new Set(grouped.flatMap((g) => g.items.map((p) => p.id)));
                const unclassified = places.filter((p) => !groupedIds.has(p.id));

                return (
                  <>
                    {grouped.map(({ section, items }) => (
                      <PlaceSection key={section.id} title={`${section.emoji} ${section.title}`} places={items} onUnlink={handleUnlinkPlace} />
                    ))}
                    {unclassified.length > 0 && <PlaceSection title="⚪ לא מסווג" places={unclassified} onUnlink={handleUnlinkPlace} />}
                    {places.length === 0 && (
                      <p className="text-[13px]" style={{ color: "var(--admin-ink-faint)" }}>
                        אין עדיין אטרקציות משויכות ליעד הזה.
                      </p>
                    )}
                  </>
                );
              })()}
          </div>

          {/* הוספת אטרקציה קיימת ממאגר */}
          <div
            className="flex flex-col gap-3 rounded-[var(--admin-radius-lg)] border p-5"
            style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
          >
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
              הוספת אטרקציה קיימת
            </h3>

            <div className="relative">
              <input
                id="attach-existing-search"
                value={attachQuery}
                onChange={(e) => setAttachQuery(e.target.value)}
                placeholder="חיפוש אטרקציה קיימת במאגר להוספה..."
                className={adminInputClass}
                style={adminInputStyle}
              />
              {attachResults.length > 0 && (
                <div
                  className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-[var(--admin-radius-md)] border"
                  style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-md)" }}
                >
                  {attachResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={attaching}
                      onClick={() => handleAttachExisting(p)}
                      className="flex w-full items-center justify-between px-3 py-2 text-right text-[13px] transition hover:opacity-80"
                      style={{ color: "var(--admin-ink)" }}
                    >
                      <span>{p.name}</span>
                      <span style={{ color: "var(--admin-ink-faint)" }}>{p.city ?? ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* הוספה מרובה - "הוספת 20 אטרקציות לפריז בכריסמס" - קוראת
              למנוע ה-AI Discovery הקיים ומקשרת אוטומטית את התוצאות. */}
          <div
            className="flex flex-col gap-3 rounded-[var(--admin-radius-lg)] border p-5"
            style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
          >
            <h3 className="text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
              🤖 הוספה מרובה (AI)
            </h3>
            <p className="text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
              מריץ חיפוש אמיתי מול Google + Claude (אותו מנוע כמו ב-AI Discovery), ומשייך אוטומטית את התוצאות ליעד הזה.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <AdminField label="קטגוריה">
                <select
                  value={bulkBucket}
                  onChange={(e) => setBulkBucket(e.target.value)}
                  className={adminInputClass}
                  style={adminInputStyle}
                >
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="כמות">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={bulkQuantity}
                  onChange={(e) => setBulkQuantity(Number(e.target.value) || 1)}
                  className={adminInputClass}
                  style={adminInputStyle}
                />
              </AdminField>
            </div>

            <AdminField label="הנחיה חופשית (אופציונלי - אחרת נבנה אוטומטית מהכמות+הקטגוריה+היעד)">
              <textarea
                value={bulkFreeText}
                onChange={(e) => setBulkFreeText(e.target.value)}
                rows={2}
                placeholder={`לדוגמה: ${bulkQuantity} אטרקציות מפורסמות ל${edition.title}`}
                className={adminInputClass}
                style={adminInputStyle}
              />
            </AdminField>

            <AdminButton onClick={handleBulkAdd} disabled={bulkRunning}>
              {bulkRunning ? "מריץ חיפוש..." : `הוספת ${bulkQuantity} אטרקציות`}
            </AdminButton>

            {bulkErrors.length > 0 && (
              <div className="rounded-[var(--admin-radius-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--admin-warning-soft)", color: "var(--admin-warning)" }}>
                {bulkErrors.map((e, i) => (
                  <p key={i}>{e}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** סקשן קטגוריה בודד בעמוד יעד - כותרת + גריד כרטיסים ויזואליים (תמונה
 *  גדולה, לא רשימת טקסט) - כל כרטיס לוחצים עליו לעריכה מלאה (Place
 *  Editor הקיים), עם כפתור "הסרה" (הסרת שיוך בלבד, לא מוחק את ה-Place). */
function PlaceSection({ title, places, onUnlink }: { title: string; places: Place[]; onUnlink: (placeId: string) => void | Promise<void> }) {
  return (
    <div>
      <h3 className="mb-3 text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
        {title}
        <span className="mr-2 text-[12px] font-normal" style={{ color: "var(--admin-ink-faint)" }}>
          · {places.length}
        </span>
      </h3>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {places.map((place) => (
          <div key={place.id} className="group relative aspect-[3/4] overflow-hidden rounded-[var(--admin-radius-md)] border" style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-sunken)" }}>
            <Link href={`/admin/places/${place.id}`} className="absolute inset-0">
              {place.image_urls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={place.image_urls[0]} alt={place.name} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: "var(--admin-ink-faint)" }}>
                  🖼️
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2 pt-8">
                <p className="truncate text-[12.5px] font-bold leading-tight text-white">{place.name}</p>
                <p className="truncate text-[10.5px] text-white/75">
                  {place.city ?? getCategoryLabel(place.category)}
                  {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                </p>
              </div>
              {!place.curated && (
                <span
                  className="pointer-events-none absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ background: "var(--admin-bg-surface)", color: "var(--admin-ink-secondary)" }}
                  title="נמצא אוטומטית לפי עיר - לא קושר במפורש"
                >
                  אוטומטי
                </span>
              )}
            </Link>
            {place.curated && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onUnlink(place.id);
                }}
                aria-label="הסר מהיעד"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold opacity-0 transition group-hover:opacity-100"
                style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {/* "+" - דרישה מפורשת #15: אותו גודל/גריד כמו כרטיס Place. עבור
            יעדי חו״ל השיוך האמיתי הוא קישור ל-destination_edition_places
            הספציפי הזה (לא ADMIN_DISCOVERY_SECTIONS - "abroad" לא מוגדר
            שם, ר' DESTINATION_SECTIONS למעלה) - אז ה-+ כאן קופץ לחיפוש
            "הוספת אטרקציה קיימת" הקיים (שכבר מקשר נכון ל-edition הזה),
            במקום לפתוח AddPlaceModal הכללי עם טקסונומיה שלא מתאימה. */}
        <button
          type="button"
          onClick={() => {
            const input = document.getElementById("attach-existing-search") as HTMLInputElement | null;
            input?.scrollIntoView({ behavior: "smooth", block: "center" });
            input?.focus();
          }}
          className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[var(--admin-radius-md)] border-2 border-dashed transition hover:opacity-80"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
        >
          <span className="text-2xl">+</span>
          <span className="px-2 text-center text-[11px] font-medium leading-tight">הוסף ל{title}</span>
        </button>
      </div>
    </div>
  );
}
