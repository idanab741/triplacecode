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
 * (למשל עגלת קפה שנוספה תחת "אטרקציות"). רץ באצוות (כמו bulk-suggest-tags),
 * עם cursor לפי id, כדי לא לחרוג ממגבלת הזמן של קריאת API בודדת.
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const mode: "all" | "manually_edited_only" = body?.mode === "manually_edited_only" ? "manually_edited_only" : "all";
  const afterId: string | null = body?.afterId ?? null;

  const BATCH_SIZE = 15;
  const supabase = createAdminClient();

  let query = supabase
    .from("places")
    .select("id, name, category, subcategory, short_description, tags", { count: "exact" })
    .order("id", { ascending: true });

  // ברירת מחדל: לא נוגעים במקומות שאדמין כבר ערך ידנית ואישר את הקטגוריה
  // שלהם (is_manually_edited=true) - רק אלה שנוצרו אוטומטית ולא נגעו בהם.
  if (mode === "all") {
    query = query.eq("is_manually_edited", false);
  }
  if (afterId) {
    query = query.gt("id", afterId);
  }

  const { data: places, error, count } = await query.limit(BATCH_SIZE);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const categoryOptions = PLACE_CATEGORIES.map((c) => `${c.key} (${c.label})`).join(", ");
  let reclassified = 0;
  let unchanged = 0;
  let failed = 0;

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

    const { text } = await callClaude(prompt);
    if (!text) {
      failed++;
      continue;
    }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("no json");
      const parsed = JSON.parse(jsonMatch[0]);
      if (!isValidPlaceCategory(parsed.category)) throw new Error(`invalid category: ${parsed.category}`);

      if (parsed.category === place.category) {
        unchanged++;
        continue;
      }

      await supabase.from("places").update({ category: parsed.category }).eq("id", place.id);
      reclassified++;
    } catch (parseError) {
      logAiError("כשל בסיווג מחדש של קטגוריה", {
        placeId: place.id,
        message: parseError instanceof Error ? parseError.message : String(parseError),
      });
      failed++;
    }
  }

  const lastId = places && places.length > 0 ? places[places.length - 1].id : afterId;

  return NextResponse.json({
    processedNow: (places ?? []).length,
    reclassified,
    unchanged,
    failed,
    remaining: Math.max(0, (count ?? 0) - (places ?? []).length),
    lastId,
  });
}
