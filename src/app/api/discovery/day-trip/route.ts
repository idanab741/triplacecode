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
  { emoji: string; title: string; category?: string; categories?: string[]; subcategories?: string[]; requiredTag?: string }
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
  culture_history: { emoji: "🏛️", title: "תרבות והיסטוריה", category: "culture_history" },
  picnics: {
    emoji: "🧺",
    title: "פיקניקים",
    category: "parks_gardens",
    subcategories: ["picnic_park"],
  },
  // תיקון (Audit סעיף 12 - "אין להניח שכל רחוב הוא historic_street"):
  // best-effort union של שתי הקטגוריות הקיימות הקרובות ביותר סמנטית -
  // אין כרגע תגית ייעודית ל"רחוב מסחרי חי" (דיזנגוף/רוטשילד) בטקסונומיה.
  // מדווח כפער ידוע בדוח הסיכום, לא מוסתר.
  streets_centers: {
    emoji: "🏙️",
    title: "רחובות ומרכזים",
    categories: ["culture_history", "shopping"],
    subcategories: ["historic_street", "open_shopping_area"],
  },
  restaurants_cafes: {
    emoji: "🍽️",
    title: "מסעדות וקפה",
    categories: ["wineries_dining", "coffee_carts_cafes"],
    subcategories: [
      "chef_restaurant",
      "local_restaurant",
      "bakery",
      "patisserie",
      "ice_cream_shop",
      "food_market",
      "food_complex",
      "cafe",
      "coffee_cart",
      "specialty_coffee",
      "cafe_with_view",
      "bakery_cafe",
    ],
  },
  // "דייטים רומנטיים" - אין קטגוריה/subcategory ייעודיים; היחיד הקיים
  // בפועל הוא tag="romantic" (place_dna_tag, ר' rankingService.ts).
  romantic_date: { emoji: "❤️", title: "דייטים רומנטיים", requiredTag: "romantic" },
  nightlife: { emoji: "🌙", title: "חיי לילה", category: "nightlife" },
};

/** סדר ברירת המחדל בעמוד הראשי - בדיוק לפי סעיף 15 של הבקשה. */
const DEFAULT_SECTION_ORDER = [
  "coffee_carts_cafes",
  "nature_trails",
  "viewpoints",
  "shopping",
  "water_amusement_parks",
  "parks_gardens",
  "wineries_dining",
  "attractions_activities",
  "culture_history",
  "picnics",
  "streets_centers",
  "restaurants_cafes",
  "romantic_date",
  "nightlife",
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

  if (location.lat == null && !location.city) {
    return NextResponse.json({ error: "יש לספק מיקום (lat/lng או city)" }, { status: 400 });
  }

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
      requiredTag: section.requiredTag,
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
          requiredTag: section.requiredTag,
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
