import type { SupabaseClient } from "@supabase/supabase-js";
import type { TravelDna } from "@/services/travelDna/travelDnaService";
import { CULINARY_STYLES } from "@/locales/he/preferences";

/**
 * אחוז התאמה אישי לכל כרטיס ב-TripMatch.
 *
 * משלב חמישה אותות. אות בלי נתונים לא נספר (המשקל שלו מתחלק בין השאר),
 * כך שמשתמש חדש לא "נענש" על חוסר מידע:
 *  1. טעם (40%)      - התגיות/תחומים שהמשתמש בחר בהעדפות + סגנון קולינרי
 *  2. התנהגות (25%)  - מה הוא באמת אהב/דחה בהחלקות קודמות, לפי קטגוריה ותת-קטגוריה
 *  3. איכות (20%)    - דירוג Google ודירוג triplace
 *  4. קרבה (10%)     - מרחק ממנו
 *  5. צרכים (5%)     - נגישות, כשהמשתמש סימן שהוא צריך
 */

export interface MatchProfile {
  /** תגיות וקבוצות שנבחרו בטקסונומיה (עברית, כמו taxonomy_tags של המקומות) */
  tasteTags: string[];
  /** קטגוריות TripAdd שהמשתמש סימן בהן עניין (food/attraction/nature/...) */
  tasteCategories: string[];
  /** תוויות עבריות של סגנונות קולינריים ("איטלקי", "אסייתי"...) */
  cuisineLabels: string[];
  /** לייקים/דחיות מהחלקות קודמות לפי קטגוריה */
  categoryVotes: Record<string, { likes: number; rejects: number }>;
  /** תת-קטגוריות שהמשתמש אהב בעבר */
  likedSubcategories: string[];
  preferredCategories: string[];
  dislikedCategories: string[];
  needsAccessibility: boolean;
}

export interface MatchInput {
  category: string;
  subcategory: string | null;
  taxonomyTags: string[];
  googleRating: number | null | undefined;
  rating: number | null | undefined;
  distanceKm: number;
  accessible: boolean | null;
}

export interface MatchResult {
  percent: number;
  reasons: string[];
  /** false = אין עדיין מספיק מידע אישי, האחוז מבוסס רק על איכות וקרבה */
  personalized: boolean;
}

/** ממפה קטגוריות/תחומי עניין מהמאגר הישן לקטגוריות TripAdd */
export function toTripAddCategory(value: string | null | undefined): string | null {
  const c = (value ?? "").toLowerCase();
  if (!c) return null;
  if (["food", "attraction", "nature", "nightlife", "sleep", "shopping"].includes(c)) return c;
  if (/restaurant|culinar|cafe|coffee|dining|food|bakery|winer|brunch/.test(c)) return "food";
  if (/night|bar|club|pub/.test(c)) return "nightlife";
  if (/hotel|lodging|sleep|resort|hostel|accommodation/.test(c)) return "sleep";
  if (/shop|market|mall/.test(c)) return "shopping";
  if (/nature|spring|beach|pool|desert|canyon|trail|park|garden|forest|view|water|lake|river|mountain|cave/.test(c)) return "nature";
  if (/attraction|museum|amusement|culture|histor|art|heritage|activit|theme|zoo/.test(c)) return "attraction";
  return null;
}

const norm = (s: string) => s.replace(/[־\-–]/g, " ").replace(/\s+/g, " ").trim();

function tagsOverlap(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.includes(short);
}

export function computeMatch(input: MatchInput, profile: MatchProfile | null): MatchResult {
  const parts: { weight: number; value: number }[] = [];
  const reasons: { text: string; strength: number }[] = [];
  let personalized = false;

  // ---------------- 1. טעם ----------------
  if (profile && (profile.tasteTags.length || profile.tasteCategories.length || profile.cuisineLabels.length)) {
    const placeTags = [...input.taxonomyTags, ...(input.subcategory ? [input.subcategory] : [])];
    const matched = profile.tasteTags.filter((t) => placeTags.some((p) => tagsOverlap(t, p)));
    const cuisine = input.category === "food" ? profile.cuisineLabels.find((l) => placeTags.some((p) => tagsOverlap(l, p))) : undefined;
    const catChosen = profile.tasteCategories.includes(input.category);
    let value = 0.25;
    if (matched.length >= 2) value = 1;
    else if (matched.length === 1 || cuisine) value = 0.85;
    else if (catChosen) value = 0.6;
    parts.push({ weight: 40, value });
    personalized = true;
    if (matched.length) reasons.push({ text: `תואם לטעם שלך: ${matched[0]}`, strength: 1 });
    else if (cuisine) reasons.push({ text: `אוהבים ${cuisine}`, strength: 0.9 });
    else if (catChosen) reasons.push({ text: "בתחומי העניין שלך", strength: 0.5 });
  }

  // ---------------- 2. התנהגות ----------------
  if (profile) {
    const votes = profile.categoryVotes[input.category];
    const total = votes ? votes.likes + votes.rejects : 0;
    const likedSub = input.subcategory ? profile.likedSubcategories.some((s) => tagsOverlap(s, input.subcategory!)) : false;
    const preferred = profile.preferredCategories.includes(input.category);
    const disliked = profile.dislikedCategories.includes(input.category);
    if (total >= 3 || likedSub || preferred || disliked) {
      // החלקה מוחלקת (prior של 50%) - לא מסיקים מסקנות חדות ממעט החלקות
      let value = total ? (votes!.likes + 1) / (total + 2) : 0.5;
      if (likedSub) value = Math.min(1, value + 0.2);
      if (preferred) value = Math.max(value, 0.75);
      if (disliked) value = Math.min(value, 0.3);
      parts.push({ weight: 25, value });
      personalized = true;
      if (likedSub) reasons.push({ text: "דומה למקומות שאהבת", strength: 0.95 });
      else if (value >= 0.7) reasons.push({ text: "מהסוג שאתה נוטה לאהוב", strength: 0.7 });
    }
  }

  // ---------------- 3. איכות ----------------
  const ratings = [input.googleRating, input.rating].filter((r): r is number => typeof r === "number" && r > 0);
  if (ratings.length) {
    const r = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    const value = r >= 4.7 ? 1 : r >= 4.5 ? 0.85 : r >= 4.2 ? 0.7 : r >= 4 ? 0.55 : r >= 3.5 ? 0.35 : 0.2;
    parts.push({ weight: 20, value });
    if (value >= 0.85) reasons.push({ text: `דירוג גבוה ${r.toFixed(1)}★`, strength: 0.6 });
  }

  // ---------------- 4. קרבה ----------------
  if (input.distanceKm > 0) {
    const d = input.distanceKm;
    const value = d <= 1 ? 1 : d <= 3 ? 0.85 : d <= 7 ? 0.7 : d <= 15 ? 0.5 : d <= 40 ? 0.35 : 0.2;
    parts.push({ weight: 10, value });
    if (value >= 0.85) reasons.push({ text: "קרוב אליך", strength: 0.4 });
  }

  // ---------------- 5. צרכים ----------------
  if (profile?.needsAccessibility) {
    const value = input.accessible === true ? 1 : input.accessible === false ? 0 : 0.5;
    parts.push({ weight: 5, value });
    if (input.accessible === true) reasons.push({ text: "נגיש", strength: 0.8 });
  }

  const weight = parts.reduce((s, p) => s + p.weight, 0);
  const raw = weight ? parts.reduce((s, p) => s + p.weight * p.value, 0) / weight : 0.5;
  let percent = Math.round(35 + 63 * raw);
  // מקום לא נגיש למי שצריך נגישות - לא יכול להיות "התאמה מעולה"
  if (profile?.needsAccessibility && input.accessible === false) percent = Math.min(percent, 60);
  // בלי מידע אישי לא מציגים "התאמה מושלמת" - רק איכות וקרבה
  if (!personalized) percent = Math.min(percent, 88);

  return {
    percent: Math.max(1, Math.min(99, percent)),
    reasons: reasons.sort((a, b) => b.strength - a.strength).map((r) => r.text).slice(0, 2),
    personalized,
  };
}

/** טוען את כל מה שצריך על המשתמש - פעם אחת לכל חפיסה, לא לכל כרטיס. */
export async function loadMatchProfile(supabase: SupabaseClient, userId: string, dna: TravelDna | null): Promise<MatchProfile> {
  const [{ data: prefs }, { data: sessions }, { data: favs }] = await Promise.all([
    supabase.from("user_preferences").select("interests,culinary_styles,accessibility,taxonomy_selections").eq("id", userId).maybeSingle(),
    supabase.from("tripmatch_sessions").select("liked_place_ids,rejected_place_ids").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    supabase.from("favorites").select("place_id").eq("user_id", userId).eq("place_type", "tripadd").in("status", ["liked", "saved"]).limit(300),
  ]);

  // --- טעם: מהטקסונומיה + תחומי עניין + DNA ---
  const tasteTags = new Set<string>(dna?.taxonomy_tags ?? []);
  const tasteCategories = new Set<string>(dna?.taxonomy_categories ?? []);
  const selections = (prefs?.taxonomy_selections ?? null) as Record<string, { tags?: string[]; groups?: string[] }> | null;
  for (const [cat, sel] of Object.entries(selections ?? {})) {
    if ((sel?.tags?.length ?? 0) + (sel?.groups?.length ?? 0) > 0) tasteCategories.add(cat);
    for (const t of [...(sel?.tags ?? []), ...(sel?.groups ?? [])]) tasteTags.add(t);
  }
  for (const interest of [...((prefs?.interests as string[] | null) ?? []), ...(dna?.interests ?? [])]) {
    const c = toTripAddCategory(interest);
    if (c) tasteCategories.add(c);
  }
  const culinary = new Set<string>([...((prefs?.culinary_styles as string[] | null) ?? []), ...(dna?.culinary_styles ?? [])]);
  const cuisineLabels = CULINARY_STYLES.filter((s) => culinary.has(s.value)).map((s) => s.label);
  if (cuisineLabels.length) tasteCategories.add("food");

  // --- התנהגות: החלקות קודמות ב-TripMatch + לייקים שמורים ---
  const liked = new Set<string>();
  const rejected = new Set<string>();
  for (const s of (sessions ?? []) as { liked_place_ids: string[] | null; rejected_place_ids: string[] | null }[]) {
    for (const id of s.liked_place_ids ?? []) liked.add(id);
    for (const id of s.rejected_place_ids ?? []) rejected.add(id);
  }
  for (const f of (favs ?? []) as { place_id: string }[]) liked.add(f.place_id);
  const ids = [...new Set([...liked, ...rejected])].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 400);
  const categoryVotes: MatchProfile["categoryVotes"] = {};
  const likedSubcategories = new Set<string>();
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data } = await supabase.from("tripadd_submissions").select("id,category,subcategory").in("id", chunk);
    for (const row of (data ?? []) as { id: string; category: string; subcategory: string | null }[]) {
      const v = (categoryVotes[row.category] ??= { likes: 0, rejects: 0 });
      if (liked.has(row.id)) {
        v.likes += 1;
        if (row.subcategory) likedSubcategories.add(row.subcategory);
      } else if (rejected.has(row.id)) v.rejects += 1;
    }
  }

  return {
    tasteTags: [...tasteTags],
    tasteCategories: [...tasteCategories],
    cuisineLabels,
    categoryVotes,
    likedSubcategories: [...likedSubcategories],
    preferredCategories: (dna?.preferred_categories ?? []).map(toTripAddCategory).filter((c): c is string => !!c),
    dislikedCategories: (dna?.disliked_categories ?? []).map(toTripAddCategory).filter((c): c is string => !!c),
    needsAccessibility: Boolean(prefs?.accessibility ?? dna?.accessibility),
  };
}
