"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";
import { usePersonalizedDestinations } from "@/hooks/usePersonalizedDestinations";
import { MainBottomNav } from "@/components/MainBottomNav";
import { TripHeroHeader } from "@/screens/layout/TripHeroHeader";
import { QUICK_CATEGORIES } from "@/constants/quickCategories";
import { HotDestinations } from "@/screens/home/HotDestinations";
import { DealsComingSoonCard } from "@/screens/discovery/DealsComingSoonCard";
import { AbroadPreferencesCategoryGrid } from "@/screens/discovery/AbroadPreferencesCategoryGrid";

// אותה קטגוריה קיימת ("abroad") מדף הבית - ר' constants/quickCategories.ts.
const ABROAD_CATEGORY = QUICK_CATEGORIES.find((c) => c.id === "abroad")!;

/**
 * עמוד Discovery של "חופשה בחו''ל":
 * - קרוסלת "מותאם בשבילך" - הועברה (לא שוכפלה) מדף הבית - ר'
 *   usePersonalizedDestinations.ts. משתמשת ב-HotDestinations.tsx הקיים
 *   כמו שהוא.
 * - triplacedeals (DealsComingSoonCard) - תיקון Product מפורש
 *   ("אמור להיות פה אך ורק triplacedeals! לא כל הבלוק של גלה עוד! בעמוד
 *   הבית עמוד להיות כל העמוד של גלה עוד"): **רק** הבאנר הסטטי - לא
 *   ה"גלה עוד" המלא (DiscoverCard, עם השקופיות הנוספות: Surprise Me/
 *   Place's/RunTrippy) - זה נשאר בלעדי לעמוד הבית.
 * - גריד "בחר לפי סוג חופשה" (AbroadPreferencesCategoryGrid) - תיקון
 *   Product מפורש: "רשימת ההעדפות שלך כתמונות קטנות, לחיצה נכנסת
 *   לעמוד עם כל היעדים של אותה קטגוריה". מציג אריח לכל קטגוריה
 *   שהמשתמש סימן בעמוד ההעדפות האישיות (vacation_preferences) + "ראה
 *   עוד" שמרחיב לכל 15 הקטגוריות. קליק על אריח -> עמוד קטגוריה נפרד
 *   (/trip-builder/abroad-vacation/category/[id]) עם גריד מלא של כל
 *   היעדים שלה - **מחליף** (לא מוסיף על) את 16 הרשימות המפורטות
 *   שהיו כאן קודם inline, one after another.
 *   "קרוזים ושייט" (חברות ספנות, לא יעדים) מטופל בנפרד (CruiseLinesSection).
 *
 * בכוונה **אין** כאן "הכי חמים עכשיו"/סקשני Places לפי מיקום כמו בשני
 * העמודים האחרים - זה לא נתבקש כאן, וחופשה בחו"ל היא ממילא לא Location-
 * first באותו אופן (בוחרים יעד, לא "מה קרוב אליי עכשיו").
 */
export default function AbroadVacationDiscoverPage() {
  const router = useRouter();
  const { user, preferences } = useAuth();
  const isGuest = Boolean(user?.is_anonymous);

  const { destinations } = usePersonalizedDestinations({
    isGuest,
    userId: user?.id,
    preferencesComplete: isPreferencesComplete(preferences),
  });

  return (
    <div className="min-h-screen bg-white pb-36">
      {/* 1. TOP BAR - זהה במדויק לחופשה בארץ/טיול יומי. */}
      <TripHeroHeader heroSrc="/images/hero-abroad-vacation.png" onBack={() => router.back()} />

      {/* 3. שורה: אייקון+"חופשה בחו''ל" בצד ימין, באותו גודל בדיוק כמו
          בשני העמודים האחרים. */}
      <div className="flex items-center gap-2 px-6 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ABROAD_CATEGORY.imageSrc} alt="" className="h-full w-full object-cover" />
        </span>
        <span className="text-lg font-bold text-ink">חופשה בחו״ל</span>
      </div>

      <div className="mt-5 flex flex-col gap-6">
        {/* 4. "מותאם בשבילך" - הועבר מדף הבית. תיקון Product מפורש
            ("שים לב בקרוסלה... היא משתנה אחרי הטעינה! אני מעדיף שישאר
            מותאם בשבילך"): קודם הכותרת הייתה מותנית ב-personalized
            (מתחיל false בזמן טעינה = "יעדים חמים", הופך true אחרי
            שהנתונים נטענים = "מותאם בשבילך") - זה גרם להחלפת טקסט
            נראית-לעין אחרי הטעינה. עכשיו קבועה תמיד ל"מותאם בשבילך",
            בלי תלות ב-personalized. */}
        <HotDestinations title="מותאם בשבילך" destinations={destinations} />

        {/* 5. triplacedeals - רק הבאנר הסטטי, לא "גלה עוד" המלא. תמונת
            הבאנר הספציפית לחו"ל (סנטוריני), לא זו של חופשה בארץ. */}
        <DealsComingSoonCard variant="abroad" />

        {/* 6. גריד "בחר לפי סוג חופשה" - אריחים לפי vacation_preferences של
            המשתמש, קליק פותח עמוד קטגוריה נפרד עם כל היעדים שלה.
            מחליף את 16 הרשימות המפורטות שהיו כאן קודם. */}
        <AbroadPreferencesCategoryGrid userPreferenceValues={preferences?.vacation_preferences} />
      </div>

      {/* 8. Bottom Navigation - ממוחזר במלואו. */}
      <MainBottomNav active="home" />
    </div>
  );
}
