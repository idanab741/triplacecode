import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import { findPlacePhotoReference } from "@/services/tripBuilder/placePhotoService";
import { TRIPMATCH_INTEREST_OPTIONS } from "@/locales/he/tripBuilder";

interface GeneratedAttraction {
  name: string;
  description: string;
  interest: string;
}

function labelForInterest(id: string): string {
  return TRIPMATCH_INTEREST_OPTIONS.find((o) => o.value === id)?.label ?? id;
}

/**
 * מייצר רשימת אטרקציות אמיתיות ליעד (עיר) שאין לו עדיין מועמדים ב-DB - למשל
 * "פריז", "רומא" וכו'. Claude יוצר את הרשימה מהידע הכללי שלו, כל אטרקציה
 * מקבלת תמונה אמיתית מ-Google (פעם אחת), והתוצאה נשמרת ב-DB כך שהיא זמינה
 * לכל משתמש עתידי שיבחר את אותו יעד, בלי לייצר מחדש.
 */
export async function generateAndSaveDestinationAttractions(
  supabase: SupabaseClient,
  city: string,
  interests: string[]
): Promise<void> {
  const generated = await generateAttractionsWithClaude(city, interests);
  if (generated.length === 0) return;

  const cityCoords = await geocodePlaceName(city);

  for (const attraction of generated) {
    const photoRef = await findPlacePhotoReference(`${attraction.name} ${city}`);
    const imageUrls = photoRef ? [`/api/places/photo?ref=${encodeURIComponent(photoRef)}`] : [];

    await supabase.from("places").insert({
      name: attraction.name,
      short_description: attraction.description,
      city,
      latitude: cityCoords?.lat ?? null,
      longitude: cityCoords?.lng ?? null,
      category: attraction.interest,
      trip_type_tags: [attraction.interest],
      image_urls: imageUrls,
    });
  }
}

async function generateAttractionsWithClaude(
  city: string,
  interests: string[]
): Promise<GeneratedAttraction[]> {
  const interestLabels = interests.length > 0 ? interests.map(labelForInterest) : ["אטרקציות כלליות"];

  const prompt = `אתה מכיר היטב יעדי טיולים ברחבי העולם. עבור היעד "${city}", צור רשימה של 10-12
אטרקציות אמיתיות ומוכרות, שמתאימות לתחומי העניין הבאים: ${interestLabels.join(", ")}.

לכל אטרקציה צור: שם אמיתי ומדויק, תיאור קצר (משפט אחד, עד 20 מילים), והתאמה לאחד
מתחומי העניין שסופקו.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
[{"name": "...", "description": "...", "interest": "אחד מהערכים: ${interests.join(", ")}"}]`;

  const { text, error } = await callClaude(prompt, 2048);
  if (error || !text) return [];

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as GeneratedAttraction[];
    return parsed.filter((a) => a.name && a.description);
  } catch (parseError) {
    logAiError("כשל ביצירת אטרקציות ליעד", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      city,
    });
    return [];
  }
}