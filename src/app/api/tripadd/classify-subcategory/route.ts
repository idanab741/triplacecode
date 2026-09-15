import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { classifySubcategory } from "@/services/tripadd/subcategoryClassifier";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

const VALID_CATEGORIES: TripAddCategory[] = ["attraction", "food", "shopping", "nature", "nightlife", "sleep"];

/**
 * נקרא מ-AddPlaceModal מיד כשהמשתמש בוחר קטגוריה ראשית (לאחר שכבר
 * נבחר מקום מ-Google) - מחזיר סיווג AI (קבוצה+תגית) מתוך הרשימה
 * הסגורה של tripAddSubcategories.ts. ר' subcategoryClassifier.ts.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = body?.name as string | undefined;
  const address = body?.address as string | undefined;
  const category = body?.category as TripAddCategory | undefined;

  if (!name?.trim() || !category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "חסר שם או קטגוריה לא תקינה" }, { status: 422 });
  }

  const result = await classifySubcategory(category, name.trim(), address);
  if (!result) {
    return NextResponse.json({ error: "לא הצלחנו לסווג את המקום" }, { status: 502 });
  }

  return NextResponse.json({ group: result.group, tag: result.tag });
}
