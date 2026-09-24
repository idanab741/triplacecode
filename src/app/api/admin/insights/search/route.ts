import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/admin/insights/core";
import { globalSearch } from "@/services/admin/insights/search";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return NextResponse.json({ hits: await globalSearch(createAdminClient(), q) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
