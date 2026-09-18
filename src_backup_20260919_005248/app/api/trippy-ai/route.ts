import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import type { TrippyQuickStop } from "@/services/tripBuilder/trippyQuickShared";
import { UNSAVED_CONTENT_RETENTION_DAYS } from "@/constants/contentRetention";

/**
 * *** תוספת (ר' migration 0057 + trip-builder/trippy-quick/route.ts):
 * רשימת התוצאות השמורות של הצ'אט המהיר - נפרד לגמרי מ-
 * /api/trip-builder/sessions/saved (שמחזיר trip_builder_sessions, טיולי
 * יום/חופשה "אמיתיים"). MyTripsSection.tsx / trips/page.tsx מאחדים
 * את שתי הרשימות בתצוגה, אבל שולפים אותן משני מקורות נפרדים בבירור.
 *
 * *** תיקון (בקשה מפורשת - "עמוד הבחירות שלי - שינויים", סעיף "שמור"):
 * עד עכשיו לא היה כאן מושג "שמור" בכלל - כל התוצאות פשוט הוחזרו, בלי
 * הבחנה בין זמני לקבוע. עכשיו, בדיוק כמו
 * /api/trip-builder/sessions/saved/route.ts: פרמטר `all` קובע האם
 * להחזיר רק שמורות (ברירת מחדל - is_saved=true) או גם זמניות בתוך
 * חלון ההסרה (all=true - is_saved=true או created_at בתוך
 * UNSAVED_CONTENT_RETENTION_DAYS האחרונים).
 */
export interface TrippyAiPreview {
  id: string;
  title: string;
  imageUrl: string | null;
  stopCount: number;
  createdAt: string;
  shareToken: string;
  isSaved: boolean;
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
  const savedOnly = searchParams.get("all") !== "true";

  let query = supabase
    .from("trippy_ai_results")
    .select("id,title,stops,share_token,created_at,is_saved")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (savedOnly) {
    query = query.eq("is_saved", true);
  } else {
    const cutoffIso = new Date(Date.now() - UNSAVED_CONTENT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.or(`is_saved.eq.true,created_at.gte.${cutoffIso}`);
  }
  if (limit) query = query.limit(limit);

  const { data, error } = await query;

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
      isSaved: row.is_saved === true,
      source: "trippy_ai",
    };
  });

  return NextResponse.json({ results });
}
