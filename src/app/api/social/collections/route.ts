import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { CollectionInputError, createCollection, parseCollectionInput } from "@/services/social/collectionService";
import type { CollectionType } from "@/services/social/collectionTypes";

/** יצירת (ופרסום) אוסף. גוף הבקשה: { type: "places"|"trips", title, description?, coverUrl?, visibility?, items: [...] }.
 *  אוסף חייב כותרת + לפחות 2 פריטים (ר' parseCollectionInput). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const type = body?.type as CollectionType | undefined;
  if (type !== "places" && type !== "trips") {
    return NextResponse.json({ error: "סוג האוסף לא תקין" }, { status: 422 });
  }

  try {
    const input = parseCollectionInput(type, body);
    const id = await createCollection(supabase, user.id, type, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    if (err instanceof CollectionInputError) return NextResponse.json({ error: err.message }, { status: 422 });
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה ביצירת האוסף" }, { status: 400 });
  }
}
