import Link from "next/link";
import { getPlaceById } from "@/services/places/placesServerService";
import { getCategoryLabel, hasHebrewLabel } from "@/utils/categoryLabels";
import { Screen } from "@/components/ui";
import { AttractionTopBar } from "@/screens/place/AttractionTopBar";
import { AttractionSaveShareRow } from "@/screens/place/AttractionSaveShareRow";
import { PlaceNavigationCard } from "@/screens/place/PlaceNavigationCard";
import { GoogleRatingCard } from "@/screens/place/GoogleRatingCard";
import { TripLaceRatingSection } from "@/screens/place/TripLaceRatingSection";
import { TripAddPlaceView } from "@/screens/place/TripAddPlaceView";
import { MainBottomNav } from "@/components/MainBottomNav";
import { getTripAddPlaceById, getTripAddSavedCount } from "@/services/tripadd/tripAddPlaceService";

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
 * במקומות אחרים באפליקציה שמקשרים ל-/place/[id]). כולל: בר עליון תכלת
 * סולידי עם לוגו TRIPLACE (חזור+לוגו+פעמון - הבר התקני של האפליקציה,
 * כמו HomeHeader/PlacesHeaderRow), תמונת HERO, שמירה+שיתוף, דירוג, שם+תיאור+מיקום,
 * קטגוריות, מפה, וכפתורי דירוג (Google - קישור בלבד, לא קריאת API;
 * TripLace - דירוג פנימי אמיתי עם אפשרות למשתמשים לדרג).
 *
 * *** תוספת (בקשה מפורשת - "אמורים לעשות עמוד לכל אטרקציה שקיימת
 * במאגר [TripAdd]"): tripadd_submissions נבדק **ראשון** - זה מקור
 * הדאטה החי מעכשיו (ר' HomeMap.tsx/pins route). אם המקום נמצא שם,
 * מוצג ב-TripAddPlaceView - בלי בכלל לגעת ב-getPlaceById. הנפילה-חזרה
 * לטבלת places הישנה (הקוד שממשיך למטה) נשארת בשביל קישורים ישנים
 * שכבר קיימים, לא מוסרת.
 *
 * *** עיצוב-מחדש מלא (בקשה מפורשת - "צריך להיות אחיד לכל העמודים של
 * האטרקציות!"): אותו סדר בדיוק, מילה במילה, כמו TripAddPlaceView -
 * בר תכלת / HERO / שמירה+שיתוף / שם+מיקום+תיאור / קטגוריות / מפה
 * (מרחק מהבית מעל, Google Maps+Waze מתחת) / דירוג Google / דירוג
 * TripLace עם הלוגואים + כפתור "דרגו את המקום הזה" - דרך אותן
 * קומפוננטות משותפות בדיוק (AttractionTopBar/AttractionSaveShareRow/
 * GoogleRatingCard), כדי ששני סוגי העמודים ייראו זהים ב-100% מנקודת
 * המבט של המשתמש.
 */
export default async function PlacePage({ params, searchParams }: PlacePageProps) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const activeNavTab = from === "ai" ? "ai" : "favorites";

  // *** ביצועים (בקשה מפורשת - "הכל צריך לזרום מהר, כמו אינסטגרם/פייסבוק"):
  // שתי השליפות האלה עצמאיות זו מזו (שתיהן לפי id בלבד) - מריצים אותן
  // במקביל במקום ברצף, כך שבמקרה הרגיל (מקום, לא tripAddPlace) חוסכים
  // round-trip שלם במקום לחכות לתשובת tripAddPlace לפני שמתחילים לשלוף
  // את המקום. העלות: שאילתת getPlaceById "מבוזבזת" בענף של tripAddPlace -
  // משתלם, כי latency של רשת/DB יקר בהרבה משאילתה מקומית נוספת.
  const [tripAddPlace, place] = await Promise.all([getTripAddPlaceById(id), getPlaceById(id)]);
  if (tripAddPlace) {
    const savedCount = await getTripAddSavedCount(tripAddPlace.id);
    return <TripAddPlaceView place={tripAddPlace} savedCount={savedCount} />;
  }

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

  // *** הוסר (בקשה מפורשת - "החלק הזה [מה הקהילה חושבת - אהבו/לא אהבו/
  // שמרו] צריך להיעלם מכל עמודי האטרקציות ולא להופיע יותר"): גם
  // ה-import וגם השליפה מהשרת (getPlaceCommunityStats) הוסרו לגמרי,
  // לא רק ה-JSX - כדי לא לבזבז שאילתת DB על נתון שכבר לא מוצג.
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
  //
  // *** תיקון (בקשה מפורשת - "למה זה מופיע שניים ככה, אחד באנגלית
  // בכלל, לוקה בחסר"): שני באגים כאן בעבר. (1) place.category עבר
  // תרגום ל-getCategoryLabel *פעמיים* - פעם ישירות בשורה הראשונה של
  // המערך, ופעם נוספת כשכל המערך (כולל התווית העברית שכבר תורגמה)
  // עבר שוב דרך .map(getCategoryLabel) - זה גם בזבזני וגם עלול לייצר
  // תוצאה שונה אם התווית העברית "נתפסת" בטעות ע"י אחת מרשימות התרגום.
  // (2) הדה-דופליקציה (Set) רצה על המחרוזות *אחרי* התרגום, לא על
  // המזהים הגולמיים - כך ששני מזהים גולמיים שונים לאותה קטגוריה
  // בפועל (או אותו מזהה שמופיע גם ב-category וגם בתוך tags) לא
  // תמיד זוהו כזהים, ובאותה נשימה מזהים בלי תרגום עברי בכלל נפלו
  // חזרה למזהה הגולמי באנגלית והוצגו כמו שהם למשתמש. התיקון: קודם
  // איסוף כל המזהים הגולמיים, דה-דופליקציה עליהם *לפני* תרגום,
  // סינון כל מזהה שאין לו תווית עברית אמיתית (hasHebrewLabel) - כדי
  // שלעולם לא יוצג צ'יפ באנגלית גולמית - ורק בסוף תרגום חד-פעמי.
  const categoryChips = Array.from(
    new Set(
      [place.category, ...(place.trip_type_tags ?? []), ...(place.cuisine_tags ?? []), ...(place.tags ?? [])].filter(
        (v): v is string => !!v
      )
    )
  )
    .filter(hasHebrewLabel)
    .map(getCategoryLabel);

  // *** קישור בלבד ל-Google Maps (לא קריאת API מהשרת שלנו) - משתמש
  // בדירוג/כמות שכבר שמורים על המקום (place.rating/rating_count, מולאו
  // פעם אחת כשהמקום נוסף), בלי לפנות ל-Google שוב בכלל.
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name} ${place.city ?? ""}`)}`;

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* 1. בר עליון תכלת - חזור + לוגו + פעמון (הבר התקני של triplace,
          כמו HomeHeader/PlacesHeaderRow) - יושב *מעל* ה-HERO, לא כ-overlay שקוף עליו */}
      <AttractionTopBar />

      {/* 2. תמונת HERO - מוזזת מעט למעלה (מרווח שלילי ששווה בדיוק לרדיוס
          הפינות המעוגלות של הבר, rounded-b-[32px]) ומאחורי הבר (z-index
          נמוך יותר) כדי שהתמונה תמלא את פינות העיגול מלמטה, ולא ייראה
          "משולש" רקע לבן של העמוד מציץ בין הבר לתמונה בשני הצדדים. */}
      <div className="relative z-0 -mt-8 h-72 w-full bg-bg-secondary">
        {place.image_urls?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.image_urls[0]} alt={place.name} className="h-full w-full object-cover" />
        )}
      </div>

      {/* 3. שמירה + שיתוף */}
      <AttractionSaveShareRow placeId={place.id} placeName={place.name} />

      <div className="flex flex-col gap-5 px-5 pt-5">
        {/* 4. שם + מיקום + תיאור */}
        <div className="flex flex-col gap-2">
          {place.rating != null && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <span className="text-amber-500">★</span>
              <span>{place.rating.toFixed(1)}</span>
              {place.rating_count != null && <span className="font-normal text-ink-secondary">({place.rating_count})</span>}
            </div>
          )}
          <h1 className="text-2xl font-extrabold text-ink">{place.name}</h1>
          {(place.address || place.city) && (
            <p className="text-sm text-ink-secondary">{[place.address, place.city].filter(Boolean).join(" · ")}</p>
          )}
          {place.short_description && <p className="text-sm leading-relaxed text-ink-secondary">{place.short_description}</p>}
        </div>

        {/* 5. קטגוריות */}
        {categoryChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categoryChips.map((chip) => (
              <span key={chip} className="rounded-pill bg-bg-secondary px-3 py-1.5 text-xs font-medium text-ink-secondary">
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* "מה הקהילה חושבת" (אהבו/לא אהבו/שמרו) הוסר לגמרי מכל עמודי
            האטרקציה - בקשה מפורשת. */}

        {/* 6. מפה - מרחק מהבית מעל המפה, מפה, Google Maps + Waze מתחתיה
            (הסדר הזה כבר מובנה בתוך PlaceNavigationCard). */}
        <PlaceNavigationCard placeId={place.id} latitude={place.latitude} longitude={place.longitude} />

        {/* 7. דירוג Google */}
        {place.rating != null && <GoogleRatingCard rating={place.rating} ratingCount={place.rating_count} googleUrl={googleMapsUrl} />}

        {/* 8. דירוג TripLace (לוגואים + כפתור "דרגו את המקום הזה") */}
        <TripLaceRatingSection placeId={place.id} />
      </div>

      <MainBottomNav active={activeNavTab} />
    </div>
  );
}
