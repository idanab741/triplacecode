"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { listAddresses, type UserAddress } from "@/services/addresses/addressesService";
import { ChooseLocationSheet } from "@/screens/home/ChooseLocationSheet";
import { LocationPromptModal } from "@/screens/home/LocationPromptModal";
import { MainBottomNav } from "@/components/MainBottomNav";
import { TripHeroHeader } from "@/screens/layout/TripHeroHeader";
import { QUICK_CATEGORIES } from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { DiscoverySection } from "@/screens/discovery/DiscoverySection";
import { HotPlacesSection } from "@/screens/discovery/HotPlacesSection";
import type { DiscoveryPlace } from "@/services/places/discoveryService";

interface RomanticApiResponse {
  hotPlaces: DiscoveryPlace[];
  sections: { id: string; emoji: string; title: string; places: DiscoveryPlace[] }[];
}

// אותה קטגוריה קיימת ("romantic_date") מדף הבית - ר' constants/quickCategories.ts.
const ROMANTIC_CATEGORY = QUICK_CATEGORIES.find((c) => c.id === "romantic_date")!;

const DISCOVERY_LOCATION_STORAGE_KEY = "triplace_romantic_date_discover_location";

function readStoredAddress(): UserAddress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DISCOVERY_LOCATION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserAddress) : null;
  } catch {
    return null;
  }
}

function writeStoredAddress(address: UserAddress) {
  try {
    window.localStorage.setItem(DISCOVERY_LOCATION_STORAGE_KEY, JSON.stringify(address));
  } catch {
    // localStorage לא זמין - לא קריטי.
  }
}

/**
 * עמוד Discovery של "דייטים רומנטיים" (Audit - "אותו דבר עם דייטים
 * ורומנטי" - לפי אותה חלוקה: בר עליון/HERO/אייקון וטקסט/לוקיישן בצד
 * שמאל/הכי חמים ראשון/ואז כל השאר): אותו Shell בדיוק כמו day-trip/
 * vacation-il/abroad-vacation/restaurants-cafes/nature-trip.
 * הסקשנים הם 9 "אופי הדייט" מ-DATE_TYPE_OPTIONS (locales/he/romanticDate.ts,
 * כבר בשימוש בשאלון ה-Trip Builder הקיים) - לא רשימה חדשה. ר' route.ts
 * למיפוי המדויק ל-subcategories אמיתיים.
 */
export default function RomanticDateDiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [locationPromptOpen, setLocationPromptOpen] = useState(false);

  // פותח אוטומטית את הפופ-אפ "איפה הטיול הבא שלך?" בכל כניסה לעמוד.
  useEffect(() => {
    setLocationPromptOpen(true);
  }, []);

  const [data, setData] = useState<RomanticApiResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const stored = readStoredAddress();
    if (stored) {
      setSelectedAddress(stored);
      setAddressLoading(false);
      return;
    }
    if (!user) {
      setAddressLoading(false);
      return;
    }
    const supabase = createClient();
    listAddresses(supabase, user.id)
      .then((addresses) => {
        const active = addresses.find((a) => a.is_default) ?? addresses[0];
        if (active) setSelectedAddress(active);
      })
      .catch(() => {})
      .finally(() => setAddressLoading(false));
  }, [user]);

  useEffect(() => {
    if (authLoading || addressLoading) return;
    setDataLoading(true);
    const params = new URLSearchParams();
    if (selectedAddress?.latitude != null && selectedAddress?.longitude != null) {
      params.set("lat", String(selectedAddress.latitude));
      params.set("lng", String(selectedAddress.longitude));
    }
    if (selectedAddress?.city) params.set("city", selectedAddress.city);

    fetch(`/api/discovery/romantic-date?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setDataLoading(false));
  }, [authLoading, addressLoading, selectedAddress]);

  const locationLabel = selectedAddress?.city ?? selectedAddress?.label ?? null;

  function buildSeeAllHref(sectionId: string): string {
    const params = new URLSearchParams({ category: sectionId });
    if (selectedAddress?.latitude != null && selectedAddress?.longitude != null) {
      params.set("lat", String(selectedAddress.latitude));
      params.set("lng", String(selectedAddress.longitude));
    }
    if (selectedAddress?.city) params.set("city", selectedAddress.city);
    return `/trip-builder/romantic-date/discover/category?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-white pb-36">
      {/* 1. TOP BAR - זהה בדיוק לשאר עמודי ה-Discovery. */}
      <TripHeroHeader heroSrc="/images/hero-romantic-date.png" onBack={() => router.back()} />

      {/* 3. שורה: אייקון+"דייטים רומנטיים" בצד ימין, מיקום בצד שמאל. */}
      <div className="flex items-center justify-between px-6 pt-0">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ROMANTIC_CATEGORY.imageSrc} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="text-lg font-bold text-ink">{QUICK_CATEGORY_LABELS.romantic_date}</span>
        </div>

        <button
          type="button"
          onClick={() => setLocationPromptOpen(true)}
          className="flex items-center gap-1 truncate text-sm font-medium text-ink"
        >
          <Image src="/icons/location.png" alt="" width={22} height={22} />
          {locationLabel ?? "המיקום שלי"}
        </button>
      </div>

      {/* 4. "🔥 הכי חמים עכשיו" ראשון, ואז 13 הקטגוריות. */}
      <div className="mt-5 flex flex-col gap-6">
        {dataLoading || !data ? (
          <div className="px-6">
            <div className="h-40 animate-pulse rounded-card bg-bg-secondary" />
          </div>
        ) : (
          <>
            <HotPlacesSection places={data.hotPlaces} from="romantic-date-discover" seeAllHref={buildSeeAllHref("hot")} />
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

      {locationPromptOpen && (
        <LocationPromptModal
          currentLocationLabel={locationLabel ?? "המיקום שלי"}
          onClose={() => setLocationPromptOpen(false)}
          onSearchDestination={() => {
            setLocationPromptOpen(false);
            setLocationSheetOpen(true);
          }}
        />
      )}

      {locationSheetOpen && (
        <ChooseLocationSheet
          onClose={() => setLocationSheetOpen(false)}
          onSelect={(address) => {
            setSelectedAddress(address);
            writeStoredAddress(address);
            setLocationSheetOpen(false);
          }}
        />
      )}

      {/* 5. Bottom Navigation - ממוחזר במלואו. */}
      <MainBottomNav active="home" />
    </div>
  );
}
