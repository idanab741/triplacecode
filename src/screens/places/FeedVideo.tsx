"use client";

import { useEffect, useRef, useState } from "react";
import { optimizeImage } from "@/utils/imageUrl";

/** יחס רוחב/גובה מותר בפיד: עד 9:16 לאורך ועד 16:9 לרוחב (כמו באינסטגרם). */
const MIN_RATIO = 9 / 16;
const MAX_RATIO = 16 / 9;

/** רק סרטון אחד מתנגן בכל רגע בפיד - כשסרטון חדש מתחיל, הקודם נעצר. */
let activeVideo: HTMLVideoElement | null = null;

/**
 * *** סרטון בפיד (בקשה מפורשת - "סרטונים צריכים להיפתח בגודל מלא כבר בעמוד הבית, ובלחיצה - תצוגה מלאה
 * וחשוכה, כמו רילס באינסטגרם"):
 *  - בגודל המקורי שלו (סרטון לאורך מוצג לאורך), בלי חיתוך לריבוע/4:3.
 *  - מתנגן אוטומטית בלי קול כשרובו על המסך, ונעצר כשגוללים הלאה.
 *  - כפתור קול בפינה. לחיצה על הסרטון עצמו פותחת את התצוגה המלאה (onOpen).
 */
export function FeedVideo({
  url,
  thumbnailUrl,
  width,
  height,
  onOpen,
}: {
  url: string;
  thumbnailUrl: string | null;
  width?: number | null;
  height?: number | null;
  onOpen: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ratio, setRatio] = useState<number | null>(width && height ? width / height : null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.6) {
          if (activeVideo && activeVideo !== video) activeVideo.pause();
          activeVideo = video;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6] }
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      if (activeVideo === video) activeVideo = null;
    };
  }, []);

  const shown = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio ?? 4 / 5));

  return (
    <div className="relative mt-2.5 overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: String(shown) }}>
      <video
        ref={ref}
        src={url}
        poster={thumbnailUrl ? optimizeImage(thumbnailUrl, 420) : undefined}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={onOpen}
        className="h-full w-full cursor-pointer object-cover"
      />

      {!playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </span>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((m) => !m);
        }}
        aria-label={muted ? "הפעלת קול" : "השתקה"}
        className="absolute bottom-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm"
      >
        <SpeakerIcon muted={muted} />
      </button>
    </div>
  );
}

export function SpeakerIcon({ muted, size = 16 }: { muted: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
      {muted ? <path d="m16 9 5 6M21 9l-5 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
    </svg>
  );
}
