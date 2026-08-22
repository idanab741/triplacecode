"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BackButton } from "@/components/ui";
import { DiscoveryPlaceCard } from "@/screens/discovery/DiscoveryPlaceCard";
import type { DiscoveryPlace } from "@/services/places/discoveryService";

interface CategoryApiResponse {
  title: string;
  emoji: string;
  places: DiscoveryPlace[];
}

/**
 * "ראה הכל" לסקשן בודד (Audit מול "PROMPT 1" סעיף 15 - "לחיצה על ראה
 * הכל תפתח את כל התוצאות של אותה קטגוריה עבור המיקום"). אותו API
 * (`/api/discovery/day-trip`), עם `category` בשאילתה ו-limit גדול יותר -
 * לא נוצר endpoint/service נפרד.
 */
function CategoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CategoryApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    fetch(`/api/discovery/day-trip?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-bg pb-10">
      <header className="flex items-center gap-3 px-5 pt-4">
        <BackButton onBack={() => router.back()} />
        <h1 className="text-xl font-bold text-ink">
          {data ? `${data.emoji} ${data.title}` : "טוען..."}
        </h1>
      </header>

      <div className="mt-4 px-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[220px] animate-pulse rounded-card bg-bg-secondary" />
            ))}
          </div>
        ) : !data || data.places.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-secondary">אין עדיין מספיק תוצאות עבור האזור הזה.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {data.places.map((place) => (
              <DiscoveryPlaceCard key={place.id} place={place} from="day-trip-discover" fixedWidth={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CategoryDiscoverPage() {
  return (
    <Suspense fallback={null}>
      <CategoryContent />
    </Suspense>
  );
}
