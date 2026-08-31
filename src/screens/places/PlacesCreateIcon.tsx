export function PlacesCreateIcon() {
  return (
    <span
      className="flex h-full w-full items-center justify-center rounded-full text-white shadow-[0_6px_20px_-2px_rgba(124,58,237,0.55)]"
      style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
