import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { TRIPMATCH_KEYS, DNA_KEYS, CUISINE_KEYS, PLACE_TYPE_KEYS } from "@/constants/placeTagOptions";
import { PLACE_CATEGORIES, isValidPlaceCategory, type PlaceCategoryKey } from "@/constants/placeCategories";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const CATEGORY_KEYS = PLACE_TYPE_KEYS;

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

בנוסף - שני שדות שהם **בחירה בינארית** (המקום שייך/לא שייך), לא ציון:
סוגי מטבח אפשריים (קבע לפי **שם ותיאור המקום בפועל**, לא רק שדה הקטגוריה שאולי לא מדויק -
אם השם/תיאור מרמזים שזו מסעדה/בית קפה/עגלת קפה, כן למלא כאן, גם אם category רשום אחרת):
${CUISINE_KEYS.join(", ")}
קטגוריה/סוג מקום מדויק (בחר 1-2 הכי מדויקים מהרשימה, לא יותר): ${CATEGORY_KEYS.join(", ")}

בנוסף - קטגוריה ראשית (main_category): המקום הזה שייך ל**אחת בלבד** מתוך 5 האפשרויות
הבאות (זו קביעה נפרדת מ-"קטגוריה/סוג מקום" למעלה - זו הקטגוריה הכי-עליונה שמוצגת ברשימה
הראשית של מקומות). קבע לפי שם/תיאור המקום בפועל, **לא** לפי category הנוכחי שרשום למעלה
(הוא עלול להיות שגוי מהזנה ידנית קודמת) - למשל בר-מסעדה עם רחבת ריקודים ואירועי DJ שייך
ל-nightlife גם אם יש בו גם אוכל; מסעדת רופטופ ללא מוזיקה/ריקודים שייכת ל-restaurants:
${PLACE_CATEGORIES.map((c) => c.key).join(", ")}

הסבר קצר (category_reason): משפט אחד קצר למה בחרת את main_category הזו - כדי שאדמין
אנושי יוכל לבדוק במהירות אם ההחלטה הגיונית לפני שהוא סומך עליה.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{
  "tripmatch_scores": {"מפתח": ציון, ...},
  "dna_scores": {"מפתח": ציון, ...},
  "cuisine_tags": ["מפתח", ...],
  "category_tags": ["מפתח", ...],
  "main_category": "restaurants | nightlife | attractions | nature | hotels",
  "category_reason": "משפט קצר",
  "kosher": true | false | null,
  "accessible": true | false | null
}`;

  const { text, error } = await callClaude(prompt, 4000);
  if (error || !text) {
    logAiError("מילוי אוטומטי של תגיות נכשל", { placeId: id, error });
    return NextResponse.json({ error: "השלמת AI נכשלה" }, { status: 500 });
  }

  let suggestion: {
    tripmatch_scores?: Record<string, number>;
    dna_scores?: Record<string, number>;
    cuisine_tags?: string[];
    category_tags?: string[];
    main_category?: string;
    category_reason?: string;
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

  // *** תיקון: "מלא עם AI" עדיין לא נגע מעולם ב-category הראשי - זו הסיבה
  // שקטגוריות שגויות (שהוזנו ידנית/הודבקו לפני התיקון הקודם) לא תוקנו
  // גם אחרי לחיצה על "מלא עם AI". עכשיו, אם Claude החזיר main_category
  // תקין (אחד מ-5), הוא כן נשמר - רק אם המקום לא נערך ידנית לאחרונה
  // (is_manually_edited), כדי לא לדרוס שינוי קטגוריה מכוון של אדמין.
  const suggestedCategory: PlaceCategoryKey | null =
    suggestion.main_category && isValidPlaceCategory(suggestion.main_category) ? suggestion.main_category : null;

  const { data: updated, error: updateError } = await supabase
    .from("places")
    .update({
      tripmatch_scores: suggestion.tripmatch_scores ?? {},
      dna_scores: suggestion.dna_scores ?? {},
      cuisine_tags: suggestion.cuisine_tags ?? place.cuisine_tags ?? [],
      tags: suggestion.category_tags ?? place.tags ?? [],
      category: suggestedCategory && !place.is_manually_edited ? suggestedCategory : place.category,
      kosher: suggestion.kosher ?? place.kosher,
      accessible: suggestion.accessible ?? place.accessible,
    })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ place: updated, categoryReason: suggestion.category_reason ?? null });
}
