import type { HTMLAttributes, ReactNode } from "react";

interface ScreenProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** האם להשאיר מקום פנוי בתחתית עבור BottomNav הצף. */
  withBottomNavSpacing?: boolean;
}

/** עטיפת מסך אחידה: רקע, ריווח קבוע, ומקום ל-BottomNav הצף אם צריך. */
export function Screen({
  children,
  withBottomNavSpacing = true,
  className = "",
  ...props
}: ScreenProps) {
  return (
    <div
      className={`min-h-screen bg-bg-secondary px-5 pt-8 ${
        withBottomNavSpacing ? "pb-28" : "pb-8"
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
