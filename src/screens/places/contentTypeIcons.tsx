import type { ProfileTileKind } from "@/services/social/profileContentTypes";

/** אייקוני סוגי התוכן - אותו סט בפרופיל (אריחים + טאבים) ובעמוד "תוכן": פוסט (בועת שיחה), ביקורת (סיכת מיקום),
 *  אוסף (ערימת כרטיסים), טיול (מסלול). "all" = רשת. currentColor, קו דק - הצבע נקבע ע"י ההורה. */
export function ContentTypeIcon({ kind, size = 20 }: { kind: ProfileTileKind | "all"; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

  if (kind === "all") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
      </svg>
    );
  }
  if (kind === "post") {
    return (
      <svg {...common}>
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.5V17A2.5 2.5 0 0 1 4 14.5v-8Z" />
        <path d="M8 9h8M8 12.5h5" />
      </svg>
    );
  }
  if (kind === "review") {
    return (
      <svg {...common}>
        <path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" />
        <circle cx="12" cy="10.5" r="2.3" />
      </svg>
    );
  }
  if (kind === "collection") {
    return (
      <svg {...common}>
        <rect x="4.5" y="3.5" width="12" height="11" rx="2.2" opacity=".55" />
        <rect x="7.5" y="6.5" width="12" height="11" rx="2.2" opacity=".8" />
        <rect x="9.5" y="9.5" width="10.5" height="11" rx="2.2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="5.5" cy="18" r="1.8" />
      <circle cx="18.5" cy="6" r="1.8" />
      <path d="M7 17c3-1 3-5 6-5s3-3 4.5-4.5" strokeDasharray="2 2.6" />
    </svg>
  );
}
