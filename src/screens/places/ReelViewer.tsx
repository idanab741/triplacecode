"use client";

import { useEffect, useRef, useState } from "react";
import { getAvatarUrl } from "@/constants/avatar";
import { SpeakerIcon } from "./FeedVideo";

/**
 * *** תצוגת סרטון מלאה וחשוכה (בקשה מפורשת - "כמו רילס באינסטגרם"):
 *  - מסך מלא שחור, הסרטון כולו על המסך (בלי חיתוך), מתנגן עם קול ובלולאה.
 *  - לחיצה על הסרטון = עצירה / המשך. החלקה למטה או X = סגירה.
 *  - בצד: לייק (עם מספר) ותגובות (סוגר ופותח את התגובות מתחת לפוסט). למטה: מי פרסם + הטקסט.
 *  - פס התקדמות דק בתחתית.
 */
export function ReelViewer({
  url,
  posterUrl,
  authorName,
  authorAvatarUrl,
  text,
  liked,
  likeCount,
  commentCount,
  onLike,
  onComments,
  onClose,
}: {
  url: string;
  posterUrl: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
  text: string | null;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onComments: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const touchStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    // עם קול (הפתיחה היא לחיצה של המשתמש, אז הדפדפן מרשה). אם בכל זאת נחסם - ממשיכים בלי קול.
    ref.current?.play().catch(() => {
      setMuted(true);
      if (ref.current) {
        ref.current.muted = true;
        ref.current.play().catch(() => {});
      }
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlay() {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="צפייה בסרטון"
      className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
      style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragY ? "none" : "transform .2s ease" }}
      onTouchStart={(e) => (touchStartY.current = e.touches[0].clientY)}
      onTouchMove={(e) => {
        if (touchStartY.current == null) return;
        setDragY(Math.max(0, e.touches[0].clientY - touchStartY.current));
      }}
      onTouchEnd={() => {
        if (dragY > 110) onClose();
        else setDragY(0);
        touchStartY.current = null;
      }}
    >
      <video
        ref={ref}
        src={url}
        poster={posterUrl ?? undefined}
        muted={muted}
        loop
        playsInline
        preload="auto"
        onClick={togglePlay}
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress(v.currentTime / v.duration);
        }}
        className="absolute inset-0 h-full w-full object-contain"
      />

      {paused && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
            </svg>
          </span>
        </span>
      )}

      {/* עליון: סגירה + קול */}
      <div
        className="relative z-10 flex items-center justify-between px-3"
        style={{ paddingTop: "max(var(--sat), 12px)" }}
      >
        <button type="button" onClick={onClose} aria-label="סגירה" className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {/* *** בקשה מפורשת: לוגו triplace בלבן באמצע הבר העליון - אותו גודל ומיקום כמו בשאר הברים. */}
        <span
          role="img"
          aria-label="triplace"
          className="pointer-events-none absolute left-1/2 block h-[53px] w-[174px] -translate-x-1/2 -translate-y-1/2 select-none"
          style={{
            top: "calc(max(var(--sat), 12px) + 22px)",
            backgroundColor: "#ffffff",
            WebkitMaskImage: "url(/images/triplace-logo-black.png)",
            maskImage: "url(/images/triplace-logo-black.png)",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))",
          }}
        />
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "הפעלת קול" : "השתקה"}
          className="flex h-11 w-11 items-center justify-center rounded-full active:bg-white/10"
        >
          <SpeakerIcon muted={muted} size={22} />
        </button>
      </div>

      {/* תחתון: פרטי המפרסם + פעולות */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 pt-24"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 18px)" }}
      >
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-white/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(authorAvatarUrl)} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="truncate text-[15px] font-semibold">{authorName}</span>
            </div>
            {text && <p className="mt-2.5 line-clamp-3 text-[14.5px] leading-snug text-white/90">{text}</p>}
          </div>

          <div className="pointer-events-auto flex shrink-0 flex-col items-center gap-4 pb-1">
            <button type="button" onClick={onLike} aria-label="אהבתי" className="flex flex-col items-center gap-1 active:scale-90">
              <svg width="30" height="30" viewBox="0 0 24 24" fill={liked ? "#F43F5E" : "none"} stroke={liked ? "#F43F5E" : "currentColor"} strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20.6s-7.6-4.7-7.6-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 2.6c0 5.7-7.6 10.4-7.6 10.4Z" />
              </svg>
              <span className="text-[12.5px] font-semibold tabular-nums">{likeCount > 0 ? likeCount : ""}</span>
            </button>
            <button type="button" onClick={onComments} aria-label="תגובות" className="flex flex-col items-center gap-1 active:scale-90">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.8 20.4l1.4-4.4A8 8 0 1 1 20.5 12Z" />
              </svg>
              <span className="text-[12.5px] font-semibold tabular-nums">{commentCount > 0 ? commentCount : ""}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 h-[3px] w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full bg-white" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
