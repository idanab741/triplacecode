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
  whiteWhenInactive = false,
}: {
  active: boolean;
  activeSrc: string;
  inactiveSrc: string;
  alt: string;
  scale?: number;
  /** בר כהה: האייקון הלא-פעיל מוצג בלבן מלא. האייקון הפעיל נשאר בצבעיו. */
  whiteWhenInactive?: boolean;
}) {
  return (
    <span className="relative flex h-6 w-6 items-center justify-center">
      <span className="relative h-full w-full" style={{ transform: `scale(${scale})` }}>
        <Image
          src={active ? activeSrc : inactiveSrc}
          alt={alt}
          fill
          sizes="24px"
          className="object-contain"
          style={whiteWhenInactive && !active ? { filter: "brightness(0) invert(1)" } : undefined}
        />
      </span>
    </span>
  );
}

interface MainBottomNavProps {
  active: "home" | "favorites" | "ai" | "community" | "profile" | "places" | "tripworld" | "tripmatch" | "content";
  /** רק לעמודי place's: מחליף את העיגול המסתובב של Trippy AI בכפתור "+"
   *  ליצירת תוכן (סעיף 6 - בקשה מפורשת: "רק בעמוד של places, חשוב מאוד
   *  שלא תהרוס אותו"). כשלא מועבר (כל שאר האפליקציה) - האייקון, ה-glow
   *  וההתנהגות של Trippy AI נשארים בדיוק זהים ל-100% למה שהיו. */
  elevatedOverride?: { icon: ReactNode; onClick: () => void };
  /** "dark" = בר שחור: כל האייקונים והתוויות הלא-פעילים בלבן, הטאב הפעיל נשאר בצבעיו
   *  (עמוד "תוכן"). ברירת מחדל "light" - כל שאר האפליקציה זהה למה שהייתה. */
  tone?: "light" | "dark";
}

/** בר הניווט התחתון האמיתי של האפליקציה, לשימוש בכל מסכי הטאבים הראשיים
 *  - כולל place's (עם elevatedOverride) - זהו אותו בר בדיוק, לא עותק. */
export function MainBottomNav({ active, elevatedOverride, tone = "light" }: MainBottomNavProps) {
  const whiteWhenInactive = tone === "dark";
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
          whiteWhenInactive={whiteWhenInactive}
        />
      ),
      href: "/home",
    },
    {
      id: "places",
      // *** בקשה מפורשת: הטאב נקרא "מפה", עם אייקון מצפן - שחור רגיל, סגול כשנמצאים עליו.
      label: "מפה",
      icon: (
        <NavIcon
          active={active === "places"}
          activeSrc="/images/icon-map-active.png"
          inactiveSrc="/images/icon-map-inactive.png"
          alt="מפה"
          whiteWhenInactive={whiteWhenInactive}
        />
      ),
      href: "/places",
      // צבע הטקסט כשהטאב פעיל - הסגול של אייקון המצפן (icon-map-active.png).
      activeColor: "#7F03CB",
    },
    // *** tripmatch (בקשה מפורשת): הכפתור האמצעי - לשעבר "trippy AI" - מוביל עכשיו
    // לערימת הכרטיסיות (/tripmatch). הצ'אט של trippy AI (/ai) לא מקושר מהבר בינתיים.
    { id: "tripmatch", label: "tripmatch", icon: "AI", href: elevatedOverride ? undefined : "/tripmatch", elevated: true, elevatedIcon: elevatedOverride?.icon },
    {
      // *** שינוי (בקשה מפורשת - "תוסיף את הפלוס לבר התחתון במקום tripmatch, ייקרא תוכן"):
      // הטאב תופס את המקום של tripmatch. עודכן: לחיצה פותחת את עמוד "תוכן" (/content) -
      // עמוד יצירה שחור עם 4 ריבועים: פוסט / מקום / אוסף / טיול. /tripmatch עצמו לא נמחק - רק לא נגיש מהבר.
      id: "content",
      label: "תוכן",
      icon: (
        <NavIcon
          active={active === "content"}
          activeSrc="/images/icon-content-active.png"
          inactiveSrc="/images/icon-content-inactive.png"
          alt="תוכן"
          whiteWhenInactive={whiteWhenInactive}
        />
      ),
      href: "/content",
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
          whiteWhenInactive={whiteWhenInactive}
        />
      ),
      href: "/places/profile/me",
    },
  ];

  return (
    <BottomNav
      items={items}
      activeId={active}
      tone={tone}
      onChange={(id) => {
        if (id === "tripmatch" && elevatedOverride) elevatedOverride.onClick();
      }}
    />
  );
}