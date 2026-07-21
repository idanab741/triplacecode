"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Button, Screen } from "@/components/ui";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { FinalItinerary, TripBuilderSession } from "@/services/tripBuilder/types";

// המפה (Leaflet) משתמשת ב-window/DOM - חייבת להיטען רק בצד הלקוח, לא ב-SSR
const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

function DayTripResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.session) {
          setError("לא הצלחנו לטעון את הטיול");
          return;
        }
        setSession(data.session);
      })
      .catch(() => setError("לא הצלחנו לטעון את הטיול"));
  }, [sessionId]);

  if (error) {
    return (
      <Screen>
        <p className="pt-10 text-center text-danger">{error}</p>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <p className="pt-10 text-center text-ink-secondary">טוען את המסלול...</p>
      </Screen>
    );
  }

  const itinerary: FinalItinerary | null = session.final_itinerary;

  if (!itinerary || itinerary.stops.length === 0) {
    return (
      <Screen>
        <div className="pt-10 text-center text-ink-secondary">
          <p>לא נבחרו מספיק תחנות כדי לבנות מסלול.</p>
          <Link href="/home" className="mt-4 inline-block text-accent">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
      {/* Hero עליון עם הלוגו בפינה */}
      <div className="relative w-full">
        <Image
          src="/images/hero-day-trip-result.png"
          alt="הטיול שלכם מוכן"
          width={800}
          height={450}
          priority
          className="h-56 w-full object-cover"
        />
        <div className="absolute right-4 top-4">
          <Image src="/images/tripy.png" alt="TRIPLACE" width={40} height={40} className="rounded-full" />
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 pb-4 pt-10">
          <h1 className="text-xl font-bold text-white">הטיול שלכם מוכן!</h1>
          <p className="mt-1 text-sm text-white/90">
            {itinerary.stops.length} תחנות · כ-{Math.round(itinerary.totalEtaMinutes / 60)} שעות נסיעה
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-sm flex-col gap-5 px-5 pb-10 pt-5">
        {itinerary.warnings.length > 0 && (
          <div className="rounded-card bg-bg-secondary p-3 text-sm text-ink-secondary">
            {itinerary.warnings.map((warning) => (
              <p key={warning}>⚠️ {warning}</p>
            ))}
          </div>
        )}

        {/* מפה אינטראקטיבית - Leaflet + OpenStreetMap, חינמי לגמרי */}
        <ResultMap
          stops={itinerary.stops.map((s) => ({
            stopId: s.stopId,
            name: s.name,
            latitude: s.latitude,
            longitude: s.longitude,
          }))}
        />

        <div className="flex flex-col gap-3">
          {itinerary.stops.map((stop, index) => (
            <div key={stop.stopId} className="overflow-hidden rounded-card bg-white shadow-soft">
              {stop.imageUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stop.imageUrls[0]} alt={stop.name} className="h-32 w-full object-cover" />
              )}
              <div className="p-4">
                <p className="text-xs text-ink-secondary">
                  תחנה {index + 1} · {getCategoryLabel(stop.category)}
                </p>
                <p className="font-semibold text-ink">{stop.name}</p>
                {stop.reason && <p className="mt-1 text-sm text-ink-secondary">{stop.reason}</p>}
                <div className="mt-2 flex gap-3 text-xs text-ink-secondary">
                  <span>{stop.etaMinutes} דק&apos; נסיעה</span>
                  {stop.estimatedVisitMinutes && <span>{stop.estimatedVisitMinutes} דק&apos; ביקור</span>}
                  {stop.rating != null && <span>⭐ {stop.rating}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {itinerary.events.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-ink">אירועים בסביבה השבוע</h2>
            <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
   {itinerary.events.map((event) => (
                <a
                  key={event.id}
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-48 shrink-0 overflow-hidden rounded-card bg-white shadow-soft"
                >
                  {event.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.imageUrl} alt={event.name} className="h-24 w-full object-cover" />
                  )}
                  <div className="p-2.5">
                    <p className="text-sm font-medium text-ink">{event.name}</p>
                    {event.venueName && <p className="text-xs text-ink-secondary">{event.venueName}</p>}
                    {event.date && <p className="text-xs text-ink-secondary">{event.date}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        <Link href="/home">
          <Button variant="primary" fullWidth>
            סיום
          </Button>
        </Link>
      </div>
    </Screen>
  );
}

export default function DayTripResultPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <DayTripResultContent />
    </Suspense>
  );
}