"use client";

import { useState, type ReactNode } from "react";

/** הכפתור הראשי הקבוע של האפליקציה (components/ui/Button, primary) - כקישור <a>, לקישורים חיצוניים
 *  (Google Maps) שצריכים target=_blank, ש-Button לא מעביר ל-Link. אותן מידות, פינות וגרדיאנט בדיוק. */
export const PRIMARY_LINK_CLASS =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-6 text-[15.5px] font-semibold text-white shadow-soft transition-opacity hover:opacity-90 active:scale-[0.98]";

/** כפתור עגול לבן שצף מעל מפה (חזרה / אפשרויות / מפה מלאה). 44px - יעד מגע נוח. */
export function HeroIconButton({
  label,
  onClick,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-[0_4px_14px_-4px_rgba(15,20,25,0.35)] transition active:scale-95"
    >
      {children}
    </button>
  );
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXT.test(url);
}

/** תמונה או סרטון שממלאים את המסגרת של ההורה. סרטון: פריים ראשון + סימן Play. תמונה שנכשלה בטעינה
 *  נעלמת בשקט (רואים את רקע המסגרת) - לא אייקון "תמונה שבורה". */
export function MediaTile({ url, video }: { url: string; /** true = סרטון גם כשאין סיומת בכתובת. */ video?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  if (video || isVideoUrl(url)) {
    return (
      <>
        <video src={`${url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" onError={() => setFailed(true)} />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#0f1419]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </span>
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} className="h-full w-full object-cover" />
  );
}

/* ───────────── אייקונים ───────────── */

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** חזרה ב-RTL = חץ ימינה. */
export function BackIcon() {
  return (
    <Svg>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}
export function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
export function NavigateIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m3 11 18-8-8 18-2-8Z" />
    </Svg>
  );
}
export function CalendarIcon() {
  return (
    <Svg size={18}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </Svg>
  );
}
export function PinSmallIcon() {
  return (
    <Svg size={15}>
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Svg>
  );
}
export function ExpandIcon() {
  return (
    <Svg size={18}>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </Svg>
  );
}
export function ChevronStartIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}
export function ChevronEndIcon({ size = 16 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  );
}
