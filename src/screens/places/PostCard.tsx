"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { FeedItemDto } from "@/services/social/feedService";
import { formatRelativeTimeHe } from "@/utils/relativeTime";
import { getAvatarUrl } from "@/constants/avatar";
import { PostMediaViewerModal } from "./PostMediaViewerModal";
import { PostInlineComments } from "./PostInlineComments";

interface PostCardProps {
  item: FeedItemDto;
  onLikeToggle: (postId: string) => Promise<boolean>;
  onSaveToggle: (postId: string) => Promise<boolean>;
  onWriteReview: (placeId: string, placeName: string) => void;
  onEditPost: (postId: string, newText: string) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
}

const TYPE_LABEL: Record<string, string> = {
  post: "",
  video: "וידאו",
  review: "ביקורת",
  trip: "טיול",
  place_recommendation: "המלצה על מקום",
  destination_recommendation: "המלצה על יעד",
  photo: "",
};

const LONG_TEXT_CHARS = 280;
const LONG_TEXT_LINES = 6;
const MAX_MEDIA_TILES = 4;
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

function ActionButton({
  label,
  count,
  color,
  onClick,
  children,
  popKey,
}: {
  label: string;
  count?: number;
  /** צבע במצב פעיל (undefined = אפור). */
  color?: string;
  onClick: () => void;
  children: ReactNode;
  popKey?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group -mx-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 transition-colors hover:bg-black/[0.04] active:scale-95"
      style={{ color: color ?? "var(--color-ink-secondary, #8a94a6)" }}
    >
      <span key={popKey} className={color && popKey ? "pc-pop" : ""}>
        {children}
      </span>
      {count != null && count > 0 && <span className="min-w-[1ch] text-[13px] font-medium tabular-nums">{count}</span>}
    </button>
  );
}

/**
 * כרטיס פוסט ב-Feed.
 *
 * *** עיצוב מחדש (בקשה מפורשת - "אצלנו זה נראה נורא מצועצע! תסתכל על איך נראה
 * פיד" + צילומי X/אינסטגרם/פייסבוק): נקי ושטוח, בלי כרטיסים צפים, צללים, טבעות,
 * גרדיאנטים וצ'יפים. שורה שטוחה ברוחב מלא עם קו הפרדה דק: אווטאר בצד, ובעמודת
 * התוכן - שם + זמן בשורה אחת, הטקסט, המדיה (פינות מעוגלות + מסגרת דקה), קישור
 * מקום עדין, ושורת פעולות אייקונים עם מספרים (תגובה, לייק, שמירה), בלי כיתובים.
 * כל הפעולות (לייק אופטימי, שמירה, עריכה, מחיקה, ביקורת, תגובות, צפייה במדיה)
 * נשארו בדיוק אותו דבר.
 */
export function PostCard({ item, onLikeToggle, onSaveToggle, onWriteReview, onEditPost, onDeletePost }: PostCardProps) {
  const [liked, setLiked] = useState(item.viewerState.liked);
  const [saved, setSaved] = useState(item.viewerState.saved);
  const [likeCount, setLikeCount] = useState(item.stats.likes);
  const [likePop, setLikePop] = useState(0);
  const [savePop, setSavePop] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text ?? "");
  const [displayText, setDisplayText] = useState(item.text);
  const [expanded, setExpanded] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [commentsExpanded, setCommentsExpanded] = useState(false);

  function openViewer(index: number) {
    setViewerIndex(index);
    setViewerOpen(true);
  }

  if (deleted) return null;

  async function handleSaveEdit() {
    setBusy(true);
    try {
      await onEditPost(item.id, editText.trim());
      setDisplayText(editText.trim());
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("למחוק את הפוסט הזה? הפעולה לא הפיכה.")) return;
    setBusy(true);
    try {
      await onDeletePost(item.id);
      setDeleted(true);
    } finally {
      setBusy(false);
    }
  }

  /** לייק אופטימי: הלב מתמלא ומספר הלייקים מתעדכן מיד; אם השרת נכשל - חוזרים אחורה. */
  async function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => Math.max(0, c + (next ? 1 : -1)));
    if (next) setLikePop((n) => n + 1);
    try {
      const confirmed = await onLikeToggle(item.id);
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
    if (next) setSavePop((n) => n + 1);
    try {
      setSaved(await onSaveToggle(item.id));
    } catch {
      setSaved(!next);
    }
  }

  const authorName = item.author.fullName ?? item.author.username ?? "מטייל";
  const profileHref = `/places/profile/${item.author.username ?? item.author.id}`;
  const typeLabel = TYPE_LABEL[item.type];
  const isLongText = (displayText?.length ?? 0) > LONG_TEXT_CHARS || (displayText?.split("\n").length ?? 0) > LONG_TEXT_LINES;
  const media = item.media;
  const extraMedia = media.length - MAX_MEDIA_TILES;

  return (
    <article className="flex gap-3 border-b border-black/[0.07] px-4 py-3.5">
      {/* אווטאר */}
      <Link href={profileHref} className="shrink-0 self-start" aria-label={authorName}>
        <span className="block h-11 w-11 overflow-hidden rounded-full bg-bg-secondary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getAvatarUrl(item.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
        </span>
      </Link>

      {/* עמודת התוכן */}
      <div className="min-w-0 flex-1">
        {/* שם + זמן (+ תפריט) */}
        <div className="flex items-center gap-1.5">
          <Link href={profileHref} className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[15px] font-bold leading-tight text-ink">{authorName}</span>
            {item.author.isCreator && (
              <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0" aria-label="יוצר תוכן">
                <circle cx="12" cy="12" r="10" fill="var(--color-places-purple)" />
                <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </Link>
          <span className="shrink-0 whitespace-nowrap text-[13.5px] text-ink-secondary">
            · {formatRelativeTimeHe(item.createdAt)}
            {typeLabel ? ` · ${typeLabel}` : ""}
          </span>

          {item.viewerState.isSelf && (
            <div className="relative ms-auto">
              <button
                type="button"
                aria-label="עוד"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                className="-me-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary transition hover:bg-black/[0.05]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <button type="button" aria-label="סגור" className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuOpen(false)} />
                  <div className="absolute end-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.16)] ring-1 ring-black/5">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditing(true);
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold text-ink transition hover:bg-black/[0.04]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" {...ICON}>
                        <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17l-1 3Z" />
                      </svg>
                      עריכה
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDelete();
                      }}
                      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[14px] font-semibold text-red-500 transition hover:bg-black/[0.04]"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" {...ICON}>
                        <path d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                      </svg>
                      מחיקה
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* טקסט / עריכה */}
        {editing ? (
          <div className="mt-1.5">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              autoFocus
              className="w-full resize-none rounded-xl border border-black/15 p-3 text-[15px] leading-relaxed text-ink outline-none focus:border-places-purple"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy || !editText.trim()}
                onClick={handleSaveEdit}
                className="rounded-full bg-places-purple px-5 py-1.5 text-[13.5px] font-bold text-white transition active:scale-95 disabled:opacity-50"
              >
                שמירה
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditText(displayText ?? "");
                  setEditing(false);
                }}
                className="rounded-full px-4 py-1.5 text-[13.5px] font-bold text-ink-secondary transition hover:bg-black/[0.04]"
              >
                ביטול
              </button>
            </div>
          </div>
        ) : (
          displayText && (
            <div className="mt-0.5">
              <p className={`whitespace-pre-wrap text-[15px] leading-[1.55] text-ink ${!expanded && isLongText ? "line-clamp-6" : ""}`}>
                {displayText}
              </p>
              {isLongText && (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-0.5 text-[14px] font-semibold text-places-purple">
                  {expanded ? "הצג פחות" : "הצג עוד"}
                </button>
              )}
            </div>
          )
        )}

        {/* מדיה */}
        {media.length > 0 && (
          <div
            className={`mt-2.5 grid gap-0.5 overflow-hidden rounded-2xl border border-black/[0.08] ${
              media.length === 1 ? "aspect-[4/3] grid-cols-1" : "aspect-[16/10] grid-cols-2"
            } ${media.length >= 3 ? "grid-rows-2" : ""}`}
          >
            {media.slice(0, MAX_MEDIA_TILES).map((m, i) => {
              const isLastTile = i === MAX_MEDIA_TILES - 1 && extraMedia > 0;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openViewer(i)}
                  aria-label={`פתח מדיה ${i + 1}`}
                  className={`relative overflow-hidden bg-bg-secondary ${media.length === 3 && i === 0 ? "row-span-2" : ""}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.type === "video" ? (m.thumbnailUrl ?? m.url) : m.url}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                  {m.type === "video" && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                        </svg>
                      </span>
                    </span>
                  )}
                  {isLastTile && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white">+{extraMedia}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* מקום / יעד - קישור עדין */}
        {(item.place || item.destination) && (
          <>
            <Link
              href={item.place ? `/place/${item.place.id}` : `/destination/${item.destination?.id}`}
              className="mt-2.5 flex items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2 transition hover:bg-black/[0.02]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" {...ICON} className="shrink-0 text-ink-secondary">
                <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{item.place?.name ?? item.destination?.name}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" {...ICON} className="shrink-0 text-ink-secondary">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </Link>
            {item.place && (
              <button
                type="button"
                onClick={() => onWriteReview(item.place!.id, item.place!.name)}
                className="mt-1.5 text-[13.5px] font-semibold text-places-purple"
              >
                כתוב ביקורת
              </button>
            )}
          </>
        )}

        {/* פעולות */}
        <div className="mt-1.5 flex items-center justify-between">
          <ActionButton label="תגובות" count={item.stats.comments} color={commentsExpanded ? "var(--color-places-purple)" : undefined} onClick={() => setCommentsExpanded((v) => !v)}>
            <CommentIcon />
          </ActionButton>
          <ActionButton label="אהבתי" count={likeCount} color={liked ? LIKE_COLOR : undefined} onClick={handleLike} popKey={likePop}>
            <HeartIcon filled={liked} />
          </ActionButton>
          <ActionButton label={saved ? "נשמר" : "שמירה"} color={saved ? "var(--color-places-purple)" : undefined} onClick={handleSave} popKey={savePop}>
            <BookmarkIcon filled={saved} />
          </ActionButton>
        </div>

        {commentsExpanded && <PostInlineComments postId={item.id} />}
      </div>

      {viewerOpen && (
        <PostMediaViewerModal
          postId={item.id}
          media={item.media}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          authorName={authorName}
          authorAvatarUrl={item.author.avatarUrl}
          createdAt={item.createdAt}
        />
      )}
    </article>
  );
}
