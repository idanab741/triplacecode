"use client";

import Image from "next/image";
import { BottomSheet } from "@/components/ui";

interface CreateMenuSheetProps {
  onClose: () => void;
  onSelectPost: () => void;
  onSelectPlace: () => void;
  onSelectTrip: () => void;
}

/** *** עדכון (בקשה מפורשת - "אוסף/טיול צריך להיות תחת 'תוכן' בבר התחתון, לא Places"):
 *  "אוסף" (כולל אוסף מסוג טיול) הוסר מתפריט ה-+ של Places - הזרימה היחידה
 *  ליצירת אוסף היא דרך טאב "תוכן". כאן נשארו רק 3 פעולות - פוסט / מקום / טיול.
 *  "מקום" כולל את מה שהיה בעבר "ביקורת" + "מיקום" (המשתמש לא צריך לדעת אם המקום
 *  כבר קיים): חיפוש -> קיים? ממשיכים לביקורת. לא קיים? מציעים להוסיף.
 *  BottomSheet המשותף כבר מספק handle בר משלו - לא מוסיפים כאן שני. */
const OPTIONS = [
  { id: "post", label: "פוסט", sub: "שתפו רגע, סיפור או תוכן", icon: "/images/places-menu-post.png" },
  { id: "place", label: "מקום", sub: "ספרו על מקום שביקרתם בו", icon: "/images/places-menu-location.png" },
  { id: "trip", label: "טיול", sub: "בנו מסלול עם כמה תחנות", icon: "/images/places-menu-trip.png" },
] as const;

export function CreateMenuSheet({ onClose, onSelectPost, onSelectPlace, onSelectTrip }: CreateMenuSheetProps) {
  function handleSelect(id: (typeof OPTIONS)[number]["id"]) {
    onClose();
    if (id === "post") onSelectPost();
    else if (id === "place") onSelectPlace();
    else onSelectTrip();
  }

  return (
    <BottomSheet onClose={onClose}>
      <div className="px-5 pb-2">
        <h2 className="mb-3 text-[17px] font-bold text-ink">מה בא לכם ליצור?</h2>
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
