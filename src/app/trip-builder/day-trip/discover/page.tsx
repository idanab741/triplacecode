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
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";
import { DiscoverySection } from "@/screens/discovery/DiscoverySection";
import { FeaturedEventsSection } from "@/screens/discovery/FeaturedEventsSection";
import { HotPlacesSection } from "@/screens/discovery/HotPlacesSection";
import type { DiscoveryPlace, DiscoveryEvent } from "@/services/places/discoveryService";

interface DiscoveryApiResponse {
  hotPlaces: DiscoveryPlace[];
  events: DiscoveryEvent[];
  sections: { id: string; emoji: string; title: string; places: DiscoveryPlace[] }[];
}

const DAY_TRIP_CATEGORY = QUICK_CATEGORIES.find((c) => c.id === "day_trip")!;

/**
 * תיקון באג אמיתי ("המיקום צריך להישמר אחרי שעושים אותו פעם אחת!! למה
 * המיקום לא נשמר??"): מצאתי את הסיבה בקוד בפועל - ChooseLocationSheet.tsx
 * (הרכיב המשותף, לא נגעתי בו) מחזיר אובייקט UserAddress **זמני** (id:
 * "current" ל"מיקום נוכחי", id: `city-${name}` לבחירת עיר מהרשימה) -
 * שני המקרים האלה **לא נשמרים בכלל** בטבלת user_addresses (רק כתובת
 * שנוספה דרך "הוסף כתובת" נשמרת שם באמת). לכן listAddresses בטעינה
 * הבאה של העמוד פשוט לא מוצא אותם - זו בדיוק אותה מגבלה שקיימת גם
 * ב-HomeHeader.tsx (המיקום "מתאפס" גם שם בכל טעינה, אם נבחר דרך "מיקום
 * נוכחי"/"עיר מהרשימה"). התיקון כאן: שכבת cache פשוטה ב-localStorage,
 * ספציפית לעמוד הזה (לא שינוי לרכיב המשותף - לא רוצה לשנות התנהגות
 * של HomeHeader בלי שהתבקש) - שומרת את הבחירה האחרונה (זמנית או קבועה,
 * לא משנה) ומשחזרת אותה מיד בטעינה הבאה, לפני שפונים ל-listAddresses.
 */
const DISCOVERY_LOCATION_STORAGE_KEY = "triplace_day_trip_discover_location";

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
    // localStorage לא זמין (מצב פרטי וכו') - לא קריטי, פשוט לא יישמר בין טעינות.
  }
}

/**
 * עמוד Discovery של "טיול יומי" (Audit מול "תמונה מתחת לבר העליון,
 * בלי עיצובים/צלליות/כיתוב על התמונה; מיקום כמו בעמוד הבית; בלי מיקום
 * = אטרקציות כלליות"): שינוי Product מפורש - זה **לא** Trip Builder.
 * אין כאן Day Blueprint, Pace, Restaurant Quota, AI itinerary - רק
 * גילוי מקומות (discoveryService.ts, דטרמיניסטי לגמרי).
 *
 * מבנה העמוד: TOP BAR (SimpleAppHeader, בלי title) -> HERO (full-bleed,
 * ממחזר במדויק את דפוס hero-*.png בכל עמודי ה-result הקיימים - בלי
 * rounded/shadow/טקסט על גבי התמונה) -> שורה אחת: אייקון+"טיול יומי"
 * בצד ימין, מיקום (בדיוק כמו HomeHeader.tsx) בצד שמאל -> כל הסקשנים
 * (תמיד מוצגים, גם ריקים) -> MainBottomNav.
 *
 * מיקום: ממחזר במלואו את ChooseLocationSheet/listAddresses/UserAddress -
 * לא נוצר מנגנון מקביל. בלי מיקום שמור - התוצאות הן "אטרקציות כלליות
 * מהמדינה" (ישראל, ר' discoveryService.ts), לא מכל העולם ולא מסך חוסם.
 */
export default function DayTripDiscoverPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const [data, setData] = useState<DiscoveryApiResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // תחילה localStorage (ר' readStoredAddress למעלה - מכסה גם "מיקום
  // נוכחי"/"עיר מהרשימה" שלא נשמרים ב-DB בכלל), ורק אם אין - נופלים
  // ל-listAddresses (כתובת ברירת מחדל אמיתית, אם קיימת). זה בדיוק
  // התיקון ל"המיקום לא נשמר".
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

  // תיקון (בקשה מפורשת - "אם לא עושים מיקום צריך שיהיה אטרקציות
  // כלליות! ללא מיקום"): ה-fetch רץ תמיד אחרי שסיימנו לבדוק אם יש
  // כתובת שמורה - עם lat/lng/city אם יש כתובת, בלי פרמטרים בכלל אם אין
  // (discoveryService.ts כבר תומך בזה - מחזיר תוצאות כלליות מהמדינה,
  // לא ריק ולא מכל העולם).
  useEffect(() => {
    if (authLoading || addressLoading) return;
    setDataLoading(true);
    const params = new URLSearchParams();
    if (selectedAddress?.latitude != null && selectedAddress?.longitude != null) {
      params.set("lat", String(selectedAddress.latitude));
      params.set("lng", String(selectedAddress.longitude));
    }
    if (selectedAddress?.city) params.set("city", selectedAddress.city);

    fetch(`/api/discovery/day-trip?${params.toString()}`)
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
    return `/trip-builder/day-trip/discover/category?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-bg pb-36">
      {/* 1. TOP BAR - ממוחזר במלואו מ"הטיולים שלי" (SimpleAppHeader), בלי title. */}
      <SimpleAppHeader onBack={() => router.back()} />

      {/* 2. HERO - full-bleed, בדיוק כמו בכל עמודי ה-result הקיימים
          (hero-day-trip-result.png/hero-weekend.png וכו') - בלי rounded
          corners, בלי shadow, בלי טקסט על גבי התמונה. */}
      <div className="relative w-full">
        <Image
          src="/images/hero-day-trip-result.png"
          alt=""
          width={800}
          height={450}
          priority
          className="h-auto w-full"
        />
      </div>

      {/* 3. שורה: אייקון+"טיול יומי" בצד ימין, מיקום (כמו HomeHeader) בצד שמאל. */}
      <div className="flex items-center justify-between px-6 pt-4">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={DAY_TRIP_CATEGORY.imageSrc} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="text-lg font-bold text-ink">{QUICK_CATEGORY_LABELS.day_trip}</span>
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

      {/* 4. קטגוריות ה-Discovery - תמיד מוצגות (כל סקשן מטפל ב-Empty State בעצמו). */}
      <div className="mt-5 flex flex-col gap-6">
        {dataLoading || !data ? (
          <div className="px-6">
            <div className="h-40 animate-pulse rounded-card bg-bg-secondary" />
          </div>
        ) : (
          <>
            {/* 🔥 הכי חמים עכשיו */}
            <HotPlacesSection places={data.hotPlaces} from="day-trip-discover" />

            {/* 🎪 אירועים ופסטיבלים - מיד אחרי "הכי חמים עכשיו", Featured, תמיד מוצג. */}
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
            writeStoredAddress(address);
            setLocationSheetOpen(false);
          }}
        />
      )}

      {/* 5. Bottom Navigation - ממוחזר במלואו, לא נוצר מחדש. */}
      <MainBottomNav active="home" />
    </div>
  );
}
