"use client";

import { useEffect, useRef, useState } from "react";
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
import { HomeQuickCategories } from "@/screens/home/HomeQuickCategories";
import { AddPlaceFab } from "@/screens/home/AddPlaceFab";
import { AddPlaceModal } from "@/screens/home/AddPlaceModal";
import { LocateMeFab } from "@/screens/home/LocateMeFab";
import type { HomeMapHandle } from "@/screens/home/HomeMap";

// אותו דפוס דינמי-import בדיוק כמו NearbySection.tsx/DiscoveryPlacesMap -
// Leaflet משתמש ב-window/DOM, לא ניתן לרנדר ב-SSR.
const HomeMap = dynamic(() => import("@/screens/home/HomeMap").then((m) => m.HomeMap), { ssr: false });

export default function HomePage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
  } = useAuth();
  const router = useRouter();

  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  // ref ל-handle של המפה (recenterToUser) - ר' HomeMap.tsx.
  const homeMapRef = useRef<HomeMapHandle>(null);

  // *** קיפול בגלילה (בקשה מפורשת, אושרה בסבב שאלות נפרד): בגלילה
  // למטה, ה-HERO (תמונת המסקוט) והברכה האישית מתקפלים ונעלמים - נשארים
  // Header (אווטאר+מיקום+פעמון), הלוגו (triplace-logo-black.png,
  // ממוקם קבוע בין ה-HERO לברכה - ר' JSX), שורת חיפוש, וסוגי הטיול.
  // אותה טכניקה בדיוק (grid-template-rows 0fr/1fr) שכבר הייתה קיימת
  // בעמוד הזה במקור למעבר Home->TripMatch, לא מנגנון אנימציה חדש.
  const [collapsed, setCollapsed] = useState(false);
  // *** תיקון (Bug מפורש - "גוללים במפה למטה וזה מחזיר את החלק האפור,
  // רק גרירה על החלק האפור עצמו צריכה להחזיר אותו"): ref לאלמנט של
  // הכרטיס האפור עצמו - ר' useEffect למטה שמחבר את מחוות היציאה אליו
  // ולא ל-window כולו.
  const grayCardRef = useRef<HTMLDivElement>(null);

  // *** תיקון ישיר ברמת JS (Bug נמשך - "עדיין גורר למטה ורואים את המפה
  // למעלה"): overscroll-behavior ב-CSS (globals.css) לא נאכף באופן
  // אמין בתוך WebView של Natively - זה אפקט ה"ריבאונד" הילידי של
  // iOS/WKWebView, שלא תמיד נשלט ע"י CSS בכלל בסוג הזה של קונטיינר.
  // זה תיקון ישיר על אירועי המגע עצמם, לא תלוי בתמיכת ה-WebView ב-CSS
  // property ספציפי: כשכבר בראש הדף (scrollY=0) והאצבע ממשיכה לגרור
  // כלפי מטה (בדיוק המחווה שגורמת לריבאונד), preventDefault() עוצר
  // את ההתנהגות הילידית של הדפדפן/WebView לגמרי - לפני שהיא מספיקה
  // לזוז ולחשוף את המפה. לא חוסם שום JS אחר (כולל את הגרירה על המפה
  // עצמה - Leaflet מטפל בפאן שלו ידנית ב-JS, לא דרך default browser
  // behavior, אז אינו מושפע מ-preventDefault כאן).
  useEffect(() => {
    let touchStartY = 0;
    function handleTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? 0;
    }
    function handleTouchMove(e: TouchEvent) {
      const currentY = e.touches[0]?.clientY ?? 0;
      const draggingDown = currentY - touchStartY > 0;
      if (window.scrollY <= 0 && draggingDown) {
        e.preventDefault();
      }
    }
    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // סף גלילה רגיל - אותה רוח בדיוק כמו StickyHeader.tsx הקיים
  // (visible = scrollY > 140). ה-spacer השקוף למטה (ר' JSX) הוא מה
  // שנותן לדף בכלל גובה-גלילה לבצע את המחווה הזו - המפה עצמה כבר
  // "fixed" ברקע ולא תלויה בגובה הזה בכלל.
  useEffect(() => {
    function handleScroll() {
      if (!collapsed && window.scrollY > 90) setCollapsed(true);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [collapsed]);

  // יציאה חזרה (גלילה/משיכה למעלה בזמן שכבר בראש הדף) - כשה-spacer
  // קורס ל-0 עם הכניסה למצב מקופל, scrollY מתאפס מעצמו, אז אי אפשר
  // להסתמך על עוד scrollY כדי לצאת - אותו דפוס wheel/touch הפוך
  // שכבר היה קיים כאן קודם ליציאה מ-TripMatch המוטמע.
  //
  // *** תיקון (Bug מפורש - "ברגע שגוללים מהטלפון גם במפה למטה - אז
  // החלק האפור חוזר לגודל מלא - צריך שרק אם אני מחליק על החלק האפור
  // הוא חוזר"): הגרסה הקודמת חיברה את ה-listeners ל-window כולו - כל
  // גרירה כלפי מטה בכל מקום במסך, כולל גרירה על המפה עצמה (שתופסת את
  // רוב המסך במצב מקופל), נתפסה בטעות כמחוות היציאה. עכשיו מחוברים
  // ספציפית לאלמנט של הכרטיס האפור עצמו (grayCardRef) - גרירה על המפה
  // כבר לא נוגעת במנגנון הזה בכלל, רק גרירה שמתחילה בפועל על הכרטיס.
  useEffect(() => {
    if (!collapsed) return;
    const card = grayCardRef.current;
    if (!card) return;

    let gestureEnabled = false;
    const enableTimer = setTimeout(() => {
      gestureEnabled = true;
    }, 500);

    function exitIfAtTop() {
      if (gestureEnabled && window.scrollY <= 0) setCollapsed(false);
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
      if (currentY - touchStartY > 24) exitIfAtTop();
    }

    card.addEventListener("wheel", handleWheel, { passive: true });
    card.addEventListener("touchstart", handleTouchStart, { passive: true });
    card.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      clearTimeout(enableTimer);
      card.removeEventListener("wheel", handleWheel);
      card.removeEventListener("touchstart", handleTouchStart);
      card.removeEventListener("touchmove", handleTouchMove);
    };
  }, [collapsed]);

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
    <div className="min-h-screen bg-bg">
      {/* שכבת המפה - רקע קבוע, מסך מלא, מתחת לכל השאר (z-0). לא מושפעת
          מהקיפול/גלילה למטה בכלל - היא כבר "מלאה" תמיד. */}
      <div className="fixed inset-0 z-0">
        <HomeMap ref={homeMapRef} className="h-full w-full" />
      </div>

      {/* *** תיקון מקיף יותר (Bug נמשך - "המפה עדיין תקועה"): במקום
          לרדוף אחרי כל div שקוף בנפרד (spacer וכו'), ה-wrapper כולו
          מקבל pointer-events-none - כל מגע/גרירה "עובר דרכו" ומגיע
          למפה שמתחתיו כברירת מחדל. רק האזור שבאמת צריך לחסום את המפה
          (הכרטיס האפור האטום עצמו - header/hero/לוגו/ברכה/חיפוש/
          קטגוריות) מקבל בחזרה pointer-events-auto במפורש, כי זה
          התוכן היחיד שבאמת אמור להיות אטום/אינטראקטיבי. */}
      <div className="pointer-events-none relative z-10 mx-auto max-w-xl">
        {/* *** תיקון (בקשה מפורשת - "החלק האפור צריך להיות מקובע! לא
            ייתכן שיהיה אפשר לגלול אותו למעלה ולראות את המפה מלמעלה!
            דטרמיניסטי"): sticky top-0 מבטיח את זה **במוחלט**, לא רק
            "בדרך כלל" לפי חישוב גובה/תזמון אנימציה - ברגע שגלילה הייתה
            מזיזה את הכרטיס מעל y=0, sticky פשוט לא מאפשר את זה, הוא
            נשאר מקובע שם. זה שונה מ-fixed: sticky עדיין תופס את מקומו
            הרגיל בזרימת הדף (חשוב כדי שמנגנון ה-spacer/גובה-גלילה
            שמפעיל את הקיפול ימשיך לעבוד בלי שינוי), רק "נתקע" בתחתית
            ה-scroll שלו במקום להמשיך לזוז איתו. */}
        <div ref={grayCardRef} className="sticky top-0 pointer-events-auto overflow-hidden rounded-b-[50px]" style={{ backgroundColor: "#e5e6f4" }}>
          {/* Header - אווטאר/מיקום/פעמון - נשאר קבוע לגמרי, לא חלק
              מהקיפול (אושר מפורשות). */}
          <HomeHeader avatarUrl={profile?.avatar_url} loading={loading || profileLoading} />

          {/* HERO - מתקפל ונעלם בגלילה למטה. */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
          >
            <div className={collapsed ? "overflow-hidden" : "overflow-visible"}>
              <HomeHero />
            </div>
          </div>

          {/* לוגו TRIPLACE - ללא רקע/כרית, חופף מעט את ה-HERO במצב
              הרגיל. במצב מקופל (HERO בגובה 0) אותו margin שלילי היה
              מצמיד אותו יותר מדי ל-Header שמעליו - לכן פחות margin
              שלילי (רווח קצת יותר גדול מ"המיקום שלי") רק כשמקופלים. */}
          <div className={`relative z-10 flex justify-center ${collapsed ? "-mt-1" : "-mt-5"}`}>
            <Image src="/images/triplace-logo-black.png" alt="TRIPLACE" width={140} height={43} className="object-contain" />
          </div>

          {/* ברכה אישית - מתקפלת ונעלמת בגלילה למטה, יחד עם ה-HERO
              (שני grid-ים נפרדים עם אותו state, כדי שהלוגו יוכל לשבת
              קבוע ביניהם בלי להיות חלק מאף אחד מהם). */}
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out"
            style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
          >
            <div className={collapsed ? "overflow-hidden" : "overflow-visible"}>
              <GreetingBlock name={displayName} loading={loading || profileLoading} />
            </div>
          </div>

          {/* *** סעיף 1 - שורת חיפוש כללית (destinationMode לא מועבר,
              ברירת המחדל של SearchBarLink כבר תומכת בחיפוש מקומות
              כללי + ניווט לעמוד המקום). נשארת קבועה, לא חלק מהקיפול. */}
          <div className={collapsed ? "mt-1" : "mt-4"}>
            <SearchBarLink />
          </div>

          {/* קטגוריות/סוגי הטיול - נשארות קבועות, לא חלק מהקיפול. */}
          <div className={collapsed ? "pb-6 pt-4" : "pb-6 pt-7"}>
            <HomeQuickCategories />
          </div>
        </div>

        {/* Spacer שקוף - נותן לדף גובה גלילה אמיתי כדי שמחוות הגלילה
            למטה תיקלט בכלל (המפה עצמה fixed, לא תלויה בזה). נעלם
            כשמקופלים - אין תוכן קבוע נוסף שדורש גובה בהמשך.
            *** תיקון (Bug - "למה אני לא מצליח לגלול במפה?"): בלי
            pointer-events-none, ה-div הזה (למרות שהוא שקוף/לא-נראה)
            עדיין "תופס" כל מגע/גרירה שקורה בשטח שלו - בדיוק השטח שבו
            רואים את המפה "מציצה" מתחתיו. המגע היה נבלע כאן ולא מגיע
            בכלל למפה. pointer-events-none נותן למגע "לעבור דרכו" -
            עדיין תופס גובה-גלילה לצורך הקיפול, אבל לא חוסם אינטראקציה
            עם מה שמתחתיו. */}
        <div aria-hidden className="pointer-events-none" style={{ height: collapsed ? 0 : "35vh" }} />

      </div>

      <LocateMeFab onClick={() => homeMapRef.current?.recenterToUser()} />
      <AddPlaceFab onClick={() => setAddPlaceOpen(true)} />
      {addPlaceOpen && <AddPlaceModal onClose={() => setAddPlaceOpen(false)} />}

      <MainBottomNav active="home" />
    </div>
  );
}
