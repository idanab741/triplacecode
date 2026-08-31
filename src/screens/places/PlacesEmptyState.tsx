interface EmptyStateProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function PlacesEmptyState({ title, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-[14px] text-ink-secondary">{title}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-pill px-5 py-2 text-[13px] font-bold text-white"
          style={{ background: "var(--color-places-purple)" }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
