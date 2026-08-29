import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const VALID_PRIORITIES = ["normal", "important", "urgent"];
const VALID_STATUSES = ["active", "disabled"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "גוף בקשה לא תקין" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.description === "string") patch.description = body.description.trim();
  if (typeof body.imageUrl === "string" || body.imageUrl === null) patch.image_url = body.imageUrl || null;
  if (typeof body.icon === "string" || body.icon === null) patch.icon = body.icon || null;
  if (VALID_PRIORITIES.includes(body.priority)) patch.priority = body.priority;
  if (VALID_STATUSES.includes(body.status)) patch.status = body.status;
  if (typeof body.actionUrl === "string" || body.actionUrl === null) patch.action_url = body.actionUrl || null;
  if (typeof body.actionLabel === "string" || body.actionLabel === null) patch.action_label = body.actionLabel || null;
  if (typeof body.pushEnabled === "boolean") patch.push_enabled = body.pushEnabled;
  if (typeof body.publishedAt === "string") patch.published_at = body.publishedAt;
  if (typeof body.expiresAt === "string" || body.expiresAt === null) patch.expires_at = body.expiresAt || null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("notifications").update(patch).eq("id", id).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
