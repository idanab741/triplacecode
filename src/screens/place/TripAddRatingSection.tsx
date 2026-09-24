"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { PlaceRatingCard, type PlaceRatingCardReview } from "./PlaceRatingCard";
import type { TripAddPlace } from "@/services/tripadd/tripAddPlaceService";

interface TripAddRatingSectionProps {
  place: Pick<TripAddPlace, "id" | "rating" | "reviewCount" | "reviews">;
}

/** דירוגי TripLace למקום TripAdd (עמוד האטרקציה החדש) - אותה תצוגה
 *  בדיוק כמו TripLaceRatingSection (עמוד ה-place הישן), דרך אותה
 *  PlaceRatingCard משותפת - רק הדאטה כבר הגיעה מהשרת עם דף העמוד עצמו
 *  (place.rating/reviewCount/reviews, ר' getTripAddPlaceById) ולא
 *  נשלפת שוב בנפרד, ושליחת דירוג עוברת ל-API החדש של TripAdd
 *  (POST /api/tripadd/submissions/[id]/reviews) ואז מרעננת את העמוד
 *  (router.refresh()) כדי שהממוצע/הרשימה יתעדכנו ממקור האמת. */
export function TripAddRatingSection({ place }: TripAddRatingSectionProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviews: PlaceRatingCardReview[] = place.reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.description,
    createdAt: r.createdAt,
    author: r.userId ? { id: r.userId, name: r.userName, username: r.username, avatarUrl: r.avatarUrl } : null,
  }));

  async function handleSubmit(rating: number, comment: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tripadd/submissions/${place.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שמירת הדירוג נכשלה");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת הדירוג נכשלה, נסו שוב");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PlaceRatingCard
      averageRating={place.rating}
      reviewCount={place.reviewCount}
      reviews={reviews}
      myReview={null}
      canRate={!!user}
      submitting={submitting}
      error={error}
      onSubmit={handleSubmit}
    />
  );
}
