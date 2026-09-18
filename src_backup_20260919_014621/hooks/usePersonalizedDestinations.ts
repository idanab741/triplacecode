import { useEffect, useState } from "react";
import { getFeaturedDestinations } from "@/services/destinations/destinationsService";
import type { Destination } from "@/screens/home/HotDestinations";

/**
 * תיקון Product מפורש ("אני רוצה להעביר את מותאם בשבילך - לתוך עמוד
 * חופשה בחו''ל"): הלוגיקה **הועברה** (לא שוכפלה) מ-home/page.tsx לכאן -
 * אותה שאילתה בדיוק (getFeaturedDestinations - כל היעדים החמים,
 * בינלאומיים+ישראלים גם יחד, ללא סינון מדינה - זה ההבדל מ-
 * getIsraelHotDestinations שנוסף בעבר ל"חופשה בארץ") ואותו מנגנון
 * דירוג אישי (POST ל-/api/match/rank-destinations, לפי Travel DNA/
 * preferences של המשתמש) בדיוק כמו שהיה בדף הבית - שום שינוי בהתנהגות,
 * רק מיקום אחר בקוד.
 */
export function usePersonalizedDestinations(params: {
  isGuest: boolean;
  userId: string | undefined;
  preferencesComplete: boolean;
}) {
  const { isGuest, userId, preferencesComplete } = params;
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    getFeaturedDestinations().then((rows) => {
      setDestinations(
        rows
          .filter((row) => row.image_url)
          .map((row) => ({
            id: row.id,
            name: row.name,
            subtitle: row.country,
            imageUrl: row.image_url as string,
          }))
      );
    });
  }, []);

  useEffect(() => {
    if (isGuest || !userId || !preferencesComplete) return;
    if (destinations.length === 0 || personalized) return;

    let cancelled = false;

    fetch("/api/match/rank-destinations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationIds: destinations.map((d) => d.id) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.results) return;
        const scoreById = new Map(
          (data.results as { destination_id: string; score: number; reason: string }[]).map((r) => [
            r.destination_id,
            r,
          ])
        );
        setDestinations((prev) =>
          [...prev]
            .map((d) => {
              const match = scoreById.get(d.id);
              return match ? { ...d, matchScore: match.score, matchReason: match.reason } : d;
            })
            .sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
        );
        setPersonalized(true);
      })
      .catch(() => {
        // אם הדירוג נכשל, פשוט נשארים עם הסדר הכללי - המסך לא נשבר
      });

    return () => {
      cancelled = true;
    };
  }, [isGuest, userId, preferencesComplete, destinations, personalized]);

  return { destinations, personalized };
}
