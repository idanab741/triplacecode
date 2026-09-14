import { NextResponse } from "next/server";
import { callClaude } from "@/services/ai/claudeService";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";

/** רמז מיידי בטופס עצמו בלבד (לא שדה לבחירה) - הערך הסופי שנשמר
 *  בפועל נקבע מחדש ע"י tripAddEnrichmentService.ts אחרי השמירה. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name")?.trim();
  const category = searchParams.get("category") as TripAddCategory | null;
  if (!name || !category || !HOME_QUICK_CATEGORY_LABELS[category]) {
    return NextResponse.json({ error: "חסר שם או קטגוריה" }, { status: 422 });
  }

  const categoryLabel = HOME_QUICK_CATEGORY_LABELS[category];
  const prompt = `מקום בשם "${name}", קטגוריה ראשית: ${categoryLabel}.
מה תת-הקטגוריה הכי מדויקת שלו? (לדוגמה: בית קפה / מסעדה איטלקית / בר קוקטיילים / חוף ים / קניון / מלון בוטיק וכו')
השב אך ורק במילה או צירוף קצר בעברית, בלי שום טקסט נוסף, בלי מרכאות.`;

  const { text, error } = await callClaude(prompt, 64);
  if (error || !text) {
    return NextResponse.json({ subcategory: null });
  }

  return NextResponse.json({ subcategory: text.trim().replace(/^["']|["']$/g, "").slice(0, 60) });
}
