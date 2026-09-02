"use client";

import { getAvatarUrl } from "@/constants/avatar";

interface CreatePostBarProps {
  avatarUrl?: string | null;
  onClick: () => void;
}

/** שורת "כתבו את הטיול שלכם" - נקודת הכניסה המרכזית ליצירת תוכן ב-
 *  place's, ממוקמת מעל Stories ומתחת ל-Header, בדיוק כמו ששלחת בדוגמה. */
export function CreatePostBar({ avatarUrl, onClick }: CreatePostBarProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-ink-secondary/10 bg-white px-4 py-3 text-start"
    >
      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getAvatarUrl(avatarUrl)} alt="" className="h-full w-full object-cover" />
      </span>
      <span className="min-w-0 flex-1 rounded-pill bg-bg-secondary px-4 py-2.5 text-[13.5px] text-ink-secondary">
        כתבו את הטיול שלכם
      </span>
    </button>
  );
}
