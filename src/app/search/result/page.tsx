"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  ratingCount: number | null;
  imageUrl: string | null;
}

function SearchResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("placeId");

  const [result, setResult] = useState<PlaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addedToJournal, setAddedToJournal] = useState(false);

  useEffect(() => {
    if (!placeId) {
      setError("לא סופק מקום לחיפוש");
      return;
    }
    fetch(`/api/places/search-result-details?placeId=${encodeURIComponent(placeId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setResult(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "שגיאה בטעינת המקום"));
  }, [placeId]);

  function handleAddToJournal() {
    // היומן עצמו עוד לא בנוי - זה placeholder מכוון, נחבר בפועל כשנבנה
    // את עמוד היומן.
    setAddedToJournal(true);
  }

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      {/* HERO - זהה בסגנון לעמודי תוצאת מסלול: לוגו Triplace + חזור בשמאל */}
      <div className="relative h-56 w-full">
        <Image src="/images/hero-search-result.png" alt="" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.35),transparent_50%)]" />

        <div className="absolute left-2 top-4 flex items-center gap-2">
          <Image src="/images/trip-triplace-logo.png" alt="" width={130} height={40} className="object-contain" />
          <button
            type="button"
            onClick={() => router.push("/home")}
            aria-label="חזרה"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-white"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        {error && <p className="text-center text-sm text-danger">{error}</p>}

        {!result && !error && <div className="admin-skeleton h-24 rounded-card" />}

        {result && (
          <>
            {/* שורת התוצאה - בדיוק המקום שנמצא בחיפוש */}
            <div className="flex items-center gap-3 rounded-card bg-white p-4 shadow-soft">
              {result.imageUrl && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-card">
                  <Image src={result.imageUrl} alt="" fill className="object-cover" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">{result.name}</p>
                <p className="truncate text-[13px] text-ink-secondary">{result.address}</p>
                {result.rating != null && (
                  <p className="text-[12.5px] font-medium text-ink-secondary">
                    ⭐ {result.rating.toFixed(1)} {result.ratingCount ? `(${result.ratingCount.toLocaleString()})` : ""}
                  </p>
                )}
              </div>
            </div>

            {/* מפה */}
            <div className="overflow-hidden rounded-card bg-bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/places/static-map?lat=${result.latitude}&lng=${result.longitude}`}
                alt="מפה"
                className="h-48 w-full object-cover"
              />
            </div>

            <button
              type="button"
              onClick={handleAddToJournal}
              disabled={addedToJournal}
              className="w-full rounded-pill px-6 py-4 text-base font-bold text-white shadow-soft disabled:opacity-70"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {addedToJournal ? "✓ נוסף ליומן" : "+ הוספה ליומן"}
            </button>
          </>
        )}
      </div>
    </Screen>
  );
}

export default function SearchResultPage() {
  return (
    <Suspense fallback={null}>
      <SearchResultContent />
    </Suspense>
  );
}
