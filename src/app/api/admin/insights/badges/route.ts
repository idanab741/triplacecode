import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin, countRows } from "@/services/admin/insights/core";

/** מונים קלים לתגיות בתפריט הצד - נשאלים כל דקה. */
export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const db = createAdminClient();
  const [support, placeSubs, tripadd] = await Promise.all([
    countRows(db, "support_conversations", (q) => q.eq("status", "waiting_for_admin")),
    countRows(db, "place_submissions", (q) => q.eq("status", "pending")),
    countRows(db, "tripadd_submissions", (q) => q.eq("status", "pending")),
  ]);
  return NextResponse.json({ support: support ?? 0, submissions: (placeSubs ?? 0) + (tripadd ?? 0) });
}
