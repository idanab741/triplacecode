"use client";

import { Suspense } from "react";
import { DiscoveryCategoryPageContent } from "@/screens/discovery/DiscoveryCategoryPageContent";

/**
 * "ראה הכל" לסקשן בודד של "מסעדות וקפה" - wrapper דק סביב
 * DiscoveryCategoryPageContent המשותף (ר' שם להסבר המלא - כבר משמש גם
 * את טיול יומי וגם חופשה בארץ, לא נוצר רכיב חדש).
 */
export default function RestaurantsCafesCategoryDiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoveryCategoryPageContent
        apiEndpoint="/api/discovery/restaurants-cafes"
        heroSrc="/images/hero-restaurants-cafes.png"
        from="restaurants-cafes-discover"
      />
    </Suspense>
  );
}
