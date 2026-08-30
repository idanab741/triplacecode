"use client";

import { Suspense } from "react";
import { DiscoveryCategoryPageContent } from "@/screens/discovery/DiscoveryCategoryPageContent";

/**
 * "ראה הכל" לסקשן בודד של "טיול בטבע" - wrapper דק סביב
 * DiscoveryCategoryPageContent המשותף (כבר משמש גם את שאר עמודי ה-Discovery).
 */
export default function NatureTripCategoryDiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoveryCategoryPageContent
        apiEndpoint="/api/discovery/nature-trip"
        heroSrc="/images/hero-nature-trip.png"
        from="nature-trip-discover"
      />
    </Suspense>
  );
}
