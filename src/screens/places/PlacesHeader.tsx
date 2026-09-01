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
 *  (העמודה הנגדית). כפתור חיפוש חדש יושב לצד הצ'אט, שניהם בלי מסגרת/
 *  רקע עגול - רק האייקון, באותו עובי קו כמו הפעמון.
 *
 *  תיקון (בקשה מפורשת - "שאייקון הצ'אט יהיה ישירות מעל העיגול של
 *  הפרופיל"): קבוצת האייקונים הוזזה מ-right-5 ל-right-4 כדי שהצ'אט
 *  (הראשון בקבוצה, הכי קרוב לקצה) יתיישר במדויק עם מרכז עיגול הפרופיל
 *  ב-CreatePostBar (px-4 + חצי מ-h-9 w-9 = 34px מהקצה, אותו חישוב בדיוק
 *  אחרי השינוי). בנוסף, זכוכית המגדלת (חיפוש) הוזזה עוד קצת ימינה
 *  (relative left-1) לבקשה מפורשת נוספת - צמודה יותר לצ'אט. הצ'אט
 *  עצמו לא זז מ-right-4 (נשאר בדיוק מעל עיגול הפרופיל). */
export function PlacesHeader({ onBack }: PlacesHeaderProps) {
  return (
    <header className="sticky top-0 z-30 w-full bg-white">
      <div className="relative h-16 px-5">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none">
          <Image src="/images/places-logo.png" alt="place's" width={130} height={42} className="object-contain" priority />
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

        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-0">
          <Link href="/places/chat" aria-label="צ'אט" className="flex h-10 w-9 items-center justify-center">
            <Image src="/images/places-chat-icon.png" alt="" width={24} height={22} className="object-contain" />
          </Link>
          <Link href="/places/search" aria-label="חיפוש" className="relative left-1 flex h-10 w-9 items-center justify-center">
            <Image src="/images/places-search-icon.png" alt="" width={23} height={22} className="object-contain" />
          </Link>
        </div>
      </div>
    </header>
  );
}
