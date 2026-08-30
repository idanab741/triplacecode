"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminSecret } from "@/screens/admin/shell/AdminAuthContext";
import { QUICK_CATEGORIES, type QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { AdminButton, AdminField, adminInputClass, adminInputStyle } from "@/screens/admin/shared/Drawer";
import { ADMIN_DISCOVERY_SECTIONS } from "@/constants/adminDiscoverySections";
import { AddPlaceModal, type AddModalContext } from "@/screens/admin/place-console/AddPlaceModal";
import { ClassifySectionsModal } from "@/screens/admin/place-console/ClassifySectionsModal";
import { WORLDWIDE_VACATION_CATEGORIES, WORLDWIDE_DESTINATION_REGISTRY } from "@/constants/worldwideVacationCategories";
import { ISRAEL_VACATION_DESTINATIONS } from "@/constants/israelVacationDestinations";

const ADMIN_SECRET_HEADER = "x-admin-secret";
const ALL_PILL_KEY = "__all__";

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
  tags?: string[];
  tripTypeTags?: string[];
  cuisineTags?: string[];
  /** true = עדיין לא סווג לאף סקשן ספציפי של סוג הטיול הזה (מוצג רק
   *  בתצוגת "הכל") - ר' /api/admin/discovery-sections/all. */
  needsClassification?: boolean;
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
  // *** בעבר נגזר משתמעית מ-activePillKey (הפיל שנבחר). עכשיו שכל
  // הקבוצות מוצגות ביחד במקום מוצג-בזמן-אחד (בקשה מפורשת - "לא גלילה,
  // הקטגוריות אחד אחרי השני") - צריך בחירה מפורשת בטופס עצמו.
  const [newGroupKey, setNewGroupKey] = useState<string>(ABROAD_GROUP_PILLS[0]?.key ?? "");

  // ייבוא "עצל" ליעד בודד - בדיוק ברגע שלוחצים עליו, לא ברקע לכל
  // הקטגוריה מראש (זו הייתה הבעיה השברירית - ר' הערה על הגריד למטה).
  const [importingKeys, setImportingKeys] = useState<Set<string>>(new Set());

  // הפיל הנבחר - מפתח משותף לשני המצבים (group_label ל-curated, section
  // id ל-sections), כדי שכל שאר הקוד (בחירה, גריד, ריסט) יהיה זהה.
  const [activePillKey, setActivePillKey] = useState<string | null>(null);

  const sections = ADMIN_DISCOVERY_SECTIONS[activeCategory] ?? [];
  // *** "הכל" - פיל מיוחד, ראשון ונבחר כברירת מחדל ב-sections mode
  // (דרישה מפורשת - "Place לא נעלם רק כי עדיין לא סיווגנו אותו"): מציג
  // את *כל* המקומות עם category רלוונטי לסוג הטיול, כולל כאלה שעדיין
  // לא סווגו לאף סקשן ספציפי - ר' /api/admin/discovery-sections/all.
  const pills =
    mode === "curated"
      ? ABROAD_GROUP_PILLS
      : mode === "sections"
        ? [{ key: ALL_PILL_KEY, emoji: "📥", title: "הכל" }, ...sections.map((s) => ({ key: s.id, emoji: s.emoji, title: s.title }))]
        : [];

  const [sectionPlaces, setSectionPlaces] = useState<SectionPlace[] | null>(null);
  const [countries, setCountries] = useState<string[] | null>(null);
  const [countryFilter, setCountryFilter] = useState<string>("");
  // *** תוספת (בקשה מפורשת - "כשאני משנה אטרקציה זה לא מתעדכן בעמודים"):
  // כפתור רענון ידני - שינוי בעריכת מקום (בעמוד /admin/places/[id] נפרד)
  // לא בהכרח מפעיל מחדש את ה-useEffect כאן אם Next.js משתמש ב-client
  // router cache על המסך הזה. מונה שמופיע גם בתלויות ה-fetch, כדי
  // שלחיצה תמיד תכריח בקשה טרייה, בלי תלות בהתנהגות ה-cache.
  const [refreshTick, setRefreshTick] = useState(0);

  // "+" הוספה context-aware (דרישה מפורשת #16-#20) - נשמר ברמת העמוד
  // כדי שסגירה/פתיחה לא תאבד context בטעות.
  const [addModalContext, setAddModalContext] = useState<AddModalContext | null>(null);
  // "כפתור סיווג" - דרישה מפורשת: סיווג מהיר של מקום מתוך תצוגת "הכל",
  // בלי חיפוש/יצירה - רק בחירת סקשנים ושמירה.
  const [classifyingPlace, setClassifyingPlace] = useState<SectionPlace | null>(null);

  // *** "כפתור סיווג להכל, כל קטגוריה, לא אטרקציה אטרקציה" (בקשה מפורשת):
  // לא בונה מנגנון AI חדש - קוראת בלולאה לאותו /api/admin/places/
  // bulk-suggest-tags הקיים (כבר בשימוש ב-admin/places-archive) - AI
  // מתייג בבת אחת את *כל* המקומות הלא-מתויגים במאגר (לא מוגבל לסוג
  // הטיול הנוכחי - "כל קטגוריה" פירושו כל הקטגוריות ביחד).
  const [bulkTagging, setBulkTagging] = useState(false);
  const [bulkTagResult, setBulkTagResult] = useState<{ total: number; tagged: number; failed: number } | null>(null);

  async function handleBulkTagAll() {
    if (bulkTagging) return;
    setBulkTagging(true);
    setBulkTagResult(null);
    let totalTagged = 0;
    let totalFailed = 0;
    let afterId: string | null = null;
    try {
      while (true) {
const res: Response = await fetch("/api/admin/places/bulk-suggest-tags", {
            method: "POST",
          headers: { "Content-Type": "application/json", [ADMIN_SECRET_HEADER]: adminSecret },
          body: JSON.stringify({ mode: "needs_classification", afterId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "שגיאה בסיווג האוטומטי");

        totalTagged += data.tagged;
        totalFailed += data.failed;
        afterId = data.lastId ?? afterId;
        setBulkTagResult({ total: totalTagged + totalFailed + data.remaining, tagged: totalTagged, failed: totalFailed });

        if (data.processedNow === 0 || data.remaining === 0) break;
      }
      setRefreshTick((t) => t + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בסיווג האוטומטי");
    } finally {
      setBulkTagging(false);
    }
  }


  // *** דשבורד "כמה אטרקציות לא מאופיינות" (דרישה מפורשת) - נטען פעם
  // אחת, לא תלוי בטאב/פיל נבחר (זו סטטיסטיקה על *כל* המאגר).
  const [charStats, setCharStats] = useState<{
    total: number;
    uncharacterized: { count: number; pct: number };
    breakdown: { viaTripTypeTags: number; viaSubcategoryOnly: number; viaTagsOrCuisineOnly: number };
    perGroup: { id: string; emoji: string; label: string; count: number }[];
    bySection: { quickCategory: string; quickCategoryLabel: string; sectionId: string; emoji: string; title: string; count: number }[];
    emptySectionsCount: number;
    totalSectionsCount: number;
  } | null>(null);
  const [charStatsOpen, setCharStatsOpen] = useState(false);
  useEffect(() => {
    if (!adminSecret) return;
    fetch("/api/admin/places/characterization-stats", { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (!data.error) setCharStats(data);
      })
      .catch(() => {});
  }, [adminSecret, refreshTick]);
  // "weekend" - כל התוכן ישראלי מטבעו (vacation-il), פילטר מדינה שם לא
  // מוסיף ערך (תמיד יחזיר אותה תוצאה) - מוצג רק לקטגוריות הבינלאומיות.
  const showCountryFilter = mode === "sections" && activeCategory !== "weekend";

  const editionsRequestId = useRef(0);
  function loadEditions() {
    if (!adminSecret || mode !== "curated") return;
    const requestId = ++editionsRequestId.current;
    setEditions(null);
    setError(null);
    fetch(`/api/admin/destination-editions?quickCategory=${activeCategory}`, {
      headers: { [ADMIN_SECRET_HEADER]: adminSecret },
    })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (requestId !== editionsRequestId.current) return; // בקשה ישנה שהוחלפה - מתעלמים
        if (data.error) throw new Error(data.error);
        setEditions(data.editions ?? []);
      })
      .catch((e) => {
        if (requestId !== editionsRequestId.current) return;
        setError(e instanceof Error ? e.message : "שגיאה בטעינת היעדים");
      });
  }

  useEffect(loadEditions, [adminSecret, activeCategory, mode, refreshTick]);

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

  /**
   * *** תיקון (באג אמיתי - "עדיין מופיע 'סקשן לא מוכר'"): לא הספיק
   * לנקות error בתחילת כל ניסיון (מה שכבר תוקן קודם) - היה עוד מרוץ:
   * כשמעבירים פילים/טאבים מהר, כל שינוי תלות מפעיל fetch חדש בלי
   * לבטל את הקודם. אם הבקשה *הישנה* הייתה איטית וסיימה (בהצלחה או
   * בכישלון) *אחרי* שהחדשה כבר הצליחה, ה-.catch/.then הישן עדיין
   * "יורה" ודורס את ה-state העדכני עם שגיאה לא רלוונטית יותר. עכשיו
   * כל אפקט שומר דגל "ignore" מקומי דרך ה-cleanup של useEffect - ברגע
   * שהתלות משתנה (בקשה חדשה מתחילה), הבקשה הקודמת מסומנת ignore=true
   * ותוצאותיה (איזה שיגיעו) יתעלמו לגמרי, לא משנה מתי הן חוזרות.
   */
  const [allPillCounts, setAllPillCounts] = useState<{ total: number; classified: number; needsClassification: number } | null>(null);

  useEffect(() => {
    if (!adminSecret || mode !== "sections" || !activePillKey) return;
    let ignore = false;
    setSectionPlaces(null);
    setAllPillCounts(null);
    setError(null);
    const isAll = activePillKey === ALL_PILL_KEY;
    const params = new URLSearchParams(isAll ? { quickCategory: activeCategory } : { quickCategory: activeCategory, sectionId: activePillKey });
    if (showCountryFilter && countryFilter) params.set("country", countryFilter);
    const url = isAll ? `/api/admin/discovery-sections/all?${params.toString()}` : `/api/admin/discovery-sections?${params.toString()}`;
    fetch(url, { headers: { [ADMIN_SECRET_HEADER]: adminSecret } })
      .then((res) => parseJsonResponse(res))
      .then((data) => {
        if (ignore) return;
        if (data.error) throw new Error(data.error);
        setSectionPlaces(data.places ?? []);
        if (isAll) setAllPillCounts(data.counts ?? null);
      })
      .catch((e) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message : "שגיאה בטעינת אטרקציות");
      });
    return () => {
      ignore = true;
    };
  }, [adminSecret, mode, activeCategory, activePillKey, countryFilter, showCountryFilter, refreshTick]);


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
          groupLabel: newGroupKey,
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


  /** ייבוא יעד בודד ל-DB ברגע הלחיצה עליו (אין עוד ייבוא גורף ברקע),
   *  ואז ניווט לעמוד היעד שנוצר - בדיוק כמו שהיה קורה אילו כבר יובא. */
  async function importDestination(dest: StaticDestination) {
    if (!adminSecret || importingKeys.has(dest.key)) return;
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
          סוגי טיול
        </h1>
        <p className="mt-1 text-[13.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
          התוכן שהמשתמשים רואים באפליקציה - בדיוק כמו שהם רואים אותו, רק בפריסת עבודה רחבה
        </p>
      </div>

      {/* דשבורד "כמה אטרקציות לא מאופיינות" (דרישה מפורשת).
          *** תיקון (באג אמיתי - "אין סיכוי ש-90% לא מאופיין!!"): הבדיקה
          הקודמת בדקה רק trip_type_tags, אבל מנוע ההתאמה האמיתי
          (buildCategoryOrFilter) כבר מכיר גם subcategory, וגם cuisine_tags/
          tags הם מנגנוני אפיון נפרדים למסעדות/חיי לילה (ר' עמוד המקום) -
          "לא מאופיין" עכשיו אומר: אין ערך באף אחד מ-4 השדות, לא רק באחד
          מהם. מתקפל כברירת מחדל, כדי לא להעמיס על מסך שהמטרה שלו
          להיות ויזואלי. */}
      {charStats && (
        <div className="rounded-[var(--admin-radius-lg)] border" style={{ borderColor: charStats.emptySectionsCount > 0 ? "var(--admin-danger)" : "var(--admin-border)", background: "var(--admin-bg-surface)" }}>
          <div className="flex w-full items-center justify-between gap-3 p-4">
            <button type="button" onClick={() => setCharStatsOpen((v) => !v)} className="flex-1 text-right">
              <p className="text-[13.5px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                📊 דשבורד אפיון: {charStats.uncharacterized.count.toLocaleString()} מתוך {charStats.total.toLocaleString()} אטרקציות ({charStats.uncharacterized.pct}%) לא מאופיינות בשום שדה
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                {charStats.emptySectionsCount} מתוך {charStats.totalSectionsCount} סקשנים ספציפיים ריקים לגמרי (0 אטרקציות) - זה מה שבאמת קובע מה ריק בעמוד, לא האחוז הכללי
              </p>
            </button>
            <div className="flex shrink-0 items-center gap-2">
              {/* *** "כפתור סיווג להכל, כל קטגוריה, לא אטרקציה אטרקציה"
                  (בקשה מפורשת): פעולה גלובלית - לא מוגבלת לסוג טיול אחד,
                  בדיוק כמו הדשבורד הזה עצמו. משתמשת ב-AI הקיים (אותו
                  endpoint שכבר עובד ב-admin/places-archive), לא מנגנון
                  AI חדש. */}
              <AdminButton onClick={handleBulkTagAll} disabled={bulkTagging || charStats.uncharacterized.count === 0}>
                {bulkTagging ? "מסווג..." : `🤖 סווג הכל אוטומטית (${charStats.uncharacterized.count})`}
              </AdminButton>
              <button type="button" onClick={() => setCharStatsOpen((v) => !v)} className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
                {charStatsOpen ? "▲ הסתר" : "▼ פירוט"}
              </button>
            </div>
          </div>
          {bulkTagResult && (
            <p className="border-t px-4 py-2 text-[12px]" style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}>
              סה&quot;כ {bulkTagResult.total} · סווגו {bulkTagResult.tagged} · נכשלו {bulkTagResult.failed}
              {bulkTagging && " · ממשיך לרוץ ברקע..."}
            </p>
          )}
          {charStatsOpen && (
            <div className="border-t p-4" style={{ borderColor: "var(--admin-border)" }}>
              {charStats.emptySectionsCount > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-danger)" }}>
                    סקשנים ריקים לגמרי - בדיוק לפי אותה בדיקה שקובעת מה מוצג בעמוד (לא רק "יש תיוג כלשהו")
                  </p>
                  <div className="flex flex-col gap-1">
                    {charStats.bySection
                      .filter((s) => s.count === 0)
                      .map((s) => (
                        <button
                          key={`${s.quickCategory}:${s.sectionId}`}
                          type="button"
                          onClick={() => {
                            setActiveCategory(s.quickCategory as QuickCategoryId);
                            setActivePillKey(s.sectionId);
                            setCharStatsOpen(false);
                          }}
                          className="flex items-center justify-between rounded-[var(--admin-radius-sm)] px-2.5 py-1.5 text-right text-[12px] transition hover:opacity-80"
                          style={{ background: "var(--admin-danger-soft)", color: "var(--admin-danger)" }}
                        >
                          <span>
                            {s.emoji} {s.title}
                          </span>
                          <span style={{ color: "var(--admin-ink-faint)" }}>{s.quickCategoryLabel} ←</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-secondary)" }}>
                איך שאר האטרקציות מאופיינות בפועל
              </p>
              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-[var(--admin-radius-sm)] p-2.5 text-center" style={{ background: "var(--admin-bg-sunken)" }}>
                  <p className="admin-mono text-[16px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                    {charStats.breakdown.viaTripTypeTags.toLocaleString()}
                  </p>
                  <p className="text-[10.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                    דרך trip_type_tags
                  </p>
                </div>
                <div className="rounded-[var(--admin-radius-sm)] p-2.5 text-center" style={{ background: "var(--admin-bg-sunken)" }}>
                  <p className="admin-mono text-[16px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                    {charStats.breakdown.viaSubcategoryOnly.toLocaleString()}
                  </p>
                  <p className="text-[10.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                    רק דרך קטגוריית-משנה
                  </p>
                </div>
                <div className="rounded-[var(--admin-radius-sm)] p-2.5 text-center" style={{ background: "var(--admin-bg-sunken)" }}>
                  <p className="admin-mono text-[16px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                    {charStats.breakdown.viaTagsOrCuisineOnly.toLocaleString()}
                  </p>
                  <p className="text-[10.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                    רק דרך tags/מטבח
                  </p>
                </div>
              </div>

              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--admin-ink-secondary)" }}>
                כמות אטרקציות עם trip_type_tags לפי סוג טיול (רק מדד השיוך ל"סוגי טיול" - לא כל אפיון)
              </p>
              <div className="flex flex-col gap-1">
                {charStats.perGroup.map((g) => (
                  <div key={g.id} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate text-[12px]" style={{ color: g.count === 0 ? "var(--admin-danger)" : "var(--admin-ink-secondary)" }}>
                      {g.emoji} {g.label}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: "var(--admin-bg-sunken)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (g.count / Math.max(1, charStats.perGroup[charStats.perGroup.length - 1]?.count ?? 1)) * 100)}%`, background: g.count === 0 ? "var(--admin-danger)" : "var(--admin-accent)" }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-left text-[12px] admin-mono" style={{ color: "var(--admin-ink-faint)" }}>
                      {g.count}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                {charStats.uncharacterized.count > 0 && (
                  <>
                    {charStats.uncharacterized.count.toLocaleString()} אטרקציות באמת ללא שום אפיון. תיקון: פתחו את המקום ב-{" "}
                    <Link href="/admin/places" className="underline">
                      מקומות ואטרקציות
                    </Link>
                    , או השתמשו בכפתור &quot;השלם עם Google&quot; בעמוד המקום.
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}

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
      {mode !== "domestic" && mode !== "curated" && (
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
          {mode === "domestic" ? "יעדים" : mode === "curated" ? "כל הקטגוריות" : activePill ? `${activePill.emoji} ${activePill.title}` : QUICK_CATEGORY_LABELS[activeCategoryData.id]}
          <span className="mr-2 text-[13px] font-normal" style={{ color: "var(--admin-ink-faint)" }}>
            {mode === "curated"
              ? `· ${ABROAD_GROUP_PILLS.length} קטגוריות`
              : mode === "domestic"
                ? `· ${ISRAEL_VACATION_DESTINATIONS.length} יעדים`
                : activePillKey === ALL_PILL_KEY && allPillCounts
                  ? `· ${allPillCounts.total} מקומות · ${allPillCounts.classified} מסווגים · ${allPillCounts.needsClassification} דורשים סיווג`
                  : sectionPlaces
                    ? `· ${sectionPlaces.length} אטרקציות`
                    : ""}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            title="רענון - אם ערכתם מקום בעמוד אחר וזה לא מתעדכן כאן"
            className="rounded-[var(--admin-radius-sm)] border px-2.5 py-1.5 text-[12.5px] font-medium transition"
            style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
          >
            ↻ רענון
          </button>
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
          <div className="w-44">
            <AdminField label="קטגוריה">
              <select value={newGroupKey} onChange={(e) => setNewGroupKey(e.target.value)} className={adminInputClass} style={adminInputStyle}>
                {ABROAD_GROUP_PILLS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.emoji} {p.title}
                  </option>
                ))}
              </select>
            </AdminField>
          </div>
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
            {creating ? "יוצר..." : "צור יעד"}
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
        <div className="flex flex-col gap-8">
          {ABROAD_GROUP_PILLS.map((group) => {
            const groupDestinations = ABROAD_STATIC_DESTINATIONS[group.key] ?? [];
            if (groupDestinations.length === 0) return null;
            return (
              <div key={group.key}>
                <h3 className="mb-3 text-[14px] font-semibold" style={{ color: "var(--admin-ink)" }}>
                  {group.emoji} {group.title}
                  <span className="mr-2 text-[12px] font-normal" style={{ color: "var(--admin-ink-faint)" }}>
                    · {groupDestinations.length}
                  </span>
                </h3>
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                  {groupDestinations.map((dest) => {
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
              </div>
            );
          })}
        </div>
      ) : sectionPlaces === null ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="admin-skeleton aspect-[3/4] rounded-[var(--admin-radius-md)]" />
          ))}
        </div>
      ) : sectionPlaces.length === 0 && activePillKey !== ALL_PILL_KEY ? (
        // *** תיקון (דרישה מפורשת #28 - "לא להציג 'אין עדיין אטרקציות
        // - לכו ל-AI Discovery' אם המאגר כבר מכיל Place רלוונטי שרק
        // לא סווג"): סקשן ספציפי ריק לא בהכרח אומר "אין כלום" - יכולים
        // להיות מקומות בקטגוריה הראשית שפשוט לא סווגו ל*סקשן הזה
        // בדיוק*. מפנים קודם ל"הכל", ורק שם (ר' הענף הבא) - אם גם שם
        // 0 - זה אומר שבאמת אין שום Place רלוונטי, ואז AI Discovery
        // הוא ההצעה הנכונה.
        <div
          className="rounded-[var(--admin-radius-lg)] border py-16 text-center text-[13.5px]"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
        >
          <p>
            אין עדיין אטרקציות מסווגות ל&quot;{activePill?.title}&quot;{countryFilter ? ` ב${countryFilter}` : ""}.
          </p>
          <button type="button" onClick={() => setActivePillKey(ALL_PILL_KEY)} className="mt-2 underline" style={{ color: "var(--admin-accent)" }}>
            בדקו ב&quot;הכל&quot; - יכול להיות שיש מקומות שרק ממתינים לסיווג
          </button>
        </div>
      ) : sectionPlaces.length === 0 ? (
        <p
          className="rounded-[var(--admin-radius-lg)] border py-16 text-center text-[13.5px]"
          style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
        >
          אין עדיין שום מקום רלוונטי לקטגוריה הזו{countryFilter ? ` ב${countryFilter}` : ""} - עברו ל
          <Link href="/admin/discovery" className="underline">
            AI Discovery
          </Link>{" "}
          כדי להוסיף, או השתמשו בכפתור &quot;+&quot; למטה.
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
              {place.needsClassification && (
                <span
                  className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ background: "var(--admin-warning-soft)", color: "var(--admin-warning)" }}
                >
                  דורש סיווג
                </span>
              )}
              {activePillKey === ALL_PILL_KEY && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setClassifyingPlace(place);
                  }}
                  className="absolute bottom-2 left-2 rounded-full px-2 py-1 text-[10px] font-semibold opacity-0 transition group-hover:opacity-100"
                  style={{ background: "var(--admin-accent)", color: "#fff" }}
                >
                  ✎ סווג
                </button>
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
          {/* "+" - דרישה מפורשת #15/#16: אותו גודל/aspect ratio/גריד בדיוק
              כמו כרטיס Place, לא כפתור צף/טקסט מתחת. Context-aware -
              יודע בדיוק איפה אנחנו (סוג טיול + סקשן + מדינה). */}
          {activePillKey && activePillKey !== ALL_PILL_KEY && (
            <button
              type="button"
              onClick={() =>
                setAddModalContext({
                  quickCategory: activeCategory,
                  quickCategoryLabel: QUICK_CATEGORY_LABELS[activeCategory],
                  sectionId: activePillKey,
                  sectionTitle: activePill?.title ?? "",
                  country: showCountryFilter ? countryFilter : undefined,
                })
              }
              className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[var(--admin-radius-md)] border-2 border-dashed transition hover:opacity-80"
              style={{ borderColor: "var(--admin-border)", color: "var(--admin-ink-secondary)" }}
            >
              <span className="text-2xl">+</span>
              <span className="px-2 text-center text-[11px] font-medium leading-tight">
                הוסף ל{activePill?.title}
              </span>
            </button>
          )}
        </div>
      )}

      {addModalContext && <AddPlaceModal context={addModalContext} adminSecret={adminSecret} onClose={() => setAddModalContext(null)} onAdded={() => setRefreshTick((t) => t + 1)} />}
      {classifyingPlace && (
        <ClassifySectionsModal
          place={{
            id: classifyingPlace.id,
            name: classifyingPlace.name,
            subcategory: classifyingPlace.subcategory,
            tags: classifyingPlace.tags ?? [],
            tripTypeTags: classifyingPlace.tripTypeTags ?? [],
            cuisineTags: classifyingPlace.cuisineTags ?? [],
          }}
          quickCategory={activeCategory}
          adminSecret={adminSecret}
          onClose={() => setClassifyingPlace(null)}
          onClassified={() => setRefreshTick((t) => t + 1)}
        />
      )}
    </div>
  );
}

