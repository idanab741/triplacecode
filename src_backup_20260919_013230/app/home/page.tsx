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
    <div className="min-h-screen bg-bg pb-28">
      <div className="relative mx-auto flex max-w-xl flex-col">
        <HomeHeader loading={loading || profileLoading} />

        {/* לוגו TRIPLACE - קבוע, ממורכז מיד מתחת ל-header (אותה טכניקה
            שהייתה קיימת קודם: margin שלילי קטן כדי שהוא "יתחבר" חזותית
            לשורת ה-header, בלי לחפוף אליה בפועל). */}
        <div className="relative z-10 -mt-5 flex justify-center">
          <Image src="/images/triplace-logo-black.png" alt="TRIPLACE" width={140} height={43} className="object-contain" />
        </div>

        <div className="mt-3">
          <GreetingBlock name={displayName} loading={loading || profileLoading} />
        </div>

        {/* שורת "קרוב אלי" + חיפוש יעד - אחד ליד השני, כמערכת אחת. */}
        <div className="mt-4 flex items-center gap-2 px-6">
          <button
            type="button"
            onClick={handleUseNearMe}
            disabled={locating}
            className="flex shrink-0 items-center gap-1.5 rounded-pill bg-bg px-3.5 py-3 text-xs font-semibold text-ink shadow-soft transition active:scale-95 disabled:opacity-60"
          >
            <Image src="/icons/location.png" alt="" width={16} height={16} />
            {locating ? "מאתר..." : "קרוב אלי"}
          </button>
          <SearchBarLink
            destinationMode
            onSelectDestination={handleSelectDestination}
            containerClassName="relative flex-1"
          />
        </div>
        {locateError && <p className="mt-1 px-6 text-center text-xs text-danger">{locateError}</p>}

        {/* HERO - מערכת ה-TripMatch (Card Stack הניתן להחלקה). מתחבר
            ישירות לקטגוריות/חיפוש שמעליו - זה בדיוק אותו רכיב עם אותה
            לוגיקה בדיוק שקיימת ב-/tripmatch, רק מוטמע כאן. */}
        <div className="mt-5 min-h-0 flex-1">
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

      {/* כפתור "+" צף - הוספת מקום חדש (AddPlaceModal הקיים, בלי שינוי
          בלוגיקה שלו). */}
      <button
        type="button"
        onClick={() => setAddPlaceOpen(true)}
        aria-label="הוסף מקום"
        className="fixed bottom-24 left-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95"
        style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {addPlaceOpen && <AddPlaceModal onClose={() => setAddPlaceOpen(false)} />}

      <MainBottomNav active="home" />
    </div>
  );
}
