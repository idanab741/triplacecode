"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite } from "@/services/favorites/favoritesService";
import { AddPlaceToCalendarSheet } from "@/screens/search/AddPlaceToCalendarSheet";

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), {
  ssr: false,
});

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  ratingCount: number | null;
  imageUrl: string | null;
  tags: string[];
}

function SearchResultContent() {
  const router = useRouter();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("placeId");

  const [result, setResult] = useState<PlaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const [saved, setSaved] = useState(false);
  const [savingPlace, setSavingPlace] = useState(false);
  const [justShared, setJustShared] = useState(false);

  const [inCalendar, setInCalendar] = useState(false);
  const [removingFromCalendar, setRemovingFromCalendar] = useState(false);

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

  useEffect(() => {
    if (!user || !placeId) return;
    const supabase = createClient();
    getFavoriteStatus(supabase, user.id, placeId).then((status) => setSaved(status === "saved"));
  }, [user, placeId]);

  useEffect(() => {
    if (!user || !placeId) return;
    fetch(`/api/places/calendar?placeId=${encodeURIComponent(placeId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setInCalendar(data.inCalendar === true);
      })
      .catch(() => {});
  }, [user, placeId]);

  async function handleSavePlace() {
    if (!user || !placeId || savingPlace) return;
    const nextSaved = !saved;
    setSavingPlace(true);
    setSaved(nextSaved);
    try {
      const supabase = createClient();
      const status = await toggleFavorite(supabase, user.id, placeId, "place", "saved");
      setSaved(status === "saved");
      if (status === "saved") router.push("/home");
    } catch {
      setSaved((s) => !s);
    } finally {
      setSavingPlace(false);
    }
  }

  async function handleSharePlace() {
    setJustShared(true);
    setTimeout(() => setJustShared(false), 1500);

    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = result ? `תראו את ${result.name} ב-TRIPLACE: ${url}` : url;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: result?.name ?? "TRIPLACE", text, url });
        return;
      } catch {
        // המשתמש ביטל את ה-share sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  function handleAddToJournal() {
    setShowCalendarSheet(true);
  }

  async function handleRemoveFromCalendar() {
    if (!placeId || removingFromCalendar) return;
    setRemovingFromCalendar(true);
    setInCalendar(false); // עדכון אופטימי
    try {
      const response = await fetch(`/api/places/calendar?placeId=${encodeURIComponent(placeId)}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error();
    } catch {
      setInCalendar(true); // rollback אם נכשל
    } finally {
      setRemovingFromCalendar(false);
    }
  }

  return (
    <Screen withBottomNavSpacing className="!bg-bg !px-0 !pt-0">
      <header className="sticky top-0 z-30 w-full bg-white shadow-sm">
        <div className="relative h-16">
          <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className="object-contain" />
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="flex h-10 w-10 shrink-0 items-center justify-center text-ink"
              aria-label="חזרה לדף הבית"
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="m14 6-6 6 6 6" />
              </svg>
            </button>
          </div>

          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            {user && (
              <button
                type="button"
                onClick={handleSavePlace}
                disabled={savingPlace}
                aria-label={saved ? "הסרה משמורים" : "שמור מקום"}
                className="flex h-10 w-10 items-center justify-center rounded-full text-ink disabled:opacity-60"
              >
                <Image src={saved ? "/icons/save-active.png" : "/icons/save.png"} alt="" width={23} height={23} />
              </button>
            )}
            <button
              type="button"
              onClick={handleSharePlace}
              aria-label="שתף מקום"
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink"
            >
              <Image src={justShared ? "/icons/share-active.png" : "/icons/share.png"} alt="" width={26} height={26} />
            </button>
          </div>
        </div>
      </header>

      <div className="relative w-full">
        <Image
          src="/images/hero-search-result.png"
          alt="תוצאת חיפוש"
          width={800}
          height={450}
          priority
          className="h-auto w-full"
        />
      </div>

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-5">
        {error && <p className="text-center text-sm text-danger">{error}</p>}

        {!result && !error && <div className="admin-skeleton h-24 rounded-card" />}

        {result && (
          <>
            <div className="flex items-start gap-3 rounded-card bg-white p-4 shadow-soft">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-card bg-bg-secondary">
                {result.imageUrl && !imageFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={result.imageUrl} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl">📍</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-ink">{result.name}</p>
                <p className="truncate text-[13px] text-ink-secondary">{result.address}</p>
                {result.rating != null && (
                  <p className="text-[12.5px] font-medium text-ink-secondary">
                    ⭐ {result.rating.toFixed(1)} {result.ratingCount ? `(${result.ratingCount.toLocaleString()})` : ""}
                  </p>
                )}
                {result.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {result.tags.map((tag) => (
                      <span key={tag} className="rounded-pill bg-bg-secondary px-2.5 py-1 text-[11.5px] font-medium text-ink-secondary">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <ResultMap
              stops={[{ stopId: result.placeId, name: result.name, latitude: result.latitude, longitude: result.longitude }]}
            />

            {inCalendar ? (
              <button
                type="button"
                onClick={handleRemoveFromCalendar}
                disabled={removingFromCalendar}
                className="w-full rounded-pill border border-[var(--color-primary-start)] py-2 text-sm font-semibold text-[var(--color-primary-start)] disabled:opacity-60"
              >
                {removingFromCalendar ? "מסיר..." : "✓ ביומן - הסרה מהיומן"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAddToJournal}
                className="w-full rounded-pill py-2 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
              >
                + הוספה ליומן
              </button>
            )}
          </>
        )}
      </div>

      {showCalendarSheet && result && (
        <AddPlaceToCalendarSheet
          placeId={result.placeId}
          placeName={result.name}
          imageUrl={result.imageUrl}
          onClose={() => setShowCalendarSheet(false)}
          onAdded={() => {
            setInCalendar(true);
            router.push("/home");
          }}
        />
      )}

      <MainBottomNav active="home" />
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