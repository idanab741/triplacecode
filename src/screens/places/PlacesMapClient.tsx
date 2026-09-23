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

  return (
    <div className="min-h-screen bg-places-bg pb-0">
      <HomeStatusBarTint color="#f8f5fc" />
      {/* *** בקשה מפורשת: בר שקוף, לוגו places בסגול - "מרחף" מעל המפה. */}
      <CollapsibleTopBar headerRow={<PlacesHeaderRow />}>
        <PlacesTopBarCreate onCreate={() => setCreateMenuOpen(true)} />
      </CollapsibleTopBar>

      {/* הבר שקוף - המפה מתחילה מראש המסך ממש, מתחת לבר (marginTop שלילי
          בגובה הבר: 52px שורה + 12px pb-3 = 64px), והבר מרחף מעליה. */}
      <div
        className="relative isolate z-0"
        style={{
          marginTop: -64,
          height: "max(472px, calc(100dvh - 66px - max(env(safe-area-inset-bottom), 22px)))",
        }}
      >
        <PlacesFriendsMap
          onCreate={() => setCreateMenuOpen(true)}
          topOffsetPx={72}
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
