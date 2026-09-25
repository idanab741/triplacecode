import { NextResponse, after } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import { resolveCollectablePlaces } from "@/services/places/collectablePlaces";
import { enrichPlaceFromGoogle } from "@/services/places/placeEnrichmentService";
import { ensurePlaceCategories } from "@/services/places/placeCategories";

/** ההעשרה ברקע (תמונה/דירוג/קטגוריות) יכולה לקחת כמה שניות למקום. */
export const maxDuration = 60;

/**
 * בחירה מרובה -> אוסף / מסלול: מקבל מזהי מקומות כפי שהמשתמש רואה אותם (places או מקומות קהילה)
 * ומחזיר Places אמיתיים שאפשר להכניס לאוסף/טיול. ר' services/places/collectablePlaces.ts.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const ids = Array.isArray(body?.ids) ? body.ids.filter((v: unknown): v is string => typeof v === "string") : [];
  if (ids.length === 0) return NextResponse.json({ error: "לא נבחרו מקומות" }, { status: 422 });

  try {
    const result = await resolveCollectablePlaces(createAdminClient(), ids, user.id);
    if (result.createdPlaceIds.length) {
      after(async () => {
        for (const placeId of result.createdPlaceIds) {
          await enrichPlaceFromGoogle(placeId).catch(() => {});
          await ensurePlaceCategories(placeId).catch(() => 0);
        }
      });
    }
    return NextResponse.json({ places: result.places, skipped: result.skipped });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 500 });
  }
}
