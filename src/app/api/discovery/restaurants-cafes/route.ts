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
  /** *** תיקון Product מפורש ("למה הוא אומר שאין בשרים על האש?? יש
   *  הכל! זה צריך להיות גורף! להשתמש אך ורק ב-ADMIN PLACES"): בדקתי -
   *  cuisine_tags בפועל ב-DB **לא** תואם את הערכים התיאורטיים מ-
   *  taxonomy_terms (שכמעט ולא בשימוש בפועל בעמודה הזו). לדוגמה: 91
   *  מקומות מתויגים "bbq" (לא "meat_bbq"!), 78 מתויגים "brunch" (לא
   *  "breakfast_brunch"), 57 "israeli" (לא "israeli_middle_eastern"),
   *  62 "desserts" (לא "desserts_sweets"), 522(!) "local_food". מערך
   *  cuisineTags (לא cuisineTag יחיד) - כל הערכים האמיתיים שנמצאו
   *  בפועל ב-DB, לצד הערך התיאורטי - OR ביניהם (מספיק אחד). */
  cuisineTags?: string[];
  /** ליוצאי-הדופן (גלידריות) - subcategory במקום cuisine_tags. */
  category?: "coffee_carts_cafes" | "wineries_dining";
  subcategory?: string;
}

const DISCOVERY_SECTIONS: Record<string, CuisineSection> = {
  israeli: { emoji: "🥙", title: "ישראלי", cuisineTags: ["israeli_middle_eastern", "israeli", "middle_eastern"] },
  italian: { emoji: "🍝", title: "איטלקי", cuisineTags: ["italian"] },
  asian: { emoji: "🥢", title: "אסייתי", cuisineTags: ["asian"] },
  meat_bbq: { emoji: "🍖", title: "בשרים ועל האש", cuisineTags: ["meat_bbq", "bbq", "meat_grill", "steakhouse"] },
  burger_diner: { emoji: "🍔", title: "המבורגר ודיינר אמריקאי", cuisineTags: ["burger_diner", "burger"] },
  mexican: { emoji: "🌮", title: "מקסיקני", cuisineTags: ["mexican"] },
  greek: { emoji: "🫓", title: "יווני", cuisineTags: ["greek"] },
  french_bistro: { emoji: "🥖", title: "ביסטרו צרפתי", cuisineTags: ["french_bistro"] },
  indian: { emoji: "🍛", title: "הודי", cuisineTags: ["indian"] },
  mediterranean: { emoji: "🫒", title: "ים־תיכוני", cuisineTags: ["mediterranean", "Mediterranean"] },
  seafood: { emoji: "🐟", title: "דגים ופירות ים", cuisineTags: ["seafood"] },
  pizza: { emoji: "🍕", title: "פיצה", cuisineTags: ["pizza"] },
  breakfast_brunch: { emoji: "🥐", title: "ארוחת בוקר ובראנץ׳", cuisineTags: ["breakfast_brunch", "brunch"] },
  cafe: { emoji: "☕", title: "בית קפה", cuisineTags: ["cafe"] },
  fine_dining: { emoji: "👨‍🍳", title: "מסעדות שף", cuisineTags: ["fine_dining", "chef_restaurant"] },
  // *** תיקון: "אוכל מקומי" עבר מ-subcategory (אין בכלל שורות עם
  // subcategory="local_restaurant" בפועל) ל-cuisineTags - "local_food"
  // הוא בפועל אחד מתגי המטבח הכי נפוצים ב-DB (522 מקומות!).
  local_food: { emoji: "🍴", title: "אוכל מקומי", cuisineTags: ["local_food", "local_authentic"] },
  desserts_sweets: { emoji: "🍰", title: "מאנצ׳ים ומתוקים", cuisineTags: ["desserts_sweets", "desserts"] },
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
    // *** תיקון Product מפורש ("להשתמש אך ורק ב-ADMIN PLACES"): לסקשני
    // cuisineTags (17 מתוך 18) - במקום categories:HOT_CULINARY_CATEGORIES
    // (שמתאים trip_type_tags.ov, כמעט תמיד ריק בפועל) - categoryColumnEquals
    // "restaurants" תואם ישירות את עמודת ה-category הגסה, האמינה, שבאמת
    // מאוכלסת נכון בכל השורות (ר' placeCategories.ts - 5 הערכים היחידים
    // המותרים). לא חוצה קטגוריה גסה אחרת בשום מקרה - תמיד "restaurants" בלבד.
    categoryColumnEquals: section.cuisineTags ? "restaurants" : undefined,
    subcategories: section.subcategory ? [section.subcategory] : undefined,
    requiredAnyCuisineTags: section.cuisineTags,
    limit,
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = parseLocation(searchParams);
  const categoryParam = searchParams.get("category");
  const limitParam = searchParams.get("limit");

  const supabase = await createClient();

  // "ראה הכל" - סקשן בודד, limit גדול. תיקון (Audit - "ראה עוד בכל
  // קטגוריה"): "hot" הוא פסאודו-קטגוריה מיוחדת ל"🔥 הכי חמים עכשיו".
  if (categoryParam === "hot") {
    const places = await fetchHotPlaces(supabase, location, limitParam ? Number(limitParam) : 40, HOT_CULINARY_CATEGORIES);
    return NextResponse.json({ title: "הכי חמים עכשיו", emoji: "🔥", places });
  }

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
