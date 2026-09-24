"use client";

import type { ActivityItem, ActivityTab } from "@/services/notifications/notificationsService";
import type { SocialNotificationItem } from "@/services/social/socialNotificationsService";

/**
 * *** מקור אחד לחלונית ההתראות (הפעמון) ולעמוד ההתראות (בקשה מפורשת - "לא מותאם לאפליקציה שלנו"):
 * עד עכשיו אותה לוגיקה (מיזוג התראות triplace + חברתיות, סימון כנקרא) הייתה מועתקת בשני הקבצים.
 * עכשיו שניהם משתמשים בזה - כך שהרשימה, הניסוחים והסימון זהים תמיד.
 */

/** "פעילות" = ההתראות החברתיות (עוקבים, לייקים, תגובות, חברויות). */
export type UnifiedTab = ActivityTab | "social";

const SOCIAL_TEXT: Record<string, string> = {
  NEW_FOLLOWER: "התחיל/ה לעקוב אחריך",
  FRIEND_REQUEST: "שלח/ה לך בקשת חברות",
  FRIEND_ACCEPTED: "אישר/ה את בקשת החברות שלך",
  POST_LIKE: "אהב/ה את הפוסט שלך",
  POST_COMMENT: "הגיב/ה על הפוסט שלך",
  COMMENT_REPLY: "הגיב/ה לתגובה שלך",
};

export const PREFERENCES_REMINDER_ID = "pref_reminder";

export function isSocialItem(item: Pick<ActivityItem, "id">): boolean {
  return item.id.startsWith("social_");
}

function socialToActivity(item: SocialNotificationItem): ActivityItem {
  const actionUrl =
    item.type === "FRIEND_REQUEST"
      ? "/places/friends/requests"
      : (item.type === "POST_LIKE" || item.type === "POST_COMMENT") && item.targetId
        ? `/places/post/${item.targetId}`
        : item.actor.username
          ? `/places/profile/${item.actor.username}`
          : `/places/profile/${item.actor.id}`;
  return {
    id: item.id,
    category: "system",
    priority: "normal",
    title: item.actor.fullName ?? item.actor.username ?? "מטייל",
    description: SOCIAL_TEXT[item.type] ?? "",
    imageUrl: item.actor.avatarUrl,
    icon: null,
    actionUrl,
    actionLabel: null,
    timestamp: item.createdAt,
    isRead: item.isRead,
  };
}

export function preferencesReminder(): ActivityItem {
  return {
    id: PREFERENCES_REMINDER_ID,
    category: "system",
    priority: "important",
    title: "השלימו את ההתאמות האישיות",
    description: "כדי שנציע לכם מקומות וטיולים שמתאימים בדיוק לכם",
    imageUrl: null,
    icon: null,
    actionUrl: "/preferences",
    actionLabel: null,
    timestamp: new Date().toISOString(),
    isRead: false,
  };
}

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("failed");
  return res.json();
}

export async function fetchUnifiedNotifications(tab: UnifiedTab = "all"): Promise<ActivityItem[]> {
  if (tab === "social") {
    const data = await getJson("/api/social/notifications");
    return ((data.notifications ?? []) as SocialNotificationItem[]).map(socialToActivity);
  }
  if (tab !== "all") {
    const data = await getJson(`/api/notifications?tab=${tab}`);
    return (data.notifications ?? []) as ActivityItem[];
  }
  const [triplace, social] = await Promise.all([getJson("/api/notifications?tab=all"), getJson("/api/social/notifications")]);
  return [...((triplace.notifications ?? []) as ActivityItem[]), ...((social.notifications ?? []) as SocialNotificationItem[]).map(socialToActivity)].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function markNotificationRead(item: ActivityItem): void {
  if (item.id === PREFERENCES_REMINDER_ID || item.isRead) return;
  const req = isSocialItem(item)
    ? fetch("/api/social/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityKey: item.id }),
      })
    : fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" });
  req.catch(() => {});
}

export async function markAllNotificationsRead(items: ActivityItem[]): Promise<void> {
  const socialKeys = items.filter((i) => !i.isRead && isSocialItem(i)).map((i) => i.id);
  await Promise.all([
    fetch("/api/notifications/read-all", { method: "POST" }),
    ...socialKeys.map((activityKey) =>
      fetch("/api/social/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityKey }),
      })
    ),
  ]).catch(() => {});
}

/** קבוצות זמן, כמו באינסטגרם: חדש (לא נקרא) · היום · השבוע · מוקדם יותר. */
export function groupNotifications(items: ActivityItem[]): { title: string; items: ActivityItem[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const groups: Record<string, ActivityItem[]> = { חדש: [], היום: [], השבוע: [], "מוקדם יותר": [] };
  for (const item of items) {
    const t = new Date(item.timestamp).getTime();
    if (!item.isRead) groups["חדש"].push(item);
    else if (t >= startOfToday) groups["היום"].push(item);
    else if (t >= weekAgo) groups["השבוע"].push(item);
    else groups["מוקדם יותר"].push(item);
  }
  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([title, list]) => ({ title, items: list }));
}
