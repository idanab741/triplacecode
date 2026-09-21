"use client";

import { UNLIMITED_TRIPS_PROMO } from "@/constants/tokenCosts";
import { TokenBalancePill } from "./TokenBalancePill";

/**
 * "הטריפים שלי" - ליד השם בעמוד התפריט (/profile). בתקופת ההרצה (UNLIMITED_TRIPS_PROMO) אין הגבלה ולכן מוצג "∞ טריפים"
 * (בלי מספר ובלי מונה שיורד); כשהמבצע נגמר - חוזרים אוטומטית לתצוגת היתרה האמיתית (TokenBalancePill: N / 100 + הסבר).
 */
export function TripsBalanceBadge() {
  if (!UNLIMITED_TRIPS_PROMO) return <TokenBalancePill />;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1 text-[12.5px] font-extrabold" style={{ background: "rgba(10,109,254,.1)", color: "#0A6DFE" }}>
      ✦ <span className="text-[15px] leading-none">∞</span> טריפים
    </span>
  );
}
