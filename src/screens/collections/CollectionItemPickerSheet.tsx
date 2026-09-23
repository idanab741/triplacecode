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
  /** כותרת/Placeholder מותאמים (למשל בעמוד יצירת טיול: "חפשו מקום להוסיף לטיול"). */
  heading?: string;
  placeholder?: string;
  /** *** תוספת (בקשה מפורשת): כשהאוסף נוצר מתוך עמוד "תוכן" השחור - הפופאפ הזה כהה
   *  גם הוא, כדי להתאים לזרימה. ברירת מחדל false - שימושים אחרים (TripForm וכו') זהים לקודם. */
  dark?: boolean;
}

interface TripOption {
  key: string;
  source: "session" | "trippy_ai" | "trip";
  id: string;
  title: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  /** תווית קטנה לזיהוי המקור. */
  tag: string | null;
}

function rowClass(added: boolean, dark: boolean) {
  const hover = dark ? "hover:bg-white/10" : "hover:bg-bg-secondary";
  return `flex w-full items-center gap-3 rounded-card px-2 py-2.5 text-start ${added ? "opacity-60" : hover}`;
}

function Thumb({ url, dark }: { url: string | null; dark: boolean }) {
  return (
    <span className={`h-12 w-12 shrink-0 overflow-hidden rounded-card ${dark ? "bg-white/10" : "bg-bg-secondary"}`}>
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
export function CollectionItemPickerSheet({ type, addedKeys, onAdd, onClose, onGoAddPlace, heading, placeholder, dark = false }: CollectionItemPickerSheetProps) {
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
    // מקורות: (1) טיולים (Trips) שיצרתי, (2) טיולים של אחרים ששמרתי, (3) תוצרי בניית-טיול שלי
    // (כולל טיולים שיצאו מ-TripMatch/"החלקות" ועדיין לא סומנו "שמור" במפורש - is_saved=false -
    // בדיוק כמו MyTripsSection בעמוד הבית ("הבחירות שלי"): all=true מחזיר גם אותם, לא רק
    // is_saved=true, כדי שכל הטיולים שלי יופיעו כאן, לא רק אלה ששמרתי בפירוש).
    Promise.all([
      fetch("/api/social/trips/mine").then((r) => r.json()).catch(() => ({ trips: [] })),
      fetch("/api/social/trips/saved").then((r) => r.json()).catch(() => ({ trips: [] })),
      fetch("/api/trip-builder/sessions/saved?all=true").then((r) => r.json()).catch(() => ({ trips: [] })),
      fetch("/api/trippy-ai?all=true").then((r) => r.json()).catch(() => ({ results: [] })),
    ]).then(([mineData, savedData, sessionsData, trippyData]) => {
      type SocialTrip = { id: string; title: string; coverUrl: string | null; autoCoverUrl: string | null; stopCount: number; createdAt: string };
      const toSocial = (t: SocialTrip, tag: string): TripOption => ({
        key: formItemKey("trip", t.id, "trip"),
        source: "trip",
        id: t.id,
        title: t.title,
        imageUrl: t.coverUrl ?? t.autoCoverUrl,
        stopCount: t.stopCount,
        createdAt: t.createdAt,
        tag,
      });
      const mine: TripOption[] = (mineData.trips ?? []).map((t: SocialTrip) => toSocial(t, "הטיול שלי"));
      const saved: TripOption[] = (savedData.trips ?? []).map((t: SocialTrip) => toSocial(t, "שמרתי"));
      const fromSessions: TripOption[] = (sessionsData.trips ?? []).map(
        (t: { sessionId: string; destinationLabel: string; imageUrl: string | null; stopCount: number; createdAt: string }) => ({
          key: formItemKey("trip", t.sessionId, "session"),
          source: "session" as const,
          id: t.sessionId,
          title: t.destinationLabel,
          imageUrl: t.imageUrl,
          stopCount: t.stopCount,
          createdAt: t.createdAt,
          tag: "מהבחירות שלי",
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
          tag: "מהבחירות שלי",
        })
      );
      const byDate = (a: TripOption, b: TripOption) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      // טיולים חברתיים קודם (מיון פנימי לפי תאריך), אחריהם הבחירות השמורות
      setTrips([...mine.sort(byDate), ...saved, ...[...fromSessions, ...fromTrippy].sort(byDate)]);
    });
  }, [type]);

  const filteredTrips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (trips ?? []).filter((t) => !q || t.title.toLowerCase().includes(q));
  }, [trips, query]);

  const textMain = dark ? "text-white" : "text-ink";
  const textSecondary = dark ? "text-white/55" : "text-ink-secondary";

  return (
    <BottomSheet onClose={onClose} dark={dark}>
      <div className="max-h-[80vh] overflow-y-auto px-5 pb-4">
        <h2 className={`mb-3 text-[17px] font-bold ${textMain}`}>{heading ?? "מה תרצו להוסיף?"}</h2>
        <input
          autoFocus
          value={query}
          onChange={(e) => (type === "places" ? handlePlaceQuery(e.target.value) : setQuery(e.target.value))}
          placeholder={placeholder ?? (type === "places" ? "חפשו מקום..." : "חפשו טיול...")}
          className={`mb-3 w-full rounded-pill border px-4 py-2.5 text-[14px] focus:outline-none ${
            dark ? "border-white/15 bg-white/10 text-white placeholder:text-white/40" : "border-ink-secondary/20"
          }`}
        />

        {type === "places" && (
          <>
            {searching && <p className={`py-4 text-center text-[12.5px] ${textSecondary}`}>מחפש...</p>}
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
                    className={rowClass(added, dark)}
                  >
                    <Thumb url={place.image_urls?.[0] ?? null} dark={dark} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14px] font-semibold ${textMain}`}>{place.name}</span>
                      <span className={`block truncate text-[12px] ${textSecondary}`}>
                        {[getPlaceCategoryLabel(place.category), place.city].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <AddedMark added={added} />
                  </button>
                );
              })}
            {placeResults !== null && !searching && placeResults.length === 0 && (
              <p className={`py-4 text-center text-[12.5px] ${textSecondary}`}>לא מצאנו מקום כזה</p>
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
            {trips === null && <p className={`py-4 text-center text-[12.5px] ${textSecondary}`}>טוען את הטיולים שלכם...</p>}
            {trips !== null && trips.length === 0 && (
              <p className={`py-4 text-center text-[12.5px] ${textSecondary}`}>
                אין עדיין טיולים להוסיף. צרו טיול, או שמרו טיול של מישהו אחר, ואז תוכלו להוסיף אותו כאן.
              </p>
            )}
            {trips !== null && trips.length > 0 && filteredTrips.length === 0 && (
              <p className={`py-4 text-center text-[12.5px] ${textSecondary}`}>לא נמצא טיול כזה</p>
            )}
            {/* *** תיקון (בקשה מפורשת - "עד 3 ברגע נתון, וכמובן גלילה למטה"): הרשימה עצמה מוגבלת
                לגובה קבוע של 3 שורות (68px לשורה - thumb 48px + ריפוד 10px מכל צד) - לא כל הרשימה
                (יכולה להכיל עשרות טיולים, ר' תל אביב-יפו כפולים) נפתחת בבת אחת. גלילה פנימית לשאר. */}
            {filteredTrips.length > 0 && (
              <div className="max-h-[204px] overflow-y-auto">
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
                      className={rowClass(added, dark)}
                    >
                      <Thumb url={trip.imageUrl} dark={dark} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[14px] font-semibold ${textMain}`}>{trip.title}</span>
                        <span className={`block text-[12px] ${textSecondary}`}>
                          {trip.stopCount} תחנות{trip.tag ? ` · ${trip.tag}` : ""}
                        </span>
                      </span>
                      <AddedMark added={added} />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        <button type="button" onClick={onClose} className="mt-4 w-full rounded-pill py-3 text-[14px] font-bold text-white" style={{ background: "var(--color-places-purple)" }}>
          סיום
        </button>
      </div>
    </BottomSheet>
  );
}
