"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete, isProfileComplete } from "@/services/profile/profileService";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { SearchIntroOverlay } from "@/screens/home/SearchIntroOverlay";
import { HomeMyTripsRow } from "@/screens/home/HomeMyTripsRow";
import { HomeHotRow } from "@/screens/home/HomeHotRow";
import { HomeDiscoverSection } from "@/screens/home/HomeDiscoverSection";
import { HomeNearbyRow } from "@/screens/home/HomeNearbyRow";
import { SearchBarLink } from "@/screens/home/SearchBarLink";
import { AddPlaceModal } from "@/screens/home/AddPlaceModal";
import { ChooseLocationSheet } from "@/screens/home/ChooseLocationSheet";
import { TripMatchPageContent } from "@/app/tripmatch/page";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";
import {
  getSessionLocation,
  setSessionLocation,
  getSessionDestination,
  setSessionDestination,
  clearSessionDestination,
} from "@/utils/sessionLocation";

/**
 * *** שדרוג ויזואלי מלא של מסך הבית (בקשה מפורשת):
 *
 * ה-HERO של המסך הפך ממפה (HomeMap) למערכת ה-TripMatch עצמה - אותו
 * card stack הניתן להחלקה שכבר קיים ב-/tripmatch, מוטמע כאן ישירות
 * (TripMatchPageContent embedded=true). זה בדיוק השימוש שה-prop הזה
 * תוכנן עבורו מלכתחילה - ר' ההערות הקיימות בתוך tripmatch/page.tsx
 * ("Home - כניסה ל-TripMatch", "Reverse Scroll") ובתוך Screen.tsx
 * ("TripMatch שמוטמע בתוך Home") - הוא פשוט מעולם לא חובר בפועל
 * ל-page.tsx של עמוד הבית לפני כן.
 *
 * Header/Greeting/Search/Categories נשארים בדיוק אותה קומפוזיציה -
 * הקטגוריות עצמן (עיגולי "סוגי הטיול") מוצגות ע"י TripMatchPageContent
 * פנימה (אותו HomeQuickCategories בדיוק, לא עותק) ברגע שיש כרטיסים
 * להציג, כדי שלא יהיו שתי שורות קטגוריות כפולות על המסך.
 *
 * שום Backend/API/Data לא השתנו - כל הלוגיקה (חיפוש יעד, "קרוב אלי",
 * טעינת מועמדים, לייק/סקיפ) היא בדיוק אותה לוגיקה הקיימת מ-/tripmatch.
 */
export default function HomePage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
  } = useAuth();
  const router = useRouter();

  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  // *** בקשה מפורשת - "ברגע שפותחים את המיקום, שתיפתח האפשרות של עמוד
  // 'המיקום שלי' שהיה לנו פעם": לחיצה על הנעץ בשורת החיפוש פותחת את
  // ChooseLocationSheet (מיקום נוכחי / כתובות שמורות / כל הערים / הוספת
  // כתובת) - אותו רכיב בדיוק שכבר משמש בעמודי ה-Discovery.
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  // *** תוספת (בקשה מפורשת - "מיקום חדש שמביא ישר לעמוד הבית איפה
  // שהעלאת אטרקציה"): כשמגיעים לכאן מ-CreateMenuSheet בעמוד הפרופיל
  // (/places), הפרמטר הזה פותח את AddPlaceModal אוטומטית עם הטעינה.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openAddPlace") === "1") {
      setAddPlaceOpen(true);
      router.replace("/home");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // היעד/עיר הפעילים שמוזנים ל-TripMatch המוטמע. null = עדיין לא נבחר
  // כלום - מציגים מסך פתיחה קליל עם הזמנה לחפש/ללחוץ "קרוב אלי".
  const [destinationQuery, setDestinationQuery] = useState<string | null>(null);
  // מכריח remount נקי של הרכיב המוטמע בכל יעד חדש - כדי שלא "יגרור"
  // מצב (stage/candidates) מהיעד הקודם.
  const [embeddedKey, setEmbeddedKey] = useState(0);
  // *** חדש (בקשה מפורשת - "הכרטיסייה תתארך עד קצה העמוד"): true רק
  // כש-TripMatchPageContent המוטמע נמצא בפועל במסך ההחלקה (לא בבחירת
  // יעד/תוצאות) - ר' onCardsVisibleChange. משמש להגביל את גובה אזור
  // הכרטיס בדיוק לשטח הפנוי מעל ה-BottomNav, רק כשזה רלוונטי.
  const [cardsVisible, setCardsVisible] = useState(false);
  // *** הגובה הפנוי האמיתי מעל ה-BottomNav, נמדד ישירות מה-DOM (לא
  // calc() עם מספרים מנוחשים - ר' useLayoutEffect למטה) - כדי שיתאים
  // בדיוק לכל מכשיר/safe-area, לא רק לערכים משוערים. null = עוד לא
  // נמדד (לפני שה-BottomNav בכלל ברנדר) - במצב הזה לא מגבילים גובה
  // בכלל (עדיף גלילה רגילה על פני מספר שגוי).
  const [foldHeight, setFoldHeight] = useState<number | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const autoRanRef = useRef(false);
  // *** "צור טיול" (כרטיסיית "הטיולים שלי"): גולל למעלה ומציג הסבר על שורת
  // החיפוש - ואז המשתמש מתחיל להחליק. ר' SearchIntroOverlay.tsx.
  const [introOpen, setIntroOpen] = useState(false);

  function handleCreateTrip() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIntroOpen(true);
  }

  function handleCloseIntro() {
    setIntroOpen(false);
    // אם אין כרגע חפיסה (למשל יצאו ממנה קודם) - מתחילים ממיקום המשתמש.
    if (!destinationQuery) handleUseNearMe().catch(() => {});
  }

  /** מעדכן את היעד הפעיל (ומכריח טעינה נקייה של ה-TripMatch המוטמע), ושומר
   *  אותו לזיכרון הסשן - כך שחזרה לעמוד הבית תחזיר לאותו יעד. */
  function applyDestination(label: string) {
    setLocateError(null);
    setSessionDestination(label);
    setDestinationQuery(label);
    setCardsVisible(false);
    setEmbeddedKey((k) => k + 1);
  }

  async function handleUseNearMe() {
    // *** חדש (בקשה מפורשת - "המיקום אמור להישמר כל עוד אתה באפליקציה"):
    // אם כבר איתרנו את המיקום בסשן הזה - משתמשים בו מיד, בלי GPS ובלי
    // reverse-geocode (שניות של המתנה). ר' utils/sessionLocation.ts.
    const saved = getSessionLocation();
    if (saved) {
      applyDestination(saved.city);
      return;
    }
    if (locating) return;
    setLocating(true);
    setLocateError(null);
    try {
      const pos = await getCurrentPositionSafe();
      let city = "האזור שלי";
      try {
        const geoRes = await fetch(`/api/places/reverse-geocode?lat=${pos.lat}&lng=${pos.lng}`);
        const geoData = await geoRes.json();
        if (geoRes.ok && geoData.city) city = geoData.city;
      } catch {
        // reverse-geocode נכשל - ממשיכים עם שם גנרי, לא חוסם.
      }
      // נשמר *לפני* שה-TripMatch המוטמע נטען - הוא קורא את המיקום משם.
      setSessionLocation({ lat: pos.lat, lng: pos.lng, city });
      applyDestination(city);
    } catch {
      setLocateError("לא הצלחנו לזהות את המיקום שלך, נסו לחפש יעד במקום.");
    } finally {
      setLocating(false);
    }
  }

  // ניסיון שקט אוטומטי פעם אחת בטעינה - כדי שהמסך "יתעורר" ישר עם
  // כרטיסים (בדיוק כמו במסך המצורף), בלי לחייב לחיצה ידנית. כישלון
  // (הרשאה נדחתה וכו') פשוט משאיר את מסך הפתיחה הקליל - לא שגיאה חוסמת.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    // חזרה לעמוד (למשל מעמוד מקום) - קודם כל לאותו יעד שהיינו בו; אחרת המיקום.
    const savedDestination = getSessionDestination();
    if (savedDestination) {
      applyDestination(savedDestination);
      return;
    }
    handleUseNearMe().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectDestination(label: string) {
    applyDestination(label);
  }

  // "Reverse Scroll" - חזרה למסך החיפוש הנקי של הבית (למשל אחרי לחיצה
  // על "חזרה"/"ערוך יעד" בתוך ה-TripMatch המוטמע, או סיום סריקה בלי לייקים).
  function handleExitEmbedded() {
    clearSessionDestination();
    setDestinationQuery(null);
    setCardsVisible(false);
    setEmbeddedKey((k) => k + 1);
  }

  // *** מודד את הגובה הפנוי האמיתי מעל ה-BottomNav (ר' foldHeight למעלה) -
  // רק כש-cardsVisible, כי זו הפעם היחידה שבה זה בכלל בשימוש. נמדד מחדש
  // בכל שינוי גודל/סיבוב מסך (resize) וגם דרך visualViewport אם קיים
  // (מדויק יותר בנייד - כולל למשל כשה-safe-area משתנה). ה-BottomNav עצמו
  // הוא fixed (לא זז עם גלילה) אז אין צורך למדוד אותו שוב בגלילה.
  // *** תוקן (Bug מפורש - "עכשיו הכל גולש - הכרטיסייה, הבר העליון, הבר
  // התחתון"): מדידה חד-פעמית (measure() אחת, מיד) הייתה חשופה ל-race
  // condition - אם ה-BottomNav (fixed) עוד לא סיים להתייצב בדפדפן באותו
  // רגע (למשל טעינת פונט/תמונה שעדיין מזיזה לייאאוט, גם אם ה-DOM node
  // כבר קיים), getBoundingClientRect() יכול להחזיר גובה שגוי (למשל 0
  // אם עוד לא צויר בכלל) - ואז foldHeight מחושב שגוי *לצמיתות* (אין עוד
  // trigger למדידה חוזרת חוץ מ-resize, שלא בהכרח קורה). זה בדיוק מסביר
  // איך תקלה במדידה *אחת* גורמת לכל השרשרת (header/כרטיס/BottomNav)
  // להיראות "שבורה" ביחד - כולם תלויים באותו foldHeight שגוי.
  // התיקון: (1) double-rAF - מודדים שוב בפריים הבא, אחרי שהדפדפן בטוח
  // סיים layout; (2) ResizeObserver על ה-BottomNav עצמו - תופס כל שינוי
  // בגודל שלו (לא רק resize של החלון), כולל שינויים מאוחרים; (3) בדיקת
  // תקינות - navHeight חייב להיות בין 40 ל-200px (טווח סביר לבר תחתון
  // אמיתי) אחרת המדידה נחשבת לא-אמינה ולא מיושמת (עדיף גלילה רגילה על
  // פני מספר שגוי שמפרק את כל העמוד).
  useLayoutEffect(() => {
    if (!cardsVisible) return;

    let raf1 = 0;
    let raf2 = 0;

    function measure() {
      const nav = document.querySelector<HTMLElement>("[data-main-bottom-nav]");
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const navHeight = nav?.getBoundingClientRect().height ?? 0;
      // טווח סביר לבר תחתון אמיתי (כולל safe-area) - מחוץ לטווח = מדידה
      // לא אמינה (למשל 0 כי עוד לא צויר), לא מיישמים אותה.
      if (navHeight < 40 || navHeight > 200) return;
      // *** תוספת (בקשה מפורשת - "אסור שהכרטיס ייגע/יסתיר את ה-bottom
      // navigation, צריך מרווח ברור"): לפני זה foldHeight היה בדיוק
      // viewport פחות ה-BottomNav - אפס מרווח מכוון, הכרטיס יכול להגיע
      // *בדיוק* לקצה העליון של הבר. 16px נוספים כאן משאירים רווח נשימה
      // אמיתי וברור מתחת לכרטיס, לפני הבר התחתון.
      const bottomBreathingRoom = 16;
      setFoldHeight(Math.max(0, viewportHeight - navHeight - bottomBreathingRoom));
    }

    measure();
    // double-rAF: מודדים שוב אחרי שהדפדפן בטוח סיים layout+paint לפריים
    // הזה - תופס מקרים שבהם המדידה הראשונה (מיד ב-mount) הייתה מוקדמת מדי.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(measure);
    });

    const nav = document.querySelector<HTMLElement>("[data-main-bottom-nav]");
    const resizeObserver = nav ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(nav!);

    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [cardsVisible]);

  useEffect(() => {
    if (loading || profileLoading || !user) return;

    const isGuest = Boolean(user.is_anonymous);

    if (!isGuest && !isMainOnboardingComplete(profile)) {
      router.replace("/onboarding");
      return;
    }

    if (isGuest) return;

    if (!isProfileComplete(profile)) {
      router.replace("/profile-setup");
    }
  }, [loading, profileLoading, user, profile, router]);

  return (
    // *** תיקון (בקשה מפורשת - "הרווח מתחת לכפתורי הלייק/אנלייק גדול מדי
    // עד הבר התחתון"): כשה-TripMatch המוטמע מוצג, ה-padding התחתון הוא
    // בדיוק גובה ה-MainBottomNav (≈66px תוכן + max(safe-area, 22px)) +
    // 12px אוויר - במקום pb-28 (112px) הקבוע. במצב הפתיחה (בלי כרטיסים)
    // נשאר pb-28 כמו קודם.
    // *** הוסר שוב (Bug חוזר - "אי אפשר להחליק ימינה ושמאלה בשורת סוגי
    // הטיול"): אותו overflow-x-hidden שהתווסף כאן שבר את הגלילה
    // האופקית של שורת הקטגוריות (HomeQuickCategories) - ר' הסבר מלא
    // ב-Screen.tsx. הוסר; הזליגה עצמה כבר מטופלת ב-CARD_BOX_STYLE.
    <div
      className={`min-h-screen bg-bg ${destinationQuery ? "" : "pb-28"}`}
      style={destinationQuery ? { paddingBottom: "calc(66px + max(env(safe-area-inset-bottom), 22px) + 12px)" } : undefined}
    >
      <HomeStatusBarTint />
      <SearchIntroOverlay open={introOpen} onClose={handleCloseIntro} />
      <div className="relative mx-auto flex max-w-xl flex-col">
        {/* *** חדש (בקשה מפורשת - "הכרטיסייה תתארך עד קצה העמוד, ללא
            גלילה, והכפתורים בתוך הקצה התחתון שלה"): כש-cardsVisible
            (מסך ההחלקה בפועל, לא בחירת יעד/תוצאות) - התיבה הזו מקבלת
            גובה קבוע: בדיוק השטח הפנוי מעל ה-BottomNav *כפי שנמדד בפועל
            מה-DOM* (foldHeight, ר' useLayoutEffect למעלה) - לא ערך
            מנוחש/calc(). ה-header (הבר העליון) נשאר בגודלו הטבעי, וה-
            flex-1 שכבר היה על התיבה שמכילה את TripMatchPageContent
            (למטה) סופג את כל מה שנשאר - כך הכרטיס עצמו (עד קצה ה-
            BottomNav) תמיד נכנס בלי גלילה. בכל stage אחר (או לפני שיש
            יעד בכלל, או לפני שנמדד בכלל) אין הגבלת גובה - גלילה רגילה.
            *** קריטי: גם התיבה הזו וגם ה-div עם ה-mt-3 למטה חייבים
            "flex flex-col" (לא רק flex-1) - אחרת הגובה שמגיע לכאן לא
            "מועבר הלאה" ל-TripMatchPageContent (שהוא רק flex ITEM כלפי
            ההורה שלו אם ההורה עצמו הוא flex container). זה בדיוק הבאג
            שקרה בפעם הקודמת שבנינו את זה. */}
        <div
          className="flex flex-col"
          style={
            cardsVisible && destinationQuery && foldHeight != null
              ? { height: `${foldHeight}px`, minHeight: 0 }
              : undefined
          }
        >
          {/* *** בקשה מפורשת - "הרקע של החלק עד שורת החיפוש כולל בצבע כחול
              כמו האייקון שלנו, עם קצוות מעוגלים": ההדר + שורת החיפוש יושבים
              על רקע גרדיאנט תכלת→כחול (צבעים דגומים מאייקון האפליקציה), עם
              פינות תחתונות מעוגלות. בלי overflow-hidden - כדי שתפריט ההצעות
              של החיפוש והבועה של ההתראות יוכלו לצאת מתחתיו. */}
          {/* *** שונה (בקשה מפורשת - "הבר העליון ישאר, רק עם שורת הלוגו/התראות/
              צ'אט, גם בגלילה; החיפוש נעלם בגלילה באופן אנימטיבי"): הבר התכלת
              (הרקע, הגרדיאנט, ההילות - הכל כמו שהיה) עבר ל-CollapsibleTopBar,
              שנדבק לראש המסך ומכווץ את שורת החיפוש בהתאם לגלילה. שורת החיפוש
              עצמה (כולל כפתור "קרוב אלי" בתוכה) נשארה בדיוק אותו דבר - היא
              ה-children שנעלמים. */}
          <CollapsibleTopBar loading={loading || profileLoading} forceReveal={introOpen}>
            <div data-home-search="">
            <SearchBarLink
              destinationMode
              variant="hero"
              onSelectDestination={handleSelectDestination}
              containerClassName="relative"
              endAdornment={
                <>
                  <span aria-hidden="true" className="h-6 w-px shrink-0 bg-ink-secondary/20" />
                  <button
                    type="button"
                    onClick={() => setLocationSheetOpen(true)}
                    aria-label={locating ? "מאתר מיקום..." : "המיקום שלי"}
                    title="המיקום שלי"
                    // *** תיקון (בקשה מפורשת - "הכפתור של המיקום צריך להיות בגובה אחיד עם שאר הכפתורים שעיצבנו"):
                    // h-11 w-11 (44px) - אותו גודל בדיוק כמו עיגולי סוגי-הטיול/כפתור הפילטרים (FilterCircleButton) בשורה
                    // שמתחת, ושאר העיגולים הלבנים הצפים באפליקציה. קודם היה h-9 w-9 (36px) - נמוך מהם בבירור.
                    className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-60"
                  >
                    {locating ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-secondary/30 border-t-ink" />
                    ) : (
                      <Image src="/icons/location.png" alt="" width={22} height={22} />
                    )}
                  </button>
                </>
              }
            />
            </div>
          </CollapsibleTopBar>
          {locateError && <p className="mt-1 px-6 text-center text-xs text-danger">{locateError}</p>}

          {/* HERO - מערכת ה-TripMatch (Card Stack הניתן להחלקה). מתחבר
              ישירות לקטגוריות/חיפוש שמעליו - זה בדיוק אותו רכיב עם אותה
              לוגיקה בדיוק שקיימת ב-/tripmatch, רק מוטמע כאן. */}
          {/* תיקון (בקשה מפורשת - "להעלות קצת את הפילטרים שיתקרבו לשורת
              החיפוש"): כשה-TripMatch המוטמע מוצג, המרווח מעל השורה קטן
              (mt-2 במקום mt-5). במצב הפתיחה (איור "מחפשים לאן לצאת?") mt-2 - האיור
              נצמד לבר התכלת. */}
          <div className={`${destinationQuery ? "mt-3" : "mt-2"} flex min-h-0 flex-1 flex-col`}>
            {destinationQuery ? (
              <TripMatchPageContent
                key={embeddedKey}
                embedded
                initialCityQuery={destinationQuery}
                onExitEmbedded={handleExitEmbedded}
                onCardsVisibleChange={setCardsVisible}
                onAddPlaceClick={() => setAddPlaceOpen(true)}
              />
            ) : (
              // *** תוקן (בקשה מפורשת - "לא מופיע עכשיו כלום, ביקשתי
              // שיהיה את הכרטיסייה הריקה עם הוספת מקומות ברגע שאין שום
              // דבר"): כל עוד destinationQuery עדיין null (המיקום עדיין
              // מתברר, או שאיתור המיקום נכשל בלי יעד חלופי) - לפני זה
              // לא הוצג כלום כאן (null ממש, ר' למעלה) עד שה-embedded
              // TripMatch עולה. עכשיו מוצגת אותה כרטיסייה ריקה בדיוק
              // (עיצוב, "+", "להוספת מקומות לחצו כאן") כמו זו שמופיעה
              // בתוך ה-TripMatch המוטמע כשאין מועמדים - כדי שלעולם לא
              // יהיה מסך לבן ריק, גם במצב הזה. לחיצה עליה פותחת את אותו
              // AddPlaceModal כמו בכל מקום אחר באפליקציה.
              <div className="flex flex-1 flex-col px-8 pt-2">
                <div className="relative w-full" style={{ aspectRatio: "0.55", maxHeight: "calc(100% - 32px)" }}>
                  <button
                    type="button"
                    onClick={() => setAddPlaceOpen(true)}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-[28px] border-[2px] border-white bg-white shadow-[0_18px_40px_rgba(16,24,40,0.14)] transition active:scale-[0.98]"
                  >
                    {locating ? (
                      <span className="h-10 w-10 animate-spin rounded-full border-4 border-bg-secondary border-t-accent" />
                    ) : (
                      <span
                        className="flex h-16 w-16 items-center justify-center rounded-full shadow-[0_6px_18px_rgba(24,119,242,0.35)]"
                        style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
                      >
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    )}
                    <span className="px-8 text-center text-[16px] font-bold text-ink">להוספת מקומות לחצו כאן</span>
                    <span className="px-10 text-center text-[13px] text-ink-secondary">
                      {locating ? "מאתרים את המיקום שלך…" : locateError || "בחרו יעד למעלה כדי להתחיל לגלות מקומות"}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>


        {/* *** חדש (בקשה מפורשת - "מתחת לכפתורים של ההחלקות"): שני קטעים
            מתחת לכרטיסיות ההחלקה - "הטיולים שלי" (כרטיסיית "צור טיול" +
            הטיולים האחרונים) ו"כל מה שחם" (אטרקציות אהובות). */}
        <div className="mt-6 flex flex-col gap-7 pb-4">
          <HomeMyTripsRow onCreateTrip={handleCreateTrip} />
          <HomeHotRow />
          <HomeDiscoverSection />
          <HomeNearbyRow />
        </div>
      </div>

      {/* *** הוסר (בקשה מפורשת - "הכפתור (+) אפשר להעיף מהעמוד הזה - לא
          רלוונטי"): כפתור ה-"+" הצף להוספת מקום. ה-AddPlaceModal עצמו
          נשאר, והוא עדיין נפתח דרך ?openAddPlace=1 (מ-CreateMenuSheet
          בעמוד הפרופיל) - ר' ה-effect למעלה. */}
      {addPlaceOpen && <AddPlaceModal onClose={() => setAddPlaceOpen(false)} />}

      {locationSheetOpen && (
        <ChooseLocationSheet
          onClose={() => setLocationSheetOpen(false)}
          onSelect={(address) => {
            // כל בחירה (מיקום נוכחי / כתובת שמורה / עיר מהרשימה) מתורגמת
            // ליעד-עיר ל-TripMatch המוטמע - בדיוק כמו "קרוב אלי" ו-
            // handleSelectDestination: remount נקי עם העיר החדשה.
            setLocationSheetOpen(false);
            const label = address.city || address.label || address.address_text;
            if (!label) return;
            applyDestination(label);
          }}
        />
      )}

      <MainBottomNav active="home" />
    </div>
  );
}
