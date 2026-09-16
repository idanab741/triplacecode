"use client";

import Link from "next/link";
import Image from "next/image";
import { BackButton } from "@/components/ui";
import { PlacesNotificationBell } from "./PlacesNotificationBell";

interface PlacesHeaderProps {
  /** אם לא מועבר - זהו עמוד הבית: מוצג רק כפתור חזרה בצד שמאל בעמודי
   *  משנה. הפעמון תמיד בצד שמאל (בדיוק כמו triplace). */
  onBack?: () => void;
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
 *  המקורי: 14+20=34px מהקצה, זהה ל-16+18=34px של עיגול הפרופיל). */
export function PlacesHeader({ onBack }: PlacesHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white">
      <div className="relative h-16 px-5">
        {/* *** תיקון (בקשה מפורשת - "תוריד מעט את הלוגו למטה ותקטין
            אותו ב-10%"): 130x42 -> 117x38 (מוכפל ב-0.9, מעוגל).
            top-1/2 היה ממורכז מדויק - top-[57%] מזיז אותו מעט מטה
            בתוך ה-header (h-16=64px), במקום להזיז את כל שאר הפריטים
            בשורה גם כן. */}
        <span className="absolute left-1/2 top-[57%] -translate-x-1/2 -translate-y-1/2 select-none">
          <Image src="/images/places-logo.png" alt="place's" width={117} height={38} className="object-contain" priority />
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
          <Link
            href="/places/chat"
            aria-label="צ'אט"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
          >
            <Image src="/images/places-chat-icon.png" alt="" width={22} height={20} className="object-contain" />
          </Link>
        </div>
      </div>
    </header>
  );
}
