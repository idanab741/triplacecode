"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isMainOnboardingComplete, isProfileComplete } from "@/services/profile/profileService";
import { getFirstName } from "@/utils/greeting";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeHero } from "@/screens/home/HomeHero";
import { HomeHeader } from "@/screens/home/HomeHeader";
import { GreetingBlock } from "@/screens/home/GreetingBlock";
import { SearchBarLink } from "@/screens/home/SearchBarLink";
import { QuickCategories } from "@/screens/home/QuickCategories";
import { DiscoverCard } from "@/screens/home/DiscoverCard";
import { TrendingSection } from "@/screens/home/TrendingSection";
import { PersonalizedMatchesSection } from "@/screens/home/PersonalizedMatchesSection";
import { NearbySection } from "@/screens/home/NearbySection";
import { CommunitySection } from "@/screens/home/CommunitySection";
import { MyTripsSection } from "@/screens/home/MyTripsSection";
import { PartnersSection } from "@/screens/home/PartnersSection";
import { TripMatchPageContent } from "@/app/tripmatch/page";
import { BackButton } from "@/components/ui";

export default function HomePage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
  } = useAuth();
  const router = useRouter();

  // *** שורת החיפוש הופכת לנקודת הכניסה ל-TripMatch (Audit - "Home →
  // Scroll → TripMatch"): ברגע שיש טקסט, ה-Home "גולל" את עצמו - Hero/
  // Header/Search נעלמים למעלה, סוגי הטיול (QuickCategories) נשארים
  // כ-anchor קבוע, ו-TripMatch הקיים (TripMatchPageContent, מוטמע -
  // embedded prop) נחשף ישירות מתחתיהם, בלי router.push/שינוי URL. מחיקת
  // הטקסט מבצעת בדיוק את האנימציה ההפוכה וחוזרת למצב ההתחלתי.
  const [tripMatchQuery, setTripMatchQuery] = useState("");
  const inTripMatchMode = tripMatchQuery.trim().length > 0;
  // *** משמש כ-key על SearchBarLink כדי לאפס אותה (מרענן את הרכיב, מנקה
  // את הטקסט שהוקלד) בחזרה מ-TripMatch למצב ההתחלתי - הבחירה עצמה
  // (destinationMode) לא "מדווחת" יותר על כל הקשה, אלא רק כשמשלימים
  // יעד קיים, אז אין state חיצוני שאפשר לאפס ישירות מ-Home.
  const [searchResetKey, setSearchResetKey] = useState(0);

  function handleExitTripMatch() {
    setTripMatchQuery("");
    setSearchResetKey((k) => k + 1);
  }

  // *** תיקון (בקשה מפורשת - "ברגע שגוללים למעלה זה מאפשר חזרה לעמוד
  // הבית"): כשכבר בראש הדף (scrollY=0) וממשיכים "לגלול למעלה" בעכבר -
  // יוצאים בחזרה למצב ה-Home הרגיל, בדיוק כמו מחיקת הטקסט.
  // *** תיקון (Audit - "יש מנגנון קפיצה לדף הבית באמצע ההחלקה!"):
  // הגרסה הקודמת האזינה גם ל-touchmove ברמת הדף - אבל זו **בדיוק** אותה
  // סוג תנועה שה-Swipe Card עצמו משתמש בה כדי לגרור כרטיס ימינה/שמאלה!
  // כל swipe אמיתי על כרטיס (שכמעט תמיד כולל גם קצת תנועה אנכית, לא
  // רק אופקית טהורה) נקלט בטעות גם ע"י ה-listener הזה ברמת ה-window,
  // וגרם ליציאה אוטומטית **תוך כדי** ההחלקה עצמה. הוסר לגמרי - נשאר רק
  // המחווה בעכבר/trackpad (wheel), שלא מתנגשת עם swipe במגע בכלל
  // (input שונה לחלוטין).
  useEffect(() => {
    if (!inTripMatchMode) return;

    let gestureEnabled = false;
    const enableTimer = setTimeout(() => {
      gestureEnabled = true;
    }, 900);

    function handleWheel(e: WheelEvent) {
      if (gestureEnabled && window.scrollY <= 0 && e.deltaY < -8) handleExitTripMatch();
    }

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      clearTimeout(enableTimer);
      window.removeEventListener("wheel", handleWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inTripMatchMode]);

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
      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-b-[50px]" style={{ backgroundColor: "#e5e6f4" }}>
          {/* חלק "מתגלגל" - הכל שמעל סוגי הטיול. grid-template-rows
              0fr/1fr (במקום max-height בפיקסלים קבועים) כדי שהאנימציה
              תתאים לגובה האמיתי של התוכן (כולל שם משתמש ארוך/הגדרות
              נגישות) בלי לנחש ערך ולסכן קיטוע. */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: inTripMatchMode ? "0fr" : "1fr" }}
          >
            <div className={inTripMatchMode ? "overflow-hidden" : "overflow-visible"}>
              <HomeHeader avatarUrl={profile?.avatar_url} loading={loading || profileLoading} />
              <HomeHero />

              <div className="flex flex-col">
                <GreetingBlock name={displayName} loading={loading || profileLoading} />
                <div className="mt-4">
                  <SearchBarLink
                    key={searchResetKey}
                    destinationMode
                    onSelectDestination={(label) => setTripMatchQuery(label)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* לוגו TripMatch ממורכז - מופיע רק אחרי שמשלימים יעד קיים,
              במקום שורת החיפוש/הירו שקרסו. עדיין מעל סוגי הטיול, בתוך
              אותו בלוק לבנדר בדיוק. החץ-חזרה (שהיה קודם בבר הלבן הישן
              בתוך TripMatch עצמו - הוסר משם) יושב כאן, באותה שורה,
              בצד שמאל. */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: inTripMatchMode ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div className="relative flex items-center justify-center py-3">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <BackButton onBack={handleExitTripMatch} />
                </div>
                <Image src="/images/trip-tripmatch-logo.png" alt="TripMatch" width={140} height={43} className="object-contain" />
              </div>
            </div>
          </div>

          {/* סוגי הטיול - ה-anchor הקבוע. לא זז, לא משתנה עיצובית - רק
              "נשאר בראש המסך" ברגע שהחלק שמעליו קורס. הרקע האפור/לבנדר
              (על ה-div העוטף מלמעלה) נשאר איתם בדיוק, כי הוא אחיד לכל
              התוכן שבתוך אותו div - לא ממשיך מתחתם לתוך TripMatch. */}
          <div className={inTripMatchMode ? "pb-6 pt-1" : "pb-6 pt-7"}>
            <QuickCategories />
          </div>
        </div>

        {inTripMatchMode ? (
          // *** TripMatch מוטמע - אותה קומפוננטה בדיוק כמו עמוד /tripmatch
          // העצמאי (embedded=true רק מסתיר chrome כפול - Screen/BottomNav/
          // חזרה-בניווט; שום שינוי בעיצוב/UI/לוגיקת ה-swipe של TripMatch
          // עצמו). היעד עובר כפי שנבחר, בלי לאפס אותו.
          <Suspense fallback={null}>
            <TripMatchPageContent embedded initialCityQuery={tripMatchQuery} onExitEmbedded={handleExitTripMatch} />
          </Suspense>
        ) : (
          <>
            {/* תיקון (בקשה מפורשת - "גלה עוד ישר מתחת לסוג הטיול" +
                "השותפים צריך להיות אחרון"): גלה עוד ראשון מתחת ל-Trip
                Types (בגודל המקורי), הטיולים שלי אחריו, והשותפים עברו
                לסוף לגמרי - אחרי כל 5 הסקשנים החדשים.
                תיקון (בקשה מפורשת - "הרווחים בין כל בלוק לא זהים"):
                כל התוכן הזה היה מפוצל ל-3 div-ים נפרדים, כל אחד עם
                pt/pb משלו - בגבול שבין שני div-ים העיטופים הצטברו
                זה על זה (pb של האחד + pt של הבא), ויצרו רווח *גדול
                יותר* בדיוק בנקודות המעבר בין הבלוקים, לעומת ה-gap
                האחיד בתוך כל div. עכשיו הכל div אחד, gap-6 יחיד -
                בדיוק אותו רווח בין כל שני בלוקים לאורך כל העמוד. */}
            <div className="flex flex-col gap-6 pb-6 pt-5">
              <DiscoverCard />
              <MyTripsSection />
              <TrendingSection />
              <PersonalizedMatchesSection />
              <NearbySection />
              <CommunitySection />
              <PartnersSection />
            </div>
          </>
        )}
      </div>

      <MainBottomNav active={inTripMatchMode ? "favorites" : "home"} />
    </div>
  );
}

