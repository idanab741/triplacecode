"use client";

import Link from "next/link";
import Image from "next/image";
import { BackButton } from "@/components/ui";
import { PlacesNotificationBell } from "./PlacesNotificationBell";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { PlacesHeaderRow, PLACES_BAR_GRADIENT, PLACES_BAR_SHADOW } from "./PlacesHeaderRow";

interface PlacesHeaderProps {
  /** אם לא מועבר - זהו עמוד הבית: מוצג רק כפתור חזרה בצד שמאל בעמודי
   *  משנה. הפעמון תמיד בצד שמאל (בדיוק כמו triplace). */
  onBack?: () => void;
  /** *** תוספת (בקשה מפורשת - "הקאבר צריך לכסות גם את הבר העליון
   *  כשהוא על רקע שקוף - עד שגוללים למטה, ואז הוא נהיה על רקע לבן"):
   *  כשמועבר true - הבר עצמו שקוף (בלי רקע/צל), כדי שתמונת הקאבר
   *  שמתחתיו תיראה דרכו. ההורה (עמוד הפרופיל) אחראי להחליט מתי true
   *  (לפני גלילה) ומתי false (אחרי גלילה, רקע לבן רגיל). ברירת מחדל
   *  false - כל שאר עמודי place's לא מושפעים. */
  transparent?: boolean;
  /** *** תוספת: true = הבר "צף" מעל התוכן (fixed, לא תופס מקום בזרימה
   *  הרגילה) - נדרש כדי שהקאבר בעמוד הפרופיל יוכל להתחיל מ-y=0
   *  ולהיראות *דרך* הבר כשהוא transparent. ברירת מחדל false (sticky,
   *  ההתנהגות הרגילה שכל שאר עמודי place's מסתמכים עליה) - כדי לא
   *  לשבור עמודים אחרים שמניחים שהבר תופס את המקום שלו בזרימה. */
  overlay?: boolean;
  /** *** תוספת (בקשה מפורשת): קישור לתפריט שלוש-הפסים - כשמועבר,
   *  מחליף את כפתור הצ'אט בפינה הנגדית לתפריט שמוביל לשם (בעמוד
   *  הפרופיל: /profile, עמוד החשבון הכללי - לא /places). */
  menuHref?: string;
  /** *** חדש (בקשה מפורשת - "החלק העליון כמו בעמוד הבית, עם place's בלבן ורקע סגול
   *  דינמי אנימטיבי"): "purple" = הבר החדש (סגול מונפש, פינות תחתונות מעוגלות,
   *  place's בלבן, פעמון וצ'אט בעיגולים לבנים כמו בבית). ברירת מחדל "default" -
   *  כל שאר עמודי place's נשארים בדיוק כמו קודם. עם onBack: כפתור החזרה של
   *  האפליקציה מחליף את הצ'אט. */
  variant?: "default" | "purple";
}

/** Header אחיד לכל עמודי place's.
 *  מרווחים: px-5 מהקצה (20px) - בדיוק כמו HomeHeader של triplace
 *  (grid-cols-[40px_1fr_40px] px-5). הפעמון תופס את אותו מיקום שהפעמון
 *  תופס שם, וכפתור הצ'אט תופס בדיוק את המיקום שתמונת הפרופיל תופסת שם
 *  (העמודה הנגדית).
 *
 *  *** תיקון (בקשה מפורשת - "תעביר את הזכוכית המגדלת לקצה השמאלי של
 *  שורת 'כתבו את הטיול שלכם', בקו ישר מתחת לפעמון"): כפתור החיפוש
 *  שהיה כאן ליד הצ'אט הוסר לגמרי - עבר ל-CreatePostBar.tsx, ממוקם שם
 *  ב-`left-5` כדי ליישר בדיוק מתחת לפעמון (שגם הוא ב-left-5, כאן).
 *  right-3.5 (14px) על קבוצת הצ'אט - שנשאר לבד עכשיו - לא שונה, כדי
 *  לא לשבור את היישור מול עיגול הפרופיל ב-CreatePostBar (ר' ההסבר
 *  המקורי: 14+20=34px מהקצה, זהה ל-16+18=34px של עיגול הפרופיל).
 *
 *  *** תיקון (בקשה מפורשת - עמוד פרופיל, אפקט קאבר-מתחת-לבר): fixed
 *  במקום sticky - sticky לא היה מאפשר לבר "לצוף" מעל הקאבר מהרגע
 *  הראשון (הוא רק "נדבק" לאחר שהיה כבר בזרימה הרגילה וגללת אותו).
 *  ההורה שמעביר transparent=true חייב לפצות עם ריווח עליון מקביל
 *  לגובה הבר (h-16) על שאר התוכן - חוץ מהקאבר עצמו, שאמור להתחיל
 *  מ-y=0 כדי שהבר יצוף מעליו ולא מעל רווח לבן. */
export function PlacesHeader({ onBack, transparent = false, overlay = false, menuHref, variant = "default" }: PlacesHeaderProps) {
  if (variant === "purple") {
    return (
      <CollapsibleTopBar
        headerRow={<PlacesHeaderRow onBack={onBack} menuHref={menuHref} />}
        gradient={PLACES_BAR_GRADIENT}
        shadow={PLACES_BAR_SHADOW}
        tone="purple"
      />
    );
  }

  return (
    <header
      className={`left-0 right-0 top-0 z-30 w-full transition-colors ${overlay ? "fixed" : "sticky"} ${
        transparent ? "bg-transparent" : "bg-white shadow-[0_1px_0_rgba(16,24,40,0.06)]"
      }`}
    >
      <div className="relative h-16 px-5">
        {/* *** תיקון (בקשה מפורשת - "תוריד מעט את הלוגו למטה ותקטין
            אותו ב-10%"): 130x42 -> 117x38 (מוכפל ב-0.9, מעוגל).
            top-1/2 היה ממורכז מדויק - top-[57%] מזיז אותו מעט מטה
            בתוך ה-header (h-16=64px), במקום להזיז את כל שאר הפריטים
            בשורה גם כן. */}
        <span className="absolute left-1/2 top-[57%] -translate-x-1/2 -translate-y-1/2 select-none">
          <Image
            src="/images/places-logo.png"
            alt="place's"
            width={117}
            height={38}
            className="h-[38px] w-[117px] object-contain"
            priority
          />
        </span>

        {onBack ? (
          <div className="absolute left-5 top-1/2 -translate-y-1/2">
            <BackButton onBack={onBack} />
          </div>
        ) : (
          <div className="absolute left-5 top-1/2 -translate-y-1/2">
            <PlacesNotificationBell />
          </div>
        )}

        <div className="absolute right-3.5 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {/* *** תוספת (בקשה מפורשת - "שלוש פסים בצד שני, שמעביר
              לעמוד הפרופיל של דף הבית"): כשמועבר menuHref, מחליף
              לגמרי את כפתור הצ'אט הרגיל - לא מוסיף עליו. ברירת מחדל
              (לא מועבר) - כל שאר עמודי place's ממשיכים לראות צ'אט,
              בלי שינוי. */}
          {menuHref ? (
            <Link
              href={menuHref}
              aria-label="תפריט"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </Link>
          ) : (
            <Link
              href="/places/chat"
              aria-label="צ'אט"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
            >
              <Image src="/images/places-chat-icon.png" alt="" width={22} height={20} className="object-contain" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
