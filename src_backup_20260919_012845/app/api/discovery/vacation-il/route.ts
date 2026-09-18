import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import {
  fetchDiscoveryPlaces,
  type DiscoveryLocation,
} from "@/services/places/discoveryService";

/**
 * API של עמוד Discovery "חופשה בארץ" (Audit מול "אני רוצה עכשיו להמשיך
 * את מערכת ה-Discovery... ולבנות ממנה עמוד נפרד לחלוטין... זה לא שינוי
 * קוסמטי של 'טיול יומי'. זה מוצר Discovery נפרד"): שכבה דטרמיניסטית
 * בלבד - בלי AI, בלי Day Blueprint/Pace/Restaurant Quota. ממחזרת את
 * discoveryService.ts הקיים במלואו (אותה שכבת Retrieval/Ranking בדיוק
 * כמו "טיול יומי") - **רק** רשימת הסקשנים שונה (סעיף 21 - "אין להעתיק
 * את רשימת הקטגוריות של טיול יומי").
 *
 * שני מצבים (זהה ל-day-trip/route.ts): בלי `category` - Aggregate מלא
 * לעמוד הראשי; עם `category` - סקשן בודד, limit גדול יותר, ל"ראה הכל".
 */

/** מיפוי section-id -> פרמטרי שאילתה (Audit סעיף 5-16). כל קטגוריה
 *  ממופה למנגנון קיים בפועל - trip_type_tags (tripTaxonomy.ts),
 *  subcategory, או tags (placeTagOptions.ts: PLACE_TYPE_TAGS/DNA_TAGS) -
 *  לא טקסונומיה חדשה. שתי קטגוריות (מלונות, צימרים/גלמפינג/קמפינג)
 *  ממופות ל-tags (hotel/resort/cabin/glamping/camping) כי אין להן
 *  trip_type_tag ייעודי בטקסונומיה - "מלונות" בפרט כלל לא מנוהל דרך
 *  trip_type_tags בשום מקום במערכת (ר' placeCategories.ts), רק דרך
 *  עמודת category הגסה עצמה (category="hotels") ו/או תיוג tags חופשי.
 */
const DISCOVERY_SECTIONS: Record<
  string,
  {
    emoji: string;
    title: string;
    category?: string;
    categories?: string[];
    subcategories?: string[];
    requiredAnyTags?: string[];
    categoryColumnEquals?: string;
    allowNightlife?: boolean;
  }
> = {
  hotels: {
    emoji: "🏨",
    title: "מלונות",
    categoryColumnEquals: "hotels",
    requiredAnyTags: ["hotel", "resort"],
  },
  beaches_pools: { emoji: "🏖️", title: "חופים ובריכות", category: "beaches_pools" },
  spa_relaxation: { emoji: "💆", title: "ספא ורוגע", category: "spa_relaxation" },
  romantic: {
    emoji: "❤️",
    title: "חופשה זוגית",
    categories: ["spa_relaxation", "wineries_dining", "attractions_activities", "beaches_pools"],
    requiredAnyTags: ["romantic"],
  },
  family: {
    emoji: "👨‍👩‍👧‍👦",
    title: "חופשה משפחתית",
    categories: ["water_amusement_parks", "beaches_pools", "attractions_activities", "parks_gardens"],
    requiredAnyTags: ["family", "kids_family"],
  },
  nature_trails: { emoji: "🌿", title: "טבע ונופים", category: "nature_trails" },
  wineries_dining: { emoji: "🍷", title: "אוכל וקולינריה", category: "wineries_dining" },
  nightlife: { emoji: "🌙", title: "חיי לילה", category: "nightlife", allowNightlife: true },
  camping_glamping: {
    emoji: "🏕️",
    title: "צימרים, גלמפינג וקמפינג",
    requiredAnyTags: ["cabin", "glamping", "camping"],
  },
  shopping: { emoji: "🛍️", title: "שופינג וקניות", category: "shopping" },
};

/** סדר ברירת המחדל - בדיוק לפי סעיף 6-16 (בלי hottest_now, שמטופל
 *  בנפרד למעלה ב-Aggregate; ובלי אירועים/רחובות - סעיף 21 מפורש
 *  "אין להוסיף לכאן אירועים ופסטיבלים/רחובות ומרכזי בילוי"). */
const DEFAULT_SECTION_ORDER = [
  "hotels",
  "beaches_pools",
  "spa_relaxation",
  "romantic",
  "family",
  "nature_trails",
  "wineries_dining",
  "nightlife",
  "camping_glamping",
  "shopping",
];

/** תיקון Product מפורש ("בהכי חמים עכשיו צריך להופיע בעיקר מלונות/
 *  צימרים/וילות - לא סתם אטרקציות שיכולות להופיע בטיול יומי"): "הכי
 *  חמים עכשיו" בעמוד חופשה בארץ עבר מ-fetchHotPlaces (סריקת קטגוריות
 *  כלליות + מכסה-2-לקטגוריה, שהציפה אטרקציות/נוף על חשבון לינה) ל-
 *  fetchDiscoveryPlaces עם אותו סינון בדיוק כמו סקשן "hotels" למעלה
 *  (categoryColumnEquals="hotels" + tags) - פשוט עם requiredAnyTags
 *  מורחב שכולל גם צימרים/גלמפינג/קמפינג/וילות, לא רק hotel/resort,
 *  כדי שתוצאת "הכי חם" תהיה כולה סוגי לינה, בלי מכסת-קטגוריה שמדללת
 *  אותה עם אטרקציות אחרות. */
const VACATION_HOT_REQUIRED_ANY_TAGS = ["hotel", "resort", "cabin", "glamping", "camping", "villa"];

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

  // "ראה הכל" - סקשן בודד, limit גדול. תיקון (Audit - "ראה עוד בכל
  // קטגוריה"): "hot" הוא פסאודו-קטגוריה מיוחדת ל"🔥 הכי חמים עכשיו".
  if (categoryParam === "hot") {
    const places = await fetchDiscoveryPlaces(supabase, {
      location,
      categoryColumnEquals: "hotels",
      requiredAnyTags: VACATION_HOT_REQUIRED_ANY_TAGS,
      limit: limitParam ? Number(limitParam) : 40,
    });
    return NextResponse.json({ title: "הכי חמים עכשיו", emoji: "🔥", places });
  }

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
      categoryColumnEquals: section.categoryColumnEquals,
      allowNightlife: section.allowNightlife,
      limit: limitParam ? Number(limitParam) : 40,
    });
    return NextResponse.json({ title: section.title, emoji: section.emoji, places });
  }

  // עמוד ראשי - Aggregate: הכי חמים עכשיו (places) + כל הסקשנים, preview
  // מוגבל. תיקון (בקשה מפורשת - "רוצה קרוסלה עם היעדים הבאים..."):
  // "🔥 היעדים החמים" כבר לא DB-driven - הפך לרשימה סטטית וקבועה
  // (constants/israelVacationDestinations.ts), מוצג ישירות ב-page.tsx
  // בלי לעבור דרך ה-API הזה בכלל. לא נשלף כאן יותר.
  const PREVIEW_LIMIT = 10;

  const [hotPlaces, sectionResults] = await Promise.all([
    fetchDiscoveryPlaces(supabase, {
      location,
      categoryColumnEquals: "hotels",
      requiredAnyTags: VACATION_HOT_REQUIRED_ANY_TAGS,
      limit: PREVIEW_LIMIT,
    }),
    Promise.all(
      DEFAULT_SECTION_ORDER.map(async (id) => {
        const section = DISCOVERY_SECTIONS[id];
        const places = await fetchDiscoveryPlaces(supabase, {
          location,
          category: section.category,
          categories: section.categories,
          subcategories: section.subcategories,
          requiredAnyTags: section.requiredAnyTags,
          categoryColumnEquals: section.categoryColumnEquals,
          allowNightlife: section.allowNightlife,
          limit: PREVIEW_LIMIT,
        });
        return { id, emoji: section.emoji, title: section.title, places };
      })
    ),
  ]);

  return NextResponse.json({
    hotPlaces,
    sections: sectionResults,
  });
}
