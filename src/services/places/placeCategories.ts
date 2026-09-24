import { createAdminClient } from "@/services/supabase/admin";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { TRIP_TYPE_GROUPS, CUISINE_TAGS } from "@/services/places/tripTaxonomy";
import { getCategoryLabel, hasHebrewLabel } from "@/utils/categoryLabels";

/** כמה קטגוריות חובה לכל אטרקציה (בקשה מפורשת - "חובה 3 קטגוריות לכל אטרקציה"). */
export const REQUIRED_CATEGORIES = 3;

/** תגיות שיש להן סקציה משלהן בעמוד (נגישות) - לא מוצגות כקטגוריה. */
const NOT_A_CATEGORY = new Set(["accessible", "accessible_parking", "kosher"]);

export interface CategorySource {
  category: string | null;
  trip_type_tags: string[] | null;
  cuisine_tags: string[] | null;
  tags: string[] | null;
}

/**
 * הקטגוריות להצגה בעמוד האטרקציה, בעברית בלבד, מהספציפית לכללית:
 * תתי-תגיות (tags) -> סוג מטבח -> סוג טיול -> הקטגוריה הראשית. בלי כפילויות (גם לא בתווית),
 * ובלי מזהים שאין להם תרגום עברי (כדי שלעולם לא יוצג מזהה גולמי באנגלית).
 */
export function placeCategoryLabels(p: CategorySource, limit = REQUIRED_CATEGORIES): string[] {
  const ids = [...(p.tags ?? []), ...(p.cuisine_tags ?? []), ...(p.trip_type_tags ?? []), p.category].filter(
    (v): v is string => !!v && !NOT_A_CATEGORY.has(v)
  );
  const labels: string[] = [];
  for (const id of new Set(ids)) {
    if (!hasHebrewLabel(id)) continue;
    const label = getCategoryLabel(id);
    if (!labels.includes(label)) labels.push(label);
    if (labels.length >= limit) break;
  }
  return labels;
}

/**
 * *** AI (בקשה מפורשת - "קטגוריות דרך ה-AI שלנו, חובה 3 לכל אטרקציה"): אם למקום יש פחות מ-3
 * קטגוריות להצגה, Claude בוחר את החסרות - אך ורק מתוך הטקסונומיה הקיימת (אותה רשימה כמו
 * "✨ תקן עם AI" באדמין), והן נוספות ל-tags / cuisine_tags בלי למחוק שום דבר קיים.
 * לא זורק - כשל נרשם ללוג, והמקום נשאר כמו שהיה. מחזיר את מספר הקטגוריות אחרי העדכון.
 */
export async function ensurePlaceCategories(placeId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data: place } = await supabase
    .from("places")
    .select("name, category, subcategory, city, address, trip_type_tags, cuisine_tags, tags")
    .eq("id", placeId)
    .maybeSingle();
  if (!place) return 0;

  const current = placeCategoryLabels(place, 99);
  if (current.length >= REQUIRED_CATEGORIES) return current.length;

  const subTags = TRIP_TYPE_GROUPS.flatMap((g) => g.subTags.map((t) => `${t.id} (${t.label})`)).join(", ");
  const tripTypes = TRIP_TYPE_GROUPS.map((g) => `${g.id} (${g.label})`).join(", ");
  const cuisines = CUISINE_TAGS.map((t) => `${t.id} (${t.label})`).join(", ");

  const prompt = `מקום: "${place.name}"
סוג לפי Google: ${place.subcategory ?? "לא ידוע"}
קטגוריה ראשית: ${place.category ?? "לא ידוע"}
מיקום: ${[place.address, place.city].filter(Boolean).join(", ") || "לא ידוע"}
קטגוריות קיימות: ${current.join(", ") || "אין"}

צריך בדיוק ${REQUIRED_CATEGORIES} קטגוריות מדויקות שמתארות את המקום הזה למטייל. בחר רק מזהים מהרשימות הבאות (לא להמציא):
sub_tags: ${subTags}
trip_type_tags: ${tripTypes}
cuisine_tags (רק למקומות אוכל/שתייה): ${cuisines}

כללים: העדף sub_tags ספציפיים על פני כלליים. אל תבחר משהו שאינו נכון בוודאות למקום הזה.
השב אך ורק ב-JSON, בלי טקסט נוסף:
{"sub_tags": ["..."], "trip_type_tags": ["..."], "cuisine_tags": ["..."]}`;

  const { text, error } = await callClaude(prompt, 400);
  if (error || !text) return current.length;

  try {
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as {
      sub_tags?: string[];
      trip_type_tags?: string[];
      cuisine_tags?: string[];
    };
    const validSub = new Set(TRIP_TYPE_GROUPS.flatMap((g) => g.subTags.map((t) => t.id)));
    const validTrip = new Set(TRIP_TYPE_GROUPS.map((g) => g.id));
    const validCuisine = new Set(CUISINE_TAGS.map((t) => t.id));
    const pick = (list: string[] | undefined, valid: Set<string>) => (Array.isArray(list) ? list.filter((id) => valid.has(id)) : []);

    const tags = [...new Set([...(place.tags ?? []), ...pick(json.sub_tags, validSub)])];
    const tripTypeTags = [...new Set([...(place.trip_type_tags ?? []), ...pick(json.trip_type_tags, validTrip)])];
    const cuisineTags = [...new Set([...(place.cuisine_tags ?? []), ...pick(json.cuisine_tags, validCuisine)])];

    await supabase.from("places").update({ tags, trip_type_tags: tripTypeTags, cuisine_tags: cuisineTags }).eq("id", placeId);
    return placeCategoryLabels({ category: place.category, tags, trip_type_tags: tripTypeTags, cuisine_tags: cuisineTags }, 99).length;
  } catch (err) {
    logAiError("ensurePlaceCategories: כשל בפענוח", {
      placeId,
      message: err instanceof Error ? err.message : String(err),
      rawText: text.slice(0, 300),
    });
    return current.length;
  }
}
