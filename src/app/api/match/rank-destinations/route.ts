import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { rankDestinations } from "@/services/matching/matchingService";

/** מדרג יעדים עבור המשתמש המחובר, לפי ה-Travel DNA שלו. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const destinationIds: string[] | undefined = body?.destinationIds;

  if (!destinationIds || !Array.isArray(destinationIds)) {
    return NextResponse.json({ error: "יש לספק destinationIds" }, { status: 400 });
  }

  try {
    const results = await rankDestinations(supabase, user.id, destinationIds);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
