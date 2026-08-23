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
  // תיקון Product מפורש (Audit מול "PROMPT 1 - בניית עמוד Discovery"):
  // "טיול יומי" עובר ל-Discovery החדש, לא ל-Trip Builder הישן. ה-Trip
  // Builder הישן (/trip-builder/day-trip) נשאר קיים במלואו, בלי שינוי -
  // פשוט אף כפתור לא מצביע אליו יותר. לא נמחק שום route/flow קיים.
  if (id === "day_trip") return "/trip-builder/day-trip/discover";
  // תיקון Product מפורש (Audit - "מסעדות וקפה - בדיוק כמו חופשה בחו''ל"):
  // "מסעדות וקפה" עובר ל-Discovery החדש, בדיוק כמו שאר הקטגוריות.
  // ה-Trip Builder הישן (/trip-builder/restaurants-cafes) נשאר קיים במלואו.
  if (id === "restaurants_cafes") return "/trip-builder/restaurants-cafes/discover";
  // תיקון Product מפורש (Audit - "דייטים רומנטיים - אותו דבר"): עובר
  // ל-Discovery החדש. ה-Trip Builder הישן (/trip-builder/romantic-date)
  // נשאר קיים במלואו.
  if (id === "romantic_date") return "/trip-builder/romantic-date/discover";
  // תיקון Product מפורש (Audit - "חיי לילה ובילויים - אותו דבר"): עובר
  // ל-Discovery החדש. ה-Trip Builder הישן (/trip-builder/nightlife)
  // נשאר קיים במלואו.
  if (id === "nightlife") return "/trip-builder/nightlife/discover";
  // תיקון Product מפורש (Audit - "חופשה בחו''ל שנבנה עכשיו"): "חו״ל"
  // עובר ל-Discovery החדש, בדיוק כמו "טיול יומי"/"סופ״ש" קודם. ה-Trip
  // Builder הישן (/trip-builder/abroad-vacation) נשאר קיים במלואו.
  if (id === "abroad") return "/trip-builder/abroad-vacation/discover";
  // תיקון Product מפורש (Audit - "טיול בטבע - בדיוק כמו העמודים האחרים"):
  // "טיול בטבע" עובר ל-Discovery החדש. ה-Trip Builder הישן
  // (/trip-builder/nature-trip) נשאר קיים במלואו.
  if (id === "nature_trip") return "/trip-builder/nature-trip/discover";
  // תיקון Product מפורש (Audit מול "חופשה בארץ - עמוד Discovery נפרד"):
  // "סופ"ש" עובר ל-Discovery החדש של "חופשה בארץ", בדיוק כמו ש"טיול
  // יומי" עבר קודם. ה-Trip Builder הישן (/trip-builder/weekend) נשאר
  // קיים במלואו, בלי שינוי - שום route/flow קיים לא נמחק.
  if (id === "weekend") return "/trip-builder/weekend/discover";

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