"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PlaceRatingCard, type PlaceRatingCardReview } from "./PlaceRatingCard";

interface ReviewsSummary {
  averageRating: number | null;
  reviewCount: number;
  reviews: PlaceRatingCardReview[];
  myReview: { rating: number; comment: string | null } | null;
}

/** דירוגי TripLace למקום (עמוד ה-place הישן, טבלת places) - נפרד
 *  לגמרי מדירוגי Google (place.rating, שכבר שמורים מראש ולא דורשים
 *  קריאת רשת). התצוגה עצמה (PlaceRatingCard) משותפת עם עמוד ה-TripAdd,
 *  כדי ששני סוגי העמודים ייראו זהים - רק מקור הדאטה שונה. */
export function TripLaceRatingSection({ placeId }: { placeId: string }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/places/${placeId}/reviews`)
      .then((res) => res.json())
      .then((data: ReviewsSummary) => setSummary(data))
      .catch(() => {});
  }, [placeId]);

  async function handleSubmit(rating: number, comment: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${placeId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שמירת הדירוג נכשלה");
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת הדירוג נכשלה, נסו שוב");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PlaceRatingCard
      averageRating={summary?.averageRating ?? null}
      reviewCount={summary?.reviewCount ?? 0}
      reviews={summary?.reviews ?? []}
      myReview={summary?.myReview ?? null}
      canRate={!!user}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
