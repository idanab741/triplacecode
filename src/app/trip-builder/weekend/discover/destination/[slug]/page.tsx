"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { MainBottomNav } from "@/components/MainBottomNav";
import { SimpleAppHeader } from "@/screens/layout/SimpleAppHeader";
import { ISRAEL_VACATION_DESTINATIONS } from "@/constants/israelVacationDestinations";
import { DiscoverySection } from "@/screens/discovery/DiscoverySection";
import { HotPlacesSection } from "@/screens/discovery/HotPlacesSection";
import type { DiscoveryPlace } from "@/services/places/discoveryService";

interface VacationApiResponse {
  hotPlaces: DiscoveryPlace[];
  sections: { id: string; emoji: string; title: string; places: DiscoveryPlace[] }[];
}

/**
 * עמוד יעד ספציפי בתוך "חופשה בארץ" (Audit - "שכל אחד מהם יהיה כמו
 * עמוד 'מותאם בשבילך' עם אטרקציות, מלונות וכו'"): **אותם** סקשנים
 * בדיוק כמו vacation-il/discover/page.tsx (אותו API, אותם רכיבים -
 * HotPlacesSection/DiscoverySection) - ההבדל היחיד הוא שהמיקום קבוע
 * מראש (קואורדינטות היעד, לא נבחר ע"י המשתמש) ואין בורר מיקום/קרוסלת
 * יעדים (כבר בתוך יעד ספציפי). לא נוצר API/service נפרד - אותו
 * `/api/discovery/vacation-il` בדיוק, רק עם lat/lng קבועים בשאילתה.
 */
export default function VacationDestinationPage() {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const destination = ISRAEL_VACATION_DESTINATIONS.find((d) => d.slug === params.slug);

  const [data, setData] = useState<VacationApiResponse | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!destination) {
      setDataLoading(false);
      return;
    }
    const params = new URLSearchParams({ lat: String(destination.lat), lng: String(destination.lng) });
    fetch(`/api/discovery/vacation-il?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setDataLoading(false));
  }, [destination]);

  function buildSeeAllHref(sectionId: string): string {
    if (!destination) return "#";
    const params = new URLSearchParams({
      category: sectionId,
      lat: String(destination.lat),
      lng: String(destination.lng),
    });
    return `/trip-builder/weekend/discover/category?${params.toString()}`;
  }

  if (!destination) {
    return (
      <div className="min-h-screen bg-bg pb-36">
        <SimpleAppHeader onBack={() => router.back()} />
        <p className="px-6 pt-10 text-center text-sm text-ink-secondary">היעד לא נמצא.</p>
        <MainBottomNav active="home" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-36">
      {/* 1. TOP BAR - זהה בדיוק לעמוד "חופשה בארץ" הראשי. */}
      <SimpleAppHeader onBack={() => router.back()} />

      {/* 2. HERO - full-bleed, אותה תמונת חופשה בארץ (עד שיגיעו תמונות
          ייעודיות ליעד עצמו). */}
      <div className="relative w-full">
        <Image src="/images/hero-weekend.png" alt="" width={800} height={450} priority className="h-auto w-full" />
      </div>

      {/* 3. שם היעד. */}
      <div className="px-6 pt-4">
        <h1 className="text-2xl font-bold text-ink">{destination.name}</h1>
        <p className="mt-1 text-sm text-ink-secondary">אטרקציות, מלונות וחוויות באזור {destination.name}</p>
      </div>

      <div className="mt-5 flex flex-col gap-6">
        {dataLoading || !data ? (
          <div className="px-6">
            <div className="h-40 animate-pulse rounded-card bg-bg-secondary" />
          </div>
        ) : (
          <>
            <HotPlacesSection
              places={data.hotPlaces}
              from="vacation-il-discover"
              title={`🔥 הכי חמים ב${destination.name}`}
            />

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

      {/* 4. Bottom Navigation - ממוחזר במלואו. */}
      <MainBottomNav active="home" />
    </div>
  );
}
