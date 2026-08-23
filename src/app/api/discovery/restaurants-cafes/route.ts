import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { fetchDiscoveryPlaces, fetchHotPlaces, type DiscoveryLocation } from "@/services/places/discoveryService";

/**
 * API של עמוד Discovery "מסעדות וקפה" (Audit - "אלה הקטגוריות" + רשימת
 * 17 סוגי מטבח + "אפשר להוסיף גלידריות" + "להשאיר רק בתי קפה (בלי
 * עגלות קפה)" + "להשאיר כמובן הכי חמים"): תיקון מהותי מהסבב הקודם -
 * הקטגוריות כבר לא venue-type (winery/brewery/coffee_cart/...) אלא
 * **סוג מטבח** (cuisine). מצאתי בקוד: taxonomy_terms עם
 * taxonomy_group='cuisine' (migration 0018) הוא בדיוק הרשימה הזו,
 * כבר קיים - ו-places.cuisine_tags (migration 0027) הוא העמודה
 * שמחזיקה את התיוג בפועל. לא נבנתה טקסונומיה חדשה.
 *
 * שני יוצאי-דופן שאין להם cuisine tag בטקסונומיה (נשארים subcategory,
 * כמו בסבב הקודם): גלידריות (ice_cream_shop) ואוכל מקומי (local_restaurant).
 * "🔥 הכי חמים עכשיו" חזר (הוסר בטעות בסבב הקודם) - סורק את כל
 * wineries_dining+coffee_carts_cafes יחד, לא קטגוריית מטבח בודדת.
 */

interface CuisineSection {
  emoji: string;
  title: string;
  /** ערך cuisine_tags אמיתי (taxonomy_terms, group='cuisine') - ברירת המחדל. */
  cuisineTag?: string;
  /** ליוצאי-הדופן (גלידריות/אוכל מקומי) - subcategory במקום cuisine_tags. */
  category?: "coffee_carts_cafes" | "wineries_dining";
  subcategory?: string;
}

const DISCOVERY_SECTIONS: Record<string, CuisineSection> = {
  israeli: { emoji: "🥙", title: "ישראלי", cuisineTag: "israeli_middle_eastern" },
  italian: { emoji: "🍝", title: "איטלקי", cuisineTag: "italian" },
  asian: { emoji: "🥢", title: "אסייתי", cuisineTag: "asian" },
  meat_bbq: { emoji: "🍖", title: "בשרים ועל האש", cuisineTag: "meat_bbq" },
  burger_diner: { emoji: "🍔", title: "המבורגר ודיינר אמריקאי", cuisineTag: "burger_diner" },
  mexican: { emoji: "🌮", title: "מקסיקני", cuisineTag: "mexican" },
  greek: { emoji: "🫓", title: "יווני", cuisineTag: "greek" },
  french_bistro: { emoji: "🥖", title: "ביסטרו צרפתי", cuisineTag: "french_bistro" },
  indian: { emoji: "🍛", title: "הודי", cuisineTag: "indian" },
  mediterranean: { emoji: "🫒", title: "ים־תיכוני", cuisineTag: "mediterranean" },
  seafood: { emoji: "🐟", title: "דגים ופירות ים", cuisineTag: "seafood" },
  pizza: { emoji: "🍕", title: "פיצה", cuisineTag: "pizza" },
  breakfast_brunch: { emoji: "🥐", title: "ארוחת בוקר ובראנץ׳", cuisineTag: "breakfast_brunch" },
  cafe: { emoji: "☕", title: "בית קפה", cuisineTag: "cafe" },
  fine_dining: { emoji: "👨‍🍳", title: "מסעדות שף", cuisineTag: "fine_dining" },
  local_food: { emoji: "🍴", title: "אוכל מקומי", category: "wineries_dining", subcategory: "local_restaurant" },
  desserts_sweets: { emoji: "🍰", title: "מאנצ׳ים ומתוקים", cuisineTag: "desserts_sweets" },
  ice_cream: { emoji: "🍦", title: "גלידריות", category: "wineries_dining", subcategory: "ice_cream_shop" },
};

/** סדר ברירת המחדל - בדיוק לפי הרשימה שסופקה, + גלידריות בסוף (נוספה
 *  במפורש: "אפשר להוסיף גלידריות"). */
const DEFAULT_SECTION_ORDER = [
  "israeli",
  "italian",
  "asian",
  "meat_bbq",
  "burger_diner",
  "mexican",
  "greek",
  "french_bistro",
  "indian",
  "mediterranean",
  "seafood",
  "pizza",
  "breakfast_brunch",
  "cafe",
  "fine_dining",
  "local_food",
  "desserts_sweets",
  "ice_cream",
];

/** "הכי חמים עכשיו" - לא קטגוריית מטבח בודדת, סורק את כל התחום
 *  הקולינרי (מסעדות+קפה) יחד, בדיוק כמו ב"טיול יומי"/"חופשה בארץ". */
const HOT_CULINARY_CATEGORIES = ["wineries_dining", "coffee_carts_cafes"];

function parseLocation(searchParams: URLSearchParams): DiscoveryLocation {
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const city = searchParams.get("city");
  return {
    lat: lat ? Number(lat) : null,
    lng: lng ? Number(lng) : null,
    city: city || null,
  };
}

async function fetchSectionPlaces(
  supabase: Awaited<ReturnType<typeof createClient>>,
  location: DiscoveryLocation,
  section: CuisineSection,
  limit: number
) {
  return fetchDiscoveryPlaces(supabase, {
    location,
    category: section.category,
    // ליוצאי-הדופן (category+subcategory) לא מוגדר cuisineTag כלל - שאר
    // הסקשנים לא מגדירים category, ולכן חייבים category כלשהו כדי
    // ש-queryPlaces ידע היכן לחפש: cuisine_tags קיים גם על wineries_dining
    // וגם על coffee_carts_cafes יחד, אז לסקשן מטבח רגיל מחפשים בשתיהן.
    categories: section.cuisineTag ? HOT_CULINARY_CATEGORIES : undefined,
    subcategories: section.subcategory ? [section.subcategory] : undefined,
    requiredAnyCuisineTags: section.cuisineTag ? [section.cuisineTag] : undefined,
    limit,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = parseLocation(searchParams);
  const categoryParam = searchParams.get("category");
  const limitParam = searchParams.get("limit");

  const supabase = await createClient();

  // "ראה הכל" - סקשן בודד, limit גדול.
  if (categoryParam) {
    const section = DISCOVERY_SECTIONS[categoryParam];
    if (!section) {
      return NextResponse.json({ error: "קטגוריה לא מוכרת" }, { status: 400 });
    }
    const places = await fetchSectionPlaces(supabase, location, section, limitParam ? Number(limitParam) : 40);
    return NextResponse.json({ title: section.title, emoji: section.emoji, places });
  }

  // עמוד ראשי - Aggregate: "🔥 הכי חמים עכשיו" (חזר, לפי בקשה מפורשת) +
  // כל 18 סקשני המטבח, preview מוגבל.
  const PREVIEW_LIMIT = 10;

  const [hotPlaces, sectionResults] = await Promise.all([
    fetchHotPlaces(supabase, location, PREVIEW_LIMIT, HOT_CULINARY_CATEGORIES),
    Promise.all(
      DEFAULT_SECTION_ORDER.map(async (id) => {
        const section = DISCOVERY_SECTIONS[id];
        const places = await fetchSectionPlaces(supabase, location, section, PREVIEW_LIMIT);
        return { id, emoji: section.emoji, title: section.title, places };
      })
    ),
  ]);

  return NextResponse.json({ hotPlaces, sections: sectionResults });
}
