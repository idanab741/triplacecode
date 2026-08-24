import type { QuickCategoryId } from "@/constants/quickCategories";

/**
 * מטא-דאטה של הסקשנים האמיתיים שכל אחד מ-5 סוגי הטיול (טיול יומי/טבע/
 * מסעדות וקפה/דייט רומנטי/חיי לילה) מציג בפועל באפליקציה - הועתק
 * במדויק (id/emoji/title/פרמטרי סינון) מתוך DISCOVERY_SECTIONS + סדר
 * הסקשנים בכל אחד מ-src/app/api/discovery/{day-trip,nature-trip,
 * restaurants-cafes,romantic-date,nightlife}/route.ts.
 *
 * *** למה קובץ נפרד ולא ייבוא ישיר מ-route.ts הקיימים: route.ts הם
 * Route Handlers (יכולים לרוץ רק בצד שרת, ומייצאים רק GET/POST) -
 * אי אפשר לייבא מהם ישירות למסך לקוח (admin/place-console) בלי לשבור
 * את ה-bundle. זהו *העתק* מכוון של המטא-דאטה (לא לוגיקת שאילתה - זו
 * מגיעה מ-fetchDiscoveryPlaces המשותף, ר' /api/admin/discovery-sections),
 * אז אם סקשן חדש נוסף לאחד מהעמודים האמיתיים, יש לעדכן גם כאן.
 */
export interface AdminDiscoverySection {
  id: string;
  emoji: string;
  title: string;
  category?: string;
  categories?: string[];
  subcategories?: string[];
  requiredAnyTags?: string[];
  requiredAnyCuisineTags?: string[];
  categoryColumnEquals?: string;
  allowNightlife?: boolean;
}

export const ADMIN_DISCOVERY_SECTIONS: Partial<Record<QuickCategoryId, AdminDiscoverySection[]>> = {
  day_trip: [
    { id: "coffee_carts_cafes", emoji: "☕", title: "עגלות קפה", category: "coffee_carts_cafes" },
    { id: "nature_trails", emoji: "🌿", title: "מסלולי טבע", category: "nature_trails" },
    { id: "viewpoints", emoji: "🌄", title: "תצפיות", category: "viewpoints" },
    { id: "shopping", emoji: "🛍️", title: "שופינג וקניות", category: "shopping" },
    { id: "water_amusement_parks", emoji: "🎢", title: "פארקי שעשועים ומים", category: "water_amusement_parks" },
    { id: "parks_gardens", emoji: "🌳", title: "פארקים וגנים", category: "parks_gardens" },
    {
      id: "wineries_dining",
      emoji: "🍷",
      title: "יקבים ומבשלות",
      category: "wineries_dining",
      subcategories: ["winery", "brewery", "distillery", "wine_tasting", "beer_tasting", "culinary_tour"],
    },
    { id: "attractions_activities", emoji: "🎯", title: "אטרקציות", category: "attractions_activities" },
    {
      id: "culture_art",
      emoji: "🎨",
      title: "תרבות ואמנות",
      category: "culture_history",
      subcategories: ["gallery", "exhibition", "culture_center", "artists_village"],
    },
    {
      id: "history_museums",
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
    { id: "picnics", emoji: "🧺", title: "פיקניקים", category: "parks_gardens", subcategories: ["picnic_park"] },
    {
      id: "streets_centers",
      emoji: "🏙️",
      title: "רחובות ומרכזי בילוי",
      categories: ["culture_history", "shopping", "wineries_dining"],
      subcategories: ["historic_street", "open_shopping_area", "food_complex"],
    },
  ],

  nature_trip: [
    { id: "springs_streams", emoji: "💧", title: "מעיינות ונחלים", category: "beaches_pools", subcategories: ["natural_pool"] },
    {
      id: "viewpoints_scenery",
      emoji: "🌄",
      title: "תצפיות ונופים",
      category: "viewpoints",
      subcategories: ["viewpoint", "view_balcony", "lookout", "mountain_view"],
    },
    { id: "forests_groves", emoji: "🌳", title: "יערות וחורשות", category: "nature_trails", subcategories: ["forest", "grove"] },
    {
      id: "hiking_trails",
      emoji: "🥾",
      title: "מסלולי הליכה",
      category: "nature_trails",
      subcategories: ["hiking_trail", "trip_route", "accessible_trail"],
    },
    { id: "seasonal_bloom", emoji: "🌸", title: "פריחה עונתית", category: "nature_trails", subcategories: ["seasonal_bloom"] },
    {
      id: "caves_phenomena",
      emoji: "🪨",
      title: "מערות ותופעות טבע",
      category: "nature_trails",
      subcategories: ["natural_cave", "hanging_bridge", "special_nature_site"],
    },
    { id: "desert_canyons", emoji: "🏜️", title: "מדבר וקניונים", category: "nature_trails", subcategories: ["canyon", "valley"] },
    { id: "waterfalls", emoji: "💦", title: "מפלים (עונתיים)", category: "beaches_pools", subcategories: ["natural_pool"] },
    { id: "wildlife", emoji: "🦌", title: "טבע ובעלי חיים", category: "nature_trails" },
    {
      id: "sunrise_sunset",
      emoji: "🌅",
      title: "זריחה או שקיעה",
      category: "viewpoints",
      subcategories: ["sunrise_point", "sunset_point"],
    },
    {
      id: "photogenic_spots",
      emoji: "📸",
      title: "מקומות פוטוגניים / אינסטגרמי",
      category: "viewpoints",
      subcategories: ["photo_spot", "night_view", "stargazing"],
    },
    { id: "picnic_nature", emoji: "🧺", title: "פיקניק בטבע", category: "parks_gardens", subcategories: ["picnic_park"] },
    { id: "nature_reserves", emoji: "🌿", title: "שמורות טבע", category: "nature_trails", subcategories: ["nature_reserve"] },
  ],

  restaurants_cafes: [
    { id: "israeli", emoji: "🥙", title: "ישראלי", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["israeli_middle_eastern"] },
    { id: "italian", emoji: "🍝", title: "איטלקי", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["italian"] },
    { id: "asian", emoji: "🥢", title: "אסייתי", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["asian"] },
    { id: "meat_bbq", emoji: "🍖", title: "בשרים ועל האש", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["meat_bbq"] },
    { id: "burger_diner", emoji: "🍔", title: "המבורגר ודיינר אמריקאי", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["burger_diner"] },
    { id: "mexican", emoji: "🌮", title: "מקסיקני", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["mexican"] },
    { id: "greek", emoji: "🫓", title: "יווני", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["greek"] },
    { id: "french_bistro", emoji: "🥖", title: "ביסטרו צרפתי", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["french_bistro"] },
    { id: "indian", emoji: "🍛", title: "הודי", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["indian"] },
    { id: "mediterranean", emoji: "🫒", title: "ים־תיכוני", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["mediterranean"] },
    { id: "seafood", emoji: "🐟", title: "דגים ופירות ים", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["seafood"] },
    { id: "pizza", emoji: "🍕", title: "פיצה", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["pizza"] },
    { id: "breakfast_brunch", emoji: "🥐", title: "ארוחת בוקר ובראנץ׳", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["breakfast_brunch"] },
    { id: "cafe", emoji: "☕", title: "בית קפה", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["cafe"] },
    { id: "fine_dining", emoji: "👨‍🍳", title: "מסעדות שף", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["fine_dining"] },
    { id: "local_food", emoji: "🍴", title: "אוכל מקומי", category: "wineries_dining", subcategories: ["local_restaurant"] },
    { id: "desserts_sweets", emoji: "🍰", title: "מאנצ׳ים ומתוקים", categories: ["wineries_dining", "coffee_carts_cafes"], requiredAnyCuisineTags: ["desserts_sweets"] },
    { id: "ice_cream", emoji: "🍦", title: "גלידריות", category: "wineries_dining", subcategories: ["ice_cream_shop"] },
  ],

  romantic_date: [
    { id: "romantic_meal", emoji: "🍽️", title: "ארוחה רומנטית", category: "wineries_dining", requiredAnyTags: ["romantic"] },
    {
      id: "sunset_view",
      emoji: "🌅",
      title: "שקיעה ונוף",
      category: "viewpoints",
      subcategories: ["sunset_point", "viewpoint", "view_balcony"],
    },
    { id: "beach", emoji: "🏖️", title: "חוף ים", category: "beaches_pools", subcategories: ["sea_beach", "wild_beach", "organized_beach"] },
    { id: "winery_bar", emoji: "🍷", title: "יקב או בר יין", category: "wineries_dining", subcategories: ["winery", "wine_tasting"] },
    { id: "cafe", emoji: "☕", title: "בית קפה", category: "coffee_carts_cafes", subcategories: ["cafe", "cafe_with_view", "specialty_coffee"] },
    {
      id: "culture_show",
      emoji: "🎭",
      title: "תרבות והופעה",
      categories: ["culture_history", "events_festivals"],
      subcategories: ["culture_center", "exhibition", "live_show", "culture_event"],
    },
    { id: "couples_workshop", emoji: "🎨", title: "סדנה זוגית", category: "attractions_activities", subcategories: ["workshop"] },
    { id: "spa", emoji: "🧖", title: "ספא", category: "spa_relaxation" },
    { id: "night_out", emoji: "🌃", title: "בילוי לילי", category: "nightlife", allowNightlife: true },
  ],

  nightlife: [
    { id: "cocktail_bar", emoji: "🍸", title: "בר קוקטיילים", requiredAnyTags: ["cocktail_bar"] },
    { id: "wine_bar", emoji: "🍷", title: "בר יין", requiredAnyTags: ["wine_bar"] },
    { id: "club", emoji: "🎧", title: "מועדון", requiredAnyTags: ["club"] },
    { id: "live_show", emoji: "🎤", title: "הופעה חיה", requiredAnyTags: ["live_show"] },
    { id: "standup", emoji: "🎭", title: "סטנדאפ", requiredAnyTags: ["standup"] },
    { id: "theater", emoji: "🎙️", title: "תיאטרון", requiredAnyTags: ["theater"] },
    { id: "karaoke", emoji: "🎤", title: "קריוקי", requiredAnyTags: ["karaoke"] },
    { id: "bowling", emoji: "🎳", title: "באולינג", requiredAnyTags: ["bowling"] },
    { id: "snooker", emoji: "🎱", title: "סנוקר", requiredAnyTags: ["snooker"] },
    { id: "arcade", emoji: "🕹️", title: "בר משחקים / ארקייד", requiredAnyTags: ["arcade"] },
  ],

  // *** "חופשה בארץ" - הועתק מ-DISCOVERY_SECTIONS ב-
  // src/app/api/discovery/vacation-il/route.ts (10 סקשנים). זה שונה
  // מ-ISRAEL_VACATION_DESTINATIONS (9 היעדים המתויקים בקרוסלה) - זו
  // חלוקת התוכן העשירה יותר שהעמוד עצמו מציג בפועל, ולכן היא זו
  // שמתאימה למנגנון האחיד (פילים למעלה + גריד אטרקציות מסונן).
  weekend: [
    { id: "hotels", emoji: "🏨", title: "מלונות", categoryColumnEquals: "hotels", requiredAnyTags: ["hotel", "resort"] },
    { id: "beaches_pools", emoji: "🏖️", title: "חופים ובריכות", category: "beaches_pools" },
    { id: "spa_relaxation", emoji: "💆", title: "ספא ורוגע", category: "spa_relaxation" },
    {
      id: "romantic",
      emoji: "❤️",
      title: "חופשה זוגית",
      categories: ["spa_relaxation", "wineries_dining", "attractions_activities", "beaches_pools"],
      requiredAnyTags: ["romantic"],
    },
    {
      id: "family",
      emoji: "👨‍👩‍👧‍👦",
      title: "חופשה משפחתית",
      categories: ["water_amusement_parks", "beaches_pools", "attractions_activities", "parks_gardens"],
      requiredAnyTags: ["family", "kids_family"],
    },
    { id: "nature_trails", emoji: "🌿", title: "טבע ונופים", category: "nature_trails" },
    { id: "wineries_dining", emoji: "🍷", title: "אוכל וקולינריה", category: "wineries_dining" },
    { id: "nightlife", emoji: "🌙", title: "חיי לילה", category: "nightlife", allowNightlife: true },
    { id: "camping_glamping", emoji: "🏕️", title: "צימרים, גלמפינג וקמפינג", requiredAnyTags: ["cabin", "glamping", "camping"] },
    { id: "shopping", emoji: "🛍️", title: "שופינג וקניות", category: "shopping" },
  ],
};
