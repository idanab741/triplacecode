import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { collectPlacesForCityAndCategory } from "@/services/places/collectionService";
import { DISCOVERY_BUCKETS } from "@/services/admin/discoveryConfigV2";
import { callClaude, logAiError } from "@/services/ai/claudeService";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** לפני שפונים לגוגל בכלל - Claude בונה שאילתת חיפוש מדויקת ומפורשת,
 *  שמנטרלת דו-משמעות (הדוגמה שגרמה לבאג: "קניונים" בעברית = גם ניקבת
 *  סלע טבעית וגם קניון קניות - חיפוש גולמי של תווית הקטגוריה בגוגל
 *  החזיר קניוני קניות, לא ניקבות טבע). לא ניחוש טקסטואלי בקוד - Claude
 *  מבין את ההקשר (סוג הטיול + הקטגוריה המדויקת) ובונה שאילתה חד-משמעית. */
async function buildDisambiguatedQuery(tripTypeLabel: string, categoryLabel: string, location: string): Promise<string> {
  const prompt = `אתה בונה שאילתת חיפוש ל-Google Places API, בעברית, שתחזיר בדיוק את סוג המקום הנכון -
לא פרשנות מוטעית של מילה דו-משמעית.

הֶקְשֵׁר: מחפשים מקומות לקטגוריה "${categoryLabel}" בהקשר של "${tripTypeLabel}", ב-${location}.

שים לב במיוחד למילים דו-משמעיות בעברית שעלולות להטעות חיפוש (דוגמה מוכרת: "קניון" יכול להתפרש
כניקבת סלע טבעית **או** כמרכז קניות - חובה להבהיר איזה מהשניים!). אם יש דו-משמעות כזו בקטגוריה
הנוכחית, נסח את השאילתה כך שלא תתפרש בטעות, למשל בעזרת מילים נלוות חד-משמעיות (טבע, ניקבת סלע,
מסלול, שמורה - לא קניות/מרכז מסחרי).

השב אך ורק בשאילתת החיפוש עצמה, בעברית, קצרה (2-5 מילים), בלי שום טקסט נוסף, בלי מרכאות.`;

  const { text, error } = await callClaude(prompt, 100);
  if (error || !text?.trim()) {
    logAiError("בניית שאילתת חיפוש חד-משמעית נכשלה - נופל לתווית הקטגוריה הגולמית", { categoryLabel, error });
    return categoryLabel; // גיבוי - עדיף מלגמרי להיכשל, גם אם פחות מדויק
  }
  return text.trim().replace(/^["']|["']$/g, "");
}

/**
 * מריצה בפועל Discovery Job - קוראת ל-Google (דרך collectPlacesForCityAndCategory,
 * מנוע האיסוף האמיתי שכבר קיים) פעם אחת לכל קטגוריה שנבחרה, שומרת
 * לטבלת places (עם הגנה מובנית מפני כפילויות ומקומות שנערכו ידנית).
 *
 * ⚠️ גרסה ראשונה, פשוטה במכוון: לא כל הפילטרים (עונה, נגישות, תקציב וכו')
 * מיושמים עדיין בפועל בחיפוש ה-Google עצמו - רק עיר/מדינה/קטגוריה. סף
 * הדירוג המובנה במנוע האיסוף הוא 3.5 קבוע (לא job.min_rating הדינמי) -
 * מוחל כאן סינון נוסף מעל זה, אחרי השמירה, לצורך הדיווח בלבד.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: job, error: jobError } = await supabase.from("discovery_jobs").select("*").eq("id", id).single();
  if (jobError || !job) return NextResponse.json({ error: "בקשה לא נמצאה" }, { status: 404 });

  await supabase.from("discovery_jobs").update({ status: "running" }).eq("id", id);

  const tripType = DISCOVERY_BUCKETS.find((t) => t.key === job.trip_type);
  const filters = (job.filters ?? {}) as Record<string, string>;
  // עיר לא חובה - אם לא הוגדרה עיר/אזור ספציפיים, מחפשים ברמת המדינה כולה
  // (Google Places Text Search מתמודד היטב עם "עגלות קפה, ישראל" בלי צורך
  // בעיר מדויקת - הוא עצמו "משלים" את הפיזור הגיאוגרפי).
  const country = filters.country || "ישראל";
  const location = filters.city || filters.area || country;

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const categoryKey of job.categories as string[]) {
    const category = tripType?.categories.find((c) => c.key === categoryKey);
    const rawLabel = category ? category.label : categoryKey;
    try {
      // Claude בונה שאילתה מדויקת ומנוטרלת-דו-משמעות לפני שפונים לגוגל
      // בכלל - לא הטקסט הגולמי של הקטגוריה. ר' buildDisambiguatedQuery
      // והבאג שהוביל לזה (קניון=מרכז קניות לעומת קניון=ניקבת סלע טבעית).
      //
      // הערה נוספת: category (הפרמטר השלישי) משתמש במפתח הקטגוריה
      // מה-Discovery Wizard עצמו - לא בהכרח זהה תמיד ל-20 ה-IDs הרשמיים
      // של interest_category ב-tripTaxonomy.ts. יישור מלא בין שתי
      // הטקסונומיות הוא עבודת המשך נפרדת, לא נפתר כאן.
      const query = await buildDisambiguatedQuery(tripType?.label ?? job.trip_type, rawLabel, location);
      const result = await collectPlacesForCityAndCategory(location, categoryKey, country, query);
      totalFetched += result.fetched;
      totalSaved += result.saved;
      totalSkipped += result.skipped;
    } catch (e) {
      errors.push(`${rawLabel}: ${e instanceof Error ? e.message : "שגיאה"}`);
    }
  }

  await supabase
    .from("discovery_jobs")
    .update({
      status: errors.length === job.categories.length ? "failed" : "completed",
      found_count: totalFetched,
      approved_count: totalSaved,
      duplicate_count: totalSkipped,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ fetched: totalFetched, saved: totalSaved, skipped: totalSkipped, errors });
}
