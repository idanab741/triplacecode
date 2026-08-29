"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { QUICK_CATEGORIES, type QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { ADMIN_DISCOVERY_SECTIONS } from "@/constants/adminDiscoverySections";
import { WORLDWIDE_VACATION_CATEGORIES, WORLDWIDE_DESTINATION_REGISTRY } from "@/constants/worldwideVacationCategories";
import { ISRAEL_VACATION_DESTINATIONS } from "@/constants/israelVacationDestinations";

const ADMIN_SECRET_HEADER = "x-admin-secret";

/** קורא Response ומפרסר JSON בזהירות - קודם כטקסט גולמי, ורק אז
 *  מנסה JSON.parse. תגובה ריקה/לא-JSON (שרת שקרס, timeout, HTML
 *  שגיאה) הייתה גורמת ל-"Unexpected end of JSON input" קריפטי -
 *  עכשיו השגיאה כוללת את קוד הסטטוס ותחילת הטקסט האמיתי שחזר, כדי
 *  שאפשר יהיה לדעת בפועל מה השתבש בצד השרת. */
async function parseJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) {
    throw new Error(`השרת החזיר תגובה ריקה (סטטוס ${res.status}) - כנראה קריסה בצד השרת, בדקו את לוג השרת.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`השרת החזיר תגובה שאינה JSON (סטטוס ${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * מנגנון אחיד לכל 7 סוגי הטיול (בקשה מפורשת - "המנגנון צריך להיות
 * אחיד בכל העמודים"): לכל טאב יש רשימת "פילים" (תת-קטגוריות) שמוצגת
 * למעלה, ומתחתיה גריד מסונן לפיל שנבחר - בדיוק כמו שכבר עבד ב"מסעדות
 * וקפה"/"טיול יומי". שני מקורות פילים אפשריים בלבד:
 * - "curated": "חו״ל" בלבד - הפילים הם 16 קטגוריות היעדים הרשמיות
 *   (WORLDWIDE_VACATION_CATEGORIES), הגריד מציג destination_editions.
 * - "sections": כל שאר 6 הסוגים (כולל "חופשה בארץ" - יש לה סקשנים
 *   אמיתיים משלה ב-vacation-il/route.ts, לא רק קרוסלת 9 הערים) -
 *   הפילים הם ADMIN_DISCOVERY_SECTIONS, הגריד מציג אטרקציות חיות.
 */
/**
 * *** תיקון (בקשה מפורשת - "חופשה בארץ" צריכה מבנה Trip Type → Destinations
 * → Destination → Categories → Places, בדיוק כמו "טיול בחו״ל" - לא
 * מבנה שטוח של קטגוריות בלבד): "weekend" קיבל עד כה mode="sections"
 * (בדיוק כמו day_trip/nature_trip/וכו') - בלי שכבת יעדים בכלל. עכשיו
 * "weekend" מקבל mode="domestic" משלו: 9 היעדים הקבועים
 * (ISRAEL_VACATION_DESTINATIONS, אותה רשימה בדיוק שהאפליקציה עצמה
 * משתמשת בה ב-destination/[slug]/page.tsx) מוצגים כ-Destination Cards,
 * ולחיצה על יעד פותחת עמוד יעד עם סקשני קטגוריה חיים (ר'
 * /admin/place-console/domestic/[slug]) - בדיוק מבנה A, בלי DB חדש
 * (אין "edition" לייבא/ליצור - זו רשימה סטטית + שאילתת רדיוס חיה,
 * אותו מנגנון בדיוק שהאפליקציה כבר משתמשת בו לחופשה בארץ).
 */
type Mode = "curated" | "domestic" | "sections";

function modeOf(category: QuickCategoryId): Mode {
  if (category === "abroad") return "curated";
  if (category === "weekend") return "domestic";
  return "sections";
}

interface DestinationRef {
  id: string;
  name: string;
  country: string | null;
}

interface Edition {
  id: string;
  destination_id: string;
  quick_category: QuickCategoryId;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  group_label: string | null;
  is_published: boolean;
  placesCount: number;
  destinations: DestinationRef | null;
}

interface SectionPlace {
  id: string;
  name: string;
  city: string | null;
  category: string;
  subcategory: string | null;
  imageUrls: string[];
  rating: number | null;
}

/** הפילים של "חו״ל" - אותו מפתח בדיוק (emoji+title) שנשמר כ-group_label
 *  בעת הייבוא (import-curated route), כדי שהסינון יתאים 1:1. */
const ABROAD_GROUP_PILLS = WORLDWIDE_VACATION_CATEGORIES.map((c) => ({
  key: `${c.emoji} ${c.title}`,
  emoji: c.emoji,
  title: c.title,
}));

/** יעד סטטי בודד בתוך פיל, אחרי פענוח מה-registry - מקור-האמת
 *  היחיד לרשימה (בדיוק כמו WorldwideCategorySection.tsx באפליקציה):
 *  הגריד תמיד מציג את הרשימה הזאת במלואה ומיד, בלי תלות ב-DB. */
interface StaticDestination {
  key: string;
  name: string;
  flag: string;
  imageUrl: string;
  subtitle: string | null;
}

/** פיל -> רשימת היעדים הסטטית שלו (מה-constants, לא מה-DB). */
const ABROAD_STATIC_DESTINATIONS: Record<string, StaticDestination[]> = Object.fromEntries(
  WORLDWIDE_VACATION_CATEGORIES.map((c) => {
    const groupLabel = `${c.emoji} ${c.title}`;
    const list: StaticDestination[] = c.destinations
      .map((ref) => {
        const entry = WORLDWIDE_DESTINATION_REGISTRY[ref.slug];
        if (!entry) return null;
        return {
          key: `${entry.name}::${groupLabel}`,
          name: entry.name,
          flag: entry.flag,
          imageUrl: ref.imageUrl ?? entry.imageUrl,
          subtitle: ref.subtitle ?? null,
        };
      })
      .filter((d): d is StaticDestination => d !== null);
    return [groupLabel, list];
  })
);

export default function PlaceConsolePage() {
  const router = useRouter();
  const { secret: adminSecret } = useAdminSecret();
  const [activeCategory, setActiveCategory] = useState<QuickCategoryId>("abroad");
  const mode = modeOf(activeCategory);

  const [editions, setEditions] = useState<Edition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");

  // ייבוא "עצל" ליעד בודד - בדיוק ברגע שלוחצים עליו, לא ברקע לכל
  // הקטגוריה מראש (זו הייתה הבעיה השברירית - ר' הערה על הגריד למטה).
  const [importingKeys, setImportingKeys] = useState<Set<string>>(new Set());

  // הפיל הנבחר - מפתח משותף לשני המצבים (group_label ל-curated, section
  // id ל-sections), כדי שכל שאר הקוד (בחירה, גריד, ריסט) יהיה זהה.
  const [activePillKey, setActivePillKey] = useState<string | null>(null);

  const sections = ADMIN_DISCOVERY_SECTIONS[activeCategory] ?? [];
  const pills = mode === "curated" ? ABROAD_GROUP_PILLS : sections.map((s) => ({ key: s.id, emoji: s.emoji, title: s.title }));

  const [sectionPlaces, setSectionPlaces] = useState<SectionPlace[] | null>(null);
  const [countries, setCountries] = useState<string[] | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("");
  // "weekend" - כל התוכן ישראלי מטבעו (vacation-il), פילטר מדינה שם לא
  // מוסיף ערך (תמיד יחזיר אותה תוצאה) - מוצג רק לקטגוריות הבינלאומיות.
  const showCountryFilter = mode === "sections" && activeCategory !== "weekend";

  function loadEditions() {
    if (!adminSecret || mode !== "curated") return;
    setEditions(null);
    fetch(`/api/admin/destination-editions?quickCategory=${activeCategory}`, {
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEditions(data.editions ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת היעדים"));
  }

  useEffect(loadEditions, [adminSecret, activeCategory, mode]);

  // בחירת פיל ברירת מחדל (הראשון) בכל מעבר טאב.
  useEffect(() => {
    setActivePillKey(pills[0]?.key ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory]);

  // הערה: אין יותר "ייבוא גורף" ברקע לכל הקטגוריה בכניסה לעמוד - זה
  // בדיוק מה שגרם לגריד להיתקע מאחורי שלד טעינה. הגריד (למטה) מציג את
  // הרשימה הסטטית המלאה תמיד ומיד; ייבוא לרשומת DB אמיתית קורה רק
  // ליעד בודד, בדיוק ברגע שלוחצים עליו (importDestination).

  // רשימת מדינות לפילטר - נטענת פעם אחת, משותפת לכל הטאבים.
  useEffect(() => {
    if (!adminSecret || countries !== null) return;
    fetch("/api/admin/places/countries", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => parseJsonResponse(res))
      .then((data) => setCountries(data.countries ?? []))
      .catch(() => setCountries([]));
  }, [adminSecret, countries]);

  // טעינת האטרקציות של הפיל הנבחר (מצב sections בלבד).
  useEffect(() => {
    if (!adminSecret || mode !== "sections" || !activePillKey) return;
    setSectionPlaces(null);
    const params = new URLSearchParams({ quickCategory: activeCategory, sectionId: activePillKey });
    if (showCountryFilter && countryFilter) params.set("country", countryFilter);
    fetch(`/api/admin/discovery-sections?${params.toString()}`, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSectionPlaces(data.places ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת אטרקציות"));
  }, [adminSecret, mode, activeCategory, activePillKey, countryFilter, showCountryFilter]);


  async function handleCreate() {
    if (!newTitle.trim() || !newCountry.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/destination-editions", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({
          quickCategory: activeCategory,
          destinationName: newTitle.trim(),
          country: newCountry.trim(),
          subtitle: newSubtitle.trim() || undefined,
          groupLabel: activePillKey,
        }),
      });
      const data = await parseJsonResponse(res);
      if (data.error) throw new Error(data.error);
      setNewTitle("");
      setNewCountry("");
      setNewSubtitle("");
      setShowCreateForm(false);
      loadEditions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת היעד נכשלה");
    } finally {
      setCreating(false);
    }
  }

  const activeCategoryData = useMemo(
    () => QUICK_CATEGORIES.find((c) => c.id === activeCategory) ?? QUICK_CATEGORIES[0],
    [activeCategory]
  );

  // מפתח (שם::קבוצה) -> המהדורה האמיתית ב-DB, אם כבר יובאה. בונים
  // מכלל ה-editions (לא מסוננים לפיל) כדי שהמעבר בין פילים לא יצטרך
  // לטעון מחדש. הגריד למטה תמיד עובר על הרשימה הסטטית המלאה
  // (ABROAD_STATIC_DESTINATIONS) ומעשיר כל כרטיס עם המידע כאן אם קיים.
  const editionByKey = useMemo(() => {
    const map = new Map<string, Edition>();
    if (mode === "curated" && editions) {
      for (const e of editions) map.set(`${e.title}::${e.group_label ?? ""}`, e);
    }
    return map;
  }, [mode, editions]);

  const staticDestinations = mode === "curated" && activePillKey ? (ABROAD_STATIC_DESTINATIONS[activePillKey] ?? []) : [];

  /** ייבוא יעד בודד ל-DB ברגע הלחיצה עליו (אין עוד ייבוא גורף ברקע),
   *  ואז ניווט לעמוד היעד שנוצר - בדיוק כמו שהיה קורה אילו כבר יובא. */
  async function importDestination(dest: StaticDestination) {
    if (!adminSecret || !activePillKey || importingKeys.has(dest.key)) return;
    setImportingKeys((prev) => new Set(prev).add(dest.key));
    setError(null);
    try {
      const res = await fetch("/api/admin/destination-editions/import-curated", {
        method: "POST",
        headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
        body: JSON.stringify({ source: "abroad", destinationNames: [dest.key] }),
      });
      const data = await parseJsonResponse(res);
      if (data.error) throw new Error(data.error);
      const result = (data.results ?? [])[0] as { id: string } | undefined;
      if ((data.errors ?? []).length > 0 || !result) {
        throw new Error((data.errors ?? [])[0] ?? "יצירת היעד נכשלה");
      }
      loadEditions();
      router.push(`/admin/place-console/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "יצירת היעד נכשלה");
      setImportingKeys((prev) => {
        const next = new Set(prev);
        next.delete(dest.key);
        return next;
      });
    }
  }

  const activePill = pills.find((p) => p.key === activePillKey);

  return (
    <div dir="rtl" className="admin-fade-in flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-[22px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          סוגי מסלול
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          התוכן שהמשתמשים רואים באפליקציה - בדיוק כמו שהם רואים אותו, רק בפריסת עבודה רחבה
        </p>
      </div>

      {error && (
        <p
          className="rounded-[var(--admin-radius-md)] px-4 py-3 text-[13.5px]"
          style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}
        >
          {error}
        </p>
      )}

      {/* 1. שורת 7 סוגי הטיול - אותה לכל הטאבים, לא משתנה */}
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-[var(--admin-radius-lg)] border p-1.5"
        style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
      >
        {QUICK_CATEGORIES.map((cat) => {
          const active = cat.id === activeCategory;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className="flex items-center gap-1.5 rounded-[var(--admin-radius-md)] px-2.5 py-1.5 text-[12.5px] font-medium transition"
              style={{
                background: active ? "var(--admin-accent-soft)" : "transparent",
                color: active ? "var(--admin-accent)" : "var(--admin-ink-secondary)",
              }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cat.imageSrc} alt="" className="h-full w-full object-cover" />
              </span>
              {QUICK_CATEGORY_LABELS[cat.id]}
            </button>
          );
        })}
      </div>

      {/* 2. שורת פילים (תת-קטגוריות) - המנגנון האחיד: תמיד למעלה, תמיד
          אותו מבנה, בין אם המקור הוא curated (חו״ל) או sections (כל
          השאר). לא מוצגת ב-domestic (חופשה בארץ) - שם היעדים עצמם הם
          השכבה הראשונה (Structure B), הקטגוריות מופיעות רק *בתוך* יעד
          ספציפי (ר' /admin/place-console/domestic/[slug]). */}
      {mode !== "domestic" && (
        <div className="-mx-6 flex items-center gap-2 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
          {pills.map((p) => {
            const active = p.key === activePillKey;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setActivePillKey(p.key)}
                className="shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition"
                style={{
                  background: active ? "var(--admin-accent)" : "var(--admin-bg-sunken)",
                  color: active ? "#fff" : "var(--admin-ink-secondary)",
                }}
              >
                {p.emoji} {p.title}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. כותרת + פעולות (מספר תוצאות, פילטר מדינה / כפתור יעד חדש) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--admin-ink)" }}>
          {mode === "domestic" ? "יעדים" : activePill ? `${activePill.emoji} ${activePill.title}` : QUICK_CATEGORY_LABELS[activeCategoryData.id]}
          <span className="mr-2 text-[13px] font-normal" style={{ color: "var(--admin-ink-faint)" }}>
            {mode === "curated"
              ? `· ${staticDestinations.length} יעדים`
              : mode === "domestic"
                ? `· ${ISRAEL_VACATION_DESTINATIONS.length} יעדים`
                : sectionPlaces
                  ? `· ${sectionPlaces.length} אטרקציות`
                : ""}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          {showCountryFilter && (
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className={adminInputClass}
              style={{ ...adminInputStyle, width: 180 }}
            >
              <option value="">כל המדינות</option>
              {(countries ?? []).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {mode === "curated" && <AdminButton onClick={() => setShowCreateForm((v) => !v)}>+ יעד חדש</AdminButton>}
        </div>
      </div>

      {mode === "curated" && showCreateForm && (
        <div
          className="flex flex-wrap items-end gap-3 rounded-[var(--admin-radius-lg)] border p-4"
          style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-surface)" }}
        >
          <div className="w-48">
            <AdminField label="שם היעד (עיר)">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="לדוגמה: ניו יורק"
                className={adminInputClass}
                style={adminInputStyle}
              />
            </AdminField>
          </div>
          <div className="w-40">
            <AdminField label="מדינה">
              <input
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder="ארה״ב"
                className={adminInputClass}
                style={adminInputStyle}
              />
            </AdminField>
          </div>
          <div className="w-48">
            <AdminField label="תת-כותרת / הקשר (אופציונלי)">
              <input
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="לדוגמה: בכריסמס"
                className={adminInputClass}
                style={adminInputStyle}
              />
            </AdminField>
          </div>
          <AdminButton onClick={handleCreate} disabled={creating || !newTitle.trim() || !newCountry.trim()}>
            {creating ? "יוצר..." : `צור תחת "${activePill?.title}"`}
          </AdminButton>
        </div>
      )}

      {/* 4. הגריד - יעדים (curated) או אטרקציות חיות (sections). כרטיסים
          קטנים יותר (בקשה מפורשת) - עוד עמודה בכל breakpoint.
          curated: הגריד עובר תמיד על הרשימה הסטטית המלאה
          (ABROAD_STATIC_DESTINATIONS, בדיוק כמו WorldwideCategorySection
          באפליקציה) - אף פעם לא חלקי ואף פעם לא נעלם מאחורי שלד טעינה.
          כרטיס שכבר יובא ל-DB (יש לו edition תואם) הוא קישור רגיל
          לניהול; כרטיס שעדיין לא - לחיצה מייבאת רק אותו באותו רגע
          ואז מנווטת פנימה (אין יותר ייבוא גורף ברקע לכל הקטגוריה). */}
      {mode === "domestic" ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {ISRAEL_VACATION_DESTINATIONS.map((dest) => (
            <Link
              key={dest.slug}
              href={`/admin/place-console/domestic/${dest.slug}`}
              className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[var(--admin-radius-md)] border transition hover:opacity-95"
              style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-sunken)" }}
            >
              {dest.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dest.imageUrl} alt={dest.name} className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: "var(--admin-ink-faint)" }}>
                  🖼️
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2 pt-8">
                <p className="truncate text-[12.5px] font-bold leading-tight text-white">🇮🇱 {dest.name}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : mode === "curated" ? (
        staticDestinations.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-[var(--admin-radius-lg)] border py-16 text-center"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
          >
            <p className="text-[13.5px]">אין יעדים מוגדרים תחת &quot;{activePill?.title}&quot; - אפשר להוסיף ידנית.</p>
            <AdminButton onClick={() => setShowCreateForm(true)}>+ יעד ידני</AdminButton>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {staticDestinations.map((dest) => {
              const edition = editionByKey.get(dest.key);
              const importing = importingKeys.has(dest.key);
              const cardInner = (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dest.imageUrl}
                    alt={dest.name}
                    className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2 pt-8">
                    <p className="truncate text-[12.5px] font-bold leading-tight text-white">
                      {dest.flag} {dest.name}
                    </p>
                    {dest.subtitle && <p className="truncate text-[10.5px] text-white/85">{dest.subtitle}</p>}
                    <p className="mt-0.5 text-[10px] text-white/70">
                      {edition ? `${edition.placesCount} אטרקציות` : importing ? "מייבא..." : "לחצו לייבוא"}
                    </p>
                  </div>
                  {edition && !edition.is_published && (
                    <span
                      className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                      style={{ background: "var(--admin-warning-soft)", color: "var(--admin-warning)" }}
                    >
                      טיוטה
                    </span>
                  )}
                  {!edition && (
                    <span
                      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold"
                      style={{ background: "var(--admin-bg-surface)", color: "var(--admin-ink-secondary)" }}
                    >
                      {importing ? "…" : "+"}
                    </span>
                  )}
                </>
              );
              const className =
                "group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[var(--admin-radius-md)] border transition hover:opacity-95";
              const style = { borderColor: "var(--admin-border)", background: "var(--admin-bg-sunken)" };
              return edition ? (
                <Link key={dest.key} href={`/admin/place-console/${edition.id}`} className={className} style={style}>
                  {cardInner}
                </Link>
              ) : (
                <button
                  key={dest.key}
                  type="button"
                  disabled={importing}
                  onClick={() => importDestination(dest)}
                  className={`${className} text-right disabled:opacity-70`}
                  style={style}
                >
                  {cardInner}
                </button>
              );
            })}
          </div>
        )
      ) : sectionPlaces === null ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="admin-skeleton aspect-[3/4] rounded-[var(--admin-radius-md)]" />
          ))}
        </div>
      ) : sectionPlaces.length === 0 ? (
        <p
          className="rounded-[var(--admin-radius-lg)] border py-16 text-center text-[13.5px]"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
        >
          אין עדיין אטרקציות שמתאימות ל&quot;{activePill?.title}&quot;{countryFilter ? ` ב${countryFilter}` : ""} - עברו ל
          <Link href="/admin/discovery" className="underline">
            AI Discovery
          </Link>{" "}
          כדי להוסיף.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {sectionPlaces.map((place) => (
            <Link
              key={place.id}
              href={`/admin/places/${place.id}`}
              className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-[var(--admin-radius-md)] border transition hover:opacity-95"
              style={{ borderColor: "var(--admin-border)", background: "var(--admin-bg-sunken)" }}
            >
              {place.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={place.imageUrls[0]}
                  alt={place.name}
                  className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-2xl" style={{ color: "var(--admin-ink-faint)" }}>
                  🖼️
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.8)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2 pt-8">
                <p className="truncate text-[12.5px] font-bold leading-tight text-white">{place.name}</p>
                <p className="truncate text-[10.5px] text-white/75">
                  {place.city ?? ""}
                  {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
