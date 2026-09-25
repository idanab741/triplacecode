import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getAddTargets } from "@/services/social/addTargetsService";

const UUID = /^[0-9a-f-]{36}$/i;

/** "הוספה ל..." - המפות והטיולים שלי. ?placeIds=a,b מסמן איפה המקומות כבר נמצאים. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const raw = new URL(request.url).searchParams.get("placeIds") ?? "";
  const placeIds = raw.split(",").filter((id) => UUID.test(id)).slice(0, 60);
  try {
    return NextResponse.json(await getAddTargets(supabase, user.id, placeIds));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת המפות והטיולים" }, { status: 500 });
  }
}
