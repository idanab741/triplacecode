"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
import { AddPlaceFab } from "@/screens/home/AddPlaceFab";
import { AddPlaceModal } from "@/screens/home/AddPlaceModal";

// אותו דפוס דינמי-import בדיוק כמו NearbySection.tsx/DiscoveryPlacesMap -
// Leaflet משתמש ב-window/DOM, לא ניתן לרנדר ב-SSR. לא רכיב מפה חדש
// (HomeMap.tsx עצמו מרכיב מחדש את MapTilerBaseLayer/fallback הקיימים).
const HomeMap = dynamic(() => import("@/screens/home/HomeMap").then((m) => m.HomeMap), { ssr: false });

/** גובה המפה במצב הרגיל (מיד מתחת לאזור האפור/לבנדר - "מפה גדולה",
 *  לא כרטיס קטן). ר' הערה על מצב Map Explore למטה לגבי הגובה השני. */
const MAP_HEIGHT_DEFAULT = "min(60vh, 480px)";

export default function HomePage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
  } = useAuth();
  const router = useRouter();

  // *** שינוי מבני (פרומפט חדש - "TRIPLACE Home redesign, שלב 1"):
  // מצב "Map Explore" - כשהמשתמש גולל למטה, האזור האפור/לבנדר העליון
  // מתקפל (grid-template-rows 0fr/1fr, אותה טכניקה בדיוק שהייתה קיימת
  // כאן קודם למעבר Home->TripMatch המוטמע - ממחזרים אותה, לא ממציאים
  // מנגנון אנימציה חדש) והמפה מתרחבת למסך כמעט מלא, עם Header קומפקטי
  // (לוגו בלבד) למעלה ו-Bottom Nav קבוע למטה.
  const [mapExplore, setMapExplore] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);

  // כניסה ל-Map Explore: סף גלילה רגיל (window.scrollY), באותה רוח כמו
  // StickyHeader.tsx הקיים (visible = scrollY > 140). ברגע שנכנסים למצב
  // Map Explore האזור המתקפל+ה-spacer מתכווצים ל-0 (ר' JSX למטה) - הדף
  // נעשה קצר מגובה המסך, אז הדפדפן "מאפס" את scrollY מעצמו. היציאה
  // חזרה במעלה (סעיף 3 בפרומפט) לכן לא יכולה להסתמך על scrollY נוסף -
  // נעשית דרך מחוות wheel/touch הפוכות בזמן שנמצאים בראש הדף, בדיוק
  // אותו דפוס בדיוק שהיה קיים כאן קודם ליציאה מ-TripMatch המוטמע.
  useEffect(() => {
    function handleScroll() {
      if (!mapExplore && window.scrollY > 90) setMapExplore(true);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mapExplore]);

  useEffect(() => {
    if (!mapExplore) return;

    let gestureEnabled = false;
    const enableTimer = setTimeout(() => {
      gestureEnabled = true;
    }, 500);

    function exitIfAtTop() {
      if (gestureEnabled && window.scrollY <= 0) setMapExplore(false);
    }

    function handleWheel(e: WheelEvent) {
      if (window.scrollY <= 0 && e.deltaY < -8) exitIfAtTop();
    }

    let touchStartY = 0;
    function handleTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? 0;
    }
    function handleTouchMove(e: TouchEvent) {
      const currentY = e.touches[0]?.clientY ?? 0;
      // אצבע זזה כלפי מטה (מושכת תוכן למטה) בזמן שכבר בראש הדף = אותה
      // כוונה בדיוק כמו wheel כלפי מעלה - "תראה לי מה שיש מעל".
      if (currentY - touchStartY > 24) exitIfAtTop();
    }

    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      clearTimeout(enableTimer);
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [mapExplore]);

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
      {/* Header קומפקטי - לוגו TRIPLACE בלבד, מוצג רק במצב Map Explore
          (סעיף 3 בפרומפט: "בחלק העליון נשאר Header קטן ונקי עם לוגו
          TRIPLACE בלבד"). fixed כדי שיישאר צמוד למעלה גם כשהמפה תופסת
          כמעט את כל גובה המסך. /images/triplace-logo-black.png - אותו
          קובץ לוגו בדיוק שכבר משמש את כל שאר ה-headers הפשוטים באפליקציה
          (SimpleAppHeader וכו'), לא נכס חדש. */}
      <div
        className={`fixed inset-x-0 top-0 z-40 flex justify-center bg-bg/95 py-3 shadow-[0_2px_10px_rgba(16,24,40,0.06)] backdrop-blur-sm transition-opacity duration-300 ${
          mapExplore ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mx-auto w-full max-w-xl px-5">
          <Image src="/images/triplace-logo-black.png" alt="TRIPLACE" width={110} height={34} className="object-contain" />
        </div>
      </div>

      <div className="mx-auto max-w-xl">
        <div className="overflow-hidden rounded-b-[50px]" style={{ backgroundColor: "#e5e6f4" }}>
          {/* האזור האפור/לבנדר - זהה עיצובית/מבנית למה שהיה קיים
              (לוגו+ברכה+חיפוש+קטגוריות עגולות), בלי לגעת בעיצוב שלו.
              השינוי היחיד בו: שורת החיפוש (למטה) הפכה לחיפוש כללי. */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: mapExplore ? "0fr" : "1fr" }}
          >
            <div className={mapExplore ? "overflow-hidden" : "overflow-visible"}>
              <HomeHeader avatarUrl={profile?.avatar_url} loading={loading || profileLoading} />
              <HomeHero />

              <div className="flex flex-col">
                <GreetingBlock name={displayName} loading={loading || profileLoading} />
                <div className="mt-4">
                  {/* *** סעיף 1 בפרומפט - "יש לבטל את ההתנהגות הזאת
                      [קשירה ל-TripMatch] ולהפוך את השדה לחיפוש כללי
                      בתוך TRIPLACE... בחירה בתוצאה צריכה לפתוח את עמוד
                      המקום המתאים". SearchBarLink כבר תומך בדיוק בזה
                      כברירת המחדל שלו (destinationMode=false, לא מועבר
                      כאן יותר): autocomplete כללי מול
                      /api/places/search-autocomplete, ובחירה מנווטת
                      ל-/search/result?placeId=... (עמוד המקום). לא
                      נבנה מנוע חיפוש חדש - רק הוסרו ה-props
                      (destinationMode/onSelectDestination) שקישרו את
                      השדה ל-TripMatch. */}
                  <SearchBarLink />
                </div>
              </div>

              <div className="pb-6 pt-7">
                <QuickCategories />
              </div>
            </div>
          </div>
        </div>

        {/* *** סעיף 2 בפרומפט - "מיד לאחר סיום האזור האפור/לבנדר יש
            להציג מפה גדולה... המפה מחליפה את התוכן שמופיע כיום מתחת
            לאזור העליון". כל תוכן ה"עוד בשבילך" הקודם (DiscoverCard/
            MyTripsSection/TrendingSection/PersonalizedMatchesSection/
            NearbySection/CommunitySection/PartnersSection) לא נמחק -
            הקומפוננטות והלוגיקה שלהן נשארות בקוד בדיוק כפי שהיו
            (src/screens/home/*.tsx), רק כבר לא מיובאות/מוצגות כאן.
            הן יעברו לעמוד TripWorld בפרומפט נפרד. */}
        <div
          className="relative w-full overflow-hidden transition-[height] duration-300 ease-out"
          style={{ height: mapExplore ? "calc(100dvh - 148px)" : MAP_HEIGHT_DEFAULT }}
        >
          <HomeMap className="h-full w-full" />
        </div>

        {/* Spacer שקוף - נותן לדף גובה גלילה אמיתי כדי שמחוות הגלילה
            למטה (סעיף 3) תיקלט בכלל, כשאין עוד תוכן קבוע מתחת למפה.
            מתכווץ יחד עם הכניסה ל-Map Explore, לא רכיב תוכן. */}
        <div aria-hidden style={{ height: mapExplore ? 0 : "40vh" }} />
      </div>

      {/* כפתור הוספת מקום - צף מעל ה-Bottom Navigation, נגיש בשני
          המצבים (סעיף 4). לחיצה פותחת רק Modal, בלי גלילה/Bottom Sheet. */}
      <AddPlaceFab onClick={() => setAddPlaceOpen(true)} />
      {addPlaceOpen && <AddPlaceModal onClose={() => setAddPlaceOpen(false)} />}

      <MainBottomNav active="home" />
    </div>
  );
}
