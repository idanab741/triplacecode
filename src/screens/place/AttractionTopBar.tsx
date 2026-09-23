"use client";

import { HomeHeader } from "@/screens/home/HomeHeader";

/** אותו גרדיאנט+צל בדיוק כמו הבר התכלת של עמוד הבית (BAR_GRADIENT/BAR_SHADOW
 *  ב-CollapsibleTopBar.tsx) - מקור אמת יחיד, מועתק לכאן במקום import כדי
 *  לא לגרור את כל לוגיקת ה-collapse/scroll שלא רלוונטית כאן (בר סטטי בלבד). */
// (בר שקוף - הגרדיאנט/הצל הוסרו, בקשה מפורשת)


interface AttractionTopBarProps {
  backHref?: string;
}

/**
 * *** תיקון (בקשה מפורשת - "ככה לא נראה הבר שלנו!!! ככה הוא נראה!!!
 * [צילום מסך של הבר האמיתי]"): שני ניסיונות קודמים ניסו *לשחזר* את
 * מראה הבר התכלת עם קוד עצמאי משלהם - וזה בדיוק מה שיצר את הפער.
 * התיקון האמיתי: **שימוש ישיר ברכיב HomeHeader עצמו** (screens/home/
 * HomeHeader.tsx) - אותו רכיב, מייבוא, בלי לשכתב אף פיקסל ממנו - עטוף
 * באותו container (גרדיאנט+פינות מעוגלות למטה) שעוטף אותו בעמוד הבית
 * (ר' BAR_GRADIENT/BAR_SHADOW/rounded-b ב-CollapsibleTopBar.tsx), רק
 * בלי לוגיקת ה-scroll/collapse של שורת החיפוש שלא קיימת כאן (בר סטטי).
 * עם onBack - כפתור החזרה של האפליקציה מחליף את כפתור הצ'אט, **באותו
 * עיגול לבן ובאותו מיקום בדיוק** (זו כבר ההתנהגות המובנית של
 * HomeHeader.onBack - לא קוד חדש). כך שיש בטחון מוחלט של 100% זהות
 * ויזואלית לבר האמיתי - אין יותר "שחזור", יש שימוש חוזר.
 */
export function AttractionTopBar({ backHref }: AttractionTopBarProps) {
  return (
    <div className="relative z-10 pb-3">
      <HomeHeader
        loading={false}
        onBack={() => {
          if (backHref) {
            window.location.href = backHref;
          } else {
            window.history.back();
          }
        }}
      />
    </div>
  );
}
