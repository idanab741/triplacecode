"use client";

import Link from "next/link";
import { useState } from "react";
import type { CreatorCardDto } from "@/services/social/creatorDiscoveryService";

interface CreatorsSectionProps {
  creators: CreatorCardDto[];
  onFollowToggle: (creatorId: string) => Promise<void>;
}

/** "יוצרים שכדאי לעקוב אחריהם" - לא "משתמשים מומלצים" (סעיף 7, 23 באפיון). */
export function CreatorsSection({ creators, onFollowToggle }: CreatorsSectionProps) {
  if (creators.length === 0) return null;

  return (
    <section className="px-4 py-3">
      <h2 className="mb-3 text-[15px] font-bold text-ink">יוצרים שכדאי לעקוב אחריהם</h2>
      <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {creators.map((creator) => (
          <CreatorCard key={creator.id} creator={creator} onFollowToggle={onFollowToggle} />
        ))}
      </div>
    </section>
  );
}

function CreatorCard({ creator, onFollowToggle }: { creator: CreatorCardDto; onFollowToggle: (id: string) => Promise<void> }) {
  const [following, setFollowing] = useState(creator.viewerFollowing);
  const [loading, setLoading] = useState(false);

  return (
    <div className="w-[150px] shrink-0 rounded-card bg-white p-3 shadow-soft">
      <Link href={`/places/profile/${creator.username ?? creator.id}`} className="flex flex-col items-center">
        <span className="h-16 w-16 overflow-hidden rounded-full bg-bg-secondary">
          {creator.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={creator.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-xl font-bold text-ink-secondary">
              {creator.fullName?.[0] ?? "?"}
            </span>
          )}
        </span>
        <span className="mt-2 truncate text-[13px] font-semibold text-ink">{creator.fullName ?? creator.username}</span>
        <span className="text-[11px] text-ink-secondary">{creator.followersCount} עוקבים</span>
      </Link>

      {creator.category.length > 0 && (
        <p className="mt-1 truncate text-center text-[11px] text-ink-secondary">{creator.category.join(" · ")}</p>
      )}

      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await onFollowToggle(creator.id);
            setFollowing((f) => !f);
          } finally {
            setLoading(false);
          }
        }}
        className="mt-2 w-full rounded-pill py-1.5 text-[12px] font-bold transition-opacity disabled:opacity-50"
        style={
          following
            ? { border: "1px solid var(--color-places-purple)", color: "var(--color-places-purple)" }
            : { background: "var(--color-places-purple)", color: "white" }
        }
      >
        {following ? "עוקב" : "עקוב"}
      </button>
    </div>
  );
}
