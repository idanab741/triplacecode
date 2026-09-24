import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/admin/insights/core";
import { listSubmissions, type SubmissionStatus } from "@/services/admin/insights/submissions";

/** GET ?status=pending|approved|rejected|all&q= - הצעות מקומות + TripAdd לניהול */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const raw = url.searchParams.get("status") ?? "pending";
  const status = (["pending", "approved", "rejected", "all"].includes(raw) ? raw : "pending") as SubmissionStatus | "all";
  try {
    return NextResponse.json(await listSubmissions(createAdminClient(), status, url.searchParams.get("q") ?? ""));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
