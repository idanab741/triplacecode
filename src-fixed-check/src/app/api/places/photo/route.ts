import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/services/supabase/admin";

/**
 * פרוקסי לתמונות Google Places - מפתח ה-API נשאר בשרת בלבד, לא נחשף בדפדפן.
 * הדפדפן פונה לכתובת הזו (/api/places/photo?ref=...), והשרת שלנו מביא
 * את התמונה בפועל מגוגל ומעביר אותה הלאה.
 *
 * *** תיקון עלויות (SKU "Places Photo" - אושר בדוח החיוב כ-76% מהעלייה
 * בעלות ל-Places API): כותרות Cache-Control לבד לא מספיקות - CDN edge cache
 * לא מובטח לצמיתות ולא תמיד עקבי בין אזורים. אותו photo_reference נשמר
 * עכשיו לצמיתות ב-Supabase Storage בפעם הראשונה שהוא נטען - כל טעינה נוספת
 * (מכל משתמש, מכל מכשיר, לנצח) מוגשת מהאחסון שלנו, בלי לגעת בגוגל שוב
 * בכלל. אותו דפוס בדיוק כמו downloadAndStorePhoto/map-preview. ***
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  const maxwidth = searchParams.get("maxwidth") ?? "800";

  if (!ref) {
    return NextResponse.json({ error: "יש לספק ref" }, { status: 400 });
  }

  // מפתח קבוע וקצר ל-storage, לפי hash של ה-ref+maxwidth (ref עצמו יכול
  // להיות ארוך/עם תווים לא תקינים לנתיב קובץ).
  const cacheKey = createHash("sha256").update(`${ref}:${maxwidth}`).digest("hex");
  const storagePath = `live-photos/${cacheKey}.jpg`;

  const supabase = createAdminClient();

  // בדיקה ראשונה: כבר יש לנו את התמונה הזו שמורה? מגישים ישירות מהאחסון
  // שלנו - 0 קריאות לגוגל מכאן והלאה, לצמיתות.
  const { data: existing } = await supabase.storage.from("place-images").list("live-photos", {
    search: `${cacheKey}.jpg`,
  });
  if (existing && existing.length > 0) {
    const { data: publicUrl } = supabase.storage.from("place-images").getPublicUrl(storagePath);
    const cachedResponse = await fetch(publicUrl.publicUrl);
    if (cachedResponse.ok) {
      const cachedBuffer = await cachedResponse.arrayBuffer();
      return new NextResponse(cachedBuffer, {
        headers: {
          "Content-Type": cachedResponse.headers.get("Content-Type") ?? "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GOOGLE_MAPS_API_KEY אינו מוגדר" }, { status: 500 });
  }

  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(
    ref
  )}&key=${apiKey}`;

  const response = await fetch(googleUrl);
  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "לא הצלחנו להביא את התמונה" }, { status: 502 });
  }

  const contentType = response.headers.get("Content-Type") ?? "image/jpeg";
  const imageBuffer = await response.arrayBuffer();

  // שומרים לצמיתות - כישלון שמירה לא אמור לחסום את התגובה הנוכחית למשתמש.
  await supabase.storage
    .from("place-images")
    .upload(storagePath, imageBuffer, { contentType, upsert: true })
    .catch((err) => console.error("[photo] שמירת תמונה לאחסון נכשלה", err));

  return new NextResponse(imageBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}