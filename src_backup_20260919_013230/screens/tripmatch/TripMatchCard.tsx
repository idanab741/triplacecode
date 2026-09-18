"use client";

import { getCategoryLabel, hasHebrewLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";

const MAX_REASONABLE_DRIVING_KM = 400; // מעבר לזה, "X דק' נסיעה" כבר לא כנה - צריך טיסה

interface TripMatchCardProps {
  candidate: CandidatePlace;
  /** "1/5" - האינדקס הנוכחי מתוך סך המועמדים בסבב הזה (1-based) והסך הכל. */
  matchIndex: number;
  matchTotal: number;
  /** תווית המיקום/יעד המוצג בפינה (pin + טקסט) - העיר/אזור שמחפשים בו כרגע. */
  cityLabel: string;
  /** מפעילים ע"י ה-SwipeCard העוטף - מריצים את אנימציית ה-fly-out ואז את
   *  ה-callback המקורי (onSwipeRight/onSwipeLeft). */
  onLike: () => void;
  onNope: () => void;
  /** *** חדש (בקשה מפורשת - שדרוג ויזואלי): כפתור "חזור" מרכזי בין X ללב -
   *  מבטל את ההחלטה האחרונה (מחזיר את המועמד הקודם לראש התור). מוצג תמיד,
   *  אבל disabled/עמום כשאין מה לבטל (canRewind=false). */
  onRewind: () => void;
  canRewind: boolean;
  disabled?: boolean;
}

const TAG_LABELS: Record<string, string> = {
  parking: "🅿️ חניה",
  kid_friendly: "👨‍👩‍👧 מתאים לילדים",
  accessible: "♿ נגיש",
  water: "💧 מים",
  dogs: "🐶 כלבים",
  shaded: "🌳 מוצל",
};

/** תגיות קצרות מתחת לתיאור - נגזרות מהשדות האמיתיים שכבר קיימים על המועמד,
 *  לא ממציאות מידע שאין. (זהה ללוגיקה הקודמת - לא שונתה, רק המיקום הוויזואלי). */
function deriveTags(candidate: CandidatePlace): string[] {
  const baseTags = Array.from(
    new Set(
      [candidate.category]
        .filter((t): t is string => !!t && hasHebrewLabel(t))
        .map((t) => getCategoryLabel(t))
    )
  );

  const contentTags = Array.from(
    new Set(
      [...candidate.tripTypeTags, ...candidate.cuisineTags]
        .filter((t) => hasHebrewLabel(t))
        .map((t) => getCategoryLabel(t))
    )
  );

  const badgeTags: string[] = [];
  if (candidate.accessible) badgeTags.push(TAG_LABELS.accessible);
  if (candidate.kosher) badgeTags.push("✡️ כשר");
  if (candidate.suitableChildAges.length > 0) badgeTags.push(TAG_LABELS.kid_friendly);

  return Array.from(new Set([...baseTags, ...contentTags, ...badgeTags])).slice(0, 4);
}

/** מרחק/זמן נסיעה - "🚗 X דק'" קרוב, "✈️ X ק"מ" רחוק מדי לנסיעה, כלום אם
 *  אין מרחק בכלל (למשל טרם זוהה מיקום המשתמש). */
function DistanceBadge({ candidate }: { candidate: CandidatePlace }) {
  if (candidate.distanceKm <= 0) return null;
  if (candidate.distanceKm <= MAX_REASONABLE_DRIVING_KM) {
    return <span>🚗 {candidate.etaMinutes} דק&apos;</span>;
  }
  return <span>✈️ {Math.round(candidate.distanceKm).toLocaleString()} ק&quot;מ</span>;
}

/**
 * כרטיס ההחלקה - תמונה מלאה עם גרדיאנט תחתון, בדיוק לפי הסקיצה המאושרת:
 * Pill "1/5" בפינה השמאלית-עליונה (פיזית), Pill מיקום בפינה הימנית-עליונה,
 * שם/תיאור/דירוג/תגיות עוברי-כתב לבן על גבי התמונה בתחתית, ושלושה כפתורי
 * פעולה עגולים (X / חזור / לב) שחוצים מעט את הקצה התחתון של הכרטיס.
 *
 * *** הערה מכוונת: הכפתורים יושבים בתוך אותו אלמנט שה-SwipeCard העוטף
 * מזיז בגרירה (כמו בעיצוב הקודם) - כלומר הם זזים קלות עם הכרטיס, לא
 * לגמרי קבועים כמו בסקיצה. הפרדתם לגמרי מדרישה שינוי ארכיטקטורה של
 * SwipeCard המשותף (המשמש גם מסכי day-trip/nature-trip וכו') - ניתן
 * לעשות את זה בנפרד אם חשוב שיהיו קבועים לגמרי.
 */
export function TripMatchCard({
  candidate,
  matchIndex,
  matchTotal,
  cityLabel,
  onLike,
  onNope,
  onRewind,
  canRewind,
  disabled,
}: TripMatchCardProps) {
  const tags = deriveTags(candidate);

  return (
    <div className="relative h-full w-full">
      {/* הכרטיס עצמו - קצת יותר נמוך מהמכל כדי לפנות מקום לכפתורים
          מתחתיו (לא חופפים תוכן) - תמונה מלאה, פינות מעוגלות, גרדיאנט
          תחתון לקריאות. */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden rounded-[28px] shadow-[0_18px_40px_rgba(16,24,40,0.22)]"
        style={{ height: "calc(100% - 64px)" }}
      >
        <div className="absolute inset-0 bg-bg-secondary">
          {candidate.imageUrls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={candidate.imageUrls[0]}
              alt={candidate.name}
              className="h-full w-full object-cover object-center"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl">📍</div>
          )}
        </div>

        {/* גרדיאנט תחתון */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(10,12,20,0.88)_0%,rgba(10,12,20,0.55)_30%,rgba(10,12,20,0)_58%)]" />

        {/* Pill: אינדקס - פינה שמאלית-עליונה (פיזית) */}
        <div className="absolute start-4 top-4 rounded-pill bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm">
          {matchIndex}/{matchTotal}
        </div>

        {/* Pill: מיקום - פינה ימנית-עליונה (פיזית) */}
        <div className="absolute end-4 top-4 flex items-center gap-1 rounded-pill bg-black/40 px-3 py-1.5 text-[13px] font-semibold text-white backdrop-blur-sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
            <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
          </svg>
          <span className="max-w-[120px] truncate">{cityLabel}</span>
        </div>

        {/* תוכן תחתון - שם/תיאור/מטא-דאטה/תגיות, עברי-כתב לבן על התמונה */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-[18px] pb-[22px] text-white">
          <h2 className="text-[26px] font-extrabold leading-tight">{candidate.name}</h2>
          <p className="line-clamp-2 max-w-[300px] text-[13.5px] leading-relaxed text-white/92">
            {candidate.shortDescription || "מקום מומלץ שנבחר במיוחד עבורכם באזור."}
          </p>

          <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-semibold">
            {candidate.rating != null && (
              <>
                <span className="flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFC94A" aria-hidden="true">
                    <path d="M12 2l2.9 6.9L22 9.6l-5.5 5 1.6 7.4L12 18.6 5.9 22l1.6-7.4L2 9.6l7.1-.7L12 2Z" />
                  </svg>
                  {candidate.rating.toFixed(1)}
                  {candidate.ratingCount != null && ` (${candidate.ratingCount.toLocaleString()})`}
                </span>
                <span className="opacity-60">|</span>
              </>
            )}
            <DistanceBadge candidate={candidate} />
            {candidate.priceLevel != null && (
              <>
                <span className="opacity-60">|</span>
                <span>{"₪".repeat(candidate.priceLevel + 1)}</span>
              </>
            )}
          </div>

          {tags.length > 0 && (
            <div className="mt-1.5 flex max-h-16 flex-wrap gap-1.5 overflow-hidden">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="h-fit shrink-0 rounded-pill bg-white/16 px-3 py-1 text-[11.5px] font-semibold text-white backdrop-blur-[2px]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* שלושת כפתורי הפעולה - יושבים ברצועה הפנויה מתחת לכרטיס (64px),
          לא עולים על שום תוכן. X ↔ חזור ↔ לב, בדיוק לפי הסדר בסקיצה. */}
      <div className="absolute inset-x-0 bottom-0 flex h-16 items-center justify-center gap-[22px]">
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onNope}
          aria-label="דלג"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_rgba(16,24,40,0.22)] transition active:scale-90 disabled:opacity-50"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3a3d4d" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <button
          type="button"
          disabled={disabled || !canRewind}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRewind}
          aria-label="חזור לכרטיס הקודם"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(30,30,38,0.55)] backdrop-blur-sm transition active:scale-90 disabled:opacity-40"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-1" />
          </svg>
        </button>

        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onLike}
          aria-label="אהבתי"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_8px_18px_rgba(16,24,40,0.22)] transition active:scale-90 disabled:opacity-50"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-primary-start)" aria-hidden="true">
            <path d="M12 21s-7.5-4.8-10.2-9.6C.2 8.4 1.6 4.8 5 4c2.1-.5 4 .4 5 2 1-1.6 2.9-2.5 5-2 3.4.8 4.8 4.4 3.2 7.4C19.5 16.2 12 21 12 21Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
