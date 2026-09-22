"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Skeleton } from "@/components/ui";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { MainBottomNav } from "@/components/MainBottomNav";
import { NotificationCard } from "@/screens/notifications/NotificationCard";
import type { ActivityItem, ActivityTab } from "@/services/notifications/notificationsService";
import type { SocialNotificationItem } from "@/services/social/socialNotificationsService";
import { useAuth } from "@/hooks/useAuth";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";

/**
 * *** תכונה חדשה (MASTER PROMPT - מרכז פעילות/התראות): "מה חדש?" - לא
 * "Notifications"/"מרכז התראות" (בכוונה, ר' סעיף 4 בפרומפט). נשאר בתוך
 * ה-Bottom Nav הראשי (MainBottomNav, בלי טאב חדש) - הפעמון ב-Home הוא
 * ה-entry point היחיד (ר' HomeHeader.tsx).
 *
 * *** עדכון (בקשה מפורשת - "חלונית ההתראות צריכה להיות מאוחדת עם
 * ההתראות ב-place's! עם הבר העליון החדש בצבע תכלת"): שני שינויים -
 * (1) הבר העליון הוחלף מ-SimpleAppHeader הלבן ל-CollapsibleTopBar
 * התכלת (כמו בעמוד הבית/פרופיל/עוד), (2) טאב "הכול" ממזג גם התראות
 * social (עוקבים/לייקים/תגובות) - אותה לוגיקה בדיוק כמו PlacesNotificationBell,
 * כדי שהרשימה תהיה זהה בין הפעמון לעמוד המלא. טאבים ספציפיים
 * (טיולים/מערכת/המלצות) נשארים triplace-בלבד - social לא שייכת לאף
 * אחד מהם קונספטואלית.
 */

const TABS: { id: ActivityTab; label: string }[] = [
  { id: "all", label: "הכול" },
  { id: "trips", label: "הטיולים שלי" },
  { id: "system", label: "מערכת" },
  { id: "recommendations", label: "המלצות" },
];

const SOCIAL_TYPE_TEXT: Record<string, string> = {
  NEW_FOLLOWER: "התחיל/ה לעקוב אחריך",
  FRIEND_REQUEST: "שלח/ה לך בקשת חברות",
  FRIEND_ACCEPTED: "אישר/ה את בקשת החברות שלך",
  POST_LIKE: "אהב/ה את הפוסט שלך",
  POST_COMMENT: "הגיב/ה על הפוסט שלך",
  COMMENT_REPLY: "הגיב/ה לתגובה שלך",
};

function isSocialActivityKey(id: string): boolean {
  return id.startsWith("social_");
}

function toActivityItem(item: SocialNotificationItem): ActivityItem {
  const actionUrl =
    item.type === "FRIEND_REQUEST"
      ? "/places/friends/requests"
      : item.type === "POST_LIKE" || item.type === "POST_COMMENT"
        ? `/places/post/${item.targetId}`
        : item.actor.username
          ? `/places/profile/${item.actor.username}`
          : null;

  return {
    id: item.id,
    category: "system",
    priority: "normal",
    title: item.actor.fullName ?? item.actor.username ?? "מטייל",
    description: SOCIAL_TYPE_TEXT[item.type] ?? "",
    imageUrl: item.actor.avatarUrl,
    icon: "🔔",
    actionUrl,
    actionLabel: null,
    timestamp: item.createdAt,
    isRead: item.isRead,
  };
}

const PREFERENCES_REMINDER_ID = "pref_reminder";

export default function NotificationsPage() {
  const router = useRouter();
  const { preferences, preferencesLoading } = useAuth();
  const [tab, setTab] = useState<ActivityTab>("all");
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  async function load(currentTab: ActivityTab) {
    setError(false);
    setItems(null);
    try {
      if (currentTab === "all") {
        const [triplaceRes, socialRes] = await Promise.all([
          fetch(`/api/notifications?tab=all`).then((r) => (r.ok ? r.json() : Promise.reject())),
          fetch("/api/social/notifications").then((r) => (r.ok ? r.json() : Promise.reject())),
        ]);
        const triplaceItems: ActivityItem[] = triplaceRes.notifications ?? [];
        const socialItems: ActivityItem[] = (socialRes.notifications ?? []).map(toActivityItem);
        const merged = [...triplaceItems, ...socialItems].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setItems(merged);
      } else {
        const res = await fetch(`/api/notifications?tab=${currentTab}`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setItems(data.notifications ?? []);
      }
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /** *** תוספת (בקשה מפורשת - התראה קבועה עד השלמת ההתאמות האישיות) -
   *  אותו רעיון בדיוק כמו ב-PlacesNotificationBell, מוצגת רק בטאב "הכול". */
  const preferencesReminder: ActivityItem | null =
    tab === "all" && !preferencesLoading && !isPreferencesComplete(preferences)
      ? {
          id: PREFERENCES_REMINDER_ID,
          category: "system",
          priority: "important",
          title: "השלימו את ההתאמות האישיות שלכם",
          description: "כדי שנציע לכם המלצות מדויקות יותר",
          imageUrl: null,
          icon: "🎯",
          actionUrl: "/preferences",
          actionLabel: null,
          timestamp: new Date().toISOString(),
          isRead: false,
        }
      : null;

  const displayItems = items ? (preferencesReminder ? [preferencesReminder, ...items] : items) : items;
  const unreadCount = displayItems?.filter((i) => !i.isRead).length ?? 0;

  async function handleOpen(item: ActivityItem) {
    if (item.id === PREFERENCES_REMINDER_ID) {
      router.push(item.actionUrl ?? "/preferences");
      return;
    }
    if (!item.isRead) {
      setItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)) : prev));
      const readRequest = isSocialActivityKey(item.id)
        ? fetch("/api/social/notifications/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityKey: item.id }),
          })
        : fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" });
      readRequest.catch(() => {});
    }
    if (item.actionUrl) router.push(item.actionUrl);
  }

  async function handleMarkAllRead() {
    if (!items || unreadCount === 0) return;
    setMarkingAll(true);
    const unreadSocialKeys = items.filter((i) => !i.isRead && isSocialActivityKey(i.id)).map((i) => i.id);
    setItems((prev) => (prev ? prev.map((i) => ({ ...i, isRead: true })) : prev));
    try {
      await Promise.all([
        fetch("/api/notifications/read-all", { method: "POST" }),
        ...unreadSocialKeys.map((activityKey) =>
          fetch("/api/social/notifications/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ activityKey }),
          })
        ),
      ]);
    } catch {
      // כשל שקט - ה-state המקומי כבר עודכן, נטען מחדש בפעם הבאה בכל מקרה
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <HomeStatusBarTint />
      <CollapsibleTopBar onBack={() => router.push("/home")} />

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        <div>
          <h1 className="text-xl font-bold text-ink">מה חדש?</h1>
          <p className="text-sm text-ink-secondary">כל מה שחשוב לדעת על הטיולים שלכם</p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 gap-1.5 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-pill px-3.5 py-1.5 text-xs font-semibold transition ${
                  tab === t.id ? "text-white" : "bg-bg-secondary text-ink-secondary"
                }`}
                style={tab === t.id ? { background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" } : undefined}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {items !== null && unreadCount > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="text-xs font-semibold text-accent disabled:opacity-50"
            >
              סמן הכול כנקרא
            </button>
          </div>
        )}

        {items === null && !error && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm font-semibold text-ink">משהו השתבש</p>
            <p className="text-xs text-ink-secondary">לא הצלחנו לטעון את ההתראות שלכם.</p>
            <button
              type="button"
              onClick={() => load(tab)}
              className="rounded-pill px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              נסה שוב
            </button>
          </div>
        )}

        {displayItems !== null && !error && displayItems!.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-3xl">✨</span>
            <p className="text-sm font-semibold text-ink">הכול רגוע</p>
            <p className="text-xs text-ink-secondary">כרגע אין משהו חדש לעדכן אתכם.</p>
            <button
              type="button"
              onClick={() => router.push("/ai")}
              className="rounded-pill px-4 py-2 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              בואו נבנה טיול
            </button>
          </div>
        )}

        {displayItems !== null && !error && displayItems!.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {displayItems!.map((item) => (
              <NotificationCard key={item.id} item={item} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </div>

      <MainBottomNav active="home" />
    </Screen>
  );
}
