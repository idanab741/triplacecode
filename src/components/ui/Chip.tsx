import type { ReactNode } from "react";

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** צ'יפ בחירה מעוגל: לא מסומן - רקע לבן עם צל, מסומן - גרדיאנט כחול. */
export function Chip({ selected, onClick, children }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-pill px-4 py-2.5 text-[13.5px] font-medium transition active:scale-95 ${
        selected ? "text-white" : "bg-white text-ink"
      }`}
      style={
        selected
          ? {
              background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))",
              boxShadow: "0 4px 12px rgba(24,119,242,0.28)",
            }
          : { boxShadow: "0 2px 8px rgba(16,24,40,0.08)" }
      }
    >
      {children}
    </button>
  );
}