import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { searchPeople, searchCreators } from "@/services/social/socialSearchService";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  const [people, creators] = await Promise.all([searchPeople(supabase, q), searchCreators(supabase, q)]);
  // Places/Trips/Communities יתווספו כאן כשמנועי החיפוש שלהם משולבים
  // (Places כבר קיים ב-unifiedPlaceService - חיבור ב-UI, לא כפילות; סעיף 21)
  return NextResponse.json({ people, creators });
}
