import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { PLACE_CATEGORIES, isValidPlaceCategory } from "@/constants/placeCategories";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/**
 * מיועד בעיקר לתיקון שורות **קיימות** שנשמרו לפני תיקון הבאג ב-
 * smart-search (כשה-category הראשי קיבל תת-סוג עדין כמו general_attractions
 * במקום אחת מ-5 הקטגוריות האמיתיות) - או שנוצרו עם בקטה לא נכונה בטעות
 * (למשל עגלת קפה שנוספה תחת "אטרקציות").
 *
 * שני מצבי הפעלה:
 * (א) `ids` מפורש - האדמין סימן ✓ מקומות ספציפיים ברשימה, ורק אלה
 *     עוברים סיווג מחדש. זה המצב המומלץ: לא מבזבז קריאות AI על
 *     מקומות שכבר מסווגים נכון, ולא מסתכן בשינוי קטגוריה שכבר תקינה.
 * (ב) בלי `ids` - נופל חזרה לרוץ באצוות על כל המקומות שלא סומנו
 *     is_manually_edited (cursor לפי id) - שימושי רק בפעם הראשונה
 *     שמריצים ניקוי גורף על כל המאגר.
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const ids: string[] | null = Array.isArray(body?.ids) && body.ids.length > 0 ? body.ids : null;
  const mode: "all" | "manually_edited_only" = body?.mode === "manually_edited_only" ? "manually_edited_only" : "all";
  const afterId: string | null = body?.afterId ?? null;

  const BATCH_SIZE = ids ? ids.length : 15;
  const supabase = createAdminClient();

  let query = supabase
    .from("places")
    .select("id, name, category, subcategory, short_description, tags", { count: "exact" })
    .order("id", { ascending: true });

  if (ids) {
    // מצב "מקומות נבחרים" - מתעלמים גם מ-is_manually_edited וגם מ-
    // is_legacy בכוונה: אם האדמין סימן ✓ במפורש (מעמוד /admin/places-archive
    // למשל), זו הוראה מפורשת, לא ריצה גורפת.
    query = query.in("id", ids);
  } else {
    // ברירת מחדל בריצה גורפת: לא נוגעים במקומות שאדמין כבר ערך ידנית,
    // ולא נוגעים במקומות is_legacy - אלה שלא מוצגים בכלל בעמוד
    // /admin/places (שם עצמו מסנן is_legacy=false כברירת מחדל) - כדי
    // שה"סך הכל" שמוצג תמיד יתאים למה שהאדמין רואה ברשימה.
    query = query.eq("is_legacy", false);
    if (mode === "all") {
      query = query.eq("is_manually_edited", false);
    }
    if (afterId) {
      query = query.gt("id", afterId);
    }
  }

  const { data: places, error, count } = await query.limit(BATCH_SIZE);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const categoryOptions = PLACE_CATEGORIES.map((c) => `${c.key} (${c.label})`).join(", ");
  let reclassified = 0;
  let unchanged = 0;
  let failed = 0;
  // *** תיקון: לפני זה, "נכשל" היה עלום - אף שגיאה לא הגיעה חזרה
  // לדפדפן, רק ל-console.error בשרת (שאדמין שמריץ dev מקומי לרוב לא
  // בודק). עכשיו כל שגיאה נאספת ומוחזרת ב-JSON כדי שהיא תוצג ישירות
  // בממשק, בלי צורך לחפש בלוגים.
  const errors: string[] = [];

  for (const place of places ?? []) {
    const prompt = `מקום: "${place.name}"
תיאור: ${place.short_description ?? "אין תיאור"}
תת-קטגוריה קיימת (אם יש): ${place.subcategory ?? "לא ידוע"}
תגיות קיימות (אם יש): ${(place.tags ?? []).join(", ") || "אין"}
קטגוריה ראשית נוכחית במאגר (**עלולה להיות שגויה מבאג ישן - אל תסמוך עליה**): ${place.category}

קבע את הקטגוריה הראשית הנכונה **לפי שם/תיאור/תגיות המקום בפועל בלבד**, מתוך 5 אלה:
${categoryOptions}

כללי הכרעה למקרים גבוליים:
- בר/מסעדה עם ריקודים, DJ, או שהיא ידועה כמקום בילוי ליליים -> nightlife.
- מסעדה/רופטופ/בית קפה בלי אלמנט חיי-לילה מובהק -> restaurants.
- שביל טבע/חוף/פארק/נקודת תצפית -> nature.
- מלון/צימר/הוסטל/דירת נופש -> hotels.
- כל השאר (אתר תיירותי, מוזיאון, קניון, גלריה, אירוע) -> attractions.

השב אך ורק ב-JSON: {"category": "אחד מ-5 המפתחות למעלה", "reason": "משפט קצר"}`;

    const { text, error: callError } = await callClaude(prompt);
    if (!text) {
      failed++;
      if (errors.length < 5) errors.push(`"${place.name}": ${callError ?? "אין תשובה מ-Claude"}`);
      continue;
    }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`Claude לא החזיר JSON. תשובה גולמית: ${text.slice(0, 200)}`);
      const parsed = JSON.parse(jsonMatch[0]);
      if (!isValidPlaceCategory(parsed.category)) throw new Error(`קטגוריה לא תקינה: "${parsed.category}"`);

      if (parsed.category === place.category) {
        unchanged++;
        continue;
      }

      const { error: updateError } = await supabase.from("places").update({ category: parsed.category }).eq("id", place.id);
      if (updateError) throw new Error(`שמירה נכשלה: ${updateError.message}`);
      reclassified++;
    } catch (parseError) {
      const message = parseError instanceof Error ? parseError.message : String(parseError);
      logAiError("כשל בסיווג מחדש של קטגוריה", { placeId: place.id, message });
      if (errors.length < 5) errors.push(`"${place.name}": ${message}`);
      failed++;
    }
  }

  const lastId = ids ? null : places && places.length > 0 ? places[places.length - 1].id : afterId;
  const remaining = ids ? 0 : Math.max(0, (count ?? 0) - (places ?? []).length);

  return NextResponse.json({
    processedNow: (places ?? []).length,
    reclassified,
    unchanged,
    failed,
    remaining,
    lastId,
    errors,
  });
}
