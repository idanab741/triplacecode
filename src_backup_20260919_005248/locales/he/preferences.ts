/**
 * מיפוי בין מזהים יציבים (slugs, נשמרים ב-DB) לתצוגה בעברית.
 * הערכים באנגלית לא משתנים לעולם — רק התוויות בעברית יכולות להשתנות.
 */

export interface PreferenceOption {
  value: string;
  label: string;
  /** תמונת רקע לכרטיס הבחירה (public/images/preferences/...) - אופציונלי, לא לכל האופציות יש תמונה עדיין. */
  imageSrc?: string;
  /** אימוג'י קטן ליד התווית (בעיקר לתחומי עניין) - אופציונלי. */
  emoji?: string;
}

export const CULINARY_STYLES: PreferenceOption[] = [
  { value: "israeli", label: "ישראלי", imageSrc: "/images/preferences/culinary/israeli.png" },
  { value: "italian", label: "איטלקי", imageSrc: "/images/preferences/culinary/italian.png" },
  { value: "asian", label: "אסייתי", imageSrc: "/images/preferences/culinary/asian.png" },
  { value: "meat_bbq", label: "בשרים ועל האש", imageSrc: "/images/preferences/culinary/meat_bbq.png" },
  { value: "burger_diner", label: "המבורגר ודיינר אמריקאי", imageSrc: "/images/preferences/culinary/burger_diner.png" },
  { value: "mexican", label: "מקסיקני", imageSrc: "/images/preferences/culinary/mexican.png" },
  { value: "greek", label: "יווני", imageSrc: "/images/preferences/culinary/greek.png" },
  { value: "french_bistro", label: "ביסטרו צרפתי", imageSrc: "/images/preferences/culinary/french_bistro.png" },
  { value: "indian", label: "הודי", imageSrc: "/images/preferences/culinary/indian.png" },
  { value: "mediterranean", label: "ים־תיכוני", imageSrc: "/images/preferences/culinary/mediterranean.png" },
  { value: "seafood", label: "דגים ופירות ים", imageSrc: "/images/preferences/culinary/seafood.png" },
  { value: "pizza", label: "פיצה", imageSrc: "/images/preferences/culinary/pizza.png" },
  { value: "breakfast_brunch", label: "ארוחת בוקר ובראנץ'", imageSrc: "/images/preferences/culinary/breakfast_brunch.png" },
  { value: "cafe", label: "בית קפה", imageSrc: "/images/preferences/culinary/cafe.png" },
  { value: "fine_dining", label: "מסעדות שף", imageSrc: "/images/preferences/culinary/chef.png" },
  { value: "local_food", label: "אוכל מקומי", imageSrc: "/images/preferences/culinary/local_food.png" },
  { value: "snacks_sweets", label: "מאנצ'ים ומתוקים", imageSrc: "/images/preferences/culinary/snacks_sweets.png" },
];

export const DIETARY_RESTRICTIONS: PreferenceOption[] = [
  { value: "vegetarian", label: "צמחוני" },
  { value: "vegan", label: "טבעוני" },
  // "כשר" - הועבר לכאן (לסקטור המזון) במקום שאלת toggle נפרדת. השדה
  // ב-DB/בפרופיל עדיין boolean נפרד (kosher) - page.tsx ממפה את הצ'יפ הזה
  // אליו במיוחד, כדי לא לשבור את כל הקוד הרחב שכבר קורא dna.kosher/profile.kosher.
  { value: "kosher", label: "כשר", imageSrc: "/images/preferences/culinary/kosher.png" },
];

export const TRANSPORTATION: PreferenceOption[] = [
  { value: "private_car", label: "רכב פרטי" },
  { value: "public_transport", label: "תחבורה ציבורית" },
  { value: "bicycle", label: "אופניים" },
  { value: "motorcycle", label: "אופנוע" },
  { value: "walking", label: "הליכה ברגל" },
];

export const INTERESTS: PreferenceOption[] = [
  { value: "coffee_carts_cafes", label: "עגלות קפה ובתי קפה", emoji: "☕" },
  { value: "nature_trails", label: "מסלולי טבע ונופים", emoji: "🌿" },
  { value: "beaches_pools", label: "חופי ים, אגמים ובריכות", emoji: "🏖️" },
  { value: "viewpoints", label: "תצפיות, זריחות ושקיעות", emoji: "🌅" },
  { value: "parks_gardens", label: "פארקים, גנים ופינות פיקניק", emoji: "🌳" },
  { value: "water_amusement_parks", label: "פארקי מים, פארקי שעשועים ומתקנים", emoji: "🎡" },
  { value: "attractions_activities", label: "אטרקציות ופעילויות", emoji: "🎯" },
  { value: "sports_extreme", label: "ספורט ואקסטרים", emoji: "🚴" },
{ value: "restaurants_culinary", label: "מסעדות וקולינריה", emoji: "🍽️" },
  { value: "wineries_breweries", label: "יקבים ומבשלות", emoji: "🍷" },
  { value: "culture_history", label: "תרבות, מוזיאונים והיסטוריה", emoji: "🏛️" },
  { value: "shopping", label: "שופינג, קניות ושווקים", emoji: "🛍️" },
  { value: "events_festivals", label: "אירועים, הופעות ופסטיבלים", emoji: "🎪" },
  { value: "nightlife_entertainment", label: "חיי לילה ובילויים", emoji: "🎭" },
  { value: "spa_relaxation", label: "ספא, מרחצאות ורוגע", emoji: "🧖" },
  { value: "boating_water_attractions", label: "שיט ואטרקציות מים", emoji: "🛶" },
  { value: "heritage_holy_sites", label: "אתרי מורשת ומקומות קדושים", emoji: "🛕" },
  { value: "kids_family_activities", label: "פעילויות לילדים ומשפחות", emoji: "👨‍👩‍👧‍👦" },
  { value: "art_galleries", label: "אמנות וגלריות", emoji: "🎨" },
  { value: "photo_spots", label: "נקודות צילום ונופי אינסטגרם", emoji: "📸" },
];

export const ACCOMMODATION_TYPES: PreferenceOption[] = [
  { value: "hotel", label: "מלון", imageSrc: "/images/preferences/accommodation/hotel.png" },
  { value: "resort", label: "ריזורט ואתרי נופש", imageSrc: "/images/preferences/accommodation/resort.png" },
  { value: "apartment", label: "דירה", imageSrc: "/images/preferences/accommodation/appartment.png" },
  { value: "cabin", label: "צימר", imageSrc: "/images/preferences/accommodation/zimmer.png" },
  { value: "hostel", label: "הוסטל", imageSrc: "/images/preferences/accommodation/hostel.png" },
  { value: "camping", label: "קמפינג", imageSrc: "/images/preferences/accommodation/camping.png" },
  { value: "glamping", label: "גלמפינג", imageSrc: "/images/preferences/accommodation/glamping.png" },
  { value: "villa", label: "וילה", imageSrc: "/images/preferences/accommodation/villa.png" },
];

export const VACATION_PREFERENCES: PreferenceOption[] = [
  { value: "beach_relax", label: "בטן גב וחופים", imageSrc: "/images/preferences/activities/beach.png" },
  { value: "casino_gambling", label: "קזינו והימורים", imageSrc: "/images/preferences/activities/casino.png" },
  { value: "cruise", label: "קרוזים ושייט", imageSrc: "/images/preferences/activities/cruise.png" },
  { value: "family", label: "חופשה משפחתית", imageSrc: "/images/preferences/activities/family.png" },
  { value: "seasonal_holidays", label: "חופשות עונתיות", imageSrc: "/images/preferences/activities/holiday.png" },
  { value: "honeymoon_romantic", label: "חופשה רומנטית וירח דבש", imageSrc: "/images/preferences/activities/honeymoon.png" },
  { value: "live_shows_festivals", label: "הופעות חיות ופסטיבלים", imageSrc: "/images/preferences/activities/liveshow.png" },
  { value: "digital_nomad", label: "נוודות דיגיטלית", imageSrc: "/images/preferences/activities/digitalnomad.png" },
  { value: "luxury_indulgence", label: "יוקרה ופינוקים", imageSrc: "/images/preferences/activities/luxury.png" },
  { value: "spa_wellness_retreats", label: "ספא, וולנס וריטריטים", imageSrc: "/images/preferences/activities/wellness.png" },
  { value: "ski_winter_sports", label: "סקי וספורט חורף", imageSrc: "/images/preferences/activities/ski.png" },
  { value: "sports_events", label: "אירועי ספורט", imageSrc: "/images/preferences/activities/sportsevents.png" },
  { value: "backpacking_trekking", label: "טיולי תרמילאים", imageSrc: "/images/preferences/activities/treknature.png" },
  { value: "tropical_vacation", label: "חופשות טרופיות", imageSrc: "/images/preferences/activities/tropical.png" },
  { value: "urban_city_trip", label: "חופשה עירונית", imageSrc: "/images/preferences/activities/urban.png" },
  { value: "parties_nightlife", label: "מסיבות וחיי לילה", imageSrc: "/images/preferences/activities/parties.png" },
];