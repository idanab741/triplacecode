/** טיפוסים משותפים (server + client) לטיולים (Trips) - ר' tripService.ts ו-migration 0090. */

import type { QuickCategoryId } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import type { CollectionAuthorDto } from "./collectionTypes";
import type { PostVisibility } from "./types";

/** סוג טיול = אותה טקסונומיה קיימת של "קטגוריות מהירות" (constants/quickCategories.ts) - לא מערכת חדשה. */
export type TripTypeId = QuickCategoryId;

export const TRIP_TYPE_IDS: TripTypeId[] = ["day_trip", "weekend", "nature_trip", "abroad", "romantic_date", "nightlife", "restaurants_cafes"];

export function isTripTypeId(value: unknown): value is TripTypeId {
  return typeof value === "string" && (TRIP_TYPE_IDS as string[]).includes(value);
}

export function getTripTypeLabel(id: TripTypeId): string {
  return QUICK_CATEGORY_LABELS[id];
}

export const TRIP_LIMITS = {
  minStops: 2,
  maxStops: 60,
  maxDays: 14,
  maxTitle: 80,
  maxDescription: 500,
  maxNote: 140,
} as const;

/** "5 תחנות · יום אחד" / "5 תחנות · 2 ימים" */
export function formatTripMeta(stopCount: number, dayCount: number): string {
  const stops = stopCount === 1 ? "תחנה אחת" : `${stopCount} תחנות`;
  const days = dayCount <= 1 ? "יום אחד" : `${dayCount} ימים`;
  return `${stops} · ${days}`;
}

/** מספר תחנה לתצוגה: 01, 02, ... */
export function formatStopNumber(position: number): string {
  return String(position + 1).padStart(2, "0");
}

export interface TripPlaceDto {
  id: string;
  name: string;
  category: string;
  city: string | null;
  rating: number | null;
  imageUrls: string[];
  latitude: number | null;
  longitude: number | null;
}

export interface TripStopDto {
  id: string;
  /** היום בטיול, מ-1. */
  day: number;
  /** הסדר בתוך היום, מ-0 (מספר התחנה לתצוגה = position + 1). */
  position: number;
  note: string | null;
  place: TripPlaceDto;
}

/** כל מה שצריך כדי להציג טיול כ-Card (Feed / פרופיל) וכ-Header של עמוד הטיול. */
export interface TripCardDto {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  visibility: PostVisibility;
  tripType: TripTypeId | null;
  author: CollectionAuthorDto;
  stopCount: number;
  dayCount: number;
  /** Cover שהיוצר בחר. null = Cover אוטומטי (autoCoverUrl). */
  coverUrl: string | null;
  /** תמונת התחנה הראשונה שיש לה תמונה - מדיה קיימת בלבד (לא נוצרת תמונה חדשה). */
  autoCoverUrl: string | null;
  /** 2-3 התחנות הראשונות ל-Preview ב-Trip Card בפיד. */
  previewStops: { name: string; category: string; imageUrl: string | null }[];
  stats: { likes: number; comments: number };
  viewerState: { liked: boolean; saved: boolean; isSelf: boolean };
}

export interface TripDetailDto extends TripCardDto {
  stops: TripStopDto[];
}

/** תחנה בקלט של יצירה/עריכה. */
export interface TripStopInput {
  placeId: string;
  note?: string | null;
}

/** יום בקלט: רשימה מסודרת של תחנות. ימים ריקים נזרקים והימים מתמספרים מחדש ברצף. */
export interface TripDayInput {
  stops: TripStopInput[];
}

export interface SaveTripInput {
  title: string;
  description: string | null;
  coverUrl: string | null;
  tripType: TripTypeId | null;
  visibility: PostVisibility;
  days: TripDayInput[];
}
