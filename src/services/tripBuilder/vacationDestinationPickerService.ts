import { callClaude, logAiError } from "@/services/ai/claudeService";
import { getDestinationCandidates, type DestinationCandidate } from "@/services/destinations/destinationsServerService";

interface PickDestinationParams {
  vacationTypeLabels: string[];
  freeText: string;
  budgetLabel: string;
  travelStyle: string;
  /** תקציר Travel DNA (תחומי עניין, כשרות, נגישות, נלמד מהתנהגות) - ר'
   *  הערה מפורטת למטה על למה זה קריטי במיוחד בזרימת "אמשיך לבד". */
  travelDnaSummary?: string | null;
}

export interface ChosenDestination {
  city: string;
  country: string;
  coords: { lat: number; lng: number };
}

/**
 * תיקון (audit): קודם הפונקציה הזו נתנה ל-Claude "לבחור יעד עולמי אמיתי"
 * בלי שום רשימה - קלוד היה יכול להמציא/להחזיר כל עיר בעולם, שלא בהכרח
 * קיימת ב-221 היעדים המוקפדים של ה-admin (טבלת destinations). עכשיו
 * הבחירה מוגבלת **אך ורק** לרשימה הזו: שולפים את כל המועמדים מה-DB,
 * נותנים לקלוד לבחור *מתוכם* לפי ההתאמה לבקשה (בדיוק כמו
 * /api/match/rank-destinations בעמוד הבית - "דרג/בחר מתוך רשימה נתונה",
 * לא "תמציא"), ומוודאים בהמשך (validation) שהתשובה בפועל תואמת שורה
 * קיימת ברשימה בדיוק - אחרת נופלים חזרה ליעד בטוח מתוך אותה רשימה,
 * ולעולם לא מחזירים יעד שלא קיים אצלנו.
 */
export async function pickSurpriseDestination(
  params: PickDestinationParams
): Promise<ChosenDestination | null> {
  try {
    return await Promise.race([
      pickSurpriseDestinationInner(params),
      // מעגל ביטחון (audit): קריאה תקועה כאן (רשת/DB/Claude) לא אמורה
      // לתקוע את כל תהליך auto-build - אותו דפוס בדיוק כמו getWeatherSummary
      // ב-auto-build/route.ts. אחרי 15 שניות מוותרים ונופלים חזרה ל-null
      // (auto-build ממשיך בלי יעד "הפתעה" - עדיף מ"תקוע לנצח").
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
  } catch (err) {
    logAiError("pickSurpriseDestination נכשל באופן לא צפוי - ממשיכים בלי יעד הפתעה", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function pickSurpriseDestinationInner(
  params: PickDestinationParams
): Promise<ChosenDestination | null> {
  const candidates = await getDestinationCandidates();
  if (candidates.length === 0) {
    logAiError("אין אף יעד מועמד ל'תפתיעו אותי' - טבלת places ריקה/אין ערים עם מספיק מקומות (MIN_PLACES_PER_DESTINATION)");
    return null;
  }

  // רשימה קומפקטית לפרומפט: "עיר, מדינה" בכל שורה - קטן מספיק (221
  // שורות קצרות) כדי להיכלל במלואו בקריאה אחת, בלי צורך בסינון מוקדם.
  const candidateList = candidates.map((c) => `${c.name}, ${c.country}`).join("\n");

  // תיקון (בקשה מפורשת): קודם הפרומפט התייחס לסוג חופשה/תקציב/סגנון
  // טיול כאילו הם תמיד תשובות אמיתיות של המשתמש. אבל בזרימת "אמשיך
  // לבד" (המלל החופשי בלבד, בלי שאר השאלון) השדות האלה נשארים בברירת
  // המחדל - הם *לא* משקפים בחירה אמיתית. לכן, בדיוק כמו בכל שאר
  // הפרומפטים באפליקציה (ר' TRIP_INTENT_PROMPT_RULES ב-tripIntentService.ts):
  // מלל חופשי + פרופיל אישי (Travel DNA) הם מרכז ההחלטה (כ-90%), וסוג
  // חופשה/תקציב/סגנון טיול הם context משלים בלבד (כ-10%) - במיוחד
  // חשובים כשהם *כן* נענו במפורש (בזרימה המלאה עם השאלון), אבל אף פעם
  // לא גוברים על הפרופיל האישי/המלל כשהם ריקים או בברירת מחדל.
  const prompt = `אתה מומחה טיולים. המשתמש ביקש שתבחרו עבורו יעד לחופשה, לפי היררכיית מקורות המידע הבאה:

- מלל חופשי + פרופיל אישי (Travel DNA) יחד: כ-90% מהמשקל - זה מרכז ההחלטה.
- סוג חופשה/תקציב/סגנון טיול: יחד כ-10% - context משלים בלבד, ובמיוחד בזרימות שבהן
  המשתמש דילג על שאלון מפורט הם עשויים להיות ערכי ברירת מחדל ולא בחירה אמיתית -
  אל תיתן להם לגבור על הפרופיל האישי או על המלל החופשי.

פרופיל אישי של המשתמש (Travel DNA - תחומי עניין, כשרות, נגישות, מה שנלמד מהתנהגות
עבר): ${JSON.stringify(params.travelDnaSummary || null)}
בקשה חופשית מהמשתמש (המשקל הגבוה ביותר יחד עם הפרופיל האישי): ${JSON.stringify(params.freeText || null)}

סוג חופשה: ${params.vacationTypeLabels.join(", ") || "כל סוג"}
תקציב: ${params.budgetLabel}
סגנון טיול: ${params.travelStyle}

חשוב מאוד - אילוץ מוחלט: אתה **חייב** לבחור יעד אחד **אך ורק** מתוך הרשימה
הבאה של יעדים שקיימים בפועל אצלנו במערכת. אסור לבחור/להמציא יעד שלא מופיע
ברשימה הזו, גם אם הוא היה מתאים יותר לבקשה. העתק את השם (עיר, מדינה) *בדיוק*
כפי שהוא מופיע ברשימה, אות באות - לא לתרגם, לא לתקן איות, לא לשנות ניסוח.

רשימת היעדים הזמינים:
${candidateList}

השב אך ורק במבנה JSON הבא, עם השם המדויק מהרשימה, בלי שום טקסט נוסף:
{"city": "שם העיר בדיוק כפי שברשימה", "country": "שם המדינה בדיוק כפי שברשימה"}`;

  const { text, error } = await callClaude(prompt, 300);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { city?: string; country?: string };
    if (!parsed.city || !parsed.country) return null;

    const match = findExactCandidate(candidates, parsed.city, parsed.country);
    if (!match) {
      // הגנת "הזיה" (hallucination safety net): קלוד לא החזיר שורה
      // שקיימת בדיוק ברשימה שסיפקנו לו - במקום לסכן החזרת יעד לא קיים,
      // נופלים חזרה ליעד אקראי *מתוך אותה הרשימה* (עדיין תקף), ולא null
      // (שהיה עוצר את כל תהליך הבנייה בשביל טעות ניסוח).
      logAiError("בחירת יעד הפתעה לא תאמה אף יעד ברשימה - נופל חזרה ליעד אקראי מהרשימה", {
        returned: `${parsed.city}, ${parsed.country}`,
      });
      const fallback = candidates[Math.floor(Math.random() * candidates.length)];
      return { city: fallback.name, country: fallback.country, coords: { lat: fallback.latitude, lng: fallback.longitude } };
    }

    return { city: match.name, country: match.country, coords: { lat: match.latitude, lng: match.longitude } };
  } catch (parseError) {
    logAiError("כשל בבחירת יעד הפתעה מ-Claude", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return null;
  }
}

function findExactCandidate(
  candidates: DestinationCandidate[],
  city: string,
  country: string
): DestinationCandidate | null {
  const normalize = (value: string) => value.trim().toLowerCase();
  const targetCity = normalize(city);
  const targetCountry = normalize(country);
  return (
    candidates.find((c) => normalize(c.name) === targetCity && normalize(c.country) === targetCountry) ?? null
  );
}
