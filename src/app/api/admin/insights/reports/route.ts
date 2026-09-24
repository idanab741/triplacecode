import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/admin/insights/core";
import { buildReports, REPORT_RANGES, type ReportRange } from "@/services/admin/insights/reports";

/** GET ?range=all|7d|30d|90d|365d - כל הדוחות המסודרים לתצוגה ולייצוא */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const raw = new URL(request.url).searchParams.get("range") ?? "all";
  const range = (REPORT_RANGES as string[]).includes(raw) ? (raw as ReportRange) : "all";
  try {
    return NextResponse.json(await buildReports(createAdminClient(), range));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
