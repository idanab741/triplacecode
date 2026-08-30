import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { FinalItineraryStop } from "./types";
import type { TripIntent } from "./tripIntentService";

/**
 * מייצר תיאור קצר לכל תחנה שאין לה עדיין תיאור אמיתי בכלל (short_description
 * ריק) - לא דורס תיאורים קיימים שכבר תויגו/נכתבו ע"י אדמין. קריאת Claude
 * אחת לכל הרשימה. ר' ההערה המורחבת בפרומפט למטה על למה זה שונה מקודם.
 */
export async function generatePersonalizedDescriptions(
  stops: FinalItineraryStop[],
  freeText: string,
  tripIntent?: TripIntent | null
): Promise<Map<string, string>> {
  if (stops.length === 0) return new Map();

  // תיקון קריטי: זה נקרא עכשיו *רק* לתחנות שאין להן שום תיאור אמיתי
  // כבר (ר' finalizeService.ts) - אז אין כאן "תיאור קיים מה-DB" להתחרות
  // איתו בכלל. בעבר הפרומפט אמר "אל תסתפק בתיאור הגנרי מה-DB, תשתמש
  // בידע הכללי שלך" - וגם כשכן היה תיאור אמיתי ומדויק, ההנחיה הזו עודדה
  // את Claude להמציא במקום להשתמש במה שכבר נכון (למשל מקום שתויג בדיוק
  // כ"מסעדת אוכל רחוב/פלאפל" יצא מתואר כ"עגלת קפה" - עובדה שלא נתמכת
  // בשום מידע אמיתי). עכשיו: אין תיאור בכלל = צריך לנחש בזהירות, לא
  // "לשפר" תיאור שכבר קיים ונכון.
  const prompt = `אתה מדריך טיולים עם ידע עמוק במקומות ברחבי העולם. לתחנות הבאות במסלול הטיול
אין עדיין שום תיאור קצר. עבור כל תחנה, כתוב תיאור קצר (משפט אחד, עד 20 מילים) על סמך
השם והקטגוריה שלה. חבר את התיאור לבקשה של המשתמש כשרלוונטי - אבל **אל תמציא פרטים
עובדתיים ספציפיים** (סוג עסק מדויק, תפריט, מבצעים) שאין לך דרך אמיתית לדעת; אם אתה לא
בטוח מהו סוג המקום המדויק, תישאר כללי וזהיר בניסוח (למשל "מקום מקומי ידוע" ולא סוג עסק
ממציא), במקום לנחש פרט קונקרטי שעלול להיות פשוט שגוי.

בקשת המשתמש (מלל חופשי): ${JSON.stringify(freeText || null)}
כוונת הטיול: ${JSON.stringify(tripIntent?.summary ?? null)}

התחנות:
${JSON.stringify(
    stops.map((s) => ({
      stopId: s.stopId,
      name: s.name,
      category: s.category,
    }))
  )}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
[{"stopId": "...", "description": "..."}, ...]`;

  // maxTokens/timeout קבועים (1024/12 שניות) הספיקו לטיול יום אחד, אבל לא
  // לחופשה בחו"ל עם 30-50+ תחנות - הקריאה נכשלת/נקטעת, ומחזירה Map ריק
  // לגמרי, כך שאף תחנה לא מקבלת תיאור. גדלים לפי כמות התחנות בפועל.
  const maxTokens = Math.min(8000, 300 + stops.length * 60);
  const timeoutMs = Math.min(40000, 12000 + stops.length * 400);
  const { text, error } = await callClaude(prompt, maxTokens, timeoutMs);
  if (error || !text) return new Map();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return new Map();
    const parsed = JSON.parse(jsonMatch[0]) as { stopId: string; description: string }[];
    return new Map(parsed.map((item) => [item.stopId, item.description]));
  } catch (parseError) {
    // תשובה חלקית (נקטעה) - עדיף להציל את מה שכן פוענח בהצלחה (רוב
    // התחנות) על פני לוותר על הכל ולהשאיר את כולן בלי תיאור.
    const recovered = tryRecoverPartialDescriptions(text);
    if (recovered.size > 0) return recovered;

    logAiError("כשל בייצור תיאורים אישיים למסלול", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return new Map();
  }
}

function tryRecoverPartialDescriptions(text: string): Map<string, string> {
  const startIndex = text.indexOf("[");
  if (startIndex === -1) return new Map();

  const lastGoodClose = text.lastIndexOf("},");
  if (lastGoodClose === -1 || lastGoodClose < startIndex) return new Map();

  const truncated = text.slice(startIndex, lastGoodClose + 1) + "]";
  try {
    const parsed = JSON.parse(truncated) as { stopId: string; description: string }[];
    return new Map(parsed.map((item) => [item.stopId, item.description]));
  } catch {
    return new Map();
  }
}