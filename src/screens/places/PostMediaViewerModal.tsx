"use client";

import { useEffect, useRef, useState } from "react";
import { optimizeImage } from "@/utils/imageUrl";
import { useAuth } from "@/hooks/useAuth";
import { formatRelativeTimeHe } from "@/utils/relativeTime";
import { getAvatarUrl } from "@/constants/avatar";

interface CommentRow {
  id: string;
  text: string;
  created_at: string;
  parent_comment_id: string | null;
  author: { id: string; username: string | null; full_name: string | null; avatar_url: string | null };
}

interface PostMediaItem {
  id: string;
  url: string;
  type: string;
  thumbnailUrl?: string | null;
}

interface PostMediaViewerModalProps {
  postId: string;
  media: PostMediaItem[];
  initialIndex: number;
  onClose: () => void;
  /** *** תוספת (בקשה מפורשת - "לא צריך 1/3 למעלה - צריך תמונת פרופיל,
   *  שם וזמן"): פרטי המחבר של הפוסט (לא של התמונה הספציפית - זה תמיד
   *  אותו אדם, בלי קשר לאיזו תמונה מוצגת כרגע), מוצגים בפס העליון
   *  במקום מונה האינדקס. */
  authorName: string;
  authorAvatarUrl?: string | null;
  createdAt: string;
  /** *** תוספת (בקשה מפורשת - אפשרות מחיקה אחרי הוספת מקום/פוסט, גם
   *  מעמוד הפרופיל): כשמועבר - מציג כפתור מחיקה ליד הסגירה. אופציונלי
   *  ותואם-לאחור - קריאות קיימות (כמו מ-PostCard, ששם המחיקה כבר
   *  קיימת בתפריט "⋮" נפרד) פשוט לא מעבירות את זה. */
  onDelete?: () => Promise<void>;
}

/**
 * חלון-צפייה בתמונה + תגובות (per-image, ר' migration 0082).
 * *** עיצוב-מחדש (בקשה מפורשת):
 *  - הפס העליון מציג את המחבר (תמונה+שם+זמן), לא "1/3".
 *  - התמונה עצמה ממלאת את כל השטח שהוקצה לה (object-cover) - בלי
 *    פסים שחורים בצדדים; המשמעות: קצוות התמונה עשויים להיחתך קלות
 *    כדי למלא את המסגרת, זו הפשרה הרגילה של object-cover.
 *  - כל תגובה של המשתמש המחובר עצמו ניתנת למחיקה (סעיף חדש).
 */
export function PostMediaViewerModal({
  postId,
  media,
  initialIndex,
  onClose,
  authorName,
  authorAvatarUrl,
  createdAt,
  onDelete,
}: PostMediaViewerModalProps) {
  const { user } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [deleting, setDeleting] = useState(false);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const current = media[index];

  function load(mediaId: string) {
    setComments(null);
    fetch(`/api/social/posts/${postId}/comments?mediaId=${encodeURIComponent(mediaId)}`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }

  useEffect(() => {
    if (current) load(current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index > 0) setIndex((i) => i - 1);
      if (e.key === "ArrowLeft" && index < media.length - 1) setIndex((i) => i + 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, index, media.length]);

  async function handleSend() {
    if (!text.trim() || !current) return;
    setSending(true);
    try {
      await fetch(`/api/social/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), mediaId: current.id }),
      });
      setText("");
      load(current.id);
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    setComments((prev) => prev?.filter((c) => c.id !== commentId) ?? prev);
    try {
      await fetch(`/api/social/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
    } catch {
      if (current) load(current.id);
    }
  }

  // swipe אמיתי - ב-RTL: אצבע נגררת ימינה = התמונה הקודמת, שמאלה = הבאה.
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    const SWIPE_THRESHOLD = 50;
    if (delta > SWIPE_THRESHOLD && index > 0) setIndex((i) => i - 1);
    else if (delta < -SWIPE_THRESHOLD && index < media.length - 1) setIndex((i) => i + 1);
    touchStartX.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-ink-secondary/10 px-3 py-2.5">
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(authorAvatarUrl)} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-ink">{authorName}</p>
            <p className="text-[10.5px] text-ink-secondary">{formatRelativeTimeHe(createdAt)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          {onDelete && (
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!window.confirm("למחוק את הפוסט הזה?")) return;
                setDeleting(true);
                try {
                  await onDelete();
                } finally {
                  setDeleting(false);
                }
              }}
              aria-label="מחיקה"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-red-500 disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
              </svg>
            </button>
          )}
        </div>

        {/* *** תיקון (בקשה מפורשת - "לא צריך קצוות שחורים, שהתמונה
            תמלא את כל השטח"): object-cover ממלא את כל המסגרת (בלי
            bg-black שהיה נחשף לפניה) - קצוות התמונה עצמה עלולים
            להיחתך קלות, זו הפשרה הרגילה של מילוי-שטח (cover) לעומת
            הכלה-מלאה (contain). */}
        {current && (
          <div
            className="relative shrink-0 overflow-hidden"
            style={{ height: "50vh" }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {current.type === "video" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={current.url} controls className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={optimizeImage(current.url, 720, { quality: 80 })} alt="" decoding="async" className="h-full w-full object-cover" draggable={false} />
            )}
            {media.length > 1 && (
              <span className="absolute end-2 top-2 rounded-pill bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white">
                {index + 1}/{media.length}
              </span>
            )}
            {media.length > 1 && index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i - 1)}
                aria-label="התמונה הקודמת"
                className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
              >
                ›
              </button>
            )}
            {media.length > 1 && index < media.length - 1 && (
              <button
                type="button"
                onClick={() => setIndex((i) => i + 1)}
                aria-label="התמונה הבאה"
                className="absolute start-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
              >
                ‹
              </button>
            )}
          </div>
        )}

        {/* תגובות - של התמונה הנוכחית בלבד. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {comments === null && (
            <div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="mb-3 h-10 w-full animate-pulse rounded-card bg-bg-secondary" />
              ))}
            </div>
          )}
          {comments?.length === 0 && (
            <p className="py-6 text-center text-[13px] text-ink-secondary">אין עדיין תגובות על התמונה הזו - היה הראשון להגיב</p>
          )}
          {comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2.5 py-2.5">
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(comment.author.avatar_url)} alt="" className="h-full w-full object-cover" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] text-ink">
                  <span className="font-bold">{comment.author.full_name ?? comment.author.username}</span> {comment.text}
                </p>
                <span className="text-[11px] text-ink-secondary">{formatRelativeTimeHe(comment.created_at)}</span>
              </div>
              {/* *** תוספת (בקשה מפורשת - "למה אי אפשר למחוק תגובה?") -
                  רק על תגובות של המשתמש המחובר עצמו. */}
              {user?.id === comment.author.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteComment(comment.id)}
                  aria-label="מחיקת תגובה"
                  className="shrink-0 self-start p-1 text-ink-secondary/60"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {user && (
          <div className="flex shrink-0 items-center gap-2 border-t border-ink-secondary/10 px-4 py-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="הוסף תגובה על התמונה הזו..."
              className="flex-1 rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[13.5px] focus:outline-none"
            />
            <button
              type="button"
              disabled={sending || !text.trim()}
              onClick={handleSend}
              className="rounded-pill px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-50"
              style={{ background: "var(--color-places-purple)" }}
            >
              שלח
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
