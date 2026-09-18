import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { ISRAEL_VACATION_DESTINATIONS } from "@/constants/israelVacationDestinations";

/**
 * מתאם slug (constants/israelVacationDestinations.ts) -> UUID אמיתי
 * מטבלת destinations, לפי שם - אותו דפוס בדיוק כמו
 * /api/discovery/worldwide-categories (ר' שם להסבר המלא). תיקון Product
 * מפורש: כרטיסי "🔥 היעדים החמים" בעמוד חופשה בארץ יובילו לעמוד יעד
 * בסגנון "חופשה בחו''ל" (/destination/[id] - תמונה, מזג אוויר וכו')
 * במקום עמוד ה-Discovery הישן (weekend/discover/destination/[slug]).
 */
export async function GET() {
  const supabase = await createClient();
  const names = ISRAEL_VACATION_DESTINATIONS.map((d) => d.name);

  const { data, error } = await supabase.from("destinations").select("id,name").in("name", names);

  if (error) {
    console.error("[israel-vacation-destinations] שגיאת התאמת יעדים", { message: error.message });
    return NextResponse.json({ matches: {} });
  }

  const nameToId = new Map<string, string>((data ?? []).map((row: { id: string; name: string }) => [row.name, row.id]));

  const matches: Record<string, string | null> = {};
  for (const dest of ISRAEL_VACATION_DESTINATIONS) {
    matches[dest.slug] = nameToId.get(dest.name) ?? null;
  }

  return NextResponse.json({ matches });
}
