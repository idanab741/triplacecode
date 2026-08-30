import Image from "next/image";
import Link from "next/link";
import { getDestinationById, getDestinationEditionSection } from "@/services/destinations/destinationsServerService";
import {
  getPlacesByCityAndCategory,
  getPlacesByCityAndKeywords,
  RESTAURANT_CATEGORY_KEYWORDS,
  ATTRACTION_CATEGORY_KEYWORDS,
  NATURE_CATEGORY_KEYWORDS,
  NIGHTLIFE_CATEGORY_KEYWORDS,
} from "@/services/places/placesServerService";
import { getWeeklyForecast } from "@/services/weather/weatherService";
import { getUpcomingEvents } from "@/services/events/ticketmasterService";
import { Screen } from "@/components/ui";
import { MainBottomNav } from "@/components/MainBottomNav";
import { WeatherRow } from "@/screens/destination/WeatherRow";
import { EventsRow } from "@/screens/destination/EventsRow";
import { PlaceRow } from "@/screens/destination/PlaceRow";
import { BusinessOwnersRow } from "@/screens/destination/BusinessOwnersRow";
import { WHITE_ICON_FILTER } from "@/screens/layout/TripHeroHeader";

interface DestinationPageProps {
  params: Promise<{ id: string }>;
  /** subtitle - מגיע רק כשנלחצים על כרטיס תת-יעד ב-WorldwideCategorySection
   *  (למשל "ניו יורק בכריסמס") - לא קיים בכניסה רגילה ליעד. */
  searchParams: Promise<{ subtitle?: string }>;
}

export default async function DestinationPage({ params, searchParams }: DestinationPageProps) {
  const { id } = await params;
  const { subtitle } = await searchParams;
  const destination = await getDestinationById(id);

  if (!destination) {
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

  const hasCoords = destination.latitude != null && destination.longitude != null;

  const [restaurants, attractions, nature, nightlife, hotels, forecast, events, editionSection] = await Promise.all([
    getPlacesByCityAndKeywords(destination.name, RESTAURANT_CATEGORY_KEYWORDS),
    getPlacesByCityAndKeywords(destination.name, ATTRACTION_CATEGORY_KEYWORDS),
    getPlacesByCityAndKeywords(destination.name, NATURE_CATEGORY_KEYWORDS),
    getPlacesByCityAndKeywords(destination.name, NIGHTLIFE_CATEGORY_KEYWORDS),
    getPlacesByCityAndCategory(destination.name, "hotels"),
    hasCoords ? getWeeklyForecast(destination.latitude!, destination.longitude!) : Promise.resolve([]),
    hasCoords ? getUpcomingEvents(destination.latitude!, destination.longitude!) : Promise.resolve([]),
    subtitle ? getDestinationEditionSection(destination.id, subtitle) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* *** תיקון (בקשה מפורשת - בר שקוף מעל ה-HERO, "שכפתור החזור
          יהיה למעלה באותו מקום בדיוק... שהכל יהיה שקוף"): הבר עבר
          מ-<header> עצמאי לבן (מעל התמונה, דוחף אותה למטה) לבר שקוף
          **בתוך** קונטיינר ה-HERO עצמו (position absolute) - לוגו+חזרה
          נשארים באותו מקום בדיוק (משמאל), רק שאין יותר רקע לבן. אותו
          WHITE_ICON_FILTER (brightness-0 invert + drop-shadow) כמו
          TripHeroHeader.tsx/PlaceHeroActions.tsx - קריאות מעל כל תמונה. */}
      <div className="relative h-72 w-full">
        <div className="absolute inset-x-0 top-0 z-30 h-16">
          <div className="absolute left-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
            <Image src="/images/triplace-logo-black.png" alt="" width={110} height={34} className={`object-contain ${WHITE_ICON_FILTER}`} />
            <Link
              href="/home"
              className="flex h-10 w-10 shrink-0 items-center justify-center"
              aria-label="חזרה לדף הבית"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
              >
                <path d="m14 6-6 6 6 6" />
              </svg>
            </Link>
          </div>
        </div>

        {destination.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={destination.image_url}
            alt={destination.name}
            className="h-full w-full object-cover"
          />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.65),transparent)] px-6 pb-5 pt-16">
          <h1 className="text-2xl font-extrabold text-white">{destination.name}</h1>
          <p className="text-sm text-white/80">{destination.country}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 pt-5">
        {editionSection && (
          <div className="mx-6 rounded-card bg-accent/10 py-4">
            <h2 className="mb-3 px-6 text-xl font-extrabold text-ink">
              {destination.name} {editionSection.subtitle}
            </h2>
            <PlaceRow
              title="אטרקציות"
              places={editionSection.places}
              emptyMessage={`עוד לא הוספנו אטרקציות ל-${destination.name} ${editionSection.subtitle}`}
            />
          </div>
        )}

        {destination.description && (
          <p className="px-6 text-sm leading-relaxed text-ink-secondary">
            {destination.description}
          </p>
        )}

        <WeatherRow forecast={forecast} />
        <EventsRow events={events} />

        <PlaceRow
          title="מסעדות"
          places={restaurants}
          emptyMessage="עוד לא אספנו מסעדות ליעד הזה"
          seeAllHref={`/destination/${destination.id}/places?type=restaurants`}
        />
        <PlaceRow
          title="אטרקציות"
          places={attractions}
          emptyMessage="עוד לא אספנו אטרקציות ליעד הזה"
          seeAllHref={`/destination/${destination.id}/places?type=attractions`}
        />
        <PlaceRow
          title="טבע"
          places={nature}
          emptyMessage="עוד לא אספנו אתרי טבע ליעד הזה"
          seeAllHref={`/destination/${destination.id}/places?type=nature`}
        />
        <PlaceRow
          title="מלונות"
          places={hotels}
          emptyMessage="עוד לא אספנו מלונות ליעד הזה"
          seeAllHref={`/destination/${destination.id}/places?type=hotels`}
        />
        <PlaceRow
          title="חיי לילה"
          places={nightlife}
          emptyMessage="עוד לא אספנו חיי לילה ליעד הזה"
          seeAllHref={`/destination/${destination.id}/places?type=nightlife`}
        />

        <BusinessOwnersRow />
      </div>

      <MainBottomNav active="home" />
    </div>
  );
}
