import { callClaude, logAiError } from "@/services/ai/claudeService";
import { createAdminClient } from "@/services/supabase/admin";
import { resolveAiSuggestedPlace, type ResolvedAiPlace } from "./placeResolutionService";
import type { LatLng, StopRole } from "./types";

export interface DayTripSlotSpec {
  /** מזהה התחנה (stop.id) - כדי לשייך את ההצעה בחזרה לתחנה הנכונה. */
  slotId: string;
  category: string;
  role: StopRole;
  /** כוונה ספציפית לתחנה הזו, שכבר חולצה מהמלל החופשי בשלב התכנון
   *  (למשל "עגלת קפה ממש, לא בית קפה יושב") - ר' CategoryPlanItem.note. */
  note?: string | null;
}

interface GenerateDayTripParams {
  /** שם קריא של האזור (עיר/שכונה) - לצורך הפרומפט וחיפוש Google, לא קואורדינטות גולמיות. */
  areaLabel: string;
  areaOrigin: LatLng;
  maxDistanceKm: number;
  /** מרחק יעד רנדומלי בטווח 0-maxDistanceKm, מחושב פעם אחת מראש - בלי זה
   *  יש הטיה טבעית למקום הכי קרוב/מוכר. לא אילוץ קשיח, רק "עוגן" לפיזור אמיתי. */
  targetDistanceKm: number;
  slots: DayTripSlotSpec[];
  interestLabels: string[];
  freeText: string;
  budgetLabel: string;
  travelDnaSummary?: string | null;
  /** רמת קושי מבוקשת (רק לטיול בטבע) - אילוץ קשיח ובולט, לא קבור בתוך
   *  travelDnaSummary הכללי (שם זה נטה להתעלם ממנו בפועל). */
  hardDifficultyConstraint?: string | null;
  /** תשובות השאלון (הרכב מטיילים, גילאים, תזמון, משך) - עד עכשיו לא הופיעו
   *  בפרומפט הזה בכלל, למרות שה"20%" שאינו מלל חופשי מתייחס אליהן. */
  questionnaireSummary?: string | null;
}

interface RawDaySuggestion {
  slotId: string;
  name: string;
  backupName?: string;
  reason: string;
}

export type ResolvedDayTripPlace = ResolvedAiPlace & { slotId: string };

/**
 * מחליף את הגישה הישנה (שליפה מהמאגר הפנימי + דירוג) - Claude עצמו מציע
 * מקומות אמיתיים וספציפיים באזור, מתוך הידע הכללי שלו (לא מוגבל למה שכבר
 * קיים במאגר שלנו). זו בדיוק הסיבה ש"תמיד יוצא אותו טיול" - מאגר פנימי קטן
 * חוזר על עצמו; Claude עם הגנת Google Places (קיום, תמונה, ביקורות) נותן
 * מגוון אמיתי בלי לוותר על אמינות.
 */
export async function generateDayTripPlaces(params: GenerateDayTripParams): Promise<ResolvedDayTripPlace[]> {
  if (params.slots.length === 0) return [];

  const slotsBreakdown = params.slots
    .map((s, i) => {
      const noteText = s.note ? ` - **כוונה מדויקת לתחנה הזו (מהמלל החופשי, חובה לכבד במדויק): "${s.note}"**` : "";
      return `${i + 1}. slotId: "${s.slotId}", role: ${s.role}, category: ${s.category} (זו תחנה מספר ${i + 1} מתוך ${params.slots.length} ברצף היום)${noteText}`;
    })
    .join("\n");

  const prompt = `אתה מומחה תיירות מקומי עם ידע עמוק על ${params.areaLabel} והסביבה שלה. בנה מסלול טיול יומי -
מקום אמיתי וספציפי אחד לכל תחנה ברשימה הבאה:

${slotsBreakdown}

*** אם לתחנה מסוימת יש "כוונה מדויקת" מסומנת למעלה - זו ההנחיה הכי חשובה
לאותה תחנה ספציפית, מדויקת יותר מהקטגוריה הכללית שלה ומהמלל החופשי המלא
למטה (שכבר פורק לתחנות הנפרדות). אל תתעלם ממנה ואל תחליף אותה במקום גנרי
מאותה קטגוריה בלבד. ***
${
  params.hardDifficultyConstraint
    ? `\n*** אילוץ קשיח וחד-משמעי: רמת הקושי המבוקשת היא "${params.hardDifficultyConstraint}".
אסור בהחלט להציע מסלול/אטרקציה שדורשים רמת כושר/ניסיון גבוהה יותר מזו - גם אם
מסלול מאתגר יותר "מעניין יותר" או "ידוע יותר". אם אינך בטוח ברמת הקושי בפועל
של מסלול - עדיף לבחור אחד ששמור לרמה קלה יותר בבירור, לא לנחש כלפי מעלה. ***\n`
    : ""
}

*** אילוץ קשיח וחד-משמעי, בלי יוצא מן הכלל: **אף מקום לא יכול להיות במרחק
שעולה על ${params.maxDistanceKm} ק"מ** מ${params.areaLabel}. זה תקרה מוחלטת שהמשתמש
קבע בעצמו - לא הצעה, לא כיוון כללי. אם אינך בטוח שמקום נמצא בתוך ${params.maxDistanceKm}
ק"מ - אל תציע אותו כלל, גם אם הוא מתאים מאוד לבקשה. ***

*** בנוסף לאילוץ הקשיח למעלה (לא במקום אותו): בתוך הטווח המותר, **אל תעדיף
באופן שיטתי את המקום הכי קרוב לנקודת המוצא** - זה מה שגורם לכל המסלול להתרכז
צמוד לבית. יעד *מועדף* (לא חובה, ובכל מקרה לא עובר את ${params.maxDistanceKm} ק"מ):
בסביבות ${params.targetDistanceKm} ק"מ מנקודת המוצא. ***

*** **אל תבחר את המקום הכי מובן מאליו והכי מוכר בקטגוריה** (כמו
הקניון הגדול בעיר, או הפארק המרכזי) - אלא אם המלל החופשי מבקש זאת במפורש. המשתמש
פונה למנוע AI כדי לגלות מקומות טובים ומעניינים שהוא לא היה מוצא לבד בחיפוש מהיר -
לא רשימת "הכי מפורסם" הצפויה. תעדיף פינות מיוחדות, מקומות עם אופי/אווירה ייחודיים,
"פנינים נסתרות" מקומיות - כל עוד הם עדיין אמיתיים, פתוחים, ובעלי דירוג סביר
(לא חייב להיות הכי גבוה/הכי מדובר - "קיים ואמין" מספיק, לא "הכי פופולרי"). ***

*** קריטי - פורמט מדויק, לא רק קטגוריה כללית: אם המלל החופשי מציין את **הפורמט
הפיזי הספציפי** של המקום (למשל "עגלת קפה" ולא סתם "קפה", "דוכן רחוב" ולא "מסעדה",
"פודטראק" ולא "מסעדה"), חובה למצוא מקום שהוא **באמת מאותו פורמט פיזי** - לא תחליף
נוח מאותה קטגוריה כללית. עגלת קפה אמיתית (רוכלות, קיוסק נייד/רחוב) שונה מבית קפה
יושב, גם אם שניהם "coffee_dessert". אם לא נמצא מקום שמתאים בדיוק לפורמט המבוקש -
עדיף לציין reason שמסביר בכנות שזה הכי קרוב שנמצא ("בית קפה קטן, הכי קרוב לעגלת
קפה שנמצא באזור"), במקום להעמיד פנים שזו התאמה מדויקת. ***

*** קריטי - אסור בהחלט להמציא מקומות: כל שם שאתה כותב חייב להיות מקום אמיתי
שאתה בטוח לגמרי שקיים במציאות, עם השם המדויק והנכון שלו. אם אינך בטוח ב-100%
שמקום מסוים קיים בשם הזה בדיוק - אל תכלול אותו כלל. כל מקום עובר בהמשך אימות
מול Google Places - מקום שלא נמצא שם יידחה לגמרי. ***

*** חובה: בלי כפילויות - כל מקום מופיע פעם אחת בלבד, גם אם הוא מתאים למספר
תחנות. לכל slotId בדיוק מקום אחד. ***

*** חובה - גיוון בין תחנות: אם המלל החופשי מתאר שני שלבים **שונים במפורש**
(למשל "מסלול הליכה" ואחר כך בנפרד "אטרקציה") - חובה שהמקומות שתבחר להם יהיו
שונים באופיים זה מזה, לא שני מקומות מאותו סוג ברצף (למשל שני פארקים/גנים
זהים באופיים). לכל שלב שהמשתמש הפריד במפורש - תן חוויה שונה ומוסיפה, לא
חזרה על אותה חוויה עם שם אחר. ***

*** חובה - התאמה למיקום בתוך היום: התחנות מוצגות למעלה בסדר הכרונולוגי
המדויק שהן אמורות להתרחש בו (תחנה 1 = הראשונה ביום, בדרך כלל בוקר). אם המלל
החופשי מתאר אופי שונה לכל שלב (למשל "קפה בבוקר בטבע" לתחנה הראשונה, "קניון
בסוף" לתחנה האחרונה) - **חובה** לבחור מקום שמתאים גם לאופי המתואר וגם
לזמן/לתפקיד שלו ברצף, לא רק להתאים role/category באופן כללי. לדוגמה: בקשה
ל"קפה בבוקר בטבע" צריכה מקום קפה שנמצא בפועל בסביבה טבעית/פארק/גינה, לא בית
קפה עירוני רגיל, גם אם שניהם תואמים טכנית ל-role="coffee_dessert". ***

*** משקל ההחלטה: הבקשה בטקסט החופשי למטה היא הגורם המשמעותי ביותר (כ-80%
מההחלטה). תחומי העניין ופרופיל הטעם משניים (כ-20%), אבל אילוצים קשיחים כמו
כשרות/נגישות/אלרגיות בפרופיל - חובה לכבד תמיד. ***

תחומי עניין: ${params.interestLabels.join(", ") || "כל תחום"}
תקציב: ${params.budgetLabel}
${params.travelDnaSummary ? `פרופיל המשתמש: ${params.travelDnaSummary}` : ""}
${params.questionnaireSummary ? `תשובות נוספות בשאלון (הרכב מטיילים/תזמון/מרחק - חלק מה-20%): ${params.questionnaireSummary}` : ""}
בקשה חופשית מהמשתמש (המשקל הגבוה ביותר): ${JSON.stringify(params.freeText || null)}

לכל מקום תן:
- slotId: בדיוק כמו ברשימת התחנות למעלה
- name: השם **בעברית** אם יש לו שם עברי מוכר/מקובל - אחרת השם המקורי
- backupName: מקום **שונה לגמרי** מ-name (לא רק תעתיק/ניסוח אחר לאותו מקום),
  שמתאים באותה מידה לתחנה הזו - ישמש כגיבוי אם המקום הראשי לא יעבור אימות
  (למשל נמצא סגור, בלי תמונה, או שגוגל לא מזהה אותו)
- reason: משפט אחד למה זה מתאים לבקשה הספציפית של המשתמש

חשוב מאוד: החזר JSON תקין בלבד, בלי גרשיים בודדים (') בתוך הטקסט.

השב אך ורק במבנה JSON: [{"slotId": "...", "name": "...", "backupName": "...", "reason": "..."}, ...]`;

  const maxTokens = Math.min(5000, 700 + params.slots.length * 200);
  const timeoutMs = Math.min(45000, 15000 + params.slots.length * 1200);
  const { text, error } = await callClaude(prompt, maxTokens, timeoutMs);
  if (error || !text) {
    logAiError("קריאת ה-AI ליצירת מקומות לטיול יומי נכשלה", { areaLabel: params.areaLabel, error, hasText: Boolean(text) });
    return [];
  }

  let raw: RawDaySuggestion[] | null = null;
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) raw = JSON.parse(jsonMatch[0]);
  } catch {
    raw = null;
  }

  if (!raw || raw.length === 0) {
    logAiError("כשל בפענוח רשימת מקומות לטיול יומי", { areaLabel: params.areaLabel, rawText: text.slice(0, 800) });
    return [];
  }

  const slotById = new Map(params.slots.map((s) => [s.slotId, s]));
  const seenNames = new Set<string>();
  const deduped = raw.filter((item) => {
    const key = item.name.trim().toLowerCase();
    if (!key || seenNames.has(key) || !slotById.has(item.slotId)) return false;
    seenNames.add(key);
    return true;
  });

  const supabase = createAdminClient();

  const results = await Promise.all(
    deduped.map(async (item) => {
      const slot = slotById.get(item.slotId)!;
      const resolved = await resolveAiSuggestedPlace(
        supabase,
        { name: item.name, category: slot.category, role: slot.role, reason: item.reason },
        params.areaLabel,
        params.areaOrigin,
        params.maxDistanceKm
      );
      if (resolved) return { ...resolved, slotId: item.slotId } as ResolvedDayTripPlace;

      // המקום הראשי נפסל באימות (סגור/בלי תמונה/לא נמצא/מעט ביקורות) -
      // מנסים את מועמד הגיבוי לפני שמוותרים לגמרי על התחנה. בלי הגיבוי
      // הזה, כל דחייה באימות פשוט "מקצרת" את המסלול בלי שום פיצוי.
      if (!item.backupName || !item.backupName.trim()) return null;
      const backupResolved = await resolveAiSuggestedPlace(
        supabase,
        { name: item.backupName, category: slot.category, role: slot.role, reason: item.reason },
        params.areaLabel,
        params.areaOrigin,
        params.maxDistanceKm
      );
      if (!backupResolved) return null;
      return { ...backupResolved, slotId: item.slotId } as ResolvedDayTripPlace;
    })
  );

  return results.filter((r): r is ResolvedDayTripPlace => r !== null);
}
