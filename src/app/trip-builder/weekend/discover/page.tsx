"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { listAddresses, type UserAddress } from "@/services/addresses/addressesService";
import { ChooseLocationSheet } from "@/screens/home/ChooseLocationSheet";
import { MainBottomNav } from "@/components/MainBottomNav";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { QUICK_CATEGORIES } from "@/constants/quickCategories";
import { ISRAEL_VACATION_DESTINATIONS } from "@/constants/israelVacationDestinations";
import { VacationDestinationsCarousel } from "@/screens/discovery/VacationDestinationsCarousel";
import { DiscoverySection } from "@/screens/discovery/DiscoverySection";
import { HotPlacesSection } from "@/screens/discovery/HotPlacesSection";
import type { DiscoveryPlace } from "@/services/places/discoveryService";

interface VacationApiResponse {
  hotPlaces: DiscoveryPlace[];
  sections: { id: string; emoji: string; title: string; places: DiscoveryPlace[] }[];
}

// אותה קטגוריה קיימת ("weekend") מדף הבית - ר' constants/quickCategories.ts.
// לא שינינו את ה-id/label הגלובליים שם (עדיין "סופ"ש" בעיגול בדף הבית) -
// כאן, בעמוד הזה בלבד, מציגים כיתוב "חופשה בארץ" (בקשה מפורשת),
// באותו אייקון עצמו.
const WEEKEND_CATEGORY = QUICK_CATEGORIES.find((c) => c.id === "weekend")!;

// אותו תיקון-מיקום בדיוק כמו day-trip/discover (ר' ההערה שם) - מפתח
// נפרד בכוונה ("חופשה בארץ" הוא Discovery Experience נפרד מ"טיול יומי",
// סעיף 21 - אין להניח שהם חייבים לחלוק את אותו מיקום נבחר).
const DISCOVERY_LOCATION_STORAGE_KEY = "triplace_vacation_il_discover_location";

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
 * עמוד Discovery של "חופשה בארץ" (Audit מול "אני רוצה להמשיך את מערכת
 * ה-Discovery... ולבנות ממנה עמוד נפרד לחלוטין... זה לא שינוי קוסמטי
 * של טיול יומי"): מוצר Discovery **נפרד** - Shell/רכיבים ממוחזרים
 * במלואם מ-day-trip/discover (SimpleAppHeader, HotPlacesSection,
 * DiscoverySection, ChooseLocationSheet), אבל:
 * - API נפרד (`/api/discovery/vacation-il`, לא `/day-trip`).
 * - רשימת קטגוריות שונה לגמרי (מלונות/ספא/זוגי/משפחתי/צימרים... -
 *   לא מעתיק את קטגוריות טיול יומי, סעיף 21 מפורש).
 * - סקשן "🔥 היעדים החמים" - רשימה סטטית וקבועה (9 יעדים מוגדרים
 *   מראש, לא DB), ר' constants/israelVacationDestinations.ts - כל יעד
 *   מוביל לעמוד יעד ייעודי (destination/[slug]) עם אותם סקשני Discovery
 *   עצמם, ממוקדים לאזור של אותו יעד.
 * - בלי אירועים/רחובות ומרכזי בילוי (שייכים ל"טיול יומי" בלבד).
 *
 * ה-route הישן /trip-builder/weekend (Trip Builder) לא נמחק/משתנה -
 * רק QuickCategories.tsx מפנה עכשיו ל-Discovery החדש הזה.
 */
export default function VacationIlDiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const [data, setData] = useState<VacationApiResponse | null>(null);
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

    fetch(`/api/discovery/vacation-il?${params.toString()}`)
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
    return `/trip-builder/weekend/discover/category?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-bg pb-36">
      {/* 1. TOP BAR - ממוחזר במלואו מ"הטיולים שלי" (SimpleAppHeader), בלי title. */}
      <SimpleAppHeader onBack={() => router.back()} />

      {/* 2. HERO - full-bleed, אותו דפוס בדיוק כמו day-trip/discover, עם
          asset ה-Hero הקיים של "סופ"ש" (hero-weekend.png). */}
      <div className="relative w-full">
        <Image src="/images/hero-weekend.png" alt="" width={800} height={450} priority className="h-auto w-full" />
      </div>

      {/* 3. שורה: אייקון+"חופשה בארץ" בצד ימין, מיקום בצד שמאל. */}
      <div className="flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={WEEKEND_CATEGORY.imageSrc} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="text-lg font-bold text-ink">חופשה בארץ</span>
        </div>

        <button
          type="button"
          onClick={() => setLocationSheetOpen(true)}
          className="flex items-center gap-1 truncate text-sm font-medium text-ink"
        >
          <Image src="/icons/location.png" alt="" width={22} height={22} />
          {locationLabel ?? "המיקום שלי"}
        </button>
      </div>

      {/* 4. קטגוריות ה-Discovery. */}
      <div className="mt-5 flex flex-col gap-6">
        {/* 🔥 היעדים החמים - DESTINATIONS סטטיים וקבועים (לא Places, לא
            DB), מוצג מיד - לא תלוי בטעינת ה-API של שאר הסקשנים. */}
        <VacationDestinationsCarousel title="🔥 היעדים החמים" destinations={ISRAEL_VACATION_DESTINATIONS} />

        {dataLoading || !data ? (
          <div className="px-6">
            <div className="h-40 animate-pulse rounded-card bg-bg-secondary" />
          </div>
        ) : (
          <>
            {/* 🔥 הכי חמים עכשיו - PLACES/אטרקציות (הבדל ברור מהסקשן הקודם). */}
            <HotPlacesSection places={data.hotPlaces} from="vacation-il-discover" seeAllHref={buildSeeAllHref("hot")} />

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
