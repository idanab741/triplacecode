"use client";

import Link from "next/link";
import { BackButton } from "@/components/ui";
import { getAvatarUrl } from "@/constants/avatar";
import type { DmOtherUserDto } from "@/services/social/dmService";

interface DmChatHeaderProps {
  otherUser: DmOtherUserDto | null;
  onBack: () => void;
}

/** Header של צ'אט פרטי בין שני משתמשים - אותה שפה חזותית של
 *  SupportChatHeader/ChatHeader (לבן, כפתור חזרה, אווטאר+שם), אבל כאן
 *  האווטאר+השם הם של הצד השני בשיחה (לא לוגו/AI קבוע) ומקושרים לפרופיל
 *  שלו - אפשר ללחוץ ולעבור לצפות בו. */
export function DmChatHeader({ otherUser, onBack }: DmChatHeaderProps) {
  const name = otherUser?.fullName || otherUser?.username || "משתמש";

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center gap-3 bg-white px-2 shadow-sm">
      <BackButton onBack={onBack} />
      {otherUser ? (
        <Link href={`/places/profile/${otherUser.username ?? otherUser.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-bg-secondary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getAvatarUrl(otherUser.avatarUrl)} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="truncate text-[15.5px] font-bold text-ink">{name}</span>
        </Link>
      ) : (
        <div className="h-5 w-32 animate-pulse rounded-full bg-bg-secondary" />
      )}
    </header>
  );
}
