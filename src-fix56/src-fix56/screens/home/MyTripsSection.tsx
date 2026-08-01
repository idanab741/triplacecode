"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";

interface TripPreview {
  sessionId: string;
  tripType: string;
  destinationLabel: string;
  imageUrl: string | null;
  stopCount: number;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

function tripResultPath(tripType: string, sessionId: string): string {
  const routeSegment = TRIP_TYPE_ROUTE[tripType] ?? tripType.replace(/_/g, "-");
  return `/trip-builder/${routeSegment}/result?sessionId=${sessionId}`;
}

const PREVIEW_LIMIT = 2;

/** מקטע "הטיולים שלי" בעמוד הבית - שורה אחת שאפשר לגרור ימינה/שמאלה: קודם
 *  "שבלונה" קבועה (הזמנה לבנות עוד טיול, ברוחב של שני מלבנים), ואז עד שני
 *  הטיולים האחרונים שנבנו בפועל. לא רשת קבועה - שורה גוללת, כדי שלא יתפוס
 *  יותר מדי גובה בעמוד הבית. */
export function MyTripsSection() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripPreview[] | null>(null);

  useEffect(() => {
    fetch(`/api/trip-builder/sessions/saved?all=true&limit=${PREVIEW_LIMIT}`)
      .then((res) => res.json())
      .then((data) => setTrips(data.trips ?? []))
      .catch(() => setTrips([]));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-6">
        <h3 className="text-lg font-semibold tracking-tight text-ink">הטיולים שלי</h3>
        {trips && trips.length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/trips?filter=all")}
            className="text-sm font-medium text-accent"
          >
            לכל הטיולים
          </button>
        )}
      </div>

      {/* שורה גוללת (לא רשת) - אותו שוליים בדיוק כמו שאר המקטעים בעמוד הבית
          (px-6, כמו ב"גלה עוד" וב"מותאם בשבילך"), עם אותו trick של -mx-6/px-6
          שכבר עובד נכון ב-HotDestinations. dir="rtl" מפורש על אלמנט הגלילה
          עצמו - בלעדיו, דפדפנים נוטים "לשכוח" איזה צד הוא ההתחלה בגלילה
          אופקית. הכרטיס "אין לכם עוד טיול" מוצג **תמיד** כראשון בשורה - גם
          כשיש טיולים שמורים - כדי שאפשר יהיה לראות/לבדוק אותו תמיד. */}
      <div className="-mx-6 overflow-hidden px-6">
        <div dir="rtl" className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => router.push("/trip-builder/build")}
            className="relative h-44 w-[92%] shrink-0 snap-start overflow-hidden rounded-card"
          >
            {/* img רגיל - בדיוק כמו התמונות של כרטיסי הטיולים למטה - לא
                next/image עם fill, כדי שההתנהגות תהיה זהה לגמרי ביניהם. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/cta-no-trips.png"
              alt="אין לכם עוד טיול? לחצו כאן"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </button>

          {trips === null
            ? [0, 1].map((i) => <Skeleton key={i} className="h-44 w-[45%] shrink-0 snap-start rounded-card" />)
            : trips.map((trip) => (
                <button
                  key={trip.sessionId}
                  type="button"
                  onClick={() => router.push(tripResultPath(trip.tripType, trip.sessionId))}
                  className="flex h-44 w-[45%] shrink-0 snap-start flex-col overflow-hidden rounded-card bg-white text-right shadow-soft transition active:scale-[0.98]"
                >
                  {trip.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-28 w-full object-cover" />
                  ) : (
                    <div className="flex h-28 w-full items-center justify-center bg-bg-secondary text-xl">🧳</div>
                  )}
                  <div className="p-2">
                    <p className="truncate text-xs font-bold text-ink">{trip.destinationLabel}</p>
                    <p className="mt-0.5 text-[10px] text-ink-secondary">{trip.stopCount} תחנות</p>
                  </div>
                </button>
              ))}
        </div>
      </div>
    </div>
  );
}
