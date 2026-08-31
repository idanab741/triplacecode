"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { FeedItemDto } from "@/services/social/feedService";
import { formatRelativeTimeHe } from "@/utils/relativeTime";

interface PostCardProps {
  item: FeedItemDto;
  onLikeToggle: (postId: string) => Promise<boolean>;
  onSaveToggle: (postId: string) => Promise<boolean>;
  onOpenComments: (postId: string) => void;
  onAddToTrip: (postId: string) => void;
  onWriteReview: (placeId: string, placeName: string) => void;
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
export function PostCard({ item, onLikeToggle, onSaveToggle, onOpenComments, onAddToTrip, onWriteReview }: PostCardProps) {
  const [liked, setLiked] = useState(item.viewerState.liked);
  const [saved, setSaved] = useState(item.viewerState.saved);
  const [likeCount, setLikeCount] = useState(item.stats.likes);

  return (
    <article className="mb-2 bg-white px-4 py-4">
      <div className="mb-3 flex items-center gap-2.5">
        <Link href={`/places/profile/${item.author.username ?? item.author.id}`} className="shrink-0">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-bg-secondary">
            {item.author.avatarUrl ? (
              <Image src={item.author.avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" />
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
        <button type="button" aria-label="עוד" className="text-ink-secondary">
          ⋯
        </button>
      </div>

      {item.text && <p className="mb-3 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{item.text}</p>}

      {item.media.length > 0 && (
        <div className={`mb-3 grid gap-1 overflow-hidden rounded-card ${item.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {item.media.slice(0, 4).map((media) => (
            <div key={media.id} className="relative aspect-square bg-bg-secondary">
              {media.type === "video" ? (
                <>
                  <Image
                    src={media.thumbnailUrl ?? media.url}
                    alt=""
                    fill
                    className="object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white">▶</span>
                  </span>
                </>
              ) : (
                <Image src={media.url} alt="" fill className="object-cover" />
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
          <span>{liked ? "❤️" : "🤍"}</span>
          לייק
        </button>
        <button
          type="button"
          onClick={() => onOpenComments(item.id)}
          className="flex flex-1 items-center justify-center gap-1.5 py-1.5 text-[13px] font-semibold text-ink-secondary"
        >
          💬 תגובה
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
          {saved ? "🔖" : "🏷️"} שמור
        </button>
      </div>
    </article>
  );
}
