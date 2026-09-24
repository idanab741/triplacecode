"use client";

import Image from "next/image";
import { formatRelativeTimeHe } from "@/utils/relativeTime";
import type { ActivityItem } from "@/services/notifications/notificationsService";
import { isSocialItem, PREFERENCES_REMINDER_ID } from "@/services/notifications/unifiedNotificationsClient";
import { getAvatarUrl } from "@/constants/avatar";

interface NotificationCardProps {
  item: ActivityItem;
  onOpen: (item: ActivityItem) => void;
  /** בחלונית הפעמון - שורה צפופה מעט יותר. */
  compact?: boolean;
}

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** אייקון קו לפי סוג ההתראה - במקום האימוג'י (🧳 ❤️ 📍 📢) שלא התאימו לשפה של האפליקציה. */
function CategoryIcon({ item }: { item: ActivityItem }) {
  if (item.id === PREFERENCES_REMINDER_ID)
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="10" cy="17" r="2" />
      </svg>
    );
  if (item.category === "trips")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true">
        <rect x="4" y="7" width="16" height="12" rx="2.5" />
        <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M4 12h16" />
      </svg>
    );
  if (item.category === "recommendations")
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true">
        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
        <path d="m12 7.5.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3Z" />
      </svg>
    );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" {...P} aria-hidden="true">
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </svg>
  );
}

/**
 * *** עיצוב מחדש (בקשה מפורשת - "חלונית ועמוד ההתראות לא מותאמים לאפליקציה"): שורה נקייה בסגנון
 * אינסטגרם במקום כרטיס עם צל ופס צבע בצד:
 *  - התראה חברתית: תמונת הפרופיל של מי שעשה את הפעולה, ובשורה אחת "**שם** אהב/ה את הפוסט שלך · 3 ש׳".
 *  - התראת מערכת/טיול: אייקון קו בעיגול סגלגל, כותרת מודגשת ותיאור מתחת.
 *  - לא נקרא: נקודה סגולה בקצה השורה (ובלי רקע צבעוני לכל השורה).
 */
export function NotificationCard({ item, onOpen, compact = false }: NotificationCardProps) {
  const social = isSocialItem(item);
  const time = formatRelativeTimeHe(item.timestamp);
  const avatar = compact ? "h-10 w-10" : "h-11 w-11";

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`flex w-full items-center gap-3 rounded-xl text-start transition-colors active:bg-black/[0.04] ${compact ? "px-2.5 py-2.5" : "px-2 py-3"}`}
    >
      <span className={`relative flex ${avatar} shrink-0 items-center justify-center overflow-hidden rounded-full`}>
        {social ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getAvatarUrl(item.imageUrl || null)} alt="" className="h-full w-full bg-[#EFF1F4] object-cover" />
        ) : item.id === PREFERENCES_REMINDER_ID ? (
          <span className="flex h-full w-full items-center justify-center bg-[#F1ECFE]">
            <Image src="/images/onboarding-fab.png" alt="" width={44} height={44} className="h-full w-full object-contain" />
          </span>
        ) : item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[#F1ECFE] text-places-purple">
            <CategoryIcon item={item} />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        {social ? (
          <span className="block text-[14.5px] leading-snug text-ink">
            <span className="font-semibold">{item.title}</span> {item.description}
            <span className="whitespace-nowrap text-ink-secondary"> · {time}</span>
          </span>
        ) : (
          <>
            <span className={`block text-[14.5px] leading-snug text-ink ${item.isRead ? "font-medium" : "font-semibold"}`}>{item.title}</span>
            {item.description && <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-secondary">{item.description}</span>}
            {item.id !== PREFERENCES_REMINDER_ID && <span className="mt-0.5 block text-[12.5px] text-ink-secondary">{time}</span>}
          </>
        )}
      </span>

      {!item.isRead && <span aria-label="לא נקרא" className="h-2.5 w-2.5 shrink-0 rounded-full bg-places-purple" />}
    </button>
  );
}
