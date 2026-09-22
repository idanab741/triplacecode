import { NextResponse } from "next/server";
import { findPlacePhotoReference } from "@/services/tripBuilder/placePhotoService";

/**
 * מחפש תמונה אמיתית מ-Google Places עבור טקסט חופשי (למשל "שדה התעופה
 * בברצלונה" או שם מלון) - משמש לתחנות "לוגיסטיות" (נחיתה/מלון) בתצוגת
 * המסלול, שאין להן place אמיתי במאגר.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ imageUrl: null });

  try {
    const photoRef = await findPlacePhotoReference(query);
    const imageUrl = photoRef ? `/api/places/photo?ref=${encodeURIComponent(photoRef)}` : null;
    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}