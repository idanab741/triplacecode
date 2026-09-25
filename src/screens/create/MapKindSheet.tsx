"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/ui";
import { ChevronIcon, PinIcon, PlaneIcon } from "@/screens/create/CreateUi";

export type MapKind = "places" | "route" | "trips";

function RouteIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="19" r="2.2" />
      <circle cx="18" cy="5" r="2.2" />
      <path d="M8.2 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.8" />
    </svg>
  );
}

const OPTIONS: { id: MapKind; icon: ReactNode; label: string; sub: string }[] = [
  { id: "places", icon: <PinIcon size={22} />, label: "מקומות", sub: "המקומות שאהבתם" },
  { id: "route", icon: <RouteIcon />, label: "מסלול", sub: "לפי סדר, יום אחרי יום" },
  { id: "trips", icon: <PlaneIcon size={22} />, label: "טיולים", sub: "הטיולים שאהבתם" },
];

/**
 * *** בקשה מפורשת ("לזקק את המסגור"): "מפה" בעמוד התוכן מחליפה את "חוויה" ו"טיול" - בשביל המשתמש שניהם
 * "הרבה מקומות". כאן בוחרים איזו מפה: מקומות אהובים (אוסף מקומות), מסלול (טיול לפי ימים) או טיולים
 * שאהבתי (אוסף טיולים). כל אפשרות ממשיכה לזרימת היצירה הקיימת שלה.
 */
export function MapKindSheet({ onClose, onSelect }: { onClose: () => void; onSelect: (kind: MapKind) => void }) {
  return (
    <BottomSheet onClose={onClose} dark>
      <div className="px-5 pb-2">
        <h2 className="text-[20px] font-bold tracking-tight text-white">מה יהיה במפה?</h2>
        <div className="mt-4 flex flex-col gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onClose();
                onSelect(option.id);
              }}
              className="flex items-center gap-3.5 rounded-[18px] bg-white/[0.06] px-4 py-3.5 text-start transition active:scale-[0.99] active:bg-white/10"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.08] text-white">{option.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold text-white">{option.label}</span>
                <span className="block text-[13px] text-white/55">{option.sub}</span>
              </span>
              <span className="text-white/30">
                <ChevronIcon />
              </span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
