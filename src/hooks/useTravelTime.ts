"use client";

import { useEffect, useState } from "react";

/**
 * מחשב זמן נסיעה מהמיקום הנוכחי של המשתמש ליעד נתון.
 * אם המשתמש לא מאשר גישה למיקום, מחזיר null בשקט (בלי שגיאה).
 */
export function useTravelTime(destLat: number | null, destLng: number | null) {
  const [minutes, setMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (destLat == null || destLng == null || !("geolocation" in navigator)) {
      return;
    }

    let cancelled = false;

    (async () => {
      const position = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          () => resolve(null),
          { timeout: 5000 }
        );
      });

      if (cancelled) return;

      if (!position) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/places/travel-time", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originLat: position.coords.latitude,
            originLng: position.coords.longitude,
            destLat,
            destLng,
          }),
        });
        const data = await res.json();
        if (!cancelled) setMinutes(data.minutes ?? null);
      } catch {
        if (!cancelled) setMinutes(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destLat, destLng]);

  return { minutes, loading };
}
