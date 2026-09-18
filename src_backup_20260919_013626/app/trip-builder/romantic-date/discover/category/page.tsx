"use client";

import { Suspense } from "react";
import { DiscoveryCategoryPageContent } from "@/screens/discovery/DiscoveryCategoryPageContent";

/**
 * "ראה הכל" לסקשן בודד של "דייטים רומנטיים" - wrapper דק סביב
 * DiscoveryCategoryPageContent המשותף (כבר משמש גם את שאר עמודי ה-Discovery).
 */
export default function RomanticDateCategoryDiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoveryCategoryPageContent
        apiEndpoint="/api/discovery/romantic-date"
        heroSrc="/images/hero-romantic-date.png"
        from="romantic-date-discover"
      />
    </Suspense>
  );
}
