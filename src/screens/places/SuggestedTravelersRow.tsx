"use client";

import Link from "next/link";
import { useState } from "react";
import type { SuggestedTravelerDto } from "@/services/social/suggestedTravelersService";

interface SuggestedTravelersRowProps {
  travelers: SuggestedTravelerDto[];
  onFollowToggle: (userId: string) => Promise<void>;
}

/** "מטיילים מומלצים עבורך" - שורת עיגולים פשוטה, מתחת ל-Stories ישירות.
 *  שונה מ-CreatorsSection (כרטיסים) - כאן זו רשימת אנשים כללית ורחבה. */
export function SuggestedTravelersRow({ travelers, onFollowToggle }: SuggestedTravelersRowProps) {
  if (travelers.length === 0) return null;

  return (
    <section className="border-t border-ink-secondary/10 px-4 py-3">
      <h2 className="mb-3 text-[14px] font-bold text-ink">מטיילים מומלצים עבורך</h2>
      <div className="flex gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {travelers.map((traveler) => (
          <TravelerCircle key={traveler.id} traveler={traveler} onFollowToggle={onFollowToggle} />
        ))}
      </div>
    </section>
  );
}

function TravelerCircle({
  traveler,
  onFollowToggle,
}: {
  traveler: SuggestedTravelerDto;
  onFollowToggle: (userId: string) => Promise<void>;
}) {
  const [following, setFollowing] = useState(traveler.viewerFollowing);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex w-[68px] shrink-0 flex-col items-center gap-1.5">
      <Link href={`/places/profile/${traveler.username ?? traveler.id}`} className="flex flex-col items-center gap-1.5">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-bg-secondary">
          {traveler.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={traveler.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-ink-secondary">{traveler.fullName?.[0] ?? "?"}</span>
          )}
        </span>
        <span className="w-full truncate text-center text-[11px] font-semibold text-ink">
          {traveler.fullName?.split(" ")[0] ?? traveler.username ?? "מטייל"}
        </span>
      </Link>
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          try {
            await onFollowToggle(traveler.id);
            setFollowing((f) => !f);
          } finally {
            setLoading(false);
          }
        }}
        className="rounded-pill px-2.5 py-1 text-[10.5px] font-bold disabled:opacity-50"
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
