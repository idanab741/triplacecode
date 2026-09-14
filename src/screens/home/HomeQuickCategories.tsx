"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  HOME_QUICK_CATEGORIES,
  HOME_QUICK_CATEGORY_LINKS,
  type HomeQuickCategoryId,
} from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";

function buildHref(id: HomeQuickCategoryId): string {
  const link = HOME_QUICK_CATEGORY_LINKS[id];
  if (link.href) return link.href;
  if (link.categories) return `/search?category=${link.categories.join(",")}`;
  if (link.query) return `/search?q=${encodeURIComponent(link.query)}`;
  return "/search";
}

/** קטגוריות מהירות ("סוגי הטיול") בגלילה אופקית, בעמוד הבית בלבד -
 *  אותה מבנה/עיצוב בדיוק כמו QuickCategories.tsx המקורי (המשותף עם
 *  מערכות אחרות באפליקציה), רק מוזן מטקסונומיה עצמאית משלו. */
export function HomeQuickCategories() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // מוודא שהרצועה תמיד מתחילה בהתחלה (מימין, כי RTL), גם אם הדפדפן/HMR שמרו מיקום גלילה ישן
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-auto ps-6 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {HOME_QUICK_CATEGORIES.map((category) => (
        <Link
          key={category.id}
          href={buildHref(category.id)}
          // *** תיקון (בקשה מפורשת - "הרווחים צריכים להיות שווים, טקסט
          // שתופס יותר מדי מקום שירד שורה"): לפני זה לא היה רוחב קבוע
          // על הפריט - הטקסט (למשל "מסעדות וקולינריה") היה רחב יותר
          // מהעיגול (60px) וקבע את רוחב העמודה לפי אורך המילה, כך
          // שהרווחים בפועל בין העיגולים היו לא-אחידים (תלויים באורך
          // התווית של כל קטגוריה). עכשיו לכל פריט רוחב קבוע וזהה
          // (w-[76px], מעט רחב מהעיגול) - זה מבטיח מרווח אחיד תמיד,
          // וטקסט ארוך יותר מהרוחב הזה פשוט עובר שורה (ר' span למטה)
          // במקום "לדחוף" את שאר השורה.
          className="flex w-[76px] shrink-0 flex-col items-center gap-1.5"
        >
          <span className="flex h-15 w-15 items-center justify-center overflow-hidden rounded-full shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={category.imageSrc}
              alt={HOME_QUICK_CATEGORY_LABELS[category.id]}
              // *** תיקון (בקשה מפורשת - "מסביב מסגרת לבנה - לא צריך
              // אותה"): קבצי המקור הם ריבועים (בסגנון אייקון אפליקציה)
              // עם מסגרת/הילה בהירה דקה קרוב לשוליים שלהם - כש-object-
              // cover ממסגר אותם לתוך עיגול, בדיוק השוליים האלה נחתכים
              // ל"טבעת" דקה ונראית ליד קצה העיגול. scale-125 מגדיל את
              // התמונה ביחס למסגרת העיגולה שלה (לא את העיגול עצמו) -
              // כך שרק המרכז (בלי המסגרת הבהירה) מוצג, לא "ממציא"
              // תמונה חדשה, רק מבטל את הצורך להציג את קצוות המקור.
              className="h-full w-full scale-125 object-cover"
            />
          </span>
          <span className="w-full text-center text-xs font-medium leading-tight text-ink">
            {HOME_QUICK_CATEGORY_LABELS[category.id]}
          </span>
        </Link>
      ))}
      {/* ספייסר בסוף הגלילה - אותו תיקון בדיוק כמו ב-QuickCategories.tsx
          המקורי (ה-padding לא נשמר עד סוף ה-scrollWidth ב-RTL). */}
      <div aria-hidden className="w-2 shrink-0" />
    </div>
  );
}
