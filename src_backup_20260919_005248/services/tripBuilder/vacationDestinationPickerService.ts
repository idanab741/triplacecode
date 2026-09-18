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

/**
 * תיקון פער אמיתי שאותר ב-Audit מול ה-MASTER SPEC (סעיפים 25-29, 90, 197):
 * לסופ"ש בלי לינה קבועה ובלי אזור מפורש לא הייתה שום בחירת יעד אמיתית -
 * auto-build/route.ts פשוט חיפש שטוח סביב הבית (origin) ברדיוס
 * distanceBandToRadiusKm, בלי שום שלב "בחר יעד טוב בתוך הטווח הזה"
 * (Destination Discovery), Controlled Randomness, או Diversity - בדיוק
 * התרחיש שסעיף 197 מזהיר עליו: "5h תמיד מחזיר near-home".
 *
 * אותו עיקרון בדיוק כמו pickSurpriseDestination (חופשה בחו"ל) - הבדל
 * מרכזי אחד: כאן המועמדים מסוננים **מראש** למרחק בפועל מהבית (לא לפי
 * מדינה - הנתונים לא תמיד עקביים בפורמט country, אבל מרחק תמיד אמין),
 * כדי שלעולם לא "יברח" יעד בחו"ל לתוך הרשימה. אם אין אף מועמד בטווח -
 * מחזיר null בלי שגיאה (auto-build ממשיך בהתנהגות הקודמת - חיפוש שטוח
 * סביב הבית - כרשת ביטחון, לא נכשל).
 */
export async function pickWeekendDestination(params: {
  origin: { lat: number; lng: number };
  maxRadiusKm: number;
  weekendStyleLabels: string[];
  freeText: string;
  budgetLabel: string;
  travelDnaSummary?: string | null;
}): Promise<ChosenDestination | null> {
  try {
    return await Promise.race([
      pickWeekendDestinationInner(params),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
  } catch (err) {
    logAiError("pickWeekendDestination נכשל באופן לא צפוי - ממשיכים בלי בחירת יעד (fallback לחיפוש שטוח)", {
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function pickWeekendDestinationInner(params: {
  origin: { lat: number; lng: number };
  maxRadiusKm: number;
  weekendStyleLabels: string[];
  freeText: string;
  budgetLabel: string;
  travelDnaSummary?: string | null;
}): Promise<ChosenDestination | null> {
  const allCandidates = await getDestinationCandidates();
  // מסננים למרחק בפועל מהבית - זה מה ש-distanceBand אמור לייצג (כמה
  // רחוק מהבית המשתמש מוכן לנסוע כדי להגיע ליעד הסופ"ש - MASTER SPEC
  // סעיף 23), לא רדיוס בין-תחנתי. גם מבטיח בלי תלות בפורמט שדה country
  // שיעדים בחו"ל (רחוקים תמיד מעל הרדיוס המקסימלי של סופ"ש) לא ייכנסו.
  const candidates = allCandidates.filter(
    (c) => haversineKm(params.origin, { lat: c.latitude, lng: c.longitude }) <= params.maxRadiusKm
  );
  if (candidates.length === 0) return null;

  const candidateList = candidates
    .map((c) => {
      const priceLabel = c.avgPriceLevel != null ? `, רמת מחירים ממוצעת ${"₪".repeat(Math.max(1, Math.round(c.avgPriceLevel)))}` : "";
      return `${c.name}, ${c.country} (כ-${Math.round(haversineKm(params.origin, { lat: c.latitude, lng: c.longitude }))} ק"מ מהבית${priceLabel})`;
    })
    .join("\n");

  const prompt = `אתה מומחה טיולים בישראל. המשתמש ביקש שתבחרו עבורו אזור/יעד לסופ"ש, לפי היררכיית מקורות המידע הבאה:

- מלל חופשי + פרופיל אישי (Travel DNA) יחד: כ-90% מהמשקל - זה מרכז ההחלטה.
- סגנון סופ"ש/תקציב: יחד כ-10% - context משלים בלבד.

פרופיל אישי של המשתמש (Travel DNA): ${JSON.stringify(params.travelDnaSummary || null)}
בקשה חופשית מהמשתמש (המשקל הגבוה ביותר יחד עם הפרופיל האישי): ${JSON.stringify(params.freeText || null)}
סגנון סופ"ש: ${params.weekendStyleLabels.join(", ") || "כל סוג"}
תקציב: ${params.budgetLabel}

חשוב מאוד - אילוץ מוחלט: אתה **חייב** לבחור יעד אחד **אך ורק** מתוך הרשימה
הבאה של יעדים שקיימים בפועל אצלנו במערכת, כולם כבר בתוך טווח הנסיעה
שהמשתמש אישר. אסור לבחור/להמציא יעד שלא מופיע ברשימה. העתק את השם (עיר,
מדינה) *בדיוק* כפי שהוא מופיע ברשימה, אות באות.

אל תעדיף אוטומטית את היעד הכי קרוב - בחר את היעד עם ההתאמה הכי טובה
לבקשה ולפרופיל, מתוך כל הרשימה.

תיקון (בקשה מפורשת - "תקציב שמשפיע על בחירת יעד"): "רמת מחירים ממוצעת"
ליד כל יעד היא ממוצע אמיתי של מקומות שכבר קיימים אצלנו שם - לא מחיר
לינה (אין לנו נתון כזה, ואסור להמציא אחד) - אלא אינדיקציה כללית לרמת
היוקרה/עלות של האזור. אם התקציב שצוין נמוך, העדף יעדים עם רמת מחירים
נמוכה-בינונית יותר; אם התקציב גבוה, זה פחות מגביל. יעד בלי נתון מחיר
בכלל - לא לפסול אותו רק בגלל זה, פשוט אין לנו מספיק מידע עליו.

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
      logAiError("בחירת יעד סופ\"ש לא תאמה אף יעד ברשימה המסוננת - נופל חזרה ליעד אקראי מהרשימה", {
        returned: `${parsed.city}, ${parsed.country}`,
      });
      const fallback = candidates[Math.floor(Math.random() * candidates.length)];
      return { city: fallback.name, country: fallback.country, coords: { lat: fallback.latitude, lng: fallback.longitude } };
    }

    return { city: match.name, country: match.country, coords: { lat: match.latitude, lng: match.longitude } };
  } catch (parseError) {
    logAiError("כשל בבחירת יעד סופ\"ש מ-Claude", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return null;
  }
}
