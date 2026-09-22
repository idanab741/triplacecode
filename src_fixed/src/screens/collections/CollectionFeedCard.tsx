"use client";

import { useState } from "react";
import Link from "next/link";
import type { CollectionCardDto } from "@/services/social/collectionTypes";
import { COLLECTION_TYPE_LABELS } from "@/services/social/collectionTypes";
import { formatRelativeTimeHe } from "@/utils/relativeTime";
import { getAvatarUrl } from "@/constants/avatar";
import { PostInlineComments } from "@/screens/places/PostInlineComments";
import { CollectionCover } from "./CollectionCover";
import { CollectionActionBar, collectionPath } from "./CollectionActionBar";

/**
 * Collection Card ב-Places Feed. ויזואלי ובולט - Cover/Collage גדול בתוך כרטיס מסומן "אוסף" - כדי שיהיה
 * ברור מיד שזה לא Post רגיל ולא רשימת טקסט. אותה שפה של PostCard (אווטאר, שם, שורת פעולות),
 * אבל התוכן הוא הקאבר, לא טקסט/מדיה של פוסט.
 */
export function CollectionFeedCard({ item }: { item: CollectionCardDto }) {
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const href = collectionPath(item.id);
  const authorName = item.author.fullName ?? item.author.username ?? "מטייל";
  const profileHref = `/places/profile/${item.author.username ?? item.author.id}`;

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
          <CollectionCover coverUrl={item.coverUrl} collageUrls={item.collageUrls} type={item.type} className="aspect-[16/11]" />
          <span
            className="absolute start-2.5 top-2.5 flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11.5px] font-bold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
          >
            {item.type === "places" ? "📍" : "✈️"} אוסף
          </span>
        </div>
        <div className="px-3.5 pb-3 pt-2.5">
          <h3 className="line-clamp-2 text-[16.5px] font-extrabold leading-snug text-ink">{item.title}</h3>
          {item.description && <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-ink-secondary">{item.description}</p>}
          <p className="mt-1.5 text-[12.5px] font-semibold text-ink-secondary">
            {authorName} · {COLLECTION_TYPE_LABELS[item.type].itemCount(item.itemCount)}
          </p>
        </div>
      </Link>

      <div className="mt-1.5">
        <CollectionActionBar item={item} commentsActive={commentsExpanded} onToggleComments={() => setCommentsExpanded((v) => !v)} />
      </div>
      {commentsExpanded && <PostInlineComments postId={item.id} basePath={`/api/social/collections/${item.id}`} />}
    </article>
  );
}
