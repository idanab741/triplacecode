"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete, isProfileComplete } from "@/services/profile/profileService";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeHeader } from "@/screens/home/HomeHeader";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { AnimatedHeaderBackdrop } from "@/screens/home/AnimatedHeaderBackdrop";
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
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const autoRanRef = useRef(false);

  /** מעדכן את היעד הפעיל (ומכריח טעינה נקייה של ה-TripMatch המוטמע), ושומר
   *  אותו לזיכרון הסשן - כך שחזרה לעמוד הבית תחזיר לאותו יעד. */
  function applyDestination(label: string) {
    setLocateError(null);
    setSessionDestination(label);
    setDestinationQuery(label);
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
      <div className="relative mx-auto flex max-w-xl flex-col">
        {/* *** בקשה מפורשת - "הרקע של החלק עד שורת החיפוש כולל בצבע כחול
            כמו האייקון שלנו, עם קצוות מעוגלים": ההדר + שורת החיפוש יושבים
            על רקע גרדיאנט תכלת→כחול (צבעים דגומים מאייקון האפליקציה), עם
            פינות תחתונות מעוגלות. בלי overflow-hidden - כדי שתפריט ההצעות
            של החיפוש והבועה של ההתראות יוכלו לצאת מתחתיו. */}
        <div
          className="relative z-10 rounded-b-[32px] pb-5"
          style={{
            background: "linear-gradient(150deg, #3FCBFD 0%, #0AA9FD 35%, #008EFD 70%, #007CFE 100%)",
            boxShadow: "0 12px 30px -14px rgba(0, 124, 254, 0.6)",
          }}
        >
        <AnimatedHeaderBackdrop />
        <HomeHeader loading={loading || profileLoading} />

        {/* הוסר (בקשה מפורשת - "בוא נעיף את החלק הזה"): בלוק הברכה
            ("ערב טוב, עידן! / בוא נראה מה מתאים לך היום"). הקומפוננט
            screens/home/GreetingBlock.tsx נשאר בפרויקט, פשוט לא בשימוש. */}

        {/* שורת חיפוש יעד - ברוחב מלא (אותם שוליים כמו ההדר, px-5).
            *** בקשה מפורשת - "שורת החיפוש עד הסוף, והמיקום נכנס לתוך שורת
            החיפוש": כפתור "קרוב אלי" כבר לא עיגול נפרד לידה - הוא בתוך
            השורה, בקצה השמאלי שלה (endAdornment, אחרון ב-DOM = פיזית שמאל
            תחת dir="rtl"), עם קו מפריד עדין. אותו אייקון נעץ ואותה לוגיקה. */}
        <div className="mt-4 px-5">
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
                  className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-60"
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
        </div>
        {locateError && <p className="mt-1 px-6 text-center text-xs text-danger">{locateError}</p>}

        {/* HERO - מערכת ה-TripMatch (Card Stack הניתן להחלקה). מתחבר
            ישירות לקטגוריות/חיפוש שמעליו - זה בדיוק אותו רכיב עם אותה
            לוגיקה בדיוק שקיימת ב-/tripmatch, רק מוטמע כאן. */}
        {/* תיקון (בקשה מפורשת - "להעלות קצת את הפילטרים שיתקרבו לשורת
            החיפוש"): כשה-TripMatch המוטמע מוצג, המרווח מעל השורה קטן
            (mt-2 במקום mt-5). במצב הפתיחה (איור "מחפשים לאן לצאת?") mt-2 - האיור
            נצמד לבר התכלת. */}
        <div className={`${destinationQuery ? "mt-3" : "mt-2"} min-h-0 flex-1`}>
          {destinationQuery ? (
            <TripMatchPageContent
              key={embeddedKey}
              embedded
              initialCityQuery={destinationQuery}
              onExitEmbedded={handleExitEmbedded}
            />
          ) : // *** הוסר (בקשה מפורשת - "להעיף את כל עיצובי הטעינה, שזה ישר יקבל את
          // המיקום של המשתמש"): אין יותר מסך המתנה (איור/טקסט) בעמוד הבית.
          // איתור המיקום מתחיל מיד בטעינת העמוד (ה-useEffect של
          // handleUseNearMe למעלה), והכרטיסים מופיעים ברגע שיש יעד.
          null}
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
