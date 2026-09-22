import { AttractionTopBar } from "./AttractionTopBar";
import { AttractionSaveShareRow } from "./AttractionSaveShareRow";
import { PlaceNavigationCard } from "./PlaceNavigationCard";
import { GoogleRatingCard } from "./GoogleRatingCard";
import { TripAddRatingSection } from "./TripAddRatingSection";
import { MainBottomNav } from "@/components/MainBottomNav";
import { Icon } from "@/components/ui/Icon";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import { HOME_QUICK_CATEGORIES } from "@/constants/homeQuickCategories";
import { parseOpeningHoursForDay, minutesToTimeLabel } from "@/utils/openingHours";
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
 * הישנה - לא רלוונטית כאן.
 *
 * *** עיצוב-מחדש מלא (בקשה מפורשת - "צריך להיות אחיד לכל העמודים של
 * האטרקציות! ... בר עליון בצבע תכלת (עם כפתורי חזור ופעמון בצדדים) /
 * מתחת התמונה / מתחת שני כפתורים - שמירה ושיתוף / מתחת שם האטרקציה,
 * מיקום, תיאור / מתחת הקטגוריות / מתחת מפה, מעל המפה מרחק מהבית,
 * מתחתיה גוגל מאפס ו-Waze / מתחת דירוג גוגל / דירוג triplace עם
 * הלוגואים + כפתור 'דרגו את המקום הזה'"): הסדר הזה משותף עכשיו, מילה
 * במילה, עם /place/[id]/page.tsx (עמוד ה-place הישן) - דרך אותן
 * קומפוננטות בדיוק (AttractionTopBar/AttractionSaveShareRow/
 * GoogleRatingCard/PlaceRatingCard), כך ששני סוגי העמודים נראים
 * זהים לחלוטין מנקודת המבט של המשתמש, גם אם מקור הדאטה שונה מתחת
 * למכסה המנוע (places הישנה מול tripadd_submissions).
 */
export function TripAddPlaceView({ place, savedCount }: TripAddPlaceViewProps) {
  const categoryLabel = HOME_QUICK_CATEGORY_LABELS[place.category] ?? place.category;
  const categoryIconSrc = HOME_QUICK_CATEGORIES.find((c) => c.id === place.category)?.imageSrc ?? null;
  const googleReviewsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.address ?? place.city ?? ""}`)}`;

  // *** אותה לוגיקת פתוח/סגור בדיוק כמו PlaceMapPopupCard.tsx - שים
  // לב: opening_hours כמעט תמיד null היום ב-tripadd_submissions (לא
  // מולא ע"י שום תהליך enrichment קיים כרגע) - השורה הזו פשוט לא
  // תוצג עד שזה יתווסף, לא באג בקומפוננטה עצמה.
  const today = parseOpeningHoursForDay(place.openingHours, new Date().getDay());
  const isOpen = today === "closed" ? false : today ? isWithinToday(today) : null;
  const hoursLabel =
    today && today !== "closed" ? `${minutesToTimeLabel(today.openMinutes)}–${minutesToTimeLabel(today.closeMinutes)}` : null;

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* 1. בר עליון תכלת - חזור + לוגו + פעמון (הבר התקני של triplace,
          כמו HomeHeader/PlacesHeaderRow) - יושב *מעל* ה-HERO, לא כ-overlay שקוף עליו */}
      <AttractionTopBar />

      {/* 2. תמונת HERO - מוזזת מעט למעלה ומאחורי הבר (ר' הסבר ב-page.tsx
          התאום) כדי שתמלא את פינות העיגול המעוגלות של הבר מלמטה. */}
      <div className="relative z-0 -mt-8 h-72 w-full bg-bg-secondary">
        {place.photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.photoUrls[0]} alt={place.name} className="h-full w-full object-cover" />
        )}
      </div>

      {/* 3. שמירה + שיתוף */}
      <AttractionSaveShareRow placeId={place.id} placeName={place.name} placeType="tripadd" />

      {/* גלריית תמונות נוספות שאנשים מעלים - כל התמונות שהצטברו מכל
          הביקורות על המקום הזה (לא רק ממי שיצר אותו). מוצג רק אם יש
          יותר מתמונה אחת. */}
      {place.photoUrls.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-5 pt-3" style={{ scrollbarWidth: "none" }}>
          {place.photoUrls.slice(1).map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-5 px-5 pt-5">
        {/* 4. שם + מיקום + תיאור */}
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center justify-end gap-1.5 text-right text-2xl font-extrabold text-ink">
            {(place.googleMatchStatus === "matched" || place.googleMatchStatus === "manual") && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--color-category-green)" }}
                title="התאמה מאומתת ל-Google"
              />
            )}
            <span dir="rtl">{place.name}</span>
          </h1>

          <div className="flex flex-wrap items-center justify-end gap-2 text-right text-sm">
            {isOpen != null && (
              <span className="flex shrink-0 items-center gap-1.5">
                {hoursLabel && <span className="text-ink-secondary">{hoursLabel}</span>}
                <span className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-[var(--color-category-green)]" : "bg-danger"}`} />
                <span className={`font-semibold ${isOpen ? "text-[var(--color-category-green)]" : "text-danger"}`}>
                  {isOpen ? "פתוח עכשיו" : "סגור עכשיו"}
                </span>
              </span>
            )}
            {isOpen != null && (place.address || place.city) && <span className="h-3.5 w-px shrink-0 bg-ink-secondary/20" />}
            {(place.address || place.city) && (
              <span className="flex items-center gap-1 text-ink-secondary">
                <Icon name="location-pin" size={12} className="shrink-0 opacity-70" />
                {[place.address, place.city].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>

          {/* תיאור כללי (short_description, ממולא ע"י AI) - הטקסט האישי
              של כל מגיש/ה עבר להיות ביקורת משלו, ר' סקציית הדירוגים למטה. */}
          {place.shortDescription && <p className="text-sm leading-relaxed text-ink-secondary">{place.shortDescription}</p>}

          {place.priceLevel != null && (
            <span className="self-end text-sm font-bold text-ink" aria-label="טווח מחירים">
              {"₪".repeat(Math.min(4, Math.max(1, place.priceLevel)))}
            </span>
          )}
        </div>

        {/* 5. קטגוריה+תת-קטגוריה עם אייקון עגול, בדיוק כמו PlaceMapPopupCard.tsx -
            במקום צ'יפים גנריים. נגישות צמודה לאותה שורה, לא צ'יפ נפרד. */}
        <div className="flex items-center gap-2.5">
          {categoryIconSrc && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={categoryIconSrc} alt="" className="h-6 w-6 object-contain" />
            </div>
          )}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-ink">{categoryLabel}</span>
            {place.subcategory && <span className="truncate text-xs text-ink-secondary">{place.subcategory}</span>}
          </div>
          {place.accessible === true && (
            <span className="mr-auto shrink-0 text-sm font-semibold text-ink">♿ נגיש</span>
          )}
        </div>

        {/* *** תוספת (בקשה מפורשת - "נגישות = מה שיש בגוגל"): פירוט
            4 עובדות הנגישות שגוגל בפועל מספק - מוצגות רק אלה שידועות
            וחיוביות (לא מומצא "לא נגיש" למה שלא ידוע). */}
        {(place.accessible || place.accessibleParking || place.accessibleRestroom || place.accessibleSeating) && (
          <div className="flex flex-wrap gap-2">
            {place.accessible && (
              <span className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
                ♿ כניסה נגישה
              </span>
            )}
            {place.accessibleParking && (
              <span className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
                🅿️ חניה נגישה
              </span>
            )}
            {place.accessibleRestroom && (
              <span className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
                🚻 שירותים נגישים
              </span>
            )}
            {place.accessibleSeating && (
              <span className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
                💺 ישיבה נגישה
              </span>
            )}
          </div>
        )}

        {/* "כמה שמרו" - תמיד מוצג, גם ב-0, עם ניסוח מזמין. */}
        <div className="flex items-center gap-3 rounded-card border border-ink-secondary/10 bg-white p-4">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            <BookmarkIcon />
          </span>
          <p className="text-sm text-ink">
            {savedCount > 0 ? (
              <>
                <span className="font-extrabold">{savedCount}</span> {savedCount === 1 ? "משתמש שמר" : "משתמשים שמרו"} את המקום הזה
              </>
            ) : (
              "עדיין אף אחד לא שמר את המקום הזה - היה/י הראשון/ה!"
            )}
          </p>
        </div>

        {/* 6. מפה - מרחק מהבית מעל המפה, מפה, Google Maps + Waze מתחתיה
            (הסדר הזה כבר מובנה בתוך PlaceNavigationCard). */}
        <PlaceNavigationCard placeId={place.id} latitude={place.latitude} longitude={place.longitude} />

        {/* 7. דירוג Google */}
        {place.googleRating != null && (
          <GoogleRatingCard rating={place.googleRating} ratingCount={place.googleRatingCount} googleUrl={googleReviewsUrl} />
        )}

        {/* 8. דירוג TripLace (לוגואים + כפתור "דרגו את המקום הזה") */}
        <TripAddRatingSection place={place} />

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
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}

/** true אם השעה הנוכחית נמצאת בטווח הפתיחה של היום (תומך במעבר חצות) -
 *  אותה פונקציה בדיוק כמו PlaceMapPopupCard.tsx. */
function isWithinToday(today: { openMinutes: number; closeMinutes: number }): boolean {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let closeMinutes = today.closeMinutes;
  if (closeMinutes <= today.openMinutes) closeMinutes += 24 * 60;
  return nowMinutes >= today.openMinutes && nowMinutes <= closeMinutes;
}
