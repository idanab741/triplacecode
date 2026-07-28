import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceNameNear } from "./geocodingService";
import { findPlacePhotoReference } from "./placePhotoService";
import { findExistingPlace } from "./aiPlaceInsertionService";
import { createAdminClient } from "@/services/supabase/admin";
import type { CandidatePlace, LatLng, StopRole } from "./types";

export interface VacationDaySpec {
  day: number;
  totalFood: number;
  totalAttractions: number;
}

interface GenerateItineraryParams {
  destination: string;
  destinationOrigin: LatLng;
  /** רדיוס סביר סביב מרכז היעד - מקומות שגיאוקודינג מחזיר מחוצה לו נפסלים. */
  maxDistanceKm: number;
  days: VacationDaySpec[];
  vacationTypeLabels: string[];
  freeText: string;
  budgetLabel: string;
  /** כולל גם העדפות אונבורדינג (מטבח/כשרות/נגישות/סגנון חופשה) וגם למידה מהתנהגות בעבר. */
  travelDnaSummary?: string | null;
}

interface RawSuggestion {
  day: number;
  name: string;
  role: "food" | "attraction" | "coffee_dessert";
  category: string;
  description: string;
  reason: string;
}

export type ResolvedVacationPlace = CandidatePlace & { role: StopRole; day: number };

/**
 * מייצר את כל רשימת המקומות לכל הטיול (כל הימים יחד) בקריאת Claude **אחת
 * בלבד** - לא קריאה נפרדת לכל יום. שני יתרונות קריטיים על פני קריאה-ליום:
 *
 * 1. מניעת כפילויות אמיתית: Claude רואה את כל הטיול בבת אחת ויכול לשמור על
 *    "בלי כפילויות" *לאורך כל הימים*, לא רק בתוך רשימה של יום בודד. קריאות
 *    מקבילות נפרדות לכל יום (הגישה הקודמת) לא יכולות למנוע חפיפה ביניהן,
 *    כי הן רצות בו-זמנית בלי לדעת אחת על השנייה.
 * 2. פחות טוקנים בסה"כ: כל קריאה נפרדת גוררת חזרה על אותו "boilerplate"
 *    (הנחיות, כללים, פרופיל טעם) - קריאה אחת חוסכת את הכפילות הזו, ופחות
 *    round-trips גם משפר זמן תגובה כולל.
 */
export async function generateVacationItinerary(
  params: GenerateItineraryParams
): Promise<ResolvedVacationPlace[]> {
  const totalPlaces = params.days.reduce((sum, d) => sum + d.totalFood + d.totalAttractions, 0);
  if (totalPlaces === 0) return [];

  const daysBreakdown = params.days
    .map((d) => `יום ${d.day}: ${d.totalAttractions} אטרקציות, ${d.totalFood} מקומות אוכל/קפה`)
    .join("\n");

  const prompt = `אתה מומחה תיירות עולמי עם ידע עמוק על ${params.destination}. בנה רשימת מקומות ל-${params.days.length} ימי חופשה שלמים ב${params.destination}.

*** חובה: כל מקום ברשימה **אמיתי, קיים בפועל, ומהמפורסמים/הפופולריים ביותר**
ביעד - כזה שכל תייר/מקומי ימליץ עליו. אסור מקומות נידחים, לא ידועים, או
מומצאים - איכות ופופולריות לפני הכל. ***

*** חובה: בלי שום כפילות **לאורך כל הטיול, בכל הימים יחד** - כל מקום מופיע
פעם אחת בלבד בכל הרשימה, גם אם הוא מתאים למספר ימים. ***

*** חובה: לכל יום בדיוק הכמות המבוקשת, לא פחות ולא יותר: ***
${daysBreakdown}

*** משקל ההחלטה: הבקשה בטקסט החופשי למטה היא הגורם המשמעותי ביותר (כ-80%
מההחלטה) - אם היא מזכירה העדפה ספציפית (אוכל, אווירה, סוג אתרים, קצב, תקציב
בפועל) זה גובר על כל שאר הפרמטרים. סוג החופשה ופרופיל הטעם (כולל העדפות
מהפרופיל האישי - מטבח, כשרות, נגישות, סגנון חופשה) משניים (כ-20%), אבל
אילוצים קשיחים כמו כשרות/נגישות/אלרגיות בפרופיל - חובה לכבד תמיד, לא רק
כ"בונוס". ***

סוג החופשה: ${params.vacationTypeLabels.join(", ") || "כל סוג"}
תקציב: ${params.budgetLabel}
${params.travelDnaSummary ? `פרופיל המשתמש (אונבורדינג + היסטוריית התנהגות): ${params.travelDnaSummary}` : ""}
בקשה חופשית מהמשתמש (המשקל הגבוה ביותר): ${JSON.stringify(params.freeText || null)}

לכל מקום תן:
- day: מספר היום שאליו הוא משויך (לפי הפירוט למעלה)
- name: השם **בעברית** אם יש לו שם עברי מוכר/מקובל (למשל "האקרופוליס", "מגדל אייפל") - אחרת השם המקורי בלעז
- role: "attraction" | "food" | "coffee_dessert"
- category: קטגוריה קצרה (לועזית, snake_case)
- description: משפט אחד בעברית
- reason: משפט אחד למה זה מתאים לבקשה הספציפית של המשתמש

חשוב מאוד: החזר JSON תקין בלבד. אל תשתמש בגרשיים בודדים (') בתוך הטקסט (למשל
בשמות מקומות או בתיאורים) - אם יש צורך, השמט אותם או נסח מחדש בלי גרש.

השב אך ורק במבנה JSON: [{"day": 1, "name": "...", "role": "...", "category": "...", "description": "...", "reason": "..."}, ...]`;

  // קריאה אחת לכל הטיול (לא לכל יום) - יותר טוקנים לקריאה בודדת, אבל הרבה
  // פחות round-trips וחזרות על boilerplate בסה"כ. max_tokens גדל עם גודל
  // הטיול; ה-timeout נשאר שמרני (45 שניות) כי זו קריאה בודדת שרצה מיד
  // בתחילת הבנייה, במקביל לשום דבר אחר.
  const maxTokens = Math.min(8000, 900 + totalPlaces * 130);
  const { text, error } = await callClaude(prompt, maxTokens, 45000);
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

  // הגנה נוספת מכפילויות: גם אם Claude בכל זאת חזר על שם (נדיר, אחרי
  // ההנחיה המפורשת) - מסננים שמות זהים (מנורמלים) לפני שממשיכים הלאה,
  // כדי לא לבזבז קריאות גיאוקודינג/תמונה על אותו מקום פעמיים.
  const seenNames = new Set<string>();
  const deduped = raw.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (!key || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  const supabase = createAdminClient();

  const results = await Promise.all(
    deduped.map(async (item) => {
      // קודם בודקים אם המקום כבר קיים ב-DB (מטיול/משתמש קודם) - אם כן,
      // משתמשים בו ישירות ומדלגים לגמרי על קריאות ה-Google (גיאוקודינג
      // + תמונה), מה שגם מהיר יותר וגם חוסך קרדיטים.
      const existing = await findExistingPlace(supabase, item.name, params.destination);
      if (existing) {
        return { ...existing, role: item.role as StopRole, day: item.day, reason: item.reason };
      }

      const [coords, photoRef] = await Promise.all([
        geocodePlaceNameNear(`${item.name}, ${params.destination}`, params.destinationOrigin, params.maxDistanceKm),
        findPlacePhotoReference(`${item.name} ${params.destination}`),
      ]);
      // גיאוקודינג נכשל או החזיר מקום רחוק מדי מהיעד - פוסלים את התחנה
      // הזו לגמרי, במקום לתת לה "להידבק" למסלול כיעד לא רלוונטי.
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
        day: item.day,
        reason: item.reason,
      } as ResolvedVacationPlace;
    })
  );

  return results.filter((r): r is ResolvedVacationPlace => r !== null);
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
