import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { requireAdmin } from "@/services/admin/insights/core";
import { updateSubmission, type SubmissionPatch } from "@/services/admin/insights/submissions";

/** PATCH { patch, approve? } - עריכת הצעה של משתמש (שם, קטגוריה, תיאור, מיקום...). */
export async function PATCH(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { kind, id } = await params;
  if (kind !== "place" && kind !== "tripadd") return NextResponse.json({ error: "סוג לא תקין" }, { status: 422 });
  const body = (await request.json().catch(() => null)) as { patch?: SubmissionPatch; approve?: boolean } | null;
  if (!body || typeof body.patch !== "object" || body.patch === null) return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 422 });
  try {
    await updateSubmission(createAdminClient(), kind, id, body.patch, body.approve === true);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "שגיאה";
    return NextResponse.json({ error: message }, { status: /לא תקינ|ריק|חלקי|יחד/.test(message) ? 422 : message === "ההצעה לא נמצאה" ? 404 : 500 });
  }
}
