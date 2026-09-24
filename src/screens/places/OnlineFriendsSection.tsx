"use client";

import Link from "next/link";
import type { OnlineFriendDto } from "@/services/social/onlinePresenceService";
import { getAvatarUrl } from "@/constants/avatar";

interface OnlineFriendsSectionProps {
  friends: OnlineFriendDto[];
  /** כותרת אופציונלית מעל הפס. בעמוד הצ'אטים - בלי כותרת (כמו ב-Messenger/אינסטגרם). */
  title?: string;
  /** נשמר לתאימות לאחור - אין יותר מונה ליד הכותרת. */
  hideCount?: boolean;
  /** לחיצה על חבר: בעמוד הצ'אטים - פותחת את הצ'אט איתו. בלי - מובילה לפרופיל. */
  onSelect?: (friendId: string) => void;
  /** מזהה שנפתח כרגע (מציג טעינה על העיגול). */
  busyId?: string | null;
}

const ONLINE = "#22C55E";
const AWAY = "#FACC15";

/**
 * *** פס החברים בעמוד הצ'אטים (בקשה מפורשת - "מי מחובר ומי לא מכל החברים שלך, מעל הכותרת צ'אטים;
 * עיגול תמונת פרופיל עם עיגול קטן ירוק (מחובר) או צהוב (לא מחובר)"):
 * פס גלילה אופקי בלי קופסה אפורה - תמונה 60px, נקודת סטטוס עם מסגרת לבנה (מחוץ למסכה העגולה,
 * כדי שלא תיחתך), ושם פרטי מתחת. המחוברים ראשונים.
 */
export function OnlineFriendsSection({ friends, title, onSelect, busyId }: OnlineFriendsSectionProps) {
  if (friends.length === 0) return null;

  return (
    <section aria-label={title ?? "החברים שלך"}>
      {title && <h2 className="mb-2 px-5 text-[15px] font-bold text-ink">{title}</h2>}
      <ul className="flex gap-3.5 overflow-x-auto px-5 pb-1 pt-1" style={{ scrollbarWidth: "none" }}>
        {friends.map((friend) => {
          const online = friend.status === "online";
          const name = friend.fullName?.split(" ")[0] ?? friend.username ?? "חבר";
          const content = (
            <>
              <span className="relative block h-[60px] w-[60px]">
                <span className="block h-full w-full overflow-hidden rounded-full bg-[#EFF1F4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getAvatarUrl(friend.avatarUrl)} alt="" className="h-full w-full object-cover" />
                </span>
                <span
                  aria-hidden="true"
                  className="absolute bottom-0.5 end-0.5 h-4 w-4 rounded-full ring-[3px] ring-white"
                  style={{ background: online ? ONLINE : AWAY }}
                />
                {busyId === friend.id && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-black/60" />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[12.5px] text-ink">{name}</span>
              <span className="sr-only">{online ? "מחובר/ת" : "לא מחובר/ת"}</span>
            </>
          );
          const cls = "flex w-[64px] flex-col items-center gap-1.5 transition active:scale-95";
          return (
            <li key={friend.id} className="shrink-0">
              {onSelect ? (
                <button type="button" onClick={() => onSelect(friend.id)} className={cls}>
                  {content}
                </button>
              ) : (
                <Link href={`/places/profile/${friend.username ?? friend.id}`} className={cls}>
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
