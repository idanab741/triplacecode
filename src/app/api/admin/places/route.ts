import { NextResponse } from "next/server";
import { collectSinglePlaceByName } from "@/services/places/collectSinglePlace";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מוסיפה מקום בודד לפי שם. */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name;

  if (!name) {
    return NextResponse.json({ error: "יש לספק name" }, { status: 400 });
  }

  try {
    const result = await collectSinglePlaceByName(name);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** מחזירה את כל המקומות הקיימים, לתצוגה בעמוד האדמין. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
const { data, error } = await supabase
    .from("places")
    .select("*")
    .order("created_at", { ascending: false })
    .range(0, 4999);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ places: data });
}