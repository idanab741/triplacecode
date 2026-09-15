"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
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
import { MapActionsFab } from "@/screens/home/MapActionsFab";
import { AddPlaceModal } from "@/screens/home/AddPlaceModal";
import { FilterModal } from "@/screens/home/FilterModal";
import { LocateMeFab } from "@/screens/home/LocateMeFab";
import type { HomeMapHandle, HomeMapPlace } from "@/screens/home/HomeMap";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";

// אותו דפוס דינמי-import בדיוק כמו NearbySection.tsx/DiscoveryPlacesMap -
// Leaflet משתמש ב-window/DOM, לא ניתן לרנדר ב-SSR.
const HomeMap = dynamic(() => import("@/screens/home/HomeMap").then((m) => m.HomeMap), { ssr: false });

/** סף תזוזה (בפיקסלים) לפני שמחווה נחשבת "כוונה אמיתית", לא רעד קטן. */
const GESTURE_THRESHOLD_PX = 30;

export default function HomePage() {
  const {
    user,
    loading,
    profile,
    profileLoading,
  } = useAuth();
  const router = useRouter();

  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<HomeQuickCategoryId[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // *** בקשה מפורשת - "כפתורי סוגי הטיול הופכים לכפתורי סינון": בחירה
  // מרובה (אפשר כמה קטגוריות ביחד), וקליק חוזר על אותה קטגוריה מבטל
  // אותה (טוגל) - בדיוק כמו ChipGroup.toggle הקיים, רק על המערך הזה.
  function toggleCategory(id: HomeQuickCategoryId) {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }
  const [minRating, setMinRating] = useState(0);
  const [allPins, setAllPins] = useState<HomeMapPlace[]>([]);
  // *** תיקון (Bug - "כפתור המצפן לא עובד"): callback prop (onReady)
  // במקום ref - ר' הערה מפורטת ב-HomeMap.tsx. state, לא useRef, כי
  // אנחנו צריכים שהעדכון יגרום ל-re-render (LocateMeFab צריך לדעת
  // מתי ה-handle הופך זמין כדי שה-onClick שלו יעבוד).
  const [mapHandle, setMapHandle] = useState<HomeMapHandle | null>(null);

  // *** בקשה מפורשת - "כל הדאטה הקודם יעלם! רק דאטה חדש שנזין דרך
  // tripadd" + "תעשה שיופיע ישר על המפה, בהמשך נעשה סינון דרך ADMIN":
  // המקור היחיד למרקרים מעכשיו הוא /api/tripadd/pins - נטען פעם אחת,
  // ומוצג *ישירות* (בלי תלות בפילטר) אלא אם המשתמש בפועל בחר פילטר.
  function loadPins() {
    fetch("/api/tripadd/pins")
      .then((r) => r.json())
      .then((data) => {
        const pins = (data.pins ?? []) as {
          id: string;
          name: string;
          latitude: number;
          longitude: number;
          category: string | null;
          subcategory: string | null;
          rating: number | null;
          google_rating: number | null;
          google_rating_count: number | null;
          accessible: boolean | null;
          address: string | null;
          photo_url: string | null;
          price_level: number | null;
          opening_hours: string[] | null;
        }[];
        setAllPins(
          pins.map((p) => ({
            id: p.id,
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            category: p.category as HomeMapPlace["category"],
            subcategory: p.subcategory,
            rating: p.rating,
            googleRating: p.google_rating,
            googleRatingCount: p.google_rating_count,
            accessible: p.accessible,
            address: p.address,
            photoUrl: p.photo_url,
            priceLevel: p.price_level,
            openingHours: p.opening_hours,
          }))
        );
      })
      .catch(() => setAllPins([]));
  }
  useEffect(() => {
    loadPins();
  }, []);

  // סינון לקוח-צד בלבד, על אותו סט הנתונים היחיד (allPins) - בלי
  // עוד קריאת שרת, בלי עוד מקור דאטה. בלי פילטר נבחר = מציגים הכל.
  const visiblePins = allPins.filter((p) => {
    if (selectedCategories.length > 0 && (!p.category || !selectedCategories.includes(p.category))) return false;
    if (selectedSubcategories.length > 0 && (!p.subcategory || !selectedSubcategories.includes(p.subcategory))) return false;
    if (minRating > 0 && (!p.rating || p.rating < minRating)) return false;
    return true;
  });

  // *** קיפול בגלילה - נשארים רק לוגו/חיפוש/קטגוריות (בקשה מפורשת
  // אחרונה: גם Header - אווטאר/מיקום/פעמון - מתקפל עכשיו יחד עם
  // ה-HERO/ברכה, כך שהלוגו הופך לעליון ביותר במצב מקופל).
  const [collapsed, setCollapsed] = useState(false);
  const grayCardRef = useRef<HTMLDivElement>(null);
  // *** בקשה מפורשת - "כשהמפה קטנה (החלק האפור גדול) המרכז צריך
  // להיות המיקום שלי": צריך לדעת כמה בפועל מהמפה חסום מלמעלה ע"י
  // הכרטיס האפור, כדי ש-HomeMap יוכל למרכז את המיקום בתוך השטח הגלוי
  // בפועל (לא במרכז הגיאומטרי של כל ה-container, שרובו מוסתר).
  // ResizeObserver - לא מספר קבוע מנוחש - מתעדכן אוטומטית גם במעבר
  // בין המצב הרגיל למצב מקופל (גובה שונה לגמרי).
  const [grayCardHeight, setGrayCardHeight] = useState(0);
  useEffect(() => {
    const card = grayCardRef.current;
    if (!card) return;
    const observer = new ResizeObserver(() => {
      // *** לא entry.contentRect (זה תוחם את תיבת ה-content בלבד, בלי
      // padding - וה-padding-top של safe-area-inset-top על הכרטיס
      // *כן* חלק מהשטח שבפועל חוסם את המפה מלמעלה). getBoundingClientRect
      // נותן את הגובה המלא שהכרטיס תופס בפועל על המסך.
      setGrayCardHeight(card.getBoundingClientRect().height);
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // *** תיקון יסודי (Bug נמשך פעמיים - "גוררים למטה ורואים את המפה
  // מלמעלה", "החיפוש נעלם עם המקלדת"): אישרת שזה נבדק בתוך אפליקציית
  // Natively באייפון (WKWebView) - שם יש אפקט "ריבאונד" (bounce)
  // ילידי של iOS על **גלילת הדף הראשית** (html/body) שלא תמיד נשלט
  // ע"י CSS/JS רגילים על העמוד. הפתרון הנכון בסביבת WebView כזו:
  // לנעול לגמרי את גלילת html/body (רק בזמן שעמוד הבית מותקן - לא
  // משפיע על שאר האפליקציה), ולהעביר את כל הגלילה בפועל לתוך
  // קונטיינר-div רגיל משלנו (ר' JSX, overflow-y-auto) - גלילה בתוך
  // div רגיל לא סובלת מה-bounce הילידי של הדף הראשי ב-WKWebView.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // *** תיקון יסודי נוסף (אותו Bug + "החיפוש נעלם עם המקלדת, רק
  // במצב הרגיל"): הגרסה הקודמת קבעה קיפול/הרחבה לפי **מיקום גלילה**
  // (window.scrollY > סף) - זה בדיוק מה ששבר את שורת החיפוש: כשפותחים
  // מקלדת על שדה חיפוש, הדפדפן/WebView גולל אוטומטית את הדף כדי
  // להראות את השדה מעל המקלדת - גלילה **לא קשורה בכלל** לכוונת
  // המשתמש לקפל, אבל חצתה את הסף ותפעלה קיפול לא-רצוי, שהעלים תוכן
  // מסביב לשדה עצמו. הפתרון: קיפול/הרחבה כבר לא תלויים במיקום גלילה
  // בכלל - רק במחוות מפורשות (wheel/touch drag) שמתחילות בפועל על
  // הכרטיס האפור. גלילה שקורית מסיבה אחרת (כמו התאמת מקלדת) לא
  // נוגעת במנגנון הזה כלל.
  useEffect(() => {
    if (collapsed) return;
    const card = grayCardRef.current;
    if (!card) return;

    function handleWheel(e: WheelEvent) {
      if (e.deltaY > 12) setCollapsed(true);
    }

    let touchStartY = 0;
    function handleTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? 0;
    }
    function handleTouchMove(e: TouchEvent) {
      const currentY = e.touches[0]?.clientY ?? 0;
      // אצבע זזה כלפי מעלה (מושכת תוכן כלפי מעלה) = כוונת "גלול למטה".
      if (touchStartY - currentY > GESTURE_THRESHOLD_PX) setCollapsed(true);
    }

    card.addEventListener("wheel", handleWheel, { passive: true });
    card.addEventListener("touchstart", handleTouchStart, { passive: true });
    card.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      card.removeEventListener("wheel", handleWheel);
      card.removeEventListener("touchstart", handleTouchStart);
      card.removeEventListener("touchmove", handleTouchMove);
    };
  }, [collapsed]);

  // יציאה חזרה (מחווה הפוכה) - אותו דפוס בדיוק, סימטרי לכניסה. לא
  // תלוי במיקום גלילה, רק בכך שהמחווה עצמה מתחילה על הכרטיס האפור.
  useEffect(() => {
    if (!collapsed) return;
    const card = grayCardRef.current;
    if (!card) return;

    let gestureEnabled = false;
    const enableTimer = setTimeout(() => {
      gestureEnabled = true;
    }, 400);

    function handleWheel(e: WheelEvent) {
      if (gestureEnabled && e.deltaY < -12) setCollapsed(false);
    }

    let touchStartY = 0;
    function handleTouchStart(e: TouchEvent) {
      touchStartY = e.touches[0]?.clientY ?? 0;
    }
    function handleTouchMove(e: TouchEvent) {
      const currentY = e.touches[0]?.clientY ?? 0;
      if (gestureEnabled && currentY - touchStartY > GESTURE_THRESHOLD_PX) setCollapsed(false);
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
      {/* שכבת המפה - רקע קבוע, מסך מלא, מתחת לכל השאר (z-0). */}
      <div className="fixed inset-0 z-0">
        <HomeMap onReady={setMapHandle} className="h-full w-full" places={visiblePins} obscuredTopPx={grayCardHeight} />
      </div>

      {/* *** קונטיינר-גלילה פנימי משלנו (לא html/body, שנעולים למעלה) -
          overflow-y-auto מאפשר עדיין גלילה אמיתית כשצריך (למשל כדי
          שהדפדפן יוכל להראות שדה חיפוש ממוקד מעל מקלדת) בלי לסבול
          מה-bounce הילידי של WKWebView. overscroll-behavior:contain +
          WebkitOverflowScrolling:touch - התנהגות גלילה חלקה, בלי
          "לדלוף" scroll chaining חזרה לדף הראשי הנעול. pointer-events
          כמו קודם - שקוף לגמרי חוץ מהכרטיס האפור עצמו, כדי שהמפה
          תישאר נגישה למגע בכל שטח ריק. */}
      <div
        className="pointer-events-none fixed inset-0 z-10 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: "touch" } as CSSProperties}
      >
        <div className="relative mx-auto max-w-xl">
          {/* sticky top-0 - קיבוע ודאי שהכרטיס לא "יגלוש" מעל ראש
              המסך (נשאר גם עכשיו, שכבת הגנה נוספת מעל נעילת html/body). */}
          <div
            ref={grayCardRef}
            className="sticky top-0 pointer-events-auto overflow-hidden rounded-b-[50px]"
            // *** תיקון (בקשה מפורשת - "יש לבן מעל הלוגו... הלוגו קרוב
            // מידי"): padding-top לפי safe-area-inset-top - מבטיח שצבע
            // הרקע הלבנדר של הכרטיס ימשיך/יתפוס את השטח מתחת לפס
            // הסטטוס (אם ה-WebView בעורך "edge-to-edge"), ולא ישאיר
            // שם רקע לבן חשוף. בנוסף לרווח נוסף מתחת ללוגו עצמו (ר'
            // ה-className שלו למטה) - שני התיקונים ביחד נותנים ללוגו
            // מרחק נשימה אמיתי מהאזור הזה, במקום צמידות ישירה.
            style={{ backgroundColor: "#e5e6f4", paddingTop: "env(safe-area-inset-top)" }}
          >
            {/* *** Header - אווטאר/מיקום/פעמון - עכשיו מתקפל *יחד* עם
                ה-HERO (בקשה מפורשת אחרונה - "יעלמו גם המיקום שלי,
                ההתראות והפרופיל... שהלוגו יהיה הכי עליון באפור מוקטן").
                נשאר גלוי במצב הרגיל בלבד. */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
            >
              <div className={collapsed ? "overflow-hidden" : "overflow-visible"}>
                <HomeHeader avatarUrl={profile?.avatar_url} loading={loading || profileLoading} />
              </div>
            </div>

            {/* HERO - מתקפל ונעלם בגלילה למטה. */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
            >
              <div className={collapsed ? "overflow-hidden" : "overflow-visible"}>
                <HomeHero />
              </div>
            </div>

            {/* לוגו TRIPLACE - קבוע, לא חלק מהקיפול. במצב מקופל
                (Header+HERO בגובה 0) הוא הופך אוטומטית לאלמנט הכי
                עליון בכרטיס. *** תיקון (בקשה מפורשת - "הלוגו קרוב
                מידי לחלק העליון"): במצב מקופל, במקום margin שלילי
                (שהיה מצמיד אותו ישר לקצה) - padding-top חיובי קטן,
                שנותן לו רווח נשימה אמיתי מלמעלה. */}
            <div className={`relative z-10 flex justify-center ${collapsed ? "pt-3" : "-mt-5"}`}>
              <Image src="/images/triplace-logo-black.png" alt="TRIPLACE" width={140} height={43} className="object-contain" />
            </div>

            {/* ברכה אישית - מתקפלת ונעלמת בגלילה למטה. */}
            <div
              className="grid transition-[grid-template-rows] duration-300 ease-out"
              style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
            >
              <div className={collapsed ? "overflow-hidden" : "overflow-visible"}>
                <GreetingBlock name={displayName} loading={loading || profileLoading} />
              </div>
            </div>

            {/* שורת חיפוש כללית - נשארת קבועה, לא חלק מהקיפול. */}
            <div className={collapsed ? "mt-1" : "mt-4"}>
              <SearchBarLink />
            </div>

            {/* קטגוריות/סוגי הטיול - נשארות קבועות, לא חלק מהקיפול. */}
            <div className={collapsed ? "pb-6 pt-4" : "pb-6 pt-7"}>
              <HomeQuickCategories selected={selectedCategories} onToggle={toggleCategory} />
            </div>
          </div>
        </div>
      </div>

      <LocateMeFab onClick={() => mapHandle?.recenterToUser()} pushedUp={fabOpen} />
      <MapActionsFab
        open={fabOpen}
        onOpenChange={setFabOpen}
        onAddPlace={() => setAddPlaceOpen(true)}
        onFilter={() => setFilterOpen(true)}
        activeFilterCount={selectedCategories.length + selectedSubcategories.length + (minRating > 0 ? 1 : 0)}
      />
      {addPlaceOpen && (
        <AddPlaceModal
          onClose={() => setAddPlaceOpen(false)}
          onSaved={loadPins}
        />
      )}
      {filterOpen && (
        <FilterModal
          onClose={() => setFilterOpen(false)}
          selectedCategories={selectedCategories}
          selectedSubcategories={selectedSubcategories}
          minRating={minRating}
          onChangeCategories={setSelectedCategories}
          onChangeSubcategories={setSelectedSubcategories}
          onChangeMinRating={setMinRating}
        />
      )}

      <MainBottomNav active="home" />
    </div>
  );
}
