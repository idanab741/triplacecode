import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { getTravelDna, type TravelDna } from "@/services/travelDna/travelDnaService";
import { getWeeklyForecast } from "@/services/weather/weatherService";
import { describeWeatherCode } from "@/utils/weatherCodes";
import { getCategoryLabel } from "@/utils/categoryLabels";

export interface DestinationMatch {
  destination_id: string;
  score: number;
  reason: string;
  source: "ai" | "fallback";
}

interface DestinationRow {
  id: string;
  name: string;
  country: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  updated_at: string;
}

/**
 * מדרג רשימת יעדים (destinations) עבור משתמש, לפי ה-Travel DNA שלו.
 * משתמש ב-cache (destination_match_scores) - מחשב מחדש רק כש-DNA
 * או היעד עצמו השתנו מאז החישוב האחרון.
 */
export async function rankDestinations(
  supabase: SupabaseClient,
  userId: string,
  destinationIds: string[]
): Promise<DestinationMatch[]> {
  if (destinationIds.length === 0) return [];

  const dna = await getTravelDna(supabase, userId);

  const { data: destinations } = await supabase
    .from("destinations")
    .select("id,name,country,description,latitude,longitude,updated_at")
    .in("id", destinationIds);

  if (!destinations || destinations.length === 0) return [];

  const dnaUpdatedAt = dna?.updated_at ?? null;

  const { data: cached } = await supabase
    .from("destination_match_scores")
    .select("destination_id,score,reason,source,dna_updated_at,computed_at")
    .eq("user_id", userId)
    .in("destination_id", destinationIds);

  const cacheByDestination = new Map((cached ?? []).map((row) => [row.destination_id, row]));

  const fresh: DestinationMatch[] = [];
  const stale: DestinationRow[] = [];

  for (const destination of destinations as DestinationRow[]) {
    const cachedRow = cacheByDestination.get(destination.id);
    const isCacheValid =
      cachedRow &&
      cachedRow.dna_updated_at === dnaUpdatedAt &&
      new Date(cachedRow.computed_at) >= new Date(destination.updated_at);

    if (isCacheValid) {
      fresh.push({
        destination_id: destination.id,
        score: cachedRow.score,
        reason: cachedRow.reason,
        source: cachedRow.source as "ai" | "fallback",
      });
    } else {
      stale.push(destination);
    }
  }

  if (stale.length === 0) {
    return sortByScore(fresh);
  }

  const computed = await computeMatchesForDestinations(supabase, dna, stale);

  // רק תוצאות AI נשמרות ב-cache. תוצאות fallback לא נשמרות, כדי שננסה
  // שוב את Claude בפעם הבאה במקום להיתקע על ניקוד בסיסי לצמיתות.
  const aiResults = computed.filter((r) => r.source === "ai");
  if (aiResults.length > 0 && dnaUpdatedAt) {
    await supabase.from("destination_match_scores").upsert(
      aiResults.map((r) => ({
        user_id: userId,
        destination_id: r.destination_id,
        score: r.score,
        reason: r.reason,
        source: r.source,
        dna_updated_at: dnaUpdatedAt,
      })),
      { onConflict: "user_id,destination_id" }
    );
  }

  return sortByScore([...fresh, ...computed]);
}

async function computeMatchesForDestinations(
  supabase: SupabaseClient,
  dna: TravelDna | null,
  destinations: DestinationRow[]
): Promise<DestinationMatch[]> {
  const signals = await Promise.all(
    destinations.map(async (destination) => {
      const cityStats = await getCityStats(supabase, destination.name);
      const weather = await getDestinationWeatherSummary(destination);
      return { destination, cityStats, weather };
    })
  );

  const aiResult = await tryClaudeRanking(dna, signals);
  if (aiResult) return aiResult;

  // נסיגה: ניקוד בסיסי בלי AI, לפי חפיפת קטגוריות + פופולריות בלבד
  return signals.map(({ destination, cityStats }) => {
    const score = computeFallbackScore(dna, cityStats);
    return {
      destination_id: destination.id,
      score,
      reason: "התאמה בסיסית לפי ההעדפות שלך",
      source: "fallback" as const,
    };
  });
}

interface CityStats {
  categories: string[];
  avgRating: number | null;
  placeCount: number;
}

async function getCityStats(supabase: SupabaseClient, cityName: string): Promise<CityStats> {
  const { data } = await supabase.from("places").select("category,rating").eq("city", cityName);
  const rows = data ?? [];
  const categories = Array.from(new Set(rows.map((r) => r.category as string)));
  const ratings = rows.map((r) => r.rating as number | null).filter((r): r is number => r != null);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  return { categories, avgRating, placeCount: rows.length };
}

async function getDestinationWeatherSummary(destination: DestinationRow): Promise<string | null> {
  if (destination.latitude == null || destination.longitude == null) return null;
  try {
    const forecast = await getWeeklyForecast(destination.latitude, destination.longitude);
    const today = forecast[0];
    if (!today) return null;
    const { label } = describeWeatherCode(today.weatherCode);
    return `${label}, ${today.maxTemp}°/${today.minTemp}°`;
  } catch {
    return null;
  }
}

async function tryClaudeRanking(
  dna: TravelDna | null,
  signals: { destination: DestinationRow; cityStats: CityStats; weather: string | null }[]
): Promise<DestinationMatch[] | null> {
  const dnaSummary = describeDna(dna);

  const destinationsPayload = signals.map(({ destination, cityStats, weather }) => ({
    destination_id: destination.id,
    name: destination.name,
    country: destination.country,
    description: destination.description,
    available_categories: cityStats.categories.map(getCategoryLabel),
    average_rating: cityStats.avgRating,
    current_weather: weather,
    current_month: new Date().toLocaleDateString("he-IL", { month: "long" }),
  }));

  const prompt = `אתה מנוע ההתאמה של TRIPLACE. קיבלת פרופיל טעם משתמש (Travel DNA) ורשימת יעדי טיול.

עבור כל יעד, חשב ציון התאמה בין 0 ל-100 וכתוב נימוק קצר (משפט אחד בעברית) שמסביר למה.

התבסס אך ורק על הנתונים שסופקו: התאמה לתחומי העניין/העדפות המשתמש (available_categories, כשרות, נגישות וכו'), מזג האוויר הנוכחי, החודש הנוכחי (עונה), והפופולריות (average_rating). אל תניח נתונים שלא סופקו כאן (כמו תקציב, מרחק או מספר מטיילים) - הם לא זמינים בשלב זה.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף לפני או אחרי:
[{"destination_id": "...", "score": 0-100, "reason": "..."}, ...]

Travel DNA:
${JSON.stringify(dnaSummary)}

יעדים:
${JSON.stringify(destinationsPayload)}`;

  const { text, error } = await callClaude(prompt);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as { destination_id: string; score: number; reason: string }[];

    return parsed.map((item) => ({
      destination_id: item.destination_id,
      score: Math.max(0, Math.min(100, Math.round(item.score))),
      reason: item.reason,
      source: "ai" as const,
    }));
  } catch (parseError) {
    logAiError("כשל בפענוח תשובת JSON מ-Claude", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return null;
  }
}

function describeDna(dna: TravelDna | null) {
  if (!dna) {
    return { note: "אין עדיין מידע על המשתמש - יש להתייחס לכל היעדים באופן ניטרלי" };
  }
  return {
    interests: dna.interests.map(getCategoryLabel),
    culinary_styles: dna.culinary_styles,
    dietary_restrictions: dna.dietary_restrictions,
    kosher: dna.kosher,
    accessibility: dna.accessibility,
    vacation_preferences: dna.vacation_preferences,
    preferred_categories_from_behavior: dna.preferred_categories.map(getCategoryLabel),
    disliked_categories_from_behavior: dna.disliked_categories.map(getCategoryLabel),
  };
}

function computeFallbackScore(dna: TravelDna | null, cityStats: CityStats): number {
  if (!dna || cityStats.categories.length === 0) {
    return cityStats.avgRating != null ? Math.round((cityStats.avgRating / 5) * 60) : 50;
  }

  const likedSet = new Set([...dna.interests, ...dna.preferred_categories]);
  const dislikedSet = new Set(dna.disliked_categories);

  const overlap = cityStats.categories.filter((c) => likedSet.has(c)).length;
  const conflicts = cityStats.categories.filter((c) => dislikedSet.has(c)).length;

  const profileScore = likedSet.size > 0 ? (overlap / likedSet.size) * 100 : 50;
  const popularityScore = cityStats.avgRating != null ? (cityStats.avgRating / 5) * 100 : 50;

  const combined = profileScore * 0.8 + popularityScore * 0.2 - conflicts * 10;
  return Math.max(0, Math.min(100, Math.round(combined)));
}

function sortByScore(matches: DestinationMatch[]): DestinationMatch[] {
  return [...matches].sort((a, b) => b.score - a.score);
}
