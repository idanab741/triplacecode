import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { isValidPlaceCategory, type PlaceCategoryKey } from "@/constants/placeCategories";

/**
 * *** תיקון (בקשה מפורשת - "אמרנו שיהיה סינון גם לפי תתי קטגוריות,
 * בהתאם לכל סוג - איפה זה?"): תתי-הקטגוריה **האמיתיות** שקיימות
 * בפועל בטבלת places (עמודת subcategory, טקסט חופשי - לא enum קבוע
 * מראש), מסוננות לפי הקטגוריות הראשיות שנבחרו. לא רשימה מומצאת/
 * קבועה מראש - נגזרת ישירות מהדאטה הקיימת, כך שהצ'יפים בפילטר תמיד
 * משקפים תתי-קטגוריה שבאמת קיימות במקומות אמיתיים.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const categoriesParam = searchParams.get("categories");
  const categories = (categoriesParam ? categoriesParam.split(",").filter(Boolean) : []).filter((c): c is PlaceCategoryKey =>
    isValidPlaceCategory(c)
  );

  let query = supabase.from("places").select("subcategory").not("subcategory", "is", null);
  if (categories.length > 0) query = query.in("category", categories);

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const unique = Array.from(new Set((data ?? []).map((r) => r.subcategory as string).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "he")
  );

  return NextResponse.json({ subcategories: unique.slice(0, 40) });
}
