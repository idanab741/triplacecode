import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin, parseRange } from "@/services/admin/insights/core";
import { buildOverview } from "@/services/admin/insights/overview";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await buildOverview(createAdminClient(), parseRange(request)));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
