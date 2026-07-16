"use client";

import Image from "next/image";
import { BottomNav, type BottomNavItem } from "@/components/ui";

/** אייקון ניווט שמתחלף בין גרסה פעילה ולא-פעילה, לפי הטאב הנבחר. */
function NavIcon({
  active,
  activeSrc,
  inactiveSrc,
  alt,
}: {
  active: boolean;
  activeSrc: string;
  inactiveSrc: string;
  alt: string;
}) {
  return (
    <span className="relative block h-5 w-5">
      <Image src={active ? activeSrc : inactiveSrc} alt={alt} fill className="object-contain" />
    </span>
  );
}

const AiIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.5 15.5l2.9 2.9M5.6 18.4l2.8-2.8M15.5 8.5l2.9-2.9" />
  </svg>
);

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
    { id: "ai", label: "", icon: AiIcon, href: "/ai", elevated: true },
    {
      id: "favorites",
      label: "טיולים",
      icon: (
        <NavIcon
          active={active === "favorites"}
          activeSrc="/images/icon-trips-active.png"
          inactiveSrc="/images/icon-trips-inactive.png"
          alt="טיולים"
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