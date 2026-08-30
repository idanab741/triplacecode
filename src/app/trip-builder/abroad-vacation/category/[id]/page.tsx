"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { MainBottomNav } from "@/components/MainBottomNav";
import { TripHeroHeader } from "@/screens/layout/TripHeroHeader";
import {
  WORLDWIDE_VACATION_CATEGORIES,
  WORLDWIDE_DESTINATION_REGISTRY,
  CRUISE_LINES,
} from "@/constants/worldwideVacationCategories";

/**
 * עמוד קטגוריה נפרד ("בטן גב וחופים", "טיולי תרמילאים" וכו') - כל היעדים
 * של קטגוריה אחת בגריד מלא (לא גלילה אופקית כמו בעמוד הראשי). מגיעים
 * לכאן מ-AbroadPreferencesCategoryGrid (עמוד חופשה בחו''ל הראשי).
 * מחליף (לא מוסיף על) את 16 הרשימות המפורטות שהיו קודם בעמוד הראשי -
 * ר' worldwideVacationCategories.ts להערה על ההחלטה הזו.
 *
 * id="cruise" הוא מקרה מיוחד - רשימת חברות ספנות ולא יעדים גיאוגרפיים.
 *
 * העמוד משתמש באותו Hero ובר עליון כמו עמודי סוגי הטיול:
 * Hero של חופשה בחו"ל + בר שקוף עם חזור ולוגו במרכז.
 */
export default function AbroadVacationCategoryPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [destinationIdBySlug, setDestinationIdBySlug] = useState<
    Record<string, string | null>
  >({});

  useEffect(() => {
    fetch("/api/discovery/worldwide-categories")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setDestinationIdBySlug(json?.matches ?? {}))
      .catch(() => setDestinationIdBySlug({}));
  }, []);

  if (params.id === "cruise") {
    return (
      <div className="min-h-screen bg-bg pb-36">
        <TripHeroHeader
          heroSrc="/images/hero-abroad-vacation.png"
          onBack={() => router.back()}
        />

        <div className="flex items-center gap-2 px-6 pt-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/vacation-type-icons/cruise.png"
              alt=""
              className="h-full w-full object-cover"
            />
          </span>

          <span className="text-lg font-bold text-ink">
            קרוזים ושייט
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pt-5">
          {CRUISE_LINES.map((line) => (
            <div
              key={line.slug}
              className="relative block aspect-[3/4] w-full overflow-hidden rounded-card bg-bg-secondary shadow-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.imageUrl}
                alt={line.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
                <p className="truncate text-sm font-bold leading-tight text-white">
                  {line.name}
                </p>
              </div>
            </div>
          ))}
        </div>

        <MainBottomNav active="home" />
      </div>
    );
  }

  const category = WORLDWIDE_VACATION_CATEGORIES.find(
    (c) => c.id === params.id
  );

  if (!category) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-24 text-center">
          <p className="text-lg font-bold text-ink">
            הקטגוריה לא נמצאה
          </p>

          <Link
            href="/trip-builder/abroad-vacation/discover"
            className="text-sm text-accent"
          >
            חזרה לחופשה בחו״ל
          </Link>
        </div>

        <MainBottomNav active="home" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg pb-36">
      <TripHeroHeader
        heroSrc="/images/hero-abroad-vacation.png"
        onBack={() => router.back()}
      />

      <div className="flex items-center gap-2 px-6 pt-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={category.iconUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </span>

        <span className="text-lg font-bold text-ink">
          {category.title}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 px-6 pt-5">
        {category.destinations.map((ref, i) => {
          const entry = WORLDWIDE_DESTINATION_REGISTRY[ref.slug];

          if (!entry) return null;

          const imageUrl = ref.imageUrl ?? entry.imageUrl;
          const destinationId = destinationIdBySlug[ref.slug];

          const href = destinationId
            ? ref.subtitle
              ? `/destination/${destinationId}?subtitle=${encodeURIComponent(
                  ref.subtitle
                )}`
              : `/destination/${destinationId}`
            : null;

          const cardContent = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={entry.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />

              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
                <p className="truncate text-sm font-bold leading-tight text-white">
                  {entry.flag} {entry.name}
                </p>

                {ref.subtitle && (
                  <p className="truncate text-[11px] text-white/85">
                    {ref.subtitle}
                  </p>
                )}
              </div>
            </>
          );

          const className =
            "relative block aspect-[3/4] w-full overflow-hidden rounded-card bg-bg-secondary shadow-soft";

          return href ? (
            <Link
              key={`${ref.slug}-${i}`}
              href={href}
              className={className}
            >
              {cardContent}
            </Link>
          ) : (
            <div key={`${ref.slug}-${i}`} className={className}>
              {cardContent}
            </div>
          );
        })}
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}