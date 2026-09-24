import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getOrCacheTripThumbnail } from "@/services/tripBuilder/tripThumbnailService";

/**
 * אירועי "היומן שלי". שני מצבים:
 *  - ?year=&month=  - כל האירועים בחודש (לנקודות בלוח החודשי).
 *  - ?upcoming=1    - מהיום ועד חצי שנה קדימה (לציר "הקרוב אליכם").
 * שני מקורות: פריטים ביומן (place_calendar_entries - מקום/אטרקציה או טיול של הקהילה), ומסלולים
 * שנבנו באפליקציה עם תאריך (trip_builder_sessions.calendar_date).
 */

export interface CalendarEventDto {
  /** entry = פריט ביומן (אפשר לערוך/למחוק); session = מסלול שנבנה (עריכה בעמוד המסלול). */
  kind: "entry" | "session";
  /** מזהה הפריט ביומן (entry) או המסלול (session). */
  id: string;
  itemType: "place" | "trip" | "session";
  refId: string;
  title: string;
  date: string;
  time: string | null;
  note: string | null;
  imageUrl: string | null;
  category: string | null;
  tripType: string | null;
  href: string;
}

const TRIP_TYPE_ROUTE: Record<string, string> = {
  abroad_vacation: "abroad-vacation",
  day_trip: "day-trip",
  romantic_date: "romantic-date",
  nightlife: "nightlife",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  let start: string;
  let end: string;
  if (searchParams.get("upcoming")) {
    const today = new Date();
    start = iso(today);
    end = iso(new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()));
  } else {
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));
    if (!year || !month || month < 1 || month > 12) return NextResponse.json({ error: "פרמטרים לא תקינים" }, { status: 400 });
    start = `${year}-${String(month).padStart(2, "0")}-01`;
    end = iso(new Date(year, month, 1));
  }

  const [sessionsRes, entriesRes] = await Promise.all([
    supabase
      .from("trip_builder_sessions")
      .select("id,trip_type,answers,final_itinerary,calendar_date,destination_image_url")
      .eq("user_id", user.id)
      .gte("calendar_date", start)
      .lt("calendar_date", end),
    // select("*") - כך שהעמוד ממשיך לעבוד גם לפני שמיגרציה 0097 רצה (העמודות החדשות פשוט חסרות).
    supabase.from("place_calendar_entries").select("*").eq("user_id", user.id).gte("calendar_date", start).lt("calendar_date", end),
  ]);

  if (sessionsRes.error) return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
  if (entriesRes.error) return NextResponse.json({ error: entriesRes.error.message }, { status: 500 });

  const sessionEvents: CalendarEventDto[] = await Promise.all(
    (sessionsRes.data ?? []).map(async (session) => {
      const answers = session.answers as { destination?: string; requestedArea?: string } | null;
      const itinerary = session.final_itinerary as { stops?: { name?: string }[] } | null;
      const title = answers?.destination ?? answers?.requestedArea ?? itinerary?.stops?.[0]?.name ?? "המסלול שלי";
      const imageUrl = await getOrCacheTripThumbnail(supabase, {
        id: session.id as string,
        destination_image_url: session.destination_image_url as string | null,
        answers,
        final_itinerary: itinerary,
      });
      const tripType = session.trip_type as string;
      const segment = TRIP_TYPE_ROUTE[tripType] ?? tripType.replace(/_/g, "-");
      return {
        kind: "session" as const,
        id: session.id as string,
        itemType: "session" as const,
        refId: session.id as string,
        title,
        date: session.calendar_date as string,
        time: null,
        note: null,
        imageUrl,
        category: null,
        tripType,
        href: `/trip-builder/${segment}/result?sessionId=${session.id}`,
      };
    })
  );

  const entryEvents: CalendarEventDto[] = (entriesRes.data ?? []).map((row) => {
    const itemType = row.item_type === "trip" ? ("trip" as const) : ("place" as const);
    const refId = row.place_id as string;
    const href =
      itemType === "trip" ? `/places/trip/${refId}` : UUID_RE.test(refId) ? `/place/${refId}` : `/search/result?placeId=${encodeURIComponent(refId)}`;
    return {
      kind: "entry" as const,
      id: row.id as string,
      itemType,
      refId,
      title: row.place_name as string,
      date: row.calendar_date as string,
      time: typeof row.start_time === "string" ? (row.start_time as string).slice(0, 5) : null,
      note: (row.note as string | null | undefined) ?? null,
      imageUrl: (row.image_url as string | null) ?? null,
      category: (row.category as string | null | undefined) ?? null,
      tripType: null,
      href,
    };
  });

  const events = [...sessionEvents, ...entryEvents].sort((a, b) =>
    a.date === b.date ? (a.time ?? "99").localeCompare(b.time ?? "99") : a.date.localeCompare(b.date)
  );
  return NextResponse.json({ events });
}
