import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { TRIP_TYPE_GROUPS, CUISINE_TAGS } from "@/services/places/tripTaxonomy";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: place, error } = await supabase
    .from("places")
    .select("name, category, subcategory, short_description, tags")
    .eq("id", id)
    .maybeSingle();

  if (error || !place) {
    return NextResponse.json({ error: "המקום לא נמצא" }, { status: 404 });
  }

  const allTripTypeIds = TRIP_TYPE_GROUPS.map((g) => g.id).join(", ");
  const allSubTagIds = TRIP_TYPE_GROUPS.flatMap((g) => g.subTags.map((t) => t.id)).join(", ");
  const allCuisineIds = CUISINE_TAGS.map((t) => t.id).join(", ");

  const prompt = `מקום: "${place.name}" (קטגוריה: ${place.category}, תת-קטגוריה: ${place.subcategory ?? "לא ידוע"})
תיאור: ${place.short_description ?? "אין תיאור"}

בחר תיוג מדויק מתוך הרשימות הבאות בלבד (אל תמציא ערכים חדשים):
trip_type_tags אפשריים: ${allTripTypeIds}
תתי-תגיות אפשריים: ${allSubTagIds}
cuisine_tags אפשריים (רק אם רלוונטי, אחרת מערך ריק): ${allCuisineIds}

*** חשוב מאוד: תייג בצמצום ובדיוק, לא בנדיבות!
- trip_type_tags: בחר לכל היותר 1-2 (רק אם המקום *באמת* משרת שתי מטרות עיקריות, אחרת 1 בלבד). אל תוסיף קטגוריה רק כי יש קשר רופף.
- sub_tags: עד 3, רק הכי מדויקים.
- עדיף תיוג חד ומצומצם על פני תיוג רחב ומטושטש - זה משפיע ישירות על איכות ההתאמה למשתמשים. ***

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"trip_type_tags": ["..."], "sub_tags": ["..."], "cuisine_tags": ["..."], "kosher": true/false/null, "accessible": true/false/null, "seasons": ["..."], "suitable_child_ages": ["..."], "budget_tier": "$/$$/$$$/$$$$" or null}`;

  const { text, error: aiError } = await callClaude(prompt);
  if (aiError || !text) {
    return NextResponse.json({ error: aiError ?? "Claude לא החזיר תשובה" }, { status: 500 });
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובה");
    const suggestion = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ suggestion });
  } catch (parseError) {
    logAiError("כשל בפענוח הצעת תיוג", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return NextResponse.json({ error: "לא הצלחנו לפענח את הצעת Claude" }, { status: 500 });
  }
}