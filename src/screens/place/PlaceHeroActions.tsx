"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite } from "@/services/favorites/favoritesService";

interface PlaceHeroActionsProps {
  placeId: string;
  placeName: string;
}

/** לוגו + חזרה (בצד ה-start) ו-שמירה/שיתוף (בצד ה-end) - באותו סגנון בדיוק
 *  כמו header ה-HERO בעמוד תוצאת "חופשה בחו״ל" (trip-builder/abroad-vacation/result). */
export function PlaceHeroActions({ placeId, placeName }: PlaceHeroActionsProps) {
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
      <div className="absolute left-2 top-4 flex items-center gap-2">
        <Image src="/images/trip-tripmatch-logo.png" alt="" width={130} height={40} className="object-contain" />
        <button type="button" onClick={() => window.history.back()} className="flex h-9 w-9 shrink-0 items-center justify-center text-ink" aria-label="חזרה">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="absolute right-2 top-4 flex items-center gap-2">
        {user && (
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            aria-label={saved ? "הסרה משמורים" : "שמירה"}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/70 backdrop-blur-sm disabled:opacity-60"
          >
            {saved ? "✓" : <Image src="/icons/save.png" alt="" width={20} height={20} />}
          </button>
        )}
        <button
          type="button"
          onClick={handleShare}
          aria-label="שיתוף"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/70 backdrop-blur-sm"
        >
          <Image src="/icons/share.png" alt="" width={24} height={24} style={{ transform: "translate(1px, 1px)" }} />
        </button>
      </div>
    </>
  );
}
