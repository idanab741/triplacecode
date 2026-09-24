import { NextResponse } from "next/server";
import { requireAdmin } from "@/services/admin/insights/core";

/** מאמת את סיסמת האדמין לפני שמכניסים למערכת (במקום לקבל כל קלט). */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}
