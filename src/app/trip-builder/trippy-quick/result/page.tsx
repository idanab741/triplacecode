"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Screen } from "@/components/ui";
import { TripHeroHeader, LIGHT_AREA_ICON_STYLE } from "@/screens/layout/TripHeroHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { SortableStopCard } from "@/screens/trip-builder/SortableStopCard";
import { downloadIcsFile } from "@/utils/downloadIcsFile";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";
import type { TrippyQuickStop } from "@/services/tripBuilder/trippyQuickShared";
import type { FinalItineraryStop } from "@/services/tripBuilder/types";

interface SearchContext {
  city: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * *** עמוד חדש (בקשה מפורשת - "מלל חופשי... משם ישר הולכים לעמוד
 * מסלול ייחודי שלא היה באפליקציה... עד 3 מסעדות ו-3 אטרקציות...
 * גרירה ומחיקה... הוספה ליומן... החיפוש על בסיס ה-API של קלוד").
 * *** תיקון עיצוב (בקשה מפורשת - "האם הסתכלת על האפליקציה שלנו???"):
 * - בר עליון: HERO 100% רוחב, ישר מתחת לבר (בלי padding/gap) - לא בתוך ה-
 *   קונטיינר עם ה-padding הרגיל של Screen.
 * - סדר: HERO -> שם המסלול -> מפה -> כרטיסיות (בעיצוב SortableStopCard
 *   האמיתי - גרירה למעלה/למטה + סוויפ שמאלה למחיקה, לא כרטיס מותאם
 *   אישית) -> הוספה ליומן (בפופאפ, לא inline).
 * *** תיקון (בקשה מפורשת - "להעביר את כפתור שיתוף ושמירה - למעלה כמו
 * בשאר עמודי הטיול"): הבר העליון הממותג (ChatHeader, "טריפי AI" +
 * פס התקדמות) הוחלף בבר הרגיל של שאר עמודי התוצאה (לוגו+חזרה+שמירה+
 * שיתוף) - עקביות מלאה עם day-trip/nightlife/וכו', לא רק HERO.
 * ר' src/app/api/trip-builder/trippy-quick/route.ts להסבר על מקור
 * הנתונים (Claude + אימות Google, בלי DB/session).
 */

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), { ssr: false });

/** ממיר TrippyQuickStop (השטוח, הפשוט) ל-FinalItineraryStop - הטיפוס
 *  ש-SortableStopCard (הכרטיס "האמיתי" של האפליקציה) מצפה לו. שדות
 *  שלא רלוונטיים לזרימה הזו (בלי session/AI-scheduling אמיתי) מקבלים
 *  ערכי ברירת מחדל ניטרליים (0/null) - לא נקראים בפועל על ידי
 *  SortableStopCard מלבד לתצוגה. */
function toFinalItineraryStop(stop: TrippyQuickStop, index: number): FinalItineraryStop {
  return {
    stopId: stop.id,
    placeId: stop.id,
    name: stop.name,
    category: stop.category,
    imageUrls: stop.imageUrl ? [stop.imageUrl] : [],
    etaMinutes: 0,
    arrivalOffsetMinutes: index * 90,
    estimatedVisitMinutes: 90,
    priceLevel: null,
    rating: stop.rating,
    reason: null,
    shortDescription: stop.shortDescription,
    latitude: stop.latitude,
    longitude: stop.longitude,
    openingHours: null,
    dayIndex: 0,
  };
}

function TrippyQuickResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId");
  const freeText = searchParams.get("freeText") ?? "";
  // *** תוספת (ר' migration 0057 - trippy_ai_results): פתיחה מחדש של
  // תוצאה שמורה מ"הטיולים שלי" (MyTripsSection.tsx) - שם, בניגוד לזרימת
  // requestId/sessionStorage, אין state בזיכרון הדפדפן בכלל (זה טאב/
  // טעינה חדשים), אז שולפים ישירות מ-DB לפי savedId.
  const savedId = searchParams.get("savedId");

  const [stops, setStops] = useState<TrippyQuickStop[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  // *** תוספת (בקשה מפורשת - "אפשרות לשמירה ושיתוף"): טוקן קישור
  // ציבורי read-only (ר' migration 0058) - מגיע או מתגובת ה-POST
  // המקורית (זרימת requestId/sessionStorage) או משליפת /api/trippy-ai/[id]
  // (זרימת savedId, פתיחה מחדש מ"הטיולים שלי"). null כשלא נשמר בכלל
  // (משתמש לא מחובר) - במקרה כזה לא מציגים את כפתור השיתוף.
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  // *** תוספת (בקשת המשתמש - "שיניתי את האטרקציה... אם אני נכנס שוב
  // דרך הטיולים שלי - זה עדיין האטרקציה שהחלפתי לפני ששיניתי"): swap/
  // מחיקה/סידור-מחדש/הוספה עדכנו עד עכשיו רק את ה-state המקומי של
  // העמוד - לא את trippy_ai_results ב-DB. persistId מזהה אם יש בכלל
  // מה לשמור עליו (null = לא נשמר מלכתחילה, למשל משתמש לא מחובר).
  // מגיע או מ-savedId ב-URL (פתיחה מחדש) או מתגובת ה-POST המקורית
  // (יצירה טרייה - ר' שני ה-useEffect branches למטה).
  const [persistId, setPersistId] = useState<string | null>(savedId);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [swapConfirmStop, setSwapConfirmStop] = useState<TrippyQuickStop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [addedToCalendar, setAddedToCalendar] = useState(false);
  // *** תוספת (בקשה מפורשת - "עמוד הבחירות שלי - שינויים", סעיף "שמור"):
  // עד עכשיו לתוצאת trippy AI לא היה כפתור "שמור" בכלל - כל תוצאה
  // פשוט נוצרה כ"זמנית" (ר' migration 0064 - is_saved=false כברירת
  // מחדל) בלי דרך להפוך אותה לקבועה. saved נטען מחדש מה-DB לפי
  // persistId (ר' /api/trippy-ai/[id]/save/route.ts) - לא רק state
  // מקומי - כדי שהמצב יישאר נכון גם בפתיחה חוזרת מ"הבחירות שלי".
  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  // *** תוספת (בקשה מפורשת - "בהחלפת אטרקציה - שיהיה יותר מ-2 בבנק"):
  // לפני זה, handleSwap החריג רק את התחנות המוצגות **כרגע** על המסך
  // (stops.map(id)) - לא כל מה שכבר הוצע והוחלף-משם בעבר לאותו סלוט.
  // בבריכת מועמדים קטנה (קטגוריה ספציפית/אזור קטן), זה גרם להחלפה
  // חוזרת "לסובב" בין אותם 2 מקומות בדיוק במקום להציג אופציה חדשה.
  // seenIdsRef צובר את **כל** ה-id-ים שהוצגו אי-פעם בעמוד הזה (גם כאלה
  // שכבר הוחלפו והוסרו) - מתעדכן אוטומטית בכל שינוי של stops (טעינה
  // ראשונית/swap/הוספת עצירה) דרך ה-useEffect למטה, ונשלח כ-excludeIds
  // מלא בכל בקשת swap - כך שאף פעם לא חוזרים על מקום שכבר הוצע.
  const seenIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!stops) return;
    for (const s of stops) seenIdsRef.current.add(s.id);
  }, [stops]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    // *** תיקון (בקשה מפורשת - "זה אמור להיות רק בצ'אט!! עד שעולה
    // הטיול המלא"): הנתונים כבר נטענו *לפני* הניווט (ר'
    // TrippyConversation.tsx - submitFreeText), בזמן שהרצף המלא
    // (בונים.../runtrippy/שלוש נקודות) עוד מוצג בצ'אט. הם נשמרו זמנית
    // ב-sessionStorage לפי requestId, וכאן רק קוראים אותם - בלי שום
    // fetch, בלי שום מסך טעינה נוסף. freeText (הישן) נשאר רק כ-fallback
    // אם מישהו הגיע לעמוד הזה ישירות (רענון/קישור ישן) בלי requestId.
    // *** תיקון (בקשת המשתמש - "המסלול כבר לא זמין" מופיע תמיד): מחיקת
    // sessionStorage מיד אחרי הקריאה לא עמידה מול React Strict Mode
    // (במצב dev, React מריץ useEffect פעמיים בכוונה כדי לתפוס קוד לא-
    // טהור - הריצה הראשונה קראה ומחקה בהצלחה, השנייה כבר לא מצאה כלום
    // ותפסה את זה כשגיאה). הפתרון: לא מוחקים בכלל - sessionStorage
    // ממילא מתנקה לבד כשהטאב/חלון נסגר, אין סיבה אמיתית למחוק ידנית,
    // וזה מבטל את כל הבעיה בלי סיכון.
    if (savedId) {
      let cancelled = false;
      fetch(`/api/trippy-ai/${savedId}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          if (!data.result || !Array.isArray(data.result.stops) || data.result.stops.length === 0) {
            setError("המסלול לא נמצא - ייתכן שנמחק.");
            return;
          }
          setStops(data.result.stops);
          setTitle(typeof data.result.title === "string" ? data.result.title : null);
          if (data.result.search_context) setSearchContext(data.result.search_context);
          if (typeof data.result.share_token === "string") setShareToken(data.result.share_token);
        })
        .catch(() => {
          if (!cancelled) setError("משהו השתבש - נסו שוב.");
        });
      return () => {
        cancelled = true;
      };
    }

    if (requestId) {
      const raw = sessionStorage.getItem(`trippy-quick:${requestId}`);
      if (!raw) {
        setError("המסלול כבר לא זמין - נסו לבנות מסלול חדש.");
        return;
      }
      try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data.stops) || data.stops.length === 0) {
          setError("לא הצלחנו למצוא מקומות מתאימים לבקשה הזו - נסו לנסח אחרת.");
          return;
        }
        setStops(data.stops);
        setTitle(typeof data.title === "string" ? data.title : null);
        if (data.searchContext) setSearchContext(data.searchContext);
        if (typeof data.shareToken === "string") setShareToken(data.shareToken);
        if (typeof data.savedId === "string") setPersistId(data.savedId);
      } catch {
        setError("משהו השתבש - נסו שוב.");
      }
      return;
    }

    if (!freeText) {
      setError("לא התקבל מלל חופשי");
      return;
    }
    let cancelled = false;
    getCurrentPositionSafe()
      .catch(() => null)
      .then((c) =>
        fetch("/api/trip-builder/trippy-quick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freeText, lat: c?.lat ?? null, lng: c?.lng ?? null }),
        })
      )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data.stops) || data.stops.length === 0) {
          setError("לא הצלחנו למצוא מקומות מתאימים לבקשה הזו - נסו לנסח אחרת.");
          return;
        }
        setStops(data.stops);
        setTitle(typeof data.title === "string" ? data.title : null);
        if (data.searchContext) setSearchContext(data.searchContext);
        if (typeof data.shareToken === "string") setShareToken(data.shareToken);
        if (typeof data.savedId === "string") setPersistId(data.savedId);
      })
      .catch(() => {
        if (!cancelled) setError("משהו השתבש - נסו שוב.");
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, freeText, savedId]);

  useEffect(() => {
    if (!persistId) return;
    let cancelled = false;
    fetch(`/api/trippy-ai/${persistId}/save`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSaved(data.saved === true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [persistId]);

  /** הופך את התוצאה ל"שמורה" (קבועה, מופיעה בלשונית "שמורים") או מבטל
   *  שמירה - אופטימי (מרגיש מיידי), עם rollback אם הבקשה נכשלת. בניגוד
   *  ל-SaveTripIconButton (טיולים "מלאים") - בכוונה **לא** מנווט אוטומטית
   *  לעמוד הבית אחרי שמירה, כי כאן עדיין אפשר להמשיך לערוך את המסלול
   *  (החלף/הוסף עצירה) אחרי השמירה. */
  async function handleToggleSave() {
    if (!persistId || saveLoading) return;
    const nextSaved = !saved;
    setSaveLoading(true);
    setSaved(nextSaved);
    try {
      const res = await fetch(`/api/trippy-ai/${persistId}/save`, { method: nextSaved ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setSaved(!nextSaved);
    } finally {
      setSaveLoading(false);
    }
  }

  /** שולח את מערך התחנות המעודכן ל-DB (ר' PATCH ב-/api/trippy-ai/[id]) -
   *  "כשל שקט": אם אין persistId (לא נשמר מלכתחילה) או אם הבקשה נכשלת,
   *  לא חוסמים את חוויית העמוד - המשתמש כבר רואה את השינוי ב-state
   *  המקומי בכל מקרה, זו רק שכבת "לזכור לפעם הבאה". */
  async function persistStops(newStops: TrippyQuickStop[]) {
    if (!persistId) return;
    try {
      await fetch(`/api/trippy-ai/${persistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops: newStops }),
      });
    } catch {
      // כשל שקט - ר' הערה למעלה
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !stops) return;
    const oldIndex = stops.findIndex((s) => s.id === active.id);
    const newIndex = stops.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(stops, oldIndex, newIndex);
    setStops(reordered);
    persistStops(reordered);
  }

  function handleDelete(id: string) {
    setStops((prev) => {
      const next = prev ? prev.filter((s) => s.id !== id) : prev;
      if (next) persistStops(next);
      return next;
    });
  }

  /** *** תיקון (בקשת המשתמש - "ההחלפה צריכה להיות זהה!!! לאותה
   *  קטגוריה שביקשתי מלכתחילה"): searchTags נלקח **מהתחנה עצמה**
   *  (stop.searchTags) - לא מ-state נפרד בעמוד שעלול להיות ריק/לא-
   *  מסונכרן. ר' trippyQuickShared.ts להסבר המלא.
   *  *** תוספת (בקשה מפורשת - "הכפתור צריך להבהב - ואז לקפוץ פופ אפ
   *  ...כן/לא"): ה-fetch בפועל קורה רק אחרי אישור בפופאפ (handleSwap
   *  נקרא מ-handleConfirmSwap למטה, לא ישירות מהכפתור). */
  async function handleSwap(stop: TrippyQuickStop) {
    if (!stops) return;
    setSwappingId(stop.id);
    try {
      const res = await fetch("/api/trip-builder/trippy-quick/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: stop.category,
          searchTags: stop.searchTags,
          nameKeyword: stop.nameKeyword,
          city: searchContext?.city ?? null,
          lat: searchContext?.lat ?? null,
          lng: searchContext?.lng ?? null,
          excludeIds: Array.from(seenIdsRef.current),
        }),
      });
      const data = await res.json();
      if (data.stop) {
        setStops((prev) => {
          const next = prev ? prev.map((s) => (s.id === stop.id ? data.stop : s)) : prev;
          if (next) persistStops(next);
          return next;
        });
      }
    } catch {
      // כשל שקט - התחנה הקיימת פשוט נשארת כמו שהיא, לא מציגים שגיאה חוסמת על פעולה משנית כזו
    } finally {
      setSwappingId(null);
    }
  }

  function handleConfirmSwap() {
    if (!swapConfirmStop) return;
    handleSwap(swapConfirmStop);
    setSwapConfirmStop(null);
  }

  const [addingStop, setAddingStop] = useState(false);

  /** *** תכונה חדשה (בקשה מפורשת - "אפשר להוסיף עוד איזה עצירה אחרי
   *  המסלול, תהיה יצירתי!! ומדויק"): ר' add-stop/route.ts להסבר המלא. */
  async function handleAddStop() {
    if (!stops) return;
    setAddingStop(true);
    try {
      const res = await fetch("/api/trip-builder/trippy-quick/add-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          existingNames: stops.map((s) => s.name),
          freeText,
          city: searchContext?.city ?? null,
          lat: searchContext?.lat ?? null,
          lng: searchContext?.lng ?? null,
          excludeIds: Array.from(seenIdsRef.current),
        }),
      });
      const data = await res.json();
      if (data.stop) {
        setStops((prev) => {
          const next = prev ? [...prev, data.stop] : prev;
          if (next) persistStops(next);
          return next;
        });
      }
    } catch {
      // כשל שקט - זו הוספה משנית, לא חוסמים את שאר העמוד
    } finally {
      setAddingStop(false);
    }
  }

  function handleConfirmAddToCalendar() {
    if (!stops || stops.length === 0) return;
    downloadIcsFile(stops, calendarDate, title ?? "מסלול-טריפי");
    setAddedToCalendar(true);
    setCalendarOpen(false);
  }

  async function handleShareTrip() {
    if (!shareToken) return;
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);

    const url = `${window.location.origin}/trip-builder/trippy-quick/shared/${shareToken}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: title ?? "המסלול שלי מ-trippy AI", url });
        return;
      } catch {
        // המשתמש ביטל את השיתוף - לא שגיאה אמיתית, פשוט לא ממשיכים לפולבאק
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // אין גישה ללוח - אין מה לעשות יותר, לא קריטי
    }
  }

  const mapStops = (stops ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ stopId: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }));

  return (
    <Screen withBottomNavSpacing className="!bg-white !px-0 !pt-0">
      <TripHeroHeader
        heroSrc="/images/trippy-hero-calendar.png"
        onBack={() => router.push("/ai")}
        rightSlot={
          <>
            {persistId && (
              <button
                type="button"
                onClick={handleToggleSave}
                disabled={saveLoading}
                aria-label={saved ? "הסרה מהשמורים" : "שמור מסלול"}
                className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-60"
              >
                <Image
                  src={saved ? "/icons/save-active.png" : "/icons/save.png"}
                  alt=""
                  width={23}
                  height={23}
                  className={LIGHT_AREA_ICON_STYLE}
                />
              </button>
            )}
            {shareToken && (
              <button
                type="button"
                onClick={handleShareTrip}
                aria-label="שתפו את המסלול"
                className="flex h-10 w-10 items-center justify-center rounded-full"
              >
                <Image
                  src={shareCopied ? "/icons/share-active.png" : "/icons/share.png"}
                  alt=""
                  width={26}
                  height={26}
                  className={LIGHT_AREA_ICON_STYLE}
                />
              </button>
            )}
          </>
        }
      />

      <div className="mx-auto flex max-w-md flex-col gap-4 px-5 pt-4">
        {title && <h1 className="text-center text-lg font-bold text-ink">{title}</h1>}

        {error && (
          <div className="flex flex-col items-center gap-3 rounded-card bg-white p-6 text-center shadow-soft">
            <Image src="/images/tripy.png" alt="" width={56} height={56} className="rounded-full" />
            <p className="text-sm text-ink-secondary">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/ai")}
              className="rounded-pill px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              נסו שוב
            </button>
          </div>
        )}

        {!error && !stops && (
          // *** תיקון (בקשה מפורשת - "העמוד הזה לא צריך להופיע בכלל!!!
          // רק בצ'אט כמו שאמרנו"): רצף הצ'אט (ChatBubble/
          // RuntrippyPromptBubble/TypingIndicator) כבר מוצג *בעמוד
          // הצ'אט* לפני הניווט לכאן (ר' TrippyConversation.tsx) -
          // הצגתו שוב כאן הייתה כפילות. כאן, בזמן שהעמוד הזה בעצמו
          // טוען, מספיק ספינר פשוט - בלי שום רכיב מהצ'אט.
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {stops && stops.length > 0 && (
          <>
            {mapStops.length > 0 && <ResultMap stops={mapStops} />}

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={stops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-3">
                  {stops.map((stop, index) => (
                    <SortableStopCard
                      key={stop.id}
                      stop={toFinalItineraryStop(stop, index)}
                      sessionId={null}
                      onItineraryUpdate={() => {}}
                      onDelete={() => handleDelete(stop.id)}
                      draggable={stops.length > 1}
                      onSwap={() => setSwapConfirmStop(stop)}
                      swapLoading={swappingId === stop.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={handleAddStop}
              disabled={addingStop}
              className="w-full rounded-pill border border-dashed border-accent/40 py-2.5 text-sm font-semibold text-accent disabled:opacity-50"
            >
              {addingStop ? "מוסיפים עצירה..." : "+ הוסיפו עצירה למסלול"}
            </button>

            <button
              type="button"
              onClick={() => setCalendarOpen(true)}
              className="w-full rounded-pill py-2.5 text-sm font-semibold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {addedToCalendar ? "✓ נוסף - הוספה שוב?" : "הוספה ליומן"}
            </button>
          </>
        )}
      </div>

      {/* פופאפ בחירת תאריך - לא inline בעמוד, לפי בקשה מפורשת */}
      {calendarOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setCalendarOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-center text-base font-bold text-ink">לאיזה תאריך?</p>
            <input
              type="date"
              value={calendarDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCalendarDate(e.target.value)}
              className="w-full rounded-pill border border-ink-secondary/25 bg-bg px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <button
              type="button"
              onClick={handleConfirmAddToCalendar}
              className="mt-4 w-full rounded-pill py-2.5 text-sm font-semibold text-white shadow-md"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              הוספה ליומן
            </button>
            <button
              type="button"
              onClick={() => setCalendarOpen(false)}
              className="mt-2 w-full py-2 text-sm text-ink-secondary"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* פופאפ אישור החלפת תחנה - "הכפתור צריך להבהב ואז לקפוץ פופ אפ
          החלפת אטרקציה - האם אתה בטוח? כן/לא עם התמונה של trippy AI" */}
      {swapConfirmStop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => setSwapConfirmStop(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col items-center gap-3 rounded-card bg-white p-6 text-center shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-white shadow-md">
              <Image src="/images/tripy.png" alt="" fill className="object-cover" />
            </div>
            <p className="text-base font-bold text-ink">החלפת אטרקציה</p>
            <p className="text-sm text-ink-secondary">האם אתה בטוח?</p>
            <div className="mt-2 flex w-full gap-3">
              <button
                type="button"
                onClick={() => setSwapConfirmStop(null)}
                className="flex-1 rounded-pill border border-ink-secondary/25 py-2.5 text-sm font-semibold text-ink"
              >
                לא
              </button>
              <button
                type="button"
                onClick={handleConfirmSwap}
                className="flex-1 rounded-pill py-2.5 text-sm font-semibold text-white shadow-md"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                כן
              </button>
            </div>
          </div>
        </div>
      )}

      <MainBottomNav active="ai" />
    </Screen>
  );
}

export default function TrippyQuickResultPage() {
  return (
    <Suspense fallback={null}>
      <TrippyQuickResultContent />
    </Suspense>
  );
}
