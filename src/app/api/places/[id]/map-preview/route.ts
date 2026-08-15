import { NextResponse } from "next/server";
import { getPlaceById } from "@/services/places/placesServerService";
import { createAdminClient } from "@/services/supabase/admin";

/** מחזירה תמונת מפה סטטית (Google Static Maps) עבור מקום - ה-API key
 *  (GOOGLE_MAPS_API_KEY, ללא NEXT_PUBLIC_) נשאר בצד השרת בלבד; לא נחשף
 *  בשום URL שהדפדפן רואה.
 *
 *  *** תיקון עלויות: המקום הזה כבר קיים אצלנו ב-DB עם lat/lng קבועים -
 *  אין שום סיבה לקנות מגוגל מפה סטטית חדשה בכל צפייה של כל משתמש. פעם
 *  ראשונה בלבד מורידים ושומרים לצמיתות ל-Supabase Storage (אותו דפוס
 *  בדיוק כמו downloadAndStorePhoto ב-photoStorageService.ts), ומכאן והלאה
 *  כל הצפיות מוגשות מהאחסון שלנו, בלי לגעת בגוגל שוב בכלל. ***
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const place = await getPlaceById(id);

  if (!place) {
    return NextResponse.json({ error: "מקום לא נמצא" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const storagePath = `map-previews/${id}.png`;

  // בדיקה ראשונה: כבר יש לנו מפה שמורה למקום הזה? אם כן - מגישים אותה
  // ישירות, בלי לגעת בגוגל בכלל (0 עלות מפה זו והלאה).
  const { data: existing } = await supabase.storage.from("place-images").list("map-previews", {
    search: `${id}.png`,
  });
  if (existing && existing.length > 0) {
    const { data: publicUrl } = supabase.storage.from("place-images").getPublicUrl(storagePath);
    const cachedResponse = await fetch(publicUrl.publicUrl);
    if (cachedResponse.ok) {
      const cachedBuffer = await cachedResponse.arrayBuffer();
      return new NextResponse(cachedBuffer, {
        headers: {
          "Content-Type": "image/png",
          // גם cache חזק בדפדפן/CDN - זה תוכן שלנו כבר, יציב לצמיתות
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח מפות לא מוגדר" }, { status: 500 });
  }

  const params_ = new URLSearchParams({
    center: `${place.latitude},${place.longitude}`,
    zoom: "14",
    size: "640x320",
    scale: "2",
    maptype: "roadmap",
    markers: `color:0x1b6fe8|${place.latitude},${place.longitude}`,
    key: apiKey,
  });

  const mapResponse = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params_}`);
  if (!mapResponse.ok) {
    const body = await mapResponse.text().catch(() => "");
    console.error(`[map-preview] Google Static Maps failed: ${mapResponse.status} - ${body}`);
    return NextResponse.json({ error: `טעינת מפה נכשלה: ${body || mapResponse.status}` }, { status: 502 });
  }

  const imageBuffer = await mapResponse.arrayBuffer();

  // שומרים לצמיתות לאחסון שלנו - כל הצפיות הבאות (מכל המשתמשים) יוגשו
  // מכאן, לא מגוגל. כישלון שמירה לא אמור לחסום את התגובה הנוכחית למשתמש.
  await supabase.storage
    .from("place-images")
    .upload(storagePath, imageBuffer, { contentType: "image/png", upsert: true })
    .catch((err) => console.error("[map-preview] שמירת מפה לאחסון נכשלה", err));

  return new NextResponse(imageBuffer, {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
