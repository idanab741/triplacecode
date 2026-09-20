"use client";

import Image from "next/image";
import { BottomSheet } from "@/components/ui";

interface CreateMenuSheetProps {
  onClose: () => void;
  onSelectPost: () => void;
  onSelectPlace: () => void;
  onSelectCollection: () => void;
  onSelectTrip: () => void;
}

/** אייקון "אוסף" - אין לו PNG בתיקיית images (ל-post/location/trip יש), לכן SVG
 *  באותו סגול ובאותו גודל (22px) כמו שאר האייקונים בתפריט. */
function CollectionIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="var(--color-places-purple)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path d="m3 12 9 4.5 9-4.5" />
      <path d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  );
}

/** *** עדכון (בקשה מפורשת - "כפתור ה-+ במסך Places: מה בא לכם ליצור?"):
 *  4 פעולות יצירה בלבד - פוסט / מקום / אוסף / טיול.
 *  "מקום" כולל את מה שהיה בעבר "ביקורת" + "מיקום" (המשתמש לא צריך לדעת אם המקום
 *  כבר קיים): חיפוש -> קיים? ממשיכים לביקורת. לא קיים? מציעים להוסיף.
 *  BottomSheet המשותף כבר מספק handle בר משלו - לא מוסיפים כאן שני. */
const OPTIONS = [
  { id: "post", label: "פוסט", sub: "שתפו רגע, סיפור או תוכן", icon: "/images/places-menu-post.png" },
  { id: "place", label: "מקום", sub: "ספרו על מקום שביקרתם בו", icon: "/images/places-menu-location.png" },
  { id: "collection", label: "אוסף", sub: "אספו מקומות או טיולים סביב רעיון אחד", icon: null },
  { id: "trip", label: "טיול", sub: "בנו מסלול עם כמה תחנות", icon: "/images/places-menu-trip.png" },
] as const;

export function CreateMenuSheet({ onClose, onSelectPost, onSelectPlace, onSelectCollection, onSelectTrip }: CreateMenuSheetProps) {
  function handleSelect(id: (typeof OPTIONS)[number]["id"]) {
    onClose();
    if (id === "post") onSelectPost();
    else if (id === "place") onSelectPlace();
    else if (id === "collection") onSelectCollection();
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
                {option.icon ? (
                  <Image src={option.icon} alt="" width={22} height={22} className="object-contain" />
                ) : (
                  <CollectionIcon />
                )}
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
