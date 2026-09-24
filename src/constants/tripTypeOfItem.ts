import { HOME_QUICK_CATEGORIES, type HomeQuickCategoryId } from "@/constants/homeQuickCategories";

/**
 * *** חדש (בקשה מפורשת - "הבחירות שלי" + "היומן שלי" עם אייקון לכל סוג טיול):
 * ממפה קטגוריה של מקום (tripadd: food/attraction/..., places: restaurant/cafe/park/...) או סוג
 * טיול של הקהילה (nature_trip / nightlife / ...) לאחד מ-6 סוגי הטיול של עמוד הבית - כדי להציג
 * את אותו אייקון בדיוק. ברירת מחדל: אטרקציה.
 */

const TRIP_TYPE_TO_HOME: Record<string, HomeQuickCategoryId> = {
  nature_trip: "nature",
  day_trip: "nature",
  weekend: "sleep",
  abroad: "attraction",
  romantic_date: "food",
  nightlife: "nightlife",
  restaurants_cafes: "food",
  tripmatch: "attraction",
};

const KEYWORDS: [HomeQuickCategoryId, RegExp][] = [
  ["nightlife", /night|bar\b|pub|club|לילה|בר\b|פאב|מועדון/i],
  ["food", /food|restaurant|cafe|coffee|bakery|dessert|culinary|אוכל|מסעד|קפה|קולינר|מאפ|קינוח/i],
  ["nature", /nature|park|beach|trail|hik|spring|forest|garden|lake|טבע|פארק|חוף|מסלול|מעיין|יער|גן\b|נוף/i],
  ["sleep", /sleep|hotel|lodging|hostel|zimmer|accommodation|לינה|מלון|צימר|אירוח|הוסטל/i],
  ["shopping", /shop|mall|market|store|boutique|קניות|שופינג|קניון|שוק|חנות/i],
];

const HOME_IDS = new Set<string>(HOME_QUICK_CATEGORIES.map((c) => c.id));

export function tripTypeOfItem(category: string | null | undefined, subcategory?: string | null): HomeQuickCategoryId {
  if (category && HOME_IDS.has(category)) return category as HomeQuickCategoryId;
  if (category && TRIP_TYPE_TO_HOME[category]) return TRIP_TYPE_TO_HOME[category];
  const text = `${category ?? ""} ${subcategory ?? ""}`;
  for (const [id, re] of KEYWORDS) if (re.test(text)) return id;
  return "attraction";
}

export function tripTypeIconSrc(id: HomeQuickCategoryId): string {
  return HOME_QUICK_CATEGORIES.find((c) => c.id === id)?.imageSrc ?? "/images/categories/cat-attraction.png";
}

export const TRIP_TYPE_SHORT_LABEL: Record<HomeQuickCategoryId, string> = {
  food: "אוכל",
  attraction: "אטרקציה",
  nature: "טבע",
  shopping: "קניות",
  sleep: "לינה",
  nightlife: "חיי לילה",
};
