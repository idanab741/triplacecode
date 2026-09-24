"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";
import { NotificationCard } from "@/screens/notifications/NotificationCard";
import type { ActivityItem } from "@/services/notifications/notificationsService";
import { useAuth } from "@/hooks/useAuth";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";
import {
  fetchUnifiedNotifications,
  groupNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  preferencesReminder,
  PREFERENCES_REMINDER_ID,
  type UnifiedTab,
} from "@/services/notifications/unifiedNotificationsClient";

const INK = { "--color-ink": "#0f1419", "--color-ink-secondary": "#5b6472" } as CSSProperties;

const TABS: { id: UnifiedTab; label: string }[] = [
  { id: "all", label: "הכול" },
  { id: "social", label: "פעילות" },
  { id: "trips", label: "הטיולים שלי" },
  { id: "recommendations", label: "המלצות" },
  { id: "system", label: "מערכת" },
];

const EMPTY_TEXT: Record<UnifiedTab, string> = {
  all: "כשמישהו יעקוב אחריכם, יאהב או יגיב על פוסט - זה יופיע כאן.",
  social: "עוקבים חדשים, לייקים ותגובות על הפוסטים שלכם יופיעו כאן.",
  trips: "עדכונים על טיולים ששמרתם יופיעו כאן.",
  recommendations: "המלצות מותאמות אישית יופיעו כאן.",
  system: "הודעות מצוות triplace יופיעו כאן.",
};

/**
 * "מה חדש?" - עמוד ההתראות.
 * *** עיצוב מחדש (בקשה מפורשת - "לא מותאם לאפליקציה שלנו"): בלי הכחול/גרדיאנט של העיצוב הישן,
 * בלי כרטיסים עם צל ובלי אימוג'י. רשימה נקייה בסגנון אינסטגרם, מקובצת לפי זמן (חדש · היום · השבוע ·
 * מוקדם יותר), טאבים שטוחים, וטאב חדש "פעילות" להתראות החברתיות - שעד עכשיו הופיעו רק ב"הכול".
 * הנתונים והסימון כנקרא - מאותו מקור כמו חלונית הפעמון (unifiedNotificationsClient).
 */
export default function NotificationsPage() {
  const router = useRouter();
  const { preferences, preferencesLoading } = useAuth();
  const [tab, setTab] = useState<UnifiedTab>("all");
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);

  async function load(current: UnifiedTab) {
    setError(false);
    setItems(null);
    try {
      setItems(await fetchUnifiedNotifications(current));
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const reminder = tab === "all" && !preferencesLoading && !isPreferencesComplete(preferences) ? preferencesReminder() : null;
  const displayItems = items ? (reminder ? [reminder, ...items] : items) : null;
  const unreadCount = displayItems?.filter((i) => !i.isRead && i.id !== PREFERENCES_REMINDER_ID).length ?? 0;

  function handleOpen(item: ActivityItem) {
    markNotificationRead(item);
    if (!item.isRead && item.id !== PREFERENCES_REMINDER_ID) {
      setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)) ?? prev);
    }
    if (item.actionUrl) router.push(item.actionUrl);
  }

  async function handleMarkAll() {
    if (!items) return;
    setItems((prev) => prev?.map((i) => ({ ...i, isRead: true })) ?? prev);
    await markAllNotificationsRead(items);
  }

  return (
    <div className="min-h-screen bg-white pb-28" style={INK}>
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.push("/home")} />

      <div className="mx-auto max-w-xl">
        <div className="flex items-end justify-between px-5 pt-3">
          <h1 className="text-[24px] font-bold tracking-tight text-ink">מה חדש?</h1>
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAll} className="rounded-full px-2 py-1 text-[14px] font-semibold text-places-purple active:bg-places-purple/10">
              סימון הכול כנקרא
            </button>
          )}
        </div>

        <div role="tablist" className="flex gap-2 overflow-x-auto px-5 pb-2 pt-4" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => {
            const selected = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(t.id)}
                className={`h-9 shrink-0 rounded-full px-4 text-[14px] transition-colors ${
                  selected ? "bg-ink font-semibold text-white" : "bg-[#F1F2F5] font-medium text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="px-3">
          {displayItems === null && !error && (
            <div className="flex flex-col gap-1 pt-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-3">
                  <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#EFF1F4]" />
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="h-3.5 w-3/4 animate-pulse rounded bg-[#EFF1F4]" />
                    <span className="h-3 w-1/3 animate-pulse rounded bg-[#F4F5F7]" />
                  </span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p className="text-[15px] text-ink-secondary">לא הצלחנו לטעון את ההתראות.</p>
              <button type="button" onClick={() => load(tab)} className="h-10 rounded-xl bg-[#EFF1F4] px-5 text-[14px] font-semibold text-ink">
                נסו שוב
              </button>
            </div>
          )}

          {displayItems !== null && !error && displayItems.length === 0 && (
            <div className="flex flex-col items-center px-8 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1ECFE] text-places-purple">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5Z" />
                  <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
                </svg>
              </span>
              <p className="mt-4 text-[17px] font-semibold text-ink">אין התראות חדשות</p>
              <p className="mt-1.5 max-w-[280px] text-[14.5px] leading-relaxed text-ink-secondary">{EMPTY_TEXT[tab]}</p>
            </div>
          )}

          {displayItems !== null &&
            !error &&
            groupNotifications(displayItems).map((group) => (
              <section key={group.title} className="pt-3">
                <h2 className="px-2 pb-1 text-[15px] font-bold text-ink">{group.title}</h2>
                {group.items.map((item) => (
                  <NotificationCard key={item.id} item={item} onOpen={handleOpen} />
                ))}
              </section>
            ))}
        </div>
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}
