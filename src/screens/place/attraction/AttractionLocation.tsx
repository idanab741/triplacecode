"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/ui/Icon";
import { CarIcon, PlaneIcon } from "./icons";

const ResultMap = dynamic(() => import("@/screens/trip-builder/ResultMap").then((m) => m.ResultMap), { ssr: false });

const AVERAGE_CITY_DRIVING_KMH = 35;
const MAX_DRIVING_KM = 400;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDrive(minutes: number): { value: string; unit: string } {
  if (minutes < 60) return { value: String(minutes), unit: "דק׳ נסיעה" };
  const h = Math.floor(minutes / 60);
  const m = Math.round((minutes % 60) / 5) * 5;
  return { value: m ? `${h}:${String(m).padStart(2, "0")}` : String(h), unit: m ? "שעות נסיעה" : h === 1 ? "שעת נסיעה" : "שעות נסיעה" };
}

function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString("he-IL");
}

type DistanceState = { status: "loading" } | { status: "denied" } | { status: "ready"; km: number };

/**
 * מרחק ממך (מעל המפה) + מפה + Waze / Google Maps.
 * *** עיצוב מחדש (בקשה מפורשת - "להשאיר את המרחק מעל המפה, בעיצוב מנצח"): במקום פס אפור עם אימוג'י
 * ו"מחשב זמן הגעה...", המספר הוא הגיבור - זמן הנסיעה גדול ובולט, והמרחק בק"מ מתחתיו. בזמן החישוב
 * מוצג שלד באותו גודל (בלי קפיצה), ואם אין הרשאת מיקום - השורה פשוט לא מוצגת.
 */
export function AttractionLocation({ placeId, latitude, longitude }: { placeId: string; latitude: number; longitude: number }) {
  const [distance, setDistance] = useState<DistanceState>({ status: "loading" });

  useEffect(() => {
    if (!navigator.geolocation) {
      setDistance({ status: "denied" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setDistance({ status: "ready", km: haversineKm(pos.coords.latitude, pos.coords.longitude, latitude, longitude) }),
      () => setDistance({ status: "denied" }),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  }, [latitude, longitude]);

  const drivable = distance.status === "ready" && distance.km <= MAX_DRIVING_KM;
  const drive = distance.status === "ready" && drivable ? formatDrive(Math.max(1, Math.round((distance.km / AVERAGE_CITY_DRIVING_KMH) * 60))) : null;

  return (
    <section className="px-5 pt-6">
      <h2 className="text-[17px] font-bold text-ink">איך מגיעים</h2>

      {distance.status !== "denied" && (
        <div className="mt-3 flex items-center gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#0A6DFE]">
            {distance.status === "ready" && !drivable ? <PlaneIcon /> : <CarIcon />}
          </span>
          {distance.status === "loading" ? (
            <span className="flex flex-col gap-2" aria-label="מחשב מרחק">
              <span className="h-5 w-32 animate-pulse rounded-md bg-black/[0.07]" />
              <span className="h-3.5 w-24 animate-pulse rounded-md bg-black/[0.05]" />
            </span>
          ) : (
            <span className="min-w-0">
              {drive ? (
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[26px] font-bold leading-none tracking-tight text-ink tabular-nums">{drive.value}</span>
                  <span className="text-[15px] font-semibold text-ink">{drive.unit}</span>
                </span>
              ) : (
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[26px] font-bold leading-none tracking-tight text-ink tabular-nums">
                    {formatKm((distance as { km: number }).km)}
                  </span>
                  <span className="text-[15px] font-semibold text-ink">ק״מ ממך</span>
                </span>
              )}
              <span className="mt-1 block text-[13px] text-ink-secondary">
                {drive ? `${formatKm((distance as { km: number }).km)} ק״מ ממך · הערכה לפי נסיעה בעיר` : "מרחק טיסה מהמיקום שלך"}
              </span>
            </span>
          )}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl [&_.tm-result-map]:rounded-2xl [&_.tm-result-map]:shadow-none">
        <ResultMap stops={[{ stopId: placeId, name: "", latitude, longitude }]} heightClassName="h-48" />
      </div>

      <div className="mt-3 flex gap-2.5">
        <a
          href={`https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-12 rounded-xl text-[15.5px] font-semibold flex flex-1 items-center justify-center gap-2 bg-[#EFF1F4] text-ink transition active:scale-[0.98]"
        >
          <Icon name="waze" size={24} />
          Waze
        </a>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-12 rounded-xl text-[15.5px] font-semibold flex flex-1 items-center justify-center gap-2 bg-[#EFF1F4] text-ink transition active:scale-[0.98]"
        >
          <Icon name="google-maps" size={21} />
          Google Maps
        </a>
      </div>
    </section>
  );
}
