/**
 * מקור אמת יחיד לכל רשימות התגיות/קטגוריות בעמודי האדמין ובנקודות ה-API
 * שלהן. לפני הקובץ הזה, כל אחד מ-4 המקומות הבאים החזיק העתק משלו של
 * אותן רשימות בדיוק (Discovery page, כרטיסיית מקום בודד, suggest-scores
 * route, bulk-suggest-tags route) - וזו הסיבה שהן התחילו לסטות זו מזו
 * (עמוד אחד מציג קטגוריה שעמוד אחר לא בכלל מכיר). מכאן והלאה יש לייבא
 * מפה, לא לשכפל.
 */

export const CUISINE_TAGS = [
  { key: "coffee_cart", label: "☕ עגלת קפה" }, { key: "israeli", label: "🥙 ישראלי" },
  { key: "italian", label: "🍝 איטלקי" }, { key: "asian", label: "🥢 אסייתי" },
  { key: "bbq", label: "🍖 בשרים ועל האש" }, { key: "burger_diner", label: "🍔 המבורגר ודיינר" },
  { key: "mexican", label: "🌮 מקסיקני" }, { key: "greek", label: "🫓 יווני" },
  { key: "french_bistro", label: "🥖 ביסטרו צרפתי" }, { key: "indian", label: "🍛 הודי" },
  { key: "mediterranean", label: "🫒 ים-תיכוני" }, { key: "seafood", label: "🐟 דגים ופירות ים" },
  { key: "pizza", label: "🍕 פיצה" }, { key: "brunch", label: "🥐 בראנץ'" },
  { key: "cafe", label: "☕ בית קפה" }, { key: "chef_restaurant", label: "👨‍🍳 מסעדת שף" },
  { key: "desserts", label: "🍰 מתוקים" },
  // אפשרות נוספת, בנוסף לכל מה שיש למעלה: מסעדה כשרה - זה השדה היחיד ברשימה
  // הזו שגם קובע (בתוספת עדכון בטופס עצמו) את kosher=true על המקום, שהוא
  // השדה שנאכף באופן מחייב במאגר המועמדים - ר' candidatePoolService.ts.
  { key: "kosher", label: "✡️ כשר" },
] as const;

/** תת-סוג מדויק - "קטגוריה/סוג מקום" בעמוד ה-Discovery. שייכות ל-`tags`
 *  (מערך), לא ל-`category` הראשי (5 הערכים היחידים המותרים שם, ראו
 *  placeCategories.ts). */
export const PLACE_TYPE_TAGS = [
  // אטרקציות
  { key: "nature_trails", label: "🌿 מסלולי טבע" }, { key: "beaches_pools", label: "🏖️ חופים/בריכות" },
  { key: "viewpoints", label: "🌅 תצפיות" }, { key: "parks_picnic", label: "🌳 פארקים" },
  { key: "water_parks", label: "🎡 פארקי מים" }, { key: "general_attractions", label: "🎯 אטרקציות" },
  { key: "sports_extreme", label: "🚴 ספורט/אקסטרים" }, { key: "wineries", label: "🍷 יקבים" },
  { key: "culture_museums", label: "🏛️ תרבות/מוזיאונים" }, { key: "shopping", label: "🛍️ שופינג" },
  { key: "events", label: "🎪 אירועים" }, { key: "spa", label: "🧖 ספא" },
  { key: "boating", label: "🛶 שיט" }, { key: "heritage", label: "🛕 מורשת" },
  { key: "kids_family", label: "👨‍👩‍👧‍👦 ילדים ומשפחות" }, { key: "art_galleries", label: "🎨 אמנות" },
  { key: "photo_spots", label: "📸 צילום" }, { key: "must_see_landmarks", label: "🗽 אתר חובה" },
  // מסעדות (חלק מהן חופפות ל-cuisine, אך משמשות גם כתיוג "סוג מקום" - למשל רופטופ/מסיבות שהן מסעדה+חיי לילה גם יחד)
  { key: "rooftop", label: "🏙️ רופטופ" }, { key: "party_venue", label: "🎉 אירוע/מסיבה" },
  { key: "fine_dining", label: "🍷 מסעדת יוקרה" }, { key: "street_food", label: "🌭 אוכל רחוב" },
  // חיי לילה
  { key: "cocktail_bar", label: "🍸 בר קוקטיילים" }, { key: "wine_bar", label: "🍷 בר יין" },
  { key: "club", label: "🎧 מועדון" }, { key: "live_show", label: "🎤 הופעה חיה" },
  { key: "standup", label: "🎭 סטנדאפ" }, { key: "theater", label: "🎙️ תיאטרון" },
  { key: "karaoke", label: "🎤 קריוקי" }, { key: "bowling", label: "🎳 באולינג" },
  { key: "snooker", label: "🎱 סנוקר" }, { key: "arcade", label: "🕹️ ארקייד" },
  // לינה
  { key: "hotel", label: "🏨 מלון" }, { key: "resort", label: "🏝️ ריזורט" },
  { key: "apartment", label: "🏠 דירה" }, { key: "cabin", label: "🛖 צימר" },
  { key: "hostel", label: "🛏️ הוסטל" }, { key: "camping", label: "⛺ קמפינג" },
  { key: "glamping", label: "🏕️ גלמפינג" }, { key: "villa", label: "🏡 וילה" },
] as const;

export const TRIPMATCH_TAGS = [
  { key: "coffee_carts", label: "☕ עגלות קפה" }, { key: "nature_trails", label: "🌿 מסלולי טבע" },
  { key: "beaches_pools", label: "🏖️ חופים/בריכות" }, { key: "viewpoints", label: "🌅 תצפיות" },
  { key: "parks_picnic", label: "🌳 פארקים" }, { key: "water_parks", label: "🎡 פארקי מים" },
  { key: "attractions", label: "🎯 אטרקציות" }, { key: "sports_extreme", label: "🚴 ספורט" },
  { key: "restaurants", label: "🍽️ מסעדות" }, { key: "wineries", label: "🍷 יקבים" },
  { key: "culture_museums", label: "🏛️ תרבות" }, { key: "shopping", label: "🛍️ שופינג" },
  { key: "events", label: "🎪 אירועים" }, { key: "nightlife", label: "🎭 חיי לילה" },
  { key: "spa", label: "🧖 ספא" }, { key: "boating", label: "🛶 שיט" },
  { key: "heritage", label: "🛕 מורשת" }, { key: "kids_family", label: "👨‍👩‍👧‍👦 ילדים" },
  { key: "art_galleries", label: "🎨 אמנות" }, { key: "photo_spots", label: "📸 צילום" },
] as const;

export const DNA_TAGS = [
  { key: "romantic", label: "רומנטי" }, { key: "family", label: "משפחתי" }, { key: "social", label: "חברתי" },
  { key: "luxury", label: "יוקרתי" }, { key: "local_authentic", label: "מקומי" }, { key: "touristy", label: "תיירותי" },
  { key: "special", label: "מיוחד" }, { key: "photogenic", label: "פוטוגני" }, { key: "adventurous", label: "הרפתקני" },
  { key: "natural", label: "טבעי" }, { key: "urban", label: "עירוני" }, { key: "cultural", label: "תרבותי" },
  { key: "culinary", label: "קולינרי" }, { key: "wellness_calm", label: "רגוע" }, { key: "active", label: "אקטיבי" },
  { key: "hidden_gem", label: "פנינה נסתרת" },
] as const;

export const CUISINE_KEYS = CUISINE_TAGS.map((t) => t.key);
export const PLACE_TYPE_KEYS = PLACE_TYPE_TAGS.map((t) => t.key);
export const TRIPMATCH_KEYS = TRIPMATCH_TAGS.map((t) => t.key);
export const DNA_KEYS = DNA_TAGS.map((t) => t.key);
