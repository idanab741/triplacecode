import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { fetchDiscoveryPlaces } from "@/services/places/discoveryService";
import { ADMIN_DISCOVERY_SECTIONS } from "@/constants/adminDiscoverySections";
import type { QuickCategoryId } from "@/constants/quickCategories";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** מחזירה את האטרקציות התואמות לסקשן אמיתי (מתוך ADMIN_DISCOVERY_SECTIONS,
 *  שהועתק במדויק מ-DISCOVERY_SECTIONS של כל אחד מעמודי ה-Discovery
 *  האמיתיים) - משתמשת ב-fetchDiscoveryPlaces המשותף (אותה פונקציה
 *  בדיוק שהאפליקציה עצמה קוראת לה), כדי שהתוצאות יהיו זהות אחד לאחד
 *  למה שהאפליקציה הייתה מציגה, בלי כפל לוגיקת סינון. בניגוד לאפליקציה
 *  (שם "כללי" = ליד המשתמש/בישראל בלבד) - כאן *בלי* מיקום, וברירת
 *  המחדל world/country נשלטת ע"י ?country= (worldwide אם לא סופק). */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const quickCategory = searchParams.get("quickCategory") as QuickCategoryId | null;
  const sectionId = searchParams.get("sectionId");
  const country = searchParams.get("country") || undefined;
  const limit = Number(searchParams.get("limit") ?? 200);

  if (!quickCategory || !sectionId) {
    return NextResponse.json({ error: "יש לספק quickCategory ו-sectionId" }, { status: 400 });
  }

  const sections = ADMIN_DISCOVERY_SECTIONS[quickCategory];
  const section = sections?.find((s) => s.id === sectionId);
  if (!section) {
    return NextResponse.json({ error: "סקשן לא מוכר" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const places = await fetchDiscoveryPlaces(supabase, {
    location: { lat: null, lng: null, city: null },
    category: section.category,
    categories: section.categories,
    subcategories: section.subcategories,
    requiredAnyTags: section.requiredAnyTags,
    requiredAnyCuisineTags: section.requiredAnyCuisineTags,
    categoryColumnEquals: section.categoryColumnEquals,
    allowNightlife: section.allowNightlife ?? true, // אדמין רוצה לראות הכל, כולל nightlife, גם בסקשנים שלא ביקשו את זה במפורש
    country,
    worldwide: !country,
    limit,
  });

  return NextResponse.json({ places, section: { id: section.id, emoji: section.emoji, title: section.title } });
}
