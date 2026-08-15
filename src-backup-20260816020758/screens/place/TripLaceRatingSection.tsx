"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

interface PlaceReview {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface ReviewsSummary {
  averageRating: number | null;
  reviewCount: number;
  reviews: PlaceReview[];
  myReview: { rating: number; comment: string | null } | null;
}

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={n <= Math.round(rating) ? "#F59E0B" : "none"}
          stroke="#F59E0B"
          strokeWidth="1.5"
        >
          <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

/** בורר כוכבים אינטראקטיבי (1-5) - לחיצה על כוכב קובעת את הדירוג. */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} כוכבים`}
          className="flex h-9 w-9 items-center justify-center"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill={n <= value ? "#F59E0B" : "none"} stroke="#F59E0B" strokeWidth="1.5">
            <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** דירוגי TripLace למקום - נפרד לגמרי מדירוגי Google (place.rating, שכבר
 *  שמורים מראש ולא דורשים קריאת רשת). מציג ממוצע+כמות של דירוגי משתמשי
 *  TripLace, ומאפשר למשתמש המחובר לדרג (כוכבים 1-5 + טקסט חופשי). */
export function TripLaceRatingSection({ placeId }: { placeId: string }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(0);
  const [draftComment, setDraftComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/places/${placeId}/reviews`)
      .then((res) => res.json())
      .then((data: ReviewsSummary) => {
        setSummary(data);
        if (data.myReview) {
          setDraftRating(data.myReview.rating);
          setDraftComment(data.myReview.comment ?? "");
        }
      })
      .catch(() => {});
  }, [placeId]);

  async function handleSubmit() {
    if (draftRating < 1) {
      setError("בחרו דירוג בכוכבים לפני השליחה");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/places/${placeId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: draftRating, comment: draftComment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "שמירת הדירוג נכשלה");
      setSummary(data);
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת הדירוג נכשלה, נסו שוב");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ink-secondary/10 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image src="/images/triplace-logo-black.png" alt="" width={80} height={24} className="object-contain" />
          <span className="text-xs font-semibold text-ink-secondary">דירוגי TripLace</span>
        </div>
      </div>

      {summary && summary.reviewCount > 0 ? (
        <div className="flex items-center gap-2">
          <StarRow rating={summary.averageRating ?? 0} />
          <span className="text-sm font-bold text-ink">{summary.averageRating?.toFixed(1)}</span>
          <span className="text-xs text-ink-secondary">({summary.reviewCount} דירוגים)</span>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">עדיין אין דירוגי TripLace למקום הזה - היו הראשונים!</p>
      )}

      {user && (
        <>
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="self-start rounded-pill border border-ink-secondary/25 bg-white px-4 py-2 text-sm font-semibold text-ink"
            >
              {summary?.myReview ? "עריכת הדירוג שלי" : "דרגו את המקום הזה"}
            </button>
          ) : (
            <div className="flex flex-col gap-2 border-t border-ink-secondary/10 pt-3">
              <StarPicker value={draftRating} onChange={(n) => setDraftRating(n)} />
              <textarea
                value={draftComment}
                onChange={(e) => setDraftComment(e.target.value)}
                placeholder="ספרו בקצרה איך היה (לא חובה)"
                rows={3}
                className="w-full rounded-card border border-ink-secondary/25 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-secondary focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="rounded-pill py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))", flex: 1 }}
                >
                  {submitting ? "שולח..." : "שליחת דירוג"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-pill border border-ink-secondary/25 bg-white px-4 py-2.5 text-sm font-semibold text-ink"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {summary && summary.reviews.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-ink-secondary/10 pt-3">
          {summary.reviews.slice(0, 5).map((review) => (
            <div key={review.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <StarRow rating={review.rating} size={13} />
                <span className="text-xs text-ink-secondary">מטייל/ת ב-TripLace</span>
              </div>
              {review.comment && <p className="text-sm text-ink-secondary">{review.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
