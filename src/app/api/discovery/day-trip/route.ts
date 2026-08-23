import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import {
  fetchDiscoveryPlaces,
  fetchHotPlaces,
  fetchActiveEvents,
  type DiscoveryLocation,
} from "@/services/places/discoveryService";

/**
 * API של עמוד Discovery "טיול יומי" (Audit מול "PROMPT 1"): שכבה
 * דטרמיניסטית בלבד - בלי AI, בלי Day Blueprint, בלי pace, בלי
 * Restaurant Quota (סעיף 14 - "NO AI ITINERARY"). מחזירה Places/Events
 * רלוונטיים למיקום, לשימוש בעמוד ה-Discovery החדש בלבד.
 *
 * שני מצבים:
 * - בלי `category` בשאילתה - Aggregate מלא (כל הסקשנים, preview מוגבל
 *   לכל אחד) - לעמוד הראשי.
 * - עם `category` - סקשן בודד, limit גדול יותר - ל"ראה הכל".
 */

/** מיפוי section-id (מה-UI) לפרמטרי שאילתה בפועל (category/subcategories/
 *  tag) - מקור אמת יחיד, כדי שהעמוד הראשי ו"ראה הכל" תמיד ישתמשו באותה
 *  הגדרה בדיוק, לא יתפצלו בטעות. ממחזר את tripTaxonomy.ts הקיים - לא
 *  ממציא taxonomy חדש (Audit סעיף 11/12).
 */
const DISCOVERY_SECTIONS: Record<
  string,
  { emoji: string; title: string; category?: string; categories?: string[]; subcategories?: string[] }
> = {
  coffee_carts_cafes: { emoji: "☕", title: "עגלות קפה", category: "coffee_carts_cafes" },
  nature_trails: { emoji: "🌿", title: "מסלולי טבע", category: "nature_trails" },
  viewpoints: { emoji: "🌄", title: "תצפיות", category: "viewpoints" },
  shopping: { emoji: "🛍️", title: "שופינג וקניות", category: "shopping" },
  water_amusement_parks: { emoji: "🎢", title: "פארקי שעשועים ומים", category: "water_amusement_parks" },
  parks_gardens: { emoji: "🌳", title: "פארקים וגנים", category: "parks_gardens" },
  wineries_dining: {
    emoji: "🍷",
    title: "יקבים ומבשלות",
    category: "wineries_dining",
    subcategories: ["winery", "brewery", "distillery", "wine_tasting", "beer_tasting", "culinary_tour"],
  },
  attractions_activities: { emoji: "🎯", title: "אטרקציות", category: "attractions_activities" },
  // תיקון (Audit מול "PROMPT 2" סעיף 11 - הפרדה מחייבת): קודם קטגוריה
  // אחת "תרבות והיסטוריה" (culture_history גולמי). עכשיו שתי קטגוריות
  // Discovery נפרדות מתוך אותו category ב-DB, מסוננות ע"י subcategory -
  // לא טקסונומיה חדשה, רק חלוקה של ה-subTags הקיימים (tripTaxonomy.ts)
  // לשתי קבוצות סמנטיות. "historic_street" לא נכלל באף אחת מהשתיים -
  // הוא חלק מ"רחובות ומרכזי בילוי" (streets_centers, למטה).
  culture_art: {
    emoji: "🎨",
    title: "תרבות ואמנות",
    category: "culture_history",
    subcategories: ["gallery", "exhibition", "culture_center", "artists_village"],
  },
  history_museums: {
    emoji: "🏛️",
    title: "היסטוריה ומוזיאונים",
    category: "culture_history",
    subcategories: [
      "museum",
      "heritage_site",
      "archaeological_site",
      "fortress",
      "citadel",
      "historic_building",
      "church",
      "monastery",
      "ancient_synagogue",
      "mosque",
    ],
  },
  picnics: {
    emoji: "🧺",
    title: "פיקניקים",
    category: "parks_gardens",
    subcategories: ["picnic_park"],
  },
  // תיקון (Audit סעיף 12 - "אין להניח שכל רחוב הוא historic_street" /
  // "PROMPT 2" סעיף 10 - הגדרה רחבה יותר: רחובות מסחריים, מדרחובים,
  // שדרות, טיילות, אזורי בילוי, מתחמי בילוי, מרכזים מיוחדים): best-effort
  // union של שלוש קטגוריות/subTags קיימים קרובים סמנטית - אין כרגע
  // תגית ייעודית אחת ל"רחוב/מתחם בילוי חי" (דיזנגוף/שרונה/נמל ת"א)
  // בטקסונומיה הקיימת. food_complex (wineries_dining) נוסף כדי לכסות
  // מתחמים כמו "שרונה"/"נמל ת"א" שהם בעיקר מתחמי אוכל/בילוי פתוחים.
  // "market"/"flea_market"/"food_market_shopping" (shopping) לא נכללים
  // בכוונה - שווקים נשארים אך ורק תחת "שופינג וקניות", גם דוגמת "שוק
  // הפשפשים" בבקשה המקורית. מדווח כפער ידוע בדוח הסיכום, לא מוסתר.
  streets_centers: {
    emoji: "🏙️",
    title: "רחובות ומרכזי בילוי",
    categories: ["culture_history", "shopping", "wineries_dining"],
    subcategories: ["historic_street", "open_shopping_area", "food_complex"],
  },
  // תיקון (בקשה מפורשת - "לא צריך פה חיי לילה, מסעדות וקפה ודייטים
  // רומנטיים! אלו קטגוריות נפרדות!!"): הוסרו מה-Discovery של "טיול
  // יומי" - אלה קטגוריות ראשיות עצמאיות משלהן (restaurants_cafes/
  // romantic_date/nightlife כבר קיימים כ-Quick Categories/Trip Builder
  // נפרדים בדף הבית) - לא שייכות לתת-הקטגוריות של "טיול יומי".
};

/** סדר ברירת המחדל בעמוד הראשי - בדיוק לפי סעיף 8/25 של הבקשה. */
const DEFAULT_SECTION_ORDER = [
  "coffee_carts_cafes",
  "nature_trails",
  "viewpoints",
  "shopping",
  "water_amusement_parks",
  "parks_gardens",
  "wineries_dining",
  "attractions_activities",
  "culture_art",
  "history_museums",
  "picnics",
  "streets_centers",
];

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
    const places = await fetchDiscoveryPlaces(supabase, {
      location,
      category: section.category,
      categories: section.categories,
      subcategories: section.subcategories,
      limit: limitParam ? Number(limitParam) : 40,
    });
    return NextResponse.json({ title: section.title, emoji: section.emoji, places });
  }

  // עמוד ראשי - Aggregate: "הכי חמים" + Events + כל הסקשנים, preview מוגבל.
  const PREVIEW_LIMIT = 10;

  const [hotPlaces, events, sectionResults] = await Promise.all([
    fetchHotPlaces(supabase, location, PREVIEW_LIMIT),
    fetchActiveEvents(supabase, location),
    Promise.all(
      DEFAULT_SECTION_ORDER.map(async (id) => {
        const section = DISCOVERY_SECTIONS[id];
        const places = await fetchDiscoveryPlaces(supabase, {
          location,
          category: section.category,
          categories: section.categories,
          subcategories: section.subcategories,
          limit: PREVIEW_LIMIT,
        });
        return { id, emoji: section.emoji, title: section.title, places };
      })
    ),
  ]);

  return NextResponse.json({
    hotPlaces,
    events,
    sections: sectionResults,
  });
}
