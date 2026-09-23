"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen, SwipeCard, BackButton, Chip, ImageOptionRow, SwipeToDeleteRow, type SwipeCardHandle } from "@/components/ui";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { CategoryPicker } from "@/screens/tripmatch/CategoryPicker";
import { HomeQuickCategories } from "@/screens/home/HomeQuickCategories";
import { type HomeQuickCategoryId } from "@/constants/homeQuickCategories";
import { TRIPMATCH_INTEREST_OPTIONS, TRIPMATCH_CATEGORY_BUCKETS } from "@/locales/he/tripBuilder";
import { INTERESTS, VACATION_PREFERENCES, type PreferenceOption } from "@/locales/he/preferences";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { toggleFavorite } from "@/services/favorites/favoritesService";
import { listAddresses } from "@/services/addresses/addressesService";
import { SwipeHeader, SwipeProgressBar } from "@/screens/tripmatch/SwipeHeader";
import { FilterCircleButton } from "@/screens/tripmatch/FilterCircleButton";
import { TripMatchCard, TRIPMATCH_CARD_BUTTON_ZONE, TRIPMATCH_MAIN_BUTTON_SIZE, resolveCardTap } from "@/screens/tripmatch/TripMatchCard";
import { LikedDialog } from "@/screens/tripmatch/LikedDialog";
import { FiltersSheet, EMPTY_FILTERS, applyFilters, countActiveFilters, type TripMatchFilters } from "@/screens/tripmatch/FiltersSheet";
import { MainBottomNav } from "@/components/MainBottomNav";
import { SaveTripIconButton } from "@/screens/trip-builder/SaveTripIconButton";
import dynamic from "next/dynamic";
import { haversineDistanceKm, estimateTravelMinutes } from "@/services/tripBuilder/geo";
import type { CandidatePlace } from "@/services/tripBuilder/types";
import { useFeatureOnboardingGuard } from "@/hooks/useFeatureOnboardingGuard";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";
import { getSessionLocation } from "@/utils/sessionLocation";
import { readDeck, writeDeck, clearDeck } from "@/utils/tripMatchDeckCache";
import { TripsIntroCard } from "@/components/trips/TripsIntroCard";

// המפה (Leaflet) משתמשת ב-window/DOM - חייבת להיטען רק בצד הלקוח, לא ב-SSR
const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

type Stage = "city" | "category" | "otherPicker" | "nearMeCategory" | "nearMeOtherPicker" | "swiping" | "results";

type UserPreferences = { interests: string[]; culinaryStyles: string[]; kosher: boolean; accessibility: boolean };

// *** "המשך לקטגוריה הבאה" - מתייחס רק ל-3 מתוך 4 הדליים (חיי לילה,
// מסעדות, אטרקציות), לפי בקשה מפורשת - "טבע" מטופל בנפרד (יש לו זרימת
// בניית-טיול משלו, לא מחזור החלקות כמו השאר) ולכן לא נכלל במחזור הזה.
const CONTINUE_CATEGORY_VALUES: string[] = ["nightlife", "restaurants", "attractions"];

// *** ניווט החוצה מ-TripMatch (למשל לצפייה בפרטי מקום) וחזרה היה מאפס
// את כל מצב מסך התוצאות (כולל "המשך לקטגוריה הבאה") כי הוא חי רק
// בזיכרון של React - ברגע שהרכיב נטען מחדש, הכל התאפס לעמוד ההתחלה.
// שומרים את מצב מסך התוצאות ב-sessionStorage (נמחק כשסוגרים את הטאב,
// לא נשאר "תקוע" לתמיד) כדי שחזרה ל-TripMatch תשחזר בדיוק איפה שהפסיקו.
const RESULTS_STATE_STORAGE_KEY = "tripmatch:results-state";

/** "אחר" ב"קרוב אליי" - השלמה אוטומטית מתוך תחומי עניין + העדפות חופשות
 *  בחו"ל (אותן רשימות מההתאמה האישית) - לא קשור ל-4 הדליים הראשיים. */
const NEAR_ME_OTHER_OPTIONS: PreferenceOption[] = [...INTERESTS, ...VACATION_PREFERENCES];

function computeMatchPercent(candidate: CandidatePlace, filters: TripMatchFilters, userPreferences: UserPreferences | null): number {
  let score = 45;
  if (candidate.rating != null) score += (candidate.rating / 5) * 15;

  const candidateTags = new Set([...candidate.tripTypeTags, ...candidate.cuisineTags, ...(candidate.tags ?? [])]);
  const onboardingTags = [...(userPreferences?.interests ?? []), ...(userPreferences?.culinaryStyles ?? [])];

  if (onboardingTags.length > 0) {
    const overlap = onboardingTags.filter((t) => candidateTags.has(t)).length;
    score += Math.min(1, overlap / Math.min(onboardingTags.length, 5)) * 15;
  }

  const adminScores = [...Object.values(candidate.tripmatchScores ?? {}), ...Object.values(candidate.dnaScores ?? {})];
  if (adminScores.length > 0) {
    const avg = adminScores.reduce((a, b) => a + b, 0) / adminScores.length;
    score += (avg / 100) * 15;
  }

  if (filters.tags.length > 0) {
    const overlap = filters.tags.filter((t) => candidateTags.has(t)).length;
    score += (overlap / filters.tags.length) * 10;
  } else if (onboardingTags.length === 0 && adminScores.length === 0) {
    score += 8;
  }

  if (userPreferences?.kosher && candidate.kosher) score += 5;
  if (userPreferences?.accessibility && candidate.accessible) score += 5;

  return Math.max(60, Math.min(99, Math.round(score)));
}

export default function TripMatchPage() {
  return (
    <Suspense>
      <TripMatchPageContent />
    </Suspense>
  );
}

/** מידות ה-Deck המוטמע (Home). הכרטיס לעולם לא רחב מ-MAX, ותמיד נשארים
 *  GUTTER px משני צדי ה-viewport - מספיק גם לבליטת הסיבוב של הכרטיסים
 *  מאחור (~sin(1.2°) × גובה הכרטיס ≈ 11px). */
const DECK_MAX_CARD_WIDTH = 340;
const DECK_SIDE_GUTTER = 24;
const DECK_CARD_ASPECT = 0.66;
/** אותו חצי-עיגול תחתון כמו ב-TripMatchCard - מוחל גם על הכרטיסים מאחור
 *  כדי שהחצי-עיגול יישאר לבן ונקי (בלי שתמונת הכרטיס שמאחור תציץ דרכו). */
const DECK_NOTCH_MASK = {
  WebkitMaskImage: "radial-gradient(circle 58px at 50% 100%, transparent 0 56px, #000 57px)",
  maskImage: "radial-gradient(circle 58px at 50% 100%, transparent 0 56px, #000 57px)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
} as const;

/** הכרטיסים המציצים מאחורי הכרטיס הקדמי - [0] = הקרוב (depth 1) ... [3] =
 *  הרחוק (depth 4). rot = זווית (מעלות, סביב תחתית הכרטיס), y = הזזה אנכית
 *  בפיקסלים (שלילי = כלפי מעלה). ערכי embedded קטנים כדי להישאר בתוך
 *  שוליי ה-px-8 של Home; standalone (/tripmatch) - עם הזוויות הרחבות
 *  המקוריות (4°/-5°) והזזה קטנה יותר כדי לא לחרוג מעל הכותרת. */
const BACK_CARDS = [
  // *** תוקן (בקשה מפורשת - "תקן RESPONSIVE אמיתי, לא overflow:hidden
  // כטלאי"): הזוויות הוקטנו משמעותית (3→1.2, 3.5→1.3, 2→0.8, 2→0.8) -
  // ביחד עם cardBox (מדוד ב-JS, 24px שוליים קבועים מכל צד של ה-viewport
  // עצמו - ר' useLayoutEffect ב-page.tsx) זה מבטיח שהבליטה האופקית של
  // הסיבוב (∝ גובה כרטיס × sin(זווית)) נשארת בתוך ה-24px גם על כרטיס
  // גבוה מאוד (~800px). standalone (עמוד /tripmatch העצמאי, כרטיס נמוך
  // בהרבה) לא השתנה.
  { embedded: { rot: 1.2, y: 0 }, standalone: { rot: 4, y: 0 } },
  { embedded: { rot: -1.2, y: 0 }, standalone: { rot: -5, y: 0 } },
  { embedded: { rot: 0.8, y: -10 }, standalone: { rot: 2.5, y: -6 } },
  { embedded: { rot: -0.8, y: -16 }, standalone: { rot: -2.5, y: -10 } },
] as const;

interface TripMatchPageContentProps {
  /** תיקון (Home - כניסה ל-TripMatch דרך שורת החיפוש): כש-true, הרכיב
   *  מוטמע בתוך עמוד אחר (Home) במקום להיות עמוד עצמאי - בלי ה-Screen/
   *  MainBottomNav/BackButton-לניווט המלאים שלו (Home כבר מספק את אלה).
   *  ברירת המחדל false שומרת על ההתנהגות הקיימת של /tripmatch כעמוד
   *  עצמאי, ללא שינוי. */
  embedded?: boolean;
  /** הטקסט שהמשתמש הקליד בשורת החיפוש של Home - "היעד" הראשוני, בלי
   *  לאפס אותו ובלי לבקש מהמשתמש להקליד שוב. */
  initialCityQuery?: string;
  /** נקרא כש-embedded=true והמשתמש לוחץ "חזרה" (BackButton) - Home
   *  מנקה את שורת החיפוש כדי לחזור למצב ההתחלתי (Reverse Scroll),
   *  בלי router.push/שינוי URL. */
  onExitEmbedded?: () => void;
  /** *** חדש (בקשה מפורשת - "הכרטיסייה תתארך עד קצה העמוד"): נקרא בכל
   *  שינוי stage, עם true כש-stage==="swiping" (מסך ההחלקה עצמו מוצג)
   *  ו-false בכל stage אחר (city/category/results...). Home משתמש בזה
   *  כדי להגביל את גובה אזור הכרטיס בדיוק לגובה המסך הפנוי (עד מעל ה-
   *  BottomNav) *רק* כשבאמת יש כרטיס להחליק - לא במסכי בחירת יעד/תוצאות,
   *  שצריכים גלילה חופשית רגילה. */
  onCardsVisibleChange?: (visible: boolean) => void;
  /** *** חדש (בקשה מפורשת - "גם אם יגמרו ההחלקות, תמיד תהיה כרטיסייה -
   *  להוספת מקומות"): נקרא כשלוחצים על כרטיס ה"הוספת מקום" (מוצג במקום
   *  ה"נגמרו המועמדים" הישן, כל פעם שאין עוד מועמד להציג). embedded
   *  (Home) מעביר פונקציה שפותחת את AddPlaceModal הקיים ישירות (בלי
   *  ניווט/רענון עמוד). בלי embedded (standalone /tripmatch) - נופל
   *  חזרה לניווט ל-/home?openAddPlace=1 (ר' שימוש בהמשך). */
  onAddPlaceClick?: () => void;
}

export function TripMatchPageContent({
  embedded = false,
  initialCityQuery,
  onExitEmbedded,
  onCardsVisibleChange,
  onAddPlaceClick,
}: TripMatchPageContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { ready } = useFeatureOnboardingGuard("tripmatch", "/onboarding/tripmatch");
  // *** חדש (בקשה מפורשת - "הכרטיסיות אמורות לעלות מיידית"): במצב מוטמע,
  // אם כבר נטענה חפיסה ליעד הזה (למשל חוזרים מעמוד מקום) - משחזרים אותה
  // מיד, עם אותו session, אותו סדר ואותו מקום בחפיסה, בלי בקשה לשרת.
  // ר' utils/tripMatchDeckCache.ts. נקרא פעם אחת בלבד (lazy init).
  const deckCacheKey = embedded ? (initialCityQuery ?? "").trim() : "";
  const [restoredDeck] = useState(() => {
    if (!deckCacheKey) return null;
    const deck = readDeck(deckCacheKey);
    if (!deck) return null;
    const decided = new Set(deck.decidedIds);
    // חפיסה שכבר הסתיימה לגמרי - לא משחזרים (תיווצר חדשה).
    if (deck.candidates.every((c) => decided.has(c.id))) {
      clearDeck(deckCacheKey);
      return null;
    }
    return deck;
  });
  const [stage, setStage] = useState<Stage>(restoredDeck ? "swiping" : "city");
  useEffect(() => {
    onCardsVisibleChange?.(stage === "swiping");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  // תיקון (Home - כניסה מוטמעת): כש-embedded=true אין להציג בכלל את
  // תמונת ה-Hero הדקורטיבית ("אין Hero של TripMatch" - Home כבר הציג
  // הירו/חיפוש משלו שהתחלף בכניסה הזו) - מתחילים עם false במקום עם
  // true+איפוס מאוחר יותר, כדי שלא תבהב לרגע לפני שההיעד מתאשר.
  const [heroVisible, setHeroVisible] = useState(() => !embedded);

  const [cityInput, setCityInput] = useState(restoredDeck?.cityLabel ?? "");
  const [cityOptions, setCityOptions] = useState<{ value: string; label: string; type: "city" | "country" }[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(restoredDeck?.cityValue ?? null);
  const [selectedCityLabel, setSelectedCityLabel] = useState<string>(restoredDeck?.cityLabel ?? "");

  const [categoryValue, setCategoryValue] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string>(restoredDeck ? "הכל" : "");
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(restoredDeck?.userPreferences ?? null);

  // *** שינוי (בקשה מפורשת - "בחירת קטגוריה אופציונלית, לא חובה"):
  // בניגוד ל-categoryValue (שנשלח לשרת וקובע איזה סט מועמדים נשלף -
  // "הכל" מול קטגוריה בודדת), זה סינון בצד הלקוח בלבד על סט "הכל"
  // שכבר נטען - בדיוק כמו העיגולים בעמוד הבית (HomeQuickCategories,
  // אותו קומפוננט בדיוק, לא עותק). מערך ריק = "הכל" (בלי סינון).
  const [activeCategoryFilters, setActiveCategoryFilters] = useState<HomeQuickCategoryId[]>([]);
  function toggleCategoryFilter(id: HomeQuickCategoryId) {
    setActiveCategoryFilters((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }
  function matchesQuickCategoryFilter(candidate: CandidatePlace, id: HomeQuickCategoryId): boolean {
    switch (id) {
      case "attraction":
        return candidate.category === "attractions";
      case "food":
        return candidate.category === "restaurants";
      case "nightlife":
        return candidate.category === "nightlife";
      case "nature":
        return candidate.category === "nature";
      case "sleep":
        return candidate.category === "hotels";
      case "shopping":
        // *** אין (עדיין) מקומות עם category="shopping" עצמו - "שופינג"
        // קיים היום רק כתגית (trip_type_tags/tags) בשאר האפליקציה, לכן
        // הסינון כאן לפי חפיפת תגית, לא לפי עמודת category.
        return new Set([...candidate.tripTypeTags, ...candidate.cuisineTags, ...(candidate.tags ?? [])]).has(
          "shopping"
        );
      default:
        return false;
    }
  }

  // "אחר" - בחירה ידנית של תתי-קטגוריות מתוך כל 19 האפשרויות (התאמות אישיות),
  // במקום אחד מ-4 הדליים הראשיים בלבד. תיבת טקסט עם השלמה אוטומטית (אותו
  // סגנון בדיוק כמו "אחר" בתוך "קרוב אליי").
  const [otherQuery, setOtherQuery] = useState("");
  const [otherTags, setOtherTags] = useState<string[]>([]);
  // "קרוב אליי" - מצב חיפוש לפי מיקום נוכחי, מגביל תוצאות לעד 10 ק"מ.
  const [nearMeActive, setNearMeActive] = useState(false);
  // "אחר" בתוך "קרוב אליי" - תיבת טקסט עם השלמה אוטומטית (תחומי עניין +
  // העדפות חופשות בחו"ל), נפרד מ-otherTags הרגיל (שם/UI שונה - צ'יפים).
  const [nearMeOtherQuery, setNearMeOtherQuery] = useState("");
  const [nearMeOtherTags, setNearMeOtherTags] = useState<string[]>([]);

  const [sessionId, setSessionId] = useState<string | null>(restoredDeck?.sessionId ?? null);
  // *** שינוי (בקשה מפורשת - "החלוקה אמורה להיות קבועה, ולא להשתנות"):
  // candidates הוא עכשיו החפיסה *הקבועה* - נטענת פעם אחת בתחילת ה-session
  // ולא משתנה יותר. לפני זה כל החלטה (החלקה) קיבלה מהשרת רשימה חדשה
  // שהחליפה את כולה (חפיסה של עד 60 מתוך מה שנשאר) - ולכן הסך ב-"1/60"
  // קפץ ל-70, 90..., הסדר השתנה, ותשובות שהגיעו באיחור החזירו כרטיסים שכבר
  // הוחלקו ("החלקתי - והיא חזרה ומתחלפת"). מי שהוחלט עליו נשמר ב-decidedIds.
  const [candidates, setCandidates] = useState<CandidatePlace[]>(restoredDeck?.candidates ?? []);
  const [candidateIndex, setCandidateIndex] = useState(0);
  // *** מזהי המקומות שכבר הוחלט עליהם (לייק/דילוג) בחפיסה הנוכחית - במקום
  // להסיר אותם מ-candidates. המונה "X/Y" נגזר מזה: Y = גודל החפיסה (קבוע),
  // X = כמה כבר הוחלט + 1 (ר' deck/visibleCandidates למטה).
  const [decidedIds, setDecidedIds] = useState<string[]>(restoredDeck?.decidedIds ?? []);
  // תור הקריאות לשרת (החלטות) - מסודרות בזו אחר זו, כדי שהשרת יקבל אותן
  // בדיוק בסדר שבו המשתמש עשה אותן. ו-decidingRef מונע הפעלה כפולה של
  // אותה החלטה (למשל שתי לחיצות מהירות על X).
  const decisionQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const decidingRef = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // *** מערכת "טריפים": כשלייק נדחה בגלל יתרה לא מספיקה, הכרטיס כבר
  // "עף" ויזואלית (אנימציית SwipeCard רצה לפני שהתשובה מהשרת חוזרת -
  // ר' handleDecision למטה) - בלי שינוי ה-key, React ישאיר את אותו
  // instance עם ה-transform הישן (מחוץ למסך). מעלים tick משנה את ה-key
  // ומכריחים remount נקי, כדי שהכרטיס יחזור למרכז במקום להיעלם.
  const [swipeResetTick, setSwipeResetTick] = useState(0);
  // *** גלריית תמונות בכרטיס (בקשה מפורשת): התמונה המוצגת כרגע בכרטיס הקדמי.
  // נשמר יחד עם ה-id של המועמד - כשעוברים לכרטיס אחר (או חוזרים אחורה) האינדקס
  // מתאפס אוטומטית ל-0, בלי useEffect שיגרום לרינדור כפול.
  const [photoState, setPhotoState] = useState<{ candidateId: string; index: number }>({ candidateId: "", index: 0 });
  // *** חדש (בקשה מפורשת - כפתור "חזור" על הכרטיס): שומר את ההחלטה
  // האחרונה (מועמד + אם היה לייק/סקיפ) כדי שאפשר יהיה לבטל אותה. רק
  // רמה אחת אחורה (בדיוק כמו בסקיצה המאושרת) - לא מחסנית שלמה.
  // *** הערה חשובה: זה ביטול ויזואלי/לקוחי בלבד - מחזיר את המועמד לראש
  // התור ומוריד אותו מ"אהבתי" אם היה לייק, אבל לא מבטל את קריאת ה-decide
  // שכבר נשלחה לשרת ולא מזכה בחזרה את הטריפים שכבר נוכו על לייק. זיכוי
  // אמיתי ידרוש endpoint ייעודי בצד השרת - אין כזה כרגע.
  const [lastDecision, setLastDecision] = useState<{ candidate: CandidatePlace; liked: boolean } | null>(null);
  // *** חדש (בקשה מפורשת - כפתורים קבועים, לא זזים עם הגרירה): מפעיל
  // like()/nope() על ה-SwipeCard מבחוץ, דרך ref - כך כפתורי הפעולה
  // (שיושבים כ-siblings קבועים, לא בתוך האלמנט הנגרר) עדיין גורמים
  // לאותה אנימציית fly-out בדיוק, בלי לזוז בעצמם בזמן גרירה.
  const swipeCardRef = useRef<SwipeCardHandle>(null);
  // *** שונה מהיסוד שוב (Bug חוזר - "זה שוב בורח" - אחרי כמה סבבים של
  // חישובי-JS (getBoundingClientRect, window.innerWidth וכו') שכל אחד
  // מהם תיקן משהו אבל הביא איתו תקלה חדשה (כולל תקלה שדוחפת את *כל*
  // העמוד, לא רק את הכרטיס, לגלילה אופקית - סימן שמשהו בחישוב עצמו
  // מפיק ערך שגוי במצבים מסוימים שלא תפסנו): זרקנו את כל מנגנון ה-JS
  // (useLayoutEffect, getBoundingClientRect, cardBox state) והחלפנו
  // ב-CSS טהור עם aspect-ratio - תכונה סטנדרטית שהדפדפן עצמו מחשב,
  // בלי שום חשבון ידני שיכול לצאת שגוי. CARD_BOX_STYLE (למטה) הוא
  // "התיבה" המשותפת (מיקום+גודל) שמוחלת בדיוק אותו דבר על: הכרטיס
  // הקדמי, כל כרטיס מאחור, ושורת הכפתורים - כולם משתמשים באותה תיבה
  // בדיוק (via CSS, לא via ערך JS מחושב), אז הם תמיד מיושרים.
  // *** תוקן (בקשה מפורשת - "לסדר את הרוחב של העמוד, לסדר את
  // הכרטיסיות, והדף לא יזלוג החוצה"): left/right היו "7%" - אבל
  // CARD_BOX_STYLE מוחל (embedded בלבד) בתוך container שכבר יש לו
  // px-8 (32px) padding אופקי משלו (ר' "px-8 pt-10" למטה) - זה כפל
  // כיווץ לא עקבי (7% *מתוך* רוחב שכבר הוקטן ב-64px, לא 7% מה-viewport
  // כמו שהכוונה המקורית הייתה), שיוצר גם רווח לא-סימטרי/גדול מדי סביב
  // הכרטיס וגם (יחד עם ה-back cards המסובבים שחולקים את אותה תיבה)
  // חוסר עקביות שהובילה לחריגה אופקית. left:0/right:0 - ה-container
  // עם ה-px-8 הוא עכשיו מקור השוליים האופקיים *היחיד* (בדיוק אותם
  // שוליים כמו שורת ההתקדמות/הקטגוריות שמעליו, px-8 גם הן) - הכרטיס
  // ממלא בדיוק את הרוחב הפנוי הזה, בלי כיווץ נוסף, ולכן גם ממורכז
  // בצורה עקבית ביחס לשאר האלמנטים בעמוד.
  // *** Deck מבני (בקשה מפורשת - "המרכוז חייב להיות מבני"):
  // DECK_STYLE = ה-Deck Container היחיד: width:100% + max-width +
  // margin-inline:auto + padding-inline (השוליים). רוחב הכרטיס נגזר מזה
  // אוטומטית: CARD_WIDTH = min(MAX_CARD_WIDTH, AVAILABLE_WIDTH - 2*GUTTER).
  // DECK_STAGE_STYLE = תיבת הכרטיס (בזרימה רגילה, aspect-ratio קובע גובה).
  // כל שכבה (כרטיסים מאחור, כרטיס קדמי, כפתורים) = DECK_LAYER_STYLE
  // (absolute; inset:0) - אותה תיבה בדיוק, אותו Center X, בלי left:50%,
  // בלי translateX ובלי margins שליליים. כרטיסים מאחור מקבלים רק
  // rotate/translateY סביב תחתית המרכז.
  const DECK_STYLE = {
    position: "relative" as const,
    width: "100%",
    maxWidth: DECK_MAX_CARD_WIDTH + DECK_SIDE_GUTTER * 2,
    marginInline: "auto",
    paddingInline: DECK_SIDE_GUTTER,
    paddingTop: 16,
    boxSizing: "border-box" as const,
  };
  const DECK_STAGE_STYLE = {
    position: "relative" as const,
    width: "100%",
    aspectRatio: String(DECK_CARD_ASPECT),
  };
  const DECK_LAYER_STYLE = {
    position: "absolute" as const,
    inset: 0,
  };

  const [filters, setFilters] = useState<TripMatchFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [likedPlace, setLikedPlace] = useState<CandidatePlace | null>(null);
  const [sessionLikedPlaces, setSessionLikedPlaces] = useState<CandidatePlace[]>(restoredDeck?.likedPlaces ?? []);
  const [hasSwipedAny, setHasSwipedAny] = useState(Boolean(restoredDeck && restoredDeck.decidedIds.length > 0));
  // *** עוקב אחרי אילו מתוך 3 הקטגוריות של "המשך לקטגוריה הבאה" כבר
  // הושלמו ליעד הנוכחי (מתאפס בכל בחירת יעד חדש) - כדי לדעת מתי להציג
  // את הכפתור ולאיזו קטגוריה לקפוץ בלחיצה עליו.
  const [completedCategories, setCompletedCategories] = useState<string[]>([]);
  // *** הטיול נוצר אוטומטית ב-trip_builder_sessions ברגע שמגיעים לתוצאות
  // (is_saved=false) - כדי שיופיע תחת "כל הטיולים" ויחולו עליו אותם
  // כללים כמו כל טיול אחר (כולל היעלמות אחרי שבוע אם לא נשמר). "שמירה"
  // בפועל קורית דרך SaveTripIconButton (אותו רכיב ששאר האפליקציה
  // משתמשת בו), לא כפתור נפרד פה.
  const [tripRecordId, setTripRecordId] = useState<string | null>(null);
  // *** ref מקביל ל-tripRecordId (לא רק ה-state) - נחוץ כדי שאפקט הסנכרון
  // למטה תמיד יקרא את ה-id העדכני ביותר, גם כשהוא מופעל שוב לפני שה-re-render
  // עם ה-state המעודכן הספיק לקרות (ראו syncQueueRef).
  const tripRecordIdRef = useRef<string | null>(null);
  useEffect(() => {
    tripRecordIdRef.current = tripRecordId;
  }, [tripRecordId]);
  // *** תיקון (יעד נשמר פעמיים ב"הטיולים שלי"): ברגע שמגיעים לתוצאות עם
  // יעד חדש, שני אפקטים עלולים לרוץ כמעט בו-זמנית - זה שמסמן את הקטגוריה
  // כ"הושלמה" (למטה) גורם ל-re-render שמפעיל את אפקט הסנכרון פעמיים לפני
  // שהקריאה הראשונה הספיקה לחזור עם sessionId. בלי תור, שתי הקריאות יוצאות
  // עם sessionId=null ויוצרות שתי שורות נפרדות ב-DB. syncQueueRef משרשר כל
  // קריאת סנכרון אחרי הקודמת - כך שהשנייה תמיד משתמשת ב-tripRecordId שכבר
  // נוצר ע"י הראשונה (UPDATE), במקום ליצור שורה כפולה (INSERT).
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [syncingTrip, setSyncingTrip] = useState(false);
  const [justShared, setJustShared] = useState(false);
  // *** true מהרגע שמתחילים לטעון טיול שמור עם resumeSessionId, עד
  // שההחלקות באמת מתחילות (או שנכשל). בלי זה, הבקשה ל-/api/tripmatch/
  // sessions (שיכולה לקחת הרבה שניות אם צריך ליצור המלצות חדשות ל-AI
  // לקטגוריה הזו) לא נראית שונה מ"כלום לא קורה" - בדיוק הבלבול שקרה כאן.
  const [resuming, setResuming] = useState(false);

  // שחזור מצב מסך התוצאות מ-sessionStorage בטעינה ראשונה (אחרי חזרה
  // ל-TripMatch מעמוד אחר) - רק אם יש תוצאות משמעותיות לשחזר. לא רץ אם
  // מגיעים עם resumeSessionId (ראו האפקט הבא) - אז טוענים מהשרת במקום.
  // *** תיקון (בקשה מפורשת - "כשמקלידים שוב זה צריך לחזור לדף הראשון
  // של TripMatch, לא לעמוד האחרון שהיינו בו"): במצב מוטמע (embedded),
  // כל חיפוש חדש מ-Home אמור להתחיל נקי לגמרי מבחירת קטגוריה - לא
  // "לקפוץ" אחורה לתוצאות של חיפוש קודם ששמורות ב-sessionStorage. שחזור
  // כזה נשאר רלוונטי רק לעמוד /tripmatch העצמאי (למשל רענון דף/חזרה
  // אחרי ניווט), לא כשנכנסים מחדש מתוך Home.
  useEffect(() => {
    if (embedded) return;
    if (searchParams.get("resumeSessionId")) return;
    try {
      const raw = sessionStorage.getItem(RESULTS_STATE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !Array.isArray(saved.sessionLikedPlaces) || saved.sessionLikedPlaces.length === 0) return;
      setSelectedCity(saved.selectedCity ?? null);
      setSelectedCityLabel(saved.selectedCityLabel ?? "");
      setCategoryValue(saved.categoryValue ?? null);
      setCategoryLabel(saved.categoryLabel ?? "");
      setSessionLikedPlaces(saved.sessionLikedPlaces);
      setCompletedCategories(Array.isArray(saved.completedCategories) ? saved.completedCategories : []);
      setTripRecordId(saved.tripRecordId ?? null);
      setHeroVisible(false);
      setStage("results");
    } catch {
      // sessionStorage לא זמין/JSON פגום - פשוט ממשיכים ממסך ההתחלה הרגיל
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // *** "המשך לקטגוריה הבאה" מעמוד טיול שמור - מגיעים לפה עם
  // ?resumeSessionId=X (מקושר מ-trip-builder/tripmatch/result). טוענים
  // את הטיול השמור מהשרת (לא מ-sessionStorage - זה טיול ישן מסשן אחר
  // לגמרי, לא הזיכרון הנוכחי של הדפדפן) ומשחזרים איתו בדיוק כמו מסך
  // תוצאות רגיל: יעד, רשימת המקומות שכבר אהבו, קטגוריות שכבר הושלמו,
  // ואותו tripRecordId (כדי שהמשך הסריקה יעדכן את אותה שורה, לא ייצור
  // כפילות).
  useEffect(() => {
    const resumeSessionId = searchParams.get("resumeSessionId");
    if (!resumeSessionId) return;
    setResuming(true);
    fetch(`/api/trip-builder/sessions/${resumeSessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        const answers = data.session?.answers as { destination?: string; cityValue?: string; completedCategories?: string[] } | null;
        const itinerary = data.session?.final_itinerary as { stops?: Array<Record<string, unknown>> } | null;
        const stops = itinerary?.stops ?? [];
        // ממיר את התחנות השמורות בחזרה לצורת CandidatePlace - חלק
        // מהשדות (תגיות/כשרות/נגישות) לא נשמרו בפועל בתחנה עצמה, אז
        // ממלאים ברירות מחדל ריקות/ניטרליות (לא משפיע על תצוגת התוצאות -
        // מפה/רשימה/מחיקה - רק על שדות שלא מוצגים שם בכלל).
        const restoredPlaces = stops.map(
          (s) =>
            ({
              id: s.placeId,
              name: s.name,
              category: s.category,
              subcategory: null,
              shortDescription: s.shortDescription ?? null,
              imageUrls: s.imageUrls ?? [],
              rating: s.rating ?? null,
              ratingCount: null,
              priceLevel: s.priceLevel ?? null,
              estimatedVisitMinutes: s.estimatedVisitMinutes ?? null,
              latitude: s.latitude,
              longitude: s.longitude,
              distanceKm: 0,
              etaMinutes: s.etaMinutes ?? 0,
              tripTypeTags: [],
              cuisineTags: [],
              kosher: null,
              accessible: null,
              suitableChildAges: [],
              budgetTier: null,
              isAreaExperience: false,
            }) as unknown as CandidatePlace
        );

        const destination = answers?.destination ?? "";
        // *** cityValue הוא הערך הגולמי (למשל "דובאי") ששמור בפועל
        // ב-places.city - זה מה שחייב לשמש לחיפוש. destination הוא
        // התווית לתצוגה בלבד ("דובאי, איחוד האמירויות") - שימוש בו
        // כערך חיפוש (הבאג המקורי) תמיד מחזיר 0 תוצאות, כי אף עמודה
        // ב-DB לא שווה למחרוזת המשולבת "עיר, מדינה".
        const cityValue = answers?.cityValue || destination;
        const restoredCompleted = Array.isArray(answers?.completedCategories) ? answers!.completedCategories! : [];
        setSelectedCity(cityValue);
        setSelectedCityLabel(destination);
        setSessionLikedPlaces(restoredPlaces);
        setCompletedCategories(restoredCompleted);
        setTripRecordId(resumeSessionId);
        setHeroVisible(false);

        // *** קפיצה ישירה להחלקות בקטגוריה הבאה - לא עוצרים במסך התוצאות
        // (שם המשתמש יצטרך ללחוץ "המשך" שוב, בלי לראות שינוי ויזואלי -
        // בדיוק מה שהתבלבל). אם אין קטגוריה נוספת (כבר עברו על כל 3),
        // נופלים חזרה למסך התוצאות הרגיל.
        const nextBucket = TRIPMATCH_CATEGORY_BUCKETS.find(
          (bucket) => CONTINUE_CATEGORY_VALUES.includes(bucket.value) && !restoredCompleted.includes(bucket.value)
        );
        if (nextBucket && cityValue) {
          // *** ה-fetch הפנימי כאן (יצירת session חדש להחלקות) יכול
          // לקחת הרבה שניות אם צריך ליצור המלצות AI חדשות לקטגוריה הזו -
          // resuming נשאר true (מציג מסך טעינה) עד שהוא באמת מסתיים.
          handleSelectCategory(nextBucket.value, nextBucket.label, { cityOverride: cityValue }).finally(() =>
            setResuming(false)
          );
        } else {
          setStage("results");
          setResuming(false);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "לא הצלחנו לטעון את הטיול השמור");
        setResuming(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // *** תוספת (בקשה מפורשת - "ברגע שאני פותח את האפליקציה זה יהיה על
  // המיקום שלי אוטומטית"): בעמוד /tripmatch העצמאי (לא מוטמע ב-Home,
  // ששם כבר יש התנהגות זהה משלו) - מפעילים "קרוב אלי" אוטומטית ברגע
  // שנטען, בלי לחכות ללחיצה ידנית. לא רץ אם יש כבר יעד נבחר, אם
  // משחזרים טיול שמור (resumeSessionId) או session מ-sessionStorage
  // (שני המצבים מטפלים בזה כבר למעלה) - רק במסך הפתיחה הנקי לגמרי.
  const autoNearMeRanRef = useRef(false);
  useEffect(() => {
    if (embedded) return;
    if (autoNearMeRanRef.current) return;
    if (stage !== "city" || selectedCity) return;
    if (searchParams.get("resumeSessionId")) return;
    autoNearMeRanRef.current = true;
    handleNearMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, stage, selectedCity, searchParams]);


  // שומר את מצב מסך התוצאות בכל שינוי, כדי שניווט החוצה וחזרה ישחזר בדיוק
  // איפה שהפסיקו (כולל "המשך לקטגוריה הבאה").
  useEffect(() => {
    if (stage !== "results" || sessionLikedPlaces.length === 0) return;
    try {
      sessionStorage.setItem(
        RESULTS_STATE_STORAGE_KEY,
        JSON.stringify({
          selectedCity,
          selectedCityLabel,
          categoryValue,
          categoryLabel,
          sessionLikedPlaces,
          completedCategories,
          tripRecordId,
        })
      );
    } catch {
      // אחסון לא זמין (מצב פרטי וכו') - לא קריטי, פשוט לא נשמר
    }
  }, [stage, selectedCity, selectedCityLabel, categoryValue, categoryLabel, sessionLikedPlaces, completedCategories, tripRecordId]);

  function clearPersistedResultsState() {
    try {
      sessionStorage.removeItem(RESULTS_STATE_STORAGE_KEY);
    } catch {
      // לא קריטי
    }
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedCity) return;
    if (cityInput.trim().length < 2) {
      setCityOptions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/places/cities?q=${encodeURIComponent(cityInput.trim())}`)
        .then((res) => res.json())
        .then((data) => setCityOptions(data.options ?? []))
        .catch(() => setCityOptions([]));
    }, 300);
  }, [cityInput, selectedCity]);

  function handleSelectCity(option: { value: string; label: string; type: "city" | "country" }, opts?: { immediate?: boolean }) {
    setSelectedCity(option.value);
    setSelectedCityLabel(option.label);
    setCityInput(option.label);
    setCityOptions([]);
    setHeroVisible(false);
    setCompletedCategories([]);
    setTripRecordId(null);
    setActiveCategoryFilters([]);
    clearPersistedResultsState();
    // *** שינוי (בקשה מפורשת - "כרטיסי 'הכל' מוצגים מיד, בלי בחירת
    // קטגוריה קודם"): לפני זה עברנו לשלב "category" (מסך בחירה חוסם).
    // עכשיו קופצים ישר להחלקות עם כל הקטגוריות יחד - העיגולים בעמוד
    // ההחלקות הם סינון אופציונלי על מה שכבר מוצג, לא שלב נפרד.
    // *** immediate: במצב מוטמע (Home) היעד כבר סופי ונקי - אין סיבה להמתין
    // 280ms (שהיו רק כדי שאנימציית הבחירה תסתיים) לפני בקשת הכרטיסים.
    if (opts?.immediate) handleBrowseAll(option.value);
    else window.setTimeout(() => handleBrowseAll(option.value), 280);
  }

  /** טוען את כל הקטגוריות יחד ליעד שנבחר (ללא בחירת קטגוריה קודמת) -
   *  אותו endpoint בדיוק כמו "קרוב אליי - אחר" (includeAllCategories),
   *  רק בלי lat/lng (חיפוש לפי שם עיר רגיל). */
  async function handleBrowseAll(cityOverride?: string) {
    const city = cityOverride ?? selectedCity;
    if (!city || busy) return;
    setBusy(true);
    setError(null);
    setFilters(EMPTY_FILTERS);
    setCategoryValue(null);
    setCategoryLabel("הכל");
    try {
      // *** תוספת (בקשה מפורשת - "מרחק מהמיקום הנוכחי"): המיקום האמיתי של המשתמש (אם כבר ידוע, ר'
      // utils/sessionLocation.ts) - להצגת מרחק אמיתי בכרטיס, בנפרד ממוקד החיפוש עצמו.
      const savedLocation = getSessionLocation();
      const response = await fetch("/api/tripmatch/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          category: "attractions",
          interests: [],
          includeAllCategories: true,
          ...(savedLocation ? { userLat: savedLocation.lat, userLng: savedLocation.lng } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "לא הצלחנו להתחיל");
      setSessionId(data.session.id);
      setCandidates(data.candidates ?? []);
      setUserPreferences(data.userPreferences ?? null);
      setCandidateIndex(0);
      setDecidedIds([]);
      decidingRef.current.clear();
      setStage("swiping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו להתחיל, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  // *** תיקון (Home - כניסה ל-TripMatch): כש-embedded=true, שורת החיפוש
  // של Home היא זו שמזינה את היעד - ה-cityInput כאן פשוט עוקב אחריה
  // (בלי לבקש מהמשתמש להקליד שוב, "אין לאפס את הערך"). לא רץ יותר אחרי
  // שכבר נבחרה עיר (selectedCity) - כדי לא "לדרוס" בחירה/מסך תוצאות קיים.
  useEffect(() => {
    if (!embedded || selectedCity) return;
    setCityInput(initialCityQuery ?? "");
  }, [embedded, initialCityQuery, selectedCity]);

  // *** שינוי (בקשה מפורשת - "הכרטיסיות אמורות לעלות מיידית"): במצב מוטמע
  // היעד מגיע מ-Home כבר נקי וסופי - option.value מהשלמת היעד בשורת החיפוש,
  // או שם העיר מזיהוי המיקום (השרת מטפל בהבדלי ניסוח כמו "תל אביב-יפו").
  // לכן מתחילים לטעון את הכרטיסים *מיד* בטעינת הרכיב. לפני זה: המתנה
  // ל-debounce של 550ms + בקשת השלמה אוטומטית (שלפעמים עוד לא חזרה ב-550ms,
  // ואז נפלנו לטקסט הגולמי בכל מקרה) + עוד 280ms - כל אלה לפני שבכלל
  // נשלחה הבקשה לשרת. אם שוחזרה חפיסה מהמטמון (restoredDeck) - אין מה לטעון.
  const embeddedStartedRef = useRef(false);
  useEffect(() => {
    if (!embedded || selectedCity || restoredDeck) return;
    if (embeddedStartedRef.current) return;
    const query = (initialCityQuery ?? "").trim();
    if (!query) return;
    embeddedStartedRef.current = true;
    handleSelectCity({ value: query, label: query, type: "city" }, { immediate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, initialCityQuery, selectedCity, restoredDeck]);

  function handleEditDestination() {
    // *** תיקון (Home - מוטמע): כש-embedded=true, שורת החיפוש של Home
    // היא ה"עריכת יעד" האמיתית - במקום להציג כאן שוב את מסך "איפה
    // תרצו לטייל?" הפנימי של TripMatch (עם ה-Hero שלו, שלא אמור להופיע
    // בכלל במצב מוטמע), פשוט חוזרים למצב ההתחלתי של Home (Reverse
    // Scroll) והמשתמש עורך ישירות בשורת החיפוש.
    if (embedded && onExitEmbedded) {
      onExitEmbedded();
      return;
    }
    setStage("city");
    setHeroVisible(true);
    setCategoryValue(null);
    setNearMeActive(false);
    setOtherQuery("");
    setOtherTags([]);
    setNearMeOtherQuery("");
    setNearMeOtherTags([]);
    setActiveCategoryFilters([]);
    setCompletedCategories([]);
    setSessionLikedPlaces([]);
    setTripRecordId(null);
    clearPersistedResultsState();
  }

  function handleEditCategory() {
    setStage("category");
    setNearMeActive(false);
  }

  async function handleSelectCategory(
    value: string,
    label: string,
    opts?: {
      interests?: string[];
      isNearMe?: boolean;
      cityOverride?: string;
      geo?: { lat: number; lng: number; radiusKm: number; includeAll?: boolean };
    }
  ) {
    setCategoryValue(value);
    setCategoryLabel(label);
    setNearMeActive(opts?.isNearMe ?? false);
    // *** "קרוב אליי" קורא לפונקציה הזו מיד אחרי שמעדכנים state - אי אפשר
    // להסתמך על ה-state סינכרונית (עדיין לא התעדכן), אז מעבירים את העיר
    // ישירות דרך cityOverride.
    const city = opts?.cityOverride ?? selectedCity;
    if (!city || busy) return;
    setBusy(true);
    setError(null);
    setFilters(EMPTY_FILTERS);
    try {
      // *** תוספת (בקשה מפורשת - "מרחק מהמיקום הנוכחי"): ר' ההערה המקבילה למעלה.
      const savedLocation = getSessionLocation();
      const response = await fetch("/api/tripmatch/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          category: value,
          interests: opts?.interests ?? [],
          // "קרוב אליי" - חיפוש רדיוס אמיתי מקואורדינטות (לא לפי שם עיר).
          ...(opts?.geo
            ? { lat: opts.geo.lat, lng: opts.geo.lng, radiusKm: opts.geo.radiusKm, includeAllCategories: opts.geo.includeAll ?? false }
            : {}),
          ...(savedLocation ? { userLat: savedLocation.lat, userLng: savedLocation.lng } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "לא הצלחנו להתחיל");
      setSessionId(data.session.id);
      setCandidates(data.candidates ?? []);
      setUserPreferences(data.userPreferences ?? null);
      setCandidateIndex(0);
      setDecidedIds([]);
      decidingRef.current.clear();
      // "אחר" - מסננים גם בצד לקוח לפי התגיות הספציפיות שנבחרו (לא רק
      // לפי הקטגוריה הראשית שנגזרה מהן), כדי שהתוצאות יהיו ממוקדות.
      if (opts?.interests && opts.interests.length > 0) {
        setFilters((f) => ({ ...f, tags: opts.interests! }));
      }
      setStage("swiping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו להתחיל, נסו שוב");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenOtherPicker() {
    setOtherQuery("");
    setOtherTags([]);
    setStage("otherPicker");
  }

  const otherSuggestions = useMemo(() => {
    const query = otherQuery.trim();
    if (query.length === 0) return [];
    return TRIPMATCH_INTEREST_OPTIONS.filter((option) => !otherTags.includes(option.value) && option.label.includes(query)).slice(0, 8);
  }, [otherQuery, otherTags]);

  function addOtherTag(value: string) {
    setOtherTags((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setOtherQuery("");
  }

  function removeOtherTag(value: string) {
    setOtherTags((prev) => prev.filter((v) => v !== value));
  }

  function handleStartOther() {
    if (otherTags.length === 0) return;
    // גוזרים את הקטגוריה הראשית (חובה ב-API) לפי הדלי עם הכי הרבה חפיפה
    // עם התגיות שנבחרו - כדי שלא נצטרך להציג עוד בחירה למשתמש.
    let bestBucket = TRIPMATCH_CATEGORY_BUCKETS[0];
    let bestOverlap = -1;
    for (const bucket of TRIPMATCH_CATEGORY_BUCKETS) {
      const overlap = bucket.subTagValues.filter((v) => otherTags.includes(v)).length;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestBucket = bucket;
      }
    }
    handleSelectCategory(bestBucket.value, "אחר - התאמה אישית", { interests: otherTags });
  }

  // *** במצב מוטמע: המיקום כבר נשמר ב-Home (utils/sessionLocation.ts) - משתמשים
  // בו מיד, בלי לבקש GPS שוב באמצע ההחלקות (שגרם גם לחישוב מחדש של המרחקים
  // ולרינדור נוסף של הכרטיס הנוכחי).
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() => {
    if (!embedded) return null;
    const saved = getSessionLocation();
    return saved ? { lat: saved.lat, lng: saved.lng } : null;
  });
  const [locating, setLocating] = useState(false);
  const NEAR_ME_RADIUS_KM = 10;

  /** לוחצים "קרוב אליי" -> מאתרים מיקום, ואז עוברים למסך ביניים לבחירת
   *  קטגוריה (או "הכל") - לפני שמתחילים להחליק. לא קופצים ישר להחלקות. */
  async function handleNearMe() {
    if (busy || locating) return;
    setError(null);
    setLocating(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let rawCityName: string | null = null;

      // מעדיפים את הכתובת שנבחרה כברירת מחדל בעמוד הבית (מדויקת, נבחרה
      // ידנית ע"י המשתמש) - כדי שהמיקום יהיה מסונכרן עם "המיקום שלי"
      // שם. רק אם אין כתובת שמורה כזו, מבקשים מיקום GPS טרי מהדפדפן.
      if (user) {
        const supabase = createClient();
        const addresses = await listAddresses(supabase, user.id);
        const defaultAddress = addresses.find((a) => a.is_default) ?? addresses[0];
        if (defaultAddress?.latitude != null && defaultAddress?.longitude != null) {
          lat = defaultAddress.latitude;
          lng = defaultAddress.longitude;
          rawCityName = defaultAddress.city;
        }
      }

      if (lat == null || lng == null) {
        // *** getCurrentPositionSafe (לא getCurrentPosition הגולמי) - יש
        // WebViews (בעיקר בתוך אפליקציית native) שאף פעם לא קוראים לאף
        // callback של ה-API, גם לא אחרי timeout - התוצאה בלי ההגנה הזו
        // הייתה "טוען לנצח" בלי שום הודעת שגיאה.
        const pos = await getCurrentPositionSafe();
        lat = pos.lat;
        lng = pos.lng;
        // ה-city כאן משמש רק לתצוגה (כותרת) - לא לחיפוש עצמו, שרץ לפי
        // רדיוס אמיתי מהקואורדינטות. אם reverse geocoding נכשל, ממשיכים
        // בכל זאת עם שם גנרי.
        try {
          const geoRes = await fetch(`/api/places/reverse-geocode?lat=${lat}&lng=${lng}`);
          const geoData = await geoRes.json();
          if (geoRes.ok) rawCityName = geoData.city ?? null;
        } catch {
          rawCityName = null;
        }
      }

      setUserLocation({ lat, lng });
      const cityLabel = rawCityName ?? "האזור שלי";
      setSelectedCity(cityLabel);
      setSelectedCityLabel(cityLabel);
      setCityInput(cityLabel);
      setHeroVisible(false);
      setLocating(false);
      setStage("nearMeCategory");
    } catch (err) {
      setLocating(false);
      setError(err instanceof Error ? err.message : "לא הצלחנו לזהות את המיקום שלך, נסו שוב");
    }
  }

  /** נקרא ממסך הביניים של "קרוב אליי" - בחירת אחת מ-4 הקטגוריות הראשיות. */
  function handleConfirmNearMeCategory(value: string, label: string) {
    if (!userLocation) return;
    handleSelectCategory(value, label, {
      isNearMe: true,
      cityOverride: selectedCity ?? undefined,
      geo: { lat: userLocation.lat, lng: userLocation.lng, radiusKm: NEAR_ME_RADIUS_KM },
    });
  }

  function handleOpenNearMeOtherPicker() {
    setNearMeOtherQuery("");
    setNearMeOtherTags([]);
    setStage("nearMeOtherPicker");
  }

  const nearMeOtherSuggestions = useMemo(() => {
    const query = nearMeOtherQuery.trim();
    if (query.length === 0) return [];
    return NEAR_ME_OTHER_OPTIONS.filter(
      (option) => !nearMeOtherTags.includes(option.value) && option.label.includes(query)
    ).slice(0, 8);
  }, [nearMeOtherQuery, nearMeOtherTags]);

  function addNearMeOtherTag(value: string) {
    setNearMeOtherTags((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setNearMeOtherQuery("");
  }

  function removeNearMeOtherTag(value: string) {
    setNearMeOtherTags((prev) => prev.filter((v) => v !== value));
  }

  /** "המשך לחיפוש" מתוך "אחר" בתוך "קרוב אליי" - מציג את כל הקטגוריות
   *  (בלי סינון category), אבל מסנן לפי תגיות ההתאמה האישית שנבחרו. */
  function handleConfirmNearMeOther() {
    if (!userLocation || nearMeOtherTags.length === 0) return;
    handleSelectCategory("attractions", "אחר - קרוב אליי", {
      isNearMe: true,
      cityOverride: selectedCity ?? undefined,
      interests: nearMeOtherTags,
      geo: { lat: userLocation.lat, lng: userLocation.lng, radiusKm: NEAR_ME_RADIUS_KM, includeAll: true },
    });
  }


  // *** חדש (בקשה מפורשת - "הטיול שלי צריך להיות בעמוד נוסף, ולא בעמוד הבית
  // בלי הכרטיסיות"): במצב מוטמע (Home) "לטיול שלי" / סיום החפיסה כבר לא מחליפים
  // את הכרטיסיות בתוצאות בתוך עמוד הבית. יוצרים/מעדכנים את שורת הטיול ופותחים
  // את עמוד הטיול השמור (/trip-builder/tripmatch/result) - עמוד נפרד. הכרטיסיות
  // נשארות בעמוד הבית (החפיסה נשמרת במטמון), וחזרה מחזירה בדיוק אליהן.
  const openingTripRef = useRef(false);
  async function openTripPage() {
    if (openingTripRef.current) return;
    openingTripRef.current = true;
    try {
      const city = selectedCityLabel || selectedCity;
      if (!city) throw new Error("חסר יעד");
      const response = await fetch("/api/trip-builder/sessions/from-tripmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          cityValue: selectedCity,
          places: sessionLikedPlaces,
          sessionId: tripRecordIdRef.current ?? undefined,
          completedCategories,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.sessionId) throw new Error(data?.error ?? "לא הצלחנו לפתוח את הטיול, נסו שוב");
      tripRecordIdRef.current = data.sessionId;
      setTripRecordId(data.sessionId);
      router.push(`/trip-builder/tripmatch/result?sessionId=${data.sessionId}&from=home`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא הצלחנו לפתוח את הטיול, נסו שוב");
    } finally {
      openingTripRef.current = false;
    }
  }

  function handleFinish() {
    if (sessionLikedPlaces.length === 0) {
      if (embedded && onExitEmbedded) onExitEmbedded();
      else router.push("/home");
    } else if (embedded) {
      openTripPage();
    } else {
      setStage("results");
    }
  }

  // *** מסמן את הקטגוריה הנוכחית כ"הושלמה" ברגע שמגיעים למסך התוצאות -
  // כדי ש"המשך לקטגוריה הבאה" ידע איזו מ-3 הקטגוריות עוד לא נסרקה.
  useEffect(() => {
    if (stage !== "results" || !categoryValue) return;
    if (!CONTINUE_CATEGORY_VALUES.includes(categoryValue)) return;
    setCompletedCategories((prev) => (prev.includes(categoryValue) ? prev : [...prev, categoryValue]));
  }, [stage, categoryValue]);

  const nextContinueCategory = TRIPMATCH_CATEGORY_BUCKETS.find(
    (bucket) => CONTINUE_CATEGORY_VALUES.includes(bucket.value) && !completedCategories.includes(bucket.value)
  );

  function handleContinueToNextCategory() {
    if (!nextContinueCategory) return;
    handleSelectCategory(nextContinueCategory.value, nextContinueCategory.label);
  }

  /** שיתוף טיול ה-TripMatch - בדיוק אותו דפוס כמו שאר עמודי התוצאות
   *  (navigator.share אם קיים, אחרת נופל לוואטסאפ). דורש tripRecordId
   *  כי הקישור המשותף מפנה לעמוד הצפייה בטיול השמור. */
  async function handleShareTrip() {
    if (!tripRecordId) return;
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1500);

    const url = typeof window !== "undefined" ? `${window.location.origin}/trip-builder/tripmatch/result?sessionId=${tripRecordId}` : "";
    const text = `הטיול שלי ב-TRIPLACE! תראו את המקומות שאהבתי: ${url}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "הטיול שלי ב-TRIPLACE", text, url });
        return;
      } catch {
        // המשתמש ביטל את ה-share sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  // *** יוצר/מעדכן את שורת הטיול ב-DB בכל שינוי ברשימת האהבתם (מגיעים
  // לתוצאות, ממשיכים לקטגוריה הבאה וחוזרים עם עוד לייקים, או מוחקים
  // מקום מהרשימה) - כדי שהטיול תמיד יהיה עדכני תחת "כל הטיולים", בלי
  // תלות בלחיצה מפורשת על כפתור שמירה.
  useEffect(() => {
    if (stage !== "results" || sessionLikedPlaces.length === 0) return;
    const city = selectedCityLabel || selectedCity;
    if (!city) return;

    let cancelled = false;
    setSyncingTrip(true);

    // *** תופסים snapshot של הרשימות כרגע (לא סומכים על closure מאוחר
    // יותר) - ה-run מוסיף לתור ועשוי לרוץ רק אחרי שהאפקט הבא כבר הופעל,
    // אז חייבים לשמור בדיוק את הערכים ששייכים להפעלה הזו של האפקט.
    const placesSnapshot = sessionLikedPlaces;
    const completedSnapshot = completedCategories;

    const run = async () => {
      if (cancelled) return;
      try {
        const res = await fetch("/api/trip-builder/sessions/from-tripmatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // *** cityValue (הערך הגולמי, "דובאי" - לא "דובאי, איחוד האמירויות")
          // חייב להישמר בנפרד מ-city (התווית לתצוגה) - ראו הסבר מפורט
          // ב-from-tripmatch/route.ts. בלי זה, "המשך לקטגוריה הבאה" מטיול
          // שמור מחפש עם התווית המלאה ותמיד מוצא 0 תוצאות.
          // *** sessionId נלקח מה-ref (לא מ-state/closure) - כדי שאם קריאת
          // סנכרון קודמת בתור כבר יצרה את השורה, הקריאה הזו תעדכן אותה
          // (UPDATE) במקום ליצור שורה חדשה (INSERT) ולגרום לכפילות.
          body: JSON.stringify({
            city,
            cityValue: selectedCity,
            places: placesSnapshot,
            sessionId: tripRecordIdRef.current ?? undefined,
            completedCategories: completedSnapshot,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "יצירת הטיול נכשלה");
        // *** תיקון (הטיול עדיין נשמר פעמיים ב"הטיולים שלי"): גם עם
        // התור (syncQueueRef), אם ה-effect הזה כבר "בוטל" (cancelled)
        // עד שהתשובה חזרה - השורה כבר *נוצרה בפועל* בשרת, אבל ה-ref
        // לא היה מתעדכן (המקור הישן חסם את זה מאחורי !cancelled) - כך
        // שקריאת הסנכרון הבאה בתור לא ידעה שכבר יש sessionId, ויצרה
        // שורה שנייה (INSERT) במקום לעדכן את הקיימת (UPDATE). ה-ref
        // חייב להתעדכן תמיד כשיש תשובה מוצלחת, בלי קשר ל-cancelled -
        // הוא לא state ויזואלי, הוא רק "זיכרון" של איזו שורה כבר קיימת
        // בשרת. רק setTripRecordId (שגורם ל-re-render) עדיין מוגן מאחורי
        // cancelled, כדי לא לעדכן state של הפעלה ישנה של האפקט.
        if (data?.sessionId) {
          tripRecordIdRef.current = data.sessionId;
          if (!cancelled) setTripRecordId(data.sessionId);
        }
      } catch (err) {
        // *** לא מציגים שגיאה חוסמת (זה סנכרון רקע, לא פעולה שהמשתמש
        // ביקש במפורש) - אבל כן רושמים ל-console, כדי שכשל בשקט (למשל
        // constraint שדוחה את ה-insert) לא ייעלם בלי עקבות כמו שקרה כאן.
        if (!cancelled) console.error("tripmatch trip sync failed:", err);
      } finally {
        if (!cancelled) setSyncingTrip(false);
      }
    };

    // *** משרשרים אחרי כל קריאה קודמת שעוד לא הסתיימה, במקום להפעיל
    // fetch מקביל - זה בדיוק מה שמונע את המצב של שתי בקשות יוצאות
    // כשעדיין אין sessionId משותף ביניהן.
    syncQueueRef.current = syncQueueRef.current.then(run);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, sessionLikedPlaces, completedCategories]);

  async function handleRemoveLikedPlace(placeId: string) {
    setSessionLikedPlaces((prev) => prev.filter((p) => p.id !== placeId));
    if (!user) return;
    const supabase = createClient();
    await toggleFavorite(supabase, user.id, placeId, "tripadd", "liked").catch(() => {});
  }

  // החפיסה הסתיימה = כל מי שנטען כבר הוחלט עליו (לייק/דילוג). לפני זה: "אין
  // יותר מועמדים" נגזר מהרשימה שהשרת החזיר אחרי כל החלטה.
  const allDecided =
    candidates.length > 0 && decidedIds.length >= candidates.length && candidates.every((c) => decidedIds.includes(c.id));
  useEffect(() => {
    if (stage === "swiping" && hasSwipedAny && allDecided && !busy) {
      if (deckCacheKey) clearDeck(deckCacheKey);
      handleFinish();
    }
  }, [stage, hasSwipedAny, allDecided, busy, sessionLikedPlaces, router]);

  // שומר את החפיסה במטמון בכל שינוי (החלטה חדשה, לייק וכו') - כדי שחזרה
  // לעמוד הבית תשחזר בדיוק את המצב הנוכחי. ר' utils/tripMatchDeckCache.ts.
  useEffect(() => {
    if (!deckCacheKey || stage !== "swiping" || !sessionId || candidates.length === 0) return;
    writeDeck(deckCacheKey, {
      sessionId,
      cityValue: selectedCity ?? deckCacheKey,
      cityLabel: selectedCityLabel || deckCacheKey,
      candidates,
      userPreferences,
      decidedIds,
      likedPlaces: sessionLikedPlaces,
    });
  }, [deckCacheKey, stage, sessionId, candidates, userPreferences, decidedIds, sessionLikedPlaces, selectedCity, selectedCityLabel]);

  useEffect(() => {
    if (stage !== "swiping" || userLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null)
    );
  }, [stage, userLocation]);

  // *** חפיסה קבועה (בקשה מפורשת): deck = כל החפיסה אחרי הסינון והמיון (כולל מי
  // שכבר הוחלט עליו) - גודלה הוא ה-Y הקבוע ב-"X/Y". visibleCandidates = מי
  // שנשאר להחליק. הסדר יציב: candidates לא מוחלף יותר אחרי כל החלטה, והמיון
  // (אחוז התאמה) הוא פונקציה דטרמיניסטית של נתונים קבועים.
  const { deck, visibleCandidates } = useMemo(() => {
    const withDistance = !userLocation
      ? candidates
      : candidates.map((c) => {
          const distanceKm = haversineDistanceKm(userLocation, { lat: c.latitude, lng: c.longitude });
          return { ...c, distanceKm, etaMinutes: estimateTravelMinutes(distanceKm, "drive") };
        });
    // מצב "קרוב אליי" - מגבילים לעד 10 ק"מ ממיקום המשתמש בפועל (לא רק ממיינים).
    const distanceLimited = nearMeActive && userLocation ? withDistance.filter((c) => c.distanceKm <= 10) : withDistance;
    const categoryFiltered =
      activeCategoryFilters.length === 0
        ? distanceLimited
        : distanceLimited.filter((c) => activeCategoryFilters.some((id) => matchesQuickCategoryFilter(c, id)));
    const filtered = applyFilters(categoryFiltered, filters);
    const sorted = [...filtered].sort(
      (a, b) => computeMatchPercent(b, filters, userPreferences) - computeMatchPercent(a, filters, userPreferences)
    );
    const decided = new Set(decidedIds);
    return { deck: sorted, visibleCandidates: sorted.filter((c) => !decided.has(c.id)) };
  }, [candidates, filters, userLocation, userPreferences, nearMeActive, activeCategoryFilters, decidedIds]);
  const deckSize = deck.length;
  /** כמה כבר הוחלט בתוך החפיסה הנוכחית (אחרי סינון) - "X-1" ב-"X/Y". */
  const totalDecisions = deckSize - visibleCandidates.length;
  const currentCandidate = visibleCandidates[candidateIndex];
  const currentPhotoIndex =
    currentCandidate && photoState.candidateId === currentCandidate.id ? photoState.index : 0;

  /** לחיצה על הכרטיס הקדמי: צדדים = תמונה הבאה/קודמת, אמצע = עמוד המקום. */
  function handleCardTap({ xFraction }: { xFraction: number }) {
    if (!currentCandidate) return;
    const imageCount = currentCandidate.imageUrls.length;
    const action = resolveCardTap(xFraction, imageCount);
    if (action === "open") {
      router.push(`/place/${currentCandidate.id}`);
      return;
    }
    const delta = action === "next" ? 1 : -1;
    const nextIndex = Math.min(Math.max(currentPhotoIndex + delta, 0), imageCount - 1);
    if (nextIndex !== currentPhotoIndex) {
      setPhotoState({ candidateId: currentCandidate.id, index: nextIndex });
    }
  }

  /** שולח החלטה לשרת - בתור, כדי שההחלטות יגיעו בדיוק בסדר שבו נעשו.
   *  skipCandidates: הלקוח כבר לא משתמש ברשימה שהשרת היה מחזיר (החפיסה
   *  קבועה) - השרת מדלג על שליפת המועמדים מחדש, וזה מקצר משמעותית כל קריאה. */
  function sendDecision(
    sid: string,
    placeId: string,
    liked: boolean
  ): Promise<{ ok: boolean; data: { error?: string; cost?: number; remainingTokens?: number } | null }> {
    const run = async () => {
      try {
        const response = await fetch(`/api/tripmatch/sessions/${sid}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ placeId, liked, skipCandidates: true }),
        });
        const data = await response.json().catch(() => null);
        return { ok: response.ok, data };
      } catch {
        return { ok: false, data: null };
      }
    };
    const next = decisionQueueRef.current.then(run, run);
    decisionQueueRef.current = next;
    return next;
  }

  /** *** שינוי (בקשה מפורשת - "מדויק ומיידי, בלי משחקים במעברים"): גם לייק
   *  וגם דילוג הם עכשיו *אופטימיים ומיידיים* - הכרטיס הבא מופיע באותו רגע,
   *  בלי להמתין לשרת, והחפיסה עצמה לא משתנה (רק מסמנים את המקום כ"הוחלט").
   *  קריאת השרת רצה ברקע, בתור.
   *  - דילוג: כשל ברשת לא חוסם כלום (כמו קודם).
   *  - לייק עולה טריפים: אם השרת דחה (אין מספיק טריפים / שגיאה) - מבטלים את
   *    הלייק, הכרטיס חוזר לראש החפיסה ומוצגת הודעה. זה המקרה היחיד שבו
   *    כרטיס חוזר, והוא נובע מכך שהלייק באמת לא נשמר. */
  function handleDecision(liked: boolean) {
    if (!sessionId || !currentCandidate) return;
    const decidedPlace = currentCandidate;
    // הגנה מפני הפעלה כפולה של אותה החלטה (לחיצה כפולה מהירה).
    if (decidingRef.current.has(decidedPlace.id)) return;
    decidingRef.current.add(decidedPlace.id);

    setLastDecision({ candidate: decidedPlace, liked });
    setHasSwipedAny(true);
    setError(null);
    setDecidedIds((prev) => (prev.includes(decidedPlace.id) ? prev : [...prev, decidedPlace.id]));
    setCandidateIndex(0);
    if (liked) {
      setSessionLikedPlaces((prev) => (prev.some((p) => p.id === decidedPlace.id) ? prev : [...prev, decidedPlace]));
      setLikedPlace(decidedPlace);
    }

    sendDecision(sessionId, decidedPlace.id, liked).then(({ ok, data }) => {
      if (ok || !liked) return;
      // הלייק לא נשמר בשרת - מבטלים אותו והכרטיס חוזר.
      decidingRef.current.delete(decidedPlace.id);
      setDecidedIds((prev) => prev.filter((id) => id !== decidedPlace.id));
      setSessionLikedPlaces((prev) => prev.filter((p) => p.id !== decidedPlace.id));
      setLikedPlace((current) => (current?.id === decidedPlace.id ? null : current));
      setLastDecision((current) => (current?.candidate.id === decidedPlace.id ? null : current));
      setSwipeResetTick((t) => t + 1);
      if (data?.error === "INSUFFICIENT_TOKENS") {
        setError(
          `אין לכם מספיק טריפים לביצוע לייק · לייק ב-TripMatch עולה ${data.cost ?? 10} טריפים · נשארו לכם ${data.remainingTokens ?? 0} טריפים`
        );
      } else {
        setError(data?.error ?? "שמירת הלייק נכשלה - נסו שוב.");
      }
    });
  }

  if (!ready) return null;

  /** כפתור "חזור" - מבטל את ההחלטה האחרונה: מחזיר את המועמד לראש התור
   *  ומסיר אותו מ"אהבתי" אם היה לייק. ר' ההערה ליד lastDecision למעלה
   *  לגבי מה שזה *לא* עושה (לא מזכה טריפים, לא מבטל בשרת). */
  function handleRewind() {
    if (!lastDecision) return;
    const { candidate, liked } = lastDecision;
    // החפיסה קבועה - "חזור" פשוט מחזיר את המקום למצב "לא הוחלט", והוא חוזר
    // לראש התור (הוא היה האחרון שהוחלט, וסדר החפיסה יציב).
    decidingRef.current.delete(candidate.id);
    setDecidedIds((prev) => prev.filter((id) => id !== candidate.id));
    setCandidateIndex(0);
    if (liked) {
      setSessionLikedPlaces((prev) => prev.filter((p) => p.id !== candidate.id));
    }
    setSwipeResetTick((t) => t + 1);
    setLastDecision(null);
  }

  /** כרטיס "להוספת מקומות" - מוצג כשאין עוד מועמד להחליק (ר' JSX למטה).
   *  embedded: קורא ל-onAddPlaceClick (Home פותחת את ה-AddPlaceModal
   *  הקיים שלה ישירות). standalone: מנווט ל-/home עם ?openAddPlace=1
   *  (אין AddPlaceModal בעמוד /tripmatch העצמאי עצמו). */
  function handleAddPlaceClick() {
    if (embedded && onAddPlaceClick) onAddPlaceClick();
    else router.push("/home?openAddPlace=1");
  }

  // *** מסך טעינה מפורש בזמן טעינת/המשך טיול שמור - בלי זה, הבקשה
  // האיטית (יצירת המלצות AI לקטגוריה חדשה יכולה לקחת עשרות שניות)
  // נראית כאילו "כלום לא קורה" בזמן שבפועל היא עדיין בתהליך.
  if (resuming) {
    return (
      <Screen withBottomNavSpacing={!embedded} fullHeight={!embedded} className="!bg-bg !px-0 !pt-0">
        <div className="flex h-[70vh] flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-bg-secondary border-t-accent" />
          <p className="text-sm font-medium text-ink-secondary">טוענים את הקטגוריה הבאה... זה יכול לקחת כמה שניות</p>
        </div>
        {!embedded && <MainBottomNav active="tripmatch" />}
      </Screen>
    );
  }

  return (
    <Screen
      withBottomNavSpacing={!embedded}
      fullHeight={!embedded}
      className={`!bg-bg !px-0 !pt-0 ${stage === "swiping" ? "!pb-0" : ""} ${embedded ? "flex flex-1 min-h-0 w-full min-w-0 max-w-full flex-col overflow-x-clip" : ""}`}
    >
      {!embedded && stage !== "swiping" && (
        <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
          <div className="relative h-16">
            <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <Image src="/images/trip-tripmatch-logo.png" alt="" width={110} height={34} className="object-contain" />
              <BackButton onBack={() => (embedded && onExitEmbedded ? onExitEmbedded() : router.push("/home"))} />
            </div>

            {/* מסך תוצאות - כפתורי שיתוף+שמירה בעיצוב זהה לשאר עמודי
                התוצאות באפליקציה (SaveTripIconButton המשותף + אותו כפתור
                שיתוף), במקום כפתור "שמירת הטיול" נפרד בגוף העמוד. */}
            {stage === "results" && sessionLikedPlaces.length > 0 && tripRecordId && (
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                <SaveTripIconButton sessionId={tripRecordId} />
                <button
                  type="button"
                  onClick={handleShareTrip}
                  aria-label="שתף טיול"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
                >
                  <Image src={justShared ? "/icons/share-active.png" : "/icons/share.png"} alt="" width={26} height={26} />
                </button>
              </div>
            )}
          </div>
        </header>
      )}

      {/* *** תיקון (בקשה מפורשת - "מאיפה ה-HERO של ההחלקה? למה הוא פה?"): תמונת
          ה-Hero שייכת רק לעמוד /tripmatch העצמאי - לא מוצגת בעמוד הבית
          (embedded) בשום מצב. */}
      {!embedded && stage !== "swiping" && (
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{ maxHeight: heroVisible ? 260 : 0, opacity: heroVisible ? 1 : 0 }}
        >
          <div className="relative w-full">
            <Image src="/images/hero-tripmatch.png" alt="" width={800} height={450} priority className="h-56 w-full object-cover" />
          </div>
        </div>
      )}

      {/* *** תיקון מרכוז (Deck בורח שמאלה במסכים < 576px): עמודה עם
          mx-auto בתוך הורה flex-col לא נמתחת (auto margins מבטלים stretch)
          ומקבלת רוחב max-content - כלומר רוחב שורת הקטגוריות הגוללת (~544px),
          גם כשהמסך צר יותר. ב-RTL העודף גולש שמאלה והמרכז של ה-Deck זז
          איתו. w-full + min-w-0 נועלים את העמודה לרוחב ההורה בפועל. */}
      <div
        className={`mx-auto flex max-w-xl flex-col ${stage === "swiping" ? "" : stage === "results" ? "gap-3 px-5 pb-4 pt-5" : "gap-4 px-5 pb-10 pt-5"} ${embedded ? "w-full min-w-0 flex-1 min-h-0" : ""}`}
      >
        {/* "מה זה טריפים?" - כרטיס הסבר קטן ואנימטיבי בתוך העמוד (לא פופאפ), רק במסך הראשון של TripMatch */}
        {stage === "city" && !embedded && <TripsIntroCard />}

        {stage === "city" && embedded && (
          // *** שונה (בקשה מפורשת - "הכרטיסיות אמורות לעלות מיידית", ובלי
          // עיצובי טעינה): במצב מוטמע (Home) הטעינה מתחילה מיד בהתחברות הרכיב
          // (ר' embeddedStartedRef למעלה) - אין יותר מסך ביניים עם טקסט
          // "מכינים עבורכם המלצות...". רק ספינר קטן וחסר-טקסט, למקרה של
          // טעינה ראשונה (בלי חפיסה שמורה), כדי שהעמוד לא ייראה תקוע.
          <div className="flex flex-col items-center gap-3 py-16" aria-busy={!error}>
            {error ? (
              <>
                <p className="px-6 text-center text-sm text-danger">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    const query = (initialCityQuery ?? "").trim();
                    if (!query) return;
                    setError(null);
                    handleSelectCity({ value: query, label: query, type: "city" }, { immediate: true });
                  }}
                  className="rounded-pill bg-bg-secondary px-5 py-2 text-sm font-semibold text-ink"
                >
                  נסו שוב
                </button>
              </>
            ) : (
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-bg-secondary border-t-accent" />
            )}
          </div>
        )}

        {stage === "city" && !embedded && (
          <div className="flex flex-col gap-3">
            <ChatBubble>
              החליקו ימינה למקומות שאהבתם ושמאלה לאלה שפחות. ככל שתמשיכו להחליק, נכיר טוב יותר את הטעם שלכם ונמצא
              עבורכם את ההתאמה המושלמת.{"\n\n"}
              אז בואו נתחיל - איפה תרצו לטייל?
            </ChatBubble>

            <div className="relative">
              <input
                type="text"
                value={cityInput}
                onChange={(e) => {
                  setCityInput(e.target.value);
                  setSelectedCity(null);
                }}
                placeholder="לדוגמה: תל אביב, פריז..."
                className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {cityOptions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
                  {cityOptions.map((option) => (
                    <button
                      key={`${option.type}-${option.value}`}
                      type="button"
                      onClick={() => handleSelectCity(option)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                    >
                      <span>{option.label}</span>
                      {option.type === "country" && (
                        <span className="text-[11px] text-ink-secondary">מדינה שלמה</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNearMe}
              disabled={locating}
              className="mx-auto flex w-fit items-center justify-center gap-2 rounded-pill bg-white px-5 py-2.5 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-60"
              style={{ boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }}
            >
              <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                <Image src="/images/tripmatch/action-near-me.png" alt="" fill sizes="24px" className="object-cover" />
              </span>
              {locating ? "מאתרים את המיקום שלך..." : "קרוב אליי"}
            </button>
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </div>
        )}

        {stage === "category" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>מה בא לכם לעשות ב{selectedCityLabel || selectedCity}?</ChatBubble>
            <CategoryPicker
              onSelect={(value, label) => handleSelectCategory(value, label)}
              onOther={handleOpenOtherPicker}
            />
            {(busy || locating) && <p className="text-center text-sm text-ink-secondary">{locating ? "מאתרים את המיקום שלך..." : "טוען..."}</p>}
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </div>
        )}

        {stage === "nearMeCategory" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>
              מצאנו אתכם ב{selectedCityLabel || selectedCity}! מה תרצו לראות ברדיוס של {NEAR_ME_RADIUS_KM} ק&quot;מ?
            </ChatBubble>

            <div className="flex flex-wrap justify-center gap-2">
              {TRIPMATCH_CATEGORY_BUCKETS.map((bucket) => (
                <ImageOptionRow
                  key={bucket.value}
                  selected={false}
                  onClick={() => handleConfirmNearMeCategory(bucket.value, `${bucket.label} - קרוב אליי`)}
                  label={bucket.label}
                  imageSrc={bucket.imageSrc}
                />
              ))}
              <ImageOptionRow
                selected={false}
                onClick={handleOpenNearMeOtherPicker}
                label="אחר"
                imageSrc="/images/tripmatch/action-other.png"
              />
            </div>

            {busy && <p className="text-center text-sm text-ink-secondary">טוען...</p>}
            {error && <p className="text-center text-sm text-danger">{error}</p>}
          </div>
        )}

        {stage === "nearMeOtherPicker" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>מה מעניין אתכם? תתחילו להקליד ונציע לכם לפי ההתאמה האישית שלכם</ChatBubble>

            <div className="relative">
              <input
                type="text"
                value={nearMeOtherQuery}
                onChange={(e) => setNearMeOtherQuery(e.target.value)}
                placeholder="לדוגמה: חופים, מוזיאונים, קניות..."
                className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {nearMeOtherSuggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
                  {nearMeOtherSuggestions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => addNearMeOtherTag(option.value)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                    >
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-bg-secondary text-base leading-7">
                        {option.imageSrc ? (
                          <Image src={option.imageSrc} alt="" fill sizes="28px" className="object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">{option.emoji}</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {nearMeOtherTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {nearMeOtherTags.map((value) => {
                  const option = NEAR_ME_OTHER_OPTIONS.find((o) => o.value === value);
                  return (
                    <Chip key={value} selected onClick={() => removeNearMeOtherTag(value)}>
                      {option?.emoji ? `${option.emoji} ` : ""}
                      {option?.label ?? value} ✕
                    </Chip>
                  );
                })}
              </div>
            )}

            {busy && <p className="text-center text-sm text-ink-secondary">טוען...</p>}
            {error && <p className="text-center text-sm text-danger">{error}</p>}

            <button
              type="button"
              disabled={nearMeOtherTags.length === 0 || busy}
              onClick={handleConfirmNearMeOther}
              className="rounded-pill py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              המשך לחיפוש{nearMeOtherTags.length > 0 ? ` (${nearMeOtherTags.length})` : ""}
            </button>
          </div>
        )}

        {stage === "otherPicker" && (
          <div className="flex flex-col gap-3">
            <ChatBubble>מה מעניין אתכם ב{selectedCityLabel || selectedCity}? תתחילו להקליד ונציע לכם לפי ההתאמה האישית שלכם</ChatBubble>

            <div className="relative">
              <input
                type="text"
                value={otherQuery}
                onChange={(e) => setOtherQuery(e.target.value)}
                placeholder="לדוגמה: חופים, מוזיאונים, קניות..."
                className="w-full rounded-card border border-ink-secondary/25 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {otherSuggestions.length > 0 && (
                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-card bg-white shadow-lg">
                  {otherSuggestions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => addOtherTag(option.value)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-right text-sm text-ink hover:bg-bg-secondary"
                    >
                      <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-bg-secondary text-base leading-7">
                        <span className="flex h-full w-full items-center justify-center">{option.emoji}</span>
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {otherTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {otherTags.map((value) => {
                  const option = TRIPMATCH_INTEREST_OPTIONS.find((o) => o.value === value);
                  return (
                    <Chip key={value} selected onClick={() => removeOtherTag(value)}>
                      {option?.emoji ? `${option.emoji} ` : ""}
                      {option?.label ?? value} ✕
                    </Chip>
                  );
                })}
              </div>
            )}

            {busy && <p className="text-center text-sm text-ink-secondary">טוען...</p>}
            {error && <p className="text-center text-sm text-danger">{error}</p>}

            <button
              type="button"
              disabled={otherTags.length === 0 || busy}
              onClick={handleStartOther}
              className="rounded-pill py-3 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              המשך לחיפוש{otherTags.length > 0 ? ` (${otherTags.length})` : ""}
            </button>
          </div>
        )}

        {stage === "swiping" && (
          // *** תיקון (בקשה מפורשת - "הרווח מתחת לכפתורי הלייק/אנלייק
          // גדול מדי עד הבר התחתון"): כש-embedded=true אין יותר גובה
          // קבוע של 100dvh לכל המכל - הוא היה יוצר "שטח מת" (25% שנשארו
          // אחרי הקטנת הכרטיס ל-75%) *מתחת* לכפתורים, מעל ה-pb של Home.
          // עכשיו הגובה נקבע רק ע"י תוכן המכל (header + קטגוריות + כרטיס
          // בגובה מפורש - ר' .tripmatch-embedded-card-area ב-globals.css),
          // והכפתורים נשארים צמודים לתחתית ההורה. עמוד /tripmatch העצמאי
          // (embedded=false) לא השתנה.
          // *** תוספת (בקשה מפורשת - "הדבר היחיד שגולש זה סוגי הטיול"):
          // overflow-x-hidden כאן, ממוקד רק לאזור המוטמע הזה (לא על
          // Screen.tsx באופן גורף - זה מה ששבר בעבר את ההחלקה בשורת
          // הקטגוריות, ר' ההיסטוריה). עכשיו, אחרי שהוסר ה-touch-action:
          // pan-x הבעייתי מ-HomeQuickCategories, גלילה אופקית פנימית
          // (overflow-x-auto) ממשיכה לעבוד כרגיל גם בתוך אב עם
          // overflow-x-hidden - זו התנהגות CSS תקנית, לא סתירה. זו רשת
          // ביטחון קשיחה: מה שלא "אמור" לחרוג (הכרטיס, הכרטיסים מאחור)
          // עכשיו פיזית לא יכול לצאת מהעמודה הזו, לא משנה מאיזה חישוב.
          <div className={embedded ? "flex flex-1 min-h-0 flex-col" : "h-viewport-safe flex flex-col"}>
            {currentCandidate && (
              <SwipeHeader
                city={selectedCityLabel || selectedCity || ""}
                categoryLabel={categoryLabel}
                currentIndex={totalDecisions}
                total={totalDecisions + visibleCandidates.length}
                onBack={() => (embedded && onExitEmbedded ? onExitEmbedded() : router.push("/home"))}
                onEditDestination={handleEditDestination}
                onEditCategory={handleEditCategory}
                onOpenFilters={() => setFiltersOpen(true)}
                activeFilterCount={countActiveFilters(filters)}
                hideTopBar={embedded}
                hideCategoryPill={categoryValue === null}
                hideProgressBar={embedded}
              />
            )}

            {/* עיגולי סינון קטגוריה - בדיוק אותו קומפוננט כמו בעמוד הבית
                (HomeQuickCategories, לא עותק) - אופציונלי, לא חוסם: הכרטיסים
                כבר מוצגים למעלה מ"הכל" לפני שנוגעים בעיגול אחד. בחירה
                מרובה (OR) מסננת בצד הלקוח בלבד, בלי קריאת שרת נוספת. */}
            {candidates.length > 0 && (
              <div className="w-full min-w-0 max-w-full shrink-0">
                <HomeQuickCategories
                  selected={activeCategoryFilters}
                onToggle={toggleCategoryFilter}
                // בקשה מפורשת - "הפילטרים בשורה של הסוגים, הראשונים
                // מימין": במצב מוטמע (בלי הבר העליון עם כפתור הפילטר) הכפתור
                // יושב כאן, כפריט ראשון בשורת הסוגים. ב-/tripmatch העצמאי
                // הפילטר נשאר בבר העליון כמו קודם.
                leading={
                  embedded ? (
                    <FilterCircleButton onClick={() => setFiltersOpen(true)} activeFilterCount={countActiveFilters(filters)} />
                  ) : undefined
                }
                />
              </div>
            )}

            {/* *** תיקון (בקשה מפורשת - "ציר ההתקדמות צריך להיות מתחת
                לפילטרים"): במצב מוטמע פס ההתקדמות יושב *אחרי* שורת הסוגים
                (והפילטר), ישר מעל הכרטיס - לא מעליהם. באותם שוליים
                אופקיים (px-6) כמו שורת החיפוש והכרטיס. */}
            {embedded && currentCandidate && (
              <div className="px-8 pt-1.5">
                <SwipeProgressBar currentIndex={totalDecisions} total={totalDecisions + visibleCandidates.length} />
              </div>
            )}

            {error && <p className="px-5 pt-1 text-center text-sm text-danger">{error}</p>}

            {/* אזור הכרטיס - flex-1 סופג את כל הגובה הפנוי בין ה-header
                לתחתית המסך. בלי padding אופקי - הכרטיס נצמד לשני קצוות
                המסך ומהווה "עמוד מלא" (edge-to-edge), לא כרטיס צף בתוך
                שוליים לבנים. ה-padding-bottom (112px) שומר בדיוק על אותו
                מרווח בטוח שהיה קודם קבוע ב-Screen (pb-28) כדי שהכרטיס
                יגיע בדיוק עד קצה ה-BottomNav הצף, בלי חפיפה ובלי רווח
                מיותר.
                *** תיקון (Audit - "רווח גדול מדי בין הכפתורים לבר
                התחתון!"): כש-embedded=true, ה-112px האלה מצטברים *מעל*
                ה-pb-28 (=112px) שכבר קיים על ה-container החיצוני של
                Home עצמו (לצורך ה-MainBottomNav שלה) - שתי הזזות
                כפולות באותו כיוון, לא אחת. embedded מקבל padding קטן
                בהרבה (24px, "אוויר" בלבד) כי Home כבר דואגת לשאר. */}
            {/* *** תיקון (בקשה מפורשת - "פחות רווח בין הסוגים לכרטיסיות"):
                הוסר justify-center (שהיה ממרכז את הכרטיס המוקטן אנכית
                בתוך כל השטח הפנוי, ודוחף אותו למטה/יוצר רווח גדול
                מתחת לקטגוריות) - הכרטיס עכשיו נצמד ישר לקטגוריות
                שמעליו; השטח שהתפנה מהקטנת הגובה (75%) נשאר למטה, לפני
                ה-BottomNav, לא דוחף את הכרטיס למטה. pt-3->pt-1.5. */}
            {/* *** תוקן (בקשה מפורשת - "הכרטיסייה... משאירה מלא רווח בין
                שורת ההתקדמות לכרטיסייה עצמה"): pt-10 (40px) בנוסף ל-16px
                שכבר שמורים בתוך CARD_BOX_STYLE (top:16) יצר כ-56px רווח
                ריק בין פס ההתקדמות לכרטיס - הרבה יותר מהכוונה. pt-2
                (8px) + ה-16px הפנימיים = 24px, קרוב ועקבי לשאר הרווחים
                בעמוד הזה (pt-1.5 מעל פס ההתקדמות, למשל). */}
            <div
              className={embedded ? "flex flex-1 min-h-0 w-full min-w-0 flex-col pt-2" : "flex min-h-0 flex-1 flex-col pt-1.5"}
              // *** תיקון (בקשה מפורשת - "צריך לתת שוליים לכרטיסיות של
              // ההחלקות בשביל שלא יצא מהעמוד"): במצב מוטמע הכרטיס כבר לא
              // צמוד לשני קצוות המסך - px-8 (32px; עוד שוליים לפי בקשה
              // נוספת - "בצדדים תיצור שוליים"). הכרטיסים המסובבים שמאחור
              // מוטים פחות במצב מוטמע (3.5°/3° במקום 5°/4°) כדי שהפינות
              // שלהם ייכנסו בתוך השוליים ולא ייחתכו בקצה המסך. pt-6 (במקום
              // pt-3) - רווח נוסף מפס ההתקדמות, כי פינות הכרטיסים
              // המסובבים בולטות מעל הכרטיס הקדמי (~11px). overflow:hidden
              // (שני הצירים, לא רק overflowX:clip - תמיכה אוניברסלית בכל
              // דפדפן/WebView, בלי הסתמכות על ערך CSS חדש יחסית) חותך את
              // "הכרטיסים המסובבים" שמאחור ואת אנימציית ה-fly-out בקצה
              // המסך, כך שכלום לא בורח מהעמוד/יוצר גלילה בשום כיוון.
              style={{
                paddingBottom: embedded ? 0 : 112,
                // Keep horizontal overflow contained, but NEVER clip vertically.
                // When the search bar opens the card must keep its original
                // size and simply extend lower on the page instead of being
                // clipped/shrunk to the reduced available flex height.
                // overflow-x:clip (לא hidden) - חותך את אנימציית ה-fly-out
                // בלי להפוך את האזור ל-scroll container (hidden+visible
                // הופך בפועל ל-auto, ואז הדפדפן יכול "לגלול" את ה-Deck הצידה).
                ...(embedded ? { overflowX: "clip" as const } : null),
              }}
            >
              <div
                className={embedded ? "tripmatch-deck" : "relative w-full"}
                style={embedded ? DECK_STYLE : { height: "75%" }}
              >
                <div
                  className={embedded ? "tripmatch-deck-stage" : "contents"}
                  style={embedded ? DECK_STAGE_STYLE : undefined}
                >
                {!currentCandidate ? (
                  // *** חדש (בקשה מפורשת - "גם אם יגמרו ההחלקות, תמיד תהיה
                  // כרטיסייה - עם רקע לבן, כרטיסיות פיקטיביות מאחורה, ושכתוב
                  // עליה 'להוספת מקומות לחצו כאן'"): לפני זה זה היה טקסט
                  // ריק בלי שום כרטיס - עכשיו יש תמיד "כרטיס" לראות, בין אם
                  // אין בכלל מועמדים (לא מצאנו כלום), ובין אם סיימו להחליק
                  // על כל מה שהיה. אותו CARD_BOX_STYLE כמו כרטיסי מועמד
                  // רגילים - נשאר ממורכז/responsive באותו אופן בדיוק.
                  <>
                    {[2, -2].map((rot, i) => (
                      <div
                        key={i}
                        aria-hidden="true"
                        className="pointer-events-none absolute overflow-hidden rounded-[28px] border-[2px] border-white bg-bg-secondary"
                        style={
                          embedded
                            ? { ...DECK_LAYER_STYLE, ...DECK_NOTCH_MASK, transform: `rotate(${rot}deg)`, transformOrigin: "50% 100%" }
                            : { top: 0, height: "100%", left: 0, right: 0, transform: `rotate(${rot}deg)`, transformOrigin: "50% 100%" }
                        }
                      />
                    ))}
                    <button
                      type="button"
                      onClick={handleAddPlaceClick}
                      className="absolute flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[28px] border-[2px] border-white bg-white shadow-[0_18px_40px_rgba(16,24,40,0.14)] transition active:scale-[0.98]"
                      style={embedded ? DECK_LAYER_STYLE : { top: 0, height: "100%", left: 0, right: 0 }}
                    >
                      <span
                        className="flex h-16 w-16 items-center justify-center rounded-full shadow-[0_6px_18px_rgba(24,119,242,0.35)]"
                        style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                      >
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                      <span className="px-8 text-center text-[16px] font-bold text-ink">להוספת מקומות לחצו כאן</span>
                      <span className="px-10 text-center text-[13px] text-ink-secondary">
                        {candidates.length === 0
                          ? `עוד לא מצאנו מקומות ב${selectedCityLabel || selectedCity} בקטגוריה הזו`
                          : "סיימתם לסרוק את מה שיש כרגע"}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* *** הקטנת גובה נוספת (בקשה מפורשת - "עוד 25%"): הכרטיס
                      (וה"כרטיסים" מאחוריו) לא ממלאים יותר 100% מהגובה
                      הפנוי - רק 75% ממנו, ממורכז אנכית (justify-center
                      על ההורה) - כדי שגם החלק החיצוני יראה קטן יותר, לא
                      רק פנימית. */}
                  {/* *** תוקן (היה חסר לגמרי בהעברה מהסקיצה): שני "כרטיסים"
                      מאחור, מסובבים קלות (fan), יוצרים תחושת עומק - בדיוק
                      אותה טכניקה מהסקיצה המאושרת. לא אינטראקטיביים (aria-hidden),
                      רק דקורציה. מוצגים רק כשיש עוד מועמד אחרי הנוכחי, כדי לא
                      "להבטיח" עומק כשבפועל אין עוד כרטיס. אותו height בדיוק
                      כמו אזור התמונה ב-TripMatchCard (calc(100% - 64px), שם
                      64px שמורים לשורת הכפתורים) - כדי שהפינות המסובבות באמת
                      ייצאו מעבר לקצה העליון של הכרטיס הקדמי, לא מוסתרות מתחתיו. */}
                  {/* *** תוקן (בקשה מפורשת - "לא סתם רקע לבן"): הכרטיסים
                      מאחור מציגים בפועל את תמונות המועמדים הבאים בתור
                      (visibleCandidates אחרי הנוכחי) - לא מלבן לבן ריק.
                      לא אינטראקטיביים (aria-hidden + pointer-events-none) -
                      רק תצוגה מקדימה חזותית של מה שמחכה בתור. */}
                  {/* *** בקשה מפורשת ("שיהיו מאחורי הכרטיסייה עוד 4, לא רק עוד
                      3"): ערימה של עד BACK_CARD_COUNT=4 כרטיסים מאחור (במקום 2).
                      מציירים מהרחוק לקרוב (depth 4 -> 1) כדי שהקרוב יהיה מעל.
                      כל כרטיס מקבל זווית *שונה* (מתחלפת ימין/שמאל) וגם הזזה
                      קלה כלפי מעלה - כך כל אחד מהם באמת נראה כפס בולט מאחורי
                      הקודם, בלי להגדיל את הזוויות (שהיו בורחות מהשוליים) -
                      הזוויות המקסימליות נשארות 3.5° (מוטמע) כמו קודם. */}
                  {BACK_CARDS.map((_, i) => {
                    const depth = BACK_CARDS.length - i; // 4,3,2,1 - הרחוק ראשון
                    const backCandidate = visibleCandidates[candidateIndex + depth];
                    if (!backCandidate) return null;
                    const cfg = BACK_CARDS[depth - 1][embedded ? "embedded" : "standalone"];
                    return (
                      <div
                        key={backCandidate.id}
                        data-tripmatch-back-card=""
                        aria-hidden="true"
                        className="pointer-events-none absolute overflow-hidden rounded-[28px] border-[2px] border-white bg-bg-secondary shadow-[0_8px_24px_rgba(16,24,40,0.10)]"
                        // *** תוקן שוב (בקשה מפורשת - "זה שוב בורח"): לא עוד
                        // חישוב JS (cardBox) - CARD_BOX_STYLE הוא CSS טהור
                        // (aspect-ratio), אותו דבר בדיוק לכל הכרטיסים
                        // (הקדמי, המאחור, הכפתורים) - תמיד מיושרים כי הם
                        // כולם נגזרים מאותה הגדרת CSS, לא מחישוב שיכול
                        // לצאת שגוי. בלי embedded (standalone) - נופל חזרה
                        // ל-inset-x-0 (מלא רוחב ה-container, כמו קודם).
                        style={
                          embedded
                            ? { ...DECK_LAYER_STYLE, ...DECK_NOTCH_MASK, transform: `translateY(${cfg.y}px) rotate(${cfg.rot}deg)`, transformOrigin: "50% 100%" }
                            : {
                                top: 0,
                                height: "100%",
                                left: 0,
                                right: 0,
                                transform: `translateY(${cfg.y}px) rotate(${cfg.rot}deg)`,
                                transformOrigin: "50% 100%",
                              }
                        }
                      >
                        {backCandidate.imageUrls[0] && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={backCandidate.imageUrls[0]}
                            alt=""
                            className="h-full w-full object-cover object-center"
                          />
                        )}
                      </div>
                    );
                  })}
                  {embedded ? (
                    // The swipe surface itself is the card box. Keeping the
                    // gesture wrapper at the exact same width/position as the
                    // visual card prevents the wrapper from collapsing to the
                    // content width and shifting the whole deck left.
                    <div
                      data-tripmatch-front-surface=""
                      style={DECK_LAYER_STYLE}
                    >
                      <SwipeCard
                        ref={swipeCardRef}
                        key={`${currentCandidate.id}-${swipeResetTick}`}
                        onSwipeLeft={() => handleDecision(false)}
                        onSwipeRight={() => handleDecision(true)}
                        onTap={handleCardTap}
                        allowVerticalScroll
                        disabled={busy}
                      >
                        {() => (
                          <TripMatchCard
                            candidate={currentCandidate}
                            imageIndex={currentPhotoIndex}
                            matchIndex={Math.min(totalDecisions + 1, totalDecisions + visibleCandidates.length)}
                            matchTotal={totalDecisions + visibleCandidates.length}
                            cityLabel={selectedCityLabel || selectedCity || ""}
                            centerBox={{ top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", aspectRatio: "auto" }}
                          />
                        )}
                      </SwipeCard>
                    </div>
                  ) : (
                    <SwipeCard
                      ref={swipeCardRef}
                      key={`${currentCandidate.id}-${swipeResetTick}`}
                      onSwipeLeft={() => handleDecision(false)}
                      onSwipeRight={() => handleDecision(true)}
                      onTap={handleCardTap}
                      allowVerticalScroll
                      disabled={busy}
                    >
                      {() => (
                        <TripMatchCard
                          candidate={currentCandidate}
                          imageIndex={currentPhotoIndex}
                          matchIndex={Math.min(totalDecisions + 1, totalDecisions + visibleCandidates.length)}
                          matchTotal={totalDecisions + visibleCandidates.length}
                          cityLabel={selectedCityLabel || selectedCity || ""}
                          centerBox={null}
                        />
                      )}
                    </SwipeCard>
                  )}

                  {/* *** כפתורי הפעולה - קבועים לגמרי (בקשה מפורשת - "לא
                      זזים ברגע שמחליקים"): siblings של ה-SwipeCard, לא
                      בתוכו - לכן ה-transform שהוא מפעיל על הכרטיס בזמן
                      גרירה לא נוגע בהם בכלל. מפעילים אותו דרך ref
                      (swipeCardRef) כדי לקבל בדיוק את אותה אנימציית
                      fly-out. גם גדולים ב-30% (בקשה מפורשת): 60→78,
                      44→57. dir="ltr" מפורש - כדי ש-X יישאר תמיד פיזית
                      משמאל והלב מימין, בלי תלות ב-dir="rtl" הגלובלי. */}
                  {/* *** מוקם בתוך הכרטיס (בקשה מפורשת - "תכניס את הכפתורים
                      לתוך הקצה התחתון של הכרטיסייה"): לפני זה השורה רכבה
                      חצי-חצי על הקצה התחתון (הכרטיס היה נמוך מההורה שלו
                      ב-ZONE px). עכשיו הכרטיס תופס 100% מההורה, והשורה
                      יושבת לגמרי בפנים, ZONE px מהקצה התחתון שלו.
                      pointer-events-none על השורה (ו-auto רק על הכפתורים)
                      כדי שהרווחים בין הכפתורים לא יחסמו החלקה/לחיצה על
                      הכרטיס שמתחתיהם. */}
                  <div
                    aria-hidden="true"
                    // *** תוקן שוב (Bug חוזר - "זה שוב בורח"): לא עוד קואורדינטות
                    // מ-JS (cardBox.top+height) - העטיפה עצמה מקבלת בדיוק את
                    // אותה תיבת CSS כמו הכרטיס (CARD_BOX_STYLE, spread) - אז
                    // יש לה בדיוק את אותו גודל/מיקום כמו הכרטיס, מחושב ע"י
                    // הדפדפן (לא JS). בתוך העטיפה הזו, שורת הכפתורים בפועל
                    // ממוקמת ב-bottom:ZONE *יחסית לעטיפה* (לא לקונטיינר החיצוני)
                    // - כלומר תמיד קרוב לתחתית *הכרטיס עצמו*, לא משנה מה הגובה
                    // המחושב שלו בפועל.
                    style={embedded ? { ...DECK_LAYER_STYLE, pointerEvents: "none" as const } : { top: 0, height: "100%", left: 0, right: 0 }}
                  >
                    <div
                      dir="ltr"
                      className="pointer-events-none absolute inset-x-0 z-10 flex items-center justify-center gap-[16px]"
                      style={{ height: TRIPMATCH_MAIN_BUTTON_SIZE, bottom: TRIPMATCH_CARD_BUTTON_ZONE }}
                    >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => swipeCardRef.current?.nope()}
                      aria-label="דלג"
                      className="pointer-events-auto flex h-[98px] w-[98px] items-center justify-center transition active:scale-90 disabled:opacity-50"
                    >
                      <Image src="/images/tripmatch/action-nope-btn.png" alt="" width={98} height={98} className="h-full w-full object-contain" />
                    </button>

                    <button
                      type="button"
                      disabled={busy || lastDecision == null}
                      onClick={handleRewind}
                      aria-label="חזור לכרטיס הקודם"
                      className="pointer-events-auto flex h-[71px] w-[71px] items-center justify-center transition active:scale-90 disabled:opacity-40"
                    >
                      <Image src="/images/tripmatch/action-rewind-btn.png" alt="" width={71} height={71} className="h-full w-full object-contain" />
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => swipeCardRef.current?.like()}
                      aria-label="אהבתי"
                      className="pointer-events-auto flex h-[98px] w-[98px] items-center justify-center transition active:scale-90 disabled:opacity-50"
                    >
                      <Image src="/images/tripmatch/action-like-btn.png" alt="" width={98} height={98} className="h-full w-full object-contain" />
                    </button>
                    </div>
                  </div>

                  {/* *** תוספת (בקשה מפורשת - "פלואו מושלם"): במהלך אישור
                      לייק מהשרת (busy=true) הכרטיס הבא כבר לא מוצג עדיין -
                      בלי שום אינדיקציה זה מרגיש "תקוע". אינדיקטור עדין
                      וממורכז, לא חוסם - רק מבהיר שמשהו קורה ברקע. */}
                  {busy && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-[114px] flex justify-center">
                      <div className="flex items-center gap-2 rounded-pill bg-black/50 px-3.5 py-2 text-xs font-medium text-white backdrop-blur-sm">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        שומר...
                      </div>
                    </div>
                  )}
                </>
              )}
                </div>
            </div>
          </div>
        </div>
        )}

        {stage === "results" && (
          <div className="flex flex-col gap-3">
            {sessionLikedPlaces.length === 0 && (
              <ChatBubble>{`סיימנו לסרוק את ${selectedCityLabel || selectedCity} - לא סימנתם לייק הפעם, נסו יעד או קטגוריה אחרת.`}</ChatBubble>
            )}

            {sessionLikedPlaces.length > 0 && (
              <>
                {/* כותרת הטיול - שם היעד מעל המפה, בדיוק כמו בשאר עמודי
                    התוצאות (day-trip/nature-trip וכו') - לא בבר העליון,
                    שם נשארים רק כפתורי ניווט/שיתוף/שמירה. */}
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-bold text-ink">{selectedCityLabel || selectedCity}</h1>
                  <p className="text-sm text-ink-secondary">{sessionLikedPlaces.length} מקומות שאהבתם</p>
                </div>

                {/* מפה עובדת - מיקום כל האטרקציות שאהבתם, בדיוק כמו במסכי
                    תוצאות אחרים באפליקציה (ResultMap הקיים, לא רכיב חדש). */}
                <ResultMap
                  stops={sessionLikedPlaces.map((place) => ({
                    stopId: place.id,
                    name: place.name,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  }))}
                />

                {/* רשימה מסודרת - באותו סגנון בדיוק כמו עמוד "כל הטיולים"
                    (SwipeToDeleteRow), כולל אפשרות מחיקה בהחלקה. */}
                <div className="flex flex-col gap-3">
                  {sessionLikedPlaces.map((place) => (
                    <SwipeToDeleteRow key={place.id} resetKey={String(sessionLikedPlaces.length)} onDelete={() => handleRemoveLikedPlace(place.id)}>
                      <button
                        type="button"
                        onClick={() => router.push(`/place/${place.id}`)}
                        className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-bg-secondary p-3 text-right"
                      >
                        {place.imageUrls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={place.imageUrls[0]} alt="" className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">📍</div>
                        )}
                        {/* *** תיקון: השם לא נחתך יותר (בלי truncate) - מוצג
                            במלואו, ומקסימום יורד לשורה שנייה (line-clamp-2). */}
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[15px] font-bold leading-snug text-ink">{place.name}</p>
                          <p className="mt-0.5 text-xs text-ink-secondary">
                            {getCategoryLabel(place.category)}
                            {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                          </p>
                        </div>
                      </button>
                    </SwipeToDeleteRow>
                  ))}
                </div>

                {error && <p className="text-center text-sm text-danger">{error}</p>}

                {/* שני כפתורים בלבד: המשך לקטגוריה הבאה (חיי לילה/מסעדות/
                    אטרקציות בלבד - טבע לא נכלל, נעלם כשכל 3 הושלמו),
                    וטיול חדש. שמירה/שיתוף עברו לכפתורי האייקון בבר העליון. */}
                <div className="flex flex-col gap-2">
                  {nextContinueCategory ? (
                    <button
                      type="button"
                      onClick={handleContinueToNextCategory}
                      className="rounded-pill py-3 text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                    >
                      המשך לקטגוריה הבאה - {nextContinueCategory.label}
                    </button>
                  ) : (
                    // *** אם אין קטגוריה הבאה, זה לא באג - זה אומר שכבר
                    // עברתם על כל 3 הקטגוריות (חיי לילה/מסעדות/אטרקציות)
                    // ליעד הזה. בלי ההודעה הזו, ההיעלמות של הכפתור נראית
                    // כמו תקלה. מוצג רק אם באמת יש קטגוריות רלוונטיות
                    // (לא במצב "קרוב אליי" למשל, ששם categoryValue תמיד
                    // "attractions" גם ל"הכל").
                    completedCategories.length > 0 && (
                      <p className="rounded-pill bg-bg-secondary py-3 text-center text-sm font-medium text-ink-secondary">
                        סרקתם את כל הקטגוריות ליעד הזה 🎉
                      </p>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setStage("city");
                      setHeroVisible(true);
                      setSelectedCity(null);
                      setSelectedCityLabel("");
                      setCityInput("");
                      setCategoryValue(null);
                      setSessionLikedPlaces([]);
                      setHasSwipedAny(false);
                      setCandidates([]);
                      setDecidedIds([]);
                      decidingRef.current.clear();
                      setNearMeActive(false);
                      setOtherQuery("");
                      setOtherTags([]);
                      setNearMeOtherQuery("");
                      setNearMeOtherTags([]);
                      setActiveCategoryFilters([]);
                      setCompletedCategories([]);
                      setTripRecordId(null);
    clearPersistedResultsState();
                    }}
                    className="rounded-pill border border-ink-secondary/25 bg-white py-3 text-sm font-semibold text-ink"
                  >
                    טיול חדש
                  </button>
                </div>
              </>
            )}

            {sessionLikedPlaces.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  setStage("city");
                  setHeroVisible(true);
                  setSelectedCity(null);
                  setSelectedCityLabel("");
                  setCityInput("");
                  setCategoryValue(null);
                  setSessionLikedPlaces([]);
                  setHasSwipedAny(false);
                  setCandidates([]);
                  setDecidedIds([]);
                  decidingRef.current.clear();
                  setNearMeActive(false);
                  setOtherQuery("");
                  setOtherTags([]);
                  setNearMeOtherQuery("");
                  setNearMeOtherTags([]);
                  setActiveCategoryFilters([]);
                  setCompletedCategories([]);
                  setTripRecordId(null);
    clearPersistedResultsState();
                }}
                className="rounded-pill border border-ink-secondary/25 bg-white py-3 text-sm font-semibold text-ink"
              >
                טיול חדש
              </button>
            )}
          </div>
        )}
      </div>

      {filtersOpen && (
        <FiltersSheet
          candidates={candidates}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          preferredTags={[...(userPreferences?.interests ?? []), ...(userPreferences?.culinaryStyles ?? [])]}
          resultCount={visibleCandidates.length}
        />
      )}

      {likedPlace && (
        <LikedDialog
          key={likedPlace.id}
          placeName={likedPlace.name}
          placeImageUrl={likedPlace.imageUrls[0]}
          likedCount={sessionLikedPlaces.length}
          onContinue={() => setLikedPlace(null)}
          onFinish={() => {
            setLikedPlace(null);
            handleFinish();
          }}
        />
      )}

      {!embedded && <MainBottomNav active="tripmatch" />}
    </Screen>
  );
}
