"use client";

import { HomeSectionHeader } from "@/screens/home/HomeSectionHeader";
import { DiscoverCard } from "@/screens/home/DiscoverCard";

/**
 * *** חדש (בקשה מפורשת - "גלה עוד ב-triplace", עם האייקון של הקמע בבינוקל):
 * כותרת עם לוגו-הטקסט של triplace, ומתחתיה הקרוסלה הקיימת של "גלה עוד"
 * (DiscoverCard, variant="home") - כרטיסיות RunTrippy / Deals / Place's
 * וכפתור "תפתיעו אותי" (surprise-me-bg). הלוגיקה של הכרטיסיות עצמה לא
 * השתנתה - רק הכותרת עברה לכאן.
 */
export function HomeDiscoverSection() {
  return (
    <section className="flex flex-col gap-3">
      <HomeSectionHeader
        iconSrc="/images/home/section-discover.webp"
        title="גלה עוד ב-"
        titleLogoSrc="/images/triplace-logo-black.png"
      />
      <DiscoverCard variant="home" />
    </section>
  );
}
