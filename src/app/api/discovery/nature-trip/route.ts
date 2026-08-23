import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { fetchDiscoveryPlaces, fetchHotPlaces, type DiscoveryLocation } from "@/services/places/discoveryService";

/**
 * API של עמוד Discovery "טיול בטבע" (Audit - "לפי הקטגוריות (אופי הטיול
 * שמופיע בצ'אט)"): מצאתי את המקור הקיים - NATURE_TYPE_OPTIONS
 * (locales/he/natureTrip.ts, 13 ערכים) הוא בדיוק "אופי הטיול" שמוצג
 * בשאלון ה-Trip Builder הקיים (מעיינות ונחלים, תצפיות ונופים, יערות
 * וחורשות, מסלולי הליכה, פריחה עונתית, מערות ותופעות טבע, מדבר וקניונים,
 * מפלים, טבע ובעלי חיים, זריחה/שקיעה, פוטוגני, פיקניק בטבע, שמורות
 * טבע) - לא נבנתה טקסונומיה חדשה.
 *
 * מיפוי ל-DB: NATURE_TYPE_TO_CATEGORY הקיים נותן רק category גס
 * (nature_trails/viewpoints/parks_gardens) - הרחבתי כל אחד ל-subcategory
 * מדויק יותר מתוך tripTaxonomy.ts (nature_trails/viewpoints/beaches_pools/
 * parks_gardens subTags) כדי שכל קטגוריה תציג משהו שונה אמיתי, לא את
 * אותם מקומות בדיוק בכל הסקשנים.
 *
 * שני פערים ידועים (אין תג ייעודי בטקסונומיה הקיימת): "מעיינות ונחלים"
 * ו"מפלים" - שניהם ממופים ל-beaches_pools/natural_pool (הכי קרוב שיש,
 * "בריכות טבעיות") - לא זהה למעיין/מפל אמיתי, אבל גם לא המצאה. "טבע
 * ובעלי חיים" - אין תג כלל, נשאר category=nature_trails רחב (בלי
 * subcategory) - עלול להחזיר מקומות כלליים יותר, לא ספציפית "בעלי חיים".
 */

interface NatureSection {
  emoji: string;
  title: string;
  category: "nature_trails" | "viewpoints" | "beaches_pools" | "parks_gardens";
  subcategories?: string[];
}

/** בדיוק 13 הערכים מ-NATURE_TYPE_OPTIONS (natureTrip.ts) - אותו סדר. */
const DISCOVERY_SECTIONS: Record<string, NatureSection> = {
  springs_streams: { emoji: "💧", title: "מעיינות ונחלים", category: "beaches_pools", subcategories: ["natural_pool"] },
  viewpoints_scenery: {
    emoji: "🌄",
    title: "תצפיות ונופים",
    category: "viewpoints",
    subcategories: ["viewpoint", "view_balcony", "lookout", "mountain_view"],
  },
  forests_groves: { emoji: "🌳", title: "יערות וחורשות", category: "nature_trails", subcategories: ["forest", "grove"] },
  hiking_trails: {
    emoji: "🥾",
    title: "מסלולי הליכה",
    category: "nature_trails",
    subcategories: ["hiking_trail", "trip_route", "accessible_trail"],
  },
  seasonal_bloom: { emoji: "🌸", title: "פריחה עונתית", category: "nature_trails", subcategories: ["seasonal_bloom"] },
  caves_phenomena: {
    emoji: "🪨",
    title: "מערות ותופעות טבע",
    category: "nature_trails",
    subcategories: ["natural_cave", "hanging_bridge", "special_nature_site"],
  },
  desert_canyons: { emoji: "🏜️", title: "מדבר וקניונים", category: "nature_trails", subcategories: ["canyon", "valley"] },
  waterfalls: { emoji: "💦", title: "מפלים (עונתיים)", category: "beaches_pools", subcategories: ["natural_pool"] },
  wildlife: { emoji: "🦌", title: "טבע ובעלי חיים", category: "nature_trails" },
  sunrise_sunset: {
    emoji: "🌅",
    title: "זריחה או שקיעה",
    category: "viewpoints",
    subcategories: ["sunrise_point", "sunset_point"],
  },
  photogenic_spots: {
    emoji: "📸",
    title: "מקומות פוטוגניים / אינסטגרמי",
    category: "viewpoints",
    subcategories: ["photo_spot", "night_view", "stargazing"],
  },
  picnic_nature: { emoji: "🧺", title: "פיקניק בטבע", category: "parks_gardens", subcategories: ["picnic_park"] },
  nature_reserves: { emoji: "🌿", title: "שמורות טבע", category: "nature_trails", subcategories: ["nature_reserve"] },
};

/** סדר ברירת המחדל - בדיוק לפי הסדר של NATURE_TYPE_OPTIONS בשאלון. */
const DEFAULT_SECTION_ORDER = [
  "springs_streams",
  "viewpoints_scenery",
  "forests_groves",
  "hiking_trails",
  "seasonal_bloom",
  "caves_phenomena",
  "desert_canyons",
  "waterfalls",
  "wildlife",
  "sunrise_sunset",
  "photogenic_spots",
  "picnic_nature",
  "nature_reserves",
];

/** "הכי חמים עכשיו" - סורק את כל 4 הקטגוריות הרלוונטיות לטבע יחד. */
const HOT_NATURE_CATEGORIES = ["nature_trails", "viewpoints", "beaches_pools", "parks_gardens"];

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
      subcategories: section.subcategories,
      limit: limitParam ? Number(limitParam) : 40,
    });
    return NextResponse.json({ title: section.title, emoji: section.emoji, places });
  }

  // עמוד ראשי - Aggregate: "🔥 הכי חמים עכשיו" קודם, ואז 13 הסקשנים.
  const PREVIEW_LIMIT = 10;

  const [hotPlaces, sectionResults] = await Promise.all([
    fetchHotPlaces(supabase, location, PREVIEW_LIMIT, HOT_NATURE_CATEGORIES),
    Promise.all(
      DEFAULT_SECTION_ORDER.map(async (id) => {
        const section = DISCOVERY_SECTIONS[id];
        const places = await fetchDiscoveryPlaces(supabase, {
          location,
          category: section.category,
          subcategories: section.subcategories,
          limit: PREVIEW_LIMIT,
        });
        return { id, emoji: section.emoji, title: section.title, places };
      })
    ),
  ]);

  return NextResponse.json({ hotPlaces, sections: sectionResults });
}
