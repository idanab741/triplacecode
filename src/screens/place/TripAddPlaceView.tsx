import { PlaceHeroActions } from "./PlaceHeroActions";
import { PlaceNavigationCard } from "./PlaceNavigationCard";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { TripAddPlace } from "@/services/tripadd/tripAddPlaceService";

interface TripAddPlaceViewProps {
  place: TripAddPlace;
  savedCount: number;
}

/** סרט/סימנייה מלא - אותו איקון בדיוק כמו PlaceCommunityStatsSection.tsx
 *  הישן (עקביות ויזואלית), רק כאן לבד - בלי לב/אגודל-למטה, כי אין
 *  לייק/דיסלייק בסגנון TripMatch על מקומות TripAdd (בקשה מפורשת). */
function BookmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white">
      <path d="M6 2c-1.1 0-2 .9-2 2v18l8-3.5L20 22V4c0-1.1-.9-2-2-2H6z" />
    </svg>
  );
}

/**
 * *** גרסה מקבילה, עצמאית, ל-/place/[id]/page.tsx הישן - למקומות
 * שמקורם ב-tripadd_submissions (לא בטבלת places הישנה). לא ממוחזר
 * מהעמוד הישן במלואו כי הוא תלוי עמוק ב-TripMatch/מערכת ה-swiping
 * הישנה (trip_type_tags/cuisine_tags, PlaceCommunityStatsSection עם
 * לייק/דיסלייק) - שלא רלוונטית כאן. PlaceHeroActions ו-
 * PlaceNavigationCard כן גנריים לגמרי (מקבלים placeId/placeType כפרמטר)
 * ולכן כן ממוחזרים כמות שהם.
 */
export function TripAddPlaceView({ place, savedCount }: TripAddPlaceViewProps) {
  const categoryLabel = HOME_QUICK_CATEGORY_LABELS[place.category] ?? place.category;
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address ?? place.city ?? ""}`)}`;

  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="relative h-72 w-full bg-bg-secondary">
        <PlaceHeroActions placeId={place.id} placeName={place.name} placeType="tripadd" />
        {place.photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.photoUrls[0]} alt={place.name} className="h-full w-full object-cover" />
        )}
      </div>

      {/* *** גלריית תמונות נוספות - תוספת מעבר לעמוד הישן, כי כאן (בשונה
          מ-place.image_urls הישן) יכולות להיות כמה תמונות אמיתיות
          שמשתמשים שונים העלו, לא רק תמונה בודדת. מוצג רק אם יש יותר
          מתמונה אחת - אחרת מיותר (ה-HERO כבר מציג את היחידה). */}
      {place.photoUrls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pt-3" style={{ scrollbarWidth: "none" }}>
          {place.photoUrls.slice(1).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-5 px-5 pt-5">
        {(place.rating != null || place.googleRating != null) && (
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-ink">
            {place.rating != null && (
              <span className="flex items-center gap-1.5">
                <span className="text-amber-500">★</span>
                <span>{place.rating.toFixed(1)}</span>
                <span className="font-normal text-ink-secondary">
                  TripLace{place.reviewCount > 0 ? ` · ${place.reviewCount} ביקורות` : ""}
                </span>
              </span>
            )}
            {place.googleRating != null && (
              <span className="flex items-center gap-1.5">
                <span className="text-amber-500">★</span>
                <span>{place.googleRating.toFixed(1)}</span>
                <span className="font-normal text-ink-secondary">
                  Google{place.googleRatingCount != null ? ` · ${place.googleRatingCount}` : ""}
                </span>
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-ink">{place.name}</h1>
          {/* *** שינוי (בקשה מפורשת - "הביקורות מסודרות למטה"): כאן
              מוצג רק תיאור כללי (short_description, ממולא ע"י AI) -
              לא עוד place.description (זה היה בפועל הטקסט האישי של
              *מגיש אחד ספציפי*, לא תיאור כללי של המקום). הטקסט האישי
              של כל אחד עבר להיות ביקורת משלו, ר' סקציית "ביקורות" למטה. */}
          {place.shortDescription && <p className="text-sm leading-relaxed text-ink-secondary">{place.shortDescription}</p>}
          {(place.address || place.city) && (
            <p className="text-sm text-ink-secondary">{[place.address, place.city].filter(Boolean).join(" · ")}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
            {categoryLabel}
          </span>
          {place.subcategory && (
            <span className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
              {place.subcategory}
            </span>
          )}
          {place.accessible && (
            <span className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
              נגיש לנכים
            </span>
          )}
        </div>

        {/* *** "כמה שמרו" בלבד (בקשה מפורשת - "לא של tripmatch") -
            מוצג רק אם יש לפחות שמירה אחת, כדי שלא ייראה כמו "0 שמרו"
            על כל מקום חדש (אותו עיקרון כמו PlaceCommunityStatsSection
            הישן). */}
        {savedCount > 0 && (
          <div className="flex items-center gap-3 rounded-card border border-ink-secondary/10 bg-white p-4">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              <BookmarkIcon />
            </span>
            <p className="text-sm text-ink">
              <span className="font-extrabold">{savedCount}</span> {savedCount === 1 ? "משתמש שמר" : "משתמשים שמרו"} את המקום הזה
            </p>
          </div>
        )}

        <PlaceNavigationCard placeId={place.id} latitude={place.latitude} longitude={place.longitude} />

        {place.phone && (
          <a
            href={`tel:${place.phone}`}
            className="flex items-center justify-between rounded-card border border-ink-secondary/15 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📞</span>
              <span className="text-sm font-semibold text-ink">{place.phone}</span>
            </div>
            <span className="text-ink-secondary">›</span>
          </a>
        )}

        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-card border border-ink-secondary/15 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔗</span>
              <span className="truncate text-sm font-semibold text-ink">{place.website}</span>
            </div>
            <span className="text-ink-secondary">›</span>
          </a>
        )}

        {place.openingHours && place.openingHours.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-card border border-ink-secondary/15 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-ink">שעות פתיחה</p>
            {place.openingHours.map((line) => (
              <p key={line} className="text-xs text-ink-secondary">
                {line}
              </p>
            ))}
          </div>
        )}

        {place.googleRating != null && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-card border border-ink-secondary/15 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">דירוגי Google</span>
                <span className="text-xs text-ink-secondary">
                  {place.googleRating.toFixed(1)} ★
                  {place.googleRatingCount != null ? ` · ${place.googleRatingCount} ביקורות` : ""}
                </span>
              </div>
            </div>
            <span className="text-ink-secondary">›</span>
          </a>
        )}

        {/* *** ביקורות (בקשה מפורשת - "צריכות להיות רשומות למטה
            מסודרות"): כל השורות מ-tripadd_reviews של המקום הזה (ר'
            migration 0081) - כולל, אחרי איחוד מקומות כפולים, ביקורות
            שהצטברו מכמה הוספות נפרדות של אותו מקום פיזי. מסודרות
            מהחדשה לישנה (ר' ה-order ב-getTripAddPlaceById). בלי שם/
            זהות של אף כותב/ת - אותו עיקרון בדיוק כמו שאר האפליקציה
            (אף מקום לא חושף מי בדיוק כתב מה). */}
        {place.reviews.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold text-ink">ביקורות ({place.reviews.length})</p>
            <div className="flex flex-col gap-2.5">
              {place.reviews.map((review) => (
                <div key={review.id} className="flex flex-col gap-1.5 rounded-card border border-ink-secondary/10 bg-white p-4">
                  <div className="flex items-center justify-between">
                    {review.rating != null ? (
                      <div className="flex items-center gap-0.5" aria-hidden="true">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={n <= review.rating! ? "text-amber-500" : "text-ink-secondary/25"}>
                            ★
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    <span className="text-[11px] text-ink-secondary">
                      {new Date(review.createdAt).toLocaleDateString("he-IL")}
                    </span>
                  </div>
                  {review.description && <p className="text-sm leading-relaxed text-ink">{review.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}
