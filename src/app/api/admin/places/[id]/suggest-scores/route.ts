import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { callClaude, logAiError } from "@/services/ai/claudeService";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const TRIPMATCH_KEYS = [
  "coffee_carts", "nature_trails", "beaches_pools", "viewpoints", "parks_picnic",
  "water_parks", "attractions", "sports_extreme", "restaurants", "wineries",
  "culture_museums", "shopping", "events", "nightlife", "spa",
  "boating", "heritage", "kids_family", "art_galleries", "photo_spots",
];

const DNA_KEYS = [
  "romantic", "family", "social", "luxury", "local_authentic",
  "touristy", "special", "photogenic", "adventurous", "natural",
  "urban", "cultural", "culinary", "wellness_calm", "active", "hidden_gem",
];

/**
 * ✨ מלא עם AI - Claude מנתח שם+תיאור+קטגוריה של מקום, ומחזיר ציון 0-100
 * לכל אחת מ-20 תגיות TripMatch ו-16 מאפייני DNA, בנוסף כשר/נגישות אם
 * ניתן להסיק. שומר ישירות (לא רק מציג הצעה) - זו אותה פעולה בדיוק כמו
 * לחיצה ידנית על הרבה צ'יפים ברצף, רק אוטומטית.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: place, error: fetchError } = await supabase.from("places").select("*").eq("id", id).single();
  if (fetchError || !place) {
    return NextResponse.json({ error: "מקום לא נמצא" }, { status: 404 });
  }

  const prompt = `אתה מסווג מקומות למאגר נתונים של אפליקציית טיולים. נתח את המקום הבא ותן ציון
לכל תגית - **0-100, לא כן/לא** (0 = לא רלוונטי בכלל, 100 = הכי מתאים).

שם: ${place.name}
תיאור: ${place.short_description ?? "לא סופק"}
קטגוריה: ${place.category}
עיר/מדינה: ${[place.city, place.country].filter(Boolean).join(", ") || "לא ידוע"}

חשוב: תייג בזהירות ובדיוק - אל תיתן ציון גבוה "כדי לכסות את כל האפשרויות". רוב התגיות
אמורות לקבל 0 עבור מקום נתון - רק אלה שבאמת רלוונטיות מקבלות ציון משמעותי.

תגיות TripMatch (מפתח -> ציון 0-100): ${TRIPMATCH_KEYS.join(", ")}
מאפייני DNA (מפתח -> ציון 0-100): ${DNA_KEYS.join(", ")}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{
  "tripmatch_scores": {"מפתח": ציון, ...},
  "dna_scores": {"מפתח": ציון, ...},
  "kosher": true | false | null,
  "accessible": true | false | null
}`;

  const { text, error } = await callClaude(prompt, 2000);
  if (error || !text) {
    logAiError("מילוי אוטומטי של תגיות נכשל", { placeId: id, error });
    return NextResponse.json({ error: "השלמת AI נכשלה" }, { status: 500 });
  }

  let suggestion: {
    tripmatch_scores?: Record<string, number>;
    dna_scores?: Record<string, number>;
    kosher?: boolean | null;
    accessible?: boolean | null;
  };
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובה");
    suggestion = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    logAiError("כשל בפענוח הצעת ציונים", {
      placeId: id,
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return NextResponse.json({ error: "לא הצלחנו לפענח את הצעת Claude" }, { status: 500 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("places")
    .update({
      tripmatch_scores: suggestion.tripmatch_scores ?? {},
      dna_scores: suggestion.dna_scores ?? {},
      kosher: suggestion.kosher ?? place.kosher,
      accessible: suggestion.accessible ?? place.accessible,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ place: updated });
}
