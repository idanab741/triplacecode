"use client";

import { Suspense } from "react";
import { DiscoveryCategoryPageContent } from "@/screens/discovery/DiscoveryCategoryPageContent";

/**
 * "ראה הכל" לסקשן בודד של "חופשה בארץ" - wrapper דק סביב
 * DiscoveryCategoryPageContent המשותף (ר' שם להסבר המלא).
 */
export default function VacationIlCategoryDiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoveryCategoryPageContent
        apiEndpoint="/api/discovery/vacation-il"
        heroSrc="/images/hero-weekend.png"
        from="vacation-il-discover"
      />
    </Suspense>
  );
}
