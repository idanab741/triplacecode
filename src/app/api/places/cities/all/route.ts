import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * מחזיר את כל 221 היעדים מטבלת destinations (אותה רשימה מוקפדת שכבר
 * משמשת להשלמה אוטומטית ב-TripMatch) - ל"כל הערים שבהן יש Triplace"
 * בבחירת מיקום. לפני זה הכפתור הזה היה alert("בקרוב") בלבד.
 */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("destinations").select("name, country").order("country").order("name");

  if (error) return NextResponse.json({ cities: [] });

  const cities = (data ?? []).map((row) => ({ name: row.name as string, country: row.country as string }));
  return NextResponse.json({ cities });
}
