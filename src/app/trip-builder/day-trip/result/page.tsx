"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Screen } from "@/components/ui";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { FinalItinerary, TripBuilderSession } from "@/services/tripBuilder/types";

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
    <Screen>
      <div className="mx-auto flex max-w-sm flex-col gap-5 pt-6">
        <header className="text-center">
          <h1 className="text-xl font-bold text-ink">הטיול שלכם מוכן!</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            {itinerary.stops.length} תחנות · כ-{Math.round(itinerary.totalEtaMinutes / 60)} שעות נסיעה
          </p>
        </header>

        {itinerary.warnings.length > 0 && (
          <div className="rounded-card bg-bg-secondary p-3 text-sm text-ink-secondary">
            {itinerary.warnings.map((warning) => (
              <p key={warning}>⚠️ {warning}</p>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {itinerary.stops.map((stop, index) => (
            <div key={stop.stopId} className="overflow-hidden rounded-card bg-bg shadow-soft">
              {stop.imageUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={stop.imageUrls[0]} alt={stop.name} className="h-32 w-full object-cover" />
              )}
              <div className="p-4">
                <p className="text-xs text-ink-secondary">תחנה {index + 1} · {getCategoryLabel(stop.category)}</p>
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
