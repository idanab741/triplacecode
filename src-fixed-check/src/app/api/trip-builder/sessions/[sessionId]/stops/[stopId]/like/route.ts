import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { likeStop } from "@/services/tripBuilder/swipeService";
import type { CandidatePlace } from "@/services/tripBuilder/types";

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

  const candidate: CandidatePlace | undefined = await request.json().then(
    (body) => body?.candidate,
    () => undefined
  );

  if (!candidate) return NextResponse.json({ error: "יש לספק candidate" }, { status: 400 });

  try {
    await likeStop(supabase, user.id, stopId, candidate);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
