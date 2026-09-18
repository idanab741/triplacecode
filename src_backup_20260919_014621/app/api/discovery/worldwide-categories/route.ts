import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { WORLDWIDE_DESTINATION_REGISTRY, type WorldwideDestinationEntry } from "@/constants/worldwideVacationCategories";

/**
 * מתאם slug מקומי (worldwideVacationCategories.ts) -> UUID אמיתי מטבלת
 * destinations, לפי שם (Audit - "כן, תתאים לרשומות אמיתיות בטבלת
 * destinations"). דינמי בזמן ריצה (לא מיפוי קשיח שכתבתי ידנית) - כי
 * אין לי גישה לבדוק בעצמי אילו מ-92 השמות באמת קיימים ב-DB ובאיזה
 * איות מדויק; שאילתה בפועל היא הדרך היחידה לדעת בוודאות, לא ניחוש.
 * שם שלא נמצא -> null (הכרטיס עדיין מוצג, פשוט לא לחיץ - ר'
 * WorldwideCategorySection.tsx).
 */
export async function GET() {
  const supabase = await createClient();
  const names = Object.values(WORLDWIDE_DESTINATION_REGISTRY).map((d: WorldwideDestinationEntry) => d.name);

  const { data, error } = await supabase.from("destinations").select("id,name").in("name", names);

  if (error) {
    console.error("[worldwide-categories] שגיאת התאמת יעדים", { message: error.message });
    return NextResponse.json({ matches: {} });
  }

  const nameToId = new Map<string, string>(
    (data ?? []).map((row: { id: string; name: string }) => [row.name, row.id])
  );

  const matches: Record<string, string | null> = {};
  const entries = Object.entries(WORLDWIDE_DESTINATION_REGISTRY) as [string, WorldwideDestinationEntry][];
  for (const [slug, entry] of entries) {
    matches[slug] = nameToId.get(entry.name) ?? null;
  }

  return NextResponse.json({ matches });
}
