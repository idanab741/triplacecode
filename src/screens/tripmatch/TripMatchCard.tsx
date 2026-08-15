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

/** מבנה גבהים לכרטיס: הרכיב כולו ממלא את הגובה הפנוי שההורה מקצה לו
 *  (h-full) - כדי שיתרחב אוטומטית לכל גודל מסך, וגובהו הכולל תמיד זהה
 *  בין מועמד למועמד. תוך כדי כך:
 *   - אזור המידע (תיאור+תגיות) תופס את הגובה הטבעי שהתוכן שלו צריך (עד
 *     תקרה סבירה), כך שתיאור/מספר תגיות שונים לא משנים את גובה הכרטיס -
 *     רק את היחס הפנימי בינו לבין התמונה.
 *   - התמונה (flex-1, min-h-0) גמישה ומתכווצת/מתרחבת דינמית כדי לפנות
 *     בדיוק את המקום שאזור המידע צריך.
 *   - שתי בליטות עגולות (X/לב) יוצאות מתחתית הכרטיס - ראו BUMP_SIZE למטה.
 *  ה-"Safe Bottom Spacing" מול ה-BottomNav הצף מגיע מהמכל שעוטף את הכרטיס
 *  בעמוד (page.tsx), לא מהרכיב הזה עצמו. */
const BUTTON_SIZE = 60; // האייקון (X / לב) עצמו
// *** שינוי מהותי: הגרסה הקודמת ניסתה ליצור את האשליה של "בליטה שצומחת
// מהכרטיס" רק עם drop-shadow משותף על שני עיגולים נפרדים שמונחים מתחת
// לכרטיס - בפועל זה לא יצר שום מיזוג אמיתי, ונראה בדיוק כמו שני כפתורים
// צפים עם רווח, בדיוק הבעיה המקורית. עכשיו יש מיזוג אורגני אמיתי: שכבה
// נפרדת ("שכבת הצורה") מצירת מלבן+שני עיגולים לבנים ומעבירה אותם דרך
// SVG goo filter (blur + contrast threshold) - זה בדיוק "ממיס" את הגבול
// בין המלבן לעיגולים לעקומות רציפות ואורגניות. השכבה הזו לא מכילה שום
// טקסט/תמונה - רק צורות אחידות - כך שהטשטוש לא פוגע בתוכן. תוכן הכרטיס
// (תמונה/טקסט) ואייקוני הכפתורים יושבים בשכבות נפרדות מעליה, חדים
// לגמרי, בלי filter.
const BUMP_SIZE = 76;
const BUMP_PROTRUSION = BUMP_SIZE / 2;
const CARD_RADIUS = 20; // תואם ל-var(--radius-card) בטוקנים
// *** רווח ביטחון בתחתית אזור המידע - חייב להיות לפחות BUMP_PROTRUSION
// (בדיוק כמה שהכפתורים חופפים לתוך גוף הכרטיס) ועוד קצת נשימה, אחרת
// תגיות/טקסט שמגיעים עד הסוף ממש נראים "נבלעים" מתחת לכפתורים. אזור
// המידע (תיאור+תגיות+הרווח הזה) תופס את הגובה הטבעי שהתוכן שלו צריך,
// עד תקרה סבירה (MAX_INFO_HEIGHT), כדי שתיאור ארוך במיוחד לא "יבלע" את
// כל התמונה. התמונה (flex-1 min-h-0) סופגת דינמית את מה שנשאר - מתכווצת
// /מתרחבת לפי אורך התוכן בפועל, בעוד גובה הכרטיס כולו (h-full) נשאר
// קבוע לחלוטין ולא תלוי בתוכן.
const MAX_INFO_HEIGHT = 168 + BUMP_PROTRUSION;

/** כרטיס ההחלקה - יחידה אחת שלמה שממלאת את כל הגובה הפנוי שההורה מקצה לה
 *  (h-full), כדי שהיא תתרחב אוטומטית ותמלא את המסך בכל גודל מסך, במקום
 *  להיות קבועה בפיקסלים. תמונת הרקע (flex-1) גמישה - גדלה/מצטמצמת דינמית
 *  כדי לפנות בדיוק את המקום שאזור המידע (תיאור+תגיות) צריך באמת, לפי
 *  אורך התוכן של כל מועמד; גובה הכרטיס כולו נשאר קבוע לחלוטין תמיד.
 *
 *  שכבת ה-goo (מלבן + שני עיגולים, בלי תוכן) עוברת יחד דרך SVG filter
 *  אחד (blur + threshold) שממיס את הגבולות ביניהם לעקומות אורגניות
 *  רציפות, ואז drop-shadow אחד על התוצאה הממוזגת - כך שהצללית עוקבת
 *  אחרי הצורה האמיתית (מלבן+שתי בליטות) בלי "קו תפר" באמצע. תוכן הכרטיס
 *  ואייקוני הכפתורים יושבים בשכבות נפרדות מעל, חדים לגמרי. */
export function TripMatchCard({ candidate, matchPercent, onLike, onNope, disabled }: TripMatchCardProps) {
  const tags = deriveTags(candidate);
  const bodyHeight = `calc(100% - ${BUMP_PROTRUSION}px)`;

  return (
    <div className="relative h-full w-full">
      {/* הגדרת ה-SVG filter שיוצר את המיזוג האורגני - לא נראית בעצמה,
          רק מוגדרת פה כדי ש-"goo layer" למטה תוכל להפנות אליה. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="tripmatch-card-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
          <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" result="goo" />
        </filter>
      </svg>

      {/* שכבת ה-goo - רק צורות לבנות אחידות (מלבן + שני עיגולים), בלי
          טקסט/תמונה, כדי שהטשטוש לא יפגע בשום תוכן. היא זו שיוצרת את
          האפקט של "הכרטיס מוליד את שתי הבליטות". */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ filter: "url(#tripmatch-card-goo) drop-shadow(0 4px 16px rgba(16,24,40,0.10))" }}
        aria-hidden="true"
      >
        <div className="absolute inset-x-0 top-0 bg-white" style={{ height: bodyHeight, borderRadius: CARD_RADIUS }} />
        <div className="absolute rounded-full bg-white" style={{ width: BUMP_SIZE, height: BUMP_SIZE, bottom: 0, left: "22%", transform: "translateX(-50%)" }} />
        <div className="absolute rounded-full bg-white" style={{ width: BUMP_SIZE, height: BUMP_SIZE, bottom: 0, right: "22%", transform: "translateX(50%)" }} />
      </div>

      {/* Card Area - תוכן הכרטיס עצמו (תמונה+טקסט), חד לגמרי, יושב בדיוק
          מעל שכבת ה-goo. פינות עגולות למעלה בלבד - התחתית שטוחה כדי
          שתתמזג חלק לתוך עקומות ה-goo מתחתיה בלי לייצר קו כפול. */}
      <div
        className="absolute inset-x-0 top-0 flex w-full flex-col overflow-hidden bg-transparent"
        style={{ height: bodyHeight, borderTopLeftRadius: CARD_RADIUS, borderTopRightRadius: CARD_RADIUS }}
      >
        <div className="relative min-h-0 flex-1 bg-bg-secondary">
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

        {/* אזור המידע התחתון - תופס בדיוק את הגובה שהתוכן האמיתי שלו צריך
            (עד MAX_INFO_HEIGHT), כדי שהתמונה מעליו (flex-1) תוכל להתכווץ
            דינמית ולפנות לו מקום כשהתיאור/התגיות ארוכים, ולהתרחב חזרה
            כשהם קצרים - בלי שגובה הכרטיס כולו ישתנה בין מועמד למועמד.
            bg-white כאן (לא רק בשכבת ה-goo) כי השכבה הזו יושבת מעל שכבת
            ה-goo ומכסה אותה - חייבת רקע אטום כדי שהתוכן יהיה קריא.
            *** תיקון קריטי: הכפתורים חופפים תמיד BUMP_PROTRUSION פיקסלים
            לתוך גוף הכרטיס (זה מה שיוצר את אפקט "הבליטה"). בלי רווח ביטחון
            בגודל הזה בתחתית האזור הזה, תגיות/טקסט שמגיעים עד הקצה ממש
            נופלים בדיוק מתחת לכפתורים ונראים כאילו "נבלעים". ה-pb הדינמי
            כאן מבטיח שהתוכן האמיתי (לא רק שטח ריק) תמיד נעצר לפני האזור
            שהכפתורים חופפים עליו. */}
        <div
          className="flex shrink-0 flex-col gap-2 bg-white px-5 pt-4"
          style={{ maxHeight: MAX_INFO_HEIGHT, paddingBottom: BUMP_PROTRUSION + 12 }}
        >
          <p className="line-clamp-3 text-[13.5px] leading-relaxed text-ink-secondary">
            {candidate.shortDescription || "מקום מומלץ שנבחר במיוחד עבורכם באזור."}
          </p>
          <div className="flex max-h-16 flex-wrap gap-1.5 overflow-hidden">
            {tags.map((tag) => (
              <span key={tag} className="h-fit shrink-0 rounded-pill bg-bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* שתי הבליטות העגולות - חדות, בלי filter, יושבות בדיוק על הבליטות
          שיצרה שכבת ה-goo מתחתיהן. bg-white שקוף-רקע לגמרי (transparent
          background על הכפתור עצמו - רק האייקון נראה) כי הרקע הלבן כבר
          מגיע משכבת ה-goo מתחת. bottom: 0 יחסית למכל h-full (לא לגוף
          הכרטיס) - חצי עליון חופף על גוף הכרטיס, חצי תחתון בולט מתחתיו,
          בדיוק כמו בשכבת ה-goo.

          *** נוסף: טבעת מסתובבת (halo) סביב כל כפתור - בדיוק אותה טכניקה
          כמו כפתור "trippy AI" בבר התחתון (conic-gradient מסתובב, מוסתר
          פנימית עם mask כדי שרק ה"מסגרת" תיראה, לא עיגול מלא). מוגדרת פה
          מקומית (tm-ring) במקום להסתמך על ה-style הגלובלי של BottomNav,
          כדי שהרכיב יישאר עצמאי. */}
      <span
        className="pointer-events-none absolute z-10 -translate-x-1/2"
        style={{ width: BUMP_SIZE, height: BUMP_SIZE, bottom: 0, left: "22%" }}
        aria-hidden="true"
      >
        {/* טבעת ה-X - אדומה (var(--color-danger)) בהתאמה סמנטית לפעולת
            "דחייה", בשונה מטבעת הלב שנשארת בגרדיאנט הכחול/סגול הרגיל. */}
        <span
          className="tm-ring absolute rounded-full"
          style={{
            inset: -7,
            background: "conic-gradient(from 0deg, transparent 0%, var(--color-danger) 30%, #ff8a8a 50%, transparent 70%)",
          }}
        />
      </span>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onNope}
        aria-label="לא מתאים"
        style={{ width: BUMP_SIZE, height: BUMP_SIZE, bottom: 0, left: "22%" }}
        className="absolute z-10 flex -translate-x-1/2 items-center justify-center rounded-full bg-transparent transition active:scale-90 disabled:opacity-50"
      >
        <Image src="/images/tripmatch/action-nope.png" alt="" width={BUTTON_SIZE} height={BUTTON_SIZE} />
      </button>

      <span
        className="pointer-events-none absolute z-10 translate-x-1/2"
        style={{ width: BUMP_SIZE, height: BUMP_SIZE, bottom: 0, right: "22%" }}
        aria-hidden="true"
      >
        <span
          className="tm-ring absolute rounded-full"
          style={{
            inset: -7,
            background: "conic-gradient(from 0deg, transparent 0%, var(--color-primary-start) 30%, var(--color-primary-end) 50%, transparent 70%)",
          }}
        />
      </span>
      <button
        type="button"
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onLike}
        aria-label="אהבתי"
        style={{ width: BUMP_SIZE, height: BUMP_SIZE, bottom: 0, right: "22%" }}
        className="absolute z-10 flex translate-x-1/2 items-center justify-center rounded-full bg-transparent transition active:scale-90 disabled:opacity-50"
      >
        <Image src="/images/tripmatch/action-like.png" alt="" width={BUTTON_SIZE} height={BUTTON_SIZE} />
      </button>

      <style jsx>{`
        .tm-ring {
          padding: 3px;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: tm-ring-spin 2.2s linear infinite;
        }
        @keyframes tm-ring-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
