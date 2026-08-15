"use client";

import { getCategoryLabel, hasHebrewLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";

const MAX_REASONABLE_DRIVING_KM = 400; // מעבר לזה, "X דק' נסיעה" כבר לא כנה - צריך טיסה

interface TripMatchCardProps {
  candidate: CandidatePlace;
  /** אחוז התאמה אישית (0-100) - מוצג כתגית מעל הכרטיס. */
  matchPercent: number;
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
 *  יש ומתורגמת) תמיד מוצגות כתגית בסיס ראשונה, כך שהשורה לעולם לא ריקה. */
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

  return Array.from(new Set([...baseTags, ...contentTags, ...badgeTags])).slice(0, 5);
}

/** כרטיס ההחלקה - תופס כמעט את כל המסך, מיועד להחלטה מהירה בלבד: תמונה,
 *  שם, קטגוריה, דירוג, זמן/מרחק, מחיר, תיאור קצר, ותגיות רלוונטיות בלבד.
 *
 *  *** תיקון: לפני זה, בלוק התיאור+תגיות התחתון היה מותנה לגמרי
 *  (`{(candidate.shortDescription || tags.length > 0) && (...)}`) - אם
 *  למקום מסוים לא היה תיאור ולא היו תגיות, הבלוק כולו נעלם, והתמונה
 *  (שהיא flex-1) הייתה מתרחבת למלא את המקום הפנוי - כך שכרטיסים שונים
 *  יצאו בגבהים/במבנה שונה זה מזה. עכשיו הבלוק תמיד מוצג, עם גובה מינימלי
 *  קבוע וטקסט חלופי כשאין תיאור אמיתי - כל הכרטיסים אחידים.
 *
 *  *** תיקון נוסף: אזור התמונה היה flex-1 בתוך מכולה עם גובה תלוי-viewport
 *  (calc(100dvh-340px)) - במסכים נמוכים זה כיווץ את אזור התמונה, ודחס את
 *  הטקסט (קטגוריה/שם/דירוג/מרחק) שיושב מעליה כשכבה, עד שהוא "נבלע" קרוב
 *  מדי לתפר עם בלוק התיאור. עכשיו לתמונה גובה קבוע ואחיד (h-72) בכל כרטיס
 *  ובכל מסך, כדי שתמיד יהיה מספיק מקום לטקסט.
 *
 *  *** עדכון עיצוב: הצל הכבד (shadow-soft) הוחלף בצל עדין + מסגרת דקה -
 *  נראה יותר "שטוח ומודרני", פחות "כרטיס צף עם צל מאחוריו".
 *
 *  *** תיקון: max-height (רק תקרה) השאיר פער ריק גדול בין תחתית הכרטיס
 *  לכפתורי ה-swipe הקבועים כשהתוכן (תיאור קצר) לא מילא את כל הגובה - 
 *  נראה כאילו הכפתורים "נזרקו" רחוק למטה בלי קשר לכרטיס. עכשיו height
 *  קבוע (לא רק תקרה) - הכרטיס תמיד תופס בדיוק את השטח הפנוי עד לאזור
 *  הכפתורים, ובלוק התיאור (flex-1) סופג כל מקום נוסף במקום שהוא יישאר
 *  ריק מתחת לכרטיס.
 *
 *  *** תיקון נוסף: היה עדיין פער נראה לעין בין תחתית הכרטיס לכפתורים,
 *  כי ה-320px בחישוב לא לקחו בחשבון ריפוד נוסף שהצטרף מסביב (pb-10/pt-5
 *  של המכולה החיצונית ב-page.tsx, ו-pb-28 שנשאר פעיל על ה-Screen כי רק
 *  px/pt בוטלו שם ולא pb). הריפודים האלה כווצו/בוטלו בעמוד עצמו לשלב
 *  ה-swiping, וכפתורי ה-swipe הועלו מ-86px ל-100px (כדי שלא יתנגשו בבר
 *  הניווט התחתון) - 320px כאן עודכן ל-334px כך שהכרטיס נעצר בדיוק
 *  ~12px מעל הכפתורים בכל המסכים, בלי רווח נוסף ובלי חפיפה.
 *
 *  *** תיקון נוסף: גובה התמונה היה h-72 קבוע אך "מבוזבז" - כרטיסים עם
 *  תיאור קצר/בלי תגיות נשארו עם הרבה שטח ריק בתמונה ומעט מקום לתיאור
 *  ולתגיות. הועבר ל-h-64 קבוע ואחיד (עדיין זהה בכל הכרטיסים) - משחרר
 *  ~32px נוספים לבלוק התיאור+קטגוריות מבלי לשנות את הגובה הכולל של
 *  הכרטיס, כך שהתמונה, התיאור והתגיות תמיד נכנסים יחד בלי לדחוס אחד
 *  את השני. */
export function TripMatchCard({ candidate, matchPercent }: TripMatchCardProps) {
  const tags = deriveTags(candidate);

  return (
    <div className="relative flex h-[calc(100dvh-334px)] w-full flex-col overflow-hidden rounded-card border border-black/5 bg-white shadow-[0_2px_16px_rgba(16,24,40,0.07)]">
      <div className="relative h-64 shrink-0 bg-bg-secondary">
        {candidate.imageUrls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={candidate.imageUrls[0]} alt={candidate.name} className="h-full w-full object-cover" draggable={false} />
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

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 px-5 pb-6 text-white">
          <div className="flex items-center gap-2 text-xs font-medium text-white/85">
            <span>{getCategoryLabel(candidate.category)}</span>
            {candidate.rating != null && (
              <>
                <span className="opacity-60">•</span>
                <span>⭐ {candidate.rating.toFixed(1)}</span>
              </>
            )}
          </div>
          <h2 className="text-xl font-extrabold leading-tight">{candidate.name}</h2>
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

      {/* בלוק קבוע - תמיד מוצג, גובה מינימלי אחיד לכל הכרטיסים, וגולל
          בעצמו (overflow-y-auto) אם התוכן ארוך - כדי שהתיאור לעולם לא
          ייחתך (line-clamp הוסר) והתגיות תמיד יוצגו במלואן. */}
      <div className="flex min-h-[92px] flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4">
        <p className="text-[13.5px] leading-relaxed text-ink-secondary">
          {candidate.shortDescription || "מקום מומלץ שנבחר במיוחד עבורכם באזור."}
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="rounded-pill bg-bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
