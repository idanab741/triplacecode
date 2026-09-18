import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { fetchDiscoveryPlaces, fetchHotPlaces, type DiscoveryLocation } from "@/services/places/discoveryService";

/**
 * API של עמוד Discovery "חיי לילה ובילויים" (Audit - "אופי הטיול שמופיע
 * בצ'אט"): מצאתי את המקור הקיים - NIGHTLIFE_VENUE_TYPE_OPTIONS
 * (locales/he/nightlife.ts, 10 ערכים - בר קוקטיילים/בר יין/מועדון/
 * הופעה חיה/סטנדאפ/תיאטרון/קריוקי/באולינג/סנוקר/ארקייד) כבר בשימוש
 * בשאלון ה-Trip Builder הקיים.
 *
 * מיפוי ל-DB: יש כבר NIGHTLIFE_VENUE_TYPE_TO_CATEGORY בקובץ המקור, אבל
 * הוא גס מדי (כמה סוגי בילוי שונים לגמרי חולקים category זהה, כמו
 * karaoke/bowling/snooker/arcade שכולם attractions_activities) - זה
 * היה מציג בדיוק אותם מקומות בכל הסקשנים. מצאתי התאמה מדויקת יותר:
 * אותם 10 המפתחות (cocktail_bar/wine_bar/club/...) מוגדרים **גם**
 * כ-tags עדינים תחת "חיי לילה" ב-PLACE_TYPE_TAGS (placeTagOptions.ts) -
 * זה מקור האמת שהאדמין באמת מתייג לפיו מקום ספציפי (ולא רק category
 * גס), אז כאן מסננים לפי tags.ov (requiredAnyTags), לא category בלבד -
 * לא נבנתה טקסונומיה חדשה.
 */

interface NightlifeSection {
  emoji: string;
  title: string;
  tag: string;
}

/** בדיוק 10 הערכים מ-NIGHTLIFE_VENUE_TYPE_OPTIONS (nightlife.ts) - אותו
 *  סדר, אותם emoji/label. */
const DISCOVERY_SECTIONS: Record<string, NightlifeSection> = {
  cocktail_bar: { emoji: "🍸", title: "בר קוקטיילים", tag: "cocktail_bar" },
  wine_bar: { emoji: "🍷", title: "בר יין", tag: "wine_bar" },
  club: { emoji: "🎧", title: "מועדון", tag: "club" },
  live_show: { emoji: "🎤", title: "הופעה חיה", tag: "live_show" },
  standup: { emoji: "🎭", title: "סטנדאפ", tag: "standup" },
  theater: { emoji: "🎙️", title: "תיאטרון", tag: "theater" },
  karaoke: { emoji: "🎤", title: "קריוקי", tag: "karaoke" },
  bowling: { emoji: "🎳", title: "באולינג", tag: "bowling" },
  snooker: { emoji: "🎱", title: "סנוקר", tag: "snooker" },
  arcade: { emoji: "🕹️", title: "בר משחקים / ארקייד", tag: "arcade" },
};

const DEFAULT_SECTION_ORDER = [
  "cocktail_bar",
  "wine_bar",
  "club",
  "live_show",
  "standup",
  "theater",
  "karaoke",
  "bowling",
  "snooker",
  "arcade",
];

/** "הכי חמים עכשיו" - סורק את כל הקטגוריות שבילויי לילה עשויים להיות
 *  מתויגים תחתן (nightlife עצמה, אבל גם events_festivals/
 *  attractions_activities/wineries_dining - ר' NIGHTLIFE_VENUE_TYPE_TO_CATEGORY
 *  המקורי, שממפה חלק מהסוגים לשם). */
const HOT_NIGHTLIFE_CATEGORIES = ["nightlife", "events_festivals", "attractions_activities", "wineries_dining"];

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
  // קטגוריה, כמו שיש בחיי לילה ובילויים"): "hot" הוא פסאודו-קטגוריה
  // מיוחדת ל"🔥 הכי חמים עכשיו" (שהיה כבר קיים כאן, עכשיו מקבל גם הוא
  // "ראה הכל", לא רק שאר הקטגוריות).
  if (categoryParam === "hot") {
    const places = await fetchHotPlaces(supabase, location, limitParam ? Number(limitParam) : 40, HOT_NIGHTLIFE_CATEGORIES, true);
    return NextResponse.json({ title: "הכי חמים עכשיו", emoji: "🔥", places });
  }

  if (categoryParam) {
    const section = DISCOVERY_SECTIONS[categoryParam];
    if (!section) {
      return NextResponse.json({ error: "קטגוריה לא מוכרת" }, { status: 400 });
    }
    const places = await fetchDiscoveryPlaces(supabase, {
      location,
      requiredAnyTags: [section.tag],
      allowNightlife: true,
      limit: limitParam ? Number(limitParam) : 40,
    });
    return NextResponse.json({ title: section.title, emoji: section.emoji, places });
  }

  // עמוד ראשי - Aggregate: "🔥 הכי חמים עכשיו" קודם, ואז 10 הסקשנים.
  const PREVIEW_LIMIT = 10;

  const [hotPlaces, sectionResults] = await Promise.all([
    fetchHotPlaces(supabase, location, PREVIEW_LIMIT, HOT_NIGHTLIFE_CATEGORIES, true),
    Promise.all(
      DEFAULT_SECTION_ORDER.map(async (id) => {
        const section = DISCOVERY_SECTIONS[id];
        const places = await fetchDiscoveryPlaces(supabase, {
          location,
          requiredAnyTags: [section.tag],
          allowNightlife: true,
          limit: PREVIEW_LIMIT,
        });
        return { id, emoji: section.emoji, title: section.title, places };
      })
    ),
  ]);

  return NextResponse.json({ hotPlaces, sections: sectionResults });
}
