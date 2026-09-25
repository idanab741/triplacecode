"use client";

import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { getCategoryLabel, hasHebrewLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "@/services/tripBuilder/types";


/** גודל הכפתור הגדול (לב) - px. */
export const TRIPMATCH_MAIN_BUTTON_SIZE = 72;

/** *** עיצוב חדש (בקשה מפורשת - "תעצב כמו בדוגמה"): שורת הכפתורים יושבת *מתחת* לכרטיס (לא בתוכו) -
 *  זה הגובה (px) שנשמר לה בתחתית אזור ה-Deck. הכרטיסים תופסים את כל השאר. */
export const TRIPMATCH_BUTTON_ROW = 96;

/** @deprecated נשמר לתאימות - הכפתורים כבר לא בתוך הכרטיס */
export const TRIPMATCH_CARD_BUTTON_ZONE = 0;

/** צד הכרטיס שלחיצה עליו מחליפה תמונה - כל צד תופס 30% מהרוחב, האמצע
 *  (40%) פותח את עמוד המקום. */
const SIDE_TAP_ZONE = 0.3;

/** פירוש לחיצה על הכרטיס לפי מיקום אופקי:
 *  - "next"/"prev": התמונה הבאה/הקודמת. האפליקציה RTL, לכן הצד הימני
 *    (תחילת הקריאה בעברית) = הבאה, והשמאלי = הקודמת - כמו בסטוריז בעברית.
 *  - "open": פתיחת עמוד המקום (האמצע, או כשיש תמונה אחת בלבד). */
export function resolveCardTap(xFraction: number, imageCount: number): "next" | "prev" | "open" {
  if (imageCount <= 1) return "open";
  if (xFraction >= 1 - SIDE_TAP_ZONE) return "next";
  if (xFraction <= SIDE_TAP_ZONE) return "prev";
  return "open";
}

interface TripMatchCardProps {
  candidate: CandidatePlace;
  /** "1/5" - האינדקס הנוכחי מתוך סך המועמדים בסבב הזה (1-based) והסך הכל. */
  matchIndex: number;
  matchTotal: number;
  /** תווית המיקום/יעד המוצג בפינה (pin + טקסט) - העיר/אזור שמחפשים בו כרגע. */
  cityLabel: string;
  /** האינדקס (0-based) של התמונה המוצגת מתוך candidate.imageUrls. מנוהל
   *  ב-page.tsx (ולא כאן) כי הלחיצה נקלטת ב-SwipeCard, מחוץ לכרטיס. */
  imageIndex?: number;
  /** *** חדש (בקשה מפורשת - "CARD_CENTER ≈ VIEWPORT_CENTER, מדוד בפועל
   *  לא CSS תיאורטי"): left/width מחושבים ב-px ב-page.tsx דרך
   *  getBoundingClientRect (לא % / margin:auto) - מבטיח שהמרכז של
   *  הכרטיס תמיד יתלכד עם מרכז ה-viewport בפועל, לא עם מרכז ה-container
   *  שלו (שיכול להיות שונה). null/undefined (standalone, או לפני
   *  המדידה הראשונה) - נופל חזרה ל-inset-x-0 (מלא רוחב ה-container). */
  /** *** שונה שוב (Bug חוזר - "זה שוב בורח"): עכשיו זה style object CSS
   *  טהור (CARD_BOX_STYLE מ-page.tsx, עם aspect-ratio) - לא קואורדינטות
   *  מחושבות ב-JS. React.CSSProperties כדי לקבל כל מה שיש בו כמו שהוא. */
  centerBox?: CSSProperties | null;
  /** אחוז התאמה אישי + סיבות (ר' services/tripMatch/matchScore.ts) */
  match?: { percent: number; reasons: string[]; personalized: boolean } | null;
  /** חצי-עיגול בתחתית סביב גלובוס ה-Bottom Nav - רק כשהכרטיס נוגע בבר (לא בעיצוב הנוכחי) */
  notch?: boolean;
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
  // *** תיקון (בקשה מפורשת - "קטגוריות... לפחות 3 לכל אטרקציה"): candidate.tags כבר מגיע מוכן ואמיתי
  // מ-tripMatchService.ts (קטגוריה + תת-קטגוריה + מחיר/נגישות כשקיימים) - לא בונים תגיות מ-tripTypeTags/
  // cuisineTags (ריקים תמיד עכשיו, המקור tripadd לא מכיל אותם). נופלים לגרסה הישנה רק אם tags לא הגיע בכלל.
  if (candidate.tags && candidate.tags.length > 0) return candidate.tags.slice(0, 5);

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

/** טבעת אחוז ההתאמה (בהשראת הדוגמה) - ירוק להתאמה גבוהה, כחול המותג לבינונית, צהוב לנמוכה. */
function MatchRing({ percent, personalized }: { percent: number; personalized: boolean }) {
  const size = 62;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = percent >= 85 ? "#3ec28f" : percent >= 70 ? "#4a9eff" : "#ffc94d";
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full bg-black/35 backdrop-blur-md"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${percent}% התאמה ${personalized ? "אישית" : "כללית"}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(percent / 100) * c} ${c}`}
          className="tm-ring-fill"
          style={{ "--tm-arc": `${(percent / 100) * c}` } as CSSProperties}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-none">
        <span className="text-[17px] font-extrabold tabular-nums text-white" dir="ltr">
          {percent}%
        </span>
        <span className="mt-[3px] text-[9.5px] font-semibold text-white/85">{personalized ? "התאמה" : "כללית"}</span>
      </div>
    </div>
  );
}

function formatDistance(candidate: CandidatePlace): string | null {
  if (candidate.distanceKm <= 0) return null;
  if (candidate.distanceKm < 1) return `${Math.round(candidate.distanceKm * 1000)} מ׳`;
  if (candidate.distanceKm < 10) return `${candidate.distanceKm.toFixed(1)} ק״מ`;
  return `${Math.round(candidate.distanceKm).toLocaleString()} ק״מ`;
}

/**
 * כרטיס ההחלקה - תמונה מלאה עם גרדיאנט תחתון: Pill "1/5" בפינה
 * השמאלית-עליונה (פיזית), Pill מיקום בפינה הימנית-עליונה, שם/תיאור/
 * דירוג/תגיות עברי-כתב לבן על גבי התמונה בתחתית.
 *
 * *** שינוי (בקשה מפורשת - "הכפתורים צריכים להיות קבועים לעמוד, לא
 * זזים כשמחליקים"): כפתורי הפעולה (X/חזור/לב) הוצאו החוצה מכאן לגמרי -
 * הם כבר לא חלק מהכרטיס הנגרר. הם מוצגים כ-siblings קבועים ישירות
 * ב-tripmatch/page.tsx, מעל ה-SwipeCard אבל לא בתוכו, כך שהם לא זזים
 * עם ה-transform שלו בזמן גרירה. ר' הערה שם.
 */
export function TripMatchCard({ candidate, matchIndex, matchTotal, cityLabel, imageIndex = 0, centerBox = null, match = null, notch = false }: TripMatchCardProps) {
  const tags = deriveTags(candidate).slice(0, 3);
  const distance = formatDistance(candidate);
  const images = candidate.imageUrls;
  const safeIndex = Math.min(Math.max(imageIndex, 0), Math.max(images.length - 1, 0));

  // טעינה מוקדמת של התמונה הבאה - כדי שמעבר בלחיצה יהיה מיידי, בלי הבהוב.
  useEffect(() => {
    const next = images[safeIndex + 1];
    if (!next) return;
    const preload = new window.Image();
    preload.src = next;
  }, [images, safeIndex]);

  return (
    <div
      // מזהה לשכבת ההסבר של עמוד הבית (SearchIntroOverlay) - זרקור על הכרטיס הקדמי.
      data-tripmatch-front-card=""
      // *** בקשה מפורשת ("המסגרת הלבנה מסביב לכל כרטיסיה - ככה זה נראה
      // יותר טוב"): מסגרת לבנה דקה (2px) סביב הכרטיס. border-box - הגודל החיצוני
      // של הכרטיס לא משתנה, רק התוכן נכנס 2px פנימה (ה-overflow-hidden
      // חותך לפי הרדיוס הפנימי). אותה מסגרת בדיוק על שני הכרטיסים המציצים
      // מאחור ב-tripmatch/page.tsx.
      // *** תוקן (בקשה מפורשת - "הכרטיסייה רחבה מדי ביחס לשטח הזמין,
      // חייבת להיות RESPONSIVE וממורכזת בלי transform"): הכרטיס (100%
      // רוחב ה-container) גובה מאוד עכשיו, וכשהכרטיסים המסובבים מאחוריו
      // (rotate) מסתובבים, הבליטה האופקית שלהם (∝ גובה × sin(זווית))
      // חורגת מהשוליים הקיימים במסכים צרים - זו הסיבה האמיתית ל"חריגה",
      // לא הרוחב של הכרטיס הקדמי עצמו (שהוא סימטרי ותקין). התיקון: 85%
      // רוחב + מירכוז אמיתי עם margin-inline:auto (mx-auto) - *לא*
      // left:50%/transform - מוודא מרווח קבוע ושווה בכל רוחב מסך, מספיק
      // כדי להכיל גם את הבליטה מהסיבוב (ר' גם BACK_CARDS ב-page.tsx,
      // שם הזוויות עצמן גם קוטנו). מאומת חישובית על 320-430px רוחב.
      // *** תוקן שוב (Bug חוזר - "זה שוב בורח"): לא עוד חישוב JS - centerBox
      // הוא עכשיו CSS style object טהור (CARD_BOX_STYLE, עם aspect-ratio)
      // שמוחלת כמו שהיא, בלי לפרק/להרכיב מחדש left/top/width/height.
      className="absolute overflow-hidden rounded-[28px] bg-white shadow-[0_22px_48px_-12px_rgba(16,24,40,0.35)]"
      style={{
        ...(centerBox ?? { top: 0, height: "100%", left: 0, right: 0 }),
        // חצי-עיגול בתחתית הכרטיס סביב גלובוס ה-tripmatch - רק כשהכרטיס נוגע בבר התחתון (notch).
        ...(notch
          ? {
              WebkitMaskImage: "radial-gradient(circle 38px at 50% calc(100% + 24px), transparent 0 37px, #000 38px)",
              maskImage: "radial-gradient(circle 38px at 50% calc(100% + 24px), transparent 0 37px, #000 38px)",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
            }
          : null),
      }}
    >
      <div className="absolute inset-0 bg-bg-secondary">
        {images[safeIndex] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[safeIndex]}
            alt={candidate.name}
            className="h-full w-full object-cover object-center"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">📍</div>
        )}
      </div>

      {/* גרדיאנט תחתון */}
      {/* *** תיקון (בקשה מפורשת - "הצל השחור יהיה קצת יותר גבוה, כדי שאפשר יהיה לראות את שם המיקום"): הצל
          עולה גבוה יותר בכרטיס (התחנה בה הוא כבר שקוף לגמרי - 58% -> 78% מגובה הכרטיס) ומתחיל כהה יותר
          גם למעלה (0.2 בקצה העליון, היה 0) - כדי שפינת ה-pill של שם העיר (top-[26px]) תמיד תישאר קריאה,
          גם מעל תמונה בהירה (שמיים/חוף). */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(8,10,18,0.88)_0%,rgba(8,10,18,0.55)_32%,rgba(8,10,18,0.12)_55%,rgba(8,10,18,0)_65%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(to_bottom,rgba(8,10,18,0.35),rgba(8,10,18,0))]" />

      {/* *** חדש (בקשה מפורשת - גלריית תמונות בתוך הכרטיס): פסי התקדמות
          בסגנון סטוריז בראש הכרטיס - פס לכל תמונה, המוצגת כרגע מודגשת.
          מוצגים רק כשיש יותר מתמונה אחת. לא אינטראקטיביים (pointer-events-
          none) - הלחיצה עצמה נקלטת ב-SwipeCard ומגיעה ל-page.tsx. */}
      {images.length > 1 && (
        <div className="pointer-events-none absolute inset-x-4 top-3 flex gap-1" aria-hidden="true">
          {images.map((_, i) => (
            <div
              key={i}
              className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${
                i === safeIndex ? "bg-white" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      {/* Pill: אינדקס - קבוע פיזית בצד שמאל (לא start-/end- הלוגיים -
          אלה מתהפכים תחת dir="rtl" הגלובלי של האפליקציה). top-[26px] -
          מתחת לפסי הסטוריז. */}
      <div className="absolute left-4 top-[26px] rounded-full bg-black/45 px-3 py-1.5 text-[13px] font-bold text-white tabular-nums backdrop-blur-md">
        {matchIndex}/{matchTotal}
      </div>

      {/* Pill: קטגוריה - קבוע פיזית בצד ימין (המיקום עבר לשורת המידע למטה, כמו בדוגמה) */}
      {tags[0] && (
        <div className="absolute right-4 top-[26px] max-w-[55%] truncate rounded-full bg-black/40 px-3 py-1.5 text-[12.5px] font-bold text-white backdrop-blur-md">
          {tags[0]}
        </div>
      )}

      {/* תוכן תחתון - שם/תיאור/מטא-דאטה/תגיות, עברי-כתב לבן על התמונה.
          *** שונה (בקשה מפורשת - "תכניס את הכפתורים לתוך הקצה התחתון"):
          הכפתורים כבר לא רוכבים על הקצה (חצי בפנים/חצי בחוץ) - הם לגמרי
          בתוך הכרטיס עכשיו, מ-24px עד 122px מהתחתית (ZONE + SIZE).
          ה-padding גדל בהתאם (היה 60px) כדי שהטקסט/התגיות תמיד יישארו
          מעל שורת הכפתורים, לא מתחתיה. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-3 px-[18px] pb-[18px] text-white">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* *** עיצוב חדש (בהשראת הדוגמה): שם גדול, מתחתיו שורת מיקום · מרחק, ואז דירוגים, סיבת ההתאמה
              ותגיות. כל הנתונים מהמקורות האמיתיים הקודמים - שדה חסר פשוט לא מוצג. */}
          <h2 className="text-[26px] font-extrabold leading-[1.1] tracking-tight drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]">{candidate.name}</h2>

          {(cityLabel || distance) && (
            <div className="flex min-w-0 items-center gap-1.5 text-[13.5px] font-semibold text-white/90">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF6B6B" aria-hidden="true" className="shrink-0">
                <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8Zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
              </svg>
              <span className="truncate">{[cityLabel, distance].filter(Boolean).join(" • ")}</span>
            </div>
          )}

          {(() => {
            const star = (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFC94A" aria-hidden="true">
                <path d="M12 2l2.9 6.9L22 9.6l-5.5 5 1.6 7.4L12 18.6 5.9 22l1.6-7.4L2 9.6l7.1-.7L12 2Z" />
              </svg>
            );
            const items: { key: string; node: ReactNode }[] = [];
            if (candidate.googleRating != null)
              items.push({
                key: "google",
                node: (
                  <>
                    {star}
                    <span className="tabular-nums">{candidate.googleRating.toFixed(1)}</span>
                    <span className="font-medium text-white/75">Google{candidate.googleRatingCount != null ? ` (${candidate.googleRatingCount.toLocaleString()})` : ""}</span>
                  </>
                ),
              });
            if (candidate.rating != null)
              items.push({
                key: "triplace",
                node: (
                  <>
                    {star}
                    <span className="tabular-nums">{candidate.rating.toFixed(1)}</span>
                    <span className="font-medium text-white/75">triplace{candidate.ratingCount != null ? ` (${candidate.ratingCount})` : ""}</span>
                  </>
                ),
              });
            if (items.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[12.5px] font-bold">
                {items.map((item) => (
                  <span key={item.key} className="flex items-center gap-1 whitespace-nowrap">
                    {item.node}
                  </span>
                ))}
              </div>
            );
          })()}

          {candidate.shortDescription && <p className="line-clamp-2 text-[13px] leading-snug text-white/88">{candidate.shortDescription}</p>}

          {match && match.reasons.length > 0 && (
            <div className="mt-0.5 flex w-fit max-w-full items-center gap-1.5 rounded-full bg-white/18 px-2.5 py-1 text-[12px] font-bold text-white backdrop-blur-md">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFD66B" aria-hidden="true" className="shrink-0">
                <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9zM19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z" />
              </svg>
              <span className="truncate">{match.reasons[0]}</span>
            </div>
          )}

          {tags.length > 1 && (
            <div className="flex max-h-7 flex-wrap gap-1.5 overflow-hidden">
              {tags.slice(1).map((tag) => (
                <span key={tag} className="h-fit shrink-0 rounded-full border border-white/25 px-2.5 py-0.5 text-[11.5px] font-semibold text-white/95">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {match && <MatchRing percent={match.percent} personalized={match.personalized} />}
      </div>
    </div>
  );
}
