"use client";

import type { ReactNode } from "react";
import type { PostVisibility } from "@/services/social/types";
import { CREATE_BLUE, FriendsIcon, GlobeIcon, LockIcon } from "@/screens/create/CreateUi";

/** אותה מערכת Visibility של פוסטים: כולם / חברים / פרטי.
 *  *** עיצוב מחדש: אותם אייקונים כמו בבחירת הפרטיות ביצירת פוסט, כחול האפליקציה לבחירה. */
const OPTIONS: { id: PostVisibility; label: string; icon: ReactNode }[] = [
  { id: "public", label: "כולם", icon: <GlobeIcon size={15} /> },
  { id: "friends", label: "חברים", icon: <FriendsIcon size={15} /> },
  { id: "private", label: "פרטי", icon: <LockIcon size={15} /> },
];

export function VisibilityChips({ value, onChange }: { value: PostVisibility; onChange: (value: PostVisibility) => void }) {
  return (
    <div role="radiogroup" aria-label="מי יכול לראות" className="flex gap-2">
      {OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition active:scale-95 ${
              selected ? "text-white" : "bg-[#F1F2F5] text-ink"
            }`}
            style={selected ? { background: CREATE_BLUE } : undefined}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
