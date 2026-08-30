"use client";

import { useState } from "react";
import Link from "next/link";
import { ALL_ABROAD_PREFERENCE_TILES, type AbroadPreferenceCategoryTile } from "@/constants/abroadPreferenceCategoryMap";

interface AbroadPreferencesCategoryGridProps {
  /** vacation_preferences של המשתמש (ריק/undefined = לא סימן כלום -
   *  במקרה כזה מציגים ישר את כל הרשימה, בלי "ראה עוד"). */
  userPreferenceValues: string[] | undefined;
}

function Tile({ tile }: { tile: AbroadPreferenceCategoryTile }) {
  return (
    <Link
      href={`/trip-builder/abroad-vacation/category/${tile.categoryId}`}
      className="relative block aspect-[4/3] overflow-hidden rounded-xl bg-bg-secondary"
    >
      {tile.imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tile.imageSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div
          className="h-full w-full"
          style={{ background: "linear-gradient(135deg, rgba(74,158,255,0.25), rgba(27,111,232,0.35))" }}
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(0deg,rgba(0,0,0,.55)_0%,transparent_100%)]" />
      <span className="absolute bottom-1.5 right-2 left-2 truncate text-xs font-semibold leading-tight text-white">
        {tile.label}
      </span>
    </Link>
  );
}

/**
 * גריד "בחר לפי סוג חופשה" בראש עמוד חופשה בחו''ל: אריחי-תמונה
 * מלבניים (לא ריבועיים - תואם ליחס הרוחב-גובה של תמונות ההעדפה
 * בפועל), אחד לכל קטגוריית העדפה (מ-vacation_preferences בעמוד
 * ההעדפות האישיות, כולל "קרוזים ושייט"), לחיצה מובילה לעמוד קטגוריה
 * נפרד עם כל היעדים שלה (/trip-builder/abroad-vacation/category/[id]).
 *
 * תיקון Product: 3 בשורה (לא 4 - "קטן מדי") כדי שהאריחים יהיו גדולים
 * וברורים יותר, בלי אימוג'י בכיתוב, גרדיאנט עדין (רק חצי תחתון).
 *
 * ברירת מחדל: מציג רק את הקטגוריות שהמשתמש סימן בהעדפות שלו + כפתור
 * "ראה עוד קטגוריות" שמרחיב לכל הרשימה. אם למשתמש אין העדפות שמורות
 * בכלל - מציג ישר את כל הרשימה (אין מה לצמצם).
 */
export function AbroadPreferencesCategoryGrid({ userPreferenceValues }: AbroadPreferencesCategoryGridProps) {
  const [expanded, setExpanded] = useState(false);

  const selectedSet = new Set(userPreferenceValues ?? []);
  const hasSelection = selectedSet.size > 0;

  const selectedTiles = ALL_ABROAD_PREFERENCE_TILES.filter((t) => selectedSet.has(t.preferenceValue));
  const remainingTiles = ALL_ABROAD_PREFERENCE_TILES.filter((t) => !selectedSet.has(t.preferenceValue));

  const visibleTiles = !hasSelection || expanded ? ALL_ABROAD_PREFERENCE_TILES : selectedTiles;

  if (visibleTiles.length === 0) return null;

  return (
    <section className="px-6">
      <h3 className="mb-3 text-base font-semibold text-ink">בחר לפי סוג חופשה</h3>
      <div className="grid grid-cols-3 gap-3">
        {visibleTiles.map((tile) => (
          <Tile key={tile.categoryId} tile={tile} />
        ))}
      </div>
      {hasSelection && !expanded && remainingTiles.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full text-center text-sm font-semibold"
          style={{ color: "var(--color-primary-end)" }}
        >
          ראה עוד קטגוריות
        </button>
      )}
    </section>
  );
}
