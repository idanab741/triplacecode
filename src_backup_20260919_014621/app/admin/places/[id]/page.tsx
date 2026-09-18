"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { AdminField, AdminButton, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { TRIP_TYPE_GROUPS } from "@/services/places/tripTaxonomy";
import { PLACE_CATEGORIES, CATEGORY_TO_SUGGESTED_TRIP_TYPE_TAGS, type PlaceCategoryKey } from "@/constants/placeCategories";
import { CUISINE_TAGS, PLACE_TYPE_TAGS, TRIPMATCH_TAGS, DNA_TAGS } from "@/constants/placeTagOptions";
import { getCategoryLabel } from "@/utils/categoryLabels";

const ADMIN_SECRET_HEADER = "x-admin-secret";

/** אותם 10 מפתחות בדיוק כמו ADMIN_DISCOVERY_SECTIONS.nightlife
 *  (requiredAnyTags) - אלה קובעים אם מקום מופיע בסקשני "חיי לילה"
 *  בפועל. הערכים כבר קיימים ב-PLACE_TYPE_TAGS (place.tags) - לא
 *  טקסונומיה חדשה, רק תת-קבוצה ממוקדת לתצוגה. */
const NIGHTLIFE_TAG_KEYS = ["cocktail_bar", "wine_bar", "club", "live_show", "standup", "theater", "karaoke", "bowling", "snooker", "arcade"];

interface Place {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  neighborhood: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  average_price: number | null;
  entrance_price: number | null;
  estimated_visit_minutes: number | null;
  recommended_hours: string | null;
  requires_reservation: boolean | null;
  popularity_level: string | null;
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
  place_type_key: string | null;
  audience_fit: string[] | null;
  dna_tags: string[] | null;
  weather_fit: string[] | null;
  accessibility_features: string[] | null;
  pet_friendliness_features: string[] | null;
  type_attributes: Record<string, unknown> | null;
}

interface FieldDef {
  id: string;
  place_type: string;
  field_key: string;
  label_he: string;
  field_type: "number" | "text" | "boolean" | "single_select" | "multi_select";
  options: { value: string; label_he: string }[] | null;
}

const TABS = [
  { key: "general", label: "מידע כללי" },
  { key: "categories", label: "קטגוריות" },
  { key: "matching", label: "התאמות" },
  { key: "ai", label: "AI" },
  { key: "images", label: "תמונות" },
  { key: "location", label: "מיקום" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** Workspace מלא לעריכת מקום בודד - טאבים, לא Drawer שטוח. תבנית ראשונה
 *  (מודול "מסעדות ובתי קפה") - תשוכפל לשאר 7 המודולים אחרי אישור. */
export default function PlaceWorkspacePage() {
  const { secret: adminSecret } = useAdminSecret();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [place, setPlace] = useState<Place | null>(null);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [tab, setTab] = useState<TabKey>("general");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [enrichMessage, setEnrichMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!adminSecret || !id) return;
    fetch(`/api/admin/places/${id}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPlace(data.place);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת המקום"));
  }, [adminSecret, id]);

  useEffect(() => {
    if (!adminSecret || !place?.place_type_key) return;
    fetch(`/api/admin/place-type-fields?place_type=${place.place_type_key}`, {
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    })
      .then((res) => res.json())
      .then((data) => setFieldDefs(data.fieldDefs ?? []))
      .catch(() => setFieldDefs([]));
  }, [adminSecret, place?.place_type_key]);

  function update<K extends keyof Place>(key: K, value: Place[K]) {
    setPlace((p) => (p ? { ...p, [key]: value } : p));
  }

  async function handleSave() {
    if (!place) return;
    setSaving(true);
    setError(null);
    try {
      const { id: placeId, ...rest } = place;
      const res = await fetch(`/api/admin/places/${placeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify(rest),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlace(data.place);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  const [aiScoring, setAiScoring] = useState(false);

  /** אותה קריאה בדיוק ל-suggest-scores כמו כפתור "מלא עם AI" בעמוד
   *  ה-Discovery - ההבדל היחיד הוא שכאן היא זמינה גם *אחרי* שהמקום כבר
   *  נוצר ונשמר, ישירות מתוך כרטיסיית המקום. שומרת ישירות ל-DB (לא רק
   *  טופס מקומי) ואז מרעננת את הטופס עם התוצאה. */
  async function handleAiFillScores() {
    if (!place) return;
    setAiScoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/places/${place.id}/suggest-scores`, {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "השלמת AI נכשלה");
      setPlace(data.place);
    } catch (e) {
      setError(e instanceof Error ? e.message : "השלמת AI נכשלה");
    } finally {
      setAiScoring(false);
    }
  }

  function toggleScore(scoreField: "tripmatch_scores" | "dna_scores", tagKey: string) {
    if (!place) return;
    const current = place[scoreField] ?? {};
    const isOn = (current[tagKey] ?? 0) > 0;
    const next = { ...current };
    if (isOn) delete next[tagKey];
    else next[tagKey] = 100;
    update(scoreField, next);
  }

  function toggleArrayTag(field: "tags" | "cuisine_tags", tagKey: string) {
    if (!place) return;
    const current = place[field] ?? [];
    const next = current.includes(tagKey) ? current.filter((t) => t !== tagKey) : [...current, tagKey];
    update(field, next);
  }

  async function handleAiComplete() {
    if (!place) return;
    setAiSuggesting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/places/${place.id}/suggest-tags`, {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "השלמת AI נכשלה");
      // ה-AI לעולם לא שומר לבד - רק ממלא את הטופס המקומי. עדיין צריך
      // ללחוץ "שמור שינויים" למעלה כדי לאשר ולפרסם בפועל.
      const s = data.suggestion;
      setPlace((p) =>
        p
          ? {
              ...p,
              trip_type_tags: s.trip_type_tags ?? p.trip_type_tags,
              cuisine_tags: s.cuisine_tags ?? p.cuisine_tags,
              kosher: s.kosher ?? p.kosher,
              accessible: s.accessible ?? p.accessible,
              seasons: s.seasons ?? p.seasons,
              suitable_child_ages: s.suitable_child_ages ?? p.suitable_child_ages,
              budget_tier: s.budget_tier ?? p.budget_tier,
            }
          : p
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "השלמת AI נכשלה");
    } finally {
      setAiSuggesting(false);
    }
  }

  /** "השלם עם Google" - ר' דרישה מפורשת. שומר ישירות בשרת (לא רק
   *  ממלא טופס מקומי) - כי זה תואם למקור נתונים חיצוני אמיתי, לא
   *  הצעה ל-AI שדורשת אישור אנושי. */
  async function handleEnrichFromGoogle() {
    if (!place) return;
    setEnriching(true);
    setError(null);
    setEnrichMessage(null);
    try {
      const res = await fetch(`/api/admin/places/${place.id}/enrich-from-google`, {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "השלמה מ-Google נכשלה");
      setPlace(data.place);
      setEnrichMessage(data.filledFields.length > 0 ? `הושלמו: ${data.filledFields.join(", ")}` : data.message ?? "לא נמצא מידע חדש");
    } catch (e) {
      setError(e instanceof Error ? e.message : "השלמה מ-Google נכשלה");
    } finally {
      setEnriching(false);
    }
  }

  /** העלאת קובץ תמונה ישירות (לא רק URL - ר' דרישה מפורשת). מעלה
   *  ל-Storage ומכניסה את ה-URL שחוזר ל-*תחילת* image_urls המקומי -
   *  כלומר מחליפה את התמונה הראשית/"ראשית" הקיימת (בקשה מפורשת:
   *  תמונה חדשה שמועלית צריכה להחליף את התמונה שמוצגת באפליקציה),
   *  במקום רק להתווסף לסוף הרשימה. תמונות קודמות לא נמחקות - הן
   *  זזות אחורה ברשימה - עדיין צריך "שמירה" כדי לפרסם. */
  async function handleUploadImage(file: File) {
    if (!place) return;
    setUploadingImage(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/admin/places/${place.id}/upload-image`, {
        method: "POST",
        headers: { [ADMIN_SECRET_HEADER]: adminSecret },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "העלאת התמונה נכשלה");
      update("image_urls", [data.url, ...place.image_urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setUploadingImage(false);
    }
  }

  const completenessChecks = place
    ? [
        { label: "תיאור קצר", ok: !!place.short_description },
        { label: "טלפון", ok: !!place.phone },
        { label: "אתר", ok: !!place.website },
        { label: "שעות פעילות", ok: !!(place.opening_hours && place.opening_hours.length > 0) },
        { label: "רמת מחיר", ok: !!place.price_level || place.average_price != null },
        { label: "נגישות", ok: place.accessible !== null },
        { label: "תמונה", ok: place.image_urls.length > 0 },
      ]
    : [];
  const missingCount = completenessChecks.filter((c) => !c.ok).length;

  if (error && !place) {
    return (
      <div className="p-6">
        <p className="text-[13.5px] text-red-600">{error}</p>
        <Link href="/admin/places" className="mt-3 inline-block text-[13.5px]" style={{ color: "var(--admin-accent)" }}>
          → חזרה לרשימת המקומות
        </Link>
      </div>
    );
  }

  if (!place) {
    return <p className="p-6 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>טוען...</p>;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--admin-border)" }}>
        <div>
          <button
            type="button"
            onClick={() => router.push("/admin/places")}
            className="mb-1 text-[12.5px]"
            style={{ color: "var(--admin-ink-secondary)" }}
          >
            → כל המקומות
          </button>
          <h1 className="text-[19px] font-semibold" style={{ color: "var(--admin-ink)" }}>
            {place.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && Date.now() - savedAt < 3000 && (
            <span className="text-[12.5px]" style={{ color: "var(--admin-success, #16A34A)" }}>
              ✓ נשמר
            </span>
          )}
          {error && <span className="text-[12.5px] text-red-600">{error}</span>}
          <AdminButton onClick={handleSave} disabled={saving}>
            {saving ? "שומר..." : "שמור שינויים"}
          </AdminButton>
        </div>
      </div>

      {/* Tabs + Content (רחב) + Preview חי (צר, קבוע) - הדרישה המפורשת:
          "Place Preview שמבוסס על איך שהמקום מופיע באפליקציה", בלי
          לוותר על עריכה - אז זה עמודה קבועה לצד הטאבים, לא מסך נפרד. */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-1 border-b px-6" style={{ borderColor: "var(--admin-border)" }}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="px-3 py-2.5 text-[13.5px] font-medium transition"
                style={{
                  color: tab === t.key ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
                  borderBottom: tab === t.key ? "2px solid var(--admin-accent)" : "2px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="admin-scrollbar flex-1 overflow-y-auto p-6">
            {tab === "general" && (
          <div className="flex max-w-2xl flex-col gap-5">
            {/* דשבורד השלמת מידע + "השלם עם Google" - דרישה מפורשת:
                "מה לא מופיע, אני רוצה כפתור השלם עם גוגל שיופיע בעמוד
                הראשי (עם דשבורד שנדע מה חסר כמה חסר ואיפה)". */}
            <div className="rounded-[var(--admin-radius-lg)] border p-4" style={{ borderColor: missingCount > 0 ? "var(--admin-warning)" : "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[13.5px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                    השלמת מידע: {completenessChecks.length - missingCount}/{completenessChecks.length}
                  </p>
                  {missingCount > 0 && (
                    <p className="mt-0.5 text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                      חסר: {completenessChecks.filter((c) => !c.ok).map((c) => c.label).join(", ")}
                    </p>
                  )}
                </div>
                {missingCount > 0 && (
                  <AdminButton onClick={handleEnrichFromGoogle} disabled={enriching}>
                    {enriching ? "בודק ב-Google..." : "🔍 השלם עם Google"}
                  </AdminButton>
                )}
              </div>
              {enrichMessage && (
                <p className="mt-2 text-[12px]" style={{ color: "var(--admin-accent)" }}>
                  {enrichMessage}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {completenessChecks.map((c) => (
                  <span
                    key={c.label}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                    style={{
                      background: c.ok ? "var(--admin-success-soft)" : "var(--admin-bg-sunken)",
                      color: c.ok ? "var(--admin-success)" : "var(--admin-ink-faint)",
                    }}
                  >
                    {c.ok ? "✓" : "○"} {c.label}
                  </span>
                ))}
              </div>
            </div>

            {/* מיקום בקטגוריה - "לכל אטרקציה אפשרות לבחור קטגוריית על
                וקטגוריית משנה, שנדע איפה היא צריכה להופיע" - הועבר
                לעמוד הראשי (דרישה מפורשת - לא רק בטאב "קטגוריות" נפרד).
                *** תיקון (באג אמיתי, שוב - "איפה כל הקטגוריות של
                המסעדות???"): לא הספיק להפנות לטאב אחר - "מסעדות"
                (ו"חיי לילה") פשוט **לא** מסווגות דרך TRIP_TYPE_GROUPS/
                subcategory בכלל, אלא דרך טקסונומיה נפרדת לגמרי:
                מסעדות → cuisine_tags (CUISINE_TAGS - ישראלי/איטלקי/
                אסייתי/בשרים...), חיי לילה → tags (בר קוקטיילים/מועדון/
                הופעה חיה...) - שתיהן קיימות במערכת (לא טקסונומיה
                חדשה), פשוט היו בטאב אחר. עכשיו הפיקר הנכון מוצג *כאן*,
                לפי הקטגוריה שנבחרה - זה מה שקובע בפועל אם המקום מופיע
                בסקשן "🥢 אסייתי" וכו'. TRIP_TYPE_GROUPS (הכללי) עדיין
                נשאר זמין למטה בשביל שיוך ל"טיול יומי"/"חופשה בארץ"
                וכו' - שתי השכבות פועלות במקביל, לא סותרות. */}
            <div className="flex flex-col gap-4 rounded-[var(--admin-radius-lg)] border p-4" style={{ borderColor: "var(--admin-border)" }}>
              <div className="text-[11.5px] font-bold uppercase tracking-wide" style={{ color: "var(--admin-ink-secondary)" }}>
                מיקום בקטגוריה - קובע באיזה חלק באפליקציה זה יופיע
              </div>

              <AdminField label="קטגוריית-על">
                <select
                  className={adminInputClass}
                  style={{ ...adminInputStyle, maxWidth: 260 }}
                  value={place.category}
                  onChange={(e) => {
                    const nextCategory = e.target.value as PlaceCategoryKey;
                    setPlace((p) => {
                      if (!p) return p;
                      const suggested = CATEGORY_TO_SUGGESTED_TRIP_TYPE_TAGS[nextCategory] ?? [];
                      const shouldAutoFill = p.trip_type_tags.length === 0 && suggested.length > 0;
                      return { ...p, category: nextCategory, trip_type_tags: shouldAutoFill ? [suggested[0]] : p.trip_type_tags };
                    });
                  }}
                >
                  {PLACE_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </AdminField>

              {/* מסעדות: הפיקר האמיתי הוא מטבח (cuisine_tags), לא subcategory כללי */}
              {place.category === "restaurants" && (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    סגנון מטבח - קובע איפה זה יופיע בסקשני מסעדות (למשל &quot;🥢 אסייתי&quot;)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {CUISINE_TAGS.map((t) => {
                      const active = place.cuisine_tags?.includes(t.key) ?? false;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => toggleArrayTag("cuisine_tags", t.key)}
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
              )}

              {/* חיי לילה: הפיקר האמיתי הוא tags ייעודיים, לא subcategory כללי */}
              {place.category === "nightlife" && (
                <div>
                  <p className="mb-1.5 text-[12px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                    סוג בילוי - קובע איפה זה יופיע בסקשני חיי לילה (למשל &quot;🍸 בר קוקטיילים&quot;)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACE_TYPE_TAGS.filter((t) => NIGHTLIFE_TAG_KEYS.includes(t.key)).map((t) => {
                      const active = place.tags?.includes(t.key) ?? false;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => toggleArrayTag("tags", t.key)}
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
              )}

              <div>
                <p className="mb-1.5 text-[12px] font-medium" style={{ color: "var(--admin-ink-secondary)" }}>
                  סוג/י טיול שהמקום שייך אליהם (trip_type_tags) - קובע איפה הוא יופיע בדפי היעדים (יומי/חופשה בארץ/וכו&apos;)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TRIP_TYPE_GROUPS.map((g) => {
                    const active = place.trip_type_tags.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          const next = active ? place.trip_type_tags.filter((t) => t !== g.id) : [...place.trip_type_tags, g.id];
                          update("trip_type_tags", next);
                          // אם הוסרה הקבוצה היחידה שממנה ה-subcategory הנוכחי הגיע - מנקים,
                          // כדי לא להשאיר subcategory "יתום" שלא שייך לאף קבוצה נבחרת יותר.
                          if (!active) return;
                          const stillValid = next.some((tId) => TRIP_TYPE_GROUPS.find((tg) => tg.id === tId)?.subTags.some((s) => s.id === place.subcategory));
                          if (place.subcategory && !stillValid) update("subcategory", "");
                        }}
                        className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition"
                        style={{
                          borderColor: active ? "var(--admin-accent)" : "var(--admin-border)",
                          background: active ? "var(--admin-accent-soft)" : "var(--admin-bg-surface)",
                          color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
                        }}
                      >
                        {g.emoji} {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <AdminField label="קטגוריית-משנה (מדויקת - רק מהקבוצות שנבחרו למעלה)">
                <input
                  list="subcategory-options-main"
                  className={adminInputClass}
                  style={adminInputStyle}
                  value={place.subcategory ?? ""}
                  onChange={(e) => update("subcategory", e.target.value)}
                  disabled={place.trip_type_tags.length === 0}
                  placeholder={place.trip_type_tags.length === 0 ? "בחרו קודם לפחות סוג טיול אחד למעלה" : ""}
                />
                <datalist id="subcategory-options-main">
                  {TRIP_TYPE_GROUPS.filter((g) => place.trip_type_tags.includes(g.id))
                    .flatMap((g) => g.subTags)
                    .map((s) => (
                      <option key={s.id} value={s.id} label={s.label} />
                    ))}
                </datalist>
              </AdminField>
            </div>

            <div className="grid grid-cols-2 gap-4">
            <AdminField label="שם המקום">
              <input className={adminInputClass} style={adminInputStyle} value={place.name} onChange={(e) => update("name", e.target.value)} />
            </AdminField>
            <AdminField label="עיר">
              <input className={adminInputClass} style={adminInputStyle} value={place.city ?? ""} onChange={(e) => update("city", e.target.value)} />
            </AdminField>
            <AdminField label="מדינה">
              <input className={adminInputClass} style={adminInputStyle} value={place.country ?? ""} onChange={(e) => update("country", e.target.value)} />
            </AdminField>
            <AdminField label="שכונה/אזור">
              <input className={adminInputClass} style={adminInputStyle} value={place.neighborhood ?? ""} onChange={(e) => update("neighborhood", e.target.value)} />
            </AdminField>
            <div className="col-span-2">
              <AdminField label="כתובת מלאה">
                <input className={adminInputClass} style={adminInputStyle} value={place.address ?? ""} onChange={(e) => update("address", e.target.value)} />
              </AdminField>
            </div>
            <div className="col-span-2">
              <AdminField label="תיאור קצר">
                <textarea
                  className={adminInputClass}
                  style={{ ...adminInputStyle, minHeight: 70 }}
                  value={place.short_description ?? ""}
                  onChange={(e) => update("short_description", e.target.value)}
                />
              </AdminField>
            </div>
            <AdminField label="טלפון">
              <input className={adminInputClass} style={adminInputStyle} value={place.phone ?? ""} onChange={(e) => update("phone", e.target.value)} />
            </AdminField>
            <AdminField label="אתר">
              <input className={adminInputClass} style={adminInputStyle} value={place.website ?? ""} onChange={(e) => update("website", e.target.value)} />
            </AdminField>
            <AdminField label="דירוג">
              <input
                type="number"
                step="0.1"
                className={adminInputClass}
                style={adminInputStyle}
                value={place.rating ?? ""}
                onChange={(e) => update("rating", e.target.value ? Number(e.target.value) : null)}
              />
            </AdminField>
            <AdminField label="מספר ביקורות">
              <input
                type="number"
                className={adminInputClass}
                style={adminInputStyle}
                value={place.rating_count ?? ""}
                onChange={(e) => update("rating_count", e.target.value ? Number(e.target.value) : null)}
              />
            </AdminField>
            <AdminField label="מחיר ממוצע (₪)">
              <input
                type="number"
                className={adminInputClass}
                style={adminInputStyle}
                value={place.average_price ?? ""}
                onChange={(e) => update("average_price", e.target.value ? Number(e.target.value) : null)}
              />
            </AdminField>
            <AdminField label="מחיר כניסה (₪)">
              <input
                type="number"
                className={adminInputClass}
                style={adminInputStyle}
                value={place.entrance_price ?? ""}
                onChange={(e) => update("entrance_price", e.target.value ? Number(e.target.value) : null)}
              />
            </AdminField>
            <AdminField label="שעות מומלצות">
              <input className={adminInputClass} style={adminInputStyle} value={place.recommended_hours ?? ""} onChange={(e) => update("recommended_hours", e.target.value)} />
            </AdminField>
            <AdminField label="דורש הזמנה מראש">
              <select
                className={adminInputClass}
                style={adminInputStyle}
                value={place.requires_reservation === null ? "" : String(place.requires_reservation)}
                onChange={(e) => update("requires_reservation", e.target.value === "" ? null : e.target.value === "true")}
              >
                <option value="">לא ידוע</option>
                <option value="true">כן</option>
                <option value="false">לא</option>
              </select>
            </AdminField>
            </div>
          </div>
        )}

        {tab === "categories" && (
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <p className="col-span-2 rounded-[var(--admin-radius-sm)] p-3 text-[12.5px]" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-secondary)" }}>
              קטגוריית-על, סוגי טיול וקטגוריית-משנה עברו לעמוד &quot;מידע כללי&quot; הראשי - כאן נשארו רק תיוגים נוספים (מטבח, סוג מקום).
            </p>
            <div className="col-span-2">
              <AdminField label="סוג יעד (place_type_key) - קובע אילו שדות AI מוצגים בטאב AI">
                <input className={adminInputClass} style={adminInputStyle} value={place.place_type_key ?? ""} onChange={(e) => update("place_type_key", e.target.value)} />
              </AdminField>
            </div>
            <div className="col-span-2">
              {(() => {
                const suggested = CATEGORY_TO_SUGGESTED_TRIP_TYPE_TAGS[place.category as PlaceCategoryKey] ?? [];
                if (suggested.length === 0) return null;
                const hasMatch = suggested.some((tag) => place.trip_type_tags.includes(tag));
                if (hasMatch) return null;
                return (
                  <p className="col-span-2 mt-1 text-sm text-red-500">
                    ⚠️ קטגוריה ראשית "{PLACE_CATEGORIES.find((c) => c.key === place.category)?.label}" בדרך כלל
                    צריכה לפחות אחת מהתגיות הבאות ב-trip_type_tags כדי שהמקום יופיע בחיפוש בפועל בבניית הטיול:{" "}
                    <strong>{suggested.join(", ")}</strong>. ללא זה, המקום לא יוחזר כמועמד גם אם הוא הכי קרוב/מתאים.{" "}
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        setPlace((p) => (p ? { ...p, trip_type_tags: Array.from(new Set([...p.trip_type_tags, suggested[0]])) } : p))
                      }
                    >
                      הוסף אוטומטית את "{suggested[0]}"
                    </button>
                  </p>
                );
              })()}
            </div>

            {/* אותה בדיוק רשימת "קטגוריה/סוג מקום" ו"מטבח" כמו בעמוד
                Discovery - לפני התיקון היו כאן רק שדות טקסט חופשי, בלי
                שום קשר לרשימות שמוצגות שם, אז המידע היה לא-עקבי בין
                המסכים. עכשיו שני העמודים מייבאים מאותו קובץ קבועים. */}
            <div className="col-span-2">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--admin-ink-secondary)" }}>
                קטגוריה / סוג מקום (tags)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLACE_TYPE_TAGS.map((t) => {
                  const active = place.tags?.includes(t.key) ?? false;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleArrayTag("tags", t.key)}
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
            <div className="col-span-2">
              <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--admin-ink-secondary)" }}>
                מטבח / סגנון קולינרי (cuisine_tags)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CUISINE_TAGS.map((t) => {
                  const active = place.cuisine_tags?.includes(t.key) ?? false;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleArrayTag("cuisine_tags", t.key)}
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
          </div>
        )}

        {tab === "matching" && (
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <AdminField label="כשר">
              <select
                className={adminInputClass}
                style={adminInputStyle}
                value={place.kosher === null ? "" : String(place.kosher)}
                onChange={(e) => update("kosher", e.target.value === "" ? null : e.target.value === "true")}
              >
                <option value="">לא ידוע</option>
                <option value="true">כן</option>
                <option value="false">לא</option>
              </select>
            </AdminField>
            <AdminField label="נגיש">
              <select
                className={adminInputClass}
                style={adminInputStyle}
                value={place.accessible === null ? "" : String(place.accessible)}
                onChange={(e) => update("accessible", e.target.value === "" ? null : e.target.value === "true")}
              >
                <option value="">לא ידוע</option>
                <option value="true">כן</option>
                <option value="false">לא</option>
              </select>
            </AdminField>
            <AdminField label="רמת תקציב">
              <input className={adminInputClass} style={adminInputStyle} value={place.budget_tier ?? ""} onChange={(e) => update("budget_tier", e.target.value)} />
            </AdminField>
            <AdminField label="רמת פופולריות">
              <input className={adminInputClass} style={adminInputStyle} value={place.popularity_level ?? ""} onChange={(e) => update("popularity_level", e.target.value)} />
            </AdminField>
            <div className="col-span-2">
              <AdminField label="גילאי ילדים מתאימים (מופרד בפסיקים)">
                <input
                  className={adminInputClass}
                  style={adminInputStyle}
                  value={place.suitable_child_ages.join(", ")}
                  onChange={(e) => update("suitable_child_ages", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                />
              </AdminField>
            </div>
            <div className="col-span-2">
              <AdminField label="עונות מתאימות (מופרד בפסיקים)">
                <input
                  className={adminInputClass}
                  style={adminInputStyle}
                  value={place.seasons.join(", ")}
                  onChange={(e) => update("seasons", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                />
              </AdminField>
            </div>

            <div className="col-span-2 mt-2 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--admin-border)" }}>
              <p className="text-[13px] font-medium" style={{ color: "var(--admin-ink)" }}>
                ✨ ציוני התאמה (TripMatch / DNA)
              </p>
              <AdminButton variant="secondary" onClick={handleAiFillScores} disabled={aiScoring}>
                {aiScoring ? "מנתח..." : "✨ מלא עם AI"}
              </AdminButton>
            </div>
            <div className="col-span-2 flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "#548235" }}>
                  TripMatch
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {TRIPMATCH_TAGS.map((t) => {
                    const active = (place.tripmatch_scores?.[t.key] ?? 0) > 0;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleScore("tripmatch_scores", t.key)}
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
                  DNA
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DNA_TAGS.map((t) => {
                    const active = (place.dna_scores?.[t.key] ?? 0) > 0;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => toggleScore("dna_scores", t.key)}
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
              <p className="text-[11px]" style={{ color: "var(--admin-ink-secondary)" }}>
                לחיצה על תגית משנה את הציון מקומית בטופס בלבד - יש ללחוץ &quot;שמור שינויים&quot; למעלה כדי לפרסם.
                כפתור &quot;מלא עם AI&quot; לעומת זאת שומר ישירות (בדיוק כמו בעמוד ה-Discovery).
              </p>
            </div>
          </div>
        )}

        {tab === "ai" && (
          <div className="flex max-w-2xl flex-col gap-4">
            <div
              className="flex items-center justify-between rounded-[var(--admin-radius-lg)] border p-4"
              style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
            >
              <div>
                <p className="text-[14px] font-medium" style={{ color: "var(--admin-ink)" }}>
                  ✨ השלמת תגיות עם AI
                </p>
                <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
                  Claude ינתח את שם/תיאור המקום וישלים תגיות (טיול, מטבח, DNA) - תמיד יוצג לך לפני שמירה, לא נשמר אוטומטית.
                </p>
              </div>
              <AdminButton onClick={handleAiComplete} disabled={aiSuggesting}>
                {aiSuggesting ? "מנתח..." : "✨ השלם עם AI"}
              </AdminButton>
            </div>

            {fieldDefs.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {fieldDefs.map((fd) => (
                  <AdminField key={fd.id} label={fd.label_he}>
                    <input
                      className={adminInputClass}
                      style={adminInputStyle}
                      value={String((place.type_attributes ?? {})[fd.field_key] ?? "")}
                      onChange={(e) =>
                        update("type_attributes", { ...(place.type_attributes ?? {}), [fd.field_key]: e.target.value })
                      }
                    />
                  </AdminField>
                ))}
              </div>
            ) : (
              <p className="text-[13px]" style={{ color: "var(--admin-ink-secondary)" }}>
                {place.place_type_key
                  ? "אין שדות ייעודיים מוגדרים לסוג היעד הזה עדיין - הגדר ב-/admin/place-type-fields"
                  : "יש להגדיר קודם place_type_key בטאב קטגוריות כדי לראות שדות ייעודיים"}
              </p>
            )}
          </div>
        )}

        {tab === "images" && (
          <div className="max-w-2xl">
            <div className="grid grid-cols-3 gap-3">
              {place.image_urls.map((url, i) => (
                <div key={i} className="group relative overflow-hidden rounded-[var(--admin-radius-md)] border" style={{ borderColor: "var(--admin-border)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-32 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => update("image_urls", place.image_urls.filter((_, idx) => idx !== i))}
                    className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                  >
                    ✕
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">ראשית</span>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <AdminField label="הוסף תמונה (URL)">
                <div className="flex gap-2">
                  <input
                    id="new-image-url"
                    className={adminInputClass}
                    style={adminInputStyle}
                    placeholder="https://..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          update("image_urls", [val, ...place.image_urls]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                  <AdminButton
                    variant="secondary"
                    onClick={() => {
                      const input = document.getElementById("new-image-url") as HTMLInputElement;
                      const val = input?.value.trim();
                      if (val) {
                        update("image_urls", [val, ...place.image_urls]);
                        input.value = "";
                      }
                    }}
                  >
                    הוסף
                  </AdminButton>
                </div>
              </AdminField>

              {/* *** תוספת (דרישה מפורשת - "אין אפשרות להוסיף תמונה,
                  צריך שיהיה אפשר גם קובץ"): העלאת קובץ ישירה, לא רק URL -
                  ל-Storage הקיים (place-images, אותו bucket שגוגל כבר
                  משתמש בו). */}
              <AdminField label="או העלאת קובץ (JPG/PNG/WEBP, עד 8MB)">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploadingImage}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file);
                    e.target.value = "";
                  }}
                  className={adminInputClass}
                  style={adminInputStyle}
                />
                {uploadingImage && (
                  <p className="mt-1 text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
                    מעלה...
                  </p>
                )}
              </AdminField>
            </div>
          </div>
        )}

        {tab === "location" && (
          <div className="grid max-w-2xl grid-cols-2 gap-4">
            <AdminField label="קו רוחב (latitude)">
              <input
                type="number"
                step="0.000001"
                className={adminInputClass}
                style={adminInputStyle}
                value={place.latitude ?? ""}
                onChange={(e) => update("latitude", e.target.value ? Number(e.target.value) : null)}
              />
            </AdminField>
            <AdminField label="קו אורך (longitude)">
              <input
                type="number"
                step="0.000001"
                className={adminInputClass}
                style={adminInputStyle}
                value={place.longitude ?? ""}
                onChange={(e) => update("longitude", e.target.value ? Number(e.target.value) : null)}
              />
            </AdminField>
            {place.latitude && place.longitude && (
              <div className="col-span-2 overflow-hidden rounded-[var(--admin-radius-md)] border" style={{ borderColor: "var(--admin-border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/places/static-map?lat=${place.latitude}&lng=${place.longitude}`}
                  alt="מפה"
                  className="h-48 w-full object-cover"
                />
              </div>
            )}
          </div>
        )}
          </div>
        </div>

        {/* עמודת Preview - קבועה, חיה (מתעדכנת מיד עם כל שינוי בטפסים
            משמאל), בלי scroll עצמאי מעבר לתוכן שלה. */}
        <div className="admin-scrollbar w-[360px] shrink-0 overflow-y-auto border-r p-5" style={{ borderColor: "var(--admin-border)" }}>
          <PlaceAppPreview place={place} />
        </div>
      </div>
    </div>
  );
}

/**
 * Preview חי - בדיוק מבנה ה-HERO/דירוג/שם/תיאור/כתובת/צ'יפים של מסך
 * האטרקציה האמיתי באפליקציה (ר' src/app/place/[id]/page.tsx) - לא
 * המצאה חדשה. צ'יפי הקטגוריה נבנים באותה שיטה בדיוק: category +
 * trip_type_tags + cuisine_tags + tags, מכופלים ומתורגמים דרך
 * getCategoryLabel - מקור האמת היחיד למה שהמשתמש רואה בפועל.
 */
function PlaceAppPreview({ place }: { place: Place }) {
  const categoryChips = Array.from(
    new Set(
      [getCategoryLabel(place.category), ...(place.trip_type_tags ?? []), ...(place.cuisine_tags ?? []), ...(place.tags ?? [])]
        .filter((v): v is string => !!v)
        .map((v) => getCategoryLabel(v))
    )
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-faint)" }}>
        תצוגה מקדימה - כך זה נראה באפליקציה
      </p>
      <div className="overflow-hidden rounded-[var(--admin-radius-lg)] border" style={{ borderColor: "var(--admin-border)", background: "#ffffff" }}>
        <div className="relative h-40 w-full bg-gray-100">
          {place.image_urls?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.image_urls[0]} alt={place.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl text-gray-300">🖼️</div>
          )}
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">
          {place.rating != null && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
              <span className="text-amber-500">★</span>
              <span>{place.rating.toFixed(1)}</span>
              {place.rating_count != null && <span className="font-normal text-gray-400">({place.rating_count})</span>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-extrabold text-gray-900">{place.name || "ללא שם"}</h2>
            {place.short_description && <p className="text-[13px] leading-relaxed text-gray-500">{place.short_description}</p>}
            {(place.address || place.city) && <p className="text-[12.5px] text-gray-500">{[place.address, place.city].filter(Boolean).join(" · ")}</p>}
          </div>

          {categoryChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {categoryChips.slice(0, 8).map((chip) => (
                <span key={chip} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-500">
                  {chip}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1.5 border-t pt-3 text-[12.5px] text-gray-500" style={{ borderColor: "#eee" }}>
            {place.phone && <p>📞 {place.phone}</p>}
            {place.website && (
              <p className="truncate">
                🌐{" "}
                <a href={place.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {place.website}
                </a>
              </p>
            )}
            {place.opening_hours && place.opening_hours.length > 0 && <p>🕒 {place.opening_hours[0]}</p>}
            {(place.price_level != null || place.average_price != null) && (
              <p>💰 {place.average_price != null ? `₪${place.average_price} בממוצע` : "₪".repeat(place.price_level ?? 1)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
