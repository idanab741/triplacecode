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

interface PostInlineCommentsProps {
  postId: string;
  /** ברירת מחדל: /api/social/posts/{postId}. אוספים (Collections) משתמשים באותו רכיב בדיוק
   *  עם basePath="/api/social/collections/{id}" - אותה טבלת comments, אותו UI. */
  basePath?: string;
}

/**
 * *** תוספת (בקשה מפורשת - "התגובות של הפוסט ייפתחו מתחת לשורה - ולא
 * בעמוד אחר"): נפתח inline, בתוך כרטיס הפוסט עצמו בפיד, כשלוחצים על
 * כפתור "תגובה" / מספר התגובות - **לא** אותו דבר כמו קליק על תמונה
 * (ר' PostMediaViewerModal.tsx, שנפתח כחלון נפרד ומציג תגובות על
 * תמונה ספציפית). כאן - בלי `mediaId` - מביא תמיד רק את התגובות
 * הכלליות על הפוסט (media_id IS NULL בשרת, ר' postService.ts).
 */
export function PostInlineComments({ postId, basePath }: PostInlineCommentsProps) {
  const { user } = useAuth();
  const base = basePath ?? `/api/social/posts/${postId}`;
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  function load() {
    fetch(`${base}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }

  useEffect(load, [postId]);

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`${base}/comments`, {
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

  // *** תוספת (בקשה מפורשת - "למה אי אפשר למחוק תגובה?") - מחיקה
  // אופטימית מהתצוגה, עם נפילה-חזרה לרענון אם הבקשה נכשלת בפועל.
  async function handleDelete(commentId: string) {
    setComments((prev) => prev?.filter((c) => c.id !== commentId) ?? prev);
    try {
      await fetch(`${base}/comments/${commentId}`, { method: "DELETE" });
    } catch {
      load();
    }
  }

  return (
    <div className="mt-2 border-t border-ink-secondary/10 pt-2">
      {comments === null && (
        <div className="py-2">
          {[1, 2].map((i) => (
            <div key={i} className="mb-2 h-9 w-full animate-pulse rounded-card bg-bg-secondary" />
          ))}
        </div>
      )}
      {comments?.length === 0 && (
        <p className="py-3 text-center text-[12.5px] text-ink-secondary">אין עדיין תגובות - היה הראשון להגיב</p>
      )}
      {comments?.map((comment) => (
        <div key={comment.id} className="flex gap-2 py-2">
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(comment.author.avatar_url)} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink">
              <span className="font-bold">{comment.author.full_name ?? comment.author.username}</span> {comment.text}
            </p>
            <span className="text-[10.5px] text-ink-secondary">{formatRelativeTimeHe(comment.created_at)}</span>
          </div>
          {user?.id === comment.author.id && (
            <button
              type="button"
              onClick={() => handleDelete(comment.id)}
              aria-label="מחיקת תגובה"
              className="shrink-0 self-start p-1 text-ink-secondary/60"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
              </svg>
            </button>
          )}
        </div>
      ))}

      {user && (
        <div className="mt-1 flex items-center gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="הוסף תגובה..."
            className="flex-1 rounded-pill border border-ink-secondary/20 px-3.5 py-2 text-[13px] focus:outline-none"
          />
          <button
            type="button"
            disabled={sending || !text.trim()}
            onClick={handleSend}
            className="rounded-pill px-3.5 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
            style={{ background: "var(--color-places-purple)" }}
          >
            שלח
          </button>
        </div>
      )}
    </div>
  );
}
