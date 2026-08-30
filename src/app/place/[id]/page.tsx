import Link from "next/link";
import { getPlaceById } from "@/services/places/placesServerService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { Screen } from "@/components/ui";
import { PlaceHeroActions } from "@/screens/place/PlaceHeroActions";
import { PlaceNavigationCard } from "@/screens/place/PlaceNavigationCard";
import { PlaceCommunityStatsSection } from "@/screens/place/PlaceCommunityStatsSection";
import { TripLaceRatingSection } from "@/screens/place/TripLaceRatingSection";
import { MainBottomNav } from "@/components/MainBottomNav";
import { getPlaceCommunityStats } from "@/services/places/placeCommunityStatsService";

interface PlacePageProps {
  params: Promise<{ id: string }>;
  /** "from" אופציונלי בכתובת - קובע איזה טאב בסרגל התחתון מודגש כ"פעיל".
   *  בלי זה, העמוד תמיד סימן "tripmatch" כפעיל (ר' MainBottomNav.tsx -
   *  ה-id הפנימי "favorites" מוצג בפועל בתור "tripmatch" ומוביל ל-/tripmatch),
   *  גם כשהגעת לכאן מבניית טיול ב-AI (trippy), לא מ-TripMatch בכלל -
   *  מבלבל למשתמש לגבי היכן הוא נמצא באפליקציה. */
  searchParams: Promise<{ from?: string }>;
}

/**
 * מסך אטרקציה/מקום - נפתח בלחיצה על כל מקום שמופיע ב-TripMatch (וגם
 * במקומות אחרים באפליקציה שמקשרים ל-/place/[id]). כולל: בר עליון עם
 * שיתוף+שמירה, תמונת HERO בגודל קבוע, דירוג, שם+תיאור+מיקום, קטגוריות,
 * מפה, וכפתורי דירוג (Google - קישור בלבד, לא קריאת API; TripLace -
 * דירוג פנימי אמיתי עם אפשרות למשתמשים לדרג).
 */
export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const { id } = await params;
  const { from } = await searchParams;
  const activeNavTab = from === "ai" ? "ai" : "favorites";
  const place = await getPlaceById(id);

  if (!place) {
    return (
      <Screen withBottomNavSpacing={false}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
          <p className="text-lg font-bold text-ink">היעד לא נמצא</p>
          <Link href="/home" className="text-sm text-accent">
            חזרה לדף הבית
          </Link>
        </div>
      </Screen>
    );
  }

  // *** תוספת (בקשה מפורשת - "נתונים על האטרקציה - כמה אהבו/לא אהבו/
  // שמרו"): נשלף כאן, בשרת, יחד עם שאר נתוני העמוד - לא useEffect/API
  // route נפרד בצד הלקוח, כי העמוד הזה כבר Server Component אסינכרוני
  // ממילא (getPlaceById למעלה). ר' placeCommunityStatsService.ts.
  const communityStats = await getPlaceCommunityStats(place.id);

  // *** תיקון (בקשה מפורשת - "כל האטרקציות/מסעדות/אתרים צריכים
  // להתעדכן על בסיס מסך התגיות... לא שום דבר אחר!!"): הוסר
  // place.subcategory מרשימת הצ'יפים. זה שדה טקסט חופשי נפרד לגמרי,
  // בעמוד עריכה אחר באדמין (/admin/places/[id], לא מסך התגיות/
  // cuisine_tags/tags/TripMatch) - התברר שהוא יכול "להיתקע" עם ערך
  // ישן/שגוי (למשל "cafe") גם אחרי שהמקום סווג מחדש דרך מסך התגיות,
  // כי שני השדות לא מסונכרנים. מעכשיו הצ'יפים בעמוד המקום מבוססים
  // אך ורק על מה שבאמת נערך במסך התגיות: הקטגוריה הראשית (category)
  // + כל קבוצות התגיות (trip_type_tags/cuisine_tags/tags) - בדיוק
  // מקור האמת שהמשתמש ביקש, בלי שום שדה צדדי נוסף.
  const categoryChips = Array.from(
    new Set(
      [
        getCategoryLabel(place.category),
        ...(place.trip_type_tags ?? []),
        ...(place.cuisine_tags ?? []),
        ...(place.tags ?? []),
      ]
        .filter((v): v is string => !!v)
        .map((v) => getCategoryLabel(v))
    )
  );

  // *** קישור בלבד ל-Google Maps (לא קריאת API מהשרת שלנו) - משתמש
  // בדירוג/כמות שכבר שמורים על המקום (place.rating/rating_count, מולאו
  // פעם אחת כשהמקום נוסף), בלי לפנות ל-Google שוב בכלל.
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.city ?? ""}`)}`;

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* *** תיקון (בקשה מפורשת - בר שקוף מעל ה-HERO): PlaceHeroActions
          עבר להיות **בתוך** קונטיינר ה-HERO (relative) - לא sibling
          לפניו - כדי שיחפוף את התמונה עצמה (position absolute), בלי
          רקע לבן נפרד שדוחף אותה למטה. */}
      <div className="relative h-72 w-full bg-bg-secondary">
        <PlaceHeroActions placeId={place.id} placeName={place.name} />
        {place.image_urls?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.image_urls[0]} alt={place.name} className="h-full w-full object-cover" />
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5">
        {place.rating != null && (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="text-amber-500">★</span>
            <span>{place.rating.toFixed(1)}</span>
            {place.rating_count != null && <span className="font-normal text-ink-secondary">({place.rating_count})</span>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-extrabold text-ink">{place.name}</h1>
          {place.short_description && <p className="text-sm leading-relaxed text-ink-secondary">{place.short_description}</p>}
          {(place.address || place.city) && (
            <p className="text-sm text-ink-secondary">{[place.address, place.city].filter(Boolean).join(" · ")}</p>
          )}
        </div>

        {categoryChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categoryChips.map((chip) => (
              <span key={chip} className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
                {chip}
              </span>
            ))}
          </div>
        )}

        <PlaceCommunityStatsSection stats={communityStats} />

        {/* מפה + מרחק/זמן הגעה + כפתור ניווט (Leaflet משלנו, לא Google) */}
        <PlaceNavigationCard placeId={place.id} latitude={place.latitude} longitude={place.longitude} />

        {/* כפתור דירוגי Google - קישור החוצה בלבד, לא הטמעה/קריאת API */}
        {place.rating != null && (
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-card border border-ink-secondary/15 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🌐</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">דירוגי Google</span>
                <span className="text-xs text-ink-secondary">
                  {place.rating.toFixed(1)} ★{place.rating_count != null ? ` · ${place.rating_count} ביקורות` : ""}
                </span>
              </div>
            </div>
            <span className="text-ink-secondary">›</span>
          </a>
        )}

        {/* דירוגי TripLace - מערכת דירוג פנימית משלנו, כולל אפשרות
            למשתמשים לדרג בכוכבים + תיאור חופשי. */}
        <TripLaceRatingSection placeId={place.id} />
      </div>

      <MainBottomNav active={activeNavTab} />
    </div>
  );
}
