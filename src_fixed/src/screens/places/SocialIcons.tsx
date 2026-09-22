/** אייקוני Instagram / TikTok (קו דק, currentColor) לפילים בפרופיל. */
export function SocialIcon({ platform, size = 16 }: { platform: "instagram" | "tiktok"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (platform === "instagram") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r=".6" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M14 3.5v11.2a3.7 3.7 0 1 1-3.7-3.7" />
      <path d="M14 3.5c.3 2.4 1.9 4 4.5 4.2" />
    </svg>
  );
}
