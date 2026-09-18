"use client";

import Image from "next/image";
import { BottomSheet } from "@/components/ui";

interface CreateMenuSheetProps {
  onClose: () => void;
  onSelectPost: () => void;
  onSelectReview: () => void;
  onSelectPlace: () => void;
  onSelectTrip: () => void;
}

const OPTIONS = [
  { id: "post", label: "פוסט", sub: "טקסט, תמונה או סרטון", icon: "/images/places-menu-post.png" },
  { id: "review", label: "ביקורת", sub: "על מקום קיים או מקום חדש", icon: "/images/places-menu-review.png" },
  { id: "place", label: "מיקום", sub: "הצע מקום חדש למאגר", icon: "/images/places-menu-location.png" },
  { id: "trip", label: "טיול חדש", sub: "בניית טיול", icon: "/images/places-menu-trip.png" },
] as const;

/** תפריט היצירה המרכזי של place's. BottomSheet המשותף כבר מספק handle
 *  בר משלו - לא מוסיפים כאן שני (זו הייתה הבעיה - "שני הפסים למעלה"). */
export function CreateMenuSheet({ onClose, onSelectPost, onSelectReview, onSelectPlace, onSelectTrip }: CreateMenuSheetProps) {
  function handleSelect(id: (typeof OPTIONS)[number]["id"]) {
    onClose();
    if (id === "post") onSelectPost();
    else if (id === "review") onSelectReview();
    else if (id === "place") onSelectPlace();
    else onSelectTrip();
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pb-2">
        <h2 className="mb-3 text-[17px] font-bold text-ink">מה תרצה ליצור?</h2>
        <div className="flex flex-col gap-1">
          {OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option.id)}
              className="flex items-center gap-3 rounded-card px-2 py-3 text-start hover:bg-bg-secondary"
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "rgba(124,58,237,0.08)" }}
              >
                <Image src={option.icon} alt="" width={22} height={22} className="object-contain" />
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
