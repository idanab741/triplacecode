"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HomeSectionHeader } from "@/screens/home/HomeSectionHeader";
import type { NearbyMapPlace } from "@/screens/home/HomeNearbyMap";
import { getSessionLocation } from "@/utils/sessionLocation";
import { getCurrentPositionSafe } from "@/utils/geolocationSafe";

// Leaflet משתמש ב-window/DOM - נטען רק בצד הלקוח (כמו בכל שאר המקומות באפליקציה).
const HomeNearbyMap = dynamic(() => import("@/screens/home/HomeNearbyMap").then((m) => m.HomeNearbyMap), { ssr: false });

/**
 * "עוד מקומות בקרבת מקום" (בקשה מפורשת): מפה גדולה, וכל המקומות **בתוכה** -
 * כנעצים עם תמונה בתוך הנעץ (כמו הנעצים החדשים של מפת הבית). 4 לשוניות:
 * תצפית / עגלת קפה / פארק / קניון. הנתונים מ-/api/discovery/day-trip לפי המיקום
 * השמור (בלי GPS חדש), והמפה מותאמת לפריים שכולל את המשתמש ואת המקומות הקרובים.
 *
 * טעינה עצלה: שום בקשה (וגם לא Leaflet) לא יוצאת עד שהקטע מתקרב למסך - הוא
 * יושב מתחת לקפל. כל לשונית נטענת פעם אחת ונשמרת בזיכרון הרכיב.
 */
interface TabDef {
  id: "viewpoints" | "coffee_carts_cafes" | "parks_gardens" | "malls";
  label: string;
  /** צורת הרבים בהודעות ("לא מצאנו X"), ובספירה במפה. */
  plural: string;
  /** צבע הלשונית והנעצים - נדגם מהאייקון התלת-ממדי של הלשונית. */
  color: string;
  iconSrc: string;
}

const TABS: TabDef[] = [
  { id: "viewpoints", label: "תצפית", plural: "תצפיות", color: "#6A39C1", iconSrc: "/images/home/nearby-tab-viewpoint.webp" },
  { id: "coffee_carts_cafes", label: "עגלת קפה", plural: "עגלות קפה", color: "#A55F39", iconSrc: "/images/home/nearby-tab-coffee.webp" },
  { id: "parks_gardens", label: "פארק", plural: "פארקים", color: "#5A8933", iconSrc: "/images/home/nearby-tab-park.webp" },
  { id: "malls", label: "קניון", plural: "קניונים", color: "#E2465B", iconSrc: "/images/home/nearby-tab-mall.webp" },
];

type TabId = TabDef["id"];

interface NearbyApiPlace {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[] | null;
  rating: number | null;
  ratingCount: number | null;
  distanceKm: number | null;
  city: string | null;
  subcategoryLabel: string | null;
  openingHours: string[] | null;
}

function toMapPlaces(list: NearbyApiPlace[]): NearbyMapPlace[] {
  return list
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      latitude: p.latitude as number,
      longitude: p.longitude as number,
      imageUrls: p.imageUrls,
      rating: p.rating,
      ratingCount: p.ratingCount,
      distanceKm: p.distanceKm,
      city: p.city,
      subcategoryLabel: p.subcategoryLabel,
      openingHours: p.openingHours,
    }));
}

export function HomeNearbyRow() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [byTab, setByTab] = useState<Partial<Record<TabId, NearbyMapPlace[]>>>({});

  const tab = TABS[tabIndex];

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
    if (!coords || byTab[tab.id]) return;
    const controller = new AbortController();
    fetch(`/api/discovery/day-trip?category=${tab.id}&lat=${coords.lat}&lng=${coords.lng}&limit=20`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setByTab((prev) => ({ ...prev, [tab.id]: toMapPlaces((data.places ?? []) as NearbyApiPlace[]) })))
      .catch((err) => {
        if (err?.name !== "AbortError") setByTab((prev) => ({ ...prev, [tab.id]: [] }));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, tab.id]);

  const places = byTab[tab.id];

  return (
    <section ref={sectionRef} className="flex flex-col gap-3">
      <HomeSectionHeader iconSrc="/images/home/section-nearby.webp" title="עוד מקומות בקרבת מקום" />

      {/* *** בקשה מפורשת ("שהלשוניות יהיו בתוך המפה, בחלק התחתון - על המפה"): המיכל
          אחד - המפה (או ההודעה/הטעינה) ממלאת אותו, והלשוניות מרחפות עליו בתחתית.
          בלי מסגרת מלבנית: רק טבעת עגולה אחת שגולשת אל האייקון שנבחר ומחליפה צבע;
          מעל המפה - הילת טקסט לבנה וצל קל לאייקונים, ומעטפת שקופה-לבנה עדינה
          בתחתית, כדי שהכל יישאר קריא על גבי המפה. */}
      <div className="px-5">
        <div className="relative isolate z-0 h-[420px] w-full overflow-hidden rounded-[28px] shadow-[0_18px_40px_-16px_rgba(20,50,110,0.45)]">
          {locationError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-bg-secondary px-6 pb-20 text-center">
              <p className="text-sm font-medium text-ink">לא הצלחנו לאתר את המיקום שלכם</p>
              <p className="text-xs text-ink-secondary">יש לאשר גישה למיקום כדי לראות מקומות בקרבתכם</p>
            </div>
          ) : !coords || places === undefined ? (
            <div className="absolute inset-0 animate-pulse bg-bg-secondary" />
          ) : places.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-bg-secondary px-6 pb-20 text-center">
              <p className="text-sm font-medium text-ink">לא מצאנו {tab.plural} בקרבתכם כרגע</p>
              <p className="text-xs text-ink-secondary">נסו לשונית אחרת</p>
            </div>
          ) : (
            <HomeNearbyMap
              places={places}
              userLocation={coords}
              pinColor={tab.color}
              countLabel={tab.plural}
              categoryLabel={tab.label}
              categoryIconSrc={tab.iconSrc}
            />
          )}

          {/* מעטפת עדינה בתחתית - קריאות הלשוניות */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[999] h-28 bg-gradient-to-t from-white/80 via-white/40 to-transparent"
          />

          {/* הלשוניות - על המפה */}
          <div className="absolute inset-x-3 bottom-6 z-[1000]">
            <div role="tablist" aria-label="סוג מקום" className="relative grid grid-cols-4">
              {/* הטבעת הנעה: עוטף ברוחב עמודה אחת, translateX שלילי (RTL - הלשונית
                  הראשונה בימין), והטבעת ממורכזת בתוכו */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-0 top-0 flex w-1/4 justify-center"
                style={{
                  transform: `translateX(${-tabIndex * 100}%)`,
                  transition: "transform 420ms cubic-bezier(0.34, 1.3, 0.5, 1)",
                }}
              >
                <span
                  className="block h-[42px] w-[42px] rounded-full border-[2.5px]"
                  style={{
                    borderColor: tab.color,
                    boxShadow: `0 6px 14px -4px ${tab.color}88`,
                    transition: "border-color 320ms ease, box-shadow 320ms ease",
                  }}
                />
              </div>

              {TABS.map((t, i) => {
                const selected = i === tabIndex;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setTabIndex(i)}
                    className="relative z-10 flex flex-col items-center gap-[3px] text-[12px] font-bold transition-colors duration-300 active:scale-[0.96]"
                    style={{
                      color: selected ? t.color : "var(--color-ink)",
                      textShadow: "0 0 3px #fff, 0 0 6px #fff, 0 0 10px #fff",
                    }}
                  >
                    <span className="flex h-[42px] w-[42px] items-center justify-center">
                      <Image
                        src={t.iconSrc}
                        alt=""
                        width={32}
                        height={32}
                        className="h-8 w-8 object-contain transition-all duration-300"
                        style={{
                          transform: selected ? "scale(1.04)" : "scale(0.92)",
                          opacity: selected ? 1 : 0.85,
                          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.28))",
                        }}
                      />
                    </span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
