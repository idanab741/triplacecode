"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MainBottomNav } from "@/components/MainBottomNav";
import { HomeStatusBarTint } from "@/screens/home/HomeStatusBarTint";
import { CollapsibleTopBar } from "@/screens/home/CollapsibleTopBar";
import { PlacesHeaderRow } from "@/screens/places/PlacesHeaderRow";
import { PlacesTopBarCreate } from "@/screens/places/PlacesTopBarCreate";
import { CreateMenuSheet } from "@/screens/places/CreateMenuSheet";

// המפה (Leaflet) משתמשת ב-window/DOM - נטענת רק בצד הלקוח.
const PlacesFriendsMap = dynamic(() => import("@/screens/places/PlacesFriendsMap").then((m) => m.PlacesFriendsMap), {
  ssr: false,
});

/**
 * *** עמוד place's = המפה (בקשה מפורשת). אותה מפה בדיוק שהייתה בלשונית "מפה"
 * של הפיד (PlacesFriendsMap), אותו בר סגול עליון, בגובה המסך שנשאר עד הבר
 * התחתון. בלי לשוניות - הפיד עצמו נמצא עכשיו בעמוד הבית. הלוגו יוחלף בהמשך.
 */
export function PlacesMapClient() {
  const router = useRouter();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-places-bg pb-0">
      <HomeStatusBarTint color="#f8f5fc" />
      {/* *** בקשה מפורשת: בר שקוף, לוגו places בסגול - "מרחף" מעל המפה. */}
      {/* *** בקשה מפורשת: שורת החיפוש מופיעה רק במשיכה למטה (כמו בבית). המשיכה נקלטת רק על הבר
          עצמו - גרירה על המפה/הכרטיסים לא פותחת אותה. */}
      <CollapsibleTopBar pullFromBarOnly onRevealChange={setSearchOpen} headerRow={<PlacesHeaderRow badgeTone="purple" />}>
        <PlacesTopBarCreate onCreate={() => setCreateMenuOpen(true)} />
      </CollapsibleTopBar>

      {/* *** תיקון (בקשה מפורשת - "החלוניות של המקומות נופלות למטה כשמתחילים להחליק"): המפה
          כבר לא בזרימת העמוד מתחת לבר - היא שכבה קבועה מראש המסך ועד הבר התחתון, והבר השקוף
          מרחף מעליה. כך גובה הבר (למשל שורת החיפוש) לא יכול להזיז את המפה ואת הכרטיסים. */}
      <div
        className="absolute inset-x-0 top-0 isolate z-0"
        style={{ height: "calc(100dvh - 66px - max(env(safe-area-inset-bottom), 22px))" }}
      >
        <PlacesFriendsMap
          onCreate={() => setCreateMenuOpen(true)}
          // מתחת לבר: שורת הלוגו (52) + pb-3 (12) + מרווח; כששורת החיפוש פתוחה - עוד 64
          topOffsetPx={searchOpen ? 136 : 72}
        />
      </div>

      <MainBottomNav active="places" />

      {createMenuOpen && (
        <CreateMenuSheet
          onClose={() => setCreateMenuOpen(false)}
          onSelectPost={() => router.push("/places/post/create")}
          onSelectPlace={() => router.push("/places/create")}
          onSelectTrip={() => router.push("/places/trip/create")}
        />
      )}
    </div>
  );
}
