import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מהדורת יעד בודדת, כולל כל האטרקציות - **גם** אלה שקושרו במפורש
 *  (destination_edition_places) **וגם** כל מקום שקיים כבר במאגר עם
 *  city/region תואם לשם היעד - אותה שאילתה בדיוק (city.ilike/region.ilike,
 *  is_legacy=false) שהעמוד הציבורי /destination/[id] כבר משתמש בה
 *  (ר' services/places/placesServerService.ts getPlacesByCityAndKeywords).
 *
 *  *** תיקון (באג אמיתי - "יש אטרקציות משויכות!! מאיפה אתה לוקח את
 *  המאגר???"): הגרסה הקודמת הציגה *רק* מקומות שמישהו קישר במפורש
 *  ל-edition הזה. אבל האפליקציה עצמה (העמוד הציבורי) לא עובדת ככה
 *  בכלל - היא שולפת לפי city/region תואם, בלי שום צורך בקישור ידני.
 *  זו בדיוק ההפרה של דרישה #31 ("האפליקציה וה-ADMIN צריכים להשתמש
 *  באותו מקור DATA") - האדמין הראה "0" בזמן שבפועל יש מקומות אמיתיים
 *  במאגר עם city="פאפוס" (או דומה), שהאפליקציה כן הייתה מציגה. עכשיו
 *  שני המקורות ממוזגים (curated קודם, כדי לשמר sort_order ידני), עם
 *  דגל curated לכל מקום כדי שה-UI ידע אם "הסרה" רלוונטית (רק למקושר
 *  במפורש - מקום שנמצא אוטומטית לפי עיר לא "מקושר" שאפשר להסיר קישור
 *  שלו; כדי להוציא אותו יש לתקן את שדה העיר של המקום עצמו). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: edition, error } = await supabase
    .from("destination_editions")
    .select("*, destinations(id, name, country)")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!edition) return NextResponse.json({ error: "מהדורת היעד לא נמצאה" }, { status: 404 });

  const { data: links, error: linksError } = await supabase
    .from("destination_edition_places")
    .select("place_id, sort_order, places(*)")
    .eq("edition_id", id)
    .order("sort_order", { ascending: true });

  if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 });

  // *** תיקון (שגיאת build אמיתית - "Conversion of type 'any[][]' to
  // type 'Record<string, unknown>[]' may be a mistake"): supabase-js
  // מסיק את הטיפוס של המשאב המקונן places(*) לפעמים כאובייקט בודד
  // ולפעמים כמערך, תלוי אם היחס place_id→places.id מזוהה אצלו כ-
  // to-one או to-many (משתנה לפי אם יש Database types מיוצרים
  // בפרויקט). ה-cast הישיר הקודם הניח תמיד אובייקט בודד - כששורת ה-
  // build האמיתית (עם טיפוסים מלאים) הסיקה מערך, ה-cast נכשל בפועל.
  // הקוד כאן מטפל בשתי הצורות במפורש, בלי any/cast לא-בטוח.
  type PlaceEmbed = Record<string, unknown> | Record<string, unknown>[] | null;
  const curatedPlaces = (links ?? [])
    .map((l) => {
      const embed = l.places as PlaceEmbed;
      return Array.isArray(embed) ? (embed[0] ?? null) : embed;
    })
    .filter((p): p is Record<string, unknown> => Boolean(p));
  const curatedIds = new Set(curatedPlaces.map((p) => p.id as string));

  const cityName = (edition as unknown as { destinations?: { name?: string } }).destinations?.name;
  let discoveredPlaces: Record<string, unknown>[] = [];
  if (cityName) {
    const { data: byCity } = await supabase
      .from("places")
      .select("*")
      .eq("is_legacy", false)
      .or(`city.ilike.%${cityName}%,region.ilike.%${cityName}%`)
      .limit(500);
    discoveredPlaces = (byCity ?? []).filter((p) => !curatedIds.has(p.id));
  }

  const places = [
    ...curatedPlaces.map((p) => ({ ...p, curated: true })),
    ...discoveredPlaces.map((p) => ({ ...p, curated: false })),
  ];

  return NextResponse.json({ edition, places });
}

/** עריכת שדות המהדורה (תמונה, כותרת, תת-כותרת, תיאור, מזג אוויר וכו'). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });

  const ALLOWED_FIELDS = [
    "title",
    "subtitle",
    "image_url",
    "description",
    "weather_notes",
    "quick_category",
    "group_label",
    "sort_order",
    "is_published",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) patch[field] = body[field];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "לא נשלח אף שדה לעדכון" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("destination_editions")
    .update(patch)
    .eq("id", id)
    .select("*, destinations(id, name, country)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ edition: data });
}

/** מוחקת את המהדורה עצמה (לא את היעד הבסיסי, ולא את האטרקציות
 *  המשויכות - destination_edition_places נמחקות אוטומטית ע"י cascade,
 *  אבל השורות ב-places עצמן נשארות שלמות, כמו שסוכם). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("destination_editions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
