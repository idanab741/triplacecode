"use client";

import { useRef, useState } from "react";
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
  const [mapTouching, setMapTouching] = useState(false);
  const mapTouchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleMapInteracting(active: boolean) {
    if (mapTouchTimerRef.current) clearTimeout(mapTouchTimerRef.current);
    if (active) setMapTouching(true);
    else mapTouchTimerRef.current = setTimeout(() => setMapTouching(false), 1100);
  }

  return (
    <div className="min-h-screen bg-places-bg pb-0">
      <HomeStatusBarTint color="#1FB3FD" />
      <CollapsibleTopBar variant="colored" tone="blue" headerRow={<PlacesHeaderRow logoTone="white" />}>
        <PlacesTopBarCreate onCreate={() => setCreateMenuOpen(true)} />
      </CollapsibleTopBar>

      {/* הבר הכחול עם פינות מעוגלות - המפה ממשיכה מתחתיהן (marginTop שלילי של 32px). */}
      <div
        className="relative isolate z-0"
        style={{
          marginTop: -32,
          height: "max(472px, calc(100dvh - 40px - 66px - max(env(safe-area-inset-bottom), 22px)))",
        }}
      >
        <PlacesFriendsMap
          onCreate={() => setCreateMenuOpen(true)}
          onInteractingChange={handleMapInteracting}
          topOffsetPx={mapTouching ? 44 : 52}
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
