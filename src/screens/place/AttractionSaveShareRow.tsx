"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite, type PlaceType } from "@/services/favorites/favoritesService";
import { ShareToFriendsSheet } from "@/screens/places/ShareToFriendsSheet";
import { AddToCalendarSheet, type CalendarEntryRef } from "@/screens/calendar/AddToCalendarSheet";
import { AddToSheet } from "@/screens/collections/AddToSheet";

interface AttractionSaveShareRowProps {
  placeId: string;
  placeName: string;
  placeType?: PlaceType;
  /** לגיליון "ליומן": תמונה + קטגוריה (לאייקון סוג הטיול ביומן). */
  imageUrl?: string | null;
  category?: string | null;
}

function CalendarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill={filled ? "currentColor" : "none"} />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke={filled ? "#fff" : "currentColor"} />
    </svg>
  );
}

/**
 * *** חדש (בקשה מפורשת - "מתחת התמונה, שני כפתורים - שמירה ושיתוף"):
 * אותה לוגיקת שמירה/שיתוף בדיוק כמו PlaceHeroActions.tsx (לא ממציאים
 * API חדש) - רק כשורה מלאה-רוחב מתחת לתמונה, במקום overlay שקוף מעליה.
 * חזרה+פעמון עברו ל-AttractionTopBar הנפרד - הקומפוננטה הזו אחראית
 * אך ורק על שמירה/שיתוף מעכשיו.
 */
export function AttractionSaveShareRow({ placeId, placeName, placeType = "place", imageUrl = null, category = null }: AttractionSaveShareRowProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** *** חדש (בקשה מפורשת - "היומן שלי: להכניס בית קפה / אטרקציה מסוימת"): כפתור "ליומן" שלישי. */
  const [calendarEntry, setCalendarEntry] = useState<CalendarEntryRef | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  /** *** בקשה מפורשת ("להוסיף מקום למפה / לטיול קיימים"): "הוספה ל..." - המפות והטיולים שלי. */
  const [addToOpen, setAddToOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/places/calendar?placeId=${encodeURIComponent(placeId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { entry?: CalendarEntryRef | null } | null) => setCalendarEntry(d?.entry ?? null))
      .catch(() => {});
  }, [user, placeId]);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    getFavoriteStatus(supabase, user.id, placeId).then((status) => {
      setSaved(status === "saved");
    });
  }, [user, placeId]);

  async function handleSave() {
    if (!user || busy) return;
    setBusy(true);
    setSaved((s) => !s);
    try {
      const supabase = createClient();
      const status = await toggleFavorite(supabase, user.id, placeId, placeType, "saved");
      setSaved(status === "saved");
    } catch {
      setSaved((s) => !s);
    } finally {
      setBusy(false);
    }
  }

  /**
   * *** בקשה מפורשת ("למה אי אפשר לשלוח בתוך האפליקציה לחברים ומשתמשים?"):
   * משתמש מחובר - נפתח גיליון השליחה לחברים (אותו גיליון בדיוק כמו בפוסטים), ומשם גם
   * "עוד" לשיתוף חיצוני ו"קישור". אורח (לא מחובר) - אין לו צ'אט, אז שיתוף המכשיר כמו קודם.
   */
  async function handleShare() {
    if (user) {
      setShareOpen(true);
      return;
    }
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1500);
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: placeName, url });
      } catch {
        // המשתמש ביטל את השיתוף
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  // 4 כפתורים בשורה - טקסט מעט קטן יותר כדי שייכנסו גם בטלפון צר
  const btn =
    "flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#EFF1F4] px-1 text-[14.5px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-60";

  return (
    <div className="flex gap-2 px-5 pt-4">
      {user && (
        <button type="button" onClick={handleSave} disabled={busy} className={btn}>
          <Image src={saved ? "/icons/save-active.png" : "/icons/save.png"} alt="" width={18} height={18} />
          {saved ? "נשמר" : "שמירה"}
        </button>
      )}
      {user && (
        <button type="button" onClick={() => setCalendarOpen(true)} className={btn} style={calendarEntry ? { color: "#0A6DFE" } : undefined}>
          <CalendarIcon filled={!!calendarEntry} />
          {calendarEntry ? "ביומן" : "ליומן"}
        </button>
      )}
      {user && (
        <button type="button" onClick={() => setAddToOpen(true)} className={btn} aria-label="הוספה למפה או לטיול">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          הוספה
        </button>
      )}
      <button type="button" onClick={handleShare} className={btn}>
        <Image src={justShared ? "/icons/share-active.png" : "/icons/share.png"} alt="" width={20} height={20} />
        {justShared ? "הועתק!" : "שיתוף"}
      </button>

      {shareOpen && (
        <ShareToFriendsSheet
          options={[{ label: "המקום", target: { kind: "place", id: placeId } }]}
          externalShareTitle={placeName}
          onClose={() => setShareOpen(false)}
        />
      )}

      {addToOpen && <AddToSheet ids={[placeId]} label={placeName} onClose={() => setAddToOpen(false)} />}

      {calendarOpen && (
        <AddToCalendarSheet
          item={{ itemType: "place", id: placeId, name: placeName, imageUrl, category }}
          entry={calendarEntry ?? undefined}
          onClose={() => setCalendarOpen(false)}
          onDone={(r) => {
            setCalendarOpen(false);
            if (r.action === "removed") {
              setCalendarEntry(null);
              return;
            }
            // טוענים מחדש את הפריט (כולל המזהה החדש) - כך לחיצה נוספת פותחת אותו לעריכה.
            fetch(`/api/places/calendar?placeId=${encodeURIComponent(placeId)}`)
              .then((res) => (res.ok ? res.json() : null))
              .then((d: { entry?: CalendarEntryRef | null } | null) => setCalendarEntry(d?.entry ?? null))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
