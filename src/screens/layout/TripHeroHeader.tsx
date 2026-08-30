"use client";

import type { ReactNode } from "react";
import Image from "next/image";

interface TripHeroHeaderProps {
  heroSrc: string;
  heroAlt?: string;
  onBack: () => void;
  /** תוכן חופשי בצד ימין (למשל SaveTripIconButton + כפתור שיתוף). */
  rightSlot?: ReactNode;
  /** true כשהאזור העליון של תמונת ה-HERO כהה מספיק כדי שהלוגו והאייקונים
   * צריכים להיות לבנים. */
  dark?: boolean;
}

/**
 * כש-dark=true - הופך את הלוגו/אייקונים ללבן מלא,
 * עם drop-shadow כהה עדין לקריאות.
 */
export const WHITE_ICON_FILTER =
  "brightness-0 invert drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]";

/**
 * נשמר כ-export לצורך תאימות לעמודים קיימים שמייבאים אותו.
 * ריק בכוונה - אין יותר glow/הילה באזורים בהירים.
 */
export const LIGHT_AREA_ICON_STYLE = "";

/**
 * הבר העליון שקוף ויושב מעל תמונת ה-HERO.
 * כפתור חזרה משמאל, לוגו TRIPLACE ממורכז אמיתי באמצע,
 * ותוכן חופשי (rightSlot) בצד ימין.
 */
export function TripHeroHeader({
  heroSrc,
  heroAlt = "",
  onBack,
  rightSlot,
  dark = false,
}: TripHeroHeaderProps) {
  return (
    <div className="relative w-full">
      <Image
        src={heroSrc}
        alt={heroAlt}
        width={800}
        height={450}
        priority
        className="h-auto w-full"
      />

      <header className="absolute inset-x-0 top-0 z-30 w-full">
        <div className="relative flex h-16 items-center justify-center px-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="חזרה"
            className="absolute left-2 flex h-10 w-10 shrink-0 items-center justify-center"
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke={dark ? "white" : "black"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={
                dark
                  ? "drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
                  : ""
              }
            >
              <path d="m14 6-6 6 6 6" />
            </svg>
          </button>

          <Image
            src="/images/triplace-logo-black.png"
            alt=""
            width={140}
            height={43}
            className={`object-contain ${
              dark ? WHITE_ICON_FILTER : ""
            }`}
          />

          {rightSlot && (
            <div className="absolute right-2 flex items-center gap-1">
              {rightSlot}
            </div>
          )}
        </div>
      </header>
    </div>
  );
}