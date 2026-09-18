"use client";

import { useState } from "react";
import type { FeedItemDto } from "@/services/social/feedService";
import { formatRelativeTimeHe } from "@/utils/relativeTime";
import { getAvatarUrl } from "@/constants/avatar";

interface PostImageModalProps {
  item: FeedItemDto;
  startIndex: number;
  onClose: () => void;
}

/**
 * *** חלון קופץ (Modal) לצפייה בתמונות פוסט - בקשה מפורשת: "אני רוצה
 * שזה יהיה חלון נפתח כמו בהוספת אטרקציה", לא מסך-מלא. אותו מארז
 * בדיוק כמו AddPlaceModal.tsx (overlay עדין+blur, כרטיס ממורכז,
 * rounded-[22px], safe-area מלמעלה ומלמטה) - לא נבנה דפוס Modal חדש.
 *
 * למעלה: קרוסלת תמונות עם מונה "X/Y" וכפתור סגירה, בתוך תיבה כהה
 * (לא מסך שחור מלא). מתחת (באזור לבן): מחבר הפוסט + הכיתוב שלו +
 * זמן, ושדה תגובה אמיתי (שולח בפועל ל-API הקיים של תגובות על פוסט -
 * אותו endpoint כמו post/[id]/page.tsx, לא כפתור-שקר).
 */
export function PostImageModal({ item, startIndex, onClose }: PostImageModalProps) {
  const [index, setIndex] = useState(startIndex);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const media = item.media[index];
  const hasMultiple = item.media.length > 1;

  function goPrev() {
    setIndex((i) => (i - 1 + item.media.length) % item.media.length);
  }
  function goNext() {
    setIndex((i) => (i + 1) % item.media.length);
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`/api/social/posts/${item.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
      setSent(true);
      setTimeout(() => setSent(false), 1500);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 24px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-full w-full max-w-sm flex-col overflow-hidden bg-white shadow-soft" style={{ borderRadius: 22 }}>
        {/* אזור התמונה - תיבה כהה בתוך הכרטיס, לא מסך שחור מלא */}
        <div className="relative aspect-square w-full shrink-0 bg-black">
          {media?.type === "video" ? (
            <video src={media.url} className="h-full w-full object-contain" controls playsInline />
          ) : (
            media && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.url} alt="" className="h-full w-full object-contain" />
            )
          )}

          {hasMultiple && (
            <span className="absolute top-3 left-1/2 -translate-x-1/2 rounded-pill bg-black/50 px-2.5 py-1 text-[11.5px] font-semibold text-white">
              {index + 1}/{item.media.length}
            </span>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          {hasMultiple && (
            <>
              <button type="button" aria-label="הקודם" onClick={goPrev} className="absolute inset-y-0 start-0 w-1/4" />
              <button type="button" aria-label="הבא" onClick={goNext} className="absolute inset-y-0 end-0 w-1/4" />
            </>
          )}
        </div>

        {/* אזור לבן - מחבר, כיתוב, זמן, ותגובה אמיתית */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="flex items-start gap-2.5">
            <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(item.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] leading-snug text-ink">
                <span className="font-bold">{item.author.fullName ?? item.author.username}</span>
                {item.text ? <> {item.text}</> : null}
              </p>
              <span className="text-[11px] text-ink-secondary">{formatRelativeTimeHe(item.createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-ink-secondary/10 px-4 py-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={sent ? "נשלח!" : "הוסף תגובה..."}
            className="flex-1 rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[13.5px] focus:outline-none"
          />
          <button
            type="button"
            disabled={sending || !text.trim()}
            onClick={handleSend}
            className="rounded-pill px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
            style={{ background: "var(--color-places-purple)" }}
          >
            {sending ? "שולח..." : "שלח"}
          </button>
        </div>
      </div>
    </div>
  );
}
