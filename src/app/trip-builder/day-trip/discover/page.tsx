"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { listAddresses, type UserAddress } from "@/services/addresses/addressesService";
import { ChooseLocationSheet } from "@/screens/home/ChooseLocationSheet";
import { MainBottomNav } from "@/components/MainBottomNav";
import { BackButton } from "@/components/ui";
import { DiscoverySection } from "@/screens/discovery/DiscoverySection";
import { FeaturedEventsSection } from "@/screens/discovery/FeaturedEventsSection";
import type { DiscoveryPlace, DiscoveryEvent } from "@/services/places/discoveryService";

interface DiscoveryApiResponse {
  hotPlaces: DiscoveryPlace[];
  events: DiscoveryEvent[];
  sections: { id: string; emoji: string; title: string; places: DiscoveryPlace[] }[];
}

/**
 * עמוד Discovery של "טיול יומי" (Audit מול "PROMPT 1 - בניית עמוד
 * Discovery / יעדים חמים"): שינוי Product מפורש - זה **לא** Trip Builder.
 * לחיצה על "טיול יומי" בדף הבית מגיעה לכאן, לא ל-/trip-builder/day-trip
 * (שממשיך להתקיים ללא שינוי - ר' QuickCategories.tsx). אין כאן Day
 * Blueprint, Pace, Restaurant Quota, AI itinerary - רק גילוי מקומות
 * לפי מיקום+קטגוריה (discoveryService.ts, דטרמיניסטי לגמרי).
 *
 * מיקום: ממחזר במלואו את מנגנון ה-location הקיים באפליקציה
 * (ChooseLocationSheet/listAddresses/UserAddress, כבר בשימוש ב-
 * HomeHeader.tsx) - לא נוצר מנגנון מיקום מקביל.
 */
export default function DayTripDiscoverPage() {
  const { user } = useAuth();
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const [data, setData] = useState<DiscoveryApiResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // אותו דפוס בדיוק כמו HomeHeader.tsx - כתובת ברירת מחדל של המשתמש,
  // אם קיימת. אין כתובת שמורה -> locationSheetOpen נפתח אוטומטית (למטה)
  // כדי לכבד "המיקום הוא חלק מרכזי מהעמוד" (לא עמוד ריק בלי הסבר).
  useEffect(() => {
    if (!user) {
      setAddressLoading(false);
      return;
    }
    const supabase = createClient();
    listAddresses(supabase, user.id)
      .then((addresses) => {
        const active = addresses.find((a) => a.is_default) ?? addresses[0];
        if (active) {
          setSelectedAddress(active);
        } else {
          setLocationSheetOpen(true);
        }
      })
      .catch(() => setLocationSheetOpen(true))
      .finally(() => setAddressLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedAddress) return;
    setDataLoading(true);
    const params = new URLSearchParams();
    if (selectedAddress.latitude != null && selectedAddress.longitude != null) {
      params.set("lat", String(selectedAddress.latitude));
      params.set("lng", String(selectedAddress.longitude));
    }
    if (selectedAddress.city) params.set("city", selectedAddress.city);

    fetch(`/api/discovery/day-trip?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setDataLoading(false));
  }, [selectedAddress]);

  const locationLabel = selectedAddress?.city ?? selectedAddress?.label ?? null;

  function buildSeeAllHref(sectionId: string): string {
    const params = new URLSearchParams({ category: sectionId });
    if (selectedAddress?.latitude != null && selectedAddress?.longitude != null) {
      params.set("lat", String(selectedAddress.latitude));
      params.set("lng", String(selectedAddress.longitude));
    }
    if (selectedAddress?.city) params.set("city", selectedAddress.city);
    return `/trip-builder/day-trip/discover/category?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-bg pb-24">
      <header className="flex items-center gap-3 px-5 pt-4">
        <BackButton onBack={() => window.history.back()} />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-ink">יעדים חמים</h1>
          <button
            type="button"
            onClick={() => setLocationSheetOpen(true)}
            className="flex items-center gap-1 text-sm font-medium text-ink-secondary"
          >
            <Image src="/icons/location.png" alt="" width={16} height={16} />
            {addressLoading ? "טוען מיקום..." : locationLabel ?? "בחרו מיקום"}
          </button>
        </div>
      </header>

      <div className="mt-4 flex flex-col gap-6">
        {!selectedAddress && !addressLoading ? (
          <div className="mx-6 flex flex-col items-center gap-3 rounded-card bg-bg-secondary px-6 py-10 text-center">
            <p className="text-sm font-medium text-ink">כדי לגלות מה חם באזור שלכם</p>
            <button
              type="button"
              onClick={() => setLocationSheetOpen(true)}
              className="rounded-pill bg-[linear-gradient(135deg,var(--color-primary-start),var(--color-primary-end))] px-5 py-2 text-sm font-bold text-white"
            >
              בחרו מיקום
            </button>
          </div>
        ) : dataLoading || !data ? (
          <div className="px-6">
            <div className="h-40 animate-pulse rounded-card bg-bg-secondary" />
          </div>
        ) : (
          <>
            <section className="px-6">
              <h3 className="mb-1 text-lg font-semibold text-ink">🔥 הכי חמים עכשיו</h3>
              <p className="mb-3 text-sm text-ink-secondary">היעדים והבילויים הכי פופולריים באזור.</p>
              {data.hotPlaces.length === 0 ? (
                <p className="text-sm text-ink-secondary">אין עדיין מספיק תוצאות באזור הזה.</p>
              ) : (
                <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
                  {data.hotPlaces.map((place) => (
                    <Link
                      key={place.id}
                      href={`/place/${place.id}?from=day-trip-discover`}
                      className="relative block h-[220px] w-[150px] shrink-0 overflow-hidden rounded-card bg-bg-secondary shadow-soft"
                    >
                      {place.imageUrls[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={place.imageUrls[0]} alt={place.name} className="h-full w-full object-cover" loading="lazy" />
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
                        <p className="truncate text-sm font-bold leading-tight text-white">{place.name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <FeaturedEventsSection events={data.events} />

            {data.sections.map((section) => (
              <DiscoverySection
                key={section.id}
                emoji={section.emoji}
                title={section.title}
                places={section.places}
                seeAllHref={buildSeeAllHref(section.id)}
                discoverySlug={section.id}
              />
            ))}
          </>
        )}
      </div>

      {locationSheetOpen && (
        <ChooseLocationSheet
          onClose={() => setLocationSheetOpen(false)}
          onSelect={(address) => {
            setSelectedAddress(address);
            setLocationSheetOpen(false);
          }}
        />
      )}

      <MainBottomNav active="home" />
    </div>
  );
}
