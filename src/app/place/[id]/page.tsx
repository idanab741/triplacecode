import Link from "next/link";
import { getPlaceById } from "@/services/places/placesServerService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { Screen } from "@/components/ui";
import { PlaceHeroActions } from "@/screens/place/PlaceHeroActions";
import { PlaceNavigationCard } from "@/screens/place/PlaceNavigationCard";

interface PlacePageProps {
  params: Promise<{ id: string }>;
}

/**
 * מסך יעד בסיסי - מציג מידע אמיתי על מקום בודד (בית קפה, מסעדה וכו').
 * ללא פעולות לייק/שמירה/דילוג - אלה שייכות לשלב עתידי, אחרי שיחת ה-AI.
 */
export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
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

  const categoryLine = [place.subcategory, getCategoryLabel(place.category)]
    .filter(Boolean)
    .join(" - ");

  return (
    <div className="min-h-screen bg-bg pb-10">
      <div className="relative h-72 w-full">
        {place.image_urls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={place.image_urls[0]}
            alt={place.name}
            className="h-full w-full object-cover"
          />
        )}

        <PlaceHeroActions placeId={place.id} placeName={place.name} />

        <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.65),transparent)] px-6 pb-5 pt-16">
          <h1 className="text-2xl font-extrabold text-white">{place.name}</h1>
          {categoryLine && <p className="text-sm text-white/80">{categoryLine}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-4 px-6 pt-5">
        <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-ink">
          {place.rating != null && <span>★ {place.rating.toFixed(1)}</span>}
          {place.city && <span className="text-ink-secondary">{place.city}</span>}
        </div>

        {place.short_description && (
          <p className="line-clamp-3 text-sm leading-relaxed text-ink-secondary">{place.short_description}</p>
        )}

        {place.address && <p className="text-sm text-ink-secondary">{place.address}</p>}

        <div className="mt-2">
          <PlaceNavigationCard placeId={place.id} latitude={place.latitude} longitude={place.longitude} />
        </div>
      </div>
    </div>
  );
}
