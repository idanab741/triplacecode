"use client";

import { formatRelativeTimeHe } from "@/utils/relativeTime";
import type { ActivityItem } from "@/services/notifications/notificationsService";

interface NotificationCardProps {
  item: ActivityItem;
  onOpen: (item: ActivityItem) => void;
}

const PRIORITY_ACCENT: Record<ActivityItem["priority"], string> = {
  urgent: "var(--color-danger, #E5484D)",
  important: "var(--color-primary-start)",
  normal: "transparent",
};

/** כרטיס פעילות בודד - MASTER PROMPT סעיף 22: אייקון/תמונה, כותרת,
 *  תיאור קצר, זמן יחסי, CTA אם יש. לא-נקרא מסומן בעדינות (נקודה +
 *  רקע מעט שונה + weight גבוה יותר) - לא הופך את המסך לצבעוני. */
export function NotificationCard({ item, onOpen }: NotificationCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="flex w-full items-start gap-3 rounded-card p-3 text-right transition active:scale-[0.99] relative"
      style={{
        background: item.isRead ? "var(--color-bg, #fff)" : "var(--color-bg-secondary, #F7F8FA)",
        boxShadow: "var(--shadow-soft, 0 1px 4px rgba(16,24,40,0.06))",
      }}
    >
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary text-xl">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span>{item.icon ?? "🔔"}</span>
        )}
        {!item.isRead && (
          <span
            className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white"
            style={{ background: "var(--color-primary-start)" }}
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={`text-sm leading-snug text-ink ${item.isRead ? "font-medium" : "font-bold"}`}>{item.title}</span>
        </span>
        <span className="mt-0.5 block text-xs leading-snug text-ink-secondary">{item.description}</span>
        <span className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] text-ink-secondary/70">{formatRelativeTimeHe(item.timestamp)}</span>
          {item.actionLabel && (
            <span className="text-xs font-semibold text-accent">{item.actionLabel} ←</span>
          )}
        </span>
      </span>

      {item.priority !== "normal" && (
        <span
          className="absolute right-0 top-3 h-8 w-1 rounded-full"
          style={{ background: PRIORITY_ACCENT[item.priority] }}
        />
      )}
    </button>
  );
}
