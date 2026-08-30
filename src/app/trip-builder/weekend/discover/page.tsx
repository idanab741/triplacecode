"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { listAddresses, type UserAddress } from "@/services/addresses/addressesService";
import { ChooseLocationSheet } from "@/screens/home/ChooseLocationSheet";
import { MainBottomNav } from "@/components/MainBottomNav";
import { TripHeroHeader } from "@/screens/layout/TripHeroHeader";
import { QUICK_CATEGORIES } from "@/constants/quickCategories";
import { ISRAEL_VACATION_DESTINATIONS } from "@/constants/israelVacationDestinations";
import { VacationDestinationsCarousel } from "@/screens/discovery/VacationDestinationsCarousel";
import { HotPlacesSection } from "@/screens/discovery/HotPlacesSection";
import { DealsComingSoonCard } from "@/screens/discovery/DealsComingSoonCard";
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
 * עמוד Discovery של "חופשה בארץ".
 *
 * תיקון Product מפורש - עמוד מצומצם ל-3 סקשנים בלבד, "וזהו":
 * 1. "🔥 היעדים החמים" - קרוסלת DESTINATIONS סטטית וקבועה (9 יעדים
 *    מוגדרים מראש, לא DB - ר' constants/israelVacationDestinations.ts).
 *    כל יעד מוביל עכשיו לעמוד היעד הכללי /destination/[id] - **אותו
 *    סגנון בדיוק** כמו יעדי "חופשה בחו''ל" (hero, מזג אוויר, אטרקציות) -
 *    לא לעמוד ה-Discovery הישן (weekend/discover/destination/[slug],
 *    שנשאר קיים בקוד בלי שינוי, פשוט אף כרטיס לא מצביע אליו יותר).
 *    התאמה בפועל ל-UUID לפי שם, דרך /api/discovery/israel-vacation-destinations.
 * 2. "🔥 הכי חמים עכשיו" (HotPlacesSection) - בלי הטקסט המסביר הקטן
 *    מתחת לכותרת (description="") - חוץ מזה בנוי בדיוק כמו שהיה.
 * 3. triplacedeals (DealsComingSoonCard) - אותה קומפוננטה בדיוק כמו
 *    בעמוד "חופשה בחו''ל".
 *
 * הוסרו: כל שאר סקשני ה-DiscoverySection שהיו כאן קודם (מלונות/ספא/
 * זוגי/משפחתי/צימרים...) - ה-API (`/api/discovery/vacation-il`) עדיין
 * מחזיר אותם, פשוט אין להם יותר תצוגה בעמוד הזה.
 *
 * ה-route הישן /trip-builder/weekend (Trip Builder) לא נמחק/משתנה -
 * רק QuickCategories.tsx מפנה עכשיו ל-Discovery הזה.
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
    <div className="min-h-screen bg-white pb-36">
      {/* 1. TOP BAR - שקוף, חופף את ה-HERO (TripHeroHeader), לוגו ממורכז. */}
      <TripHeroHeader heroSrc="/images/hero-weekend.png" onBack={() => router.back()} />

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

      {/* 4. עמוד מצומצם (תיקון Product מפורש - "וזהו", בלי שאר הסקשנים
          שהיו כאן קודם): קרוסלת יעדים / הכי חם עכשיו / triplacedeals. */}
      <div className="mt-5 flex flex-col gap-6">
        {/* 🔥 היעדים החמים - DESTINATIONS סטטיים וקבועים (לא Places, לא
            DB), מוצג מיד - לא תלוי בטעינת ה-API של שאר הסקשנים. */}
        <VacationDestinationsCarousel title="🔥 היעדים החמים" destinations={ISRAEL_VACATION_DESTINATIONS} />

        {dataLoading || !data ? (
          <div className="px-6">
            <div className="h-40 animate-pulse rounded-card bg-bg-secondary" />
          </div>
        ) : (
          // בלי טקסט מסביר קטן מתחת לכותרת (תיקון Product מפורש) - הכל
          // אחרת בנוי בדיוק כמו שהיה.
          <HotPlacesSection
            places={data.hotPlaces}
            from="vacation-il-discover"
            description=""
            seeAllHref={buildSeeAllHref("hot")}
          />
        )}

        {/* triplacedeals - נוסף כאן (תיקון Product מפורש), אותה קומפוננטה
            בדיוק כמו בעמוד "חופשה בחו''ל". */}
        <DealsComingSoonCard />
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
