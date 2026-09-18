"use client";

import type { FeedTab } from "@/services/social/feedService";

const TABS: { id: FeedTab; label: string }[] = [
  { id: "for_you", label: "עבורך" },
  { id: "friends", label: "חברים" },
];

export function FeedTabs({ active, onChange }: { active: FeedTab; onChange: (tab: FeedTab) => void }) {
  return (
    <div className="flex justify-center gap-2 border-b border-ink-secondary/10 px-4 pb-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className="relative px-3 py-2 text-[13.5px] font-bold transition-colors"
          style={{ color: active === tab.id ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}
        >
          {tab.label}
          {active === tab.id && (
            <span
              className="absolute inset-x-2 -bottom-[9px] h-[3px] rounded-full"
              style={{ background: "var(--color-places-purple)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
