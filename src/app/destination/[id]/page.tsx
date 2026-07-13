import Link from "next/link";
import { getDestinationById } from "@/services/destinations/destinationsServerService";
import { getPlacesByCityAndCategory } from "@/services/places/placesServerService";
import { getWeeklyForecast } from "@/services/weather/weatherService";
import { getUpcomingEvents } from "@/services/events/ticketmasterService";
import { Screen } from "@/components/ui";
import { WeatherRow } from "@/screens/destination/WeatherRow";
import { EventsRow } from "@/screens/destination/EventsRow";
import { PlaceRow } from "@/screens/destination/PlaceRow";
import { BusinessOwnersRow } from "@/screens/destination/BusinessOwnersRow";

interface DestinationPageProps {
  params: Promise<{ id: string }>;
}

export default async function DestinationPage({ params }: DestinationPageProps) {
  const { id } = await params;
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

  const [restaurants, attractions, hotels, forecast, events] = await Promise.all([
    getPlacesByCityAndCategory(destination.name, "restaurants_culinary"),
    getPlacesByCityAndCategory(destination.name, "attractions"),
    getPlacesByCityAndCategory(destination.name, "hotels"),
    hasCoords ? getWeeklyForecast(destination.latitude!, destination.longitude!) : Promise.resolve([]),
    hasCoords ? getUpcomingEvents(destination.latitude!, destination.longitude!) : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen bg-bg pb-10">
      <div className="relative h-72 w-full">
        {destination.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={destination.image_url}
            alt={destination.name}
            className="h-full w-full object-cover"
          />
        )}

        <Link
          href="/home"
          aria-label="חזרה"
          className="absolute start-4 top-6 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-soft"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink)" strokeWidth="2">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.65),transparent)] px-6 pb-5 pt-16">
          <h1 className="text-2xl font-extrabold text-white">{destination.name}</h1>
          <p className="text-sm text-white/80">{destination.country}</p>
        </div>
      </div>

      <div className="flex flex-col gap-6 pt-5">
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
        />
        <PlaceRow
          title="אטרקציות"
          places={attractions}
          emptyMessage="עוד לא אספנו אטרקציות ליעד הזה"
        />
        <PlaceRow title="מלונות" places={hotels} emptyMessage="עוד לא אספנו מלונות ליעד הזה" />

        <BusinessOwnersRow />
      </div>
    </div>
  );
}
