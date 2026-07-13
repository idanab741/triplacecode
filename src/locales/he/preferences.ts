/**
 * מיפוי בין מזהים יציבים (slugs, נשמרים ב-DB) לתצוגה בעברית.
 * הערכים באנגלית לא משתנים לעולם — רק התוויות בעברית יכולות להשתנות.
 */

export interface PreferenceOption {
  value: string;
  label: string;
}

export const CULINARY_STYLES: PreferenceOption[] = [
  { value: "israeli", label: "ישראלי" },
  { value: "italian", label: "איטלקי" },
  { value: "asian", label: "אסייתי" },
  { value: "meat_bbq", label: "בשרים ועל האש" },
  { value: "burger_diner", label: "המבורגר ודיינר אמריקאי" },
  { value: "mexican", label: "מקסיקני" },
  { value: "greek", label: "יווני" },
  { value: "french_bistro", label: "ביסטרו צרפתי" },
  { value: "indian", label: "הודי" },
  { value: "mediterranean", label: "ים־תיכוני" },
  { value: "seafood", label: "דגים ופירות ים" },
  { value: "pizza", label: "פיצה" },
  { value: "breakfast_brunch", label: "ארוחת בוקר ובראנץ'" },
  { value: "cafe", label: "בית קפה" },
  { value: "snacks_sweets", label: "מאנצ'ים ומתוקים" },
];

export const DIETARY_RESTRICTIONS: PreferenceOption[] = [
  { value: "vegetarian", label: "צמחוני" },
  { value: "vegan", label: "טבעוני" },
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
  { value: "wineries_breweries", label: "יקבים ומבשלות בירה" },
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
  { value: "hotel", label: "מלון" },
  { value: "resort", label: "ריזורט ואתרי נופש" },
  { value: "apartment", label: "דירה" },
  { value: "cabin", label: "צימר" },
  { value: "hostel", label: "הוסטל" },
  { value: "camping", label: "קמפינג" },
  { value: "glamping", label: "גלמפינג" },
  { value: "villa", label: "וילה" },
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
