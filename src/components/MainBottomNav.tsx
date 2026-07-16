"use client";

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
  active: "home" | "favorites" | "ai" | "community" | "profile";
}

/** בר הניווט התחתון האמיתי של האפליקציה, לשימוש בכל מסכי הטאבים הראשיים. */
export function MainBottomNav({ active }: MainBottomNavProps) {
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
    { id: "ai", label: "", icon: "AI", href: "/ai", elevated: true },
    {
      id: "favorites",
      label: "טיולים",
      icon: (
        <NavIcon
          active={active === "favorites"}
          activeSrc="/images/icon-trips-active.png"
          inactiveSrc="/images/icon-trips-inactive.png"
          alt="טיולים"
          scale={1.35}
        />
      ),
      href: "/favorites",
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

  return <BottomNav items={items} activeId={active} />;
}