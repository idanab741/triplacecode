"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite } from "@/services/favorites/favoritesService";
import { WHITE_ICON_FILTER } from "@/screens/layout/TripHeroHeader";

interface PlaceHeroActionsProps {
  placeId: string;
  placeName: string;
}

/**
 * בר פעולות - לוגו+חזרה משמאל, שמירה+שיתוף מימין - נשארים באותו מקום
 * בדיוק כמו קודם.
 *
 * *** תיקון (בקשה מפורשת - "בעמודים של היעדים/אטרקציות ואתרים... שכפתור
 * החזור והשיתוף יהיה למעלה באותו מקום בדיוק. המטרה להעלים את הלבן של
 * הבר העליון - שהכל יהיה שקוף"): לפני זה זה היה `<header>` עצמאי,
 * sticky, עם רקע לבן (bg-white shadow-sm), יושב **מעל** תמונת ה-HERO
 * בזרימת העמוד הרגילה (לא חופף אותה). עכשיו: בלי רקע/sticky בכלל -
 * רק שני קבוצות הכפתורים ב-position absolute, כדי שההורה (place/[id]/
 * page.tsx) יוכל למקם את זה **בתוך** קונטיינר ה-HERO עצמו (relative),
 * חופף את התמונה לגמרי - "הבר הלבן" נעלם כי אין יותר רקע נפרד. אותו
 * WHITE_ICON_FILTER (brightness-0 invert + drop-shadow) כמו ב-
 * TripHeroHeader.tsx, לקריאות מעל כל תמונה, כהה או בהירה.
 */
export function PlaceHeroActions({ placeId, placeName }: PlaceHeroActionsProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justShared, setJustShared] = useState(false);

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
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1500);

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
    <div className="absolute inset-x-0 top-0 z-30 h-16">
      <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
        <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className={`object-contain ${WHITE_ICON_FILTER}`} />
        <button
          type="button"
          onClick={() => window.history.back()}
          className="flex h-10 w-10 shrink-0 items-center justify-center"
          aria-label="חזרה"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
          >
            <path d="m14 6-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {user && (
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            aria-label={saved ? "הסרה משמורים" : "שמירה"}
            className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-60"
          >
            <Image src={saved ? "/icons/save-active.png" : "/icons/save.png"} alt="" width={23} height={23} className={WHITE_ICON_FILTER} />
          </button>
        )}
        <button
          type="button"
          onClick={handleShare}
          aria-label="שיתוף"
          className="flex h-10 w-10 items-center justify-center rounded-full"
        >
          <Image src={justShared ? "/icons/share-active.png" : "/icons/share.png"} alt="" width={26} height={26} className={WHITE_ICON_FILTER} />
        </button>
      </div>
    </div>
  );
}
