/**
 * קבוצות מילות-מפתח לסיווג מקומות ליעד (מסעדות/אטרקציות/טבע/חיי לילה) +
 * מלונות (category מדויק). קובץ נפרד, בטוח לייבוא גם מ-client
 * components (בניגוד ל-services/places/placesServerService.ts, שמייבא
 * את ה-Supabase server client ולכן לא ניתן לייבוא מ-"use client").
 * placesServerService.ts מייבא ומייצא מחדש מכאן - מקור אמת יחיד.
 *
 * זו בדיוק הקבוצה בת 5 הסקשנים ("מסעדות/אטרקציות/חיי לילה/טבע/מלונות")
 * שהעמוד הציבורי /destination/[id] כבר משתמש בה לכל יעד - ר' migration/
 * הערה בקוד: "יש חלוקה מוגדרת: מסעדות/אטרקציות/חיי לילה/טבע/מלונות".
 */
export const RESTAURANT_CATEGORY_KEYWORDS = [
  "restaurant",
  "dining",
  "cafe",
  "café",
  "bistro",
  "taverna",
  "cuisine",
  "seafood",
  "tapas",
  "bakery",
  "pastry",
  "dessert",
  "brunch",
  "steakhouse",
  "brewery",
  "brewpub",
  "gelato",
  "coffee",
  "culinary",
  "osteria",
  "enoteca",
];

export const ATTRACTION_CATEGORY_KEYWORDS = [
  "attraction",
  "museum",
  "landmark",
  "monument",
  "historic",
  "viewpoint",
  "square",
  "temple",
  "castle",
  "palace",
  "archaeolog",
  "cultural",
  "architecture",
  "theater",
  "church",
  "aquarium",
  "amusement",
];

export const NATURE_CATEGORY_KEYWORDS = [
  "nature",
  "garden",
  "park",
  "beach",
  "forest",
  "hiking",
  "canyon",
  "desert",
  "spring",
  "trail",
  "waterfall",
  "reserve",
];

export const NIGHTLIFE_CATEGORY_KEYWORDS = ["nightlife", "bar", "club", "pub"];

export const HOTEL_CATEGORY_VALUE = "hotels";
