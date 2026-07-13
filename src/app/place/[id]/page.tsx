import { createClient } from "@/services/supabase/server";
import { Screen } from "@/components/ui";

interface PlacePageProps {
  params: Promise<{ id: string }>;
}

/** מסך יעד זמני — מציג רק את השם. ה-Place Card המלא ייבנה בשלב הבא. */
export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: place } = await supabase.from("places").select("name").eq("id", id).single();

  return (
    <Screen withBottomNavSpacing={false}>
      <div className="pt-10 text-center">
        <h1 className="text-2xl font-bold text-ink">{place?.name ?? "יעד לא נמצא"}</h1>
      </div>
    </Screen>
  );
}
