"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { BackButton, Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { NotificationCard } from "@/screens/notifications/NotificationCard";
import type { ActivityItem } from "@/services/notifications/notificationsService";

interface HomeHeaderProps {
  loading: boolean;
  /** *** חדש (בקשה מפורשת - "במקום הצ'אט, כשמתקדמים לעמוד הבא, שישתנה
   *  לכפתור חזור"): כשמועבר, כפתור הצ'אט מוחלף ב-BackButton של האפליקציה
   *  (בתוך אותו עיגול לבן כמו ההתראות). בלי - הצ'אט כמו תמיד. */
  onBack?: () => void;
}

/**
 * Header עליון של עמוד הבית: כפתור צ'אט עגול בצד שמאל (מוביל ל-Trippy AI,
 * /ai), הלוגו במרכז - **באותה שורה בדיוק, אותו גובה** כמו הצ'אט וההתראות
 * (בקשה מפורשת - קודם הלוגו ישב *מתחת* ל-header עם margin שלילי, לא
 * ממורכז אנכית איתם באמת) - וכפתור ההתראות הקיים בצד ימין, בדיוק כמו
 * קודם, בלי שינוי בלוגיקה שלו.
 *
 * *** שינוי (בקשה מפורשת - שדרוג ויזואלי של מסך הבית): תמונת הפרופיל
 * וכפתור בחירת המיקום ("המיקום שלי") הוסרו מה-header. הפרופיל עדיין
 * נגיש מ-BottomNav, ובחירת יעד/מיקום עברה לשורת החיפוש (SearchBarLink,
 * ר' home/page.tsx) - "קרוב אלי" שם מחליף את התפקיד שהיה לכפתור המיקום
 * כאן. שום דבר מה-Backend/API/לוגיקת ההתראות לא השתנה.
 */
export function HomeHeader({ loading, onBack }: HomeHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<ActivityItem[] | null>(null);
  const [notifError, setNotifError] = useState(false);
  const unreadCount = notifItems ? notifItems.filter((i) => !i.isRead).length : null;
  const popoverRef = useRef<HTMLDivElement>(null);

  function fetchNotifications() {
    setNotifError(false);
    fetch("/api/notifications?tab=all")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json();
      })
      .then((data) => {
        setNotifItems(data.notifications ?? []);
      })
      .catch(() => {
        setNotifError(true);
      });
  }

  // טעינה ראשונית - כדי שה-badge יהיה מוכן מיד, בלי לחכות ללחיצה על הפעמון.
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // סגירה בלחיצה מחוץ לבועה.
  useEffect(() => {
    if (!notifOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  function handleBellClick() {
    setNotifOpen((open) => !open);
  }

  async function handleOpenNotification(item: ActivityItem) {
    setNotifOpen(false);
    if (!item.isRead) {
      setNotifItems((prev) => (prev ? prev.map((i) => (i.id === item.id ? { ...i, isRead: true } : i)) : prev));
      try {
        const res = await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          console.error("[HomeHeader] סימון התראה כנקראה נכשל בפועל בשרת", data);
        }
      } catch {
        // כשל שקט (בעיית רשת) - ה-state המקומי כבר מציג "נקרא".
      }
    }
    if (item.actionUrl) router.push(item.actionUrl);
  }

  return (
    <header className="relative z-10 grid grid-cols-[40px_1fr_40px] items-center px-5 pt-3 pb-0">
      {/* כפתור CHAT - עיגול לבן עם אייקון הצ'אט של המוצר (אותו קובץ בדיוק
          שמשמש ב-PlacesHeader: /images/places-chat-icon.png - בקשה מפורשת:
          "הכפתור של הצ'אט יהיה כמו הצ'אט שלנו באייקונים"). מוביל ל-Trippy AI
          (/ai) כמו קודם, בלי route חדש. */}
      {onBack ? (
        // כפתור "חזור" (BackButton של האפליקציה) במקום הצ'אט - באותו עיגול לבן
        // ובאותו מקום בדיוק, כדי שהבר לא "יקפוץ" בין העמודים.
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(0,50,120,0.35)]">
          <BackButton onBack={onBack} />
        </div>
      ) : (
        <Link
          href="/ai"
          aria-label="צ'אט"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(0,50,120,0.35)]"
        >
          {loading ? (
            <Skeleton className="h-full w-full rounded-full" />
          ) : (
            <Image src="/images/places-chat-icon.png" alt="" width={22} height={20} className="object-contain" />
          )}
        </Link>
      )}

      {/* אמצע - לוגו TRIPLACE, באותה שורה ואותו גובה בדיוק כמו הצ'אט
          וההתראות (items-center על ה-header כבר מיישר אנכית). */}
      <div className="flex justify-center">
        {/* בקשה מפורשת - רקע כחול לאזור העליון: הלוגו השחור הופך ללבן
            (brightness(0) invert(1)) - בלי קובץ לוגו חדש.
            *** הוגדל ב-25% (בקשה מפורשת - "להגדיל מעט את הלוגו"): 120x37 ->
            150x46. -my-1 מקזז את הגובה הנוסף כדי שגובה ההדר לא יקפוץ. */}
        <Image
          src="/images/triplace-logo-black.png"
          alt="TRIPLACE"
          width={150}
          height={46}
          className="-my-1 object-contain"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>

      <div ref={popoverRef} className="relative justify-self-end">
        <button
          type="button"
          onClick={handleBellClick}
          aria-label="התראות"
          aria-expanded={notifOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_-4px_rgba(0,50,120,0.35)]"
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

        {notifOpen && (
          <div className="absolute left-0 top-full z-50 mt-2 w-[calc(100vw-2.5rem)] max-w-[360px] overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-black/5">
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {notifItems === null && !notifError && (
                <div className="flex flex-col gap-2 p-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              )}

              {notifError && (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <p className="text-xs text-ink-secondary">לא הצלחנו לטעון את ההתראות שלכם.</p>
                  <button type="button" onClick={fetchNotifications} className="text-xs font-semibold text-accent">
                    נסה שוב
                  </button>
                </div>
              )}

              {notifItems !== null && !notifError && notifItems.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 py-8 text-center">
                  <span className="text-2xl">✨</span>
                  <p className="text-xs font-semibold text-ink">הכול רגוע</p>
                  <p className="text-[11px] text-ink-secondary">כרגע אין משהו חדש לעדכן אתכם.</p>
                </div>
              )}

              {notifItems !== null && !notifError && notifItems.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {notifItems.map((item) => (
                    <NotificationCard key={item.id} item={item} onOpen={handleOpenNotification} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
