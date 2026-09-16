"use client";

import { useEffect, useState } from "react";
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
  /** ריק = פוסט טקסט בלבד (אין תמונות) - המודל מוצג בלי אזור תמונה,
   *  רק ההערות, עדיין באותו חלון בלי ניווט לעמוד נפרד. */
  media: PostMediaItem[];
  initialIndex: number;
  onClose: () => void;
}

/**
 * *** תוספת (בקשה מפורשת - "כשלוחצים על התמונה שתיפתח במסך מלא, ואני
 * לא רוצה שהתגובות ייפתחו בעמוד נפרד - אלא בחלון המלא של התמונה"):
 * מחליף לגמרי את הניווט הישן ל-/places/post/[id] (עמוד נפרד) - הכל
 * (תמונה במסך מלא + רשימת תגובות + כתיבת תגובה) קורה כאן, בתוך מודל
 * אחד שנפתח מעל ה-Feed, בלי לעזוב את העמוד. לוגיקת שליפת/שליחת
 * התגובות עצמה זהה בדיוק למה שהיה בעמוד הישן (אותו endpoint) - רק
 * המיקום השתנה.
 */
export function PostMediaViewerModal({ postId, media, initialIndex, onClose }: PostMediaViewerModalProps) {
  const { user } = useAuth();
  const [index, setIndex] = useState(initialIndex);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  function load() {
    fetch(`/api/social/posts/${postId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }

  useEffect(load, [postId]);

  // נועל גלילה של הרקע כל עוד המודל פתוח, ותומך בסגירה עם Escape -
  // אותה התנהגות סטנדרטית של כל מודל fullscreen אחר באפליקציה.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/social/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      setText("");
      load();
    } finally {
      setSending(false);
    }
  }

  const current = media[index];

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between px-4 py-3">
        <button type="button" onClick={onClose} aria-label="סגירה" className="flex h-9 w-9 items-center justify-center text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        {media.length > 1 && (
          <span className="text-xs font-semibold text-white/80">
            {index + 1}/{media.length}
          </span>
        )}
        <span className="w-9" aria-hidden />
      </div>

      {current && (
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {current.type === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={current.url} controls autoPlay className="max-h-full max-w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.url} alt="" className="max-h-full max-w-full object-contain" />
          )}
          {media.length > 1 && index > 0 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i - 1)}
              aria-label="התמונה הקודמת"
              className="absolute end-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
            >
              ›
            </button>
          )}
          {media.length > 1 && index < media.length - 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              aria-label="התמונה הבאה"
              className="absolute start-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white"
            >
              ‹
            </button>
          )}
        </div>
      )}

      {/* גיליון התגובות - תמיד בתוך אותו חלון, לא ניווט לשום מקום.
          כשאין תמונה בכלל (פוסט טקסט) התמונה למעלה פשוט לא מוצגת
          (current==null) והגיליון הזה תופס את כל הגובה הפנוי. */}
      <div
        className={`flex shrink-0 flex-col rounded-t-3xl bg-white ${current ? "max-h-[45vh]" : "min-h-0 flex-1"}`}
      >
        <div className="flex-1 overflow-y-auto">
          {comments === null && (
            <div className="p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="mb-3 h-10 w-full animate-pulse rounded-card bg-bg-secondary" />
              ))}
            </div>
          )}
          {comments?.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-ink-secondary">אין עדיין תגובות - היה הראשון להגיב</p>
          )}
          {comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2.5 px-4 py-3">
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
            </div>
          ))}
        </div>

        {user && (
          <div className="flex shrink-0 items-center gap-2 border-t border-ink-secondary/10 px-4 py-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="הוסף תגובה..."
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
