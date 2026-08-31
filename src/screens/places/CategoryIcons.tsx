interface CategoryIconProps {
  active: boolean;
}

const stroke = "currentColor";

export function RestaurantIcon({ active }: CategoryIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}>
      <path d="M7 2v7a2 2 0 0 0 4 0V2M9 9v13M17 2c-2 0-3 2-3 5s1 4 3 4v9" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AttractionIcon({ active }: CategoryIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}>
      <circle cx="12" cy="12" r="9" stroke={stroke} strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.6" fill={stroke} />
      <path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function NatureIcon({ active }: CategoryIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}>
      <circle cx="18" cy="6" r="2.3" stroke={stroke} strokeWidth="1.8" />
      <path d="M3 19l5.5-8L12 16l3-4.5L21 19H3z" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function NightlifeIcon({ active }: CategoryIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}>
      <path d="M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 15a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" stroke={stroke} strokeWidth="1.8" />
      <path d="M9 18V6l12-2v11" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HotelIcon({ active }: CategoryIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: active ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}>
      <path d="M3 19v-8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 19v2M3 19h18M13 13h6a2 2 0 0 1 2 2v4M21 19v2" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6.5" cy="12" r="1.1" fill={stroke} />
    </svg>
  );
}
