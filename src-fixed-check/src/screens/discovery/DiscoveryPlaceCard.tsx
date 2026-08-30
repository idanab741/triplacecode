"use client";

import Link from "next/link";
import type { DiscoveryPlace } from "@/services/places/discoveryService";
import { getCategoryLabel } from "@/utils/categoryLabels";

interface DiscoveryPlaceCardProps {
  place: DiscoveryPlace;
  /** נקודת חזרה - נשמר ב-URL כדי ש-BackButton בדף המקום יחזור ל-Discovery
   *  הנכון, לא לעמוד גנרי. */
  from?: string;
  /** true (ברירת מחדל) = רוחב קבוע, לשימוש בקרוסלה אופקית (DiscoverySection).
   *  false = רוחב מלא של תא ה-grid, לשימוש בעמוד "ראה הכל". */
  fixedWidth?: boolean;
}

/**
 * כרטיס Place אחיד לכל תוצאות ה-Discovery (Audit מול "PROMPT 1", סעיף
 * 9): אותה קומפוננטה בדיוק לאטרקציה/עגלת קפה/תצפית/פארק/שוק/יקב/מסעדה/
 * מסלול - לא 10 כרטיסים שונים. ממחזר את השפה הוויזואלית שכבר קיימת
 * ב-HotDestinations.tsx (rounded-card, object-cover מלא, גרדיאנט כהה
 * בתחתית, שם המקום בלבן על גבי התמונה) - בלי מנגנון ה"פוקוס מתרחב"
 * הספציפי של Embla שם, כי כאן כל הכרטיסים באותו גודל קבוע (לא כרטיס
 * "פתוח" יחיד במרכז).
 */
export function DiscoveryPlaceCard({ place, from, fixedWidth = true }: DiscoveryPlaceCardProps) {
  // *** תיקון (בקשה מפורשת - "כל האטרקציות/מסעדות/אתרים... על בסיס
  // מסך התגיות... לא שום דבר אחר!!"): הוחלף place.subcategoryLabel
  // ב-getCategoryLabel(place.category) - אותה בעיה כמו בעמוד המקום:
  // subcategory הוא שדה טקסט חופשי נפרד ממסך התגיות, יכול "להיתקע"
  // עם ערך ישן/שגוי. category הוא השדה שבאמת נערך במסך התגיות
  // ("קטגוריה ראשית (חובה)").
  const subtitle = [getCategoryLabel(place.category), place.city].filter(Boolean).join(" · ") || null;
  const href = from ? `/place/${place.id}?from=${encodeURIComponent(from)}` : `/place/${place.id}`;

  return (
    <Link
      href={href}
      className={`relative block h-[220px] overflow-hidden rounded-card bg-bg-secondary shadow-soft ${
        fixedWidth ? "w-[150px] shrink-0" : "w-full"
      }`}
    >
      {place.imageUrls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={place.imageUrls[0]} alt={place.name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full bg-bg-secondary" />
      )}

      {place.rating != null && (
        <span className="absolute start-2 top-2 whitespace-nowrap rounded-pill bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white">
          ★ {place.rating.toFixed(1)}
        </span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,.75)_0%,rgba(0,0,0,.35)_55%,transparent_100%)] p-2.5 pt-10">
        <p className="truncate text-sm font-bold leading-tight text-white">{place.name}</p>
        {subtitle && <p className="truncate text-[11px] text-white/85">{subtitle}</p>}
      </div>
    </Link>
  );
}
