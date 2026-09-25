"use client";

import { useState, type ReactNode } from "react";

const LIKE_COLOR = "#F43F5E";
const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.6s-7.6-4.7-7.6-10.4A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.6 2.6c0 5.7-7.6 10.4-7.6 10.4Z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON}>
      <path d="M20.5 12a8 8 0 0 1-11.7 7.1L3.8 20.4l1.4-4.4A8 8 0 1 1 20.5 12Z" />
    </svg>
  );
}
function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON} fill={filled ? "currentColor" : "none"}>
      <path d="M6.5 4h11a1 1 0 0 1 1 1v15.2l-6.5-4.3-6.5 4.3V5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...ICON}>
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function ActionButton({
  label,
  count,
  color,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  color?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-mx-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-colors hover:bg-black/[0.04] active:scale-95"
      style={{ color: color ?? "var(--color-ink-secondary, #8a94a6)" }}
    >
      {children}
      {count != null && count > 0 && <span className="min-w-[1ch] text-[13px] font-medium tabular-nums">{count}</span>}
    </button>
  );
}

async function postToggle<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error("request failed");
  return res.json();
}

/** נתיב עמוד האוסף - נקודה אחת לכל הקישורים/שיתופים. */
export function collectionPath(id: string): string {
  return `/places/collection/${id}`;
}

/** הפעולות החברתיות של תוכן שאינו Post: אוסף או טיול. */
export interface SocialActionItem {
  id: string;
  title: string;
  stats: { likes: number; comments: number };
  viewerState: { liked: boolean; saved: boolean };
}

async function shareItem(item: Pick<SocialActionItem, "title">, sharePath: string, shareText: string): Promise<"shared" | "copied" | "failed"> {
  const url = `${window.location.origin}${sharePath}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: item.title, text: shareText, url });
      return "shared";
    } catch {
      return "failed"; // המשתמש סגר את חלון השיתוף
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

interface CollectionActionBarProps {
  item: SocialActionItem;
  commentsActive: boolean;
  onToggleComments: () => void;
  /** ברירת מחדל: אוסף. טיול מעביר basePath="/api/social/trips/{id}" (+ sharePath/shareText משלו). */
  basePath?: string;
  sharePath?: string;
  shareText?: string;
}

/** Like / Comment / Save / Share של אוסף או טיול (אותו רכיב, אותן טבלאות: post_likes / social_saves / comments).
 *  Like ו-Save אופטימיים (חוזרים אחורה אם השרת נכשל), בדיוק כמו ב-PostCard.
 *  Save לא הופך את התוכן לשלך ולא משכפל אותו - רק שומר אותו. */
export function CollectionActionBar({ item, commentsActive, onToggleComments, basePath, sharePath, shareText }: CollectionActionBarProps) {
  const base = basePath ?? `/api/social/collections/${item.id}`;
  const [liked, setLiked] = useState(item.viewerState.liked);
  const [likeCount, setLikeCount] = useState(item.stats.likes);
  const [saved, setSaved] = useState(item.viewerState.saved);
  const [toast, setToast] = useState<string | null>(null);

  async function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const { liked: confirmed } = await postToggle<{ liked: boolean }>(`${base}/like`);
      if (confirmed !== next) {
        setLiked(confirmed);
        setLikeCount((c) => Math.max(0, c + (confirmed ? 1 : -1) - (next ? 1 : -1)));
      }
    } catch {
      setLiked(!next);
      setLikeCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
  }

  async function handleSave() {
    const next = !saved;
    setSaved(next);
    try {
      const { saved: confirmed } = await postToggle<{ saved: boolean }>(`${base}/save`);
      setSaved(confirmed);
    } catch {
      setSaved(!next);
    }
  }

  async function handleShare() {
    const result = await shareItem(item, sharePath ?? collectionPath(item.id), shareText ?? `${item.title} - מפה ב-TRIPLACE`);
    if (result === "copied") {
      setToast("הקישור הועתק");
      setTimeout(() => setToast(null), 2000);
    }
  }

  return (
    <div className="relative flex items-center justify-between">
      <ActionButton label="תגובות" count={item.stats.comments} color={commentsActive ? "var(--color-places-purple)" : undefined} onClick={onToggleComments}>
        <CommentIcon />
      </ActionButton>
      <ActionButton label="אהבתי" count={likeCount} color={liked ? LIKE_COLOR : undefined} onClick={handleLike}>
        <HeartIcon filled={liked} />
      </ActionButton>
      <ActionButton label={saved ? "נשמר" : "שמירה"} color={saved ? "var(--color-places-purple)" : undefined} onClick={handleSave}>
        <BookmarkIcon filled={saved} />
      </ActionButton>
      <ActionButton label="שיתוף" onClick={handleShare}>
        <ShareIcon />
      </ActionButton>
      {toast && (
        <span className="pointer-events-none absolute -top-9 end-0 rounded-pill bg-ink px-3 py-1.5 text-[12px] font-semibold text-white">{toast}</span>
      )}
    </div>
  );
}
