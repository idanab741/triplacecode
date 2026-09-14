import { NextResponse } from "next/server";
import { callClaude } from "@/services/ai/claudeService";
import type { PlaceSubmissionCategory } from "@/services/social/placeSubmissionService";

const CATEGORY_LABELS_HE: Record<PlaceSubmissionCategory, string> = {
  restaurant: "מסעדות וקולינריה",
  attraction: "אטרקציות וחוויות",
  nature: "טבע ונופים",
  shopping: "קניות ושופינג",
  hotel: "לינה",
  nightlife: "חיי לילה ובילויים",
};

/**
 * *** תיקון (בקשה מפורשת - "ברגע שלוחצים על הסוג, אין השלמה אוטומטית
 * של הקטגוריה המשנית"): רמז מיידי בטופס עצמו, לא שדה לבחירה (עדיין
 * תואם לפרומפט המקורי - "אין שדה סוג משנה בטופס, המשתמש לא בוחר").
 * אותה לוגיקת AI בדיוק כמו placeSubmissionEnrichmentService.ts (לא
 * מנוע חדש) - כאן רק כתצוגה מקדימה לפני השמירה; הערך הסופי שנשמר
 * בפועל עדיין נקבע מחדש (ועלול להיות מדויק יותר, עם מידע מ-Google)
 * ע"י תהליך ההשלמה האמיתי אחרי "שמור מקום".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  const category = searchParams.get("category") as PlaceSubmissionCategory | null;
  if (!name || !category || !CATEGORY_LABELS_HE[category]) {
    return NextResponse.json({ error: "חסר שם או קטגוריה" }, { status: 422 });
  }

  const prompt = `מקום בשם "${name}", קטגוריה ראשית: ${CATEGORY_LABELS_HE[category]}.
מה תת-הקטגוריה הכי מדויקת שלו? (לדוגמה: בית קפה / מסעדה איטלקית / בר קוקטיילים / חוף ים / קניון / מלון בוטיק וכו')
השב אך ורק במילה או צירוף קצר בעברית, בלי שום טקסט נוסף, בלי מרכאות.`;

  const { text, error } = await callClaude(prompt, 64);
  if (error || !text) {
    return NextResponse.json({ subcategory: null });
  }

  return NextResponse.json({ subcategory: text.trim().replace(/^["']|["']$/g, "").slice(0, 60) });
}
