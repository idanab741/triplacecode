"use client";

import { Suspense } from "react";
import { DiscoveryCategoryPageContent } from "@/screens/discovery/DiscoveryCategoryPageContent";

/**
 * "ראה הכל" לסקשן בודד של "חיי לילה ובילויים" - wrapper דק סביב
 * DiscoveryCategoryPageContent המשותף (כבר משמש גם את שאר עמודי ה-Discovery).
 */
export default function NightlifeCategoryDiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoveryCategoryPageContent
        apiEndpoint="/api/discovery/nightlife"
        heroSrc="/images/hero-nightlife.png"
        from="nightlife-discover"
        dark
      />
    </Suspense>
  );
}
