"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HomeSectionHeader } from "@/screens/home/HomeSectionHeader";
import { getSessionLocation } from "@/utils/sessionLocation";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

// Leaflet משתמש ב-window/DOM - נטען רק בצד הלקוח (כמו בכל שאר המקומות באפליקציה).
const DiscoveryPlacesMap = dynamic(
  () => import("@/screens/discovery/DiscoveryPlacesMap").then((m) => m.DiscoveryPlacesMap),
  { ssr: false }
);

/**
 * *** חדש (בקשה מפורשת - "עוד מקומות בקרבת מקום", עם אייקון המפה): מפה +
 * רשימת יעדים, מחולקת ל-4 לשוניות: תצפית / עגלת קפה / פארק / קניון.
 * הנתונים מאותו API של Discovery (/api/discovery/day-trip?category=...) לפי
 * המיקום של המשתמש (המיקום השמור מהעמוד, בלי GPS חדש) - ממוין לפי קרבה.
 *
 * טעינה עצלה: שום בקשה (וגם לא Leaflet) לא יוצאת עד שהקטע מתקרב למסך - הוא
 * יושב מתחת לקפל, ואין סיבה להכביד על הטעינה הראשונית של עמוד הבית.
 * כל לשונית נטענת פעם אחת ונשמרת בזיכרון הרכיב.
 */
const TABS = [
  { id: "viewpoints", label: "תצפית", emoji: "🌄", empty: "תצפיות" },
  { id: "coffee_carts_cafes", label: "עגלת קפה", emoji: "☕", empty: "עגלות קפה" },
  { id: "parks_gardens", label: "פארק", emoji: "🌳", empty: "פארקים" },
  { id: "malls", label: "קניון", emoji: "🏬", empty: "קניונים" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface NearbyPlace {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[] | null;
  category: string | null;
  subcategoryLabel: string | null;
  rating: number | null;
  distanceKm: number | null;
  city: string | null;
}

const LIST_LIMIT = 8;

function formatDistance(km: number | null): string | null {
  if (km == null) return null;
  return km < 1 ? `${Math.max(50, Math.round(km * 20) * 50)} מ'` : `${km.toFixed(1)} ק"מ`;
}

export function HomeNearbyRow() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [tab, setTab] = useState<TabId>("viewpoints");
  const [byTab, setByTab] = useState<Partial<Record<TabId, NearbyPlace[]>>>({});

  // 1) מתחילים לטעון רק כשהקטע מתקרב למסך.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 2) מיקום: השמור מהעמוד (מיידי), אחרת GPS.
  useEffect(() => {
    if (!visible || coords) return;
    const saved = getSessionLocation();
    if (saved) {
      setCoords({ lat: saved.lat, lng: saved.lng });
      return;
    }
    getCurrentPositionSafe()
      .then(setCoords)
      .catch(() => setLocationError(true));
  }, [visible, coords]);

  // 3) נתוני הלשונית הנבחרת - פעם אחת לכל לשונית.
  useEffect(() => {
    if (!coords || byTab[tab]) return;
    const controller = new AbortController();
    fetch(`/api/discovery/day-trip?category=${tab}&lat=${coords.lat}&lng=${coords.lng}&limit=20`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setByTab((prev) => ({ ...prev, [tab]: (data.places ?? []) as NearbyPlace[] })))
      .catch((err) => {
        if (err?.name !== "AbortError") setByTab((prev) => ({ ...prev, [tab]: [] }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, tab]);

  const places = byTab[tab];
  const activeTab = TABS.find((t) => t.id === tab)!;

  return (
    <section ref={sectionRef} className="flex flex-col gap-3">
      <HomeSectionHeader iconSrc="/images/home/section-nearby.webp" title="עוד מקומות בקרבת מקום" />

      {/* לשוניות */}
      <div className="grid grid-cols-4 gap-2 px-5" role="tablist">
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 text-[12.5px] font-bold transition active:scale-[0.97] ${
                selected ? "text-white shadow-[0_8px_18px_-8px_rgba(24,119,242,0.85)]" : "bg-bg-secondary text-ink"
              }`}
              style={selected ? { background: "linear-gradient(135deg, var(--color-primary-start), var(--color-primary-end))" } : undefined}
            >
              <span className="text-[18px] leading-none" aria-hidden="true">
                {t.emoji}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* מפה */}
      <div className="px-5">
        {locationError ? (
          <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-card bg-bg-secondary px-6 text-center">
            <p className="text-sm font-medium text-ink">לא הצלחנו לאתר את המיקום שלכם</p>
            <p className="text-xs text-ink-secondary">יש לאשר גישה למיקום כדי לראות מקומות בקרבתכם</p>
          </div>
        ) : !coords || places === undefined ? (
          <div className="h-56 animate-pulse rounded-card bg-bg-secondary" />
        ) : places.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center gap-1 rounded-card bg-bg-secondary px-6 text-center">
            <p className="text-sm font-medium text-ink">לא מצאנו {activeTab.empty} בקרבתכם כרגע</p>
            <p className="text-xs text-ink-secondary">נסו לשונית אחרת</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card shadow-soft">
            <DiscoveryPlacesMap places={places} userLocation={coords} />
          </div>
        )}
      </div>

      {/* רשימת היעדים */}
      {places && places.length > 0 && (
        <ul className="flex flex-col gap-2.5 px-5">
          {places.slice(0, LIST_LIMIT).map((p) => {
            const distance = formatDistance(p.distanceKm);
            const image = p.imageUrls?.[0];
            return (
              <li key={p.id}>
                <Link
                  href={`/place/${p.id}`}
                  className="flex items-center gap-3 rounded-card bg-white p-2.5 shadow-soft transition active:scale-[0.99]"
                >
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" loading="lazy" draggable={false} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-bg-secondary text-2xl" aria-hidden="true">
                      {activeTab.emoji}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-secondary">
                      {distance && <span className="font-semibold text-accent">{distance}</span>}
                      {distance && (p.rating != null || p.city) && <span className="opacity-50">·</span>}
                      {p.rating != null && (
                        <span className="flex items-center gap-0.5">
                          <span className="text-[#FFC94A]">★</span>
                          {p.rating.toFixed(1)}
                        </span>
                      )}
                      {p.rating != null && p.city && <span className="opacity-50">·</span>}
                      {p.city && <span className="truncate">{p.city}</span>}
                    </p>
                  </div>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-secondary" aria-hidden="true">
                    <path d="m14 6-6 6 6 6" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
