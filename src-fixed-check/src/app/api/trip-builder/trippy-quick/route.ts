import { NextRequest, NextResponse } from "next/server";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { TRIP_TYPE_GROUPS, CUISINE_TAGS } from "@/services/places/tripTaxonomy";
import { parseOpeningHoursForDay } from "@/utils/openingHours";
import type { DiscoveryPlace } from "@/services/places/discoveryService";
import {
  type TrippyQuickStop,
  NIGHTLIFE_TAG_IDS,
  toStop,
  fetchAttractionPlaces,
  fetchRestaurantPlaces,
  fetchNightlifePlaces,
  fetchPlacesByNameKeyword,
  pickCompactCluster,
} from "@/services/tripBuilder/trippyQuickShared";
import { consumeTokens, refundTokens, TOKEN_COSTS } from "@/services/tokens/tokenService";

export type { TrippyQuickStop };

const TRIPPY_AI_COST = TOKEN_COSTS.trippy_ai_generation;

/**
 * *** תוספת (בקשת המשתמש - "ג'סמינו בכלל סגור בשבת" - הוצע מקום סגור
 * ביום שבו בעצם התבקש הטיול): בניגוד לאשף המלא (יש בו שאלת "מתי"
 * מפורשת, ר' getTripDayOfWeek ב-openingHours.ts), trippy-quick מקבל
 * רק מלל חופשי - אז מזהים "מתי" ישירות מהטקסט, דטרמיניסטית (לא דרך
 * Claude - שם יש/יום הם גם מילים מבוססות-מספר ["שני"="שתיים",
 * "שלישי"="שלוש" וכו'] שקל לבלבל, אז דורשים הקשר של "יום"/"ב-"/"של"
 * לפני השם, חוץ מ"שבת" שאין לה משמעות אחרת בכלל). null אם היום לא
 * צוין בבקשה בכלל - במקרה כזה לא מסננים לפי שעות פתיחה (כמו קודם).
 */
const HEBREW_DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const DAY_WITH_CONTEXT_RE = new RegExp(`(?:יום\\s+|ב(?:יום\\s+)?|של\\s+)(${HEBREW_DAY_NAMES.join("|")})`);

function detectRequestedDayOfWeek(freeText: string): number | null {
  if (/מחרתיים/.test(freeText)) {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.getDay();
  }
  if (/(?<!ל)\bמחר\b/.test(freeText)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.getDay();
  }
  if (/\bהיום\b/.test(freeText)) {
    return new Date().getDay();
  }
  // "שבת" בפני עצמה חד-משמעית (אין לה משמעות אחרת) - לא צריכה הקשר.
  if (freeText.includes("שבת")) return 6;
  const match = freeText.match(DAY_WITH_CONTEXT_RE);
  if (match) return HEBREW_DAY_NAMES.indexOf(match[1]);
  return null;
}

/** מסנן מקום שסגור ב-dayOfWeek לפי opening_hours (ר' parseOpeningHoursForDay) -
 *  שומר מקומות בלי נתוני שעות פתיחה (openingHours=null) בפנים, כדי לא
 *  לסנן יתר-על-המידה כשאין מידע בכלל. */
function isOpenOnDayOrUnknown(place: DiscoveryPlace, dayOfWeek: number | null): boolean {
  if (dayOfWeek == null) return true;
  if (!place.openingHours) return true;
  return parseOpeningHoursForDay(place.openingHours, dayOfWeek) !== "closed";
}

/**
 * *** תכונה חדשה (בקשה מפורשת - "מלל חופשי... משם ישר הולכים לעמוד
 * מסלול ייחודי... עד 3 מסעדות ו-3 אטרקציות... החיפוש יתבצע על בסיס
 * ה-API של קלוד והוא יתן את התוצאות").
 * *** תיקון אדריכלי ("רק להשתמש מהמאגר שלנו!!!!!!"): בלי Google -
 * Claude מחלץ קריטריונים מובנים, ושאילתה ישירה מול `places` דרך
 * fetchDiscoveryPlaces (ר' trippyQuickShared.ts).
 * *** תיקון (בקשה מפורשת - "אם אכתוב טיול בטבע או חיי לילה או כל
 * דבר אחר... שלא יהיה ריק שוב אף פעם!"): נוסף bucket שלישי לחלוטין
 * (nightlife) - ר' trippyQuickShared.ts להסבר המלא למה יש בכלל שלושה
 * מנגנונים נפרדים.
 */

interface ExtractedCriteria {
  title: string;
  city: string | null;
  /** *** תיקון (בקשת המשתמש - "ביקשתי מסלול בטבע ליד הכנרת - למה לא
   *  נמצא????"): המלל הזכיר מיקום מפורש ("ליד הכנרת") - אבל "הכנרת"
   *  היא לא שם עיר, אז city נשאר null, ובלי זה המערכת נפלה חזרה
   *  למיקום *המכשיר* (עם רדיוס 10 ק"מ בלבד!) - שיכול להיות רחוק
   *  עשרות/מאות ק"מ מהאזור שבאמת התבקש. הפתרון: כש-city לא-תקין (לא
   *  שם עיר אמיתי) אבל יש הפניה גיאוגרפית ברורה במלל (אזור/אתר/גוף
   *  מים/הר) - Claude (שיש לו ידע גיאוגרפי כללי טוב) נותן קואורדינטות
   *  משוערות לאזור עצמו, במקום מיקום המכשיר. null אם לא צוין אזור
   *  כזה בכלל (למשל בקשה כללית בלי שום רמז מיקום) - במקרה הזה עדיין
   *  נופלים חזרה למכשיר, כמו קודם. */
  regionLat: number | null;
  regionLng: number | null;
  attractionsWanted: number;
  attractionCategoryIds: string[];
  restaurantsWanted: number;
  cuisineIds: string[];
  /** *** תוספת (בקשת המשתמש - "ביקשתי חומוס - קיבלתי ג'סמינו"): מנה/
   *  מילת-מפתח ספציפית שהטקסונומיה הגסה לא מכסה נכון (חומוס/סושי/
   *  קרואסון/וכו') - null אם cuisineIds מספיק מדויק. ר' הערה מפורטת
   *  ב-trippyQuickShared.ts (fetchPlacesByNameKeyword). */
  restaurantNameKeyword: string | null;
  /** *** תוספת - ר' הערה למעלה. */
  nightlifeWanted: number;
  nightlifeTagIds: string[];
}

/** *** תוספת (תיקון באג - "העמוד צריך לתת תוצאות...בין 1-4 תוצאות"):
 * רשת ביטחון בצד השרת, לא רק בפרומפט. אם Claude בכל זאת מחזיר
 * attractionsWanted/nightlifeWanted > 0 בלי קטגוריות (למשל בגלל ניסוח
 * לא-צפוי שלא נתפס נכון), fetchAttractionPlaces/fetchNightlifePlaces
 * ב-trippyQuickShared.ts מחזירים [] בשקט (category ids ריקים = לא
 * מסננים כלום = לא בטוח) - זו בדיוק הסיבה שהוזלה "לא הצלחנו למצוא
 * מקומות" גם כשהכוונה של המשתמש הייתה ברורה וכללית. כשזה קורה,
 * ממלאים כמה קטגוריות פופולריות כברירת מחדל, במקום להישאר עם []. */
const DEFAULT_FALLBACK_ATTRACTION_CATEGORY_IDS = TRIP_TYPE_GROUPS.slice(0, 3).map((g) => g.id);
const DEFAULT_FALLBACK_NIGHTLIFE_TAG_IDS_COUNT = 3;

const ATTRACTION_CATEGORY_IDS = TRIP_TYPE_GROUPS.map((g) => g.id).join(", ");
const CUISINE_IDS = CUISINE_TAGS.map((t) => t.id).join(", ");
const NIGHTLIFE_IDS = NIGHTLIFE_TAG_IDS.join(", ");

function buildPrompt(freeText: string, dnaContext: string): string {
  return `אתה מומחה טיולים. המשתמש כתב בקשה חופשית לטיול-יום אחד -
זהו הטקסט **הסופי והמחייב**, לא בסיס להרחבה: תן בדיוק את מה שהתבקש,
לא יותר.
${JSON.stringify(freeText)}
${dnaContext}

**דיוק לפני כמות - זה החוק החשוב ביותר כאן:** אם המשתמש ביקש דבר אחד
ספציפי (למשל "בית קפה") - attractionsWanted=0, restaurantsWanted=1,
cuisineIds=["cafe"], nightlifeWanted=0. אל תמלא "מכסה" עם דברים
לא-קשורים שהוא לא ביקש.

**בקשה כללית/לא-ממוקדת (קריטי - זה כולל גם ניסוחים כמו "טיול של שבת",
"טיול עם המשפחה", "בילוי היום", "יום כיף", "מה יש לעשות היום" וכל
ניסוח דומה שמבקש יום/בילוי בלי לפרט קטגוריה, מטבח או סוג מקום ספציפי):
אסור בשום מקרה להחזיר הכל אפסים (attractionsWanted=0 +
restaurantsWanted=0 + nightlifeWanted=0) - זו תוצאה ריקה שהמשתמש
תמיד יתפוס כתקלה. במקום זה, תכנן יום כללי (עד 2 אטרקציות + מסעדה
אחת - לא צריך להגזים בכמות): attractionsWanted=2,
restaurantsWanted=1, ומלא attractionCategoryIds ב-2-3 קטגוריות
פופולריות וכלליות (למשל טבע/תצפיות, תרבות, פנאי משפחתי - בחר לפי
שיקול דעתך, לא משנה בדיוק אילו כל עוד יש תוצאה). nightlife נשאר 0
אלא אם התבקש במפורש. **סה"כ מספר התחנות בכל הבקשה (attractions +
restaurants + nightlife יחד) חייב להיות בין 1 ל-4** - גם בבקשה כללית
וגם בבקשה ממוקדת. אם הבקשה מפורשת וספציפית (כמו "בית קפה" - תוצאה
אחת בלבד) - כבד את זה בדיוק ואל תוסיף עוד כדי "למלא" עד 4.

**חשוב מאוד:** attractionCategoryIds חייב להכיל לפחות קטגוריה אחת בכל
פעם ש-attractionsWanted > 0 (אחרת לא יוחזרו תוצאות בפועל) - גם אם
המשתמש לא ציין קטגוריה מפורשת, בחר את הקטגוריות הכלליות/פופולריות
ביותר מהרשימה. אותו כלל בדיוק חל על nightlifeTagIds כש-nightlifeWanted
> 0.

**מנה ספציפית (לא סוג מטבח כללי) - קריטי, שימו לב היטב:** רשימת
cuisineIds היא **גסה** (16 סוגי מטבח כלליים) - היא **לא** מכסה מנות
ספציפיות כמו חומוס/סושי/קרואסון/פיצה נאפוליטנית וכו'. אם המשתמש ביקש
מנה ספציפית שאין לה cuisine tag מדויק ברשימה - **אל תנחש את הכי קרוב**
(למשל "israeli_middle_eastern" לחומוס - זה רחב מדי, לא מבטיח חומוס
בכלל!). במקום זה: cuisineIds=[], ותמלא restaurantNameKeyword במילה
עצמה (למשל "חומוס"). דוגמה: "רוצה חומוס" -> restaurantsWanted=1,
cuisineIds=[], restaurantNameKeyword="חומוס". אם המשתמש כן ביקש סוג
מטבח כללי שיש לו cuisine tag מדויק (כמו "אסייתי") - אז כן cuisineIds
מתאים, restaurantNameKeyword=null.

**לשון יחיד/רבים קובעת את המספר במפורש:**
- "מסעדה" / "בר" (יחיד, בלי מספר) -> 1 בלבד.
- "כמה מסעדות" / "מסעדות" (רבים, בלי מספר) -> 3.
- מספר מפורש -> אותו מספר בדיוק.

חלץ:
- title: כותרת קצרה וקליטה למסלול (2-5 מילים).
- city: שם עיר בעברית **רק אם צוינה עיר של ממש** (לא אזור/אתר/גוף מים/
  הר - למשל "תל אביב"/"חיפה" כן, "הכנרת"/"הרי ירושלים"/"ים המלח" לא -
  אלה הולכים ל-regionLat/regionLng למטה). אחרת null.
- regionLat / regionLng: אם הבקשה מציינת אזור/אתר גיאוגרפי מוכר שהוא
  **לא** שם עיר (ימה/הר/מדבר/אזור כמו "ליד הכנרת", "בהרי ירושלים",
  "באזור אילת והערבה") - קואורדינטות משוערות (מספרים, לפי הידע
  הגיאוגרפי שלך) למרכז האזור הזה. אחרת null/null (גם אם city מולא).
- attractionsWanted: 0-3 (טבע/תצפיות/תרבות/קניות/ספא/וכו').
- attractionCategoryIds: מערך מתוך הרשימה הזו בדיוק (ריק אם attractionsWanted=0):
  ${ATTRACTION_CATEGORY_IDS}
- restaurantsWanted: 0-3 (מסעדות/בתי קפה).
- cuisineIds: מערך מתוך הרשימה הזו בדיוק (ריק = כל מטבח; ריק אם restaurantsWanted=0, וגם ריק אם restaurantNameKeyword לא-null):
  ${CUISINE_IDS}
- restaurantNameKeyword: מחרוזת (מנה ספציפית) או null - ר' הסבר למעלה.
- nightlifeWanted: 0-3 (בר/מועדון/הופעה חיה/סטנדאפ/תיאטרון/קריוקי/באולינג/סנוקר/ארקייד - **רק** אם המשתמש ביקש חיי לילה/בילוי ערב במפורש).
- nightlifeTagIds: מערך מתוך הרשימה הזו בדיוק (ריק אם nightlifeWanted=0):
  ${NIGHTLIFE_IDS}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"title": "...", "city": "..." | null, "regionLat": 0 | null, "regionLng": 0 | null, "attractionsWanted": 0, "attractionCategoryIds": [], "restaurantsWanted": 0, "cuisineIds": [], "restaurantNameKeyword": "..." | null, "nightlifeWanted": 0, "nightlifeTagIds": []}`;
}

function buildDnaContext(dna: Awaited<ReturnType<typeof getTravelDna>>): string {
  if (!dna) return "";
  const parts: string[] = [];
  if (dna.kosher) parts.push("המשתמש שומר כשרות.");
  if (dna.interests?.length) parts.push(`תחומי עניין כלליים (רלוונטי רק אם הבקשה עצמה לא ספציפית מספיק): ${dna.interests.join(", ")}.`);
  if (dna.culinary_styles?.length) parts.push(`סגנונות אוכל מועדפים: ${dna.culinary_styles.join(", ")}.`);
  if (parts.length === 0) return "";
  return `\nהעדפות פרופיל המשתמש (משני לבקשה הספציפית - הבקשה עצמה תמיד גוברת אם יש סתירה): ${parts.join(" ")}`;
}

async function extractCriteria(freeText: string, dnaContext: string): Promise<ExtractedCriteria | null> {
  const { text, error } = await callClaude(buildPrompt(freeText, dnaContext), 800);
  if (error || !text) {
    logAiError("trippy-quick: חילוץ קריטריונים מ-Claude נכשל", { freeText, error });
    return null;
  }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const validAttractionIds = new Set(TRIP_TYPE_GROUPS.map((g) => g.id));
    const validCuisineIds = new Set(CUISINE_TAGS.map((t) => t.id));
    const validNightlifeIds = new Set(NIGHTLIFE_TAG_IDS);

    let attractionsWanted = Math.min(3, Math.max(0, Number(parsed.attractionsWanted) || 0));
    let attractionCategoryIds = Array.isArray(parsed.attractionCategoryIds)
      ? parsed.attractionCategoryIds.filter((id): id is string => typeof id === "string" && validAttractionIds.has(id))
      : [];
    // *** רשת ביטחון (ר' הערה למעלה ליד DEFAULT_FALLBACK_ATTRACTION_CATEGORY_IDS):
    // attractionsWanted>0 בלי קטגוריות = 0 תוצאות בפועל (fetchAttractionPlaces
    // מחזיר [] כש-attractionCategoryIds ריק) - זה בדיוק מה שגרם ל"לא הצלחנו
    // למצוא" למרות בקשה כללית תקינה כמו "טיול של שבת עם המשפחה".
    if (attractionsWanted > 0 && attractionCategoryIds.length === 0) {
      attractionCategoryIds = DEFAULT_FALLBACK_ATTRACTION_CATEGORY_IDS;
    }

    let restaurantsWanted = Math.min(3, Math.max(0, Number(parsed.restaurantsWanted) || 0));
    const cuisineIds = Array.isArray(parsed.cuisineIds)
      ? parsed.cuisineIds.filter((id): id is string => typeof id === "string" && validCuisineIds.has(id))
      : [];
    const restaurantNameKeyword =
      typeof parsed.restaurantNameKeyword === "string" && parsed.restaurantNameKeyword.trim() ? parsed.restaurantNameKeyword.trim() : null;

    let nightlifeWanted = Math.min(3, Math.max(0, Number(parsed.nightlifeWanted) || 0));
    let nightlifeTagIds = Array.isArray(parsed.nightlifeTagIds)
      ? parsed.nightlifeTagIds.filter((id): id is string => typeof id === "string" && validNightlifeIds.has(id))
      : [];
    if (nightlifeWanted > 0 && nightlifeTagIds.length === 0) {
      nightlifeTagIds = NIGHTLIFE_TAG_IDS.slice(0, DEFAULT_FALLBACK_NIGHTLIFE_TAG_IDS_COUNT);
    }

    // *** רשת ביטחון נוספת: אם המודל בכל זאת החזיר הכל אפסים (למשל ניסוח
    // כללי לגמרי שהוא לא זיהה כ"בקשה מגוונת" למרות ההנחיה בפרומפט) -
    // ברירת מחדל של יום כללי, כדי שלעולם לא נחזיר תוצאה ריקה על בקשה
    // תקינה. אם המשתמש כן ביקש משהו ספציפי (attractionsWanted/
    // restaurantsWanted/nightlifeWanted > 0 כבר בשלב הזה), לא נוגעים בזה.
    // *** תיקון (בקשת המשתמש - "אין יותר אפשרות של אטרקציות...יותר
    // משניים?"): הגבלה קשיחה ל-1 אטרקציה שנוסתה לפני זה הייתה יתר-
    // תיקון - במקום זה, הפתרון האמיתי לתלונה המקורית ("לא צריך 2
    // פארקים") הוא **גיוון** (לא לבחור 2 תחנות מאותה תת-קטגוריה), לא
    // צמצום הכמות - ר' pickCompactCluster/pickDiverseWithinBucket
    // ב-trippyQuickShared.ts. חזרה ל-2 אטרקציות + 1 מסעדה כברירת מחדל
    // ליום כללי.
    if (attractionsWanted === 0 && restaurantsWanted === 0 && nightlifeWanted === 0) {
      attractionsWanted = 2;
      restaurantsWanted = 1;
      attractionCategoryIds = DEFAULT_FALLBACK_ATTRACTION_CATEGORY_IDS;
    }

    // *** "בין 1-4 תוצאות" (בקשת המשתמש): מגבילים כאן, ברמת סה"כ
    // המכסות המבוקשות, לא רק תקווה שהפרומפט יצמצם בעצמו - כדי שגם אם
    // Claude יחזיר יותר, לא נבקש מה-DB יותר מ-4 תחנות בסה"כ. ה"עודף"
    // מגולח מהבאקט האחרון (nightlife -> restaurants -> attractions),
    // כדי לשמר קודם את מה שהמשתמש כנראה רצה בעדיפות (אטרקציות/מסעדות).
    const MAX_TOTAL_STOPS = 4;
    let total = attractionsWanted + restaurantsWanted + nightlifeWanted;
    while (total > MAX_TOTAL_STOPS) {
      if (nightlifeWanted > 0) {
        nightlifeWanted -= 1;
      } else if (restaurantsWanted > attractionsWanted) {
        restaurantsWanted -= 1;
      } else if (attractionsWanted > 0) {
        attractionsWanted -= 1;
      } else {
        break;
      }
      total = attractionsWanted + restaurantsWanted + nightlifeWanted;
    }

    return {
      title: typeof parsed.title === "string" ? parsed.title : "המסלול שלכם",
      city: typeof parsed.city === "string" ? parsed.city : null,
      regionLat: typeof parsed.regionLat === "number" && Number.isFinite(parsed.regionLat) ? parsed.regionLat : null,
      regionLng: typeof parsed.regionLng === "number" && Number.isFinite(parsed.regionLng) ? parsed.regionLng : null,
      attractionsWanted,
      attractionCategoryIds,
      restaurantsWanted,
      cuisineIds,
      restaurantNameKeyword,
      nightlifeWanted,
      nightlifeTagIds,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const freeText = typeof body?.freeText === "string" ? body.freeText.trim() : "";
  const clientLat = typeof body?.lat === "number" ? body.lat : null;
  const clientLng = typeof body?.lng === "number" ? body.lng : null;
  if (!freeText) {
    return NextResponse.json({ error: "חסר מלל חופשי" }, { status: 400 });
  }

  const supabase = await createClient();

  // *** מערכת "טריפים" (ר' migration 0063): "בניית טיול חדש באמצעות
  // Trippy AI" = הקריאה הזו בדיוק (POST הראשי כאן) - לא add-stop/swap
  // (routes נפרדים לגמרי, לא נוגעים בהם, ר' דרישה מפורשת #11 - "פעולות
  // פנימיות לא מחייבות שוב"). דורש התחברות (דרישה מפורשת #10 שלב 1) -
  // מכיוון ש-/ai מוגן ב-proxy.ts ממילא (אין guest allowed), זה לא משנה
  // שום flow אמיתי דרך ה-UI, רק סוגר קריאת API ישירה בלי חשבון.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  const userId = user.id;

  // חיוב אטומי *לפני* כל עבודה יקרה (Claude + שאילתות DB) - זה מה שסוגר
  // את חלון המרוץ: שתי בקשות מקבילות עם רק TOKEN_COSTS.trippy_ai_generation
  // טריפים ביחד ינעלו זו את זו על אותה שורת יתרה ב-Postgres (ר' consume_tokens), ורק אחת תצליח.
  // אם הפעולה בפועל תיכשל (Claude נכשל / 0 תוצאות) - מחזירים (refund)
  // למטה, בדיוק לפי הדרישה "לא לחייב אם הפעולה נכשלה".
  const chargeReferenceId = `trippy_ai_generation:${crypto.randomUUID()}`;
  let charge;
  try {
    charge = await consumeTokens(userId, TRIPPY_AI_COST, "trippy_ai_generation", chargeReferenceId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בבדיקת יתרת הטריפים" }, { status: 500 });
  }
  if (!charge.success) {
    return NextResponse.json(
      { error: "INSUFFICIENT_TOKENS", cost: TRIPPY_AI_COST, remainingTokens: charge.balance },
      { status: 402 }
    );
  }

  /** מחזירה את הטריפים (best-effort, לא חוסמת את התגובה) - נקראת מכל
   *  נקודת יציאה שבה בפועל לא הופק טיול שימושי אחרי חיוב מוצלח. */
  async function refundCharge() {
    try {
      await refundTokens(userId, TRIPPY_AI_COST, "trippy_ai_generation_refund", `${chargeReferenceId}:refund`);
    } catch (refundError) {
      console.error("[trippy-quick] refund failed:", refundError);
    }
  }

  let dnaContext = "";
  try {
    const dna = await getTravelDna(supabase, userId);
    dnaContext = buildDnaContext(dna);
  } catch {
    // לא קריטי - ממשיכים בלי הקשר פרופיל אם זה נכשל
  }

  const criteria = await extractCriteria(freeText, dnaContext);
  if (!criteria) {
    await refundCharge();
    return NextResponse.json({ stops: [], title: null, tokenBalance: charge.balance + TRIPPY_AI_COST });
  }

  console.log("[trippy-quick DEBUG] קריטריונים שחולצו", { freeText, criteria, clientLat, clientLng });

  // *** תיקון (בקשת המשתמש - "מסלול בטבע ליד הכנרת - למה לא נמצא"):
  // כשיש קואורדינטות אזור (regionLat/regionLng, ר' ExtractedCriteria) -
  // הן גוברות על מיקום המכשיר לגמרי, כי המשתמש ציין מפורשות איפה
  // הוא רוצה, לא איפה הוא נמצא פיזית. hasExplicitLocation (מועבר
  // כפרמטר hasExplicitCity לפונקציות המשותפות - אותה משמעות בפועל:
  // "אל תגביל ל-10 ק"מ הדוקים") נכון גם לעיר וגם לאזור - שניהם מיקום
  // *מפורש* שהמשתמש ציין, לא סתם "המכשיר איפה שהוא".
  const hasRegion = criteria.regionLat != null && criteria.regionLng != null;
  const hasExplicitCity = criteria.city != null || hasRegion;
  const location = {
    lat: hasRegion ? criteria.regionLat : clientLat,
    lng: hasRegion ? criteria.regionLng : clientLng,
    city: criteria.city,
  };

  // *** תוספת (בקשת המשתמש - "פער של עד קילומטר בין אטרקציה לאטרקציה!
  // לא מעבר!!"): שולפים "בריכת" מועמדים גדולה יותר מהמכסה הסופית
  // (poolSize) מכל באקט, כדי ש-pickCompactCluster אחר-כך יוכל לבחור
  // תת-קבוצה שבאמת קרובה גיאוגרפית זו לזו - לא רק את המדורגים ביותר
  // בלי קשר למרחק ההדדי ביניהם.
  const CLUSTER_POOL_SIZE = 15;
  const [attractionPool, restaurantPool, nightlifePool] = await Promise.all([
    fetchAttractionPlaces({
      supabase,
      location,
      hasExplicitCity,
      limit: criteria.attractionsWanted,
      poolSize: criteria.attractionsWanted > 0 ? CLUSTER_POOL_SIZE : 0,
      attractionCategoryIds: criteria.attractionCategoryIds,
    }),
    criteria.restaurantNameKeyword
      ? fetchPlacesByNameKeyword({
          supabase,
          location,
          limit: criteria.restaurantsWanted > 0 ? CLUSTER_POOL_SIZE : 0,
          keyword: criteria.restaurantNameKeyword,
        })
      : fetchRestaurantPlaces({
          supabase,
          location,
          hasExplicitCity,
          limit: criteria.restaurantsWanted,
          poolSize: criteria.restaurantsWanted > 0 ? CLUSTER_POOL_SIZE : 0,
          cuisineIds: criteria.cuisineIds,
        }),
    fetchNightlifePlaces({
      supabase,
      location,
      hasExplicitCity,
      limit: criteria.nightlifeWanted,
      poolSize: criteria.nightlifeWanted > 0 ? CLUSTER_POOL_SIZE : 0,
      nightlifeTagIds: criteria.nightlifeTagIds,
    }),
  ]);

  // *** תוספת (בקשת המשתמש - "ג'סמינו בכלל סגור בשבת"): מסננים מקומות
  // סגורים ביום המבוקש **לפני** הקיבוץ הגיאוגרפי (pickCompactCluster) -
  // כדי שלא ניבחר עוגן/שכנים שממילא סגורים, ולא רק "נסמן" מקום סגור
  // שכבר נבחר.
  const requestedDayOfWeek = detectRequestedDayOfWeek(freeText);
  const attractionPoolOpen = attractionPool.filter((p) => isOpenOnDayOrUnknown(p, requestedDayOfWeek));
  const restaurantPoolOpen = restaurantPool.filter((p) => isOpenOnDayOrUnknown(p, requestedDayOfWeek));
  const nightlifePoolOpen = nightlifePool.filter((p) => isOpenOnDayOrUnknown(p, requestedDayOfWeek));

  const { attraction: attractionPlaces, restaurant: restaurantPlaces, nightlife: nightlifePlaces } = pickCompactCluster(
    { attraction: attractionPoolOpen, restaurant: restaurantPoolOpen, nightlife: nightlifePoolOpen },
    { attraction: criteria.attractionsWanted, restaurant: criteria.restaurantsWanted, nightlife: criteria.nightlifeWanted }
  );

  const stops = [
    ...attractionPlaces.map((p) => toStop(p, "attraction", criteria.attractionCategoryIds)),
    ...restaurantPlaces.map((p) => toStop(p, "restaurant", criteria.cuisineIds, criteria.restaurantNameKeyword)),
    ...nightlifePlaces.map((p) => toStop(p, "nightlife", criteria.nightlifeTagIds)),
  ].filter((s): s is TrippyQuickStop => s !== null);

  console.log("[trippy-quick DEBUG] תוצאות שליפה", {
    requestedDayOfWeek,
    attractionsPoolCount: attractionPool.length,
    attractionsPoolOpenCount: attractionPoolOpen.length,
    restaurantsPoolCount: restaurantPool.length,
    restaurantsPoolOpenCount: restaurantPoolOpen.length,
    nightlifePoolCount: nightlifePool.length,
    nightlifePoolOpenCount: nightlifePoolOpen.length,
    attractionsClusteredCount: attractionPlaces.length,
    restaurantsClusteredCount: restaurantPlaces.length,
    nightlifeClusteredCount: nightlifePlaces.length,
    finalStopsCount: stops.length,
    hasExplicitCity,
  });

  // *** תיקון אדריכלי (בקשה מפורשת - "לא צריך שום טבלה משותפת - צריך
  // טבלה חדשה - trippy AI"): לפני זה נשמר כאן "session" מזויף בטבלה
  // trip_builder_sessions (אותה טבלה של טיולי יום/חופשה אמיתיים,
  // עם trip_type="day_trip" מומצא כי לא היה ערך ייעודי) - זה גרם
  // לתוצאות טיול-מהיר להתערבב עם טיולים אמיתיים ב"הטיולים שלי".
  // עכשיו: טבלה נפרדת לגמרי (trippy_ai_results, ר' migration 0057),
  // עם המבנה הפשוט שבאמת מתאים כאן - מערך התחנות השטוח (stops) כמו
  // שהוא, בלי "להתחפש" ל-FinalItinerary עם שדות מזויפים.
  // *** מערכת "טריפים": 0 תוצאות = שום טיול לא הופק בפועל (גם savedId
  // תמיד יישאר null במקרה הזה, ר' התנאי stops.length > 0 למטה) - נחשב
  // "הפעולה נכשלה", אז מחזירים את החיוב.
  if (stops.length === 0) {
    await refundCharge();
  }

  let savedId: string | null = null;
  let shareToken: string | null = null;
  if (stops.length > 0) {
    try {
      const { data: saved } = await supabase
        .from("trippy_ai_results")
        .insert({
          user_id: userId,
          title: criteria.title,
          free_text: freeText,
          stops,
          search_context: { city: criteria.city, lat: location.lat, lng: location.lng },
        })
        .select("id,share_token")
        .single();
      savedId = saved?.id ?? null;
      shareToken = saved?.share_token ?? null;
    } catch (saveError) {
      // כשל שמירה לא אמור לחסום את התוצאה עצמה מלהגיע למשתמש - רק לוג.
      // ה-stops עצמם כבר הופקו בהצלחה, אז החיוב *לא* מוחזר במקרה הזה -
      // המשתמש קיבל טיול אמיתי לצפייה, רק לא ישמר ל"הטיולים שלי".
      logAiError("trippy-quick: שמירת trippy_ai_results נכשלה", { error: saveError instanceof Error ? saveError.message : saveError });
    }
  }

  return NextResponse.json({
    stops,
    title: criteria.title,
    // *** מזהה השורה השמורה ב-trippy_ai_results (null אם לא נשמר -
    // למשל משתמש לא מחובר) - כדי שהלקוח יוכל לנווט חזרה לתוצאה הזו
    // מ"הטיולים שלי" (ר' MyTripsSection.tsx) גם אחרי רענון/סגירת טאב,
    // בלי תלות ב-sessionStorage.
    savedId,
    // *** תוספת (בקשה מפורשת - "אפשרות לשמירה ושיתוף"): טוקן לקישור
    // ציבורי read-only (ר' migration 0058 + /api/trippy-ai/shared/[token]).
    shareToken,
    // *** תוספת (בקשה מפורשת - כפתור "החלף" ליד כל תחנה): נשלח ללקוח
    // כדי שהחלפה יחידה (swap/route.ts) תוכל לחפש שוב באותם קריטריונים
    // בדיוק, בלי לקרוא ל-Claude שוב.
    // *** תיקון (בקשת המשתמש - "החלפת המסלול לא עובדת!!" - כשהחיפוש
    // המקורי השתמש בקואורדינטות אזור [regionLat/regionLng, למשל ליד
    // הכנרת] ולא בעיר, ה-swap לא ידע את זה - הוא השתמש במיקום *המכשיר*
    // בפועל (רחוק, לפעמים מאוד). עכשיו שולחים ללקוח את המיקום שבאמת
    // *נעשה בו שימוש* בחיפוש (location, לא רק city) - כך שה-swap
    // תמיד מחפש באותו אזור בדיוק שהחיפוש המקורי מצא בו תוצאות.
    searchContext: { city: criteria.city, lat: location.lat, lng: location.lng },
    // *** מערכת "טריפים": היתרה המעודכנת אחרי החיוב (או אחרי refund אם
    // stops.length===0, ר' למעלה) - כדי שהלקוח יוכל לעדכן תצוגה בלי fetch נוסף.
    tokenBalance: stops.length === 0 ? charge.balance + TRIPPY_AI_COST : charge.balance,
  });
}
