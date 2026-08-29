import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import type { TrippyQuickStop } from "@/services/tripBuilder/trippyQuickShared";

/**
 * *** תוספת (ר' migration 0057 + trip-builder/trippy-quick/route.ts):
 * רשימת התוצאות השמורות של הצ'אט המהיר - נפרד לגמרי מ-
 * /api/trip-builder/sessions/saved (שמחזיר trip_builder_sessions, טיולי
 * יום/חופשה "אמיתיים"). MyTripsSection.tsx מאחד את שתי הרשימות בתצוגה,
 * אבל שולף אותן משני מקורות נפרדים בבירור.
 */
export interface TrippyAiPreview {
  id: string;
  title: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  shareToken: string;
  source: "trippy_ai";
}

const PREVIEW_LIMIT_DEFAULT = 10;

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : PREVIEW_LIMIT_DEFAULT;

  const { data, error } = await supabase
    .from("trippy_ai_results")
    .select("id,title,stops,share_token,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: TrippyAiPreview[] = (data ?? []).map((row) => {
    const stops = (row.stops as TrippyQuickStop[] | null) ?? [];
    return {
      id: row.id as string,
      title: (row.title as string) ?? "המסלול שלכם",
      imageUrl: stops[0]?.imageUrl ?? null,
      stopCount: stops.length,
      createdAt: row.created_at as string,
      shareToken: row.share_token as string,
      source: "trippy_ai",
    };
  });

  return NextResponse.json({ results });
}
