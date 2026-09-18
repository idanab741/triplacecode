"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete, isProfileComplete } from "@/services/profile/profileService";
import { getFirstName } from "@/utils/greeting";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeHeader } from "@/screens/home/HomeHeader";
import { GreetingBlock } from "@/screens/home/GreetingBlock";
import { SearchBarLink } from "@/screens/home/SearchBarLink";
import { AddPlaceModal } from "@/screens/home/AddPlaceModal";
import { TripMatchPageContent } from "@/app/tripmatch/page";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

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

  async function handleUseNearMe() {
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
      setDestinationQuery(city);
      setEmbeddedKey((k) => k + 1);
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
    handleUseNearMe().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectDestination(label: string) {
    setLocateError(null);
    setDestinationQuery(label);
    setEmbeddedKey((k) => k + 1);
  }

  // "Reverse Scroll" - חזרה למסך החיפוש הנקי של הבית (למשל אחרי לחיצה
  // על "חזרה"/"ערוך יעד" בתוך ה-TripMatch המוטמע, או סיום סריקה בלי לייקים).
  function handleExitEmbedded() {
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

  const isGuest = Boolean(user?.is_anonymous);
  const displayName = isGuest ? null : getFirstName(profile?.full_name);

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
      <div className="relative mx-auto flex max-w-xl flex-col">
        <HomeHeader loading={loading || profileLoading} />

        <div className="mt-3">
          <GreetingBlock name={displayName} loading={loading || profileLoading} />
        </div>

        {/* שורת חיפוש יעד + "קרוב אלי" - אחד ליד השני, כמערכת אחת.
            *** תיקון (בקשה מפורשת - "קרוב אלי בצד שמאל לא ימין"):
            סדר ה-DOM הפוך בכוונה (חיפוש קודם, קרוב-אלי אחרון) - תחת
            ה-dir="rtl" הגלובלי של האפליקציה, האלמנט האחרון ב-DOM הוא
            זה שמסתיים פיזית בצד שמאל. */}
        <div className="mt-4 flex items-center gap-2 px-6">
          <SearchBarLink
            destinationMode
            onSelectDestination={handleSelectDestination}
            containerClassName="relative flex-1"
          />
          {/* *** תיקון (בקשה מפורשת - "רק אייקון של נעץ סביב עיגול"):
              לא עוד pill עם טקסט - עיגול לבן עם אייקון הנעץ הקיים בלבד
              (/icons/location.png, אותו אייקון בדיוק שכבר משמש בכל
              האפליקציה למיקום), תואם בגודל/סגנון לכפתורי הצ'אט/התראות. */}
          <button
            type="button"
            onClick={handleUseNearMe}
            disabled={locating}
            aria-label={locating ? "מאתר מיקום..." : "קרוב אלי"}
            title="קרוב אלי"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-soft transition active:scale-95 disabled:opacity-60"
          >
            {locating ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-secondary/30 border-t-ink" />
            ) : (
              <Image src="/icons/location.png" alt="" width={20} height={20} />
            )}
          </button>
        </div>
        {locateError && <p className="mt-1 px-6 text-center text-xs text-danger">{locateError}</p>}

        {/* HERO - מערכת ה-TripMatch (Card Stack הניתן להחלקה). מתחבר
            ישירות לקטגוריות/חיפוש שמעליו - זה בדיוק אותו רכיב עם אותה
            לוגיקה בדיוק שקיימת ב-/tripmatch, רק מוטמע כאן. */}
        {/* תיקון (בקשה מפורשת - "להעלות קצת את הפילטרים שיתקרבו לשורת
            החיפוש"): כשה-TripMatch המוטמע מוצג, המרווח מעל השורה קטן
            (mt-2 במקום mt-5). במצב הפתיחה (הודעת "חפשו יעד") נשאר mt-5. */}
        <div className={`${destinationQuery ? "mt-2" : "mt-5"} min-h-0 flex-1`}>
          {destinationQuery ? (
            <TripMatchPageContent
              key={embeddedKey}
              embedded
              initialCityQuery={destinationQuery}
              onExitEmbedded={handleExitEmbedded}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 px-10 py-16 text-center text-ink-secondary">
              <p className="text-sm font-medium">
                חפשו יעד למעלה, או לחצו על &quot;קרוב אלי&quot; כדי להתחיל להחליק על מקומות מותאמים אישית.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* *** הוסר (בקשה מפורשת - "הכפתור (+) אפשר להעיף מהעמוד הזה - לא
          רלוונטי"): כפתור ה-"+" הצף להוספת מקום. ה-AddPlaceModal עצמו
          נשאר, והוא עדיין נפתח דרך ?openAddPlace=1 (מ-CreateMenuSheet
          בעמוד הפרופיל) - ר' ה-effect למעלה. */}
      {addPlaceOpen && <AddPlaceModal onClose={() => setAddPlaceOpen(false)} />}

      <MainBottomNav active="home" />
    </div>
  );
}
