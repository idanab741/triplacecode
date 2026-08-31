"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { StoryRailAuthorDto } from "@/services/social/storyService";

interface StoriesRailProps {
  rail: StoryRailAuthorDto[];
  viewerId: string;
  /** תמונת הפרופיל האמיתית של המשתמש - מוצגת בתוך כפתור "צור סטורי"
   *  (בקשה מפורשת: "התמונה בצור סטורי צריכה להיות תמונת הפרופיל"). */
  viewerAvatarUrl?: string | null;
  onOpenStory: (authorIndex: number) => void;
  onCreateStory: () => void;
}

function Avatar({ url, initial }: { url: string | null; initial: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-full w-full object-cover" />
  ) : (
    <span
      className="flex h-full w-full items-center justify-center text-xl font-extrabold text-white"
      style={{ background: "linear-gradient(135deg, var(--color-places-purple), var(--color-places-violet))" }}
    >
      {initial}
    </span>
  );
}

/** "חלון מטוס" - צורה אליפטית מוארכת (סעיף 6 באפיון + בקשה מפורשת
 *  לעיצוב ייחודי ולא Instagram-clone). */
function WindowFrame({ gradient, glow, children }: { gradient: string; glow: boolean; children: ReactNode }) {
  return (
    <span
      className="flex h-[92px] w-[68px] items-center justify-center rounded-full p-[3px]"
      style={{ background: gradient, boxShadow: glow ? "0 6px 18px -4px rgba(124,58,237,0.55)" : "none" }}
    >
      <span className="h-full w-full overflow-hidden rounded-full border-[3px] border-white">{children}</span>
    </span>
  );
}

/** כפתור "+" ליצירת סטורי - תמיד נפרד וניטרלי, לא מתמזג עם שום תמונה
 *  (תוקן לפי בקשה מפורשת: "לא אמור להיות טבעת מסביב לאליפסה הראשונה").
 *  הסטורי שלי בפועל, אם קיים, מופיע בהמשך כאליפסה נוספת ונפרדת - בדיוק
 *  כמו כל אליפסה אחרת ברשימה, עם התמונה שהועלתה. */
export function StoriesRail({ rail, viewerId, viewerAvatarUrl, onOpenStory, onCreateStory }: StoriesRailProps) {
  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
      <button
        type="button"
        onClick={onCreateStory}
        className="flex w-[70px] shrink-0 flex-col items-center gap-2 transition-transform active:scale-95"
      >
        <span className="relative">
          <WindowFrame gradient="var(--color-bg-secondary, #eee)" glow={false}>
            <Avatar url={viewerAvatarUrl ?? null} initial="" />
          </WindowFrame>
          <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
            <Image src="/images/places-plus-icon.png" alt="הוסף סטורי" width={26} height={26} />
          </span>
        </span>
        <span className="w-full truncate text-center text-[11.5px] font-bold text-ink">צור סטורי</span>
      </button>

      {rail.map((entry) => {
        const isSelf = entry.author.id === viewerId;
        // התמונה בכל אליפסה היא התמונה הראשונה שמופיעה בסטורי עצמו
        // (entry.stories[0] הוא הסטורי הראשון שיוצג בצפייה, לפי סדר
        // כרונולוגי) - לא תמונת הפרופיל של המחבר (בקשה מפורשת, פעמיים).
        const thumbnailUrl = entry.stories[0]?.media[0]?.url ?? entry.author.avatarUrl;
        return (
          <button
            key={entry.author.id}
            type="button"
            onClick={() => onOpenStory(rail.indexOf(entry))}
            className="flex w-[70px] shrink-0 flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <WindowFrame
              gradient={
                entry.hasUnviewed
                  ? "linear-gradient(135deg, var(--color-places-purple) 0%, var(--color-places-violet) 55%, #ec4899 100%)"
                  : "#e2e2e8"
              }
              glow={entry.hasUnviewed}
            >
              <Avatar url={thumbnailUrl} initial={entry.author.fullName?.[0] ?? "?"} />
            </WindowFrame>
            <span className="w-full truncate text-center text-[11.5px] font-bold text-ink">
              {isSelf ? "הסטורי שלי" : (entry.author.fullName ?? entry.author.username ?? "מטייל")}
            </span>
          </button>
        );
      })}
    </div>
  );
}
