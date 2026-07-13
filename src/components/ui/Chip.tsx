import type { ReactNode } from "react";

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** צ'יפ בחירה מעוגל: לא מסומן - רקע בהיר, מסומן - גרדיאנט כחול. */
export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
        selected
          ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white"
          : "bg-bg-secondary text-ink"
      }`}
    >
      {children}
    </button>
  );
}
