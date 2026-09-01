"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { FeedItemDto } from "@/services/social/feedService";
import { formatRelativeTimeHe } from "@/utils/relativeTime";

interface PostCardProps {
  item: FeedItemDto;
  onLikeToggle: (postId: string) => Promise<boolean>;
  onSaveToggle: (postId: string) => Promise<boolean>;
  onOpenComments: (postId: string) => void;
  onAddToTrip: (postId: string) => void;
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
  photo: "תמונה",
};

/** כרטיס Feed אחיד לכל סוגי ה-Content (סעיף 11). כל הפעולות החברתיות
 *  זמינות בהתאם לסוג (סעיף 12) - "פתח מקום"/"הוסף לטיול" רק כשיש place. */
export function PostCard({
  item,
  onLikeToggle,
  onSaveToggle,
  onOpenComments,
  onAddToTrip,
  onWriteReview,
  onEditPost,
  onDeletePost,
}: PostCardProps) {
  const [liked, setLiked] = useState(item.viewerState.liked);
  const [saved, setSaved] = useState(item.viewerState.saved);
  const [likeCount, setLikeCount] = useState(item.stats.likes);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text ?? "");
  const [displayText, setDisplayText] = useState(item.text);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);

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

  return (
    <article className="mb-2 bg-white px-4 py-4">
      <div className="mb-3 flex items-center gap-2.5">
        <Link href={`/places/profile/${item.author.username ?? item.author.id}`} className="shrink-0">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-bg-secondary">
            {item.author.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.author.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-ink-secondary">{item.author.fullName?.[0] ?? "?"}</span>
            )}
          </span>
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/places/profile/${item.author.username ?? item.author.id}`} className="flex items-center gap-1">
            <span className="truncate text-[13.5px] font-bold text-ink">{item.author.fullName ?? item.author.username}</span>
            {item.author.isCreator && (
              <span style={{ color: "var(--color-places-purple)" }} title="Creator">
                ✓
              </span>
            )}
          </Link>
          <span className="text-[11.5px] text-ink-secondary">
            {formatRelativeTimeHe(item.createdAt)}
            {TYPE_LABEL[item.type] ? ` · ${TYPE_LABEL[item.type]}` : ""}
          </span>
        </div>
        <button
          type="button"
          aria-label="עוד"
          onClick={() => setMenuOpen((o) => !o)}
          className="relative flex h-8 w-8 items-center justify-center text-ink-secondary"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2.6" />
            <circle cx="12" cy="12" r="2.6" />
            <circle cx="19" cy="12" r="2.6" />
          </svg>
          {menuOpen && (
            <>
              <span className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
              <span className="absolute end-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-card bg-white text-start shadow-soft ring-1 ring-black/5">
                {item.viewerState.isSelf ? (
                  <>
                    <span
                      role="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditing(true);
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-ink hover:bg-bg-secondary"
                    >
                      <Image src="/images/places-edit-icon.png" alt="" width={14} height={14} className="object-contain" />
                      ערוך
                    </span>
                    <span
                      role="button"
                      onClick={() => {
                        setMenuOpen(false);
                        handleDelete();
                      }}
                      className="flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-red-500 hover:bg-bg-secondary"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M4 7h16M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      מחק
                    </span>
                  </>
                ) : (
                  <span className="block w-full px-3.5 py-2.5 text-[13px] font-semibold text-ink-secondary">
                    אין פעולות זמינות
                  </span>
                )}
              </span>
            </>
          )}
        </button>
      </div>

      {editing ? (
        <div className="mb-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-card border border-ink-secondary/15 p-3 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--color-places-purple)]/40"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveEdit}
              className="rounded-pill px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-50"
              style={{ background: "var(--color-places-purple)" }}
            >
              שמור
            </button>
            <button
              type="button"
              onClick={() => {
                setEditText(displayText ?? "");
                setEditing(false);
              }}
              className="rounded-pill bg-bg-secondary px-4 py-1.5 text-[12.5px] font-bold text-ink-secondary"
            >
              ביטול
            </button>
          </div>
        </div>
      ) : (
        displayText && <p className="mb-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{displayText}</p>
      )}

      {item.media.length > 0 && (
        <div className={`mb-3 grid gap-1 overflow-hidden rounded-card ${item.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {item.media.slice(0, 4).map((media) => (
            <div key={media.id} className="relative aspect-square bg-bg-secondary">
              {media.type === "video" ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={media.thumbnailUrl ?? media.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">▶</span>
                  </span>
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      {(item.place || item.destination) && (
        <Link
          href={item.place ? `/place/${item.place.id}` : `/destination/${item.destination?.id}`}
          className="mb-3 flex items-center gap-2 rounded-card bg-bg-secondary px-3 py-2"
        >
          <span style={{ color: "var(--color-places-purple)" }}>📍</span>
          <span className="truncate text-[13px] font-semibold text-ink">{item.place?.name ?? item.destination?.name}</span>
        </Link>
      )}

      {item.place && (
        <button
          type="button"
          onClick={() => onWriteReview(item.place!.id, item.place!.name)}
          className="mb-3 -mt-1 text-[12px] font-bold"
          style={{ color: "var(--color-places-purple)" }}
        >
          ⭐ כתוב ביקורת על {item.place.name}
        </button>
      )}

      <div className="mb-2 flex items-center gap-1 text-[12px] text-ink-secondary">
        {likeCount > 0 && <span>{likeCount} לייקים</span>}
        {item.stats.comments > 0 && (
          <button type="button" onClick={() => onOpenComments(item.id)} className="hover:underline">
            · {item.stats.comments} תגובות
          </button>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-ink-secondary/10 pt-2">
        <button
          type="button"
          onClick={async () => {
            const newLiked = await onLikeToggle(item.id);
            setLiked(newLiked);
            setLikeCount((c) => c + (newLiked ? 1 : -1));
          }}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold"
          style={{ color: liked ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}
        >
          <Image
            src={liked ? "/images/places-like-filled.png" : "/images/places-like-outline.png"}
            alt=""
            width={18}
            height={16}
            className="object-contain"
          />
          לייק
        </button>
        <button
          type="button"
          onClick={() => onOpenComments(item.id)}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold text-ink-secondary"
        >
          <Image src="/images/places-comment-icon.png" alt="" width={17} height={16} className="object-contain" />
          תגובה
        </button>
        {item.place && (
          <button
            type="button"
            onClick={() => onAddToTrip(item.id)}
            className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold text-ink-secondary"
          >
            ➕ הוסף לטיול
          </button>
        )}
        <button
          type="button"
          onClick={async () => setSaved(await onSaveToggle(item.id))}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold"
          style={{ color: saved ? "var(--color-places-purple)" : "var(--color-ink-secondary, #8a94a6)" }}
        >
          <Image
            src={saved ? "/images/places-save-filled.png" : "/images/places-save-outline.png"}
            alt=""
            width={15}
            height={18}
            className="object-contain"
          />
          שמור
        </button>
      </div>
    </article>
  );
}
