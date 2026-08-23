"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { MainBottomNav } from "@/components/MainBottomNav";
import { DiscoveryPlaceCard } from "@/screens/discovery/DiscoveryPlaceCard";
import type { DiscoveryPlace } from "@/services/places/discoveryService";

// Leaflet ניגש ל-window/document ישירות - חייב להיטען רק בצד הלקוח,
// בדיוק כמו ש-ResultMap.tsx כבר נטען בכל שאר עמודי ה-result (dynamic
// import עם ssr:false) - לא מנגנון טעינה חדש.
const DiscoveryPlacesMap = dynamic(
  () => import("@/screens/discovery/DiscoveryPlacesMap").then((m) => m.DiscoveryPlacesMap),
  { ssr: false }
);

interface CategoryApiResponse {
  title: string;
  emoji: string;
  places: DiscoveryPlace[];
}

interface DiscoveryCategoryPageContentProps {
  apiEndpoint: string;
  heroSrc: string;
  from: string;
}

/**
 * תוכן "ראה הכל" משותף (Audit - "אין ליצור Duplicate component"): חולץ
 * מ-day-trip/discover/category, כי vacation-il/discover/category היה
 * זהה כמעט-לגמרי (רק ה-API endpoint וה-Hero שונים). כל עמוד "ראה הכל"
 * הופך ל-wrapper דק שמעביר את הפרמטרים שלו.
 *
 * תיקון (Audit - "רוצה שכל החלק היומי - תהיה מפה עם מיקום ונעץ של כל
 * המקומות... בעמוד ראה עוד"): מפה (DiscoveryPlacesMap.tsx) מוצגת מיד
 * מתחת לכותרת, **לפני** רשימת הכרטיסים - עם נעץ לכל מקום שיש לו
 * קואורדינטות אמיתיות. אם אין תוצאות/קואורדינטות - לא מוצגת מפה ריקה
 * (הרכיב עצמו כבר מחזיר null).
 */
export function DiscoveryCategoryPageContent({ apiEndpoint, heroSrc, from }: DiscoveryCategoryPageContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CategoryApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    fetch(`${apiEndpoint}?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [searchParams, apiEndpoint]);

  return (
    <div className="min-h-screen bg-bg pb-36">
      {/* 1. TOP BAR - זהה בדיוק לעמוד ה-Discovery הראשי. */}
      <SimpleAppHeader onBack={() => router.back()} />

      {/* 2. HERO - full-bleed, זהה בדיוק לעמוד הראשי. */}
      <div className="relative w-full">
        <Image src={heroSrc} alt="" width={800} height={450} priority className="h-auto w-full" />
      </div>

      {/* 3. כותרת הקטגוריה. */}
      <div className="flex items-center gap-2 px-6 pt-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-secondary text-xl shadow-soft">
          {data?.emoji ?? "📍"}
        </span>
        <span className="text-lg font-bold text-ink">{data ? data.title : "טוען..."}</span>
      </div>

      <div className="mt-5 px-6">
        {loading ? (
          <>
            <div className="mb-5 h-56 w-full animate-pulse rounded-card bg-bg-secondary" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-[220px] animate-pulse rounded-card bg-bg-secondary" />
              ))}
            </div>
          </>
        ) : !data || data.places.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-card bg-bg-secondary px-6 py-10 text-center">
            <span className="text-2xl">{data?.emoji ?? "📍"}</span>
            <p className="text-sm font-medium text-ink">אין כרגע יעדים זמינים</p>
            <p className="text-xs text-ink-secondary">נחזור עם המלצות חדשות בקרוב</p>
          </div>
        ) : (
          <>
            <DiscoveryPlacesMap places={data.places} />
            <div className="grid grid-cols-2 gap-3">
              {data.places.map((place) => (
                <DiscoveryPlaceCard key={place.id} place={place} from={from} fixedWidth={false} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. Bottom Navigation - ממוחזר במלואו, זהה לעמוד הראשי. */}
      <MainBottomNav active="home" />
    </div>
  );
}
