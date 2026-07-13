interface PlaceStatsRowProps {
  rating: number | null;
  estimatedVisitMinutes: number | null;
  priceLevel: number | null;
  travelMinutes: number | null;
}

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-category-orange)" stroke="var(--color-category-orange)" strokeWidth="1">
      <path d="m12 3 2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-secondary)" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-secondary)" strokeWidth="2">
      <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" />
      <rect x="3" y="11" width="18" height="6" rx="2" />
      <circle cx="7.5" cy="17.5" r="1.2" />
      <circle cx="16.5" cy="17.5" r="1.2" />
    </svg>
  );
}

/** ₪ חוזר לפי רמת המחיר (0-4), במקום סכום מומצא. */
function priceLabel(level: number): string {
  if (level === 0) return "חינם";
  return "₪".repeat(level);
}

export function PlaceStatsRow({
  rating,
  estimatedVisitMinutes,
  priceLevel,
  travelMinutes,
}: PlaceStatsRowProps) {
  const stats: { icon: React.ReactNode; label: string }[] = [];

  if (rating != null) {
    stats.push({ icon: <StarIcon />, label: rating.toFixed(1) });
  }
  if (estimatedVisitMinutes != null) {
    stats.push({ icon: <ClockIcon />, label: `${estimatedVisitMinutes} דק'` });
  }
  if (priceLevel != null) {
    stats.push({ icon: <span className="text-sm font-semibold text-ink-secondary">₪</span>, label: priceLabel(priceLevel) });
  }
  if (travelMinutes != null) {
    stats.push({ icon: <CarIcon />, label: `${travelMinutes} דק' נסיעה` });
  }

  if (stats.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 px-6">
      {stats.map((stat, index) => (
        <div key={index} className="flex items-center gap-1.5 text-sm font-medium text-ink">
          {stat.icon}
          {stat.label}
        </div>
      ))}
    </div>
  );
}
