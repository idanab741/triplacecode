"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Chip } from "@/components/ui";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

// אותו דפוס דינמי-import בדיוק כמו ב-TripMatch/Discovery (Leaflet
// משתמש ב-window/DOM - לא ניתן ב-SSR) - לא רכיב מפה חדש.
const DiscoveryPlacesMap = dynamic(
  () => import("@/screens/discovery/DiscoveryPlacesMap").then((m) => m.DiscoveryPlacesMap),
  { ssr: false }
);

type NearbyCategory = "coffee" | "sunset" | "food" | "nature" | "nightlife";

/**
 * *** תיקון (Audit - "איפה כל האטרקציות?? יש מלא באיזור שלי - למה הן
 * לא מופיעות???"): הגרסה הקודמת הציגה פינים לדוגמה (mock) קבועים סביב
 * תל אביב, בלי קשר למיקום האמיתי של המשתמש. עכשיו מבקש מיקום אמיתי
 * (getCurrentPositionSafe - אותו utility שכבר עובד גם בתוך אפליקציית
 * Natively, לא navigator.geolocation גולמי) ומושך מקומות אמיתיים
 * מ-3 ה-API-ים הקיימים של Discovery (day-trip/restaurants-cafes/
 * nightlife - כולם כבר תומכים ב-lat/lng+category, לא נבנה endpoint
 * חדש) - לא דאטה מזויף.
 */
/**
 * *** תיקון (Audit - "בבילויים כתוב לי החקר לציפורים!"): המקור היה
 * `/api/discovery/nightlife?category=hot`, שמוגדר (ר' HOT_NIGHTLIFE_
 * CATEGORIES בקובץ ה-route עצמו) לסרוק גם "attractions_activities" -
 * קטגוריה רחבה מדי שכוללת גם דברים כמו תצפית ציפורים, לא רק בילויים.
 * עכשיו סורקים 2 תגיות בילויים ספציפיות אמיתיות (club + cocktail_bar,
 * מתוך אותה טקסונומיה הקיימת ב-nightlife route) ומאחדים - נשאר אך ורק
 * בתחום בילויים, לא "hot" גורף.
 *
 * לגבי "אבו חסן (חומוס) מופיע תחת קפה" - זה *לא* קשור לשאילתה כאן:
 * ☕ קפה שולח category=coffee_carts_cafes בדיוק, בלי "hot"/הרחבה. אם
 * מקום שהוא בעצם מסעדת חומוס עדיין חוזר משם - המקום עצמו מתויג
 * ב-DB תחת coffee_carts_cafes (טעות תיוג באדמין) - לא סינון שגוי כאן.
 * לתקן, צריך לערוך את הקטגוריה של אותו מקום ספציפי באדמין
 * (admin/places), לא בקוד הזה.
 */
const CATEGORY_ENDPOINTS: Record<NearbyCategory, { label: string; urls: string[] }> = {
  coffee: { label: "☕ קפה", urls: ["/api/discovery/day-trip?category=coffee_carts_cafes"] },
  sunset: { label: "🌅 שקיעה", urls: ["/api/discovery/day-trip?category=viewpoints"] },
  food: { label: "🍽️ אוכל", urls: ["/api/discovery/restaurants-cafes?category=hot"] },
  nature: { label: "🌿 טבע", urls: ["/api/discovery/day-trip?category=nature_trails"] },
  nightlife: {
    label: "🎉 בילויים",
    urls: ["/api/discovery/nightlife?category=club", "/api/discovery/nightlife?category=cocktail_bar"],
  },
};
const CATEGORY_ORDER: NearbyCategory[] = ["coffee", "sunset", "food", "nature", "nightlife"];

interface NearbyPlace {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  // *** תיקון (בקשת המשתמש - תמונה בבועה בלחיצה על פין): השדות האלה
  // כבר חוזרים מכל ה-API-ים ב-CATEGORY_ENDPOINTS (day-trip/
  // restaurants-cafes/nightlife מחזירים DiscoveryPlace מלא) - רק לא
  // היו מוגדרים בטיפוס המקומי כאן, אז לא זרמו הלאה ל-DiscoveryPlacesMap.
  imageUrls?: string[] | null;
  subcategoryLabel?: string | null;
}

export function NearbySection() {
  const [selected, setSelected] = useState<NearbyCategory>("coffee");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [places, setPlaces] = useState<NearbyPlace[] | null>(null);

  useEffect(() => {
    getCurrentPositionSafe()
      .then(setCoords)
      .catch(() => setLocationError(true));
  }, []);

  useEffect(() => {
    if (!coords) return;
    setPlaces(null);
    const { urls } = CATEGORY_ENDPOINTS[selected];
    const controller = new AbortController();
    Promise.all(
      urls.map((url) =>
        fetch(`${url}&lat=${coords.lat}&lng=${coords.lng}&limit=8`, { signal: controller.signal })
          .then((res) => res.json())
          .then((data) => data.places ?? [])
          .catch(() => [])
      )
    )
      .then((lists) => {
        // מאחדים ומנקים כפילויות - גם לפי id (מקום שחוזר משני תגי בילויים
        // גם יחד) וגם לפי שם מנורמל (Audit - "אסור שיהיה אותה פעילות
        // פעמיים" - אותו תיקון כמו ב-PersonalizedMatchesSection: לפעמים
        // אותו מקום קיים כשתי רשומות שונות ב-DB עם id שונה).
        const mergedById = new Map<string, NearbyPlace>();
        const seenNames = new Set<string>();
        for (const list of lists) {
          for (const p of list as NearbyPlace[]) {
            const normalizedName = p.name.trim().toLowerCase();
            if (mergedById.has(p.id) || seenNames.has(normalizedName)) continue;
            mergedById.set(p.id, p);
            seenNames.add(normalizedName);
          }
        }
        setPlaces(Array.from(mergedById.values()).slice(0, 12));
      })
      .catch(() => setPlaces([]));
    return () => controller.abort();
  }, [coords, selected]);

  const mapPlaces = useMemo(() => places ?? [], [places]);

  return (
    <section className="px-6">
      <h3 className="text-lg font-semibold tracking-tight text-ink">🗺️ מה קורה סביבכם?</h3>
      <p className="mt-0.5 text-sm text-ink-secondary">דברים ששווים עכשיו</p>

      <div className="mt-3 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1" style={{ scrollbarWidth: "none" }}>
        {CATEGORY_ORDER.map((id) => (
          <div key={id} className="shrink-0 whitespace-nowrap">
            <Chip selected={selected === id} onClick={() => setSelected(id)}>
              {CATEGORY_ENDPOINTS[id].label}
            </Chip>
          </div>
        ))}
      </div>

      <div className="mt-3">
        {locationError ? (
          <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-card bg-bg-secondary text-center">
            <p className="text-sm font-medium text-ink">לא הצלחנו לאתר את המיקום שלכם</p>
            <p className="text-xs text-ink-secondary">יש לאשר גישה למיקום כדי לראות מה קורה סביבכם</p>
          </div>
        ) : !coords || places === null ? (
          <div className="h-56 animate-pulse rounded-card bg-bg-secondary" />
        ) : places.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-card bg-bg-secondary text-center">
            <p className="text-sm font-medium text-ink">לא מצאנו משהו קרוב כרגע</p>
            <p className="text-xs text-ink-secondary">בואו ננסה קטגוריה אחרת</p>
          </div>
        ) : (
          <DiscoveryPlacesMap places={mapPlaces} />
        )}
      </div>
    </section>
  );
}
