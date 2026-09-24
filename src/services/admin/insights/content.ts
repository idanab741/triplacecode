import { type Db, type RangeKey, periodFor, buildBuckets, seriesCount, inCurrent, topCounts, countRows } from "./core";
import { loadPlaces } from "./health";
import { PLACE_CATEGORIES, isValidPlaceCategory, getPlaceCategoryLabel } from "@/constants/placeCategories";
import { PLACE_SOURCE_LABELS, label } from "./labels";

export async function buildContent(db: Db, range: RangeKey) {
  const p = periodFor(range);
  const b = buildBuckets(p);
  const places = await loadPlaces(db);
  const active = places.filter((x) => !x.is_legacy);

  const [destinations, hotDestinations, editions, publishedEditions, taxonomy, fieldDefs, reviews, favorites] = await Promise.all([
    countRows(db, "destinations"),
    countRows(db, "destinations", (q) => q.eq("is_hot_destination", true)),
    countRows(db, "destination_editions"),
    countRows(db, "destination_editions", (q) => q.eq("is_published", true)),
    countRows(db, "taxonomy_terms", (q) => q.eq("is_active", true)),
    countRows(db, "place_type_field_defs", (q) => q.eq("is_active", true)),
    countRows(db, "place_reviews"),
    countRows(db, "favorites"),
  ]);

  const byCategory = [
    ...PLACE_CATEGORIES.map((c) => ({ key: c.key, label: c.label, value: active.filter((x) => x.category === c.key).length })),
    { key: "invalid", label: "לא תקני", value: active.filter((x) => !x.category || !isValidPlaceCategory(x.category)).length },
  ].filter((x) => x.value > 0);

  const ratingBands = [
    { label: "4.5+", min: 4.5, max: 6 },
    { label: "4.0–4.4", min: 4, max: 4.5 },
    { label: "3.5–3.9", min: 3.5, max: 4 },
    { label: "מתחת 3.5", min: 0, max: 3.5 },
  ].map((band) => ({ label: band.label, value: active.filter((x) => x.rating != null && x.rating >= band.min && x.rating < band.max).length }));

  const addedCur = places.filter((x) => inCurrent(p, x.created_at));

  return {
    range,
    generatedAt: new Date().toISOString(),
    totals: {
      places: places.length,
      active: active.length,
      legacy: places.length - active.length,
      addedThisPeriod: addedCur.length,
      destinations: destinations ?? 0,
      hotDestinations: hotDestinations ?? 0,
      editions: editions ?? 0,
      publishedEditions: publishedEditions ?? 0,
      taxonomyTerms: taxonomy ?? 0,
      fieldDefs: fieldDefs ?? 0,
      reviews: reviews ?? 0,
      favorites: favorites ?? 0,
    },
    byCategory,
    bySource: topCounts(active.map((x) => x.source), 10).map((x) => ({ ...x, label: label(PLACE_SOURCE_LABELS, x.label) })),
    byCountry: topCounts(active.map((x) => x.country || "ללא מדינה"), 12),
    byCity: topCounts(active.map((x) => x.city), 12),
    invalidCategories: topCounts(
      active.filter((x) => x.category && !isValidPlaceCategory(x.category)).map((x) => x.category),
      12
    ).map((x) => ({ ...x, label: getPlaceCategoryLabel(x.label) })),
    ratingBands,
    added: {
      labels: b.labels,
      series: [
        { key: "all", label: "מקומות שנוספו", values: seriesCount(b, places.map((x) => x.created_at)) },
      ],
      bySource: topCounts(addedCur.map((x) => x.source), 6).map((x) => ({ ...x, label: label(PLACE_SOURCE_LABELS, x.label) })),
    },
  };
}

export type ContentData = Awaited<ReturnType<typeof buildContent>>;
