import { NextRequest, NextResponse } from "next/server";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";

/**
 * *** תכונה חדשה (בקשה מפורשת - "מלל חופשי... משם ישר הולכים לעמוד
 * מסלול ייחודי... עד 6 [סה"כ], 3 מסעדות מקסימום ו-3 אטרקציות... החיפוש
 * יתבצע על בסיס ה-API של קלוד והוא יתן את התוצאות"):
 *
 * שונה במכוון מכל מנגנון בניית הטיול הקיים (categoryPlanService/
 * tripStrategyService/finalizeService, המשמשים את "חופשה בחו"ל"/"טיול
 * יומי") - אין כאן session, אין DB, אין ריבוי קריאות AI לכל יום/סלוט.
 * קריאת Claude אחת בלבד שמציעה שמות (עד 3 מסעדות + 3 אטרקציות)
 * שמתאימים למלל החופשי, ואז אימות מהיר מול Google Places (כתובת/
 * קואורדינטות/דירוג/תמונה - כדי שיהיה למה "לגרור" על מפה) - **בלי**
 * לשמור את המקומות בטבלת `places` המשותפת (זה מסלול חד-פעמי/אישי,
 * לא תוכן שצריך "לזהם" את המאגר הקבוע - שונה במכוון מ-
 * createMustSeePlaceViaGoogle ב-vacationMustSeeService.ts, שכן שומר).
 */

export interface TrippyQuickStop {
  id: string;
  name: string;
  category: "attraction" | "restaurant";
  shortDescription: string | null;
  imageUrl: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  rating: number | null;
}

interface ClaudeSuggestion {
  name: string;
  category: "attraction" | "restaurant";
  shortDescription: string;
}

interface GooglePlaceTextSearchResult {
  name?: string;
  formatted_address?: string;
  rating?: number;
  geometry?: { location?: { lat: number; lng: number } };
  photos?: { photo_reference: string }[];
}

function buildPrompt(freeText: string, dnaContext: string): string {
  return `אתה מומחה טיולים. המשתמש כתב בקשה חופשית לטיול-יום אחד -
זהו הטקסט **הסופי והמחייב**, לא בסיס להרחבה: תן בדיוק את מה שהתבקש,
לא יותר.
${JSON.stringify(freeText)}
${dnaContext}

**דיוק לפני כמות - זה החוק החשוב ביותר כאן:** אם המשתמש ביקש דבר אחד
ספציפי (למשל "בית קפה") - תחזיר עצירה **אחת** מדויקת, לא נסה למלא
"מכסה" של 6 עם עוד דברים לא-קשורים (פארק/מוזיאון/מסעדה) שהוא לא ביקש.
הרשימה הסופית (עד 3 אטרקציות + עד 3 מסעדות, **סה"כ מקסימלי, לא יעד
לשאוף אליו**) חייבת להיות תולדה ישירה של מה שכתוב בבקשה - כל עצירה
שאתה מוסיף חייבת להיות מוצדקת ישירות מתוך המלל, לא "מילוי" כללי.
אם הבקשה מרמזת על יותר ממקום אחד (למשל "יום כיף" בלי פירוט) - אז כן
תכנן יום מגוון בגבולות 3+3, אבל אם הבקשה ממוקדת וברורה - כבד את
המיקוד שלה בקפדנות.

לכל עצירה: שם ספציפי ואמיתי (לא כללי כמו "מסעדה טובה") שקיים במציאות
במקום שהוזכר/משתמע מהבקשה, קטגוריה (attraction/restaurant), ותיאור
קצר (משפט אחד) שמסביר למה זה מתאים לבקשה הספציפית. גם כותרת קצרה
וקליטה למסלול כולו (2-5 מילים, למשל "יום כיף בתל אביב" או "טעימות
מהעיר העתיקה").

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"title": "...", "stops": [{"name": "...", "category": "attraction" | "restaurant", "shortDescription": "..."}]}`;
}

function buildDnaContext(dna: Awaited<ReturnType<typeof getTravelDna>>): string {
  if (!dna) return "";
  const parts: string[] = [];
  if (dna.kosher) parts.push("המשתמש שומר כשרות - כל מסעדה/בית קפה שתציע חייב להיות כשר.");
  if (dna.accessibility) parts.push("המשתמש זקוק לנגישות - עדיפות למקומות נגישים.");
  if (dna.dietary_restrictions?.length) parts.push(`הגבלות תזונה: ${dna.dietary_restrictions.join(", ")}.`);
  if (dna.interests?.length) parts.push(`תחומי עניין כלליים (רלוונטי רק אם הבקשה עצמה לא ספציפית מספיק): ${dna.interests.join(", ")}.`);
  if (dna.culinary_styles?.length) parts.push(`סגנונות אוכל מועדפים: ${dna.culinary_styles.join(", ")}.`);
  if (dna.disliked_categories?.length) parts.push(`להימנע לגמרי מ: ${dna.disliked_categories.join(", ")}.`);
  if (parts.length === 0) return "";
  return `\nהעדפות פרופיל המשתמש (משני לבקשה הספציפית - הבקשה עצמה תמיד גוברת אם יש סתירה): ${parts.join(" ")}`;
}

async function suggestStopsViaClaude(
  freeText: string,
  dnaContext: string
): Promise<{ title: string | null; suggestions: ClaudeSuggestion[] }> {
  const { text, error } = await callClaude(buildPrompt(freeText, dnaContext), 1000);
  if (error || !text) {
    logAiError("trippy-quick: הצעת מקומות מ-Claude נכשלה", { freeText, error });
    return { title: null, suggestions: [] };
  }
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { title: null, suggestions: [] };
    const parsed = JSON.parse(jsonMatch[0]) as { title?: unknown; stops?: unknown[] };
    const title = typeof parsed.title === "string" ? parsed.title : null;
    const suggestions = Array.isArray(parsed.stops)
      ? parsed.stops
          .filter(
            (v): v is ClaudeSuggestion =>
              typeof v === "object" &&
              v !== null &&
              typeof (v as ClaudeSuggestion).name === "string" &&
              ((v as ClaudeSuggestion).category === "attraction" || (v as ClaudeSuggestion).category === "restaurant")
          )
          .slice(0, 8) // רשת ביטחון - גם אם Claude לא כיבד את התקרה, לא ממשיכים עם רשימה חריגה
      : [];
    return { title, suggestions };
  } catch {
    return { title: null, suggestions: [] };
  }
}

/** מגביל בפועל ל-3+3 גם אם Claude החזיר יותר - התקרה הזו היא הכרחית, לא הצעה. */
function enforceHardCap(suggestions: ClaudeSuggestion[]): ClaudeSuggestion[] {
  const attractions = suggestions.filter((s) => s.category === "attraction").slice(0, 3);
  const restaurants = suggestions.filter((s) => s.category === "restaurant").slice(0, 3);
  return [...attractions, ...restaurants];
}

async function verifyViaGoogle(suggestion: ClaudeSuggestion, contextHint: string): Promise<TrippyQuickStop | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const query = `${suggestion.name} ${contextHint}`;
    const url =
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}` +
      `&key=${apiKey}&language=he`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const top = (data?.results?.[0] ?? null) as GooglePlaceTextSearchResult | null;
    const location = top?.geometry?.location;
    if (!top?.name || !location) return null;

    const photoRef = top.photos?.[0]?.photo_reference;
    const imageUrl = photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoRef)}` : null;

    return {
      id: crypto.randomUUID(),
      name: top.name,
      category: suggestion.category,
      shortDescription: suggestion.shortDescription || null,
      imageUrl,
      address: top.formatted_address ?? null,
      latitude: location.lat,
      longitude: location.lng,
      rating: top.rating ?? null,
    };
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const freeText = typeof body?.freeText === "string" ? body.freeText.trim() : "";
  if (!freeText) {
    return NextResponse.json({ error: "חסר מלל חופשי" }, { status: 400 });
  }

  // *** תוספת (בקשה מפורשת - "המלל שמשאיר המשתמש... מותאם על בסיס
  // ההעדפות של המשתמש מהפרופיל"): מביאים את ה-DNA (כשרות/נגישות/
  // העדפות אוכל/תחומי עניין) אם המשתמש מחובר - Claude מקבל את זה
  // כהקשר משני (הבקשה הספציפית תמיד גוברת אם יש סתירה, ר' buildDnaContext).
  let dnaContext = "";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const dna = await getTravelDna(supabase, user.id);
      dnaContext = buildDnaContext(dna);
    }
  } catch {
    // לא קריטי - ממשיכים בלי הקשר פרופיל אם זה נכשל, לא חוסמים את הבקשה
  }

  const { title, suggestions: rawSuggestions } = await suggestStopsViaClaude(freeText, dnaContext);
  const capped = enforceHardCap(rawSuggestions);

  if (capped.length === 0) {
    return NextResponse.json({ stops: [], title: null });
  }

  const verified = await Promise.all(capped.map((s) => verifyViaGoogle(s, freeText)));
  const stops = verified.filter((s): s is TrippyQuickStop => s !== null);

  return NextResponse.json({ stops, title });
}
