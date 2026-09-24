/** מבנה אחיד לעמוד אטרקציה - לכל מקור נתונים (places / tripadd_submissions).
 *  (בקשה מפורשת - "עמוד אחיד לכל האטרקציות!!") */
export interface AttractionAccessibility {
  entrance: boolean | null;
  parking: boolean | null;
  restroom: boolean | null;
  seating: boolean | null;
}

export interface AttractionData {
  id: string;
  source: "place" | "tripadd";
  name: string;
  imageUrls: string[];
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** שורות שעות הפתיחה מ-Google, בעברית ("יום ראשון: 08:00–21:00"). */
  openingHours: string[] | null;
  /** 1-4 (Google price_level). */
  priceLevel: number | null;
  accessibility: AttractionAccessibility;
  /** קטגוריות בעברית, לפחות 3 (ר' placeCategories.ts). */
  categories: string[];
  googleRating: number | null;
  googleRatingCount: number | null;
  googleUrl: string;
  triplaceRating: number | null;
  triplaceRatingCount: number;
}
