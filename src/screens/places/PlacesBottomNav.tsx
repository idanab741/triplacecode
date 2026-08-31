"use client";

import Link from "next/link";

interface PlacesBottomNavProps {
  active: "home" | "chat" | "create" | "notifications" | "profile";
  onCreateClick: () => void;
}

function NavSvg({ path, active }: { path: string; active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d={path}
        stroke={active ? "var(--color-category-purple)" : "var(--color-ink-secondary, #8a94a6)"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICON_PATHS = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  chat: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
  notifications: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  profile: "M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
} as const;

/** Bottom Nav של place's: בית / צ'אט / יצירה (+) / התראות / פרופיל (סעיף 88, 106).
 *  נפרד לגמרי מ-MainBottomNav הקיים - place's הוא הקשר ניווט עצמאי בתוך TRIPLACE. */
export function PlacesBottomNav({ active, onCreateClick }: PlacesBottomNavProps) {
  const item = (id: "home" | "chat" | "notifications" | "profile", label: string, href: string) => (
    <Link
      key={id}
      href={href}
      className="flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-1 text-[10.5px] font-medium"
    >
      <span className="flex h-8 w-8 items-center justify-center">
        <NavSvg active={active === id} path={ICON_PATHS[id]} />
      </span>
      <span
        className="truncate"
        style={{ color: active === id ? "var(--color-category-purple)" : "var(--color-ink-secondary, #8a94a6)" }}
      >
        {label}
      </span>
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div className="relative flex items-end justify-around bg-white px-2 pb-[max(env(safe-area-inset-bottom),22px)] pt-1.5 shadow-[0_-2px_16px_rgba(16,24,40,0.08)]">
        {item("home", "בית", "/places")}
        {item("chat", "צ'אט", "/places/chat")}

        <button
          type="button"
          onClick={onCreateClick}
          aria-label="יצירה"
          className="relative -mt-7 flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-1"
        >
          <span
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full text-white shadow-[0_6px_18px_rgba(159,123,255,0.45)]"
            style={{ background: "var(--color-category-purple)" }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
        </button>

        {item("notifications", "התראות", "/places/notifications")}
        {item("profile", "פרופיל", "/places/profile/me")}
      </div>
    </nav>
  );
}
