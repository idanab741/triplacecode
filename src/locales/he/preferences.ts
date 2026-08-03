/**
 * מיפוי בין מזהים יציבים (slugs, נשמרים ב-DB) לתצוגה בעברית.
 * הערכים באנגלית לא משתנים לעולם — רק התוויות בעברית יכולות להשתנות.
 */

export interface PreferenceOption {
  value: string;
  label: string;
  /** תמונת רקע לכרטיס הבחירה (public/images/preferences/...) - אופציונלי, לא לכל האופציות יש תמונה עדיין. */
  imageSrc?: string;
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
  { value: "nature_landscapes", label: "טבע ונופים" },
  { value: "springs_streams", label: "מעיינות ונחלים" },
  { value: "beaches_pools", label: "חופי ים ובריכות" },
  { value: "museums_history", label: "מוזיאונים והיסטוריה" },
  { value: "culture_art", label: "תרבות ואמנות" },
  { value: "coffee_carts_cafes", label: "עגלות קפה ובתי קפה" },
  { value: "restaurants_culinary", label: "מסעדות וקולינריה" },
  { value: "wineries_breweries", label: "יקבים ומבשלות" },
  { value: "shopping", label: "שופינג וקניות" },
  { value: "amusement_water_parks", label: "פארקי שעשועים ומים" },
  { value: "water_attractions", label: "אטרקציות מים" },
  { value: "sports_extreme", label: "ספורט ואקסטרים" },
  { value: "relaxation_spa", label: "רוגע וספא" },
  { value: "nightlife", label: "חיי לילה ובילויים" },
  { value: "live_shows", label: "הופעות חיות" },
  { value: "events_festivals", label: "אירועים ופסטיבלים" },
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
  { value: "chill_relax", label: "בטן־גב ורוגע" },
  { value: "nature_adventure", label: "טבע והרפתקאות" },
  { value: "urban_city_trip", label: "טיול אורבני בעיר הגדולה" },
  { value: "shopping", label: "שופינג וקניות" },
  { value: "culinary_restaurants", label: "קולינריה ומסעדות" },
  { value: "museums_history", label: "מוזיאונים והיסטוריה" },
  { value: "culture_art", label: "תרבות ואמנות" },
  { value: "family", label: "משפחתי" },
  { value: "nightlife", label: "חיי לילה ובילויים" },
  { value: "sports_extreme", label: "ספורט ואקסטרים" },
  { value: "spa_wellness", label: "ספא ווולנס" },
  { value: "ski", label: "סקי" },
];
