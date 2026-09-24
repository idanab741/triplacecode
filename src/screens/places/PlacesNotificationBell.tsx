"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { NotificationCard } from "@/screens/notifications/NotificationCard";
import type { ActivityItem } from "@/services/notifications/notificationsService";
import { useAuth } from "@/hooks/useAuth";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";
import {
  fetchUnifiedNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  preferencesReminder,
  PREFERENCES_REMINDER_ID,
} from "@/services/notifications/unifiedNotificationsClient";

/** פעמון מאוחד: אותה קומפוננטה/עיצוב/מיקום כמו ה-HomeHeader של triplace,
 *  אבל מציג יחד - ממוין לפי זמן - גם את ההתראות הקיימות של triplace
 *  (תזכורות טיול, הודעות Admin) וגם את ההתראות ה-social (עוקבים/
 *  לייקים/תגובות). זו אותה תשתית read/unread הקיימת (notification_reads)
 *  לשני הסוגים - לא כפילות. */
interface PlacesNotificationBellProps {
  /** true (בר place's הסגול): עיגול לבן מלא עם צל - בדיוק כמו הפעמון בבר של עמוד הבית. */
  solid?: boolean;
  /** true (עמוד הבית): אייקון נקי בלי עיגול, מסגרת או צל - כמו X/פייסבוק/אינסטגרם.
   *  גובר על solid. */
  plain?: boolean;
  /** true (עמודים כהים): אייקון הפעמון בלבן. */
  inverted?: boolean;
  /** צבע עיגול המונה: "purple" - בית ומפה (place's); ברירת מחדל כחול בכל שאר האפליקציה. */
  badgeTone?: "blue" | "purple";
}

export function PlacesNotificationBell({ solid = false, plain = false, inverted = false, badgeTone = "blue" }: PlacesNotificationBellProps = {}) {
  const router = useRouter();
  const { preferences, preferencesLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /** התראה קבועה עד השלמת ההתאמות האישיות - לא מה-DB (ר' unifiedNotificationsClient). */
  const reminder: ActivityItem | null = !preferencesLoading && !isPreferencesComplete(preferences) ? preferencesReminder() : null;

  async function fetchNotifications() {
    setError(false);
    try {
      setItems(await fetchUnifiedNotifications("all"));
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    fetchNotifications();
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const displayItems = items ? (reminder ? [reminder, ...items] : items) : items;
  const unreadCount = displayItems ? displayItems.filter((i) => !i.isRead).length : null;

  function handleOpenNotification(item: ActivityItem) {
    setOpen(false);
    markNotificationRead(item);
    if (!item.isRead && item.id !== PREFERENCES_REMINDER_ID) {
      setItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)) : prev));
    }
    if (item.actionUrl) router.push(item.actionUrl);
  }

  async function handleMarkAll() {
    if (!items) return;
    setItems((prev) => prev?.map((i) => ({ ...i, isRead: true })) ?? prev);
    await markAllNotificationsRead(items);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="התראות"
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
          plain
            ? inverted
              ? "transition-colors active:bg-white/10"
              : "transition-colors active:bg-black/[0.05]"
            : solid
            ? "bg-white shadow-[0_4px_12px_-4px_rgba(50,10,120,0.45)]"
            : "border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
        }`}
      >
        <Image src="/icons/bell.png" alt="" width={24} height={24} className={`${plain ? "h-6 w-6" : "h-[22px] w-[22px]"} ${inverted ? "brightness-0 invert" : ""}`} />
        {unreadCount != null && unreadCount > 0 && (
          <span
            className={`absolute ${plain ? "left-0.5 top-0.5" : "-left-1 -top-1"} flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ${inverted ? "ring-black" : "ring-white"}`}
            style={{ background: badgeTone === "purple" ? "var(--color-places-purple)" : "var(--color-primary-start)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* *** חלונית חדשה (בקשה מפורשת - "לא מותאמת לאפליקציה שלנו"): כותרת + "סימון הכול כנקרא",
          עד 6 התראות אחרונות באותן שורות כמו בעמוד המלא, ו"לכל ההתראות" בתחתית. בלי כחול ובלי אימוג'י. */}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-[calc(100vw-2.5rem)] max-w-[360px] overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_-12px_rgba(15,20,25,0.35)] ring-1 ring-black/[0.06]"
          style={{ "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties}
        >
          <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
            <p className="text-[16px] font-bold text-ink">התראות</p>
            {unreadCount != null && unreadCount > (reminder ? 1 : 0) && (
              <button type="button" onClick={handleMarkAll} className="rounded-full px-2 py-1 text-[13px] font-semibold text-places-purple active:bg-places-purple/10">
                סימון הכול כנקרא
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-1.5 pb-1">
            {items === null && !error && (
              <div className="flex flex-col">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-2.5 py-2.5">
                    <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#EFF1F4]" />
                    <span className="h-3.5 flex-1 animate-pulse rounded bg-[#EFF1F4]" />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-[14px] text-ink-secondary">לא הצלחנו לטעון את ההתראות.</p>
                <button type="button" onClick={fetchNotifications} className="text-[14px] font-semibold text-ink underline">
                  נסו שוב
                </button>
              </div>
            )}

            {items !== null && !error && displayItems!.length === 0 && (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1ECFE] text-places-purple">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5Z" />
                    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
                  </svg>
                </span>
                <p className="mt-3 text-[15px] font-semibold text-ink">אין התראות חדשות</p>
                <p className="mt-1 text-[13.5px] leading-snug text-ink-secondary">עוקבים, לייקים ותגובות יופיעו כאן.</p>
              </div>
            )}

            {items !== null && !error && displayItems!.length > 0 && (
              <div className="flex flex-col">
                {displayItems!.slice(0, 6).map((item) => (
                  <NotificationCard key={item.id} item={item} onOpen={handleOpenNotification} compact />
                ))}
              </div>
            )}
          </div>

          {items !== null && !error && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
              className="flex h-12 w-full items-center justify-center border-t border-black/[0.06] text-[14.5px] font-semibold text-ink transition-colors active:bg-black/[0.03]"
            >
              לכל ההתראות
            </button>
          )}
        </div>
      )}
    </div>
  );
}
