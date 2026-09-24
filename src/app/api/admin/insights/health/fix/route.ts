import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/admin/insights/core";
import { runFix, FIX_ACTIONS, type FixAction } from "@/services/admin/insights/health";

/** POST { action, dryRun } - dryRun=true מחזיר תצוגה מקדימה בלי לשנות דבר. */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = (await request.json().catch(() => null)) as { action?: string; dryRun?: boolean } | null;
  if (!body?.action || !FIX_ACTIONS.includes(body.action as FixAction)) {
    return NextResponse.json({ error: "פעולה לא מוכרת" }, { status: 422 });
  }
  try {
    return NextResponse.json(await runFix(createAdminClient(), body.action as FixAction, body.dryRun !== false));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
