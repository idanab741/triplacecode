import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getOrCacheTripThumbnail } from "@/services/tripBuilder/tripThumbnailService";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: "פרמטרים לא תקינים" }, { status: 400 });
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonthDate = new Date(year, month, 1);
  const end = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .select("id,trip_type,answers,final_itinerary,calendar_date,destination_image_url")
    .eq("user_id", user.id)
    .gte("calendar_date", start)
    .lt("calendar_date", end);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = await Promise.all(
    (data ?? []).map(async (session) => {
      const answers = session.answers as { destination?: string; requestedArea?: string } | null;
      const itinerary = session.final_itinerary as { stops?: { name?: string }[] } | null;
      const firstStopName = itinerary?.stops?.[0]?.name;
      const destinationLabel = answers?.destination ?? answers?.requestedArea ?? firstStopName ?? "הטיול שלי";

      const imageUrl = await getOrCacheTripThumbnail(supabase, {
        id: session.id as string,
        destination_image_url: session.destination_image_url as string | null,
        answers,
        final_itinerary: itinerary,
      });

      return {
        sessionId: session.id as string,
        tripType: session.trip_type as string,
        destinationLabel,
        calendarDate: session.calendar_date as string,
        imageUrl,
      };
    })
  );

  return NextResponse.json({ events });
}