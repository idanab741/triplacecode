"use client";

import Link from "next/link";
import type { OnlineFriendDto } from "@/services/social/onlinePresenceService";
import { getAvatarUrl } from "@/constants/avatar";

interface OnlineFriendsSectionProps {
  friends: OnlineFriendDto[];
  /** כותרת הסקשן - ברירת מחדל "חברים אונליין" (עמוד Places), נדרס ל"מחוברים עכשיו" בעמוד הצ'אטים. */
  title?: string;
  /** אם לא להציג את המונה בסוגריים ליד הכותרת. */
  hideCount?: boolean;
}

/** "חברים אונליין" / "מחוברים עכשיו" - מספר, אווטארים, נקודה ירוקה/צהובה (סעיף 8 באפיון). */
export function OnlineFriendsSection({ friends, title = "חברים אונליין", hideCount = false }: OnlineFriendsSectionProps) {
  if (friends.length === 0) return null;

  return (
    <section className="rounded-2xl bg-bg-secondary px-4 py-3">
      <h2 className="mb-3 text-[15px] font-bold text-ink">
        {title} {!hideCount && <span className="text-ink-secondary font-normal">({friends.length})</span>}
      </h2>
      <div className="flex gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {friends.map((friend) => (
          <Link
            key={friend.id}
            href={`/places/profile/${friend.username ?? friend.id}`}
            className="flex w-14 shrink-0 flex-col items-center gap-1"
          >
            {/* *** תיקון (בקשה מפורשת - "העיגול של הזמין/לא זמין נבלע בתוך הפרופיל"): הנקודה הייתה
                בתוך אותו span עם overflow-hidden+rounded-full של התמונה - כלומר בתוך המסכה העגולה
                עצמה, ולכן הפינה שבה היא יושבת (bottom-end) נחתכת ונעלמת. עכשיו ה-overflow-hidden+
                rounded-full עברו ל-span פנימי שעוטף *רק* את התמונה, וה-span החיצוני (שמכיל גם את
                נקודת הסטטוס) הוא רק relative בלי חיתוך - כך שהנקודה תמיד גלויה מעל התמונה. */}
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="h-full w-full overflow-hidden rounded-full bg-bg-secondary">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getAvatarUrl(friend.avatarUrl)} alt="" className="h-full w-full object-cover" />
              </span>
              <span
                className="absolute bottom-0 end-0 z-10 h-3.5 w-3.5 rounded-full border-2 border-white"
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
