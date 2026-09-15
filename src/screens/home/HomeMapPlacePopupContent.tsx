"use client";

import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/services/supabase/client";
import { getFavoriteStatus, toggleFavorite } from "@/services/favorites/favoritesService";
import { HOME_QUICK_CATEGORIES } from "@/constants/homeQuickCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import { PlaceMapPopupCard } from "@/components/map/PlaceMapPopupCard";
import type { HomeMapPlace } from "./HomeMap";

/**
 * מגשר בין נתוני HomeMapPlace (כבר קיימים ב-HomeMap.tsx) לבין ה-props
 * הגנריים של PlaceMapPopupCard: טוען/מעדכן מצב שמירה אמיתי (favorites,
 * אותו שירות בדיוק כמו PlaceHeroActions.tsx), בונה את קישורי Waze/
 * גוגל-מפות/ביקורות-גוגל, וסוגר את ה-Popup של Leaflet עצמו (useMap) -
 * לא מומצא sourceId חדש.
 *
 * *** הערה חשובה: place.id כאן מגיע מ-tripadd_submissions (ר' ההערה
 * למעלה ב-HomeMap.tsx - "מקור הדאטה היחיד מעכשיו"), לא מטבלת places
 * הרגילה. טבלת favorites (favoritesService.ts) מצפה ל-place_id שמצביע
 * על places/destinations. אם tripadd_submissions.id לא זהה ל-id באחת
 * מהטבלאות האלה, כפתור השמירה כאן יכתוב favorites "יתומים" (לא יקרוס,
 * אבל גם לא יסתנכרן עם "שמורים" במקומות אחרים באפליקציה) - כדאי
 * לוודא/לתקן את זה מול הסכמה בפועל לפני production.
 */
export function HomeMapPlacePopupContent({ place }: { place: HomeMapPlace }) {
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
      // *** תיקון (בקשה מפורשת - "כמה שמרו את האטרקציה"): קודם זה
      // כתב place_type="place" למרות ש-place.id מגיע בפועל מ-
      // tripadd_submissions - "favorites יתומים" (ר' ההערה למעלה),
      // וגם מנע מספירת "כמה שמרו" (tripAddPlaceService.ts) לעבוד,
      // כי היא סופרת דווקא place_type="tripadd". ר' migration 0080
      // שהוסיפה את הערך הזה כאפשרות חוקית בעמודה.
      const status = await toggleFavorite(supabase, user.id, place.id, "tripadd", "saved");
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

  const categoryDef = place.category ? HOME_QUICK_CATEGORIES.find((c) => c.id === place.category) : undefined;

  const googleReviewsQuery = encodeURIComponent(`${place.name} ${place.address ?? ""}`);

  return (
    <PlaceMapPopupCard
      place={{
        id: place.id,
        name: place.name,
        imageUrl: place.photoUrl ?? null,
        address: place.address ?? null,
        categoryLabel: categoryDef ? HOME_QUICK_CATEGORY_LABELS[categoryDef.id] : null,
        categoryIconSrc: categoryDef?.imageSrc ?? null,
        subcategoryLabel: place.subcategory ?? null,
        triplaceRating: place.rating ?? null,
        googleRating: place.googleRating ?? null,
        googleRatingCount: place.googleRatingCount ?? null,
        priceLevel: place.priceLevel ?? null,
        accessible: place.accessible ?? null,
        openingHours: place.openingHours ?? null,
        // *** אותה נוסחת קישור בדיוק כמו PlaceNavigationCard.tsx (handleStartNavigation) - לא ממציאים פורמט חדש.
        wazeUrl: `https://waze.com/ul?ll=${place.latitude},${place.longitude}&navigate=yes`,
        googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`,
        googleReviewsUrl: `https://www.google.com/maps/search/?api=1&query=${googleReviewsQuery}`,
        saved,
      }}
      onClose={() => map.closePopup()}
      onToggleSave={handleToggleSave}
      onShare={handleShare}
      onNameClick={() => router.push(`/place/${place.id}`)}
    />
  );
}
