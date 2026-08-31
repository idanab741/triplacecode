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
        <Image src={active ? activeSrc : inactiveSrc} alt={alt} fill className="object-contain" />
      </span>
    </span>
  );
}

interface MainBottomNavProps {
  active: "home" | "favorites" | "ai" | "community" | "profile" | "places";
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
      id: "community",
      label: "קהילה",
      icon: (
        <NavIcon
          active={active === "community"}
          activeSrc="/images/icon-globe-active.png"
          inactiveSrc="/images/icon-globe-inactive.png"
          alt="קהילה"
        />
      ),
      href: "/community",
    },
    { id: "ai", label: "trippy AI", icon: "AI", href: elevatedOverride ? undefined : "/ai", elevated: true, elevatedIcon: elevatedOverride?.icon },
 {
      id: "favorites",
      label: "tripmatch",
      icon: (
        <NavIcon
          active={active === "favorites"}
          activeSrc="/images/icon-trips-active.png"
          inactiveSrc="/images/icon-trips-inactive.png"
          alt="tripmatch"
          scale={1}
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
      href: "/profile",
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