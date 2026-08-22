import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "./types";
import { hasInfantAgeBand } from "./types";
import type { TripIntent } from "./tripIntentService";

/** משותף בין childAgeBonus (תינוק) ל-weatherBonus - "outdoor" מובהק
 *  (Audit מול "עצור רגע... פעילות שמתאימה לקצב משפחתי" - חשיפה ממושכת
 *  לשמש/חום היא שיקול תינוק בפני עצמו, לא רק שיקול מזג אוויר). קבוע
 *  ברמת המודול (לא בתוך הפונקציה) כדי שיהיה ניתן לשימוש גם לפני
 *  ההגדרה המקורית וגם למניעת יצירה מחדש בכל קריאה. */
const INFANT_AND_WEATHER_OUTDOOR_CATEGORIES = new Set(["nature_trails", "beaches_pools", "viewpoints", "parks_gardens"]);
const INFANT_AND_WEATHER_INDOOR_CATEGORIES = new Set(["culture_history", "spa_relaxation", "shopping"]);

interface RankCandidatesParams {
  dna: TravelDna | null;
  candidates: CandidatePlace[];
  freeText: string;
  remainingBudgetLabel: string;
  rankingPromptRules: string;
  attributeScoreMap?: Map<string, number>;
  learnedAttributes?: {
    liked: string[];
    disliked: string[];
  };
  tripIntent?: TripIntent | null;
  /** תשובות השאלון בפועל (הרכב מטיילים, גילאים, תחומי עניין...) - עד עכשיו
   *  היו רק בפרומפט של decideCategoryPlan (בחירת סוגי התחנות), לא כאן
   *  (בחירת המקום הספציפי) - אף שהטקסט בפרומפט טען "15% תשובות שאלון".
   *  אופציונלי בכוונה: מוזן כרגע רק לטיול יומי, שאר הסוגים יתווספו בהמשך. */
  questionnaireAnswers?: Record<string, unknown>;
}

const MAX_CANDIDATES_FOR_AI_RANKING = 6;

export async function rankCandidates(
  params: RankCandidatesParams
): Promise<CandidatePlace[]> {
  if (params.candidates.length === 0) {
    return [];
  }

  // אופטימיזציה: כשיש מועמד יחיד, אין בכלל מה "לדרג" - קריאת Claude
  // שלמה כדי לבחור בין אפשרות אחת לעצמה היא בזבוז זמן טהור (וזו בדיוק
  // הסיבה לחלק ניכר מ"לוקח יותר מדי זמן" - בטיול יומי עם 3-4 תחנות,
  // רוב הקטגוריות במאגר מחזירות בפועל התאמה יחידה או שתיים).
  if (params.candidates.length === 1) {
    const only = params.candidates[0];
    return [
      {
        ...only,
        score: 100,
        reason: params.freeText ? `המקום היחיד שנמצא במאגר שמתאים ל"${params.freeText}"` : "המקום היחיד שנמצא במאגר בקטגוריה הזו",
        source: "fallback" as const,
      },
    ];
  }

  // לא מדרגים לפי מרחק אלא רק לפי דירוג מינימלי
  const reasonablyRated = params.candidates.filter(
    (candidate) => (candidate.rating ?? 3.5) >= 3.5
  );

  const pool =
    reasonablyRated.length >= MAX_CANDIDATES_FOR_AI_RANKING
      ? reasonablyRated
      : params.candidates;

  const preFiltered = [...pool]
    .sort(() => Math.random() - 0.5)
    .slice(0, MAX_CANDIDATES_FOR_AI_RANKING);

  const aiRanked = await tryClaudeRanking({
    ...params,
    candidates: preFiltered,
  });

  if (aiRanked) {
    return aiRanked;
  }

  return applyFallbackScoring(params.candidates, params.dna, params.freeText, params.attributeScoreMap);
}

/**
 * תיקון ביצועים (בקשה מפורשת): גרסה מהירה, בלי שום קריאת AI, של אותה
 * לוגיקת דירוג בדיוק (computeFallbackScore - כבר "מנוסה בקרב" כ-fallback
 * הרגיל כשקריאת Claude נכשלת/מדלגים עליה). משמשת בלולאת "מילוי מהמאגר
 * הפנימי" של חופשה בחו"ל/סופ"ש (auto-build/route.ts): כשיש 20-40 תחנות
 * בטיול, קריאת rankCandidates הרגילה (עם Claude) לכל תחנה בנפרד, ברצף,
 * הייתה הגורם המרכזי לזמן המתנה של עשרות שניות - כל תחנה עם יותר ממועמד
 * אחד הפעילה קריאת AI נוספת. כשיש כבר מאגר admin places אמיתי ומתויג,
 * דירוג לפי דירוג Google + התאמת מלל חופשי (בלי AI) מספיק טוב ומיידי -
 * לא צריך "לחשוב" עם Claude על כל תחנה בנפרד כדי לבחור מקום אחד מתוך כמה.
 */
export function rankCandidatesFast(
  candidates: CandidatePlace[],
  dna: TravelDna | null,
  freeText: string,
  attributeScoreMap?: Map<string, number>,
  // תיקון פער אמיתי שאותר ב-Audit מול MASTER SPEC סעיף 168: אף מקום
  // בדירוג לא שקל בכלל התאמת גיל ילדים (suitableChildAges), למרות
  // שהנתון קיים ב-DB ועובר עד ל-payload של הדירוג-דרך-Claude. פרמטר
  // אופציונלי - ברירת מחדל undefined, אפס שינוי לכל קורא קיים (טיול
  // יומי/טבע/מסעדות) שלא יעביר אותו; רק סופ"ש/חופשה בחו"ל יעבירו בפועל.
  childAgeBands?: string[],
  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 3 - "Companion Fit
  // צריך להשפיע על Ranking"): בדקתי בפועל אילו תגיות DB קיימות (לא
  // המצאתי) - יש place_dna_tag אמיתי בשם "romantic" ו-"family_friendly"
  // (migration 0016). אין תג מקביל ל-friends/solo/group בכלל - לכן זה
  // מכסה רק couple/family, לא friends/solo (BLOCKED שם, לא PARTIAL -
  // אין נתון קיים לבסס עליו bonus, לא נמציא אחד).
  companions?: string[],
  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 68 - "Weather צריך
  // להשפיע על Ranking, לא רק Prompt"): flags מבוססי WMO code אמיתי
  // (getWeatherFlags), לא ניחוש. משפיע רק כ-soft bonus/penalty בתוך
  // ה-Intent הקיים (לא מחליף/מסנן קטגוריות).
  weatherFlags?: { isRainy: boolean; isExtremeHeat: boolean } | null
): CandidatePlace[] {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    return [{ ...candidates[0], score: 100, reason: "המקום היחיד שנמצא במאגר בקטגוריה הזו", source: "fallback" as const }];
  }
  return applyFallbackScoring(candidates, dna, freeText, attributeScoreMap, childAgeBands, companions, weatherFlags);
}

function applyFallbackScoring(
  candidates: CandidatePlace[],
  dna: TravelDna | null,
  freeText: string,
  attributeScoreMap?: Map<string, number>,
  childAgeBands?: string[],
  companions?: string[],
  weatherFlags?: { isRainy: boolean; isExtremeHeat: boolean } | null
): CandidatePlace[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: computeFallbackScore(dna, candidate, freeText, attributeScoreMap, childAgeBands, companions, weatherFlags),
      reason: freeText ? `התאמה לפי "${freeText}", מרחק ודירוג` : "התאמה בסיסית לפי מרחק ודירוג",
      source: "fallback" as const,
    }))
    .sort((a, b) => (b.score ?? 0) + Math.random() * 2 - ((a.score ?? 0) + Math.random() * 2));
}

async function tryClaudeRanking(
  params: RankCandidatesParams
): Promise<CandidatePlace[] | null> {
  const dnaSummary = describeDna(
    params.dna,
    params.learnedAttributes
  );

const candidatesPayload = params.candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    category: getCategoryLabel(candidate.category),
    subcategory_tags: candidate.tripTypeTags,
    cuisine_tags: candidate.cuisineTags,
    // תיוגים עדינים שאדמין קבע ידנית לכל מקום (PLACE_TYPE_TAGS/
    // TRIPMATCH_TAGS/DNA_TAGS) - למשל ההבדל בין "עגלת קפה" ל"בית קפה
    // יושב", או סגנון מדויק של אטרקציה. עד עכשיו זה נשמר ב-DB אבל
    // מעולם לא הגיע לפרומפט הזה - הדירוג "לא ידע" שהתיוג הזה קיים בכלל.
    detailed_tags: (candidate.tags ?? []).length > 0 ? candidate.tags!.map(getCategoryLabel) : undefined,
    description: candidate.shortDescription,
    distance_km: Math.round(candidate.distanceKm * 10) / 10,
    price_level: candidate.priceLevel,
    rating: candidate.rating,
    kosher: candidate.kosher,
    accessible: candidate.accessible,
    suitable_child_ages: candidate.suitableChildAges,
    budget_tier: candidate.budgetTier,
  }));

const prompt = `${params.rankingPromptRules}

*** חשוב: כל מועמד כולל subcategory_tags (תגי תת-קטגוריה מדויקים, כמו "בית קפה עם נוף",
"נגישות לעגלה" וכו') ו-accessible/suitable_child_ages/budget_tier - אלה נתונים אמיתיים
שתויגו מראש, לא ניחוש. תמיד תבדוק אותם לפני שאתה קובע התאמה. אם ה-subcategory_tags של
מקום כן תואמים את מה שהמשתמש ביקש (למשל "נגישות לעגלה" כשהמשתמש ביקש עגלה, או תג שמרמז
על טבע/נוף) - ציין את זה במפורש ב-reason, זה הבסיס האמין ביותר להתאמה.

בנוסף, חלק מהמועמדים כוללים detailed_tags - תיוג עדין ומדויק במיוחד שאדמין קבע ידנית
לכל מקום (למשל ההבדל בין "עגלת קפה" ל"בית קפה יושב", או סגנון מדויק של אטרקציה/מסלול).
כשקיים - זה המקור **המדויק ביותר** לזיהוי סוג המקום בפועל, מדויק יותר מ-category/
subcategory_tags הכלליים. אם המלל החופשי ביקש משהו ספציפי (למשל "עגלת קפה", לא בית קפה
כללי) - חפש קודם כל התאמה ב-detailed_tags, לא רק ב-category הגס. מועמד עם detailed_tags
שתואמים במדויק עדיף על מועמד "כללי" מאותה קטגוריה, גם אם דירוג הכוכבים שלו נמוך יותר.

אם לתחנה מסוימת חסר תיאור (description=null) וגם אין לה subcategory_tags רלוונטיים -
אסור לך לטעון "התאמה מדויקת" או "תואם בדיוק". במקרה כזה נסח את ה-reason בזהירות ("יתכן ש...",
"בהיעדר מידע נוסף...", "לפי הקטגוריה בלבד..."), ואל תמציא פרטים שאין לך דרך לדעת. ***

*** מסמך כוונת הטיול (Trip Intent) - כבר סיכם עבורך את הבנת המשתמש, השתמש בו כבסיס עיקרי: ***
${JSON.stringify(params.tripIntent ?? { note: "לא זמין - נתח את המלל החופשי ישירות" })}

Travel DNA:
${JSON.stringify(dnaSummary)}

${params.questionnaireAnswers ? `תשובות המשתמש בשאלון (משקל 15% בהחלטה - לא רק המלל החופשי):
${JSON.stringify(params.questionnaireAnswers)}

` : ""}מלל חופשי מהמשתמש:
${JSON.stringify(params.freeText || null)}

תקציב שנותר:
${params.remainingBudgetLabel}

מועמדים:
${JSON.stringify(candidatesPayload)}

השב אך ורק במבנה JSON הבא:

[
  {
    "id":"...",
    "score":95,
    "reason":"..."
  }
]`;

  const { text, error } = await callClaude(prompt);

  if (error || !text) {
    return null;
  }

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw new Error("לא נמצא JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      id: string;
      score: number;
      reason: string;
    }[];

    const scoreById = new Map(
      parsed.map((item) => [item.id, item])
    );

    const ranked: CandidatePlace[] = [];

    for (const candidate of params.candidates) {
      const match = scoreById.get(candidate.id);

      if (!match) {
        continue;
      }

      ranked.push({
        ...candidate,
        score: Math.max(
          0,
          Math.min(100, Math.round(match.score))
        ),
        reason: match.reason,
        source: "ai",
      });
    }

// רעש קטן שובר שוויון בין ציונים קרובים - מונע אותה תוצאה בדיוק בכל פעם
    ranked.sort((a, b) => ((b.score ?? 0) + Math.random() * 2) - ((a.score ?? 0) + Math.random() * 2));

    return ranked.length ? ranked : null;
  } catch (parseError) {
    logAiError("כשל בפענוח תשובת Claude", {
      message:
        parseError instanceof Error
          ? parseError.message
          : String(parseError),
      rawText: text.slice(0, 300),
    });

    return null;
  }
}

function describeDna(
  dna: TravelDna | null,
  learnedAttributes?: {
    liked: string[];
    disliked: string[];
  }
) {
  const base = dna
    ? {
        interests: dna.interests.map(getCategoryLabel),
        culinary_styles: dna.culinary_styles,
        dietary_restrictions: dna.dietary_restrictions,
        kosher: dna.kosher,
        accessibility: dna.accessibility,
        preferred_categories_from_behavior:
          dna.preferred_categories.map(getCategoryLabel),
        disliked_categories_from_behavior:
          dna.disliked_categories.map(getCategoryLabel),
      }
    : {
        note: "אין עדיין מידע על המשתמש",
      };

  if (
    learnedAttributes &&
    (learnedAttributes.liked.length ||
      learnedAttributes.disliked.length)
  ) {
    return {
      ...base,
      learned_from_swipes_liked:
        learnedAttributes.liked,
      learned_from_swipes_disliked:
        learnedAttributes.disliked,
    };
  }

  return base;
}

const FREE_TEXT_SIZE_HINTS = {
  small: [
    "קטן",
    "קטן ושקט",
    "לא גדול",
    "שקט",
    "אינטימי",
  ],
  large: [
    "גדול",
    "מרכזי",
    "מפורסם",
    "ידוע",
  ],
};

function computeFallbackScore(
  dna: TravelDna | null,
  candidate: CandidatePlace,
  freeText: string,
  attributeScoreMap?: Map<string, number>,
  childAgeBands?: string[],
  companions?: string[],
  weatherFlags?: { isRainy: boolean; isExtremeHeat: boolean } | null
): number {
  const learnedBonus =
    (attributeScoreMap?.get(candidate.category) ?? 0) * 0.2;

  const ratingScore =
    candidate.rating != null
      ? (candidate.rating / 5) * 100
      : 50;

  // תיקון באג אמיתי (בקשה מפורשת - "התחנה הכי טובה יצאה במקרה הכי
  // רחוקה"): *20 הופך לאפס כל מועמד שמעל 5 ק"מ מהעוגן - בלי שום הבדל
  // בין 6 ק"מ ל-150 ק"מ. זה בסדר כשה-radius עצמו תמיד קטן (חיפוש
  // בין-תחנתי, INTER_STOP_RADIUS_KM=5), אבל rankCandidatesFast נקראת גם
  // על עוגן היום הראשון בסופ"ש/חופשה, שיכול להגיע לרדיוס של עשרות עד
  // מאות ק"מ (destinationMaxDistanceKm/WEEKEND_DAY_ANCHOR_RADIUS_KM) - שם
  // *20 הפך את "מרחק" ללא-רלוונטי לגמרי בפועל, והבחירה נעשתה בלי שום
  // העדפה לקרוב מתוך כל הרדיוס. *2 עדיין מעדיף חזק מקומות קרובים
  // (מתאפס ב-50 ק"מ במקום ב-5), אבל לא הופך את כל מה שמעבר ל-5 ק"מ
  // לזהה מבחינת האלגוריתם.
  const distanceScore = Math.max(0, 100 - candidate.distanceKm * 2);
  
  const likedSet = new Set([
    ...(dna?.interests ?? []),
    ...(dna?.preferred_categories ?? []),
  ]);

  const dislikedSet = new Set(
    dna?.disliked_categories ?? []
  );

  const profileBonus = likedSet.has(candidate.category)
    ? 15
    : 0;

  const profilePenalty = dislikedSet.has(candidate.category)
    ? 20
    : 0;

  let freeTextBonus = 0;

  const normalized = freeText.trim().toLowerCase();

  if (normalized) {
    const haystack = `${candidate.name} ${
      candidate.shortDescription ?? ""
    }`.toLowerCase();

    const words = normalized
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const directHits = words.filter((word) =>
      haystack.includes(word)
    ).length;

    freeTextBonus += directHits * 25;

    const wantsSmall =
      FREE_TEXT_SIZE_HINTS.small.some((hint) =>
        normalized.includes(hint)
      );

    const wantsLarge =
      FREE_TEXT_SIZE_HINTS.large.some((hint) =>
        normalized.includes(hint)
      );

    const looksLarge =
      /קניון|מרכז מסחרי|מרכז קניות|פארק שעשועים|אצטדיון|מגדל|כיכר מרכזית/.test(
        `${candidate.name} ${candidate.shortDescription ?? ""}`
      );

    if (wantsSmall && looksLarge) {
      freeTextBonus -= 30;
    }

    if (wantsLarge && looksLarge) {
      freeTextBonus += 10;
    }
  }

  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 168 - "Ranking צריך
  // להתחשב ב-... Companion Fit"): bonus חיובי כשלמקום יש תיוג gio מפורש
  // שמתאים לגילאי הילדים שהוזנו בשאלון - לא עונש כשאין תיוג בכלל (רוב
  // המקומות לא מתויגים suitable_child_ages, וזה לא אומר שהם לא מתאימים -
  // רק שאין לנו מידע. עונש על "לא ידוע" היה מעניש בטעות מקומות טובים
  // בלי סיבה אמיתית).
  //
  // תיקון מהותי (Audit מול "עצור רגע... childAgeBands=0-3 הוא לא
  // Preference רגיל"): קודם הבונוס היה זהה (12) לכל גילאי הילדים - אבל
  // תינוק (0-3) הוא מגבלה משמעותית בהרבה מ"ילד בן 10 שרוב האתרים בין
  // כה מתאימים לו" - כשיש תינוק בפועל, בונוס ההתאמה חייב לשקול הרבה
  // יותר מול distanceScore/ratingScore (25 נק' כל אחד), אחרת הוא
  // "נבלע" בקלות ע"י מקום קרוב/מדורג-גבוה שלא באמת מתאים לתינוק.
  const hasInfant = hasInfantAgeBand(childAgeBands ?? null);
  const childAgeBonus =
    childAgeBands && childAgeBands.length > 0 && candidate.suitableChildAges
      ? candidate.suitableChildAges.some((age) => childAgeBands.includes(age))
        ? hasInfant
          ? 30
          : 12
        : 0
      : 0;

  // תיקון (אותו Audit): כשיש תינוק, קטגוריות ממוזגות/מוצלות/פנימיות
  // מועדפות באופן קבוע (לא רק בגשם/חום קיצוני כמו weatherBonus למטה) -
  // חשיפה ממושכת לשמש/חום היא שיקול תינוק בפני עצמו, לא רק שיקול מזג
  // אוויר. אותה רשימת INDOOR_CATEGORIES המוגדרת כבר למטה לשימוש חוזר.
  const infantIndoorBonus = hasInfant && INFANT_AND_WEATHER_INDOOR_CATEGORIES.has(candidate.category) ? 6 : 0;

  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 3 - Companion Fit):
  // bonus רק כשיש תיוג DB אמיתי שתומך בו (place_dna_tag: romantic/
  // family_friendly) - לא ניחוש. "couple" בלבד (בלי family) -> bonus
  // ל-romantic. "family"/"family_no_kids" -> bonus ל-family_friendly.
  // friends/solo/with_pet - אין תג מקביל בכלל, בלי bonus (לא מומצא).
  const candidateTags = candidate.tags ?? [];
  const isCoupleOnly = companions?.length === 1 && companions[0] === "couple";
  const isFamily = companions?.some((c) => c === "family" || c === "family_no_kids") ?? false;
  const companionBonus =
    (isCoupleOnly && candidateTags.includes("romantic") ? 8 : 0) +
    (isFamily && candidateTags.includes("family_friendly") ? 8 : 0);

  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 68 - Weather Ranking):
  // קטגוריות outdoor/indoor מובהקות (מ-tripTaxonomy.ts, לא ניחוש) -
  // penalty קל ל-outdoor בגשם/חום קיצוני, bonus קל ל-indoor באותם
  // תנאים. לא מדובר בסינון/פסילה - זה soft signal בלבד, בתוך אותה
  // קטגוריה שהמשתמש כבר ביקש (למשל בין שתי אטרקציות טבע, לא בין טבע
  // לקניון). מזג אוויר נוח - בלי penalty/bonus כלל, לפי המפרט המפורש.
  const OUTDOOR_CATEGORIES = INFANT_AND_WEATHER_OUTDOOR_CATEGORIES;
  const INDOOR_CATEGORIES = INFANT_AND_WEATHER_INDOOR_CATEGORIES;
  let weatherBonus = 0;
  if (weatherFlags?.isRainy || weatherFlags?.isExtremeHeat) {
    if (OUTDOOR_CATEGORIES.has(candidate.category)) weatherBonus -= 6;
    if (INDOOR_CATEGORIES.has(candidate.category)) weatherBonus += 6;
  }

  const combined =
    ratingScore * 0.25 +
    distanceScore * 0.25 +
    profileBonus -
    profilePenalty +
    freeTextBonus * 1.5 +
    learnedBonus +
    childAgeBonus +
    infantIndoorBonus +
    companionBonus +
    weatherBonus;

  return Math.max(
    0,
    Math.min(100, Math.round(combined))
  );
}