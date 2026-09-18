"use client";

import { MainBottomNav } from "@/components/MainBottomNav";
import { TripWorldHeader } from "@/screens/tripworld/TripWorldHeader";
import { DiscoverCard } from "@/screens/home/DiscoverCard";
import { MyTripsSection } from "@/screens/home/MyTripsSection";
import { TrendingSection } from "@/screens/home/TrendingSection";
import { PersonalizedMatchesSection } from "@/screens/home/PersonalizedMatchesSection";
import { NearbySection } from "@/screens/home/NearbySection";
import { CommunitySection } from "@/screens/home/CommunitySection";
import { PartnersSection } from "@/screens/home/PartnersSection";

/**
 * *** עמוד TripWorld חדש (פרומפט - "יצירת עמוד TripWorld, שלב 1"):
 * מרכז את כל תוכן הגילוי שהיה בעבר מוצג ב-Home מתחת לאזור האפור/
 * לבנדר (DiscoverCard/MyTripsSection/TrendingSection/
 * PersonalizedMatchesSection/NearbySection/CommunitySection/
 * PartnersSection). אלה אותם קומפוננטים בדיוק, ללא שינוי בלוגיקה/
 * עיצוב שלהם - רק הועברו לעמוד משלהם, באותו הסדר שהיה קיים ב-Home
 * (סעיף 3 בפרומפט - "יש לשמור ככל האפשר על הסדר הקיים"). לא נבנה
 * שום section חדש ולא הומצא תוכן.
 *
 * ב-Home עצמו הקומפוננטים האלה כבר לא מיובאים/מוצגים (הוסרו משם
 * בפרומפט קודם) - אין כפילות בין שני העמודים.
 */
export default function TripWorldPage() {
  return (
    <div className="min-h-screen bg-bg pb-28">
      <TripWorldHeader />

      <div className="mx-auto flex max-w-xl flex-col gap-6 pb-6 pt-5">
        <DiscoverCard />
        <MyTripsSection />
        <TrendingSection />
        <PersonalizedMatchesSection />
        <NearbySection />
        <CommunitySection />
        <PartnersSection />
      </div>

      <MainBottomNav active="tripworld" />
    </div>
  );
}
