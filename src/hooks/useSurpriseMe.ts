"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";
import { getSessionLocation } from "@/utils/sessionLocation";

/**
 * הלוגיקה של "תפתיעו אותי" (בוחר מקום חם רנדומלי לפי המיקום ומנווט
 * ל-/place/[id]) - חולצה מ-SurpriseMeSection כדי שגם הבאנר בפס הקידום
 * בפיד (FeedPromoStrip) ירוץ על אותה לוגיקה בדיוק, בלי עותק.
 */
export function useSurpriseMe() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);

  const surprise = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      // המיקום כבר נשמר בעמוד הבית (utils/sessionLocation.ts) - משתמשים בו מיד,
      // בלי GPS חדש בכל לחיצה. נופלים ל-GPS רק אם אין מיקום שמור.
      const saved = getSessionLocation();
      const coords = saved ? { lat: saved.lat, lng: saved.lng } : await getCurrentPositionSafe();
      const res = await fetch(`/api/discovery/day-trip?category=hot&lat=${coords.lat}&lng=${coords.lng}&limit=15`);
      const data = await res.json();
      const places: { id: string }[] = data.places ?? [];
      if (places.length === 0) {
        router.push("/tripmatch");
        return;
      }
      const pick = places[Math.floor(Math.random() * places.length)];
      router.push(`/place/${pick.id}`);
    } catch {
      router.push("/tripmatch");
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [router]);

  return { surprise, loading };
}
