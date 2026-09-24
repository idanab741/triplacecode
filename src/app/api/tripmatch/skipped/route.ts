import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** מקומות שהמשתמש דילג עליהם (X) ב-TripMatch - מוסתרים מכל חפיסה עד ששוחזרו.
 *  GET - כמה מוסתרים כרגע. DELETE - שחזור של כולם (חוזרים לחפיסה בטעינה הבאה). */
async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  const { count, error } = await supabase
    .from("favorites")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "skipped")
    .eq("source", "tripmatch");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ count: count ?? 0 });
}

export async function DELETE() {
  const { supabase, user } = await currentUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  const { data, error } = await supabase
    .from("favorites")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "skipped")
    .eq("source", "tripmatch")
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restored: data?.length ?? 0 });
}
