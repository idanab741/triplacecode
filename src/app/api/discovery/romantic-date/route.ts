import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { fetchDiscoveryPlaces, fetchHotPlaces, type DiscoveryLocation } from "@/services/places/discoveryService";

/**
 * API של עמוד Discovery "דייטים רומנטיים" (Audit - "אותו דבר עם דייטים
 * ורומנטי" - לפי "אופי הטיול שמופיע בצ'אט"): מצאתי את המקור הקיים -
 * DATE_TYPE_OPTIONS (locales/he/romanticDate.ts, 9 ערכים - ארוחה
 * רומנטית/שקיעה ונוף/חוף ים/יקב או בר יין/בית קפה/תרבות והופעה/סדנה
 * זוגית/ספא/בילוי לילי) כבר בשימוש בשאלון ה-Trip Builder הקיים - לא
 * נבנתה טקסונומיה חדשה.
 *
 * מיפוי ל-DB: כל סוג דייט מתאים למקטע tripTaxonomy.ts שונה - "ארוחה
 * רומנטית" ממחזרת גם את תג "romantic" הקיים (placeTagOptions.ts,
 * requiredAnyTags) כדי לסנן ספציפית מקומות שתויגו כרומנטיים בפועל,
 * לא כל מסעדה. "תרבות והופעה" משלב culture_history+events_festivals
 * (שני התחומים באמת רלוונטיים). "סדנה זוגית" -> subcategory=workshop
 * (attractions_activities) - התאמה כללית (סדנה, לא בהכרח "זוגית"
 * ספציפית) כי אין תג ייעודי יותר בטקסונומיה הקיימת.
 */

interface RomanticSection {
  emoji: string;
  title: string;
  category?: "wineries_dining" | "viewpoints" | "beaches_pools" | "coffee_carts_cafes" | "attractions_activities" | "spa_relaxation" | "nightlife";
  categories?: string[];
  subcategories?: string[];
  requiredAnyTags?: string[];
  allowNightlife?: boolean;
}

/** בדיוק 9 הערכים מ-DATE_TYPE_OPTIONS (romanticDate.ts) - אותו סדר. */
const DISCOVERY_SECTIONS: Record<string, RomanticSection> = {
  romantic_meal: { emoji: "🍽️", title: "ארוחה רומנטית", category: "wineries_dining", requiredAnyTags: ["romantic"] },
  sunset_view: {
    emoji: "🌅",
    title: "שקיעה ונוף",
    category: "viewpoints",
    subcategories: ["sunset_point", "viewpoint", "view_balcony"],
  },
  beach: { emoji: "🏖️", title: "חוף ים", category: "beaches_pools", subcategories: ["sea_beach", "wild_beach", "organized_beach"] },
  winery_bar: { emoji: "🍷", title: "יקב או בר יין", category: "wineries_dining", subcategories: ["winery", "wine_tasting"] },
  cafe: { emoji: "☕", title: "בית קפה", category: "coffee_carts_cafes", subcategories: ["cafe", "cafe_with_view", "specialty_coffee"] },
  culture_show: {
    emoji: "🎭",
    title: "תרבות והופעה",
    categories: ["culture_history", "events_festivals"],
    subcategories: ["culture_center", "exhibition", "live_show", "culture_event"],
  },
  couples_workshop: { emoji: "🎨", title: "סדנה זוגית", category: "attractions_activities", subcategories: ["workshop"] },
  spa: { emoji: "🧖", title: "ספא", category: "spa_relaxation" },
  night_out: { emoji: "🌃", title: "בילוי לילי", category: "nightlife", allowNightlife: true },
};

const DEFAULT_SECTION_ORDER = [
  "romantic_meal",
  "sunset_view",
  "beach",
  "winery_bar",
  "cafe",
  "culture_show",
  "couples_workshop",
  "spa",
  "night_out",
];

/** "הכי חמים עכשיו" - סורק את כל התחומים הרלוונטיים לדייט רומנטי יחד. */
const HOT_ROMANTIC_CATEGORIES = [
  "wineries_dining",
  "viewpoints",
  "beaches_pools",
  "coffee_carts_cafes",
  "culture_history",
  "spa_relaxation",
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
      requiredAnyTags: section.requiredAnyTags,
      allowNightlife: section.allowNightlife,
      limit: limitParam ? Number(limitParam) : 40,
    });
    return NextResponse.json({ title: section.title, emoji: section.emoji, places });
  }

  // עמוד ראשי - Aggregate: "🔥 הכי חמים עכשיו" קודם, ואז 9 הסקשנים.
  const PREVIEW_LIMIT = 10;

  const [hotPlaces, sectionResults] = await Promise.all([
    fetchHotPlaces(supabase, location, PREVIEW_LIMIT, HOT_ROMANTIC_CATEGORIES),
    Promise.all(
      DEFAULT_SECTION_ORDER.map(async (id) => {
        const section = DISCOVERY_SECTIONS[id];
        const places = await fetchDiscoveryPlaces(supabase, {
          location,
          category: section.category,
          categories: section.categories,
          subcategories: section.subcategories,
          requiredAnyTags: section.requiredAnyTags,
          allowNightlife: section.allowNightlife,
          limit: PREVIEW_LIMIT,
        });
        return { id, emoji: section.emoji, title: section.title, places };
      })
    ),
  ]);

  return NextResponse.json({ hotPlaces, sections: sectionResults });
}
