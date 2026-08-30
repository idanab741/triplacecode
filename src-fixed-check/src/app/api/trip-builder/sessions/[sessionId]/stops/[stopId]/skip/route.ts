import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** מדלג על תחנה שאין לה מספיק מועמדים, כדי שהתהליך לא ייתקע. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; stopId: string }> }
) {
  const { stopId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  await supabase.from("trip_builder_stops").update({ status: "skipped" }).eq("id", stopId);
  return NextResponse.json({ ok: true });
}
