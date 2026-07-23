import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * מחזיר רשימת יעדים (שם עיר) מתוך טבלת destinations האמיתית - להשלמה
 * אוטומטית ב-TripMatch. משתמש ביעדים שכבר קיימים ב"יעדים חמים" בעמוד הבית,
 * לא ב-places.city (שיכול להיות ריק/לא עקבי).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ cities: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("name, country")
    .ilike("name", `%${query}%`)
    .limit(8);

  if (error) return NextResponse.json({ cities: [] });

  const cities = (data ?? []).map((row) => row.name as string);
  return NextResponse.json({ cities });
}