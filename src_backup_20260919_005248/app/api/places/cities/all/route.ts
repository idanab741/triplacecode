import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * מחזיר את כל 221 היעדים מטבלת destinations (אותה רשימה מוקפדת שכבר
 * משמשת להשלמה אוטומטית ב-TripMatch) - ל"כל הערים שבהן יש Triplace"
 * בבחירת מיקום. לפני זה הכפתור הזה היה alert("בקרוב") בלבד.
 */
export async function GET() {
  const supabase = await createClient();
  // *** תיקון: מיון לפי שם העיר בלבד (א'-ת') - לא לפי מדינה קודם. לפני
  // זה הרשימה קובצה לפי מדינה ורק בתוכה מוינה, מה שנראה "לא מסודר" כי
  // זה לא תאם לציפייה של רשימה אלפביתית אחידה.
  const { data, error } = await supabase.from("destinations").select("name, country").order("name");

  if (error) return NextResponse.json({ cities: [] });

  const cities = (data ?? []).map((row) => ({ name: row.name as string, country: row.country as string }));
  return NextResponse.json({ cities });
}
