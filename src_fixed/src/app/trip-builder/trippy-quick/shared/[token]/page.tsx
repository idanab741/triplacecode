"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Screen, AiGlobeIcon } from "@/components/ui";
import type { TrippyQuickStop } from "@/services/tripBuilder/trippyQuickShared";

/**
 * *** תוספת (בקשה מפורשת - "אפשרות לשמירה ושיתוף"): תצוגה ציבורית,
 * read-only, בלי התחברות - נטענת לפי share_token (ר' migration 0058 +
 * /api/trippy-ai/shared/[token]/route.ts). בכוונה **לא** משתמשת ב-
 * ChatHeader/SortableStopCard (גרירה/מחיקה/החלפה) - אלה תלויים בהקשר
 * של המשתמש המחובר/session, ולא רלוונטיים כאן: מי שפותח קישור משותף
 * צריך לראות טיול מוכן, לא לערוך את הטיול של מישהו אחר.
 */

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), { ssr: false });

function SharedTrippyQuickContent({ token }: { token: string }) {
  const router = useRouter();
  const [stops, setStops] = useState<TrippyQuickStop[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/trippy-ai/shared/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.result || !Array.isArray(data.result.stops) || data.result.stops.length === 0) {
          setError("המסלול לא נמצא - ייתכן שנמחק.");
          return;
        }
        setStops(data.result.stops);
        setTitle(typeof data.result.title === "string" ? data.result.title : null);
      })
      .catch(() => {
        if (!cancelled) setError("משהו השתבש - נסו שוב.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const mapStops = (stops ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ stopId: s.id, name: s.name, latitude: s.latitude, longitude: s.longitude }));

  return (
    <Screen withBottomNavSpacing>
      <div className="-mx-5 -mt-8">
        <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between bg-white px-4 shadow-sm">
          <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className="object-contain" />
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-start)]">
            <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
              <AiGlobeIcon active size={24} />
            </span>
            trippy AI
          </span>
        </header>

        <div className="w-full">
          <Image
            src="/images/trippy-hero-calendar.png"
            alt=""
            width={0}
            height={0}
            sizes="100vw"
            className="h-auto w-full"
            priority
          />
        </div>
      </div>

      <div className="mx-auto flex max-w-md flex-col gap-4 pt-4">
        {error && (
          <div className="rounded-card bg-red-50 p-4 text-center text-sm text-red-600">
            {error}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => router.push("/ai")}
                className="text-sm font-semibold text-[var(--color-primary-start)]"
              >
                בואו נבנה מסלול חדש
              </button>
            </div>
          </div>
        )}

        {!error && stops === null && <div className="px-1 text-center text-sm text-ink-secondary">טוען מסלול...</div>}

        {!error && stops !== null && (
          <>
            <h1 className="text-center text-lg font-bold text-ink">{title ?? "המסלול שלכם"}</h1>

            {mapStops.length > 0 && (
              <div className="h-56 w-full overflow-hidden rounded-card">
                <ResultMap stops={mapStops} />
              </div>
            )}

            <div className="flex flex-col gap-3 px-1">
              {stops.map((stop, index) => (
                <div key={stop.id} className="flex gap-3 overflow-hidden rounded-card bg-white p-2 shadow-soft">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-bg-secondary">
                    {stop.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={stop.imageUrl} alt={stop.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg">📍</div>
                    )}
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary-start)] text-[10px] font-bold text-white">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <p className="truncate text-sm font-bold text-ink">{stop.name}</p>
                    {stop.shortDescription && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">{stop.shortDescription}</p>
                    )}
                    {stop.rating != null && (
                      <p className="mt-1 text-xs font-medium text-ink-secondary">⭐ {stop.rating.toFixed(1)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="px-1 pb-4 text-center text-xs text-ink-secondary">
              המסלול הזה נבנה עם trippy AI ב-triplace.{" "}
              <button type="button" onClick={() => router.push("/ai")} className="font-semibold text-[var(--color-primary-start)]">
                בנו לעצמכם מסלול
              </button>
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}

export default function SharedTrippyQuickPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setToken(p.token));
  }, [params]);

  if (!token) return null;
  return (
    <Suspense>
      <SharedTrippyQuickContent token={token} />
    </Suspense>
  );
}
