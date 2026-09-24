"use client";

import Link from "next/link";
import Image from "next/image";
import { BackButton, Skeleton } from "@/components/ui";
import { PlacesNotificationBell } from "@/screens/places/PlacesNotificationBell";

interface HomeHeaderProps {
  loading: boolean;
  /** *** חדש (בקשה מפורשת - "במקום הצ'אט, כשמתקדמים לעמוד הבא, שישתנה
   *  לכפתור חזור"): כשמועבר, כפתור הצ'אט מוחלף ב-BackButton של האפליקציה
   *  (בתוך אותו עיגול לבן כמו ההתראות). בלי - הצ'אט כמו תמיד. */
  onBack?: () => void;
  /** כשמועבר (עמוד הפרופיל שלי): תפריט שלוש-הפסים מחליף את הפעמון, באותו עיגול לבן ובאותו מקום. */
  menuHref?: string;
  /** "white" - לוגו לבן, לבר הצבעוני (עמודים עם תמונה). ברירת מחדל: תכלת (בר שקוף). */
  logoTone?: "brand" | "white";
}

/**
 * Header עליון של עמוד הבית: כפתור צ'אט עגול בצד שמאל (מוביל ל-Trippy AI,
 * /ai), הלוגו במרכז - **באותה שורה בדיוק, אותו גובה** כמו הצ'אט וההתראות
 * (בקשה מפורשת - קודם הלוגו ישב *מתחת* ל-header עם margin שלילי, לא
 * ממורכז אנכית איתם באמת) - וכפתור ההתראות הקיים בצד ימין, בדיוק כמו
 * קודם, בלי שינוי בלוגיקה שלו.
 *
 * *** שינוי (בקשה מפורשת - שדרוג ויזואלי של מסך הבית): תמונת הפרופיל
 * וכפתור בחירת המיקום ("המיקום שלי") הוסרו מה-header. הפרופיל עדיין
 * נגיש מ-BottomNav, ובחירת יעד/מיקום עברה לשורת החיפוש (SearchBarLink,
 * ר' home/page.tsx) - "קרוב אלי" שם מחליף את התפקיד שהיה לכפתור המיקום
 * כאן. שום דבר מה-Backend/API/לוגיקת ההתראות לא השתנה.
 *
 * *** תוספת (בקשה מפורשת - "חלונית ההתראות צריכה להיות מאוחדת עם
 * ההתראות ב-place's! שיהיו שם אותן התראות!"): הפעמון כאן היה מימוש
 * כפול ונפרד (רק /api/notifications, בלי social) מזה של place's
 * (PlacesHeaderRow) - עכשיו שניהם משתמשים באותה קומפוננטה בדיוק
 * (PlacesNotificationBell, למרות השם ההיסטורי - היא כבר ממזגת triplace+
 * social) כדי שלא תהיה יותר כפילות לוגיקה, ואותה רשימה בדיוק בשני
 * המקומות. גם ההתראה הקבועה ("השלימו את ההתאמות האישיות") וגם שורת
 * "לכל ההתראות" חיות שם - מתקבלות כאן "בחינם".
 */
/** *** בקשה מפורשת ("לסדר בשאר עמודי triplace את מה שעשינו בבר העליון"): כמו בעמוד הבית -
 *  אייקונים נקיים בלי עיגול לבן וצל. ב-logoTone="white" (עמודים כהים) העיגולים נשארים,
 *  כי שם האייקונים השחורים צריכים רקע לבן כדי להיראות. */
const PLAIN_ICON = "flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-black/[0.05]";
/** *** עמודים כהים (logoTone="white", עמוד "תוכן"): גם כאן בלי עיגולים לבנים - האייקונים עצמם הופכים
 *  ללבנים (בקשה מפורשת - "לסדר את עמוד התוכן"). */
const PLAIN_ICON_DARK = "flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-white/10 [&_svg]:stroke-white";

export function HomeHeader({ loading, onBack, menuHref, logoTone = "brand" }: HomeHeaderProps) {
  const dark = logoTone === "white";
  const plain = true;
  const iconBox = dark ? PLAIN_ICON_DARK : PLAIN_ICON;
  // *** גובה קבוע (52px = pt-3 + כפתורים 40px) - זהה בדיוק לשורה של הבר הסגול של place's
  // (PlacesHeaderRow), כך ששני הבארים תמיד באותו גובה, בלי תלות בתוכן.
  return (
    <header className="relative z-10 grid h-[52px] grid-cols-[40px_1fr_40px] items-center px-5 pt-3 pb-0">
      {/* כפתור CHAT - עיגול לבן עם אייקון הצ'אט של המוצר (אותו קובץ בדיוק
          שמשמש ב-PlacesHeader: /images/places-chat-icon.png - בקשה מפורשת:
          "הכפתור של הצ'אט יהיה כמו הצ'אט שלנו באייקונים"). מוביל ל-Trippy AI
          (/ai) כמו קודם, בלי route חדש. */}
      {/* *** תיקון (בקשה מפורשת - "עמוד הצ'אט לא מופיע מהכפתור בבר העליון! והוא לא אמור להוביל ל-Trippy AI!"):
          הכפתור הזה קישר ישירות ל-Trippy AI (/ai), ומעולם לא הגיע לעמוד הצ'אטים החדש (/places/chat) - זו
          הסיבה שהעמוד "לא הופיע". עכשיו הוא מוביל לעמוד הצ'אטים (רשימת כל השיחות: triplace + משתמשים
          אחרים) - בדיוק כמו כפתור הצ'אט בבר הסגול של place's (PlacesHeaderRow), שכבר קישר לשם נכון. */}
      {onBack ? (
        // כפתור "חזור" (BackButton של האפליקציה) במקום הצ'אט - באותו עיגול לבן
        // ובאותו מקום בדיוק, כדי שהבר לא "יקפוץ" בין העמודים.
        <div className={iconBox}>
          <BackButton onBack={onBack} />
        </div>
      ) : (
        <Link
          href="/places/chat"
          aria-label="צ'אטים"
          className={iconBox}
        >
          {loading ? (
            <Skeleton className="h-full w-full rounded-full" />
          ) : (
            <Image src="/images/places-chat-icon.png" alt="" width={24} height={22} className={`h-[22px] w-6 object-contain ${dark ? "brightness-0 invert" : ""}`} />
          )}
        </Link>
      )}

      {/* אמצע - לוגו TRIPLACE, באותה שורה ואותו גובה בדיוק כמו הצ'אט
          וההתראות (items-center על ה-header כבר מיישר אנכית). */}
      {/* *** תיקון (בקשה מפורשת - "העיגולים לא באותו גובה בשני העמודים"): עוטף הלוגו
          בגובה קבוע של 40px (h-10) - זהה לעיגולים. קודם גובה הלוגו (שנקבע לפי היחס
          הטבעי של התמונה) קבע את גובה שורת ה-grid ודחף את העיגולים כ-3px למטה; עכשיו
          הלוגו פשוט "גולש" (overflow) מעל/מתחת לרצועה, ולא משפיע על השורה. זהה
          בדיוק ל-PlacesHeaderRow. */}
      <div className="flex h-10 items-center justify-center">
        {/* *** תיקון (בקשה מפורשת - "הלוגו של triplace צריך להיות בגודל של places"): 150x46 -> 128x39,
            אותה תיבה בדיוק כמו הלוגו של place's ב-PlacesHeaderRow (128x39). */}
        {/* בקשה מפורשת - רקע כחול לאזור העליון: הלוגו השחור הופך ללבן
            (brightness(0) invert(1)) - בלי קובץ לוגו חדש.
            *** הוגדל ב-25% (בקשה מפורשת - "להגדיל מעט את הלוגו"): 120x37 ->
            150x46. -my-1 מקזז את הגובה הנוסף כדי שגובה ההדר לא יקפוץ. */}
        {/* *** בר שקוף (בקשה מפורשת): הלוגו בשחור. נצבע דרך CSS mask מאותו
            קובץ הלוגו השחור - הצורה זהה ב-100%, רק הצבע משתנה. */}
        <span
          role="img"
          aria-label="TRIPLACE"
          className="block h-[53px] w-[174px] shrink-0 select-none"
          style={{
            // *** בקשה מפורשת: triplace בשחור בכל עמודי triplace (סגול רק בעמוד הבית - PlacesHeaderRow);
            // לבן בעמודים כהים.
            backgroundColor: logoTone === "white" ? "#ffffff" : "#000000",
            WebkitMaskImage: "url(/images/triplace-logo-black.png)",
            maskImage: "url(/images/triplace-logo-black.png)",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      </div>

      {menuHref ? (
        <Link
          href={menuHref}
          aria-label="תפריט"
          className={`${iconBox} justify-self-end`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </Link>
      ) : (
        <div className="justify-self-end">
          <PlacesNotificationBell solid plain={plain} inverted={dark} badgeTone="purple" />
        </div>
      )}
    </header>
  );
}
