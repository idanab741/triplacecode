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
   *  ה-callback המקורי (onSwipeRight/onSwipeLeft), בדיוק כמו לחיצה על
   *  הכפתורים החיצוניים הישנים - הלוגיקה לא השתנתה, רק המיקום הוויזואלי. */
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

/** כרטיס ההחלקה - יחידה אחת שלמה: תמונה בגובה קבוע, אזור מידע עם גבהים
 *  קבועים לכל תת-חלק (כותרת/תיאור/תגיות), ואזור פעולה משולב בתחתית עם
 *  כפתורי Like/X - כך שכל הכרטיסים יוצאים באותו גובה כולל בדיוק, בלי
 *  קשר לאורך השם/התיאור/מספר התגיות של כל מקום.
 *
 *  *** שדרוג UI/UX (לפי מפרט): כפתורי ה-Like/X עברו מלהיות שני כפתורים
 *  צפים מחוץ לכרטיס (fixed, בתוך SwipeCard) להיות אזור פעולה משולב
 *  *בתוך* הכרטיס עצמו, בתחתית - חלק אינטגרלי מהעיצוב במקום "מודבק"
 *  מבחוץ. הלוגיקה של ה-swipe (גרירה, אנימציית fly-out, ה-callbacks
 *  onSwipeLeft/onSwipeRight) לא השתנתה כלל - SwipeCard מעביר onLike/
 *  onNope כ-render-prop, והכרטיס רק קורא להם בלחיצה על הכפתורים.
 *
 *  *** גבהים קבועים לכל תת-אזור (לא עוד flex-1/min-h גמישים):
 *  - תמונה: h-56 קבוע (היה h-64 - צומצם כדי לפנות מקום לאזור הפעולה
 *    החדש בתוך הכרטיס, מבלי להגדיל את הגובה הכולל).
 *  - כותרת: line-clamp-2 (מעל התמונה, לא משפיע על גובה התמונה עצמה כי
 *    היא overlay מוחלט - אבל מונע משם ארוך מדי "להציף" את השכבה).
 *  - תיאור: גובה קבוע (h-11, שתי שורות) עם line-clamp-2 - לא עוד גלילה
 *    פנימית, כי המטרה עכשיו היא גובה קבוע ולא "להראות הכל".
 *  - תגיות: גובה קבוע (h-8, שורה אחת) עם overflow-hidden - תגיות
 *    שלא נכנסות לשורה הראשונה נחתכות, אבל האזור עצמו תמיד קיים ונראה.
 *  - אזור פעולה: תמיד באותו גובה (padding+כפתורים קבועים), עם קו הפרדה
 *    עדין (border-t) שמחבר אותו חזותית לגוף הכרטיס במקום להרגיש מנותק. */
export function TripMatchCard({ candidate, matchPercent, onLike, onNope, disabled }: TripMatchCardProps) {
  const tags = deriveTags(candidate);

  return (
    <div className="relative flex w-full flex-col overflow-hidden rounded-card border border-black/5 bg-white shadow-[0_2px_16px_rgba(16,24,40,0.07)]">
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

      {/* אזור המידע התחתון - תיאור ותגיות בגבהים קבועים, כדי שכל הכרטיסים
          יגיעו לאותו גובה כולל בדיוק, בלי תלות באורך התוכן האמיתי. */}
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

      {/* אזור הפעולה - Like/X משולבים בתוך הכרטיס עצמו, עם קו הפרדה עדין
          שמחבר אותו חזותית לגוף הכרטיס. onPointerDown עוצר את ה-bubbling
          כדי שלחיצה על הכפתורים לא תתפרש כתחילת גרירה של הכרטיס כולו
          (SwipeCard מאזין ל-pointerDown על כל הכרטיס לצורך ה-swipe). */}
      <div className="flex shrink-0 items-center justify-center gap-10 border-t border-black/5 bg-white py-4">
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onLike}
          aria-label="אהבתי"
          className="transition active:scale-90 disabled:opacity-50"
        >
          <Image src="/images/tripmatch/action-like.png" alt="" width={60} height={60} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onNope}
          aria-label="לא מתאים"
          className="transition active:scale-90 disabled:opacity-50"
        >
          <Image src="/images/tripmatch/action-nope.png" alt="" width={60} height={60} />
        </button>
      </div>
    </div>
  );
}
