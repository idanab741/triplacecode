"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite } from "@/services/favorites/favoritesService";

interface PlaceHeroActionsProps {
  placeId: string;
  placeName: string;
}

/** חזרה (שמאל) + שמירה/שיתוף (ימין), מוצגות מעל ה-HERO. חזרה היא תמיד
 *  router.back() - כך שהעמוד עובד נכון גם כשמגיעים אליו מ-TripMatch,
 *  מחיפוש, או מכל מקום אחר, בלי יעד חזרה קשיח. */
export function PlaceHeroActions({ placeId, placeName }: PlaceHeroActionsProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    getFavoriteStatus(supabase, user.id, placeId).then((status) => setSaved(status === "saved"));
  }, [user, placeId]);

  async function handleSave() {
    if (!user || busy) return;
    setBusy(true);
    setSaved((s) => !s); // אופטימי - מרגיש מיידי
    try {
      const supabase = createClient();
      const status = await toggleFavorite(supabase, user.id, placeId, "place", "saved");
      setSaved(status === "saved");
    } catch {
      setSaved((s) => !s); // rollback אם נכשל
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: placeName, url });
      } catch {
        // המשתמש ביטל את השיתוף - לא שגיאה אמיתית
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="חזרה"
        className="absolute start-4 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-soft"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2">
          <path d="m14 6-6 6 6 6" />
        </svg>
      </button>

      <div className="absolute end-4 top-6 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleShare}
          aria-label="שיתוף"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-soft"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 3.9M15.4 6.6L8.6 10.5" />
          </svg>
        </button>
        {user && (
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            aria-label={saved ? "הסרה משמורים" : "שמירה"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-soft disabled:opacity-60"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={saved ? "var(--color-accent)" : "none"} stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12v18l-6-4-6 4V3z" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
}
