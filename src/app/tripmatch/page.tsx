"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen, SwipeCard, BackButton, Chip, ImageOptionRow, SwipeToDeleteRow } from "@/components/ui";
import { ChatBubble } from "@/screens/trip-builder/chat/ChatBubble";
import { CategoryPicker } from "@/screens/tripmatch/CategoryPicker";
import { TRIPMATCH_INTEREST_OPTIONS, TRIPMATCH_CATEGORY_BUCKETS } from "@/locales/he/tripBuilder";
import { INTERESTS, VACATION_PREFERENCES, type PreferenceOption } from "@/locales/he/preferences";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { toggleFavorite } from "@/services/favorites/favoritesService";
import { listAddresses } from "@/services/addresses/addressesService";
import { SwipeHeader } from "@/screens/tripmatch/SwipeHeader";
import { TripMatchCard } from "@/screens/tripmatch/TripMatchCard";
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
}

export function TripMatchPageContent({ embedded = false, initialCityQuery, onExitEmbedded }: TripMatchPageContentProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { ready } = useFeatureOnboardingGuard("tripmatch", "/onboarding/tripmatch");
  const [stage, setStage] = useState<Stage>("city");
  // תיקון (Home - כניסה מוטמעת): כש-embedded=true אין להציג בכלל את
  // תמונת ה-Hero הדקורטיבית ("אין Hero של TripMatch" - Home כבר הציג
  // הירו/חיפוש משלו שהתחלף בכניסה הזו) - מתחילים עם false במקום עם
  // true+איפוס מאוחר יותר, כדי שלא תבהב לרגע לפני שההיעד מתאשר.
  const [heroVisible, setHeroVisible] = useState(() => !embedded);

  const [cityInput, setCityInput] = useState("");
  const [cityOptions, setCityOptions] = useState<{ value: string; label: string; type: "city" | "country" }[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCityLabel, setSelectedCityLabel] = useState<string>("");

  const [categoryValue, setCategoryValue] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState<string>("");
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

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

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidatePlace[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  // *** תיקון: הספירה "X מתוך Y" הייתה מתאפסת בכל swipe (כי ה-Y נגזר
  // מ-visibleCandidates.length, שמתכווץ אחרי כל החלטה) - "1 מתוך 5" ואז
  // "1 מתוך 4" במקום "2 מתוך 5". totalDecisions סופר כמה החלטות כבר
  // התקבלו בסשן הזה, כדי שהמונה יעלה בעקביות במקום להתאפס.
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<TripMatchFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [likedPlace, setLikedPlace] = useState<CandidatePlace | null>(null);
  const [sessionLikedPlaces, setSessionLikedPlaces] = useState<CandidatePlace[]>([]);
  const [hasSwipedAny, setHasSwipedAny] = useState(false);
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

  function handleSelectCity(option: { value: string; label: string; type: "city" | "country" }) {
    setSelectedCity(option.value);
    setSelectedCityLabel(option.label);
    setCityInput(option.label);
    setCityOptions([]);
    setHeroVisible(false);
    setCompletedCategories([]);
    setTripRecordId(null);
    clearPersistedResultsState();
    window.setTimeout(() => setStage("category"), 280);
  }

  // *** תיקון (Home - כניסה ל-TripMatch): כש-embedded=true, שורת החיפוש
  // של Home היא זו שמזינה את היעד - ה-cityInput כאן פשוט עוקב אחריה
  // (בלי לבקש מהמשתמש להקליד שוב, "אין לאפס את הערך"). לא רץ יותר אחרי
  // שכבר נבחרה עיר (selectedCity) - כדי לא "לדרוס" בחירה/מסך תוצאות קיים.
  useEffect(() => {
    if (!embedded || selectedCity) return;
    setCityInput(initialCityQuery ?? "");
  }, [embedded, initialCityQuery, selectedCity]);

  // *** לאחר שה-query התייצב (משתמש הפסיק להקליד), מתקדמים אוטומטית
  // לשלב הקטגוריה - בדיוק כמו בחירת עיר רגילה (handleSelectCity הקיים,
  // בלי מנגנון חדש), עם עדיפות לתוצאת ההשלמה האוטומטית הקיימת
  // (cityOptions, שכבר נטענת ע"י ה-effect למעלה) ונפילה חזרה לטקסט
  // הגולמי שהוקלד אם אין התאמה - כדי ש-TripMatch תמיד "ייפתח" עם היעד
  // שהמשתמש הקליד, גם בלי בחירה ידנית מהרשימה.
  useEffect(() => {
    if (!embedded || selectedCity) return;
    if (!cityInput.trim()) return;
    const timer = setTimeout(() => {
      const match = cityOptions[0];
      if (match) handleSelectCity(match);
      else handleSelectCity({ value: cityInput.trim(), label: cityInput.trim(), type: "city" });
    }, 550);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded, cityInput, cityOptions, selectedCity]);

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
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "לא הצלחנו להתחיל");
      setSessionId(data.session.id);
      setCandidates(data.candidates ?? []);
      setUserPreferences(data.userPreferences ?? null);
      setCandidateIndex(0);
      setTotalDecisions(0);
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

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
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


  function handleFinish() {
    if (sessionLikedPlaces.length === 0) {
      if (embedded && onExitEmbedded) onExitEmbedded();
      else router.push("/home");
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
        if (!cancelled && data?.sessionId) {
          tripRecordIdRef.current = data.sessionId;
          setTripRecordId(data.sessionId);
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
    await toggleFavorite(supabase, user.id, placeId, "place", "liked").catch(() => {});
  }

  useEffect(() => {
    if (stage === "swiping" && hasSwipedAny && candidates.length === 0 && !busy) {
      handleFinish();
    }
  }, [stage, hasSwipedAny, candidates, busy, sessionLikedPlaces, router]);

  useEffect(() => {
    if (stage !== "swiping" || userLocation || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserLocation(null)
    );
  }, [stage, userLocation]);

  const visibleCandidates = useMemo(() => {
    const withDistance = !userLocation
      ? candidates
      : candidates.map((c) => {
          const distanceKm = haversineDistanceKm(userLocation, { lat: c.latitude, lng: c.longitude });
          return { ...c, distanceKm, etaMinutes: estimateTravelMinutes(distanceKm, "drive") };
        });
    // מצב "קרוב אליי" - מגבילים לעד 10 ק"מ ממיקום המשתמש בפועל (לא רק ממיינים).
    const distanceLimited = nearMeActive && userLocation ? withDistance.filter((c) => c.distanceKm <= 10) : withDistance;
    const filtered = applyFilters(distanceLimited, filters);
    return [...filtered].sort(
      (a, b) => computeMatchPercent(b, filters, userPreferences) - computeMatchPercent(a, filters, userPreferences)
    );
  }, [candidates, filters, userLocation, userPreferences, nearMeActive]);
  const currentCandidate = visibleCandidates[candidateIndex];

  /** *** תיקון מהירות: לפני זה חיכינו לתשובת השרת (decide API) לפני שהראינו
   *  את כרטיס ה"אהבתי"/עברנו לכרטיס הבא - זה גרם לזרימה להרגיש איטית
   *  ולא אחידה (תלוי ברשת). עכשיו העדכון קורה אופטימית ומיידית: מסירים
   *  את המועמד מהרשימה המקומית ומציגים את הפופאפ/כרטיס הבא מייד עם
   *  סיום אנימציית ה-swipe, ושליחת ההחלטה לשרת קורית ברקע. */
  async function handleDecision(liked: boolean) {
    if (!sessionId || !currentCandidate) return;
    const decidedPlace = currentCandidate;

    setHasSwipedAny(true);
    setTotalDecisions((n) => n + 1);
    setCandidates((prev) => prev.filter((c) => c.id !== decidedPlace.id));
    setCandidateIndex(0);
    if (liked) {
      // *** תיקון: מקום עלול להופיע שוב במחזור קטגוריה אחרת (למשל
      // מסעדות ואטרקציות חופפות חלקית) - בלי בדיקת כפילות, לייק חוזר על
      // אותו מקום היה יוצר שני איברים עם אותו id ברשימה, וזה גרם לשגיאת
      // React "two children with the same key" במסך התוצאות.
      setSessionLikedPlaces((prev) => (prev.some((p) => p.id === decidedPlace.id) ? prev : [...prev, decidedPlace]));
      setLikedPlace(decidedPlace);
    }

    try {
      const response = await fetch(`/api/tripmatch/sessions/${sessionId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: decidedPlace.id, liked }),
      });
      const data = await response.json();
      // מסנכרן ברקע עם הרשימה הרשמית מהשרת (כולל favorites חיצוניים
      // וכו') - בלי לגעת ב-candidateIndex, כדי לא "לקפוץ" ויזואלית.
      if (response.ok) setCandidates(data.candidates ?? []);
    } catch {
      // העדכון האופטימי כבר בוצע - שגיאת רשת לא חוסמת את הזרימה.
    }
  }

  if (!ready) return null;

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
        {!embedded && <MainBottomNav active="favorites" />}
      </Screen>
    );
  }

  return (
    <Screen
      withBottomNavSpacing={!embedded}
      fullHeight={!embedded}
      className={`!bg-bg !px-0 !pt-0 ${stage === "swiping" ? "!pb-0" : ""}`}
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

      {stage !== "swiping" && (
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{ maxHeight: heroVisible ? 260 : 0, opacity: heroVisible ? 1 : 0 }}
        >
          <div className="relative w-full">
            <Image src="/images/hero-tripmatch.png" alt="" width={800} height={450} priority className="h-56 w-full object-cover" />
          </div>
        </div>
      )}

      <div className={`mx-auto flex max-w-xl flex-col ${stage === "swiping" ? "" : stage === "results" ? "gap-3 px-5 pb-4 pt-5" : "gap-4 px-5 pb-10 pt-5"}`}>
        {stage === "city" && embedded && (
          // *** תיקון (Home - כניסה מוטמעת): היעד כבר הגיע משורת החיפוש
          // של Home ("אין לאפס את הערך, אין לבקש מהמשתמש להקליד שוב") -
          // לא מציגים כאן שוב את מסך "איפה תרצו לטייל?" המלא, רק מסך
          // ביניים קצר עד שה-effect למעלה מסיים לאשר את היעד ולהתקדם
          // לשלב הקטגוריה (בדרך כלל כמה מאות מ"ש).
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-bg-secondary border-t-accent" />
            <p className="text-sm font-medium text-ink-secondary">
              {cityInput ? `מכינים עבורכם המלצות ל${cityInput}...` : "מכינים עבורכם המלצות..."}
            </p>
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
          <div className="h-viewport-safe flex flex-col">
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
                onFinish={handleFinish}
                hideTopBar={embedded}
              />
            )}

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
            <div className="min-h-0 flex-1 pt-3" style={{ paddingBottom: embedded ? 24 : 112 }}>
              {!currentCandidate ? (
                <p className="pt-16 text-center text-ink-secondary">
                  {candidates.length === 0
                    ? `לא מצאנו עדיין מקומות ב${selectedCityLabel || selectedCity} בקטגוריה הזו.`
                    : visibleCandidates.length === 0
                      ? "אין תוצאות עם הפילטרים שנבחרו. נסו לרוקן חלק מהם."
                      : "נגמרו המועמדים כרגע."}
                </p>
              ) : (
                <SwipeCard key={currentCandidate.id} onSwipeLeft={() => handleDecision(false)} onSwipeRight={() => handleDecision(true)} disabled={busy}>
                  {({ onLike, onNope, disabled: swipeDisabled }) => (
                    <TripMatchCard
                      candidate={currentCandidate}
                      matchPercent={computeMatchPercent(currentCandidate, filters, userPreferences)}
                      onLike={onLike}
                      onNope={onNope}
                      disabled={swipeDisabled}
                    />
                  )}
                </SwipeCard>
              )}
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
                      setTotalDecisions(0);
                      setNearMeActive(false);
                      setOtherQuery("");
                      setOtherTags([]);
                      setNearMeOtherQuery("");
                      setNearMeOtherTags([]);
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
                  setTotalDecisions(0);
                  setNearMeActive(false);
                  setOtherQuery("");
                  setOtherTags([]);
                  setNearMeOtherQuery("");
                  setNearMeOtherTags([]);
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
        />
      )}

      {likedPlace && (
        <LikedDialog
          placeName={likedPlace.name}
          placeImageUrl={likedPlace.imageUrls[0]}
          onContinue={() => setLikedPlace(null)}
          onFinish={() => {
            setLikedPlace(null);
            handleFinish();
          }}
        />
      )}

      {!embedded && <MainBottomNav active="favorites" />}
    </Screen>
  );
}
