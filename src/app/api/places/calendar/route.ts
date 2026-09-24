import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * פריטים ביומן (place_calendar_entries). *** הורחב (בקשה מפורשת - "היומן שלי - מה להכניס ואיך"):
 * מקום/אטרקציה או טיול של הקהילה (item_type), עם תאריך חובה ושעה + הערה אופציונליים (מיגרציה 0097).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function cleanTime(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return typeof value === "string" && TIME_RE.test(value) ? value : undefined;
}

function cleanNote(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed || null;
}

/** האם פריט כבר ביומן (בתאריך הקרוב ביותר) - למצב ההתחלתי של כפתור "ליומן". */
export async function GET(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
  if (!placeId) return NextResponse.json({ error: "חסר placeId" }, { status: 400 });

  const { data, error } = await supabase
    .from("place_calendar_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("place_id", placeId)
    .order("calendar_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    inCalendar: data != null,
    calendarDate: data?.calendar_date ?? null,
    entry: data
      ? {
          id: data.id as string,
          date: data.calendar_date as string,
          time: typeof data.start_time === "string" ? (data.start_time as string).slice(0, 5) : null,
          note: (data.note as string | null | undefined) ?? null,
        }
      : null,
  });
}

/** הוספת פריט ליומן. */
export async function POST(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const placeId = body?.placeId as string | undefined;
  const placeName = body?.placeName as string | undefined;
  const imageUrl = (body?.imageUrl as string | null | undefined) ?? null;
  const date = body?.date as string | undefined;
  const itemType = body?.itemType === "trip" ? "trip" : "place";
  const time = cleanTime(body?.time);
  const note = cleanNote(body?.note);
  const category = typeof body?.category === "string" ? body.category.slice(0, 60) : null;

  if (!placeId || !placeName) return NextResponse.json({ error: "חסרים פרטי פריט" }, { status: 400 });
  if (!date || !DATE_RE.test(date)) return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
  if (body?.time && time === undefined) return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });

  const row: Record<string, unknown> = {
    user_id: user.id,
    place_id: placeId,
    place_name: placeName,
    image_url: imageUrl,
    calendar_date: date,
    item_type: itemType,
    start_time: time ?? null,
    note: note ?? null,
    category,
  };

  let { data, error } = await supabase.from("place_calendar_entries").insert(row).select("id").single();
  // לפני שמיגרציה 0097 רצה העמודות החדשות לא קיימות - שומרים לפחות את הבסיס (מקום + תאריך).
  if (error && /column/i.test(error.message) && itemType === "place") {
    ({ data, error } = await supabase
      .from("place_calendar_entries")
      .insert({ user_id: user.id, place_id: placeId, place_name: placeName, image_url: imageUrl, calendar_date: date })
      .select("id")
      .single());
  }
  if (error || !data) return NextResponse.json({ error: error?.message ?? "ההוספה נכשלה" }, { status: 500 });
  return NextResponse.json({ success: true, entryId: data.id });
}

/** עריכת פריט ביומן: תאריך / שעה / הערה. */
export async function PATCH(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const entryId = body?.entryId as string | undefined;
  if (!entryId) return NextResponse.json({ error: "חסר entryId" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (body?.date !== undefined) {
    if (typeof body.date !== "string" || !DATE_RE.test(body.date)) return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
    update.calendar_date = body.date;
  }
  const time = cleanTime(body?.time);
  if (body?.time !== undefined) {
    if (time === undefined) return NextResponse.json({ error: "שעה לא תקינה" }, { status: 400 });
    update.start_time = time;
  }
  const note = cleanNote(body?.note);
  if (body?.note !== undefined) update.note = note ?? null;

  if (Object.keys(update).length === 0) return NextResponse.json({ success: true });

  const { error } = await supabase.from("place_calendar_entries").update(update).eq("id", entryId).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** הסרה: entryId = פריט אחד; placeId = כל התאריכים של הפריט (לחיצה חוזרת על כפתור "ביומן"). */
export async function DELETE(request: Request) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entryId = searchParams.get("entryId");
  const placeId = searchParams.get("placeId");
  if (!entryId && !placeId) return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });

  let query = supabase.from("place_calendar_entries").delete().eq("user_id", user.id);
  query = entryId ? query.eq("id", entryId) : query.eq("place_id", placeId as string);
  const { error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
