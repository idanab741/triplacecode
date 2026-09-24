import type { SupabaseClient } from "@supabase/supabase-js";
import { compressImageFile } from "@/utils/compressImage";

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
  originalFile: File
): Promise<UploadedMedia> {
  const isVideo = originalFile.type.startsWith("video/");
  // *** ביצועים: תמונות מוקטנות בדפדפן לפני ההעלאה (ר' compressImage.ts).
  const file = isVideo ? originalFile : await compressImageFile(originalFile);
  const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // *** וידאו: מפיקים תמונת פתיחה (פריים ראשון) *במקביל* להעלאת הסרטון עצמו. בלי זה הפיד ניסה להציג את
  // קובץ הווידאו בתור תמונה - ויצאה תמונה שבורה (בקשה מפורשת - "הסרטון לא מופיע").
  const posterPromise = isVideo ? extractVideoPoster(file).catch(() => null) : Promise.resolve(null);

  const { error: uploadError } = await supabase.storage
    .from("social-media")
    .upload(path, file, { upsert: false, contentType: file.type || (isVideo ? "video/mp4" : "image/jpeg"), cacheControl: "31536000" });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage.from("social-media").getPublicUrl(path);

  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = null;
  let thumbnailUrl: string | null = null;
  const poster = await posterPromise;
  if (poster) {
    width = poster.width;
    height = poster.height;
    duration = poster.duration;
    const posterPath = path.replace(/\.[^.]+$/, "") + "-poster.jpg";
    const { error: posterError } = await supabase.storage
      .from("social-media")
      .upload(posterPath, poster.blob, { upsert: false, contentType: "image/jpeg", cacheControl: "31536000" });
    if (!posterError) thumbnailUrl = supabase.storage.from("social-media").getPublicUrl(posterPath).data.publicUrl;
  }
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
      thumbnail_url: thumbnailUrl,
      duration: duration != null ? Math.round(duration) : null,
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

/**
 * פריים מתוך הסרטון (בשנייה ~0.5) כ-JPEG ברוחב עד 1080px - משמש כתמונת הפתיחה בפיד, בפרופיל ובמפה.
 * אם הדפדפן לא מצליח לפענח את הסרטון (למשל HEVC במחשב Windows) - מחזיר null, וההעלאה ממשיכה בלי תמונת פתיחה.
 */
function extractVideoPoster(file: File): Promise<{ blob: Blob; width: number; height: number; duration: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let done = false;
    const finish = (result: { blob: Blob; width: number; height: number; duration: number } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 8000);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return finish(null);
      const scale = Math.min(1, 1080 / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(blob ? { blob, width: w, height: h, duration: video.duration || 0 } : null), "image/jpeg", 0.8);
    };
    video.onerror = () => finish(null);
  });
}
