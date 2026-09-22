"use client";

import { useEffect, useRef, useState } from "react";
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
    <div
      className={`min-h-screen bg-bg ${destinationQuery ? "" : "pb-28"}`}
      style={destinationQuery ? { paddingBottom: "calc(66px + max(env(safe-area-inset-bottom), 22px) + 12px)" } : undefined}
    >
      <HomeStatusBarTint />
      <SearchIntroOverlay open={introOpen} onClose={handleCloseIntro} />
      <div className="relative mx-auto flex max-w-xl flex-col">
        {/* *** חדש (בקשה מפורשת - "הכרטיסייה תתארך עד קצה העמוד, עד סוף
            החלק שלא צריך בו גלילה, ושבחלק התחתון שלה יהיו כפתורי
            הלייק/איקס/חזור"): כש-cardsVisible (מסך ההחלקה בפועל, לא
            בחירת יעד/תוצאות) - התיבה הזו מקבלת גובה קבוע: בדיוק השטח
            הפנוי מעל ה-BottomNav (100dvh פחות אותו חישוב גובה שה-
            BottomNav כבר תופס, ר' ה-paddingBottom למעלה). ה-header (הבר
            העליון) נשאר בגודלו הטבעי (shrink-0 מובנה - הוא לא flex item
            שמתכווץ), וה-flex-1 שכבר היה על התיבה שמכילה את TripMatchPageContent
            (למטה) סופג את כל מה שנשאר - כך הכרטיס עצמו (עד קצה ה-
            BottomNav) תמיד נכנס בלי גלילה. בכל stage אחר (או לפני שיש
            יעד בכלל) אין הגבלת גובה - גלילה רגילה כרגיל. */}
        <div
          className="flex flex-col"
          style={
            cardsVisible && destinationQuery
              ? // *** תוספת (בטיחות): +14px נוספים, כדי שפינות "הכרטיסים המציצים"
                // המסובבים מאחורי הכרטיס הקדמי (rotate סביב הקצה התחתון - ר'
                // BACK_CARDS ב-tripmatch/page.tsx) לא יבלטו מתחת לקצה התחתון
                // של הכרטיס הקדמי ויחצו את ה-BottomNav. בלי זה הן היו מגיעות
                // בערך עד לקצה המדויק, בלי שום מרווח בטיחות.
                { height: "calc(100dvh - (66px + max(env(safe-area-inset-bottom), 22px) + 12px + 14px))", minHeight: 0 }
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
              ה-children שנעלמים.
              *** תוקן (בקשה מפורשת - "החיפוש יופיע רק אם יחליקו למעלה"):
              CollapsibleTopBar עצמו שונה - הכיווץ/הופעה מבוססים עכשיו על
              *כיוון* הגלילה (גוללים למטה = נעלם, גוללים למעלה = מופיע),
              לא רק על המרחק המוחלט מראש הדף. ר' ההערה בתוך הקובץ עצמו. */}
          <CollapsibleTopBar loading={loading || profileLoading}>
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
          {/* *** תוקן (Bug מפורש - "הכרטיסייה בורחת מהעמוד"): לתיבה הזו
              יש flex-1 min-h-0 מההורה שלה (התיבה עם ה-100dvh), אז היא
              *מקבלת* גובה קבוע נכון - אבל בלי flex (display:flex) על
              עצמה, היא לא *מעבירה* את הגובה הזה הלאה ל-TripMatchPageContent
              (שרנדר את עצמו רק לפי הגובה הטבעי של התוכן שלו, בלי קשר
              לגובה ההורה) - וכל שרשרת ה-flex-1 הפנימית ב-tripmatch/page.tsx
              נשארה בלי גבול אמיתי לצמוח בתוכו, ולכן "ברחה" מעבר לעמוד.
              flex flex-col כאן סוגר את הפער - עכשיו TripMatchPageContent
              (שכבר flex flex-col מבפנים) נמתח בדיוק לגובה הפנוי. */}
          <div className={`${destinationQuery ? "mt-3" : "mt-2"} flex min-h-0 flex-1 flex-col`}>
            {destinationQuery ? (
              <TripMatchPageContent
                key={embeddedKey}
                embedded
                initialCityQuery={destinationQuery}
                onExitEmbedded={handleExitEmbedded}
                onCardsVisibleChange={setCardsVisible}
              />
            ) : // *** הוסר (בקשה מפורשת - "להעיף את כל עיצובי הטעינה, שזה ישר יקבל את
            // המיקום של המשתמש"): אין יותר מסך המתנה (איור/טקסט) בעמוד הבית.
            // איתור המיקום מתחיל מיד בטעינת העמוד (ה-useEffect של
            // handleUseNearMe למעלה), והכרטיסים מופיעים ברגע שיש יעד.
            null}
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
