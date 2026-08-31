"use client";

import { useRouter } from "next/navigation";
import { PlacesHeader } from "@/screens/places/PlacesHeader";

/** מסך זה מוצג בכנות כ"טרם נבנה" ולא כ-Mock פעיל, בהתאם לכלל 121
 *  באפיון ("אסור: Coming Soon / אין כפתורים שעושים כלום") - אין כאן
 *  שום אלמנט אינטראקטיבי שמעמיד פנים שהוא Chat אמיתי. מערכת ה-Chat
 *  המלאה (Direct/Group/Trip, Presence, Typing, Read State) היא שלב 2
 *  המלא באפיון (סעיף 42-45, 80-81, 107, 114) ותיבנה כיחידה שלמה
 *  ועובדת מקצה לקצה, לא כ-UI חלקי. */
export default function PlacesChatPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-white">
      <PlacesHeader onBack={() => router.push("/places")} />
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="text-3xl">💬</span>
        <h1 className="text-[16px] font-bold text-ink">Chat ב-place&apos;s</h1>
        <p className="max-w-xs text-[13.5px] text-ink-secondary">
          מערכת ה-Chat החברתית (הודעות אישיות, קבוצות וצ&apos;אט של טיולים) היא חלק משלב 2 בבניית place&apos;s, ועדיין לא זמינה.
        </p>
      </div>
    </div>
  );
}
