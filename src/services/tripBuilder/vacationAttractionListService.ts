import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceName } from "./geocodingService";
import { findPlacePhotoReference } from "./placePhotoService";
import type { CandidatePlace, StopRole } from "./types";

interface GenerateListParams {
  destination: string;
  totalFood: number;
  totalAttractions: number;
  vacationTypeLabels: string[];
  freeText: string;
  budgetLabel: string;
  travelDnaSummary?: string | null;
}

interface RawSuggestion {
  name: string;
  role: "food" | "attraction" | "coffee_dessert";
  category: string;
  description: string;
  reason: string;
}

/**
 * מייצר רשימה שלמה של מקומות אמיתיים ליעד, בקריאת Claude אחת - לא קריאה
 * נפרדת לכל תחנה. פותר גם את בעיית המהירות (קריאה אחת במקום עשרות) וגם
 * את בעיית הכפילויות (Claude לא חוזר על עצמו בתוך רשימה אחת שהוא כותב).
 */
export async function generateVacationAttractionList(
  params: GenerateListParams
): Promise<(CandidatePlace & { role: StopRole })[]> {
const total = params.totalFood + params.totalAttractions;
  const prompt = `אתה מומחה תיירות עולמי עם ידע עמוק על ${params.destination}. תן לי רשימה של ${total} מקומות **אמיתיים, קיימים בפועל, ומהמפורסמים/הפופולריים ביותר** ב${params.destination} - אלה שכל תייר/מקומי ימליץ עליהם, לא מקומות נידחים או מומצאים. וללא כפילויות.

מתוכם:
- ${params.totalAttractions} אטרקציות/אתרים/נקודות עניין מובילות (role: "attraction")
- ${params.totalFood} מהמסעדות/בתי הקפה הכי מוכרים ומדוברים (role: "food" או "coffee_dessert")

*** משקל ההחלטה: הבקשה בטקסט החופשי למטה היא הגורם המשמעותי ביותר (כ-80%
מההחלטה) - אם היא מזכירה העדפה ספציפית (אוכל, אווירה, סוג אתרים, קצב, תקציב
בפועל) זה גובר על כל שאר הפרמטרים. סוג החופשה ופרופיל הטעם משניים (כ-20%). ***

סוג החופשה: ${params.vacationTypeLabels.join(", ") || "כל סוג"}
תקציב: ${params.budgetLabel}
${params.travelDnaSummary ? `פרופיל טעם קודם של המשתמש: ${params.travelDnaSummary}` : ""}
בקשה חופשית מהמשתמש (המשקל הגבוה ביותר): ${JSON.stringify(params.freeText || null)}

לכל מקום תן:
- name: השם **בעברית** אם יש לו שם עברי מוכר/מקובל (למשל "האקרופוליס", "מגדל אייפל") - אחרת השם המקורי בלעז
- role: "attraction" | "food" | "coffee_dessert"
- category: קטגוריה קצרה (לועזית, snake_case)
- description: משפט אחד בעברית
- reason: משפט אחד למה זה מתאים לבקשה הספציפית של המשתמש

חשוב מאוד: החזר JSON תקין בלבד. אל תשתמש בגרשיים בודדים (') בתוך הטקסט (למשל
בשמות מקומות או בתיאורים) - אם יש צורך, השמט אותם או נסח מחדש בלי גרש.

השב אך ורק במבנה JSON: [{"name": "...", "role": "...", "category": "...", "description": "...", "reason": "..."}, ...]`;

  // רשימה גדולה (עד ~30 מקומות עם תיאורים) לוקחת ל-Claude יותר מה-timeout
  // הרגיל (12 שניות) - נותנים לה עד 50 שניות, כי זו קריאה אחת בלבד לכל הטיול
  const { text, error } = await callClaude(prompt, 8000, 50000);
  if (error || !text) return [];

let raw: RawSuggestion[];
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    raw = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    const recovered = tryRecoverPartialJson(text);
    if (recovered && recovered.length > 0) {
      raw = recovered;
    } else {
      logAiError("כשל בפענוח רשימת אטרקציות חופשה", {
        message: parseError instanceof Error ? parseError.message : String(parseError),
      });
      return [];
    }
  }

// geocoding + תמונה, שניהם במקביל לכל מקום - לא מוסיף זמן, כי זה כבר רץ
  // בו-זמנית לכל הפריטים ברשימה, לא ברצף
  const results = await Promise.all(
    raw.map(async (item) => {
      const [coords, photoRef] = await Promise.all([
        geocodePlaceName(`${item.name}, ${params.destination}`),
        findPlacePhotoReference(`${item.name} ${params.destination}`),
      ]);
      if (!coords) return null;
      const imageUrls = photoRef ? [`/api/places/photo?ref=${encodeURIComponent(photoRef)}`] : [];
      return {
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        category: item.category,
        subcategory: null,
        shortDescription: item.description,
        imageUrls,
        rating: null,
        ratingCount: null,
        priceLevel: null,
        estimatedVisitMinutes: item.role === "food" ? 75 : 90,
        latitude: coords.lat,
        longitude: coords.lng,
        distanceKm: 0,
        etaMinutes: 0,
        tripTypeTags: [item.category],
        cuisineTags: [],
        kosher: null,
        accessible: null,
        suitableChildAges: [],
        budgetTier: null,
        isAreaExperience: false,
        role: item.role as StopRole,
        reason: item.reason,
      } as CandidatePlace & { role: StopRole };
    })
  );

  return results.filter((r): r is CandidatePlace & { role: StopRole } => r !== null);
}
/**
 * מנסה לשחזר רשימה חלקית מ-JSON פגום - קוצץ עד לסגירת האובייקט התקין
 * האחרון (חיפוש "}," אחרון) ומנסה לפרסר מחדש. עדיף רשימה חלקית על ויתור
 * מוחלט על כל היעד.
 */
function tryRecoverPartialJson(text: string): RawSuggestion[] | null {
  const startIndex = text.indexOf("[");
  if (startIndex === -1) return null;

  const lastGoodClose = text.lastIndexOf("},");
  if (lastGoodClose === -1 || lastGoodClose < startIndex) return null;

  const truncated = text.slice(startIndex, lastGoodClose + 1) + "]";
  try {
    return JSON.parse(truncated);
  } catch {
    return null;
  }
}