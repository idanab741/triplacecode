import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { isValidPlaceCategory, type PlaceCategoryKey } from "@/constants/placeCategories";

/**
 * *** סעיף 9-10 בפרומפט + תוספת מפורשת (דירוג + תתי-קטגוריה): "סינון"
 * מעל המפה - 4 קבוצות, כולן AND ביניהן: אנשים, קטגוריות, תתי-קטגוריה
 * (אמיתיות, נגזרות מהדאטה - ר' /api/map/category-subtypes), ודירוג
 * מינימלי. אנשים = משתמשים מרשימת ה-friends האמיתית של המשתמש -
 * "רלוונטי להם" מוגדר כאן כמקומות שהם liked/saved בפועל בטבלת
 * favorites הקיימת. קטגוריות = בדיוק 5 מתוך 6 הקטגוריות הראשיות
 * (places.category התקף - "קניות ושופינג" אין לו קטגוריית places
 * תואמת עדיין, ר' constants/placeCategories.ts - מוחזר ריק באמת,
 * לא מומצא).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const peopleParam = searchParams.get("people");
  const categoriesParam = searchParams.get("categories");
  const subcategoriesParam = searchParams.get("subcategories");
  const minRatingParam = searchParams.get("minRating");

  const personIds = peopleParam ? peopleParam.split(",").filter(Boolean) : [];
  const categories = (categoriesParam ? categoriesParam.split(",").filter(Boolean) : []).filter((c): c is PlaceCategoryKey =>
    isValidPlaceCategory(c)
  );
  const subcategories = subcategoriesParam ? subcategoriesParam.split(",").filter(Boolean) : [];
  const minRating = minRatingParam ? Number(minRatingParam) : null;

  if (personIds.length === 0 && categories.length === 0 && subcategories.length === 0 && !minRating) {
    return NextResponse.json({ places: [] });
  }

  let placeIdFilter: string[] | null = null;

  if (personIds.length > 0) {
    const { data: favoriteRows, error: favError } = await supabase
      .from("favorites")
      .select("place_id")
      .in("user_id", personIds)
      .in("status", ["liked", "saved"])
      .eq("place_type", "place");
    if (favError) return NextResponse.json({ error: favError.message }, { status: 500 });

    placeIdFilter = Array.from(new Set((favoriteRows ?? []).map((r) => r.place_id as string)));
    if (placeIdFilter.length === 0) {
      // אף מקום לא הומלץ ע"י מי מהאנשים שנבחרו - אין מה להציג, בלי
      // קשר לקטגוריות (זה AND, לא OR).
      return NextResponse.json({ places: [] });
    }
  }

  let query = supabase
    .from("places")
    .select("id, name, latitude, longitude, category")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (categories.length > 0) query = query.in("category", categories);
  if (subcategories.length > 0) query = query.in("subcategory", subcategories);
  if (minRating) query = query.gte("rating", minRating);
  if (placeIdFilter) query = query.in("id", placeIdFilter);

  const { data, error } = await query.limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ places: data ?? [] });
}
