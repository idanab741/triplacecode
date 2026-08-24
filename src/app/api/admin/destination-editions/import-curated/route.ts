import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import {
  WORLDWIDE_VACATION_CATEGORIES,
  WORLDWIDE_DESTINATION_REGISTRY,
} from "@/constants/worldwideVacationCategories";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/** ISO-3166 alpha-2 מתוך אמוג'י דגל (שני "regional indicator symbols" -
 *  U+1F1E6 = 'A', וכן הלאה - כל דגל בנוי מ-2 מהם ברצף). */
function flagToCountryCode(flag: string): string {
  return Array.from(flag)
    .map((c) => String.fromCharCode((c.codePointAt(0) ?? 0) - 0x1f1e6 + 65))
    .join("");
}

/** שמות מדינות בעברית לכל 48 הדגלים שמופיעים בפועל ב-
 *  WORLDWIDE_DESTINATION_REGISTRY (ר' src/constants/worldwideVacationCategories.ts). */
const COUNTRY_NAMES_HE: Record<string, string> = {
  AE: "איחוד האמירויות", AL: "אלבניה", AR: "ארגנטינה", AT: "אוסטריה",
  BE: "בלגיה", BG: "בולגריה", BO: "בוליביה", BR: "ברזיל", CH: "שווייץ",
  CL: "צ'ילה", CO: "קולומביה", CR: "קוסטה ריקה", CU: "קובה", CY: "קפריסין",
  CZ: "צ'כיה", DE: "גרמניה", ES: "ספרד", FI: "פינלנד", FJ: "פיג'י",
  FR: "צרפת", GB: "בריטניה", GE: "גאורגיה", GR: "יוון", HU: "הונגריה",
  ID: "אינדונזיה", IN: "הודו", IT: "איטליה", JP: "יפן", LA: "לאוס",
  LK: "סרי לנקה", MC: "מונקו", ME: "מונטנגרו", MO: "מקאו", MU: "מאוריציוס",
  MV: "האיים המלדיביים", MX: "מקסיקו", NL: "הולנד", NP: "נפאל", PE: "פרו",
  PH: "הפיליפינים", PT: "פורטוגל", RO: "רומניה", RS: "סרביה", SC: "סיישל",
  TH: "תאילנד", TZ: "טנזניה", US: "ארצות הברית", VN: "וייטנאם",
};

function countryForFlag(flag: string): string {
  return COUNTRY_NAMES_HE[flagToCountryCode(flag)] ?? "לא ידוע";
}

interface CuratedMatch {
  slug: string;
  name: string;
  flag: string;
  imageUrl: string;
  subtitle: string | null;
}

/** מוצא את היעד ב-registry לפי שם (name) + תווית-קבוצה (groupLabel,
 *  בפורמט "אימוג'י כותרת" - זהה ל-ABROAD_GROUP_PILLS.key ב-page.tsx),
 *  כולל subtitle/imageUrl ספציפיים-לקטגוריה אם מוגדרים על הרשומה עצמה. */
function findCuratedDestination(name: string, groupLabel: string): CuratedMatch | null {
  const category = WORLDWIDE_VACATION_CATEGORIES.find(
    (c) => `${c.emoji} ${c.title}` === groupLabel
  );
  if (!category) return null;

  for (const ref of category.destinations) {
    const entry = WORLDWIDE_DESTINATION_REGISTRY[ref.slug];
    if (!entry || entry.name !== name) continue;
    return {
      slug: ref.slug,
      name: entry.name,
      flag: entry.flag,
      imageUrl: ref.imageUrl ?? entry.imageUrl,
      subtitle: ref.subtitle ?? null,
    };
  }
  return null;
}

/**
 * מייבאת יעד/ים "אצורים" (מוגדרים סטטית ב-worldwideVacationCategories.ts)
 * ל-DB בפועל: יוצרת (אם עוד לא קיימת) שורת destinations בסיסית ואת
 * שורת destination_editions שמצביעה עליה, עם quick_category='abroad'.
 *
 * body: { source: "abroad", destinationNames: string[] }
 * כל איבר ב-destinationNames הוא "שם::תווית-קבוצה" (StaticDestination.key
 * מ-page.tsx, למשל "מיקונוס::🏖️ בטן גב וחופים") - בדיוק המפתח שהגריד
 * שולח בלחיצה על כרטיס יעד.
 *
 * לא נכשלת כולה אם שם אחד לא נמצא/נכשל - מחזירה results[]+errors[]
 * כדי שהקריאה ל-.push לעמוד היעד (page.tsx) תמשיך לעבוד ליעד שכן הצליח.
 */
export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const source: string | undefined = body?.source;
  const destinationNames: string[] | undefined = body?.destinationNames;

  if (source !== "abroad") {
    return NextResponse.json({ error: 'כרגע נתמך רק source: "abroad"' }, { status: 400 });
  }
  if (!Array.isArray(destinationNames) || destinationNames.length === 0) {
    return NextResponse.json({ error: "יש לספק destinationNames (מערך לא ריק)" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const results: { id: string; title: string }[] = [];
  const errors: string[] = [];

  for (const key of destinationNames) {
    const [name, groupLabel] = key.split("::");
    if (!name || !groupLabel) {
      errors.push(`מפתח לא תקין: "${key}" (צפוי "שם::קבוצה")`);
      continue;
    }

    const curated = findCuratedDestination(name, groupLabel);
    if (!curated) {
      errors.push(`"${name}" לא נמצא ב-WORLDWIDE_DESTINATION_REGISTRY עבור הקבוצה "${groupLabel}"`);
      continue;
    }

    // מניעת כפילויות: אם כבר קיימת מהדורה עם אותו title+group_label+subtitle
    // תחת quick_category='abroad' - לא יוצרים שוב, מחזירים את הקיימת.
    let existingQuery = supabase
      .from("destination_editions")
      .select("id, title")
      .eq("quick_category", "abroad")
      .eq("title", curated.name)
      .eq("group_label", groupLabel);
    existingQuery = curated.subtitle
      ? existingQuery.eq("subtitle", curated.subtitle)
      : existingQuery.is("subtitle", null);
    const { data: existingEdition } = await existingQuery.maybeSingle();

    if (existingEdition) {
      results.push({ id: existingEdition.id, title: existingEdition.title });
      continue;
    }

    // מוצאים/יוצרים את שורת ה-destinations הבסיסית (עיר) לפי שם - כדי
    // שאותה עיר (למשל "פריז") לא תיווצר כפול כשהיא מיובאת מכמה קבוצות.
    let destinationId: string;
    const { data: existingDestination } = await supabase
      .from("destinations")
      .select("id")
      .eq("name", curated.name)
      .maybeSingle();

    if (existingDestination) {
      destinationId = existingDestination.id;
    } else {
      const { data: newDestination, error: destError } = await supabase
        .from("destinations")
        .insert({
          name: curated.name,
          country: countryForFlag(curated.flag),
          image_url: curated.imageUrl,
          status: "draft",
        })
        .select("id")
        .single();
      if (destError || !newDestination) {
        errors.push(`יצירת יעד בסיס "${curated.name}" נכשלה: ${destError?.message ?? "שגיאה לא ידועה"}`);
        continue;
      }
      destinationId = newDestination.id;
    }

    const { data: newEdition, error: editionError } = await supabase
      .from("destination_editions")
      .insert({
        destination_id: destinationId,
        quick_category: "abroad",
        title: curated.name,
        subtitle: curated.subtitle,
        image_url: curated.imageUrl,
        group_label: groupLabel,
      })
      .select("id, title")
      .single();

    if (editionError || !newEdition) {
      errors.push(`יצירת מהדורה ל-"${curated.name}" (${groupLabel}) נכשלה: ${editionError?.message ?? "שגיאה לא ידועה"}`);
      continue;
    }

    results.push({ id: newEdition.id, title: newEdition.title });
  }

  return NextResponse.json({ results, errors });
}
