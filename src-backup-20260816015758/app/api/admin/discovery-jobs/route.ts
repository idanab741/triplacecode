import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("discovery_jobs").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data ?? [] });
}

/** יוצרת רשומת Discovery Job - **רק רישום הבקשה**, לא מריצה בפועל את
 *  מנוע החיפוש (Google Discovery + Duplicate Detection + AI Enrichment +
 *  TripMatch Classification) - זה בנוי בפאזה הבאה. status נשאר "pending". */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body?.tripType || !body?.quantity) {
    return NextResponse.json({ error: "יש לספק tripType ו-quantity" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discovery_jobs")
    .insert({
      trip_type: body.tripType,
      categories: body.categories ?? [],
      filters: body.filters ?? {},
      min_rating: body.minRating ?? 4.0,
      requested_quantity: body.quantity,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: data });
}
