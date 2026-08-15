"use client";

import Image from "next/image";
import { getCategoryLabel, hasHebrewLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";

const MAX_REASONABLE_DRIVING_KM = 400; // מעבר לזה, "X דק' נסיעה" כבר לא כנה - צריך טיסה

interface TripMatchCardProps {
  candidate: CandidatePlace;
  /** אחוז התאמה אישית (0-100) - מוצג כתגית מעל הכרטיס. */
  matchPercent: number;
  /** מפעילים ע"י ה-SwipeCard העוטף - מריצים את אנימציית ה-fly-out ואז את
   *  ה-callback המקורי (onSwipeRight/onSwipeLeft). הלוגיקה לא השתנתה, רק
   *  המיקום הוויזואלי של הכפתורים. */
  onLike: () => void;
  onNope: () => void;
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
 *  לא ממציאות מידע שאין.
 *
 *  *** תיקון: לפני זה הפונקציה החזירה רק סימוני נגישות/כשרות/ילדים -
 *  שדות שלרוב ריקים במקומות שנוצרו אוטומטית ל-TripMatch (Claude לא
 *  מייצר אותם), ולכן הכרטיס יצא כמעט תמיד בלי תגיות בכלל. עכשיו
 *  מוצגות קודם עד 3 התגיות הכי רלוונטיות בפועל (סוג המקום/מטבח,
 *  מתורגמות לעברית), ואחריהן סימוני הנגישות/כשרות/ילדים אם קיימים.
 *
 *  *** תיקון נוסף: גם אחרי זה, מועמדים בלי trip_type_tags/cuisine_tags
 *  מתורגמים (ובלי נגישות/כשרות/ילדים) יצאו עם שורת תגיות ריקה לגמרי -
 *  "איפה הקטגוריות?" מבחינת המשתמש. עכשיו הקטגוריה + תת-הקטגוריה (אם
 *  יש ומתורגמת) תמיד מוצגות כתגית בסיס ראשונה, כך שהשורה לעולם לא ריקה.
 *
 *  *** תיקון נוסף: אזור התגיות עבר לגובה שורה אחת קבוע (ראו למטה) - כדי
 *  שתמיד יהיו מספיק תגיות למילוי השורה בלי שהיא תיראה ריקה מדי, מגבילים
 *  ל-4 תגיות במקום 5 (תגית חמישית ממילא כמעט אף פעם לא נכנסה לשורה). */
function deriveTags(candidate: CandidatePlace): string[] {
  const baseTags = Array.from(
    new Set(
      [candidate.category, candidate.subcategory]
        .filter((t): t is string => !!t && hasHebrewLabel(t))
        .map((t) => getCategoryLabel(t))
    )
  );

  const contentTags = Array.from(
    new Set(
      [...candidate.tripTypeTags, ...candidate.cuisineTags]
        .filter((t) => hasHebrewLabel(t)) // "רק בעברית" - לא מציגים תגיות בלי תרגום
        .map((t) => getCategoryLabel(t))
    )
  );

  const badgeTags: string[] = [];
  if (candidate.accessible) badgeTags.push(TAG_LABELS.accessible);
  if (candidate.kosher) badgeTags.push("✡️ כשר");
  if (candidate.suitableChildAges.length > 0) badgeTags.push(TAG_LABELS.kid_friendly);

  return Array.from(new Set([...baseTags, ...contentTags, ...badgeTags])).slice(0, 4);
}

/** מבנה גבהים קשיח לכל הכרטיס - זהה תמיד, בלי קשר לתוכן:
 *
 *  CARD_HEIGHT (גוף הכרטיס: תמונה + מידע + תגיות, גבהים קבועים לכל תת-חלק)
 *    ↓ ACTION_GAP (המרחק הקבוע בין תחתית הכרטיס לכפתורים)
 *  ACTION_ROW_HEIGHT (שורת הפעולות - X ו-Like)
 *    = TOTAL_HEIGHT הכולל, קבוע ואחיד לכל כרטיסי TripMatch.
 *
 *  התוצאה: "Card Area → Action Extension Area", בגובה סופי קבוע מראש -
 *  לא תלוי באורך שם/תיאור/מספר תגיות. ה-"Safe Bottom Spacing" מול
 *  ה-BottomNav הצף מגיע כבר מ-Screen (pb-28), כי כל הרכיב הזה (כרטיס +
 *  כפתורים) זורם בתוך התוכן הרגיל של המסך ולא fixed - כך שהוא לעולם לא
 *  יכול "להתנגש" ב-BottomNav. */
const IMAGE_HEIGHT = 224; // h-56
const INFO_HEIGHT = 112; // pt-4(16) + תיאור h-11(44) + gap-2(8) + תגיות h-8(32) + pb-3(12)
const CARD_HEIGHT = IMAGE_HEIGHT + INFO_HEIGHT; // 336 - קבוע לחלוטין, לא תלוי בתוכן
const ACTION_GAP = 20; // המרחק הקבוע בין תחתית הכרטיס לכפתורים
const BUTTON_SIZE = 60;
const ACTION_ROW_HEIGHT = BUTTON_SIZE; // 60
const TOTAL_HEIGHT = CARD_HEIGHT + ACTION_GAP + ACTION_ROW_HEIGHT; // גובה כולל קבוע לכל כרטיס

/** כרטיס ההחלקה - יחידה אחת שלמה בגובה קבוע ואחיד לחלוטין (TOTAL_HEIGHT),
 *  כדי שכל הכרטיסים המתחלפים ב-swipe יישבו בדיוק באותו שטח בלי "ריקוד" של
 *  הממשק. גוף הכרטיס עצמו (תמונה+מידע+תגיות) נשאר מלבן מעוגל רגיל; מתחתיו,
 *  בגובה ובריווח קבועים, יושבת שורת הפעולות (X / Like) - שני עיגולים
 *  סימטריים סביב מרכז הכרטיס בדיוק (flex + justify-center מבטיחים סימטריה
 *  מוחלטת), עם shadow עדין ועקבי לכל אחד מהם כך שכל האלמנט נתפס כיחידה
 *  אחת שממשיכה אורגנית מהכרטיס - לא כאלמנטים שהודבקו עליו. */
export function TripMatchCard({ candidate, matchPercent, onLike, onNope, disabled }: TripMatchCardProps) {
  const tags = deriveTags(candidate);

  return (
    <div className="flex w-full flex-col items-center" style={{ height: TOTAL_HEIGHT }}>
      {/* Card Area - גוף הכרטיס, גובה קבוע (CARD_HEIGHT), לא תלוי בתוכן */}
      <div
        className="w-full shrink-0 overflow-hidden rounded-card border border-black/5 bg-white shadow-[0_4px_16px_rgba(16,24,40,0.08)]"
        style={{ height: CARD_HEIGHT }}
      >
        <div className="relative h-56 shrink-0 bg-bg-secondary">
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
          {/* גרדיאנט תחתון - מבטיח שהטקסט הלבן קריא גם על תמונה בהירה */}
          <div className="absolute inset-x-0 bottom-0 h-44 bg-[linear-gradient(0deg,rgba(0,0,0,0.75),transparent)]" />

          {/* תגית אחוז התאמה - קבועה בפינה, לא תלויה בתוכן שאר הכרטיס */}
          <div
            className="absolute right-4 top-4 flex items-center gap-1 rounded-pill px-3 py-1.5 text-[13px] font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            <span>✨</span>
            <span>{matchPercent}% התאמה</span>
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-5 pb-5 text-white">
            <div className="flex items-center gap-2 text-xs font-medium text-white/85">
              <span>{getCategoryLabel(candidate.category)}</span>
              {candidate.rating != null && (
                <>
                  <span className="opacity-60">•</span>
                  <span>⭐ {candidate.rating.toFixed(1)}</span>
                </>
              )}
            </div>
            <h2 className="line-clamp-2 text-xl font-extrabold leading-tight">{candidate.name}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-medium text-white/90">
              {candidate.distanceKm > 0 &&
                (candidate.distanceKm <= MAX_REASONABLE_DRIVING_KM ? (
                  <>
                    <span>🚗 {candidate.etaMinutes} דק&apos;</span>
                    <span>📍 {candidate.distanceKm.toFixed(1)} ק&quot;מ</span>
                  </>
                ) : (
                  <span>✈️ {Math.round(candidate.distanceKm).toLocaleString()} ק&quot;מ ממך</span>
                ))}
              {candidate.priceLevel != null && <span>{"₪".repeat(candidate.priceLevel + 1)}</span>}
            </div>
          </div>
        </div>

        {/* אזור המידע התחתון - תיאור ותגיות בגבהים קבועים, כדי שגוף הכרטיס
            תמיד יגיע לאותו גובה בדיוק, בלי תלות באורך התוכן האמיתי. */}
        <div className="flex shrink-0 flex-col gap-2 px-5 pt-4 pb-3">
          <p className="line-clamp-2 h-11 text-[13.5px] leading-relaxed text-ink-secondary">
            {candidate.shortDescription || "מקום מומלץ שנבחר במיוחד עבורכם באזור."}
          </p>
          <div className="flex h-8 flex-wrap gap-1.5 overflow-hidden">
            {tags.map((tag) => (
              <span key={tag} className="h-fit shrink-0 rounded-pill bg-bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Extension Area - ריווח קבוע (ACTION_GAP) ואז שורת הפעולות,
          תמיד באותו גובה ומיקום מדויק ביחס לכרטיס. flex + justify-center +
          gap מבטיחים שהעיגולים תמיד סימטריים לחלוטין סביב מרכז הכרטיס.
          onPointerDown עוצר את ה-bubbling כדי שלחיצה על כפתור לא תתפרש
          כתחילת גרירה של הכרטיס (SwipeCard מאזין ל-pointerDown על כל
          האלמנט לצורך ה-swipe). */}
      <div className="flex shrink-0 items-center justify-center gap-10" style={{ height: ACTION_ROW_HEIGHT, marginTop: ACTION_GAP }}>
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onLike}
          aria-label="אהבתי"
          className="rounded-full shadow-[0_4px_12px_rgba(16,24,40,0.14)] transition active:scale-90 disabled:opacity-50"
        >
          <Image src="/images/tripmatch/action-like.png" alt="" width={BUTTON_SIZE} height={BUTTON_SIZE} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onNope}
          aria-label="לא מתאים"
          className="rounded-full shadow-[0_4px_12px_rgba(16,24,40,0.14)] transition active:scale-90 disabled:opacity-50"
        >
          <Image src="/images/tripmatch/action-nope.png" alt="" width={BUTTON_SIZE} height={BUTTON_SIZE} />
        </button>
      </div>
    </div>
  );
}
