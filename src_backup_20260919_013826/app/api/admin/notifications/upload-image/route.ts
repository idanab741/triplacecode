import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

/** אותו דפוס אימות בדיוק כמו שאר ה-admin API הקיים. */
function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * *** תוספת (בקשה מפורשת - "אפשרות להעלות תמונה מהמחשב שתופיע שם
 * ברקע" - במקום/בנוסף לשדה URL): מעלה קובץ שנבחר במחשב האדמין ל-
 * bucket ייעודי (notification-images, ר' migration 0060) ומחזיר URL
 * ציבורי - אותו URL בדיוק שדה imageUrl בטופס ה-Admin כבר יודע להשתמש
 * בו (POST/PATCH הקיימים ב-/api/admin/notifications). מעלה תמיד עם
 * service_role (createAdminClient) - לא ישירות מהלקוח, כי לאדמין אין
 * session אמיתי של Supabase Auth (ההרשאה שלו היא x-admin-secret).
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך - רק JPEG/PNG/WEBP/GIF" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 5MB)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `admin-uploads/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("notification-images").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabase.storage.from("notification-images").getPublicUrl(path);
  return NextResponse.json({ imageUrl: data.publicUrl });
}
