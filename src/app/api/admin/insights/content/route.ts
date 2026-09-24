import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin, parseRange } from "@/services/admin/insights/core";
import { buildContent } from "@/services/admin/insights/content";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await buildContent(createAdminClient(), parseRange(request)));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
