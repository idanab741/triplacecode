"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
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

// עד 10 טיולים בתצוגה המקדימה בעמוד הבית - "לכל הטיולים" מוביל לרשימה
// המלאה בלי הגבלה. לא 2 בלבד יותר - עכשיו יש בכלל למה לגלול.
const PREVIEW_LIMIT = 10;

/** מקטע "הטיולים שלי" בעמוד הבית - אם אין אף טיול, כרטיס הזמנה ברוחב מלא
 *  (זהה בדיוק לרוחב של "גלה עוד" למעלה). אם יש טיולים - קרוסלה גוללת עם
 *  Embla (**אותה** ספרייה בדיוקה שכבר עובדת נכון ב-RTL ב"מותאם בשבילך"
 *  למעלה) - לא מנגנון גלילה עצמאי, כדי לא לחזור על אותו באג שוליים. */
export function MyTripsSection() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripPreview[] | null>(null);
  const [emblaRef] = useEmblaCarousel({
    direction: "rtl",
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

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

      {trips !== null && trips.length === 0 && (
        // כרטיס ברוחב מלא, זהה בדיוק ל"גלה עוד" למעלה (אותו px-6, בלי
        // הגבלת רוחב נוספת) - מוצג **רק** כשבאמת אין אף טיול.
        <div className="px-6">
          <button
            type="button"
            onClick={() => router.push("/trip-builder/build")}
            className="relative h-44 w-full overflow-hidden rounded-card"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/cta-no-trips.png"
              alt="אין לכם עוד טיול? לחצו כאן"
              className="absolute inset-0 h-full w-full object-contain"
            />
          </button>
        </div>
      )}

      {trips === null && (
        <div className="px-6">
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
      )}

      {trips !== null && trips.length > 0 && (
        // -mx-6/px-6 + ref={emblaRef} - בדיוק אותו trick שכבר עובד נכון
        // ב-HotDestinations. Embla מנהל את הגלילה/ה-RTL בעצמו - לא אנחנו.
        <div className="overflow-hidden px-6" ref={emblaRef}>
          <div className="flex">
            {trips.map((trip) => (
              <div
                key={trip.sessionId}
                className="min-w-0 shrink-0 grow-0"
                style={{ flexBasis: "45%", marginInlineEnd: 12 }}
              >
                <button
                  type="button"
                  onClick={() => router.push(tripResultPath(trip.tripType, trip.sessionId))}
                  className="flex h-32 w-full flex-col overflow-hidden rounded-card bg-white text-right shadow-soft"
                >
                  {trip.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={trip.imageUrl} alt={trip.destinationLabel} className="h-20 w-full object-cover" />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center bg-bg-secondary text-xl">🧳</div>
                  )}
                  <div className="p-2">
                    <p className="truncate text-xs font-bold text-ink">{trip.destinationLabel}</p>
                    <p className="mt-0.5 text-[10px] text-ink-secondary">{trip.stopCount} תחנות</p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
