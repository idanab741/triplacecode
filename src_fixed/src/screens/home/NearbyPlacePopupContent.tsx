"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite } from "@/services/favorites/favoritesService";
import { PlaceMapPopupCard } from "@/components/map/PlaceMapPopupCard";
import type { NearbyMapPlace } from "@/screens/home/HomeNearbyMap";

interface NearbyPlacePopupContentProps {
  place: NearbyMapPlace;
  /** תווית הלשונית (תצפית/עגלת קפה/פארק/קניון) - מוצגת כקטגוריה בכרטיס. */
  categoryLabel: string;
  /** האייקון התלת-ממדי של הלשונית - משמש כאייקון הקטגוריה בכרטיס. */
  categoryIconSrc: string;
}

function formatDistance(km: number | null | undefined): string | null {
  if (km == null) return null;
  return km < 1 ? `${Math.max(50, Math.round(km * 20) * 50)} מ'` : `${km.toFixed(1)} ק"מ`;
}

/**
 * *** חדש (בקשה מפורשת - "איפה הכרטיסיות החדשות, עם כל המלל? תשנה בהתאם
 * לכרטיסיות הכי חדשות"): הכרטיסייה שנפתחת בלחיצה על נעץ בקטע "עוד מקומות
 * בקרבת מקום" היא עכשיו אותה חלונית בדיוק כמו של מפת הבית - PlaceMapPopupCard
 * (לוגו TRIPLACE ודירוגים, דירוג Google, כתובת, שעות פתיחה ופתוח/סגור,
 * ניווט Waze/Google Maps, שמירה ושיתוף, ושם שלוחצים עליו לעמוד המקום) -
 * במקום התצוגה הקטנה הישנה.
 *
 * גשר נתונים בדיוק כמו HomeMapPlacePopupContent, עם שני הבדלים:
 *  - המקומות כאן הם משורות ה-places (Discovery), לא tripadd - ולכן השמירה
 *    נרשמת כ-place_type="place" (אותו סוג של TripMatch), לא "tripadd".
 *  - דירוג ה-Google כאן הוא rating/ratingCount של המקום. אין לנו כאן דירוג
 *    TRIPLACE פנימי, רמת מחיר או נגישות - הם פשוט לא מוצגים.
 */
export function NearbyPlacePopupContent({ place, categoryLabel, categoryIconSrc }: NearbyPlacePopupContentProps) {
  const { user } = useAuth();
  const map = useMap();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    getFavoriteStatus(supabase, user.id, place.id).then((status) => setSaved(status === "saved"));
  }, [user, place.id]);

  async function handleToggleSave() {
    if (!user || busy) return;
    setBusy(true);
    setSaved((s) => !s);
    try {
      const supabase = createClient();
      const status = await toggleFavorite(supabase, user.id, place.id, "place", "saved");
      setSaved(status === "saved");
    } catch {
      setSaved((s) => !s);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    const shareUrl = `${window.location.origin}/place/${place.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, url: shareUrl });
      } catch {
        // המשתמש ביטל את השיתוף
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
  }

  const distance = formatDistance(place.distanceKm);
  const address = [place.city, distance ? `${distance} ממך` : null].filter(Boolean).join(" · ") || null;
  const reviewsQuery = encodeURIComponent(`${place.name} ${place.city ?? ""}`);

  return (
    <PlaceMapPopupCard
      place={{
        id: place.id,
        name: place.name,
        imageUrl: place.imageUrls?.[0] ?? null,
        address,
        categoryLabel,
        categoryIconSrc,
        subcategoryLabel: place.subcategoryLabel ?? null,
        triplaceRating: null,
        googleRating: place.rating ?? null,
        googleRatingCount: place.ratingCount ?? null,
        priceLevel: null,
        accessible: null,
        googleMatchStatus: null,
        openingHours: place.openingHours ?? null,
        wazeUrl: `https://waze.com/ul?ll=${place.latitude},${place.longitude}&navigate=yes`,
        googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`,
        googleReviewsUrl: `https://www.google.com/maps/search/?api=1&query=${reviewsQuery}`,
        saved,
      }}
      onClose={() => map.closePopup()}
      onToggleSave={handleToggleSave}
      onShare={handleShare}
      onNameClick={() => router.push(`/place/${place.id}`)}
    />
  );
}
