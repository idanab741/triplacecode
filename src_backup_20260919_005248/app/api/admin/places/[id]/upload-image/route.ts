import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * העלאת קובץ תמונה ישירות (לא רק URL - ר' דרישה מפורשת). מעלה ל-bucket
 * הקיים "place-images" (אותו bucket ש-photoStorageService.ts כבר
 * משתמש בו לתמונות מ-Google) - לא bucket/מערכת אחסון חדשה. מחזירה
 * public URL בלבד; הוספת ה-URL ל-image_urls של המקום נעשית בצד
 * הלקוח (כמו הוספת URL ידני קיים) ונשמרת עם "שמירה" הרגילה.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "סוג קובץ לא נתמך - רק JPG/PNG/WEBP/GIF" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "הקובץ גדול מדי (מקסימום 8MB)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const extension = file.name.split(".").pop() ?? "jpg";
  const storagePath = `manual-uploads/${id}/${Date.now()}.${extension}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from("place-images").upload(storagePath, buffer, {
    contentType: file.type,
    upsert: true,
  });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = supabase.storage.from("place-images").getPublicUrl(storagePath);
  return NextResponse.json({ url: data.publicUrl });
}
