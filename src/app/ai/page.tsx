"use client";

import Link from "next/link";
import { QUICK_CATEGORIES, type QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";

/** מיפוי מזהה קטגוריה לנתיב הצ'אט המתאים לה - אותם 7 נתיבים קיימים
 *  בדיוק שכבר משמשים את שאר האפליקציה (ראו QuickCategories.tsx). כל
 *  סוג טיול חדש שיתווסף ל-QUICK_CATEGORIES (מקור האמת היחיד באפליקציה
 *  לרשימת סוגי הטיולים) יופיע כאן אוטומטית - אין רשימה כפולה/קשיחה. */
const TRIP_TYPE_ROUTES: Record<QuickCategoryId, string> = {
  day_trip: "/trip-builder/day-trip",
  weekend: "/trip-builder/weekend",
  romantic_date: "/trip-builder/romantic-date",
  nature_trip: "/trip-builder/nature-trip",
  abroad: "/trip-builder/abroad-vacation",
  nightlife: "/trip-builder/nightlife",
  restaurants_cafes: "/trip-builder/restaurants-cafes",
};

/** עמוד הבית של Trippy AI - לא נכנסים ישר לצ'אט, אלא לכאן: בחירת סוג
 *  הטיול קודם, כדי שהצ'אט ייפתח כבר עם הקשר (context) מלא של מה
 *  המשתמש רוצה לתכנן. רשימת סוגי הטיול נטענת דינמית מ-QUICK_CATEGORIES -
 *  אותו מקור אמת שמשמש את מסך הבית - כך ששינוי שם משתקף כאן אוטומטית. */
export default function AiAssistantPage() {
  return (
    <>
      <Screen>
        <div className="flex flex-col items-center px-6 pt-6 text-center">
          <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/tripy.png" alt="Trippy AI" className="h-full w-full object-cover" />
          </span>

          <h1 className="mt-4 text-xl font-bold text-ink">שלום! אני טריפי AI 👋</h1>
          <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-secondary">
            סוכן ה-AI האישי של TRIPLACE.
            <br />
            אני כאן כדי להכיר אתכם, להבין בדיוק מה אתם מחפשים, ולבנות עבורכם
            חופשה שתוכננה במיוחד בשבילכם — מהיעדים ועד המסלול המושלם.
            <br />
            אז בואו נתחיל!
          </p>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3.5 px-6">
          {QUICK_CATEGORIES.map((category, i) => (
            <Link
              key={category.id}
              href={TRIP_TYPE_ROUTES[category.id]}
              className="ai-card-fade-in flex flex-col items-center gap-2.5 rounded-card bg-white p-4 shadow-soft transition active:scale-[0.97]"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={category.imageSrc}
                  alt={QUICK_CATEGORY_LABELS[category.id]}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="text-[13.5px] font-semibold text-ink">
                {QUICK_CATEGORY_LABELS[category.id]}
              </span>
            </Link>
          ))}
        </div>
      </Screen>
      <MainBottomNav active="ai" />

      <style jsx global>{`
        @keyframes ai-card-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .ai-card-fade-in {
          animation: ai-card-fade-in 320ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }
      `}</style>
    </>
  );
}
