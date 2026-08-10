import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * מחזיר אופציות השלמה אוטומטית ליעד ב-TripMatch, מתוך טבלת destinations
 * (221 היעדים שנבחרו ידנית). לפני התיקון הזה, זה החזיר רק שם עיר בודד
 * ("אתונה") - בלי מדינה, ובלי אפשרות לחפש/לבחור לפי מדינה שלמה.
 *
 * עכשיו זה מחזיר שני סוגי אופציות:
 * - "city": יעד ברמת עיר, עם label בפורמט "עיר, מדינה" (או "עיר, אזור,
 *   מדינה" כשיש אזור בסוגריים במקור, למשל "הרקליון (כרתים)" -> value
 *   נשאר "הרקליון" בלבד כדי להתאים למה שבאמת שמור ב-places.city, אבל
 *   ה-label שמוצג לאדמין/למשתמש הוא "הרקליון, כרתים, יוון").
 * - "country": יעד ברמת מדינה שלמה (value=label=שם המדינה) - לחיפוש
 *   "יוון" ולקבלת כל האטרקציות במדינה, לא רק בעיר ספציפית.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ options: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("destinations")
    .select("name, country")
    .or(`name.ilike.%${query}%,country.ilike.%${query}%`)
    .limit(40);

  if (error) return NextResponse.json({ options: [] });

  type Option = { value: string; label: string; type: "city" | "country" };
  const cityOptions: Option[] = [];
  const seenCityValues = new Set<string>();
  const countrySet = new Set<string>();

  for (const row of data ?? []) {
    const rawName = row.name as string;
    const country = row.country as string;
    countrySet.add(country);

    // "הרקליון (כרתים)" -> עיר="הרקליון", אזור="כרתים"
    const regionMatch = rawName.match(/^(.+?)\s*\(([^)]+)\)$/);
    const cityValue = (regionMatch ? regionMatch[1] : rawName).trim();
    const region = regionMatch ? regionMatch[2].trim() : null;
    const label = region ? `${cityValue}, ${region}, ${country}` : `${cityValue}, ${country}`;

    if (!seenCityValues.has(cityValue)) {
      seenCityValues.add(cityValue);
      cityOptions.push({ value: cityValue, label, type: "city" });
    }
  }

  const countryOptions: Option[] = Array.from(countrySet)
    .filter((c) => c.includes(query))
    .sort((a, b) => a.localeCompare(b, "he"))
    .map((c) => ({ value: c, label: c, type: "country" as const }));

  // מדינות קודם (בחירה רחבה יותר), ואז ערים - עד 12 סה"כ כדי לא להציף.
  const options = [...countryOptions, ...cityOptions].slice(0, 12);

  return NextResponse.json({ options });
}
