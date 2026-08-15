"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
import dynamic from "next/dynamic";
import { haversineDistanceKm, estimateTravelMinutes } from "@/services/tripBuilder/geo";
import type { CandidatePlace } from "@/services/tripBuilder/types";
import { useFeatureOnboardingGuard } from "@/hooks/useFeatureOnboardingGuard";
import { getCategoryLabel } from "@/utils/categoryLabels";

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
  const router = useRouter();
  const { user } = useAuth();
  const { ready } = useFeatureOnboardingGuard("tripmatch", "/onboarding/tripmatch");
  const [stage, setStage] = useState<Stage>("city");
  const [heroVisible, setHeroVisible] = useState(true);

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
  const [savingTrip, setSavingTrip] = useState(false);
  const [tripSaved, setTripSaved] = useState(false);

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
    setTripSaved(false);
    window.setTimeout(() => setStage("category"), 280);
  }

  function handleEditDestination() {
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
    setTripSaved(false);
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
        if (!navigator.geolocation) throw new Error("הדפדפן לא תומך באיתור מיקום");
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            resolve,
            () => reject(new Error("לא הצלחנו לאתר את המיקום שלך - יש לאשר גישה למיקום ולנסות שוב")),
            { enableHighAccuracy: true, timeout: 10000 }
          );
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
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
      router.push("/home");
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
    setTripSaved(false);
    handleSelectCategory(nextContinueCategory.value, nextContinueCategory.label);
  }

  async function handleSaveTrip() {
    if (savingTrip || sessionLikedPlaces.length === 0) return;
    setSavingTrip(true);
    setError(null);
    try {
      const response = await fetch("/api/trip-builder/sessions/from-tripmatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: selectedCityLabel || selectedCity, places: sessionLikedPlaces }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "שמירת הטיול נכשלה");
      setTripSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת הטיול נכשלה, נסו שוב");
    } finally {
      setSavingTrip(false);
    }
  }

  async function handleRemoveLikedPlace(placeId: string) {
    setSessionLikedPlaces((prev) => prev.filter((p) => p.id !== placeId));
    setTripSaved(false);
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
      setSessionLikedPlaces((prev) => [...prev, decidedPlace]);
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

  return (
    <Screen withBottomNavSpacing className={`!bg-bg !px-0 !pt-0 ${stage === "swiping" ? "!pb-0" : ""}`}>
      {stage !== "swiping" && (
        <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
          <div className="relative h-16">
            <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <Image src="/images/trip-tripmatch-logo.png" alt="" width={110} height={34} className="object-contain" />
              <BackButton onBack={() => router.push("/home")} />
            </div>
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

      <div className={`mx-auto flex max-w-xl flex-col ${stage === "swiping" ? "" : "gap-4 px-5 pb-10 pt-5"}`}>
        {stage === "city" && (
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
                onBack={() => router.push("/home")}
                onEditDestination={handleEditDestination}
                onEditCategory={handleEditCategory}
                onOpenFilters={() => setFiltersOpen(true)}
                activeFilterCount={countActiveFilters(filters)}
                onFinish={handleFinish}
              />
            )}

            {/* אזור הכרטיס - flex-1 סופג את כל הגובה הפנוי בין ה-header
                לתחתית המסך. בלי padding אופקי - הכרטיס נצמד לשני קצוות
                המסך ומהווה "עמוד מלא" (edge-to-edge), לא כרטיס צף בתוך
                שוליים לבנים. ה-padding-bottom (112px) שומר בדיוק על אותו
                מרווח בטוח שהיה קודם קבוע ב-Screen (pb-28) כדי שהכרטיס
                יגיע בדיוק עד קצה ה-BottomNav הצף, בלי חפיפה ובלי רווח
                מיותר. */}
            <div className="min-h-0 flex-1 pt-3" style={{ paddingBottom: 112 }}>
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
          <div className="flex flex-col gap-4">
            <ChatBubble>
              {sessionLikedPlaces.length > 0
                ? `סיימנו לסרוק את ${selectedCityLabel || selectedCity}! אלה ${sessionLikedPlaces.length} המקומות שאהבתם:`
                : `סיימנו לסרוק את ${selectedCityLabel || selectedCity} - לא סימנתם לייק הפעם, נסו יעד או קטגוריה אחרת.`}
            </ChatBubble>

            {sessionLikedPlaces.length > 0 && (
              <>
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
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold text-ink">{place.name}</p>
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

                {/* שני כפתורים: שמירת הטיול, והמשך לקטגוריה הבאה (חיי
                    לילה/מסעדות/אטרקציות בלבד - טבע לא נכלל). הכפתור השני
                    נעלם לגמרי ברגע שכל 3 הקטגוריות הושלמו ליעד הזה. */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={savingTrip}
                    onClick={handleSaveTrip}
                    className="rounded-pill border border-ink-secondary/25 bg-white py-3 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    {tripSaved ? "הטיול נשמר ✓" : savingTrip ? "שומר..." : "שמירת הטיול"}
                  </button>

                  {nextContinueCategory && (
                    <button
                      type="button"
                      onClick={handleContinueToNextCategory}
                      className="rounded-pill py-3 text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                    >
                      המשך לקטגוריה הבאה - {nextContinueCategory.label}
                    </button>
                  )}
                </div>
              </>
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
                setTripSaved(false);
              }}
              className="rounded-pill py-3 text-sm font-semibold text-ink-secondary"
            >
              יעד חדש
            </button>
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

      <MainBottomNav active="favorites" />
    </Screen>
  );
}
