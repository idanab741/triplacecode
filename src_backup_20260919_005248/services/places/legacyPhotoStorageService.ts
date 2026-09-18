import { createAdminClient } from "@/services/supabase/admin";

/**
 * קובץ זה היה חסר לגמרי מהריפו (import שלא הצביע על שום קובץ קיים -
 * `git log` על הנתיב הזה לא מחזיר כלום, זה לא נמחק, הוא פשוט אף פעם
 * לא נוצר). placeResolutionService.ts ו-vacationAttractionListService.ts
 * מייבאים ממנו את downloadAndStoreLegacyPhoto - זהה בתפקידו ל-
 * downloadAndStorePhoto ב-photoStorageService.ts, אבל ל"legacy" - כלומר
 * ל-photo_reference (Places API הישן, Text Search), לא ל-name/photos/...
 * (Places API החדש v1) - בדיוק כמו שמשמש כבר ב-src/app/api/places/photo/route.ts.
 *
 * מוריד תמונה מ-Google Places פעם אחת בלבד (לפי photo_reference), ושומר
 * אותה לצמיתות ב-Supabase Storage - כדי שצפיות עתידיות לא יחייבו קריאה
 * חוזרת לגוגל (ולא יעלו כסף נוסף) בכל פעם שמישהו רואה את המקום.
 */
export async function downloadAndStoreLegacyPhoto(
  photoReference: string,
  storagePath: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const googleUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(
    photoReference
  )}&key=${apiKey}`;

  const response = await fetch(googleUrl);
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const buffer = await response.arrayBuffer();

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from("place-images")
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) return null;

  const { data } = supabase.storage.from("place-images").getPublicUrl(storagePath);
  return data.publicUrl;
}
