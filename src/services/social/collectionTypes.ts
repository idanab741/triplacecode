/** טיפוסים משותפים (server + client) לאוספים - ר' collectionService.ts ו-migration 0089. */

import type { FeedItemDto } from "./feedService";
import type { TripCardDto } from "./tripTypes";
import type { PostVisibility } from "./types";

/** רק 2 סוגי אוספים, ואין ערבוב ביניהם (נאכף גם ב-DB - ר' trigger collection_items_enforce_type). */
export type CollectionType = "places" | "trips";

/** אותה מערכת Visibility של posts (public / followers / friends / private). */
export type CollectionVisibility = PostVisibility;

export const COLLECTION_LIMITS = {
  minItems: 2,
  maxItems: 50,
  maxTitle: 80,
  maxDescription: 500,
  maxNote: 140,
} as const;

export const COLLECTION_TYPE_LABELS: Record<CollectionType, { itemCount: (n: number) => string; addLabel: string }> = {
  places: { itemCount: (n) => (n === 1 ? "מקום אחד" : `${n} מקומות`), addLabel: "הוספת מקום" },
  trips: { itemCount: (n) => (n === 1 ? "טיול אחד" : `${n} טיולים`), addLabel: "הוספת טיול" },
};

export interface CollectionAuthorDto {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isCreator: boolean;
}

/** כל מה שצריך כדי להציג אוסף כ-Card (ב-Feed, בפרופיל) וכ-Header של עמוד האוסף. */
export interface CollectionCardDto {
  id: string;
  type: CollectionType;
  title: string;
  description: string | null;
  createdAt: string;
  visibility: CollectionVisibility;
  author: CollectionAuthorDto;
  itemCount: number;
  /** Cover שהיוצר בחר. null = מציגים Cover אוטומטי (collageUrls). */
  coverUrl: string | null;
  /** עד 4 תמונות מהפריטים הראשונים - ל-Collage האוטומטי. מדיה קיימת בלבד (לא נוצרת תמונה חדשה). */
  collageUrls: string[];
  stats: { likes: number; comments: number };
  viewerState: { liked: boolean; saved: boolean; isSelf: boolean };
}

export interface CollectionPlaceItemDto {
  id: string;
  kind: "place";
  position: number;
  note: string | null;
  place: {
    id: string;
    name: string;
    category: string;
    city: string | null;
    rating: number | null;
    imageUrls: string[];
    latitude: number | null;
    longitude: number | null;
  };
}

/** מקור הטיול - אותם שני מקורות של "הטיולים שלי" (trip_builder_sessions / trippy_ai_results). */
/** session / trippy_ai = תוצרי בניית-טיול פרטיים של המשתמש ("הטיולים שלי");
 *  trip = טיול חברתי (Trip, migration 0090) - שלו או של מישהו אחר שהוא רשאי לראות. */
export type CollectionTripSource = "session" | "trippy_ai" | "trip";

export interface CollectionTripItemDto {
  id: string;
  kind: "trip";
  position: number;
  note: string | null;
  trip: {
    source: CollectionTripSource;
    id: string;
    title: string;
    imageUrl: string | null;
    stopCount: number;
    /** יעד הניווט. null = לצופה שאינו הבעלים אין כרגע דף צפייה ציבורי בטיול (ר' הערה ב-collectionService). */
    href: string | null;
    /** *** תוספת (בקשה מפורשת - "עמוד עם מפה ונעצים בכל המקומות"): נקודות המסלול של הטיול לפי הסדר
     *  (רק תחנות עם מיקום) - כדי לצייר את כל הטיולים של החוויה על מפה אחת. אופציונלי: מקור בלי
     *  מיקומים פשוט לא מצויר, והכרטיס שלו עדיין מוצג. */
    route?: CollectionRoutePoint[];
  };
}

export type CollectionItemDto = CollectionPlaceItemDto | CollectionTripItemDto;

export interface CollectionRoutePoint {
  latitude: number;
  longitude: number;
}

export interface CollectionDetailDto extends CollectionCardDto {
  items: CollectionItemDto[];
}

/** פריט בקלט של יצירה/עריכה. refId = places.id או מזהה הטיול (לפי tripSource). */
export interface CollectionItemInput {
  kind: "place" | "trip";
  refId: string;
  tripSource?: CollectionTripSource;
  note?: string | null;
}

export interface SaveCollectionInput {
  title: string;
  description: string | null;
  coverUrl: string | null;
  visibility: CollectionVisibility;
  items: CollectionItemInput[];
}

/** פריט בפיד: פוסט, אוסף או טיול. ממוין לפי createdAt של ה-item. */
export type FeedEntryDto =
  | { kind: "post"; item: FeedItemDto }
  | { kind: "collection"; item: CollectionCardDto }
  | { kind: "trip"; item: TripCardDto };
