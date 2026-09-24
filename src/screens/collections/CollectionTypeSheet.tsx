"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "@/components/ui";
import type { CollectionType } from "@/services/social/collectionTypes";
import { ChevronIcon, PinIcon, PlaneIcon } from "@/screens/create/CreateUi";

const OPTIONS: { id: CollectionType; icon: ReactNode; label: string; sub: string }[] = [
  { id: "places", icon: <PinIcon size={22} />, label: "מקומות", sub: "אספו מקומות סביב רעיון אחד" },
  { id: "trips", icon: <PlaneIcon size={22} />, label: "טיולים", sub: "אספו טיולים שאהבתם" },
];

/** הירוק של ריבוע "חוויות" בעמוד התוכן - כדי שהפופאפ הכהה ירגיש המשך ישיר של הריבוע שנלחץ. */
const EXPERIENCE_ACCENT = "#5BE3A8";

/** "מה תרצו לכלול בחוויה?" - בחירה אחת בלבד. אחרי הבחירה סוג החוויה נקבע ולא ניתן לערבב בין הסוגים.
 *  *** תוספת (בקשה מפורשת): כשנפתח מעמוד "תוכן" השחור (dark=true) - הפופאפ עצמו כהה, כדי
 *  להתאים לרקע השחור שממנו הוא נפתח. ברירת מחדל false - Sheet לבן רגיל.
 *  *** עיצוב מחדש (בקשה מפורשת - "נתאים לעיצוב של האפליקציה"): אייקוני קו במקום אימוג'י, כרטיסי
 *  בחירה ברורים עם חץ, ובכהה - צבע ההדגשה של ריבוע "חוויות" (ירוק) במקום הסגול הישן. */
export function CollectionTypeSheet({
  onClose,
  onSelect,
  dark = false,
}: {
  onClose: () => void;
  onSelect: (type: CollectionType) => void;
  dark?: boolean;
}) {
  return (
    <BottomSheet onClose={onClose} dark={dark}>
      <div className="px-5 pb-2">
        <h2 className={`text-[20px] font-bold tracking-tight ${dark ? "text-white" : "text-ink"}`}>מה תרצו לכלול בחוויה?</h2>
        <p className={`mb-4 mt-1 text-[14px] ${dark ? "text-white/55" : "text-ink-secondary"}`}>בוחרים סוג אחד - אפשר להוסיף כמה שרוצים ממנו</p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onClose();
                onSelect(option.id);
              }}
              className={`flex items-center gap-3.5 rounded-[20px] px-4 py-3.5 text-start transition active:scale-[0.99] ${
                dark ? "bg-white/[0.06] active:bg-white/10" : "bg-[#F7F8FA] active:bg-[#EFF1F4]"
              }`}
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
                style={
                  dark
                    ? { background: `color-mix(in srgb, ${EXPERIENCE_ACCENT} 16%, transparent)`, color: EXPERIENCE_ACCENT }
                    : { background: "rgba(10,109,254,0.1)", color: "#0A6DFE" }
                }
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-[16px] font-semibold ${dark ? "text-white" : "text-ink"}`}>{option.label}</span>
                <span className={`block text-[13px] ${dark ? "text-white/55" : "text-ink-secondary"}`}>{option.sub}</span>
              </span>
              <span className={dark ? "text-white/30" : "text-[#b3b9c3]"}>
                <ChevronIcon />
              </span>
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
