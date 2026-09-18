"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoritePlaces, toggleFavorite } from "@/services/favorites/favoritesService";
import type { UnifiedPlace } from "@/services/places/unifiedPlaceService";
import { Screen, Skeleton, Button, SwipeToDeleteRow } from "@/components/ui";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { RetentionInfoModal } from "@/screens/trips/RetentionInfoModal";
import { getDaysRemainingBeforeRemoval } from "@/constants/contentRetention";

/**
 * *** תיקון אדריכלי (ר' migration 0057/0064 - trippy_ai_results):
 * עד עכשיו העמוד הזה שלף רק מ-trip_builder_sessions - תוצאות trippy AI
 * (הצ'אט המהיר) לא הופיעו כאן בכלל, למרות שהן כן מופיעות ב"הטיולים
 * שלי" בעמוד הבית (MyTripsSection.tsx). עכשיו מאחדים את שני המקורות
 * גם כאן, באותו דפוס בדיוק - שני fetch נפרדים, לא מעורבבים ב-DB, רק
 * בתצוגה, עם דגל isTrippyAi שמבדיל בין הכרטיסים בזמן ניווט/מחיקה/שמירה.
 */
interface SessionTrip {
  id: string;
  source: "session";
  tripType: string;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  isSaved: boolean;
}

interface TrippyAiTrip {
  id: string;
  source: "trippy_ai";
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  isSaved: boolean;
}

type ChoiceItem = SessionTrip | TrippyAiTrip;

type Tab = "all" | "saved" | "attractions";

const TAB_LABELS: Record<Tab, string> = {
  all: "כל הבחירות",
  saved: "שמורים",
  // *** תיקון (בקשה מפורשת - "במקום לשונית לייקים - לשנות לאטרקציות"):
  // רק שינוי תווית - הלוגיקה מתחתיה (getFavoritePlaces עם source
  // "tripmatch") לא השתנתה, זו עדיין אותה רשימת "לייקים" ב-TripMatch,
  // רק עם שם מדויק יותר למה שבאמת מוצג שם (אטרקציות, לא מקומות/מסעדות
  // מכל סוג).
  attractions: "אטרקציות",
};

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

function tripResultPath(trip: ChoiceItem): string {
  if (trip.source === "trippy_ai") return `/trip-builder/trippy-quick/result?savedId=${trip.id}`;
  const routeSegment = TRIP_TYPE_ROUTE[trip.tripType] ?? trip.tripType.replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${trip.id}`;
}

function deleteTripPath(trip: ChoiceItem): string {
  return trip.source === "trippy_ai" ? `/api/trippy-ai/${trip.id}` : `/api/trip-builder/sessions/${trip.id}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

/** תווית המקור (badge) של הכרטיס - "tripmatch"/"trippy AI" - בנוסף
 *  לתאריך, לא במקומו (ר' בקשה מפורשת - "להוסיף תאריכים... לא להחליף"). */
function sourceBadgeLabel(trip: ChoiceItem): string | null {
  if (trip.source === "trippy_ai") return "trippy AI";
  if (trip.tripType === "tripmatch") return "tripmatch";
  return null;
}

const RETENTION_POPUP_SEEN_KEY = "trips_retention_popup_seen_v1";

export default function TripsPage() {
  return (
    <Suspense>
      <TripsPageContent />
    </Suspense>
  );
}

function TripsPageContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");

  const [trips, setTrips] = useState<ChoiceItem[] | null>(null);
  const [places, setPlaces] = useState<UnifiedPlace[] | null>(null);
  // *** תוספת (בקשה מפורשת - "שמירה צריך להופיע בעמוד השמירה!!
  // אטרקציות צריכות להופיע רק בהחלקה ימינה ב-TripMatch!!"): שתי
  // פעולות שונות לגמרי, בכוונה לא מעורבבות: "שמור" (❤️ בעמוד אטרקציה/
  // תוצאת חיפוש - status="saved", בלי source) שייך ללשונית "שמורים"
  // כאן, ליד טיולים שמורים - לא ללשונית "אטרקציות" (ששייכת אך ורק
  // ל"לייק" בהחלקה ימינה ב-TripMatch, status="liked"+source="tripmatch",
  // ר' places state למעלה). savedPlaces הוא state נפרד מ-places בכוונה.
  const [savedPlaces, setSavedPlaces] = useState<UnifiedPlace[] | null>(null);
  const [showRetentionInfo, setShowRetentionInfo] = useState(false);

  useEffect(() => {
    if (!user || tab === "attractions") return;
    setTrips(null);
    const savedOnly = tab === "saved";

    Promise.all([
      fetch(`/api/trip-builder/sessions/saved${savedOnly ? "" : "?all=true"}`)
        .then((res) => res.json())
        .catch(() => ({ trips: [] })),
      fetch(`/api/trippy-ai${savedOnly ? "" : "?all=true"}`)
        .then((res) => res.json())
        .catch(() => ({ results: [] })),
    ]).then(([sessionsData, trippyAiData]) => {
      const fromSessions: ChoiceItem[] = (sessionsData.trips ?? []).map(
        (t: { sessionId: string; tripType: string; destinationLabel: string; imageUrl: string | null; stopCount: number; createdAt: string; isSaved?: boolean }) => ({
          id: t.sessionId,
          source: "session" as const,
          tripType: t.tripType,
          destinationLabel: t.destinationLabel,
          imageUrl: t.imageUrl,
          stopCount: t.stopCount,
          createdAt: t.createdAt,
          isSaved: t.isSaved === true,
        })
      );
      const fromTrippyAi: ChoiceItem[] = (trippyAiData.results ?? []).map(
        (r: { id: string; title: string; imageUrl: string | null; stopCount: number; createdAt: string; isSaved?: boolean }) => ({
          id: r.id,
          source: "trippy_ai" as const,
          destinationLabel: r.title,
          imageUrl: r.imageUrl,
          stopCount: r.stopCount,
          createdAt: r.createdAt,
          isSaved: r.isSaved === true,
        })
      );
      const merged = [...fromSessions, ...fromTrippyAi].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setTrips(merged);
    });
  }, [user, tab]);

  useEffect(() => {
    if (!user || tab !== "attractions") return;
    setPlaces(null);
    // *** תיקון: getFavoritePlaces בלי סינון מקור החזירה כל לייק בכל
    // האפליקציה (גם מבניית מסלולים, לא רק TripMatch) - הלשונית הזו
    // אמורה להציג רק לייקים שנעשו ב-TripMatch עצמו.
    getFavoritePlaces(user.id, "liked", "tripmatch")
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, [user, tab]);

  useEffect(() => {
    if (!user || tab !== "saved") return;
    setSavedPlaces(null);
    // *** תוספת (בקשה מפורשת - ר' הערה ליד savedPlaces state למעלה):
    // status="saved" בלבד, בלי סינון source - תופס גם שמירה מ"תפתיע
    // אותי", גם מעמוד תוצאת חיפוש, גם מכל מקום עתידי אחר שישתמש
    // באותה פעולת "שמור" גנרית (בניגוד ל"אטרקציות", שמסננת במפורש
    // source="tripmatch" בלבד).
    getFavoritePlaces(user.id, "saved")
      .then(setSavedPlaces)
      .catch(() => setSavedPlaces([]));
  }, [user, tab]);

  // *** תוספת (בקשה מפורשת - Popup): מוצג פעם אחת בלבד (localStorage),
  // ורק אחרי שהרשימה הראשונה (לשונית "כל הבחירות", ברירת המחדל) כבר
  // נטענה - כדי שהמידע הדינמי (nearestExpiringDays, ר' למטה) יהיה
  // מדויק כבר בפעם הראשונה שהמשתמש רואה את ה-Popup, לא ריק/מוערך.
  useEffect(() => {
    if (tab !== "all" || trips === null) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(RETENTION_POPUP_SEEN_KEY)) return;
    setShowRetentionInfo(true);
  }, [tab, trips]);

  function handleCloseRetentionInfo() {
    setShowRetentionInfo(false);
    window.localStorage.setItem(RETENTION_POPUP_SEEN_KEY, "true");
  }

  // *** תוספת - ר' RetentionInfoModal.tsx: הזמן שנשאר לבחירה הזמנית
  // (לא-שמורה) הכי ותיקה - null אם כרגע אין אף בחירה זמנית (הכל כבר
  // שמור, או שהרשימה עדיין ריקה). מחושב מכל הרשימה שכבר בזיכרון (tab
  // "כל הבחירות") - לא קריאת רשת נוספת.
  const unsavedTrips = (trips ?? []).filter((t) => !t.isSaved);
  const nearestExpiringDays =
    unsavedTrips.length > 0 ? Math.min(...unsavedTrips.map((t) => getDaysRemainingBeforeRemoval(t.createdAt))) : null;

  async function handleDeleteTrip(trip: ChoiceItem) {
    setTrips((prev) => (prev ? prev.filter((t) => !(t.source === trip.source && t.id === trip.id)) : prev));
    await fetch(deleteTripPath(trip), { method: "DELETE" }).catch(() => {});
  }

  async function handleUnlikePlace(placeId: string) {
    setPlaces((prev) => (prev ? prev.filter((p) => p.id !== placeId) : prev));
    if (!user) return;
    const supabase = createClient();
    await toggleFavorite(supabase, user.id, placeId, "place", "liked").catch(() => {});
  }

  async function handleUnsavePlace(placeId: string) {
    setSavedPlaces((prev) => (prev ? prev.filter((p) => p.id !== placeId) : prev));
    if (!user) return;
    const supabase = createClient();
    await toggleFavorite(supabase, user.id, placeId, "place", "saved").catch(() => {});
  }

  const tripEmptyMessage =
    tab === "all"
      ? "עוד לא בנית אף בחירה - כשתבנו טיול או מסלול, הוא יופיע כאן."
      : 'עוד לא שמרת אף בחירה - כשתבנו מסלול ותשמרו אותו (בעזרת כפתור ה"שמור"), הוא יופיע כאן.';

  // *** בלשונית "שמורים" יש שני מקורות שונים (טיולים שמורים + אטרקציות
  // שמורות) - "ריק" אמיתי הוא רק כששניהם ריקים, לא רק trips. ר' הערה
  // ליד savedPlaces state למעלה.
  const isSavedTabLoading = tab === "saved" && (loading || trips === null || savedPlaces === null);
  const isSavedTabEmpty = tab === "saved" && (trips?.length ?? 0) === 0 && (savedPlaces?.length ?? 0) === 0;

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <SimpleAppHeader onBack={() => router.push("/home")} title="הבחירות שלי" />

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        <div className="flex rounded-pill bg-bg-secondary p-1">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-pill py-2 text-sm font-semibold transition-colors ${
                tab === t
                  ? "bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] text-white"
                  : "text-ink-secondary"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab !== "attractions" ? (
          (tab === "saved" ? isSavedTabLoading : loading || trips === null) ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-card" />
              ))}
            </div>
          ) : (tab === "saved" ? isSavedTabEmpty : (trips?.length ?? 0) === 0) ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-ink-secondary">{tripEmptyMessage}</p>
              <Button href="/home">לדף הבית</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {(trips ?? []).map((trip) => {
                const badge = sourceBadgeLabel(trip);
                const daysRemaining = trip.isSaved ? null : getDaysRemainingBeforeRemoval(trip.createdAt);
                return (
                  <SwipeToDeleteRow key={`${trip.source}-${trip.id}`} resetKey={tab} onDelete={() => handleDeleteTrip(trip)}>
                    <button
                      type="button"
                      onClick={() => router.push(tripResultPath(trip))}
                      className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-bg-secondary p-3 text-right"
                    >
                      {trip.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">🧳</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-ink">{trip.destinationLabel}</p>
                        {/* *** תיקון (בקשה מפורשת - "להוסיף תאריכים בכרטיסיות
                            של tripmatch ו-trippy AI"): התאריך מוצג תמיד
                            עכשיו, גם כשיש badge מקור (tripmatch/trippy AI) -
                            לפני כן badge כזה "הסתיר" את התאריך לגמרי. */}
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-secondary">
                          {badge && <span className="font-semibold text-accent">{badge}</span>}
                          <span>
                            {trip.source === "session" ? `${trip.stopCount} תחנות · ` : ""}
                            נוצר ב-{formatDate(trip.createdAt)}
                          </span>
                        </p>
                        {/* *** תוספת (בקשה מפורשת - "לוודא שהיא מוגדרת
                            כזמנית"): צ'יפ קטן על בחירות לא-שמורות, עם
                            ספירת ימים דינמית (לא "14 יום" קבוע). */}
                        {daysRemaining != null && (
                          <p className="mt-1 inline-block rounded-pill bg-[var(--color-primary-start)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary-start)]">
                            {daysRemaining === 0 ? "אחרון היום - שמרו כדי לא לאבד" : `זמני · יישמר עוד ${daysRemaining} ${daysRemaining === 1 ? "יום" : "ימים"}`}
                          </p>
                        )}
                      </div>
                    </button>
                  </SwipeToDeleteRow>
                );
              })}

              {/* *** תוספת (בקשה מפורשת - "שמירה צריך להופיע בעמוד
                  השמירה!!"): אטרקציות בודדות ששמרו (❤️ בעמוד אטרקציה/
                  תוצאת חיפוש, status="saved") - מתחת לטיולים השמורים,
                  לא מעורבב באותה רשימה (צורות כרטיס/ניווט/מחיקה שונות),
                  אבל כן באותה לשונית "שמורים" בדיוק כמו שהתבקש. */}
              {tab === "saved" && savedPlaces && savedPlaces.length > 0 && (
                <>
                  <p className="mt-2 text-sm font-bold text-ink">אטרקציות שמורות</p>
                  {savedPlaces.map((place) => (
                    <SwipeToDeleteRow key={place.id} resetKey={tab} onDelete={() => handleUnsavePlace(place.id)}>
                      <button
                        type="button"
                        onClick={() => router.push(place.type === "destination" ? `/destination/${place.id}` : `/place/${place.id}`)}
                        className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-bg-secondary p-3 text-right"
                      >
                        {place.imageUrls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={place.imageUrls[0]} alt={place.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">📍</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-bold text-ink">{place.name}</p>
                          <p className="mt-0.5 truncate text-xs text-ink-secondary">
                            {[place.subcategory, place.category, place.city].filter(Boolean)[0]}
                            {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                          </p>
                        </div>
                      </button>
                    </SwipeToDeleteRow>
                  ))}
                </>
              )}
            </div>
          )
        ) : loading || places === null ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-ink-secondary">עוד לא סימנת לייק לאף אטרקציה ב-TripMatch - צאו לגלות!</p>
            <Button href="/tripmatch">ל-TripMatch</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {places.map((place) => (
              <SwipeToDeleteRow key={place.id} resetKey={tab} onDelete={() => handleUnlikePlace(place.id)}>
                <button
                  type="button"
                  onClick={() => router.push(place.type === "destination" ? `/destination/${place.id}` : `/place/${place.id}`)}
                  className="flex w-full items-center gap-3 overflow-hidden rounded-card bg-bg-secondary p-3 text-right"
                >
                  {place.imageUrls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={place.imageUrls[0]} alt={place.name} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl">📍</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold text-ink">{place.name}</p>
                    <p className="mt-0.5 truncate text-xs text-ink-secondary">
                      {[place.subcategory, place.category, place.city].filter(Boolean)[0]}
                      {place.rating != null && ` · ⭐ ${place.rating.toFixed(1)}`}
                    </p>
                  </div>
                </button>
              </SwipeToDeleteRow>
            ))}
          </div>
        )}
      </div>

      {showRetentionInfo && (
        <RetentionInfoModal onClose={handleCloseRetentionInfo} nearestExpiringDays={nearestExpiringDays} />
      )}

      <MainBottomNav active="profile" />
    </Screen>
  );
}
