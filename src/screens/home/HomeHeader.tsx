"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Skeleton } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { listAddresses, type UserAddress } from "@/services/addresses/addressesService";
import { getAvatarUrl } from "@/constants/avatar";
import { ChooseLocationSheet } from "./ChooseLocationSheet";
import { LocationPromptModal } from "./LocationPromptModal";
import { NotificationCard } from "@/screens/notifications/NotificationCard";
import type { ActivityItem } from "@/services/notifications/notificationsService";

interface HomeHeaderProps {
  avatarUrl?: string | null;
  loading: boolean;
}

/** Header שקוף שיושב מעל אזור ה-Hero. */
export function HomeHeader({ avatarUrl, loading }: HomeHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  // *** נוסף (בקשה מפורשת - Popup "שינוי מיקום"): לחיצה על אזור המיקום
  // פותחת קודם את הרגע הממותג הזה ("איפה הטיול הבא שלך?") - ChooseLocationSheet
  // הקיים (עם כל לוגיקת החיפוש/הכתובות השמורות) עדיין נפתח בדיוק כמו
  // קודם, רק דרך "חיפוש יעד" בתוך ה-Popup החדש, לא ישירות מלחיצת הכפתור.
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  // *** תיקון (בקשת המשתמש - "לחצתי על השורה, זה עדיין מופיע!"):
  // קודם unreadCount היה state נפרד מ-notifItems, מעודכן ידנית בשני
  // מקומות שונים (fetchNotifications + handleOpenNotification) - כל
  // חוסר-סנכרון בין השניים (או ריענון מהשרת שמגיע ברגע לא נכון)
  // משאיר badge "תקוע" גם כשהפריט עצמו כבר מסומן כנקרא. עכשיו יש
  // מקור-אמת יחיד: unreadCount נגזר תמיד ישירות מ-notifItems, אף פעם
  // לא state נפרד - הם פיזית לא יכולים להתבדר.
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifItems, setNotifItems] = useState<ActivityItem[] | null>(null);
  const [notifError, setNotifError] = useState(false);
  const unreadCount = notifItems ? notifItems.filter((i) => !i.isRead).length : null;
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    listAddresses(supabase, user.id)
      .then((addresses) => {
        const active = addresses.find((a) => a.is_default) ?? addresses[0];
        if (active) setSelectedAddress(active);
      })
      .catch(() => {});
    // *** תיקון (בקשת המשתמש - "המספר עדיין נשאר!!!"): התלות הייתה
    // [user] (האובייקט השלם) - אבל supabase.auth.onAuthStateChange
    // (ב-AuthProvider.tsx) יורה מחדש בכל אירוע auth (למשל token
    // refresh, או חזרה למסך אחרי מעבר טאב/רקע) עם אובייקט user
    // *חדש* בכל פעם, גם כשזה אותו משתמש בדיוק. useEffect עם [user]
    // כתלות רץ מחדש בכל פעם שזה קורה - זה בדיוק מה שגרם ל-
    // fetchNotifications למטה לרוץ שוב ולדרוס את מצב ה"נקרא" המקומי
    // בכל פעם שהיה אירוע auth ברקע, בלי שום קשר ללחיצה בפועל. עכשיו
    // התלות היא user?.id (מחרוזת יציבה) - רץ מחדש רק כשבאמת מתחברים/
    // מתנתקים, לא בכל רענון טוקן.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
  // ר' ההערה למעלה - user?.id ולא user, מאותה סיבה בדיוק.
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // סגירה בלחיצה מחוץ לבועה (בנוסף ללחיצה נוספת על הפעמון עצמו, ר' onClick של הכפתור).
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

  // *** תיקון (אותה בקשה): לפני זה, כל פתיחה של הפעמון שלפה מחדש
  // מהשרת (fetchNotifications) - אם המשתמש פתח את הפעמון שוב ממש
  // מהר, זו הייתה עוד הזדמנות לריצת-מרוץ מול בקשת "סמן כנקרא" שעוד
  // לא הושלמה. עכשיו פשוט פותחים/סוגרים (toggle בלבד, בלי fetch) -
  // ה-state המקומי (notifItems) כבר מעודכן תמיד בזמן אמת (סימון
  // כנקרא הוא עדכון מקומי מיידי, ר' handleOpenNotification), וטעינה
  // ראשונית ממילא קורית בכל טעינת דף הבית (useEffect למעלה) - אין
  // צורך בעוד round-trip לשרת רק כדי לפתוח את הבועה.
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
        // כשל שקט (בעיית רשת) - ה-state המקומי כבר מציג "נקרא"; הפעם
        // הבאה שנטען מחדש מהשרת (רענון דף הבית) הוא עלול להחזיר "לא
        // נקרא" שוב אם השמירה בפועל נכשלה, אבל זו לא תקלה חוסמת.
      }
    }
    if (item.actionUrl) router.push(item.actionUrl);
  }

  return (
    <header className="relative z-10 grid grid-cols-[40px_1fr_40px] items-center px-5 pt-3 pb-0">
      <Link
        href="/profile"
        className="h-10 w-10 overflow-hidden rounded-full border-2 border-[var(--color-primary-start)] bg-bg"
      >
        {loading ? (
          <Skeleton className="h-full w-full rounded-full" />
        ) : (
          <img
            src={getAvatarUrl(avatarUrl)}
            alt="הפרופיל שלי"
            className="h-full w-full object-cover"
          />
        )}
      </Link>

      <button
        type="button"
        onClick={() => setLocationPromptOpen(true)}
        className="flex items-center justify-center gap-1 truncate text-sm font-medium text-ink"
      >
        <Image src="/icons/location.png" alt="" width={22} height={22} />
        {selectedAddress ? selectedAddress.label : "המיקום שלי"}
      </button>

      <div ref={popoverRef} className="relative">
        <button
          type="button"
          onClick={handleBellClick}
          aria-label="התראות"
          aria-expanded={notifOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-ink-secondary/15 bg-white/70 backdrop-blur-sm"
        >
          <Image src="/icons/bell.png" alt="" width={22} height={22} />
          {/* Badge - קטן, אלגנטי, לא משתלט על האייקון. 99+ מעל 99, לא מוצג אם 0/null. */}
          {unreadCount != null && unreadCount > 0 && (
            <span
              className="absolute -left-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
              style={{ background: "var(--color-primary-start)" }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* *** הבועה עצמה (בקשה מפורשת - "ממוקמת מתחת לפעמון... קומפקטית,
            נקייה ו-premium... Scroll פנימי... בלי Tabs/Filters/המלצות"):
            אותם NotificationCard/tokens עיצוביים בדיוק כמו עמוד
            /notifications (rounded-card, shadow-soft, bg/ink/accent) -
            שום עיצוב חדש, רק מארז popover סביב אותו תוכן. */}
        {notifOpen && (
          <div
            className="absolute left-0 top-full z-50 mt-2 w-[calc(100vw-2.5rem)] max-w-[360px] overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-black/5"
          >
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

      {locationPromptOpen && (
        <LocationPromptModal
          currentLocationLabel={selectedAddress ? selectedAddress.label : "המיקום שלי"}
          onClose={() => setLocationPromptOpen(false)}
          onSearchDestination={() => {
            setLocationPromptOpen(false);
            setLocationSheetOpen(true);
          }}
        />
      )}

      {locationSheetOpen && (
        <ChooseLocationSheet
          onClose={() => setLocationSheetOpen(false)}
          onSelect={(address) => {
            setSelectedAddress(address);
            setLocationSheetOpen(false);
          }}
        />
      )}
    </header>
  );
}