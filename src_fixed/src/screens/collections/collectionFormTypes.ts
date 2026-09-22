import type { CollectionItemDto, CollectionItemInput, CollectionTripSource } from "@/services/social/collectionTypes";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";

/** פריט בטופס יצירה/עריכה - מה שצריך להציג (שם/תמונה) + מה ששולחים לשרת (kind/refId/note). */
export interface CollectionFormItem {
  /** מזהה יציב ברשימה: `${tripSource ?? "place"}:${refId}` - גם מונע כפילויות. */
  key: string;
  kind: "place" | "trip";
  refId: string;
  tripSource?: CollectionTripSource;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  note: string;
}

export function formItemKey(kind: "place" | "trip", refId: string, tripSource?: CollectionTripSource): string {
  return `${kind === "place" ? "place" : tripSource}:${refId}`;
}

export function formItemFromDto(dto: CollectionItemDto): CollectionFormItem {
  if (dto.kind === "place") {
    return {
      key: formItemKey("place", dto.place.id),
      kind: "place",
      refId: dto.place.id,
      title: dto.place.name,
      subtitle: [getPlaceCategoryLabel(dto.place.category), dto.place.city].filter(Boolean).join(" · ") || null,
      imageUrl: dto.place.imageUrls[0] ?? null,
      note: dto.note ?? "",
    };
  }
  return {
    key: formItemKey("trip", dto.trip.id, dto.trip.source),
    kind: "trip",
    refId: dto.trip.id,
    tripSource: dto.trip.source,
    title: dto.trip.title,
    subtitle: `${dto.trip.stopCount} תחנות`,
    imageUrl: dto.trip.imageUrl,
    note: dto.note ?? "",
  };
}

export function toItemInputs(items: CollectionFormItem[]): CollectionItemInput[] {
  return items.map((i) => ({ kind: i.kind, refId: i.refId, tripSource: i.tripSource, note: i.note.trim() || null }));
}
