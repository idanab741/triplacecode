import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "./types";
import type { TripIntent } from "./tripIntentService";

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
  attributeScoreMap?: Map<string, number>
): CandidatePlace[] {
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    return [{ ...candidates[0], score: 100, reason: "המקום היחיד שנמצא במאגר בקטגוריה הזו", source: "fallback" as const }];
  }
  return applyFallbackScoring(candidates, dna, freeText, attributeScoreMap);
}

function applyFallbackScoring(
  candidates: CandidatePlace[],
  dna: TravelDna | null,
  freeText: string,
  attributeScoreMap?: Map<string, number>
): CandidatePlace[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: computeFallbackScore(dna, candidate, freeText, attributeScoreMap),
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
  attributeScoreMap?: Map<string, number>
): number {
  const learnedBonus =
    (attributeScoreMap?.get(candidate.category) ?? 0) * 0.2;

  const ratingScore =
    candidate.rating != null
      ? (candidate.rating / 5) * 100
      : 50;

const distanceScore = Math.max(0, 100 - candidate.distanceKm * 20);
  
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

  const combined =
    ratingScore * 0.25 +
    distanceScore * 0.25 +
    profileBonus -
    profilePenalty +
    freeTextBonus * 1.5 +
    learnedBonus;

  return Math.max(
    0,
    Math.min(100, Math.round(combined))
  );
}