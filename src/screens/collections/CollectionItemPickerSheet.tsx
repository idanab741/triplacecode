"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { searchPlaces, type PlaceSearchResult } from "@/services/places/searchService";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import type { CollectionType } from "@/services/social/collectionTypes";
import { formItemKey, type CollectionFormItem } from "./collectionFormTypes";

interface CollectionItemPickerSheetProps {
  type: CollectionType;
  /** מפתחות (formItemKey) של פריטים שכבר באוסף - מסומנים "נוסף". */
  addedKeys: Set<string>;
  onAdd: (item: CollectionFormItem) => void;
  onClose: () => void;
  /** אוסף מקומות: אם המקום לא קיים - יוצאים לזרימת "הוספת מקום" הקיימת (לא יוצרים Place מתוך האוסף). */
  onGoAddPlace?: () => void;
}

interface TripOption {
  key: string;
  source: "session" | "trippy_ai";
  id: string;
  title: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
}

function rowClass(added: boolean) {
  return `flex w-full items-center gap-3 rounded-card px-2 py-2.5 text-start ${added ? "opacity-60" : "hover:bg-bg-secondary"}`;
}

function Thumb({ url }: { url: string | null }) {
  return (
    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </span>
  );
}

function AddedMark({ added }: { added: boolean }) {
  return added ? (
    <span className="shrink-0 text-[12px] font-bold" style={{ color: "var(--color-places-purple)" }}>
      ✓ נוסף
    </span>
  ) : (
    <span className="shrink-0 text-[20px] font-bold leading-none" style={{ color: "var(--color-places-purple)" }}>
      +
    </span>
  );
}

/** "מה תרצו להוסיף?" - בוחר פריט *קיים* בלבד: מקום מתוך TRIPLACE (אותו חיפוש כמו בשאר הזרימות),
 *  או טיול שמור מ"הטיולים שלי" (אותם שני endpoints). ה-Sheet נשאר פתוח כדי להוסיף כמה פריטים ברצף. */
export function CollectionItemPickerSheet({ type, addedKeys, onAdd, onClose, onGoAddPlace }: CollectionItemPickerSheetProps) {
  const [query, setQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [trips, setTrips] = useState<TripOption[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handlePlaceQuery(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (value.trim().length < 2) {
      setPlaceResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        setPlaceResults(
          await searchPlaces({ query: value.trim(), categories: [], minRating: null, maxPriceLevel: null, kosher: false, accessible: false }, 0, 15)
        );
      } catch {
        setPlaceResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  useEffect(() => {
    if (type !== "trips") return;
    // ברירת המחדל של שני ה-endpoints היא "שמורים בלבד" - וזה בדיוק מה שמותר להוסיף לאוסף.
    Promise.all([
      fetch("/api/trip-builder/sessions/saved").then((r) => r.json()).catch(() => ({ trips: [] })),
      fetch("/api/trippy-ai").then((r) => r.json()).catch(() => ({ results: [] })),
    ]).then(([sessionsData, trippyData]) => {
      const fromSessions: TripOption[] = (sessionsData.trips ?? []).map(
        (t: { sessionId: string; destinationLabel: string; imageUrl: string | null; stopCount: number; createdAt: string }) => ({
          key: formItemKey("trip", t.sessionId, "session"),
          source: "session" as const,
          id: t.sessionId,
          title: t.destinationLabel,
          imageUrl: t.imageUrl,
          stopCount: t.stopCount,
          createdAt: t.createdAt,
        })
      );
      const fromTrippy: TripOption[] = (trippyData.results ?? []).map(
        (r: { id: string; title: string; imageUrl: string | null; stopCount: number; createdAt: string }) => ({
          key: formItemKey("trip", r.id, "trippy_ai"),
          source: "trippy_ai" as const,
          id: r.id,
          title: r.title,
          imageUrl: r.imageUrl,
          stopCount: r.stopCount,
          createdAt: r.createdAt,
        })
      );
      setTrips([...fromSessions, ...fromTrippy].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    });
  }, [type]);

  const filteredTrips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (trips ?? []).filter((t) => !q || t.title.toLowerCase().includes(q));
  }, [trips, query]);

  return (
    <BottomSheet onClose={onClose}>
      <div className="max-h-[80vh] overflow-y-auto px-5 pb-4">
        <h2 className="mb-3 text-[17px] font-bold text-ink">מה תרצו להוסיף?</h2>
        <input
          autoFocus
          value={query}
          onChange={(e) => (type === "places" ? handlePlaceQuery(e.target.value) : setQuery(e.target.value))}
          placeholder={type === "places" ? "חפשו מקום..." : "חפשו טיול..."}
          className="mb-3 w-full rounded-pill border border-ink-secondary/20 px-4 py-2.5 text-[14px] focus:outline-none"
        />

        {type === "places" && (
          <>
            {searching && <p className="py-4 text-center text-[12.5px] text-ink-secondary">מחפש...</p>}
            {!searching &&
              placeResults?.map((place) => {
                const key = formItemKey("place", place.id);
                const added = addedKeys.has(key);
                return (
                  <button
                    key={place.id}
                    type="button"
                    disabled={added}
                    onClick={() =>
                      onAdd({
                        key,
                        kind: "place",
                        refId: place.id,
                        title: place.name,
                        subtitle: [getPlaceCategoryLabel(place.category), place.city].filter(Boolean).join(" · ") || null,
                        imageUrl: place.image_urls?.[0] ?? null,
                        note: "",
                      })
                    }
                    className={rowClass(added)}
                  >
                    <Thumb url={place.image_urls?.[0] ?? null} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-ink">{place.name}</span>
                      <span className="block truncate text-[12px] text-ink-secondary">
                        {[getPlaceCategoryLabel(place.category), place.city].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <AddedMark added={added} />
                  </button>
                );
              })}
            {placeResults !== null && !searching && placeResults.length === 0 && (
              <p className="py-4 text-center text-[12.5px] text-ink-secondary">לא מצאנו מקום כזה</p>
            )}
            {onGoAddPlace && (
              <button
                type="button"
                onClick={onGoAddPlace}
                className="mt-3 w-full rounded-pill border py-2.5 text-[13px] font-bold"
                style={{ borderColor: "var(--color-places-purple)", color: "var(--color-places-purple)" }}
              >
                לא מוצאים את המקום? הוסיפו אותו ל־TRIPLACE
              </button>
            )}
          </>
        )}

        {type === "trips" && (
          <>
            {trips === null && <p className="py-4 text-center text-[12.5px] text-ink-secondary">טוען את הטיולים שלכם...</p>}
            {trips !== null && trips.length === 0 && (
              <p className="py-4 text-center text-[12.5px] text-ink-secondary">
                אין לכם עדיין טיולים שמורים. שמרו טיול ב&quot;הבחירות שלי&quot; ואז תוכלו להוסיף אותו לאוסף.
              </p>
            )}
            {trips !== null && trips.length > 0 && filteredTrips.length === 0 && (
              <p className="py-4 text-center text-[12.5px] text-ink-secondary">לא נמצא טיול כזה</p>
            )}
            {filteredTrips.map((trip) => {
              const added = addedKeys.has(trip.key);
              return (
                <button
                  key={trip.key}
                  type="button"
                  disabled={added}
                  onClick={() =>
                    onAdd({
                      key: trip.key,
                      kind: "trip",
                      refId: trip.id,
                      tripSource: trip.source,
                      title: trip.title,
                      subtitle: `${trip.stopCount} תחנות`,
                      imageUrl: trip.imageUrl,
                      note: "",
                    })
                  }
                  className={rowClass(added)}
                >
                  <Thumb url={trip.imageUrl} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-ink">{trip.title}</span>
                    <span className="block text-[12px] text-ink-secondary">{trip.stopCount} תחנות</span>
                  </span>
                  <AddedMark added={added} />
                </button>
              );
            })}
          </>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full rounded-pill py-3 text-[14px] font-bold text-white" style={{ background: "var(--color-places-purple)" }}>
          סיום
        </button>
      </div>
    </BottomSheet>
  );
}
