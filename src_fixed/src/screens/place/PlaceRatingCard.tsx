"use client";

import { useState } from "react";
import Image from "next/image";

export interface PlaceRatingCardReview {
  id: string;
  rating: number | null;
  comment: string | null;
  createdAt: string;
}

interface PlaceRatingCardProps {
  averageRating: number | null;
  reviewCount: number;
  reviews: PlaceRatingCardReview[];
  /** הדירוג הקיים של המשתמש המחובר, אם כבר דירג - טוען את הטופס עם הערכים שלו. */
  myReview?: { rating: number; comment: string | null } | null;
  /** false = משתמש לא מחובר - מציגים רק את התצוגה, בלי כפתור "דרגו". */
  canRate: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: (rating: number, comment: string) => void;
}

function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" fill={n <= Math.round(rating) ? "#F59E0B" : "none"} stroke="#F59E0B" strokeWidth="1.5">
          <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5z" />
        </svg>
      ))}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} כוכבים`} className="flex h-9 w-9 items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill={n <= value ? "#F59E0B" : "none"} stroke="#F59E0B" strokeWidth="1.5">
            <path d="M12 2.5l2.9 6.1 6.6.7-4.9 4.5 1.3 6.6L12 17l-5.9 3.4 1.3-6.6-4.9-4.5 6.6-.7L12 2.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/**
 * *** חדש (בקשה מפורשת - "דירוג triplace, עם הלוגואים של triplace
 * וגוגל... אחיד לכל העמודים"): קומפוננטת-תצוגה משותפת לכל עמודי
 * האטרקציה - לוגו TripLace **וגם** לוגו Google יחד בכותרת (בדיוק
 * הרעיון שכבר היה בשורת הדירוגים העליונה הישנה של TripAddPlaceView,
 * רק כאן כחלק מהכרטיס האחיד), ממוצע+כמות של דירוגי TripLace, וכפתור
 * "דרגו את המקום הזה" (עם טופס כוכבים+טקסט) לכל משתמש מחובר. הקומפוננטה
 * עצמה לא יודעת מאיפה מגיע הדאטה (places הישן / tripadd החדש) - זו
 * אחריות ה-caller (TripLaceRatingSection / TripAddRatingSection),
 * כדי שהעיצוב יהיה זהה ב-100% בין שני סוגי העמודים.
 */
export function PlaceRatingCard({ averageRating, reviewCount, reviews, myReview, canRate, submitting, error, onSubmit }: PlaceRatingCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [draftRating, setDraftRating] = useState(myReview?.rating ?? 0);
  const [draftComment, setDraftComment] = useState(myReview?.comment ?? "");

  return (
    <div className="flex flex-col gap-3 rounded-card border border-ink-secondary/10 bg-white p-4">
      <div className="flex items-center gap-2.5">
        <Image src="/images/triplace-logo-black.png" alt="TripLace" width={80} height={24} className="h-[18px] w-auto object-contain" />
        <span className="h-4 w-px bg-ink-secondary/20" />
        <Image src="/images/google-logo.png" alt="Google" width={200} height={70} className="h-[18px] w-auto object-contain" />
      </div>

      {reviewCount > 0 ? (
        <div className="flex items-center gap-2">
          <StarRow rating={averageRating ?? 0} />
          <span className="text-sm font-bold text-ink">{averageRating?.toFixed(1)}</span>
          <span className="text-xs text-ink-secondary">({reviewCount} דירוגים)</span>
        </div>
      ) : (
        <p className="text-sm text-ink-secondary">עדיין אין דירוגי TripLace למקום הזה - היו הראשונים!</p>
      )}

      {canRate && (
        <>
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="self-start rounded-pill border border-ink-secondary/25 bg-white px-4 py-2 text-sm font-semibold text-ink"
            >
              {myReview ? "עריכת הדירוג שלי" : "דרגו את המקום הזה"}
            </button>
          ) : (
            <div className="flex flex-col gap-2 border-t border-ink-secondary/10 pt-3">
              <StarPicker value={draftRating} onChange={setDraftRating} />
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
                  disabled={submitting || draftRating < 1}
                  onClick={() => onSubmit(draftRating, draftComment)}
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

      {reviews.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-ink-secondary/10 pt-3">
          {reviews.slice(0, 5).map((review) => (
            <div key={review.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {review.rating != null && <StarRow rating={review.rating} size={13} />}
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
