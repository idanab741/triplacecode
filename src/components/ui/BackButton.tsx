"use client";

interface BackButtonProps {
  onBack: () => void;
  disabled?: boolean;
}

export function BackButton({ onBack, disabled }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onBack}
      disabled={disabled}
      aria-label="חזרה"
      className="flex h-10 w-10 items-center justify-center text-ink disabled:opacity-40"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="black"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: "scaleX(-1)" }}
      >
        <path d="m14 6-6 6 6 6" />
      </svg>
    </button>
  );
}

/** כפתור חזור בתוך עיגול לבן - אותו עיצוב בדיוק כמו ב-HomeHeader (הבר העליון החדש).
 *  ממקמים אותו מבחוץ (className) - בעמודי hero: "absolute start-5 top-3" (ימין ב-RTL, כמו הבר). */
export function CircleBackButton({ onBack, className = "" }: { onBack: () => void; className?: string }) {
  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(0,50,120,0.35)] ${className}`}
    >
      <BackButton onBack={onBack} />
    </div>
  );
}
