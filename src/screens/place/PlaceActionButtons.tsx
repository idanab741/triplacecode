interface PlaceActionButtonsProps {
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onSave: () => void;
  onSkip: () => void;
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill={filled ? "white" : "none"}
      stroke={filled ? "white" : "var(--color-ink)"}
      strokeWidth="2"
    >
      <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 9.5 7c-2.5 4.5-9.5 9-9.5 9Z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "var(--color-primary-start)" : "none"}
      stroke="var(--color-ink)"
      strokeWidth="2"
    >
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

/** שלושת כפתורי הפעולה הצפים: לב (לייק), סימנייה (שמירה), X (דילוג). */
export function PlaceActionButtons({ liked, saved, onLike, onSave, onSkip }: PlaceActionButtonsProps) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center gap-4">
      <button
        type="button"
        onClick={onLike}
        aria-label="לייק"
        className={`flex h-16 w-16 items-center justify-center rounded-full shadow-soft transition-transform active:scale-95 ${
          liked
            ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))]"
            : "bg-bg"
        }`}
      >
        <HeartIcon filled={liked} />
      </button>
      <button
        type="button"
        onClick={onSave}
        aria-label="שמירה"
        className="flex h-14 w-14 items-center justify-center self-center rounded-full bg-bg shadow-soft transition-transform active:scale-95"
      >
        <BookmarkIcon filled={saved} />
      </button>
      <button
        type="button"
        onClick={onSkip}
        aria-label="דילוג"
        className="flex h-14 w-14 items-center justify-center self-center rounded-full bg-bg shadow-soft transition-transform active:scale-95"
      >
        <XIcon />
      </button>
    </div>
  );
}
