import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { respondToFriendRequest } from "@/services/social/friendService";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const response = body?.response as "accepted" | "declined" | undefined;
  if (response !== "accepted" && response !== "declined") {
    return NextResponse.json({ error: "response חייב להיות accepted/declined" }, { status: 422 });
  }

  await respondToFriendRequest(supabase, id, user.id, response);
  return NextResponse.json({ status: response });
}
