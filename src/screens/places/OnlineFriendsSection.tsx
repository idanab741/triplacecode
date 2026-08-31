"use client";

import Image from "next/image";
import Link from "next/link";
import type { OnlineFriendDto } from "@/services/social/onlinePresenceService";

interface OnlineFriendsSectionProps {
  friends: OnlineFriendDto[];
}

/** "חברים אונליין" - מספר, אווטארים, נקודה ירוקה (סעיף 8 באפיון). */
export function OnlineFriendsSection({ friends }: OnlineFriendsSectionProps) {
  if (friends.length === 0) return null;

  return (
    <section className="px-4 py-3">
      <h2 className="mb-3 text-[15px] font-bold text-ink">
        חברים אונליין <span className="text-ink-secondary font-normal">({friends.length})</span>
      </h2>
      <div className="flex gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {friends.map((friend) => (
          <Link
            key={friend.id}
            href={`/places/profile/${friend.username ?? friend.id}`}
            className="flex w-14 shrink-0 flex-col items-center gap-1"
          >
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-bg-secondary">
              {friend.avatarUrl ? (
                <Image src={friend.avatarUrl} alt="" width={48} height={48} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-ink-secondary">{friend.fullName?.[0] ?? "?"}</span>
              )}
              <span
                className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-white"
                style={{ background: friend.status === "online" ? "#22c55e" : "#facc15" }}
              />
            </span>
            <span className="w-full truncate text-center text-[10.5px] text-ink-secondary">
              {friend.fullName?.split(" ")[0] ?? friend.username}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
