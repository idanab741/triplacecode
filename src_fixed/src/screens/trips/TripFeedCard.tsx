"use client";

import { useState } from "react";
import Link from "next/link";
import { formatTripMeta, getTripTypeLabel, type TripCardDto } from "@/services/social/tripTypes";
import { formatRelativeTimeHe } from "@/utils/relativeTime";
import { getAvatarUrl } from "@/constants/avatar";
import { PostInlineComments } from "@/screens/places/PostInlineComments";
import { CollectionCover } from "@/screens/collections/CollectionCover";
import { CollectionActionBar } from "@/screens/collections/CollectionActionBar";
import { placeCategoryEmoji } from "./tripUi";

export function tripPath(id: string): string {
  return `/places/trip/${id}`;
}

/**
 * Trip Card ב-Places Feed. Cover גדול + כותרת + "5 תחנות · יום אחד" + Preview קטן של 2-3 התחנות הראשונות
 * (☕ → 🌳 → 🍴 → +2) - כדי שיהיה ברור שזה *מסלול שאפשר לפתוח*, לא פוסט ולא רשימה. לא מציגים את כל התחנות.
 * תג "✈️ טיול" מבדיל אותו מ-Collection (תג "אוסף") ומפוסט.
 */
export function TripFeedCard({ item }: { item: TripCardDto }) {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const href = tripPath(item.id);
  const authorName = item.author.fullName ?? item.author.username ?? "מטייל";
  const profileHref = `/places/profile/${item.author.username ?? item.author.id}`;
  const hiddenStops = Math.max(0, item.stopCount - item.previewStops.length);

  return (
    <article className="border-b border-black/[0.07] px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <Link href={profileHref} className="shrink-0" aria-label={authorName}>
          <span className="block h-9 w-9 overflow-hidden rounded-full bg-bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(item.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
          </span>
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Link href={profileHref} className="truncate text-[14.5px] font-bold leading-tight text-ink">
            {authorName}
          </Link>
          <span className="shrink-0 whitespace-nowrap text-[13px] text-ink-secondary">· {formatRelativeTimeHe(item.createdAt)}</span>
        </div>
        {item.visibility !== "public" && (
          <span className="shrink-0 rounded-pill bg-bg-secondary px-2 py-0.5 text-[11px] font-semibold text-ink-secondary">
            {item.visibility === "private" ? "פרטי" : "חברים"}
          </span>
        )}
      </div>

      <Link href={href} className="mt-2.5 block overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[var(--shadow-places-soft)]">
        <div className="relative">
          <CollectionCover coverUrl={item.coverUrl ?? item.autoCoverUrl} collageUrls={[]} type="trips" className="aspect-[16/11]" />
          <span
            className="absolute start-2.5 top-2.5 flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11.5px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
          >
            ✈️ טיול
          </span>
          {item.tripType && (
            <span className="absolute bottom-2.5 start-2.5 rounded-pill bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white">
              {getTripTypeLabel(item.tripType)}
            </span>
          )}
        </div>
        <div className="px-3.5 pb-3 pt-2.5">
          <h3 className="line-clamp-2 text-[16.5px] font-extrabold leading-snug text-ink">{item.title}</h3>
          <p className="mt-0.5 text-[12.5px] font-semibold text-ink-secondary">
            מאת {authorName} · {formatTripMeta(item.stopCount, item.dayCount)}
          </p>
          {item.description && <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-ink-secondary">{item.description}</p>}

          {item.previewStops.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1 overflow-hidden text-[12px] text-ink-secondary" aria-hidden="true">
              {item.previewStops.map((stop, i) => (
                <span key={`${stop.name}-${i}`} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <span className="shrink-0 text-ink-secondary/60">→</span>}
                  <span className="flex min-w-0 max-w-[6.5rem] items-center gap-1 rounded-pill bg-bg-secondary px-2 py-0.5">
                    <span className="shrink-0">{placeCategoryEmoji(stop.category)}</span>
                    <span className="truncate font-semibold text-ink">{stop.name}</span>
                  </span>
                </span>
              ))}
              {hiddenStops > 0 && (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-ink-secondary/60">→</span>
                  <span className="font-bold" style={{ color: "var(--color-places-purple)" }}>
                    +{hiddenStops}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      <div className="mt-1.5">
        <CollectionActionBar
          item={item}
          basePath={`/api/social/trips/${item.id}`}
          sharePath={href}
          shareText={`${item.title} - טיול ב-TRIPLACE`}
          commentsActive={commentsExpanded}
          onToggleComments={() => setCommentsExpanded((v) => !v)}
        />
      </div>
      {commentsExpanded && <PostInlineComments postId={item.id} basePath={`/api/social/trips/${item.id}`} />}
    </article>
  );
}
