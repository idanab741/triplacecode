"use client";

import type { PostVisibility } from "@/services/social/types";

/** אותה מערכת Visibility של פוסטים (app/places/post/create): כולם / חברים / פרטי. */
const OPTIONS: { id: PostVisibility; label: string }[] = [
  { id: "public", label: "כולם" },
  { id: "friends", label: "חברים" },
  { id: "private", label: "פרטי" },
];

export function VisibilityChips({ value, onChange }: { value: PostVisibility; onChange: (value: PostVisibility) => void }) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={`rounded-pill px-4 py-1.5 text-[13px] font-semibold ${value === option.id ? "text-white" : "bg-bg-secondary text-ink-secondary"}`}
          style={value === option.id ? { background: "var(--color-places-purple)" } : undefined}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
