import { createAdminClient } from "@/services/supabase/admin";

/**
 * מוריד תמונה מ-Google Places פעם אחת בלבד, ושומר אותה לצמיתות ב-Supabase
 * Storage. כך צפיות עתידיות של משתמשים לא עולות כסף נוסף לגוגל בכלל.
 */
export async function downloadAndStorePhoto(
  googlePhotoName: string,
  storagePath: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const googleUrl = `https://places.googleapis.com/v1/${googlePhotoName}/media?maxWidthPx=800&key=${apiKey}`;
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
