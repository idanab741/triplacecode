"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite } from "@/services/favorites/favoritesService";

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
  const [addedToJournal, setAddedToJournal] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const [saved, setSaved] = useState(false);
  const [savingPlace, setSavingPlace] = useState(false);
  const [justShared, setJustShared] = useState(false);

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

  async function handleSavePlace() {
    if (!user || !placeId || savingPlace) return;
    setSavingPlace(true);
    setSaved((s) => !s);
    try {
      const supabase = createClient();
      const status = await toggleFavorite(supabase, user.id, placeId, "place", "saved");
      setSaved(status === "saved");
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
    setAddedToJournal(true);
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

            <div className="overflow-hidden rounded-card bg-bg-secondary">
              {mapFailed ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${result.latitude},${result.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-48 w-full flex-col items-center justify-center gap-1.5 text-ink-secondary"
                >
                  <span className="text-2xl">🗺️</span>
                  <span className="text-[13px] font-medium">לא ניתן לטעון תצוגת מפה כרגע - לחצו לפתיחה בגוגל מפות</span>
                </a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/places/static-map?lat=${result.latitude}&lng=${result.longitude}`}
                  alt="מפה"
                  className="h-48 w-full object-cover"
                  onError={() => setMapFailed(true)}
                />
              )}
            </div>

            <button
              type="button"
              onClick={handleAddToJournal}
              disabled={addedToJournal}
              className="w-full rounded-pill py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" }}
            >
              {addedToJournal ? "✓ נוסף ליומן" : "+ הוספה ליומן"}
            </button>
          </>
        )}
      </div>

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