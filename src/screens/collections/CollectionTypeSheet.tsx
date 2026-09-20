"use client";

import { BottomSheet } from "@/components/ui";
import type { CollectionType } from "@/services/social/collectionTypes";

const OPTIONS: { id: CollectionType; emoji: string; label: string; sub: string }[] = [
  { id: "places", emoji: "📍", label: "מקומות", sub: "אספו מקומות סביב רעיון אחד" },
  { id: "trips", emoji: "✈️", label: "טיולים", sub: "אספו טיולים שאהבתם" },
];

/** "מה תרצו לאסוף?" - בחירה אחת בלבד. אחרי הבחירה סוג האוסף נקבע ולא ניתן לערבב בין הסוגים. */
export function CollectionTypeSheet({ onClose, onSelect }: { onClose: () => void; onSelect: (type: CollectionType) => void }) {
  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pb-2">
        <h2 className="mb-3 text-[17px] font-bold text-ink">מה תרצו לאסוף?</h2>
        <div className="flex flex-col gap-1">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onClose();
                onSelect(option.id);
              }}
              className="flex items-center gap-3 rounded-card px-2 py-3 text-start hover:bg-bg-secondary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[22px]" style={{ background: "rgba(124,58,237,0.08)" }}>
                {option.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-ink">{option.label}</span>
                <span className="block text-[12px] text-ink-secondary">{option.sub}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
