import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { CandidatePlace } from "./types";

interface RankCandidatesParams {
  dna: TravelDna | null;
  candidates: CandidatePlace[];
  freeText: string;
  remainingBudgetLabel: string;
  rankingPromptRules: string;
}

/** מדרג מאגר מועמדים לתחנה נוכחית - קריאת Claude אחת למאגר כולו, לא לכל מועמד. */
export async function rankCandidates(params: RankCandidatesParams): Promise<CandidatePlace[]> {
  if (params.candidates.length === 0) return [];

  const aiRanked = await tryClaudeRanking(params);
  if (aiRanked) return aiRanked;

  return params.candidates
    .map((candidate) => ({
      ...candidate,
      score: computeFallbackScore(params.dna, candidate),
      reason: "התאמה בסיסית לפי מרחק ודירוג",
      source: "fallback" as const,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

async function tryClaudeRanking(params: RankCandidatesParams): Promise<CandidatePlace[] | null> {
  const dnaSummary = describeDna(params.dna);

  const candidatesPayload = params.candidates.map((c) => ({
    id: c.id,
    name: c.name,
    category: getCategoryLabel(c.category),
    description: c.shortDescription,
    distance_km: Math.round(c.distanceKm * 10) / 10,
    price_level: c.priceLevel,
    rating: c.rating,
  }));

  const prompt = `${params.rankingPromptRules}

Travel DNA:
${JSON.stringify(dnaSummary)}

מלל חופשי מהמשתמש: ${JSON.stringify(params.freeText || null)}
תקציב שנותר: ${params.remainingBudgetLabel}

מועמדים:
${JSON.stringify(candidatesPayload)}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף לפני או אחרי:
[{"id": "...", "score": 0-100, "reason": "..."}, ...]`;

  const { text, error } = await callClaude(prompt);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as { id: string; score: number; reason: string }[];

    const scoreById = new Map(parsed.map((item) => [item.id, item]));
    const ranked: CandidatePlace[] = [];
    for (const candidate of params.candidates) {
      const match = scoreById.get(candidate.id);
      if (!match) continue;
      ranked.push({
        ...candidate,
        score: Math.max(0, Math.min(100, Math.round(match.score))),
        reason: match.reason,
        source: "ai",
      });
    }
    ranked.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    return ranked.length > 0 ? ranked : null;
  } catch (parseError) {
    logAiError("כשל בפענוח תשובת JSON מ-Claude בדירוג מועמדים", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return null;
  }
}

function describeDna(dna: TravelDna | null) {
  if (!dna) {
    return { note: "אין עדיין מידע על המשתמש - יש להתייחס לכל המועמדים באופן ניטרלי" };
  }
  return {
    interests: dna.interests.map(getCategoryLabel),
    culinary_styles: dna.culinary_styles,
    dietary_restrictions: dna.dietary_restrictions,
    kosher: dna.kosher,
    accessibility: dna.accessibility,
    preferred_categories_from_behavior: dna.preferred_categories.map(getCategoryLabel),
    disliked_categories_from_behavior: dna.disliked_categories.map(getCategoryLabel),
  };
}

function computeFallbackScore(dna: TravelDna | null, candidate: CandidatePlace): number {
  const ratingScore = candidate.rating != null ? (candidate.rating / 5) * 100 : 50;
  const distanceScore = Math.max(0, 100 - candidate.distanceKm * 5);

  const likedSet = new Set([...(dna?.interests ?? []), ...(dna?.preferred_categories ?? [])]);
  const dislikedSet = new Set(dna?.disliked_categories ?? []);
  const profileBonus = likedSet.has(candidate.category) ? 15 : 0;
  const profilePenalty = dislikedSet.has(candidate.category) ? 20 : 0;

  const combined = ratingScore * 0.5 + distanceScore * 0.5 + profileBonus - profilePenalty;
  return Math.max(0, Math.min(100, Math.round(combined)));
}
