"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite, type PlaceType } from "@/services/favorites/favoritesService";
import { ShareToFriendsSheet } from "@/screens/places/ShareToFriendsSheet";

interface AttractionSaveShareRowProps {
  placeId: string;
  placeName: string;
  placeType?: PlaceType;
}

/**
 * *** חדש (בקשה מפורשת - "מתחת התמונה, שני כפתורים - שמירה ושיתוף"):
 * אותה לוגיקת שמירה/שיתוף בדיוק כמו PlaceHeroActions.tsx (לא ממציאים
 * API חדש) - רק כשורה מלאה-רוחב מתחת לתמונה, במקום overlay שקוף מעליה.
 * חזרה+פעמון עברו ל-AttractionTopBar הנפרד - הקומפוננטה הזו אחראית
 * אך ורק על שמירה/שיתוף מעכשיו.
 */
export function AttractionSaveShareRow({ placeId, placeName, placeType = "place" }: AttractionSaveShareRowProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justShared, setJustShared] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

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

  return (
    <div className="flex gap-2.5 px-5 pt-4">
      {user && (
        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="h-12 rounded-xl text-[15.5px] font-semibold flex flex-1 items-center justify-center gap-2 bg-[#EFF1F4] text-ink transition active:scale-[0.98] disabled:opacity-60"
        >
          <Image src={saved ? "/icons/save-active.png" : "/icons/save.png"} alt="" width={18} height={18} />
          {saved ? "נשמר" : "שמירה"}
        </button>
      )}
      <button
        type="button"
        onClick={handleShare}
        className="h-12 rounded-xl text-[15.5px] font-semibold flex flex-1 items-center justify-center gap-2 bg-[#EFF1F4] text-ink transition active:scale-[0.98]"
      >
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
    </div>
  );
}
