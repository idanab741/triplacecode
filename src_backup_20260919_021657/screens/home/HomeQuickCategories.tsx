"use client";

import { useEffect, useRef } from "react";
import {
  HOME_QUICK_CATEGORIES,
  type HomeQuickCategoryId,
} from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";

interface HomeQuickCategoriesProps {
  /** קטגוריות שנבחרו כרגע כפילטר (0 או יותר - בחירה מרובה). */
  selected: HomeQuickCategoryId[];
  /** קליק על עיגול - טוגל: אם הקטגוריה כבר נבחרה, קליק חוזר מבטל אותה. */
  onToggle: (id: HomeQuickCategoryId) => void;
}

/**
 * קטגוריות מהירות ("סוגי הטיול") בגלילה אופקית, בעמוד הבית בלבד.
 *
 * *** שינוי התנהגות (בקשה מפורשת - "אני רוצה שהכפתורים של סוגי
 * האטרקציות יהיו מעין כפתור סינון"): לפני זה כל עיגול היה `Link`
 * שניווט לעמוד Discovery נפרד (HOME_QUICK_CATEGORY_LINKS) - עכשיו זה
 * `button` רגיל שמדווח למעלה (onToggle) איזו קטגוריה נלחצה, ולא מנווט
 * לשום מקום. ההורה (home/page.tsx) הוא זה שמחזיק את מצב הבחירה
 * (selectedCategories) ומסנן לפיו את הפינים במפה + צובע אותם לפי צבע
 * הקטגוריה (ר' HomeMap.tsx) - בדיוק כמו הבקשה: "שברגע שלוחצים עליהם
 * נפתחים רק הנעצים של אותו סוג, בצבע שמופיע מאחורי העיגול".
 *
 * העיגול עצמו מקבל טבעת (ring) בצבע הקטגוריה (category.colorVar) כשהוא
 * נבחר - אינדיקציה ויזואלית קלה של "הפילטר הזה פעיל", בלי לשנות את
 * התמונה/העיצוב הבסיסי של העיגול.
 */
export function HomeQuickCategories({ selected, onToggle }: HomeQuickCategoriesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // מוודא שהרצועה תמיד מתחילה בהתחלה (מימין, כי RTL), גם אם הדפדפן/HMR שמרו מיקום גלילה ישן
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, []);

  return (
    <div
      ref={scrollRef}
      // *** תיקון (בקשה מפורשת - "העיגול נחתך למעלה"): overflow-x-auto
      // בלי overflow-y מפורש גורם לדפדפן לחשב גם ציר Y כ-auto (לא
      // visible) - כל עוד ה-boxShadow/ring של העיגול הנבחר לא מתווסף
      // לגובה הפריסה עצמו, הוא בפועל *נחתך* ע"י אותו auto/clip
      // מלמעלה, כי אין שם אף פיקסל "רזרבה". pt-1 נותן בדיוק את הרווח
      // הדרוש כדי שהטבעת (3px) לא תיחתך, בלי לשנות את המראה כשאין
      // בחירה (ה-pb-1 שכבר היה שם לא מספיק, כי הוא בתחתית).
      className="flex gap-2 overflow-x-auto ps-6 pb-1 pt-1"
      style={{ scrollbarWidth: "none" }}
    >
      {HOME_QUICK_CATEGORIES.map((category) => {
        const isSelected = selected.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onToggle(category.id)}
            aria-pressed={isSelected}
            // *** תיקון (בקשה מפורשת - "יותר קטנים"): רוחב מוקטן
            // (58px, היה 76px) - עדיין מבטיח מרווח אחיד, פשוט צפוף יותר.
            className="flex w-[58px] shrink-0 flex-col items-center gap-1"
          >
            <span
              className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full shadow-soft transition-shadow"
              style={
                isSelected
                  ? { boxShadow: `0 0 0 2.5px var(${category.colorVar}), 0 3px 8px rgba(16,24,40,0.18)` }
                  : undefined
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.imageSrc}
                alt={HOME_QUICK_CATEGORY_LABELS[category.id]}
                className="h-full w-full scale-125 object-cover"
              />
            </span>
            {/* *** תיקון (בקשה מפורשת - "לא צריך שינוי צבע של הטקסט -
                רק המסגרת זה סבבה"): הוסר ה-style הדינמי שצבע את
                הטקסט לפי הקטגוריה - נשאר תמיד text-ink, בלי קשר
                לבחירה. רק הטבעת סביב העיגול (למעלה) מסמנת בחירה. */}
            <span className="w-full text-center text-[10.5px] font-medium leading-tight text-ink">
              {HOME_QUICK_CATEGORY_LABELS[category.id]}
            </span>
          </button>
        );
      })}
      {/* ספייסר בסוף הגלילה - אותו תיקון בדיוק כמו קודם (ה-padding לא
          נשמר עד סוף ה-scrollWidth ב-RTL). */}
      <div aria-hidden className="w-2 shrink-0" />
    </div>
  );
}
