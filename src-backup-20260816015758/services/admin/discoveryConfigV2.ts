export interface DiscoveryCategory {
  key: string;
  emoji: string;
  label: string;
}

export interface DiscoveryBucket {
  key: "restaurants" | "attractions" | "nightlife" | "lodging";
  emoji: string;
  label: string;
  categories: DiscoveryCategory[];
}

/** מבנה חדש, לפי בקשה מפורשת: לא 7 סוגי טיול - 4 אפשרויות בלבד, שכל אחת
 *  פותחת את מה שכבר יש לנו לאותו נושא. attractions = 20 הקטגוריות
 *  המפורטות (בלי מסעדות/חיי לילה, שהן עכשיו אפשרויות נפרדות משלהן). */
export const DISCOVERY_BUCKETS: DiscoveryBucket[] = [
  {
    key: "restaurants",
    emoji: "🍽️",
    label: "מסעדה",
    categories: [
      { key: "coffee_cart", emoji: "☕", label: "עגלת קפה" },
      { key: "israeli", emoji: "🥙", label: "ישראלי" },
      { key: "italian", emoji: "🍝", label: "איטלקי" },
      { key: "asian", emoji: "🥢", label: "אסייתי" },
      { key: "bbq", emoji: "🍖", label: "בשרים ועל האש" },
      { key: "burger_diner", emoji: "🍔", label: "המבורגר ודיינר" },
      { key: "mexican", emoji: "🌮", label: "מקסיקני" },
      { key: "greek", emoji: "🫓", label: "יווני" },
      { key: "french_bistro", emoji: "🥖", label: "ביסטרו צרפתי" },
      { key: "indian", emoji: "🍛", label: "הודי" },
      { key: "mediterranean", emoji: "🫒", label: "ים-תיכוני" },
      { key: "seafood", emoji: "🐟", label: "דגים ופירות ים" },
      { key: "pizza", emoji: "🍕", label: "פיצה" },
      { key: "brunch", emoji: "🥐", label: "בראנץ'" },
      { key: "cafe", emoji: "☕", label: "בית קפה" },
      { key: "chef_restaurant", emoji: "👨‍🍳", label: "מסעדות שף" },
      { key: "desserts", emoji: "🍰", label: "מתוקים" },
    ],
  },
  {
    key: "attractions",
    emoji: "🎯",
    label: "אטרקציות",
    categories: [
      { key: "nature_trails", emoji: "🌿", label: "מסלולי טבע ונופים" },
      { key: "beaches_pools", emoji: "🏖️", label: "חופי ים, אגמים ובריכות" },
      { key: "viewpoints", emoji: "🌅", label: "תצפיות, זריחות ושקיעות" },
      { key: "parks_picnic", emoji: "🌳", label: "פארקים, גנים ופינות פיקניק" },
      { key: "water_parks", emoji: "🎡", label: "פארקי מים, שעשועים ומתקנים" },
      { key: "general_attractions", emoji: "🎯", label: "אטרקציות ופעילויות" },
      { key: "sports_extreme", emoji: "🚴", label: "ספורט ואקסטרים" },
      { key: "wineries", emoji: "🍷", label: "יקבים ומבשלות" },
      { key: "culture_museums", emoji: "🏛️", label: "תרבות, מוזיאונים והיסטוריה" },
      { key: "shopping", emoji: "🛍️", label: "שופינג, קניות ושווקים" },
      { key: "events", emoji: "🎪", label: "אירועים, הופעות ופסטיבלים" },
      { key: "spa", emoji: "🧖", label: "ספא, מרחצאות ורוגע" },
      { key: "boating", emoji: "🛶", label: "שיט ואטרקציות מים" },
      { key: "heritage", emoji: "🛕", label: "אתרי מורשת ומקומות קדושים" },
      { key: "kids_family", emoji: "👨‍👩‍👧‍👦", label: "פעילויות לילדים ומשפחות" },
      { key: "art_galleries", emoji: "🎨", label: "אמנות וגלריות" },
      { key: "photo_spots", emoji: "📸", label: "נקודות צילום ואינסטגרם" },
      { key: "must_see_landmarks", emoji: "🗽", label: "אתרי חובה ביעד" },
    ],
  },
  {
    key: "nightlife",
    emoji: "🌃",
    label: "חיי לילה",
    categories: [
      { key: "cocktail_bar", emoji: "🍸", label: "בר קוקטיילים" },
      { key: "wine_bar", emoji: "🍷", label: "בר יין" },
      { key: "club", emoji: "🎧", label: "מועדון" },
      { key: "live_show", emoji: "🎤", label: "הופעה חיה" },
      { key: "standup", emoji: "🎭", label: "סטנדאפ" },
      { key: "theater", emoji: "🎙️", label: "תיאטרון" },
      { key: "karaoke", emoji: "🎤", label: "קריוקי" },
      { key: "bowling", emoji: "🎳", label: "באולינג" },
      { key: "snooker", emoji: "🎱", label: "סנוקר" },
      { key: "arcade", emoji: "🕹️", label: "ארקייד" },
    ],
  },
  {
    key: "lodging",
    emoji: "🏨",
    label: "לינה",
    categories: [
      { key: "hotel", emoji: "🏨", label: "מלון" },
      { key: "resort", emoji: "🏝️", label: "ריזורט" },
      { key: "apartment", emoji: "🏠", label: "דירה" },
      { key: "cabin", emoji: "🛖", label: "צימר" },
      { key: "hostel", emoji: "🛏️", label: "הוסטל" },
      { key: "camping", emoji: "⛺", label: "קמפינג" },
      { key: "glamping", emoji: "🏕️", label: "גלמפינג" },
      { key: "villa", emoji: "🏡", label: "וילה" },
    ],
  },
];

export const COMMON_FILTERS = [
  { key: "min_rating", label: "דירוג Google מינימלי", type: "number" as const },
  { key: "min_reviews", label: "מספר ביקורות מינימלי", type: "number" as const },
  { key: "budget", label: "תקציב", type: "text" as const },
  { key: "quantity", label: "כמות מקומות רצויה", type: "number" as const },
];
