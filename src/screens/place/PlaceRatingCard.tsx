"use client";

import { useState } from "react";
import Link from "next/link";
import { getAvatarUrl } from "@/constants/avatar";

export interface PlaceRatingCardReview {
  id: string;
  rating: number | null;
  comment: string | null;
  createdAt: string;
  /** *** המדרג - תמונה + שם, ולחיצה מובילה לפרופיל שלו (בקשה מפורשת). */
  author?: { id: string; name: string | null; username: string | null; avatarUrl: string | null } | null;
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
 * *** חדש (בקשה מפורשת - "דירוג triplace... אחיד לכל העמודים"):
 * קומפוננטת-תצוגה משותפת לכל עמודי האטרקציה - לוגו TripLace בכותרת.
 * *** תיקון (בקשה מפורשת - "בדירוג של triplace לא צריך גם שיופיע
 * הלוגו של google! הוא מופיע בחלונית משלו"): לוגו Google הוסר מכאן -
 * הוא כבר מוצג בכרטיס נפרד ועצמאי (GoogleRatingCard), אין סיבה
 * שיופיע פעמיים.
 * *** תיקון (בקשה מפורשת - "הלוגו של triplace צריך להיות גדול
 * יותר!"): הלוגו הוגדל מ-18px ל-30px גובה.
 * ממוצע+כמות של דירוגי TripLace, וכפתור
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
    <div className="flex flex-col gap-3">

      {reviewCount > 0 ? (
        <div className="flex items-center gap-2">
          <StarRow rating={averageRating ?? 0} />
          <span className="text-[15px] font-bold text-ink">{averageRating?.toFixed(1)}</span>
          <span className="text-[13px] text-ink-secondary">({reviewCount} דירוגים)</span>
        </div>
      ) : (
        <p className="text-[15px] text-ink-secondary">עוד אין דירוגים של משתמשי triplace למקום הזה.</p>
      )}

      {canRate && (
        <>
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#EFF1F4] text-[15px] font-semibold text-ink transition active:scale-[0.98]"
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
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-secondary focus:border-ink focus:outline-none"
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={submitting || draftRating < 1}
                  onClick={() => onSubmit(draftRating, draftComment)}
                  className="h-11 flex-1 rounded-xl bg-ink text-[15px] font-semibold text-white disabled:opacity-40"
                >
                  {submitting ? "שולח..." : "שליחת דירוג"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="h-11 rounded-xl bg-[#EFF1F4] px-5 text-[15px] font-semibold text-ink"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {reviews.length > 0 && (
        <div className="flex flex-col">
          {reviews.slice(0, 10).map((review) => (
            <div key={review.id} className="flex flex-col gap-2 border-t border-black/[0.06] py-3.5">
              <div className="flex items-center gap-3">
                {review.author ? (
                  <Link
                    href={`/places/profile/${encodeURIComponent(review.author.username ?? review.author.id)}`}
                    className="flex min-w-0 flex-1 items-center gap-3 transition-opacity active:opacity-70"
                  >
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#EFF1F4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getAvatarUrl(review.author.avatarUrl)} alt="" className="h-full w-full object-cover" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-ink">{review.author.name ?? "מטייל/ת"}</span>
                      <span className="flex items-center gap-1.5">
                        {review.rating != null && <StarRow rating={review.rating} size={13} />}
                        <span className="text-[13px] text-ink-secondary">
                          {new Date(review.createdAt).toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
                        </span>
                      </span>
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2">
                    {review.rating != null && <StarRow rating={review.rating} size={13} />}
                    <span className="text-[13px] text-ink-secondary">
                      {new Date(review.createdAt).toLocaleDateString("he-IL", { month: "long", year: "numeric" })}
                    </span>
                  </span>
                )}
              </div>
              {review.comment && <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{review.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
