import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** בודק האם מקום מסוים כבר נמצא ביומן של המשתמש (בכל תאריך) - לטעינת
 *  המצב ההתחלתי של כפתור "הוספה ליומן" / "הסרה מהיומן" בעמוד תוצאת החיפוש. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
  if (!placeId) return NextResponse.json({ error: "חסר placeId" }, { status: 400 });

  const { data, error } = await supabase
    .from("place_calendar_entries")
    .select("id,calendar_date")
    .eq("user_id", user.id)
    .eq("place_id", placeId)
    .order("calendar_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inCalendar: data != null, calendarDate: data?.calendar_date ?? null });
}

/** מוסיף מקום בודד (מעמוד תוצאת חיפוש) ליומן, בתאריך שהמשתמש בחר בפופאפ. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const placeId = body?.placeId as string | undefined;
  const placeName = body?.placeName as string | undefined;
  const imageUrl = (body?.imageUrl as string | null | undefined) ?? null;
  const date = body?.date as string | undefined;

  if (!placeId || !placeName) {
    return NextResponse.json({ error: "חסרים פרטי מקום" }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
  }

  const { error } = await supabase.from("place_calendar_entries").insert({
    user_id: user.id,
    place_id: placeId,
    place_name: placeName,
    image_url: imageUrl,
    calendar_date: date,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** מסיר מקום מהיומן (כל התאריכים שבהם הוא מופיע) - לחיצה חוזרת על הכפתור. */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId");
  if (!placeId) return NextResponse.json({ error: "חסר placeId" }, { status: 400 });

  const { error } = await supabase
    .from("place_calendar_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("place_id", placeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
