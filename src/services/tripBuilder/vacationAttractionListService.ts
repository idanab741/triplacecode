import { callClaude, logAiError } from "@/services/ai/claudeService";
import { geocodePlaceNameNear } from "./geocodingService";
import { findPlaceStatusAndPhoto } from "./placePhotoService";
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
  mealType?: "breakfast" | "lunch" | "dinner" | null;
  reason: string;
}

export type ResolvedVacationPlace = CandidatePlace & { role: StopRole; day: number };

/**
 * מחפש תמונה עם השם המלא + היעד; אם לא נמצא (למשל כי הניסוח לא תואם בדיוק
 * את מה שגוגל מזהה) - מנסה שוב עם השם בלבד, בלי היעד. בלי הגיבוי הזה,
 * מקומות אמיתיים לגמרי היו נשארים בלי תמונה רק כי הניסוח המדויק לא התאים.
 */
async function findPlacePhotoReferenceWithFallback(
  name: string,
  destination: string
): Promise<{ photoRef: string | null; isClosed: boolean }> {
  const primary = await findPlaceStatusAndPhoto(`${name} ${destination}`);
  if (primary.photoRef || primary.isClosed) return primary;
  return findPlaceStatusAndPhoto(name);
}

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

*** חובה: כל מקום ברשימה **אמיתי, קיים בפועל, ופופולרי/מבוקש ממש עכשיו** ביעד -
לא רק "מפורסם היסטורית". תעדיף מקומות: (א) עם דירוגים גבוהים ותור/ביקוש בפועל,
(ב) שמככבים הרבה באינסטגרם/רשתות חברתיות ומצולמים הרבה (אווירה/עיצוב/נוף
מיוחד) - הקהל שלנו אוהב מקומות "אינסטגרמיים", (ג) שהם כרגע "החם" בעיר, לא רק
קלאסיקה ישנה. במסעדות/בתי קפה - רק מהשווים והכי מדוברים, לא ממוצע גנרי. אסור
מקומות נידחים, לא ידועים, או מומצאים - איכות, פופולריות ונוכחות ברשת לפני הכל. ***

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
- mealType: אם role="food" - חובה לציין "breakfast" | "lunch" | "dinner" לפי שעת הארוחה המתאימה (למשל מקום מתאים לארוחת בוקר -> "breakfast"). אם ליום יש כמה מקומות אוכל - חובה לפזר אותם על פני שעות שונות של היום (לא כולם דינר), לא להציע כמה מסעדות לאותה שעה. אם role="attraction"/"coffee_dessert" - השאר null.
- reason: משפט אחד למה זה מתאים לבקשה הספציפית של המשתמש

חשוב מאוד: החזר JSON תקין בלבד. אל תשתמש בגרשיים בודדים (') בתוך הטקסט (למשל
בשמות מקומות או בתיאורים) - אם יש צורך, השמט אותם או נסח מחדש בלי גרש.

השב אך ורק במבנה JSON: [{"day": 1, "name": "...", "role": "...", "category": "...", "mealType": "...", "reason": "..."}, ...]`;

  // קריאה אחת לכל הטיול (לא לכל יום) - יותר טוקנים לקריאה בודדת, אבל הרבה
  // פחות round-trips וחזרות על boilerplate בסה"כ. max_tokens גדל עם גודל
  // הטיול; ה-timeout נשאר שמרני (45 שניות) כי זו קריאה בודדת שרצה מיד
  // בתחילת הבנייה, במקביל לשום דבר אחר.
  // maxTokens הקודם (500 + 80/מקום) לא הספיק בפועל - עברית צורכת יותר
  // טוקנים למילה מאנגלית, ותשובת Claude נחתכת באמצע (בלי "]" סוגר בכלל).
  // מעלים משמעותית את התקציב לביטחון.
  const maxTokens = Math.min(8000, 800 + totalPlaces * 200);
  // ה-timeout חייב לגדול עם כמות המקומות המבוקשת - טיול של 6 ימים (~38
  // מקומות) פשוט לוקח יותר זמן לייצר מטיול יום אחד, וזמן קבוע (45 שניות)
  // ניתק את הקריאה **בדיוק לפני** שהיא הספיקה לסיים, והחזיר מסלול ריק
  // לגמרי - למרות שהיא כמעט הצליחה.
  const timeoutMs = Math.min(90000, 20000 + totalPlaces * 1200);
  const { text, error } = await callClaude(prompt, maxTokens, timeoutMs);
  if (error || !text) {
    logAiError("קריאת ה-AI ליצירת רשימת המקומות נכשלה - חוזר עם מסלול ריק", {
      destination: params.destination,
      error,
      hasText: Boolean(text),
    });
    return [];
  }

  // מנסים קודם פענוח מלא ותקין; אם זה נכשל (בכל דרך - אין "]" סוגר בכלל
  // כי התשובה נחתכה, או שיש "]" אבל ה-JSON בכל זאת שבור) - **תמיד** מנסים
  // גם שחזור חלקי לפני שמוותרים. קודם זה היה מגיע לשחזור החלקי רק אם
  // JSON.parse זרק שגיאה בפועל - אבל תשובה שנחתכת לפני "]" בכלל לא מגיעה
  // לשם, כי ההתאמה הראשונית (regex) נכשלת קודם ומחזירה [] ישר, בלי לנסות
  // לשחזר את מה שכן הצליח להיווצר.
  let raw: RawSuggestion[] | null = null;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) raw = JSON.parse(jsonMatch[0]);
  } catch {
    raw = null;
  }

  if (!raw) {
    raw = tryRecoverPartialJson(text);
  }

  if (!raw || raw.length === 0) {
    logAiError("כשל בפענוח רשימת אטרקציות חופשה (גם אחרי ניסיון שחזור חלקי)", {
      destination: params.destination,
      rawText: text.slice(0, 800),
    });
    return [];
  }

  // הגנה נוספת מכפילויות: גם אם Claude בכל זאת חזר על שם (נדיר, אחרי
  // ההנחיה המפורשת) - מסננים שמות זהים (מנורמלים) לפני שממשיכים הלאה,
  // כדי לא לבזבז קריאות גיאוקודינג/תמונה על אותו מקום פעמיים.
  if (raw.length === 0) {
    logAiError("ה-AI החזיר JSON תקין אבל מערך ריק (0 מקומות)", { destination: params.destination });
    return [];
  }

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
        // אם למקום הקיים ב-DB אין תמונה בכלל (למשל נוצר לפני שהיה לנו
        // fallback טוב יותר) - קודם זה היה נשאר ככה **לצמיתות**, כי כל
        // שימוש חוזר במקום הזה פשוט מעתיק את מה שיש (או אין) ב-DB בלי
        // לנסות שוב. במקום זאת, מנסים למלא את הפער עכשיו, ושומרים בחזרה
        // ל-DB כדי שהשימושים הבאים גם ייהנו מהתיקון.
        if (existing.imageUrls.length === 0) {
          const backfill = await findPlacePhotoReferenceWithFallback(existing.name, params.destination);
          if (backfill.photoRef) {
            const imageUrl = `/api/places/photo?ref=${encodeURIComponent(backfill.photoRef)}`;
            await supabase.from("places").update({ image_urls: [imageUrl] }).eq("id", existing.id);
            existing.imageUrls = [imageUrl];
          }
        }
        return { ...existing, role: item.role as StopRole, day: item.day, reason: item.reason };
      }

      const [coords, photoResult] = await Promise.all([
        geocodePlaceNameNear(`${item.name}, ${params.destination}`, params.destinationOrigin, params.maxDistanceKm),
        findPlacePhotoReferenceWithFallback(item.name, params.destination),
      ]);
      // גיאוקודינג נכשל, המקום רחוק מדי מהיעד, או שהוא סגור בפועל (זמנית/
      // לצמיתות) - פוסלים את התחנה לגמרי, במקום להציע למשתמש מקום שהוא לא
      // יוכל בכלל להיכנס אליו.
      if (!coords || photoResult.isClosed) return null;
      const photoRef = photoResult.photoRef;

      const imageUrls = photoRef ? [`/api/places/photo?ref=${encodeURIComponent(photoRef)}`] : [];
      return {
        id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        category: item.category,
        subcategory: null,
        // תיאור לא מגיע מ-Claude כאן בכוונה - הוא נדרס בכל מקרה בהמשך על-ידי
        // generatePersonalizedDescriptions בסוף finalizeItinerary, אז אין טעם
        // לבקש מ-Claude לכתוב אותו פעמיים (חוסך טוקנים וזמן תגובה).
        shortDescription: null,
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

  const resolved = results.filter((r): r is ResolvedVacationPlace => r !== null);

  if (resolved.length < deduped.length) {
    logAiError("חלק מהמקומות נפלו בשלב הפענוח/גיאוקודינג", {
      destination: params.destination,
      claudeSuggested: deduped.length,
      resolvedSuccessfully: resolved.length,
    });
  }

  return resolved;
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
