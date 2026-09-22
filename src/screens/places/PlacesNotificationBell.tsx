"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Skeleton } from "@/components/ui";
import { NotificationCard } from "@/screens/notifications/NotificationCard";
import type { ActivityItem } from "@/services/notifications/notificationsService";
import type { SocialNotificationItem } from "@/services/social/socialNotificationsService";
import { useAuth } from "@/hooks/useAuth";
import { isPreferencesComplete } from "@/services/preferences/preferencesService";

const TYPE_TEXT: Record<string, string> = {
  NEW_FOLLOWER: "התחיל/ה לעקוב אחריך",
  FRIEND_REQUEST: "שלח/ה לך בקשת חברות",
  FRIEND_ACCEPTED: "אישר/ה את בקשת החברות שלך",
  POST_LIKE: "אהב/ה את הפוסט שלך",
  POST_COMMENT: "הגיב/ה על הפוסט שלך",
  COMMENT_REPLY: "הגיב/ה לתגובה שלך",
};

/** activity_key של התראות social תמיד מתחיל ב-"social_" (ר'
 *  socialNotificationsService) - זה המזהה הבטוח להבחין בין שני
 *  המקורות כשמסמנים "נקרא", בלי לשמור flag נפרד על כל item. */
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
    description: TYPE_TEXT[item.type] ?? "",
    imageUrl: item.actor.avatarUrl,
    icon: "🔔",
    actionUrl,
    actionLabel: null,
    timestamp: item.createdAt,
    isRead: item.isRead,
  };
}

/** פעמון מאוחד: אותה קומפוננטה/עיצוב/מיקום כמו ה-HomeHeader של triplace,
 *  אבל מציג יחד - ממוין לפי זמן - גם את ההתראות הקיימות של triplace
 *  (תזכורות טיול, הודעות Admin) וגם את ההתראות ה-social (עוקבים/
 *  לייקים/תגובות). זו אותה תשתית read/unread הקיימת (notification_reads)
 *  לשני הסוגים - לא כפילות. */
interface PlacesNotificationBellProps {
  /** true (בר place's הסגול): עיגול לבן מלא עם צל - בדיוק כמו הפעמון בבר של עמוד הבית. */
  solid?: boolean;
}

export function PlacesNotificationBell({ solid = false }: PlacesNotificationBellProps = {}) {
  const router = useRouter();
  const { preferences, preferencesLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  /** *** תוספת (בקשה מפורשת - "התראה קבועה לכל משתמש שנרשם, כל עוד
   *  ממלאים את ההתאמות האישיות"): לא מגיעה מה-DB - נבנית מקומית ומוצגת
   *  תמיד ראשונה כל עוד preferences.onboarding_completed_at ריק. מזהה
   *  קבוע (לא UUID אמיתי) כדי ש-handleOpenNotification ידע לזהות אותה
   *  ולדלג על קריאת "סימון כנקרא" ל-API (אין שורה אמיתית לסמן). */
  const PREFERENCES_REMINDER_ID = "pref_reminder";
  const preferencesReminder: ActivityItem | null =
    !preferencesLoading && !isPreferencesComplete(preferences)
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

  async function fetchNotifications() {
    setError(false);
    try {
      const [triplaceRes, socialRes] = await Promise.all([
        fetch("/api/notifications?tab=all").then((r) => (r.ok ? r.json() : Promise.reject())),
        fetch("/api/social/notifications").then((r) => (r.ok ? r.json() : Promise.reject())),
      ]);
      const triplaceItems: ActivityItem[] = triplaceRes.notifications ?? [];
      const socialItems: ActivityItem[] = (socialRes.notifications ?? []).map(toActivityItem);
      const merged = [...triplaceItems, ...socialItems].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setItems(merged);
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

  const displayItems = items ? (preferencesReminder ? [preferencesReminder, ...items] : items) : items;
  const unreadCount = displayItems ? displayItems.filter((i) => !i.isRead).length : null;

  async function handleOpenNotification(item: ActivityItem) {
    setOpen(false);
    // ההתראה הקבועה לא באה מה-DB - אין שורה אמיתית לסמן כנקרא, רק מנווטים.
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="התראות"
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
          solid
            ? "bg-white shadow-[0_4px_12px_-4px_rgba(50,10,120,0.45)]"
            : "border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
        }`}
      >
        <Image src="/icons/bell.png" alt="" width={22} height={22} className="h-[22px] w-[22px]" />
        {unreadCount != null && unreadCount > 0 && (
          <span
            className="absolute -left-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
            style={{ background: "var(--color-primary-start)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[calc(100vw-2.5rem)] max-w-[360px] overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-black/5">
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {items === null && !error && (
              <div className="flex flex-col gap-2 p-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-xs text-ink-secondary">לא הצלחנו לטעון את ההתראות שלכם.</p>
                <button type="button" onClick={fetchNotifications} className="text-xs font-semibold text-accent">
                  נסה שוב
                </button>
              </div>
            )}

            {items !== null && !error && displayItems!.length === 0 && (
              <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                <span className="text-2xl">✨</span>
                <p className="text-xs font-semibold text-ink">הכול רגוע</p>
                <p className="text-[11px] text-ink-secondary">כרגע אין משהו חדש לעדכן אתכם.</p>
              </div>
            )}

            {items !== null && !error && displayItems!.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {displayItems!.map((item) => (
                  <NotificationCard key={item.id} item={item} onOpen={handleOpenNotification} />
                ))}
              </div>
            )}

            {/* *** תוספת (בקשה מפורשת - "שורה מתחת להתראה האחרונה למעבר
                לעמוד ההתראות"): תמיד מוצגת אחרי טעינה מוצלחת. */}
            {items !== null && !error && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/notifications");
                }}
                className="mt-1 w-full rounded-card py-2.5 text-center text-[12.5px] font-semibold text-accent hover:bg-bg-secondary"
              >
                לכל ההתראות
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
