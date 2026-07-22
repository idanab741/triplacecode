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
}

const MAX_CANDIDATES_FOR_AI_RANKING = 6;

export async function rankCandidates(
  params: RankCandidatesParams
): Promise<CandidatePlace[]> {
  if (params.candidates.length === 0) {
    return [];
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

return params.candidates
    .map((candidate) => ({
      ...candidate,
      score: computeFallbackScore(
        params.dna,
        candidate,
        params.freeText,
        params.attributeScoreMap
      ),
      reason: params.freeText
        ? `התאמה לפי "${params.freeText}", מרחק ודירוג`
        : "התאמה בסיסית לפי מרחק ודירוג",
      source: "fallback" as const,
    }))
    .sort((a, b) => ((b.score ?? 0) + Math.random() * 2) - ((a.score ?? 0) + Math.random() * 2));
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
    description: candidate.shortDescription,
    distance_km: Math.round(candidate.distanceKm * 10) / 10,
    price_level: candidate.priceLevel,
    rating: candidate.rating,
  }));

const prompt = `${params.rankingPromptRules}

*** מסמך כוונת הטיול (Trip Intent) - כבר סיכם עבורך את הבנת המשתמש, השתמש בו כבסיס עיקרי: ***
${JSON.stringify(params.tripIntent ?? { note: "לא זמין - נתח את המלל החופשי ישירות" })}

Travel DNA:
${JSON.stringify(dnaSummary)}

מלל חופשי מהמשתמש:
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