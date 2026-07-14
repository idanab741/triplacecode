export interface UpcomingEvent {
  id: string;
  name: string;
  date: string | null;
  venueName: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  imageUrl: string | null;
  url: string;
}

interface TicketmasterEvent {
  id: string;
  name: string;
  url: string;
  dates?: { start?: { localDate?: string } };
  images?: { url: string }[];
  _embedded?: {
    venues?: { name: string; location?: { latitude?: string; longitude?: string } }[];
  };
}

/** אירועים אמיתיים בשבוע הקרוב, דרך Ticketmaster Discovery API. */
export async function getUpcomingEvents(
  latitude: number,
  longitude: number,
  radiusKm = 30
): Promise<UpcomingEvent[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) return [];

  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const toIso = (d: Date) => d.toISOString().split(".")[0] + "Z";

  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("latlong", `${latitude},${longitude}`);
  url.searchParams.set("radius", String(radiusKm));
  url.searchParams.set("unit", "km");
  url.searchParams.set("startDateTime", toIso(now));
  url.searchParams.set("endDateTime", toIso(weekLater));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", "10");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!response.ok) return [];

    const data = await response.json();
    const events: TicketmasterEvent[] = data._embedded?.events ?? [];

    return events.map((event) => {
      const venue = event._embedded?.venues?.[0];
      return {
        id: event.id,
        name: event.name,
        date: event.dates?.start?.localDate ?? null,
        venueName: venue?.name ?? null,
        venueLatitude: venue?.location?.latitude ? Number(venue.location.latitude) : null,
        venueLongitude: venue?.location?.longitude ? Number(venue.location.longitude) : null,
        imageUrl: event.images?.[0]?.url ?? null,
        url: event.url,
      };
    });
  } catch {
    return [];
  }
}
