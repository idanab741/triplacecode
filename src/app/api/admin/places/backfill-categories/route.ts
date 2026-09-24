import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { ensurePlaceCategories, placeCategoryLabels, REQUIRED_CATEGORIES } from "@/services/places/placeCategories";

/**
 * השלמת קטגוריות (AI) למקומות קיימים שיש להם פחות מ-3 - חד-פעמי / לפי הצורך.
 * POST עם x-admin-secret. ?scope=user (ברירת מחדל - מקומות שמשתמשים הוסיפו) או ?scope=all.
 * ?limit= כמה מקומות לעבד בקריאה אחת (ברירת מחדל 25, עד 60) - כדי לא לחרוג מזמן הריצה.
 * מחזיר כמה עובדו וכמה עוד נשארו; קוראים שוב עד ש-remaining=0.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_API_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") === "all" ? "all" : "user";
  const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit")) || 25));

  const supabase = createAdminClient();
  let query = supabase.from("places").select("id, category, trip_type_tags, cuisine_tags, tags").order("created_at", { ascending: false }).limit(6000);
  if (scope === "user") query = query.eq("source", "user_review");
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const missing = (data ?? []).filter((p) => placeCategoryLabels(p, 99).length < REQUIRED_CATEGORIES);
  const batch = missing.slice(0, limit);
  const results: { id: string; categories: number }[] = [];
  for (const p of batch) {
    results.push({ id: p.id as string, categories: await ensurePlaceCategories(p.id as string) });
  }
  return NextResponse.json({
    processed: results.length,
    fixed: results.filter((r) => r.categories >= REQUIRED_CATEGORIES).length,
    remaining: missing.length - batch.length,
    results,
  });
}
