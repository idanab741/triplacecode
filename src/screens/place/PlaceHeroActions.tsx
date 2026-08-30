"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import {
  getFavoriteStatus,
  toggleFavorite,
  type PlaceType,
} from "@/services/favorites/favoritesService";
import { WHITE_ICON_FILTER } from "@/screens/layout/TripHeroHeader";

interface PlaceHeroActionsProps {
  placeId: string;
  placeName: string;
  placeType?: PlaceType;
  backHref?: string;
}

export function PlaceHeroActions({
  placeId,
  placeName,
  placeType = "place",
  backHref,
}: PlaceHeroActionsProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justShared, setJustShared] = useState(false);

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

      const status = await toggleFavorite(
        supabase,
        user.id,
        placeId,
        placeType,
        "saved"
      );

      setSaved(status === "saved");
    } catch {
      setSaved((s) => !s);
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
        await navigator.share({
          title: placeName,
          url,
        });
      } catch {
        // המשתמש ביטל את השיתוף
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <header className="absolute inset-x-0 top-0 z-30 w-full">
      <div className="relative flex h-16 items-center justify-center px-2">

        {/* חזור — אותו מיקום כמו בעמודי סוגי הטיול */}
        <button
          type="button"
          onClick={() => {
            if (backHref) {
              window.location.href = backHref;
            } else {
              window.history.back();
            }
          }}
          aria-label="חזרה"
          className="absolute left-2 flex h-10 w-10 shrink-0 items-center justify-center"
        >
          <svg
            width="26"
            height="26"
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

        {/* לוגו — 140x43 ובמרכז אמיתי */}
        <Image
          src="/images/triplace-logo-black.png"
          alt=""
          width={140}
          height={43}
          className={`object-contain ${WHITE_ICON_FILTER}`}
        />

        {/* שמירה + שיתוף — צד ימין */}
        <div className="absolute right-2 flex items-center gap-1">

          {user && (
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              aria-label={saved ? "הסרה משמורים" : "שמירה"}
              className="flex h-10 w-10 shrink-0 items-center justify-center disabled:opacity-60"
            >
              <Image
                src={saved ? "/icons/save-active.png" : "/icons/save.png"}
                alt=""
                width={23}
                height={23}
                className={WHITE_ICON_FILTER}
              />
            </button>
          )}

          <button
            type="button"
            onClick={handleShare}
            aria-label="שיתוף"
            className="flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <Image
              src={
                justShared
                  ? "/icons/share-active.png"
                  : "/icons/share.png"
              }
              alt=""
              width={26}
              height={26}
              className={WHITE_ICON_FILTER}
            />
          </button>

        </div>
      </div>
    </header>
  );
}