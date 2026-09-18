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
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="m14 6-6 6 6 6" />
      </svg>
    </button>
  );
}
