import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/admin/insights/core";
import { moderate, type ModerationAction } from "@/services/admin/insights/community";

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as ModerationAction | null;
  const validKind = (k: unknown) => k === "place" || k === "tripadd";
  if (
    !body ||
    typeof body.id !== "string" ||
    !(
      body.action === "hide_post" ||
      ((body.action === "approve_submission" || body.action === "reject_submission") && validKind(body.kind))
    )
  ) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 422 });
  }
  try {
    await moderate(createAdminClient(), body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
