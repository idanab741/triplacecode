"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  QUICK_CATEGORIES,
  QUICK_CATEGORY_SEARCH_LINKS,
  type QuickCategoryId,
} from "@/constants/quickCategories";
import { QUICK_CATEGORY_LABELS } from "@/locales/he/quickCategories";

function buildSearchHref(id: QuickCategoryId): string {
  if (id === "day_trip") return "/trip-builder/day-trip";
  if (id === "restaurants_cafes") return "/trip-builder/restaurants-cafes";
  if (id === "romantic_date") return "/trip-builder/romantic-date";
  if (id === "nightlife") return "/trip-builder/nightlife";
  if (id === "abroad") return "/trip-builder/abroad-vacation";
  if (id === "nature_trip") return "/trip-builder/nature-trip";
  if (id === "weekend") return "/trip-builder/weekend";

  const link = QUICK_CATEGORY_SEARCH_LINKS[id as QuickCategoryId];
  if (link.categories) return `/search?category=${link.categories.join(",")}`;
  if (link.query) return `/search?q=${encodeURIComponent(link.query)}`;
  return "/search";
}

/** קטגוריות מהירות בגלילה אופקית. */
export function QuickCategories() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // מוודא שהרצועה תמיד מתחילה בהתחלה (מימין, כי RTL), גם אם הדפדפן/HMR שמרו מיקום גלילה ישן
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, []);

  return (
    <div
      ref={scrollRef}
      className="flex gap-4 overflow-x-auto px-6 pb-1"
      style={{ scrollbarWidth: "none" }}
    >
      {QUICK_CATEGORIES.map((category) => (
        <Link
          key={category.id}
          href={buildSearchHref(category.id)}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <span
className="flex h-15 w-15 items-center justify-center overflow-hidden rounded-full shadow-soft"          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={category.imageSrc}
              alt={QUICK_CATEGORY_LABELS[category.id]}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="text-xs font-medium text-ink">
            {QUICK_CATEGORY_LABELS[category.id]}
          </span>
        </Link>
      ))}
    </div>
  );
}