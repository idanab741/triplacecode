import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { findPlaceStatusAndPhoto } from "@/services/tripBuilder/placePhotoService";
import { callClaude, logAiError } from "@/services/ai/claudeService";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

interface ExtractedPlace {
  name: string;
  description: string | null;
}

/**
 * מנסה לפרק רשימה מובנית **בלי Claude בכלל** - הפורמט שהמשתמש בדרך כלל
 * מדביק (מספר-שם-תיאור, מופרד ב-Tab או כמה רווחים, שורה לכל פריט) הוא
 * צפוי מספיק כדי לפרק אותו בקוד פשוט. זה מהיר יותר, זול יותר (0 טוקנים),
 * ואמין יותר מלשלוח ל-Claude ולבקש ממנו "להעתיק" בחזרה טקסט שכבר קיים
 * בקלט - זה בדיוק מה שגרם לקטיעת התשובה בבקשות גדולות.
 */
function tryParseStructuredList(freeText: string): ExtractedPlace[] {
  const lines = freeText.split("\n").map((l) => l.trim()).filter(Boolean);
  const results: ExtractedPlace[] = [];

  for (const line of lines) {
    // מספר בהתחלה (אופציונלי) + Tab או 2+ רווחים בין השדות
    const cleaned = line.replace(/^\d+[.):\t]?\s*/, "");
    const parts = cleaned.split(/\t+| {2,}/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && parts[0].length > 1 && parts[0].length < 80) {
      results.push({ name: parts[0], description: parts.slice(1).join(" ") || null });
    }
  }

  // אם רוב השורות אכן נפרקו בהצלחה (לא רק שורה אקראית אחת) - זו כנראה
  // רשימה מובנית אמיתית, לא טקסט חופשי שרק נראה כך במקרה.
  return results.length >= Math.max(2, lines.length * 0.6) ? results : [];
}

/**
 * שלב 1: Claude מפרש את הטקסט החופשי - שני מקרים אפשריים, לא ידוע מראש
 * איזה מהם: (א) בקשה כללית ("100 עגלות קפה בתל אביב") - Claude מייצר
 * כמה שמות אמיתיים שהוא בטוח בהם, לא ממלא כדי להגיע למספר. (ב) רשימה
 * מוכנה שהמשתמש הדביק (עם שמות ותיאורים) - Claude מחלץ בדיוק את זה,
 * לא כותב מחדש/מגניב תיאורים משלו.
 */
async function extractPlacesFromFreeText(freeText: string, location: string, bucketLabel: string): Promise<{ places: ExtractedPlace[]; debugInfo: string | null }> {
  // שלב 0 - ניסיון פירוק ישיר בקוד, בלי Claude בכלל. אם זה מצליח (רשימה
  // מובנית שהמשתמש כבר כתב) - זהו, סיימנו, בלי טוקנים, בלי סיכון קטיעה.
  const structured = tryParseStructuredList(freeText);
  if (structured.length > 0) {
    return { places: structured, debugInfo: null };
  }

  // שלב 1 - רק אם הפירוק הישיר לא הצליח (טקסט חופשי אמיתי, או בקשה
  // כללית כמו "100 עגלות קפה") - פונים ל-Claude.
  const prompt = `אתה עוזר לצוות אדמין להזין מקומות למאגר נתונים. הטקסט הבא הוא **קלט מהאדמין**, ויכול
להיות אחד משני סוגים - עליך לזהות איזה מהם:

(א) בקשה כללית ליצירת רשימה, למשל "100 עגלות קפה בתל אביב" או "מסעדות איטלקיות ברומא" -
במקרה כזה, החזר כמה שמות **אמיתיים** של מקומות שאתה **בטוח** שקיימים, עד המספר שהתבקש -
**אל תמלא עד המספר המבוקש עם ניחושים** - עדיף פחות תוצאות אמיתיות מהרבה תוצאות מומצאות.

(ב) רשימה מוכנה שהאדמין כבר כתב/הדביק (שמות מקומות, לפעמים עם תיאורים) - במקרה כזה, **חלץ
בדיוק** את מה שכתוב - אל תשנה, תקצר, או תכתוב מחדש את התיאורים שהאדמין כבר סיפק.

מיקום/הקשר גיאוגרפי (אם רלוונטי): ${location || "לא צוין"}
קטגוריה מבוקשת: ${bucketLabel} (אם הבקשה כללית - התמקד בסוג הזה בלבד)

הטקסט מהאדמין:
"""
${freeText}
"""

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"places": [{"name": "שם מדויק", "description": "תיאור אם סופק/ידוע, אחרת null"}, ...]}`;

  const { text, error } = await callClaude(prompt, 8000);
  if (error || !text) {
    logAiError("פירוק טקסט חופשי לרשימת מקומות נכשל", { error });
    return { places: [], debugInfo: `שגיאת Claude: ${error ?? "אין תשובה בכלל"}` };
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { places: [], debugInfo: `Claude לא החזיר JSON. תשובה גולמית: ${text.slice(0, 500)}` };
    const parsed = JSON.parse(jsonMatch[0]);
    const places = Array.isArray(parsed.places) ? parsed.places : [];
    return { places, debugInfo: places.length === 0 ? `JSON תקין אבל places ריק. תשובה גולמית: ${text.slice(0, 500)}` : null };
  } catch (parseError) {
    // התשובה נקטעה באמצע (רשימה גדולה מדי) - ה-JSON השלם לא תקין, אבל
    // אפשר עדיין לחלץ את הפריטים היחידים שכן הושלמו במלואם, במקום לאבד
    // הכל. עדיף חלק מהרשימה מכלום.
    const itemMatches = text.matchAll(/\{\s*"name"\s*:\s*"([^"]*)"\s*,\s*"description"\s*:\s*(null|"([^"]*)")\s*\}/g);
    const salvaged: ExtractedPlace[] = [];
    for (const m of itemMatches) {
      salvaged.push({ name: m[1], description: m[2] === "null" ? null : m[3] });
    }
    if (salvaged.length > 0) {
      return { places: salvaged, debugInfo: `התשובה נקטעה (רשימה ארוכה מדי) - שוחזרו ${salvaged.length} פריטים שלמים בלבד מתוך הרשימה.` };
    }
    const message = parseError instanceof Error ? parseError.message : String(parseError);
    logAiError("כשל בפענוח JSON של רשימת מקומות", { message });
    return { places: [], debugInfo: `שגיאת פענוח JSON: ${message}. תשובה גולמית: ${text.slice(0, 500)}` };
  }
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const freeText: string | undefined = body?.freeText;
  const country: string = body?.country ?? "";
  const city: string = body?.city ?? "";
  const bucket: string = body?.bucket ?? "attractions";
  if (!freeText?.trim()) {
    return NextResponse.json({ error: "יש להזין טקסט חיפוש" }, { status: 400 });
  }
  if (!country.trim() && !city.trim()) {
    return NextResponse.json({ error: "חובה למלא מדינה או עיר/יעד" }, { status: 400 });
  }

  const BUCKET_LABELS: Record<string, string> = {
    attractions: "אטרקציות כלליות",
    nature: "טבע (מסלולים, תצפיות, חופים, פארקים)",
    nightlife: "חיי לילה (ברים, מועדונים, הופעות)",
    restaurants: "מסעדות ובתי קפה",
    hotels: "מלונות ולינה",
  };
  const BUCKET_CATEGORIES: Record<string, string> = {
    attractions: "general_attractions",
    nature: "nature_trails",
    nightlife: "cocktail_bar",
    restaurants: "cafe",
    hotels: "hotel",
  };

  const location = [city, country].filter(Boolean).join(", ");
  const { places: extracted, debugInfo } = await extractPlacesFromFreeText(
    freeText,
    location,
    BUCKET_LABELS[bucket] ?? BUCKET_LABELS.attractions
  );

  if (extracted.length === 0) {
    return NextResponse.json({ places: [], errors: [debugInfo ?? "לא זוהו מקומות בטקסט - נסה לנסח אחרת"] });
  }

  const supabase = createAdminClient();
  const savedPlaces: unknown[] = [];
  const errors: string[] = [];

  // ברצף, לא Promise.all - כדי לא לפגוע במגבלת קצב הבקשות של גוגל, בדיוק
  // כמו בשאר מנועי האיסוף במערכת.
  for (const item of extracted) {
    if (!item?.name?.trim()) continue;
    try {
      const searchQuery = city ? `${item.name}, ${city}` : item.name;
      const result = await findPlaceStatusAndPhoto(searchQuery);

      if (!result.exists) {
        errors.push(`"${item.name}" - לא נמצא ב-Google, לא נוסף`);
        continue;
      }
      if (result.isClosed) {
        errors.push(`"${item.name}" - מסומן כסגור ב-Google, לא נוסף`);
        continue;
      }

      const { data, error: insertError } = await supabase
        .from("places")
        .insert({
          name: result.googleName ?? item.name,
          short_description: item.description,
          category: BUCKET_CATEGORIES[bucket] ?? "general_attractions",
          city: city || null,
          country: country || null,
          rating: result.rating,
          rating_count: result.ratingCount,
          latitude: result.latitude,
          longitude: result.longitude,
          image_urls: result.photoRef ? [`/api/places/photo?ref=${encodeURIComponent(result.photoRef)}`] : [],
          is_legacy: false,
          source: "smart_search",
        })
        .select()
        .single();

      if (insertError) {
        errors.push(`"${item.name}" - שגיאת שמירה: ${insertError.message}`);
        continue;
      }
      savedPlaces.push(data);
    } catch (e) {
      errors.push(`"${item.name}" - ${e instanceof Error ? e.message : "שגיאה"}`);
    }
  }

  return NextResponse.json({ places: savedPlaces, errors, requestedCount: extracted.length });
}
