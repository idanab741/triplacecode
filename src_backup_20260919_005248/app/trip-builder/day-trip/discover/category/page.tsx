"use client";

import { Suspense } from "react";
import { DiscoveryCategoryPageContent } from "@/screens/discovery/DiscoveryCategoryPageContent";

/**
 * "ראה הכל" לסקשן בודד של "טיול יומי" - wrapper דק סביב
 * DiscoveryCategoryPageContent המשותף (ר' שם להסבר המלא).
 */
export default function CategoryDiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoveryCategoryPageContent
        apiEndpoint="/api/discovery/day-trip"
        heroSrc="/images/hero-day-trip-result.png"
        from="day-trip-discover"
      />
    </Suspense>
  );
}
