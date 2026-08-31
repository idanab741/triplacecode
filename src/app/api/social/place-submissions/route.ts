import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createPlaceSubmission, getMySubmissions, type PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

const VALID_CATEGORIES: PlaceSubmissionCategory[] = ["restaurant", "attraction", "nature", "nightlife", "hotel"];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const submissions = await getMySubmissions(supabase, user.id);
  return NextResponse.json({ submissions });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = body?.name as string | undefined;
  const category = body?.category as PlaceSubmissionCategory | undefined;
  if (!name?.trim() || !category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "חסר שם או קטגוריה לא תקינה" }, { status: 422 });
  }

  try {
    const id = await createPlaceSubmission(supabase, {
      submittedBy: user.id,
      name: name.trim(),
      category,
      description: body?.description,
      city: body?.city,
      address: body?.address,
      latitude: body?.latitude,
      longitude: body?.longitude,
      website: body?.website,
      mediaIds: body?.mediaIds,
      googlePlaceId: body?.googlePlaceId,
      googlePhotoUrl: body?.googlePhotoUrl,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
