"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { BottomNav, type BottomNavItem } from "@/components/ui";

/** אייקון ניווט שמתחלף בין גרסה פעילה ולא-פעילה, לפי הטאב הנבחר.
 *  scale אופציונלי — פיצוי זמני על אייקונים שנשמרו עם שוליים לא אחידים בקובץ. */
function NavIcon({
  active,
  activeSrc,
  inactiveSrc,
  alt,
  scale = 1,
}: {
  active: boolean;
  activeSrc: string;
  inactiveSrc: string;
  alt: string;
  scale?: number;
}) {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center">
      <span className="relative h-full w-full" style={{ transform: `scale(${scale})` }}>
        <Image src={active ? activeSrc : inactiveSrc} alt={alt} fill sizes="24px" className="object-contain" />
      </span>
    </span>
  );
}

interface MainBottomNavProps {
  active: "home" | "favorites" | "ai" | "community" | "profile" | "places" | "tripworld" | "tripmatch";
  /** רק לעמודי place's: מחליף את העיגול המסתובב של Trippy AI בכפתור "+"
   *  ליצירת תוכן (סעיף 6 - בקשה מפורשת: "רק בעמוד של places, חשוב מאוד
   *  שלא תהרוס אותו"). כשלא מועבר (כל שאר האפליקציה) - האייקון, ה-glow
   *  וההתנהגות של Trippy AI נשארים בדיוק זהים ל-100% למה שהיו. */
  elevatedOverride?: { icon: ReactNode; onClick: () => void };
}

/** בר הניווט התחתון האמיתי של האפליקציה, לשימוש בכל מסכי הטאבים הראשיים
 *  - כולל place's (עם elevatedOverride) - זהו אותו בר בדיוק, לא עותק. */
export function MainBottomNav({ active, elevatedOverride }: MainBottomNavProps) {
  const items: BottomNavItem[] = [
    {
      id: "home",
      label: "בית",
      icon: (
        <NavIcon
          active={active === "home"}
          activeSrc="/images/icon-home-active.png"
          inactiveSrc="/images/icon-home-inactive.png"
          alt="בית"
        />
      ),
      href: "/home",
    },
    {
      id: "places",
      label: "places",
      icon: (
        <NavIcon
          active={active === "places"}
          activeSrc="/images/icon-globe-active.png"
          inactiveSrc="/images/icon-globe-inactive.png"
          alt="places"
        />
      ),
      href: "/places",
    },
    { id: "ai", label: "trippy AI", icon: "AI", href: elevatedOverride ? undefined : "/ai", elevated: true, elevatedIcon: elevatedOverride?.icon },
    {
      // *** שינוי (בקשה מפורשת - "שנחזיר את tripmatch, במקום tripworld"):
      // הטאב תופס בדיוק את המקום של TripWorld בבר התחתון - לא נוסף טאב
      // שישי. TripWorld עצמו לא נמחק (העמוד /tripworld עדיין קיים), הוא
      // רק לא נגיש יותר מהבר התחתון.
      // *** דורש שני קבצי אייקון חדשים תחת public/images (עדיין לא
      // קיימים בריפו הזה): icon-tripmatch-active.png / -inactive.png,
      // באותו סגנון/מידה כמו שאר אייקוני הבר (home/globe/profile).
      id: "tripmatch",
      label: "tripmatch",
      icon: (
        <NavIcon
          active={active === "tripmatch"}
          activeSrc="/images/icon-tripmatch-active.png"
          inactiveSrc="/images/icon-tripmatch-inactive.png"
          alt="tripmatch"
        />
      ),
      href: "/tripmatch",
    },
    {
      id: "profile",
      label: "פרופיל",
      icon: (
        <NavIcon
          active={active === "profile"}
          activeSrc="/images/icon-profile-active.png"
          inactiveSrc="/images/icon-profile-inactive.png"
          alt="פרופיל"
        />
      ),
      href: "/places/profile/me",
    },
  ];

  return (
    <BottomNav
      items={items}
      activeId={active}
      onChange={(id) => {
        if (id === "ai" && elevatedOverride) elevatedOverride.onClick();
      }}
    />
  );
}