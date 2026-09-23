"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  /** תגובה שמגיבים עליה כרגע (תגובה לתגובה). */
  const [replyTo, setReplyTo] = useState<CommentRow | null>(null);
  /** תגובות-ראשיות שהתגובות שלהן פתוחות. */
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  /** לייקים על תגובות (כולל תגובות-משנה): commentId -> { count, liked }. */
  const [likes, setLikes] = useState<Record<string, { count: number; liked: boolean }>>({});

  /** תגובות ראשיות (בסדר שהשרת החזיר) + תגובות-משנה לפי ההורה, מהישנה לחדשה.
   *  תגובה שההורה שלה לא נטען (נמחק/מחוץ לעמוד) מוצגת כראשית. */
  const { roots, repliesByParent } = useMemo(() => {
    const list = comments ?? [];
    const ids = new Set(list.map((c) => c.id));
    const byParent = new Map<string, CommentRow[]>();
    const rootList: CommentRow[] = [];
    for (const c of list) {
      if (c.parent_comment_id && ids.has(c.parent_comment_id)) {
        const arr = byParent.get(c.parent_comment_id) ?? [];
        arr.push(c);
        byParent.set(c.parent_comment_id, arr);
      } else {
        rootList.push(c);
      }
    }
    for (const arr of byParent.values()) arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { roots: rootList, repliesByParent: byParent };
  }, [comments]);

  function authorName(c: CommentRow) {
    return c.author.full_name ?? c.author.username ?? "מטייל";
  }

  /** מתחילים תגובה לתגובה. כשמגיבים על תגובת-משנה - היא נקשרת לתגובה הראשית (שרשור ברמה אחת)
   *  ומתווסף @שם, כדי שיהיה ברור למי מגיבים. */
  function startReply(c: CommentRow) {
    setReplyTo(c);
    setText(c.parent_comment_id ? `@${authorName(c)} ` : "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function cancelReply() {
    setReplyTo(null);
    setText("");
  }

  function toggleThread(rootId: string) {
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (next.has(rootId)) next.delete(rootId);
      else next.add(rootId);
      return next;
    });
  }

  function load() {
    fetch(`${base}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(data.comments ?? []))
      .catch(() => setComments([]));
  }

  useEffect(load, [postId]);

  // מצב הלייקים של התגובות שנטענו - בקשה אחת לכולן. כשל (למשל המיגרציה עוד לא רצה) פשוט משאיר בלי מספרים.
  useEffect(() => {
    if (!user || !comments || comments.length === 0) return;
    let cancelled = false;
    fetch(`/api/social/comments/likes?ids=${comments.map((c) => c.id).join(",")}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { counts: Record<string, number>; liked: string[] }) => {
        if (cancelled) return;
        const liked = new Set(data.liked);
        const next: Record<string, { count: number; liked: boolean }> = {};
        for (const c of comments) next[c.id] = { count: data.counts[c.id] ?? 0, liked: liked.has(c.id) };
        setLikes(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [comments, user]);

  /** לייק אופטימי על תגובה; אם השרת נכשל - חוזרים אחורה. */
  async function handleLikeComment(commentId: string) {
    const prev = likes[commentId] ?? { count: 0, liked: false };
    const optimistic = { liked: !prev.liked, count: Math.max(0, prev.count + (prev.liked ? -1 : 1)) };
    setLikes((all) => ({ ...all, [commentId]: optimistic }));
    try {
      const res = await fetch(`/api/social/comments/${commentId}/like`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { liked } = (await res.json()) as { liked: boolean };
      if (liked !== optimistic.liked) {
        setLikes((all) => ({ ...all, [commentId]: { liked, count: Math.max(0, prev.count + (liked ? 1 : 0) - (prev.liked ? 1 : 0)) } }));
      }
    } catch {
      setLikes((all) => ({ ...all, [commentId]: prev }));
    }
  }

  async function handleSend() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const rootId = replyTo ? (replyTo.parent_comment_id ?? replyTo.id) : null;
      const res = await fetch(`${base}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), ...(rootId ? { parentCommentId: rootId } : {}) }),
      });
      if (!res.ok) return;
      if (rootId) setOpenThreads((prev) => new Set(prev).add(rootId));
      setText("");
      setReplyTo(null);
      load();
    } finally {
      setSending(false);
    }
  }

  // *** תוספת (בקשה מפורשת - "למה אי אפשר למחוק תגובה?") - מחיקה
  // אופטימית מהתצוגה, עם נפילה-חזרה לרענון אם הבקשה נכשלת בפועל.
  async function handleDelete(commentId: string) {
    setComments((prev) => prev?.filter((c) => c.id !== commentId && c.parent_comment_id !== commentId) ?? prev);
    try {
      await fetch(`${base}/comments/${commentId}`, { method: "DELETE" });
    } catch {
      load();
    }
  }

  function renderComment(comment: CommentRow, isReply: boolean) {
    return (
      <div key={comment.id} className="flex gap-2 py-2">
        <span className={`${isReply ? "h-6 w-6" : "h-8 w-8"} shrink-0 overflow-hidden rounded-full bg-bg-secondary`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getAvatarUrl(comment.author.avatar_url)} alt="" className="h-full w-full object-cover" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink">
            <span className="font-bold">{authorName(comment)}</span> {comment.text}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[10.5px] text-ink-secondary">{formatRelativeTimeHe(comment.created_at)}</span>
            {user && (
              <button type="button" onClick={() => startReply(comment)} className="text-[11px] font-bold text-ink-secondary">
                השב
              </button>
            )}
            {user && (
              <button
                type="button"
                onClick={() => handleLikeComment(comment.id)}
                aria-label={likes[comment.id]?.liked ? "ביטול לייק לתגובה" : "לייק לתגובה"}
                className="flex items-center gap-1 text-[11px] font-bold"
                style={{ color: likes[comment.id]?.liked ? "#F43F5E" : "var(--color-ink-secondary, #8a94a6)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={likes[comment.id]?.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20.6s-7.6-4.7-7.6-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 2.6c0 5.7-7.6 10.4-7.6 10.4Z" />
                </svg>
                {(likes[comment.id]?.count ?? 0) > 0 && <span className="tabular-nums">{likes[comment.id].count}</span>}
              </button>
            )}
          </div>
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
    );
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
      {roots.map((comment) => {
        const replies = repliesByParent.get(comment.id) ?? [];
        const open = openThreads.has(comment.id);
        return (
          <div key={comment.id}>
            {renderComment(comment, false)}
            {replies.length > 0 && (
              <button
                type="button"
                onClick={() => toggleThread(comment.id)}
                className="mb-1 ms-10 flex items-center gap-2 text-[11.5px] font-semibold text-ink-secondary"
              >
                <span className="h-px w-5 bg-ink-secondary/30" />
                {open ? "הסתר תגובות" : replies.length === 1 ? "הצג תגובה אחת" : `הצג ${replies.length} תגובות`}
              </button>
            )}
            {open && (
              <div className="ms-10 border-s border-ink-secondary/10 ps-2">{replies.map((reply) => renderComment(reply, true))}</div>
            )}
          </div>
        );
      })}

      {user && replyTo && (
        <div className="mt-1 flex items-center justify-between rounded-lg bg-bg-secondary px-3 py-1.5 text-[12px] text-ink-secondary">
          <span className="truncate">
            משיב/ה ל-<span className="font-bold text-ink">{authorName(replyTo)}</span>
          </span>
          <button type="button" onClick={cancelReply} aria-label="ביטול תגובה" className="shrink-0 px-1 text-[15px] leading-none">
            ×
          </button>
        </div>
      )}

      {user && (
        <div className="mt-1 flex items-center gap-2">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={replyTo ? "כתבו תשובה..." : "הוסף תגובה..."}
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
