"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui";
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { TripBuilderSession } from "@/services/tripBuilder/types";

function RestaurantResultContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const [session, setSession] = useState<TripBuilderSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/trip-builder/sessions?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setSession(data.session);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "שגיאה בטעינה"));
  }, [sessionId]);

  if (error) {
    return (
      <Screen>
        <p className="pt-10 text-center text-danger">{error}</p>
      </Screen>
    );
  }

  if (!session || !session.final_itinerary) {
    return (
      <Screen>
        <p className="pt-10 text-center text-ink-secondary">מוצאים לכם את המקום המושלם...</p>
      </Screen>
    );
  }

  const place = session.final_itinerary.stops[0];

  if (!place) {
    return (
      <Screen>
        <p className="pt-10 text-center text-ink-secondary">לא מצאנו מקום מתאים כרגע, נסו שוב.</p>
      </Screen>
    );
  }

  return (
    <Screen withBottomNavSpacing={false} className="!bg-bg !px-0 !pt-0">
      <div className="relative w-full">
        <Image
          src="/images/hero-restaurants-cafes.png"
          alt=""
          width={800}
          height={450}
          priority
          className="h-56 w-full object-cover"
        />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <Link href="/home" className="flex h-9 w-9 shrink-0 items-center justify-center text-ink" aria-label="חזרה לדף הבית">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="mx-auto flex max-w-sm flex-col gap-4 px-5 pb-10 pt-4">
        <h1 className="text-xl font-bold text-ink">מצאנו את המקום בשבילכם!</h1>

        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          {place.imageUrls[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={place.imageUrls[0]} alt={place.name} className="h-48 w-full object-cover" />
          )}
          <div className="flex flex-col gap-1 p-4">
            <p className="text-xs font-medium text-ink-secondary">{getCategoryLabel(place.category)}</p>
            <p className="text-lg font-bold text-ink">{place.name}</p>
            {place.shortDescription && <p className="text-sm text-ink-secondary">{place.shortDescription}</p>}
            <div className="mt-2 flex items-center gap-3 text-sm text-ink-secondary">
              {place.rating != null && <span>⭐ {place.rating}</span>}
              {place.priceLevel != null && <span>{"₪".repeat(place.priceLevel + 1)}</span>}
            </div>
          </div>
        </div>

        <Link href="/home">
          <button
            type="button"
            className="w-full rounded-pill py-2.5 text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
          >
            סיום
          </button>
        </Link>
      </div>
    </Screen>
  );
}

export default function RestaurantResultPage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <p className="pt-10 text-center text-ink-secondary">טוען...</p>
        </Screen>
      }
    >
      <RestaurantResultContent />
    </Suspense>
  );
}