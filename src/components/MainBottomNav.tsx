"use client";

import { BottomNav, type BottomNavItem } from "@/components/ui";

const HomeIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m3 11 9-8 9 8" />
    <path d="M5 10v10h14V10" />
  </svg>
);

const FavoritesIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9.5 7c-2.5 4.5-9.5 9-9.5 9Z" />
  </svg>
);

const AiIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.5 15.5l2.9 2.9M5.6 18.4l2.8-2.8M15.5 8.5l2.9-2.9" />
  </svg>
);

const CommunityIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="8" r="3" />
    <path d="M2 21c0-3.5 3-5.5 7-5.5s7 2 7 5.5" />
    <circle cx="17" cy="8" r="2.5" />
    <path d="M16.5 15c2.8.3 4.5 2 4.5 6" />
  </svg>
);

const ProfileIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

const ITEMS: BottomNavItem[] = [
  { id: "home", label: "בית", icon: HomeIcon, href: "/home" },
  { id: "favorites", label: "מועדפים", icon: FavoritesIcon, href: "/favorites" },
  { id: "ai", label: "", icon: AiIcon, href: "/ai", elevated: true },
  { id: "community", label: "קהילה", icon: CommunityIcon, href: "/community" },
  { id: "profile", label: "פרופיל", icon: ProfileIcon, href: "/profile" },
];

interface MainBottomNavProps {
  active: "home" | "favorites" | "ai" | "community" | "profile";
}

/** בר הניווט התחתון האמיתי של האפליקציה, לשימוש בכל מסכי הטאבים הראשיים. */
export function MainBottomNav({ active }: MainBottomNavProps) {
  return <BottomNav items={ITEMS} activeId={active} />;
}
