import type { SupabaseClient } from "@supabase/supabase-js";

export interface UploadedMedia {
  id: string;
  type: "image" | "video";
  url: string;
}

/** מעלה קובץ ל-bucket social-media (0067) ורושם אותו ב-media_assets.
 *  אותו דפוס בדיוק כמו uploadAvatar הקיים ב-profileService - path תחת
 *  תיקיית המשתמש (auth.uid()), תואם למדיניות ה-Storage RLS. */
export async function uploadSocialMedia(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<UploadedMedia> {
  const isVideo = file.type.startsWith("video/");
  const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from("social-media").upload(path, file, { upsert: false });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from("social-media").getPublicUrl(path);

  let width: number | null = null;
  let height: number | null = null;
  if (!isVideo) {
    try {
      const dims = await getImageDimensions(file);
      width = dims.width;
      height = dims.height;
    } catch {
      // לא קריטי - הממדים אופציונליים ב-media_assets
    }
  }

  const { data: row, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      owner_id: userId,
      type: isVideo ? "video" : "image",
      url: publicUrlData.publicUrl,
      mime_type: file.type,
      width,
      height,
      file_size: file.size,
    })
    .select("id, type, url")
    .single();
  if (insertError) throw insertError;

  return row as UploadedMedia;
}

export async function uploadMultipleSocialMedia(
  supabase: SupabaseClient,
  userId: string,
  files: File[]
): Promise<UploadedMedia[]> {
  return Promise.all(files.map((file) => uploadSocialMedia(supabase, userId, file)));
}

function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
