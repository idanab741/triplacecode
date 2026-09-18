"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Skeleton } from "@/components/ui";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { NotificationCard } from "@/screens/notifications/NotificationCard";
import type { ActivityItem, ActivityTab } from "@/services/notifications/notificationsService";

/**
 * *** תכונה חדשה (MASTER PROMPT - מרכז פעילות/התראות): "מה חדש?" - לא
 * "Notifications"/"מרכז התראות" (בכוונה, ר' סעיף 4 בפרומפט). נשאר בתוך
 * ה-Bottom Nav הראשי (MainBottomNav, בלי טאב חדש) - הפעמון ב-Home הוא
 * ה-entry point היחיד (ר' HomeHeader.tsx).
 */

const TABS: { id: ActivityTab; label: string }[] = [
  { id: "all", label: "הכול" },
  { id: "trips", label: "הטיולים שלי" },
  { id: "system", label: "מערכת" },
  { id: "recommendations", label: "המלצות" },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ActivityTab>("all");
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  function load(currentTab: ActivityTab) {
    setError(false);
    setItems(null);
    fetch(`/api/notifications?tab=${currentTab}`)
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => setItems(data.notifications ?? []))
      .catch(() => setError(true));
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const unreadCount = items?.filter((i) => !i.isRead).length ?? 0;

  async function handleOpen(item: ActivityItem) {
    if (!item.isRead) {
      setItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)) : prev));
      fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" }).catch(() => {});
    }
    if (item.actionUrl) router.push(item.actionUrl);
  }

  async function handleMarkAllRead() {
    if (!items || unreadCount === 0) return;
    setMarkingAll(true);
    setItems((prev) => (prev ? prev.map((i) => ({ ...i, isRead: true })) : prev));
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // כשל שקט - ה-state המקומי כבר עודכן, נטען מחדש בפעם הבאה בכל מקרה
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <SimpleAppHeader onBack={() => router.push("/home")} title="מה חדש?" />

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        <div>
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

        {items !== null && !error && items.length === 0 && (
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

        {items !== null && !error && items.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {items.map((item) => (
              <NotificationCard key={item.id} item={item} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </div>

      <MainBottomNav active="home" />
    </Screen>
  );
}
