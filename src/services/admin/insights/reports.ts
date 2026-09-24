import { type Db, safeFetchAll, DAY, dayKey, ts } from "./core";
import { loadActivity, displayName } from "./activity";
import { choiceLabel, QUESTION_LABELS, SKIP_QUESTIONS, PREFERENCE_FIELDS } from "./choiceLabels";
import { TRIP_TYPE_LABELS, PROVIDER_LABELS, TRIP_STATUS_LABELS, label } from "./labels";
import { isValidPlaceCategory, getPlaceCategoryLabel } from "@/constants/placeCategories";

export type ReportRange = "all" | "7d" | "30d" | "90d" | "365d";
export const REPORT_RANGES: ReportRange[] = ["all", "7d", "30d", "90d", "365d"];

export type ColumnType = "text" | "number" | "percent" | "date";
export interface ReportColumn {
  key: string;
  label: string;
  type: ColumnType;
}
export type Cell = string | number | null;
export interface Report {
  id: string;
  group: "places" | "destinations" | "choices" | "users" | "activity";
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Record<string, Cell>[];
  /** העמודה שמוצגת כפס (bar) בתצוגה המקדימה */
  barKey?: string;
  /** האם הטווח שנבחר משפיע על הדוח (דוחות "מצב נוכחי" לא מושפעים) */
  usesRange: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);
const col = (key: string, lbl: string, type: ColumnType = "text"): ReportColumn => ({ key, label: lbl, type });

/** ממפה קטגוריה (כולל ערכים ישנים לא תקניים) לאחת מהקבוצות הראשיות */
export function categoryGroup(category: string | null): string {
  const c = (category ?? "").toLowerCase();
  if (isValidPlaceCategory(c)) return c;
  if (/restaurant|culinar|cafe|coffee|dining|food|bakery|winer/.test(c)) return "restaurants";
  if (/night|bar|club|pub/.test(c)) return "nightlife";
  if (/hotel|lodging|sleep|resort|hostel/.test(c)) return "hotels";
  if (/shop|market|mall/.test(c)) return "shopping";
  if (/attraction|museum|amusement|culture|histor|art|heritage|activit|theme|zoo/.test(c)) return "attractions";
  if (/nature|spring|beach|desert|canyon|trail|forest|view|water|lake|river|mountain|cave/.test(c)) return "nature";
  return "other";
}

/** שם יעד אחיד: "פריז, צרפת" → "פריז" */
const normDestination = (v: string | null | undefined) => (v ?? "").split(",")[0].trim();

async function fetchByIds<T>(db: Db, table: string, columns: string, ids: string[]): Promise<T[]> {
  const unique = [...new Set(ids)];
  const out: T[] = [];
  for (let i = 0; i < unique.length; i += 150) {
    const { data } = await db.from(table).select(columns).in("id", unique.slice(i, i + 150));
    out.push(...((data ?? []) as unknown as T[]));
  }
  return out;
}

interface PlaceLite {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
}

export async function buildReports(db: Db, range: ReportRange) {
  const errors: string[] = [];
  const since = range === "all" ? 0 : Date.now() - Number(range.replace("d", "")) * DAY;
  const inRange = (iso: string | null | undefined) => {
    const t = ts(iso);
    return t !== null && t >= since;
  };

  const activity = await loadActivity(db, 3650);
  const { users, profiles, tripMatch, trippy, events } = activity;
  errors.push(...activity.errors);

  const [favorites, sessions, prefs, dna, reviews] = await Promise.all([
    safeFetchAll<{ user_id: string; place_id: string; place_type: string; status: string; created_at: string }>("favorites", errors, (f, t) =>
      db.from("favorites").select("user_id,place_id,place_type,status,created_at").order("id").range(f, t)
    ),
    safeFetchAll<{ id: string; user_id: string; trip_type: string; status: string; answers: Record<string, unknown> | null; created_at: string }>("sessions", errors, (f, t) =>
      db.from("trip_builder_sessions").select("id,user_id,trip_type,status,answers,created_at").order("id").range(f, t)
    ),
    safeFetchAll<Record<string, unknown> & { id: string; onboarding_completed_at: string | null; taxonomy_selections: Record<string, { tags?: string[]; groups?: string[] }> | null }>(
      "user_preferences",
      errors,
      (f, t) => db.from("user_preferences").select("*").order("id").range(f, t)
    ),
    safeFetchAll<{ user_id: string; preferred_categories: string[] | null; disliked_categories: string[] | null }>("travel_dna", errors, (f, t) =>
      db.from("travel_dna").select("user_id,preferred_categories,disliked_categories").order("id").range(f, t)
    ),
    safeFetchAll<{ place_id: string; rating: number; created_at: string }>("place_reviews", errors, (f, t) =>
      db.from("place_reviews").select("place_id,rating,created_at").order("id").range(f, t)
    ),
  ]);

  const favs = favorites.filter((f) => inRange(f.created_at));
  const tm = tripMatch.filter((r) => inRange(r.created_at));
  const sess = sessions.filter((s) => inRange(s.created_at));
  const trippyIn = trippy.filter((r) => inRange(r.created_at));
  const revs = reviews.filter((r) => inRange(r.created_at));

  // ------------------------------------------------------------------ מקומות
  interface PlaceStat {
    likes: number;
    saves: number;
    tmLikes: number;
    tmRejects: number;
    reviews: number;
    ratingSum: number;
  }
  const stats = new Map<string, PlaceStat>();
  const stat = (id: string) => {
    let s = stats.get(id);
    if (!s) {
      s = { likes: 0, saves: 0, tmLikes: 0, tmRejects: 0, reviews: 0, ratingSum: 0 };
      stats.set(id, s);
    }
    return s;
  };
  for (const f of favs) {
    if (f.place_type !== "place") continue;
    if (f.status === "liked") stat(f.place_id).likes += 1;
    if (f.status === "saved") stat(f.place_id).saves += 1;
  }
  for (const r of tm) {
    for (const id of r.liked_place_ids ?? []) if (UUID_RE.test(id)) stat(id).tmLikes += 1;
    for (const id of r.rejected_place_ids ?? []) if (UUID_RE.test(id)) stat(id).tmRejects += 1;
  }
  for (const r of revs) {
    const s = stat(r.place_id);
    s.reviews += 1;
    s.ratingSum += r.rating;
  }
  const loveScore = (s: PlaceStat) => s.likes + s.saves + s.tmLikes + s.reviews;
  const candidateIds = [...stats.entries()].filter(([, s]) => loveScore(s) > 0).map(([id]) => id);
  const places = await fetchByIds<PlaceLite>(db, "places", "id,name,city,country,category", candidateIds);
  const placeById = new Map(places.map((p) => [p.id, p]));

  const placeColumns = [
    col("rank", "#", "number"),
    col("name", "מקום"),
    col("city", "עיר"),
    col("country", "מדינה"),
    col("category", "קטגוריה"),
    col("love", "סה״כ אהבה", "number"),
    col("likes", "לייקים", "number"),
    col("saves", "שמירות", "number"),
    col("tmLikes", "לייקים ב-TripMatch", "number"),
    col("tmRejects", "דחיות ב-TripMatch", "number"),
    col("tmLikeRate", "שיעור לייק ב-TripMatch", "percent"),
    col("reviews", "ביקורות", "number"),
    col("avgRating", "דירוג ממוצע", "number"),
  ];
  const placeRows = (filter: (p: PlaceLite) => boolean, limit = 200) =>
    [...stats.entries()]
      .filter(([id, s]) => loveScore(s) > 0 && placeById.has(id) && filter(placeById.get(id)!))
      .sort((a, b) => loveScore(b[1]) - loveScore(a[1]) || b[1].tmLikes - a[1].tmLikes)
      .slice(0, limit)
      .map(([id, s], i) => {
        const p = placeById.get(id)!;
        return {
          rank: i + 1,
          name: p.name,
          city: p.city,
          country: p.country,
          category: getPlaceCategoryLabel(categoryGroup(p.category)),
          love: loveScore(s),
          likes: s.likes,
          saves: s.saves,
          tmLikes: s.tmLikes,
          tmRejects: s.tmRejects,
          tmLikeRate: s.tmLikes + s.tmRejects ? pct(s.tmLikes, s.tmLikes + s.tmRejects) : null,
          reviews: s.reviews,
          avgRating: s.reviews ? Math.round((s.ratingSum / s.reviews) * 10) / 10 : null,
        };
      });

  const reports: Report[] = [];
  const loveNote = "סה״כ אהבה = לייקים + שמירות + לייקים ב-TripMatch + ביקורות.";
  reports.push({
    id: "top_places",
    group: "places",
    title: "המקומות הכי אהובים",
    description: `כל המקומות לפי אהבת המשתמשים. ${loveNote}`,
    columns: placeColumns,
    rows: placeRows(() => true),
    barKey: "love",
    usesRange: true,
  });
  const byGroup: { id: string; group: string; title: string }[] = [
    { id: "top_attractions", group: "attractions", title: "האטרקציות הכי אהובות" },
    { id: "top_restaurants", group: "restaurants", title: "המסעדות ובתי הקפה הכי אהובים" },
    { id: "top_nature", group: "nature", title: "אתרי הטבע הכי אהובים" },
    { id: "top_nightlife", group: "nightlife", title: "חיי הלילה הכי אהובים" },
    { id: "top_hotels", group: "hotels", title: "המלונות הכי אהובים" },
  ];
  for (const g of byGroup) {
    reports.push({
      id: g.id,
      group: "places",
      title: g.title,
      description: `מסונן לקטגוריה ${getPlaceCategoryLabel(g.group)} (כולל ערכי קטגוריה ישנים שממופים אליה). ${loveNote}`,
      columns: placeColumns,
      rows: placeRows((p) => categoryGroup(p.category) === g.group, 100),
      barKey: "love",
      usesRange: true,
    });
  }

  // TripAdd הכי אהובים
  const tripaddStats = new Map<string, { likes: number; saves: number }>();
  for (const f of favs) {
    if (f.place_type !== "tripadd") continue;
    const s = tripaddStats.get(f.place_id) ?? { likes: 0, saves: 0 };
    if (f.status === "liked") s.likes += 1;
    if (f.status === "saved") s.saves += 1;
    tripaddStats.set(f.place_id, s);
  }
  const tripadds = await fetchByIds<{ id: string; name: string; city: string | null; address: string | null; category: string }>(
    db,
    "tripadd_submissions",
    "id,name,city,address,category",
    [...tripaddStats.keys()]
  );
  const tripaddById = new Map(tripadds.map((t) => [t.id, t]));
  reports.push({
    id: "top_tripadd",
    group: "places",
    title: "TripAdd הכי אהובים",
    description: "מקומות שמשתמשים הוסיפו למפה, לפי לייקים ושמירות.",
    columns: [col("rank", "#", "number"), col("name", "מקום"), col("address", "כתובת"), col("category", "קטגוריה"), col("likes", "לייקים", "number"), col("saves", "שמירות", "number")],
    rows: [...tripaddStats.entries()]
      .filter(([id]) => tripaddById.has(id))
      .sort((a, b) => b[1].likes + b[1].saves - (a[1].likes + a[1].saves))
      .map(([id, s], i) => {
        const t = tripaddById.get(id)!;
        return { rank: i + 1, name: t.name, address: t.address ?? t.city, category: choiceLabel(t.category), likes: s.likes, saves: s.saves };
      }),
    barKey: "likes",
    usesRange: true,
  });

  // ---------------------------------------------------------------- יעדים
  const shareRows = (values: (string | null | undefined)[], extra?: (value: string) => Record<string, Cell>) => {
    const counts = new Map<string, number>();
    for (const v of values) {
      const k = (v ?? "").trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count], i) => ({ rank: i + 1, value, count, share: pct(count, total), ...(extra ? extra(value) : {}) }));
  };

  const tmByCity = new Map<string, { users: Set<string>; likes: number; rejects: number }>();
  for (const r of tm) {
    const city = (r.city ?? "").trim();
    if (!city) continue;
    const e = tmByCity.get(city) ?? { users: new Set<string>(), likes: 0, rejects: 0 };
    e.users.add(r.user_id);
    e.likes += r.liked_place_ids?.length ?? 0;
    e.rejects += r.rejected_place_ids?.length ?? 0;
    tmByCity.set(city, e);
  }
  reports.push({
    id: "dest_tripmatch",
    group: "destinations",
    title: "ערים שנבחרו ב-TripMatch",
    description: "כמה פעמים כל עיר נבחרה, איזה אחוז מכלל הבחירות, וכמה אהבו את מה שראו בה.",
    columns: [
      col("rank", "#", "number"),
      col("value", "עיר"),
      col("count", "סשנים", "number"),
      col("share", "שיעור מהבחירות", "percent"),
      col("users", "משתמשים ייחודיים", "number"),
      col("likes", "לייקים", "number"),
      col("likeRate", "שיעור לייק", "percent"),
    ],
    rows: shareRows(tm.map((r) => r.city), (city) => {
      const e = tmByCity.get(city);
      return { users: e?.users.size ?? 0, likes: e?.likes ?? 0, likeRate: e && e.likes + e.rejects ? pct(e.likes, e.likes + e.rejects) : null };
    }),
    barKey: "count",
    usesRange: true,
  });

  const abroad = sess.filter((s) => s.trip_type === "abroad_vacation").map((s) => normDestination(s.answers?.destination as string | undefined));
  reports.push({
    id: "dest_abroad",
    group: "destinations",
    title: "יעדים שנבחרו בחופשה בחו״ל",
    description: "היעד שהמשתמש ביקש בשאלון החופשה בחו״ל (מקובץ לפי העיר/היעד הראשי).",
    columns: [col("rank", "#", "number"), col("value", "יעד"), col("count", "בקשות", "number"), col("share", "שיעור מהבחירות", "percent")],
    rows: shareRows(abroad),
    barKey: "count",
    usesRange: true,
  });

  reports.push({
    id: "dest_trippy",
    group: "destinations",
    title: "יעדים ב-Trippy AI",
    description: "העיר שבה נוצר כל טיול ב-Trippy AI.",
    columns: [col("rank", "#", "number"), col("value", "עיר"), col("count", "טיולים", "number"), col("share", "שיעור מהבחירות", "percent")],
    rows: shareRows(trippyIn.map((r) => r.city)),
    barKey: "count",
    usesRange: true,
  });

  // ביקוש משולב לכל היעדים
  const combined = new Map<string, { tripmatch: number; abroad: number; trippy: number; tripmatchTrip: number }>();
  const bump = (v: string | null | undefined, k: "tripmatch" | "abroad" | "trippy" | "tripmatchTrip") => {
    const d = normDestination(v);
    if (!d) return;
    const e = combined.get(d) ?? { tripmatch: 0, abroad: 0, trippy: 0, tripmatchTrip: 0 };
    e[k] += 1;
    combined.set(d, e);
  };
  for (const r of tm) bump(r.city, "tripmatch");
  for (const d of abroad) bump(d, "abroad");
  for (const r of trippyIn) bump(r.city, "trippy");
  for (const s of sess) if (s.trip_type === "tripmatch") bump((s.answers?.cityValue as string) || (s.answers?.destination as string), "tripmatchTrip");
  const combinedTotal = [...combined.values()].reduce((a, e) => a + e.tripmatch + e.abroad + e.trippy + e.tripmatchTrip, 0);
  reports.push({
    id: "dest_demand",
    group: "destinations",
    title: "ביקוש ליעדים - כל המוצרים",
    description: "כל הבחירות של יעדים מכל המוצרים יחד, עם פירוק לפי מקור.",
    columns: [
      col("rank", "#", "number"),
      col("value", "יעד"),
      col("total", "סה״כ בחירות", "number"),
      col("share", "שיעור מכל הבחירות", "percent"),
      col("tripmatch", "TripMatch", "number"),
      col("tripmatchTrip", "TripMatch → טיול", "number"),
      col("abroad", "חופשה בחו״ל", "number"),
      col("trippy", "Trippy AI", "number"),
    ],
    rows: [...combined.entries()]
      .map(([value, e]) => ({ value, total: e.tripmatch + e.abroad + e.trippy + e.tripmatchTrip, ...e }))
      .sort((a, b) => b.total - a.total)
      .map((r, i) => ({ rank: i + 1, ...r, share: pct(r.total, combinedTotal) })),
    barKey: "total",
    usesRange: true,
  });

  // ----------------------------------------------------------- בחירות משתמשים
  const typeCounts = new Map<string, { started: number; completed: number; users: Set<string> }>();
  for (const s of sess) {
    const e = typeCounts.get(s.trip_type) ?? { started: 0, completed: 0, users: new Set<string>() };
    e.started += 1;
    if (s.status === "completed") e.completed += 1;
    e.users.add(s.user_id);
    typeCounts.set(s.trip_type, e);
  }
  if (trippyIn.length) typeCounts.set("trippy", { started: trippyIn.length, completed: trippyIn.length, users: new Set(trippyIn.map((r) => r.user_id)) });
  const typeTotal = [...typeCounts.values()].reduce((a, e) => a + e.started, 0);
  reports.push({
    id: "choice_trip_types",
    group: "choices",
    title: "איזה סוג טיול בוחרים",
    description: "חלוקת הבחירות בין סוגי הטיול, כולל שיעור ההשלמה של כל סוג.",
    columns: [
      col("rank", "#", "number"),
      col("value", "סוג טיול"),
      col("started", "התחילו", "number"),
      col("share", "שיעור מהבחירות", "percent"),
      col("completed", "הושלמו", "number"),
      col("completion", "שיעור השלמה", "percent"),
      col("users", "משתמשים ייחודיים", "number"),
    ],
    rows: [...typeCounts.entries()]
      .sort((a, b) => b[1].started - a[1].started)
      .map(([type, e], i) => ({
        rank: i + 1,
        value: label(TRIP_TYPE_LABELS, type),
        started: e.started,
        share: pct(e.started, typeTotal),
        completed: e.completed,
        completion: pct(e.completed, e.started),
        users: e.users.size,
      })),
    barKey: "started",
    usesRange: true,
  });

  reports.push({
    id: "choice_trip_status",
    group: "choices",
    title: "איפה נעצרים בבניית טיול",
    description: "סטטוס הבניות לפי סוג טיול - כמה נתקעו בשאלון, בבנייה או ננטשו.",
    columns: [col("type", "סוג טיול"), col("value", "סטטוס"), col("count", "בניות", "number"), col("share", "שיעור מהסוג", "percent")],
    rows: [...new Set(sess.map((s) => s.trip_type))].flatMap((type) => {
      const rows = sess.filter((s) => s.trip_type === type);
      return shareRows(rows.map((s) => s.status)).map((r) => ({ type: label(TRIP_TYPE_LABELS, type), value: label(TRIP_STATUS_LABELS, r.value), count: r.count, share: r.share }));
    }),
    barKey: "count",
    usesRange: true,
  });

  // שאלון לכל סוג טיול: כמה בחרו כל תשובה
  for (const type of [...new Set(sess.map((s) => s.trip_type))].sort((a, b) => (typeCounts.get(b)?.started ?? 0) - (typeCounts.get(a)?.started ?? 0))) {
    const rows = sess.filter((s) => s.trip_type === type);
    const counts = new Map<string, Map<string, number>>();
    const answeredBy = new Map<string, number>();
    for (const s of rows) {
      for (const [q, raw] of Object.entries(s.answers ?? {})) {
        if (SKIP_QUESTIONS.has(q) || raw === null || raw === undefined || raw === "") continue;
        const values = Array.isArray(raw) ? raw : [raw];
        const flat = values.filter((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean").map(String);
        if (!flat.length && !Array.isArray(raw)) continue;
        answeredBy.set(q, (answeredBy.get(q) ?? 0) + 1);
        const m = counts.get(q) ?? new Map<string, number>();
        for (const v of flat) m.set(v, (m.get(v) ?? 0) + 1);
        counts.set(q, m);
      }
    }
    const outRows: Record<string, Cell>[] = [];
    for (const [q, m] of counts) {
      const answered = answeredBy.get(q) ?? 0;
      for (const [v, c] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
        outRows.push({ question: QUESTION_LABELS[q] ?? q, value: choiceLabel(v), count: c, share: pct(c, answered), answered });
      }
    }
    if (!outRows.length) continue;
    reports.push({
      id: `choice_q_${type}`,
      group: "choices",
      title: `שאלון ${label(TRIP_TYPE_LABELS, type)}: מה בחרו`,
      description: `לכל שאלה: כמה משתמשים בחרו כל תשובה ומה השיעור מתוך מי שענה (${rows.length} שאלונים). בשאלות רב-בחירה הסכום יכול לעבור 100%.`,
      columns: [col("question", "שאלה"), col("value", "תשובה"), col("count", "בחרו", "number"), col("share", "שיעור מהעונים", "percent"), col("answered", "ענו על השאלה", "number")],
      rows: outRows,
      barKey: "count",
      usesRange: true,
    });
  }

  // העדפות אונבורדינג
  const answeredPrefs = prefs.filter((p) => PREFERENCE_FIELDS.some((f) => Array.isArray(p[f.key]) && (p[f.key] as unknown[]).length > 0) || p.onboarding_completed_at);
  const prefRows: Record<string, Cell>[] = [];
  for (const f of PREFERENCE_FIELDS) {
    const answered = answeredPrefs.filter((p) => Array.isArray(p[f.key]) && (p[f.key] as unknown[]).length > 0).length;
    const m = new Map<string, number>();
    for (const p of answeredPrefs) for (const v of (p[f.key] as string[] | null) ?? []) m.set(v, (m.get(v) ?? 0) + 1);
    for (const [v, c] of [...m.entries()].sort((a, b) => b[1] - a[1])) {
      prefRows.push({ question: f.label, value: choiceLabel(v), count: c, share: pct(c, answered), answered });
    }
  }
  for (const [key, lbl] of [
    ["kosher", "כשרות"],
    ["accessibility", "צריכים נגישות"],
  ] as const) {
    const yes = answeredPrefs.filter((p) => p[key] === true).length;
    prefRows.push({ question: lbl, value: "כן", count: yes, share: pct(yes, answeredPrefs.length), answered: answeredPrefs.length });
    prefRows.push({ question: lbl, value: "לא", count: answeredPrefs.length - yes, share: pct(answeredPrefs.length - yes, answeredPrefs.length), answered: answeredPrefs.length });
  }
  reports.push({
    id: "choice_preferences",
    group: "choices",
    title: "העדפות המשתמשים (אונבורדינג)",
    description: `מה המשתמשים סימנו בשאלון ההעדפות. ${answeredPrefs.length} משתמשים מילאו. מצב נוכחי - לא מושפע מהטווח.`,
    columns: [col("question", "שאלה"), col("value", "תשובה"), col("count", "משתמשים", "number"), col("share", "שיעור מהעונים", "percent"), col("answered", "ענו על השאלה", "number")],
    rows: prefRows,
    barKey: "count",
    usesRange: false,
  });

  // בחירות מהטקסונומיה המלאה
  const taxRows: Record<string, Cell>[] = [];
  const taxAnswered = prefs.filter((p) => p.taxonomy_selections && Object.keys(p.taxonomy_selections).length > 0);
  const taxCounts = new Map<string, number>();
  for (const p of taxAnswered) {
    for (const [cat, sel] of Object.entries(p.taxonomy_selections ?? {})) {
      for (const g of sel?.groups ?? []) taxCounts.set(`${cat}|קבוצה|${g}`, (taxCounts.get(`${cat}|קבוצה|${g}`) ?? 0) + 1);
      for (const t of sel?.tags ?? []) taxCounts.set(`${cat}|תגית|${t}`, (taxCounts.get(`${cat}|תגית|${t}`) ?? 0) + 1);
    }
  }
  for (const [k, c] of [...taxCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const [cat, kind, value] = k.split("|");
    taxRows.push({ category: choiceLabel(cat), kind, value, count: c, share: pct(c, taxAnswered.length) });
  }
  reports.push({
    id: "choice_taxonomy",
    group: "choices",
    title: "תחומים ותגיות שהמשתמשים בחרו",
    description: `בחירות מתוך הטקסונומיה המלאה (${taxAnswered.length} משתמשים). מצב נוכחי.`,
    columns: [col("category", "תחום"), col("kind", "סוג"), col("value", "בחירה"), col("count", "משתמשים", "number"), col("share", "שיעור מהעונים", "percent")],
    rows: taxRows,
    barKey: "count",
    usesRange: false,
  });

  reports.push({
    id: "choice_tripmatch_categories",
    group: "choices",
    title: "קטגוריות שנבחרו ב-TripMatch",
    description: "על איזו קטגוריה המשתמשים בחרו להחליק.",
    columns: [col("rank", "#", "number"), col("value", "קטגוריה"), col("count", "סשנים", "number"), col("share", "שיעור מהבחירות", "percent")],
    rows: shareRows(tm.map((r) => (r.category ? choiceLabel(r.category) : null))),
    barKey: "count",
    usesRange: true,
  });

  const dnaRows: Record<string, Cell>[] = [];
  for (const [key, lbl] of [
    ["preferred_categories", "אוהבים"],
    ["disliked_categories", "לא אוהבים"],
  ] as const) {
    const m = new Map<string, number>();
    for (const d of dna) for (const v of d[key] ?? []) m.set(v, (m.get(v) ?? 0) + 1);
    for (const [v, c] of [...m.entries()].sort((a, b) => b[1] - a[1])) dnaRows.push({ kind: lbl, value: choiceLabel(v), count: c, share: pct(c, dna.length) });
  }
  reports.push({
    id: "choice_travel_dna",
    group: "choices",
    title: "Travel DNA - מה אוהבים ומה לא",
    description: `קטגוריות מועדפות ולא מועדפות בפרופיל ה-DNA (${dna.length} משתמשים). מצב נוכחי.`,
    columns: [col("kind", "סוג"), col("value", "קטגוריה"), col("count", "משתמשים", "number"), col("share", "שיעור", "percent")],
    rows: dnaRows,
    barKey: "count",
    usesRange: false,
  });

  // ---------------------------------------------------------------- משתמשים
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const prefsById = new Map(prefs.map((p) => [p.id, p]));
  const perUser = new Map<string, Record<string, number>>();
  for (const e of events) {
    const m = perUser.get(e.userId) ?? {};
    m[e.kind] = (m[e.kind] ?? 0) + 1;
    perUser.set(e.userId, m);
  }
  const sessionsByUser = new Map<string, number>();
  for (const s of sessions) sessionsByUser.set(s.user_id, (sessionsByUser.get(s.user_id) ?? 0) + 1);
  const lastActive = new Map<string, string>();
  for (const e of events) if (!lastActive.has(e.userId) || e.at > lastActive.get(e.userId)!) lastActive.set(e.userId, e.at);

  reports.push({
    id: "users_all",
    group: "users",
    title: "כל המשתמשים",
    description: "רשימת משתמשים מלאה עם נתוני שימוש. כולל פרטים אישיים - לשימוש פנימי בלבד. מצב נוכחי.",
    columns: [
      col("name", "שם"),
      col("username", "שם משתמש"),
      col("email", "אימייל"),
      col("provider", "הרשמה דרך"),
      col("signup", "תאריך הרשמה", "date"),
      col("lastActive", "פעילות אחרונה", "date"),
      col("city", "עיר"),
      col("onboarding", "השלים אונבורדינג"),
      col("trips", "בניות טיול", "number"),
      col("tripmatch", "סשני TripMatch", "number"),
      col("trippy", "Trippy AI", "number"),
      col("favorites", "לייקים/שמירות", "number"),
      col("posts", "פוסטים", "number"),
      col("reviews", "ביקורות", "number"),
    ],
    rows: users
      .filter((u) => !u.isAnonymous)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((u) => {
        const p = profileById.get(u.id);
        const act = perUser.get(u.id) ?? {};
        const onboarded = Boolean(p?.main_onboarding_completed_at || prefsById.get(u.id)?.onboarding_completed_at);
        return {
          name: displayName(p, u.email),
          username: p?.username ?? null,
          email: u.email || null,
          provider: label(PROVIDER_LABELS, u.provider),
          signup: dayKey(u.createdAt),
          lastActive: lastActive.has(u.id) ? dayKey(lastActive.get(u.id)!) : null,
          city: p?.city ?? null,
          onboarding: onboarded ? "כן" : "לא",
          trips: sessionsByUser.get(u.id) ?? 0,
          tripmatch: act.tripmatch ?? 0,
          trippy: act.trippy ?? 0,
          favorites: act.favorite ?? 0,
          posts: act.post ?? 0,
          reviews: act.review ?? 0,
        };
      }),
    usesRange: false,
  });

  const ageBand = (birth: string | null | undefined) => {
    if (!birth) return null;
    const age = Math.floor((Date.now() - Date.parse(birth)) / (365.25 * DAY));
    if (!Number.isFinite(age) || age < 10 || age > 100) return null;
    return age < 18 ? "מתחת ל-18" : age < 25 ? "18-24" : age < 35 ? "25-34" : age < 45 ? "35-44" : age < 55 ? "45-54" : "55+";
  };
  const { data: births } = await db.from("profiles").select("id,birth_date");
  const registeredIds = new Set(users.filter((u) => !u.isAnonymous).map((u) => u.id));
  const demoRows: Record<string, Cell>[] = [];
  const pushShare = (dimension: string, values: (string | null | undefined)[]) => {
    for (const r of shareRows(values)) demoRows.push({ dimension, value: r.value, count: r.count, share: r.share });
  };
  pushShare("איך נרשמו", users.map((u) => label(PROVIDER_LABELS, u.provider)));
  pushShare("טווח גילאים", ((births ?? []) as { id: string; birth_date: string | null }[]).filter((b) => registeredIds.has(b.id)).map((b) => ageBand(b.birth_date)));
  pushShare("עיר מגורים", profiles.filter((p) => registeredIds.has(p.id)).map((p) => p.city));
  pushShare("השלימו אונבורדינג", [...registeredIds].map((id) => (profileById.get(id)?.main_onboarding_completed_at || prefsById.get(id)?.onboarding_completed_at ? "כן" : "לא")));
  reports.push({
    id: "users_demographics",
    group: "users",
    title: "פילוח משתמשים",
    description: "מקור הרשמה, גילאים, ערים והשלמת אונבורדינג. מצב נוכחי.",
    columns: [col("dimension", "פילוח"), col("value", "ערך"), col("count", "משתמשים", "number"), col("share", "שיעור", "percent")],
    rows: demoRows,
    barKey: "count",
    usesRange: false,
  });

  // ---------------------------------------------------------------- פעילות
  const days = new Map<string, Record<string, number | Set<string>>>();
  const day = (iso: string) => {
    const k = dayKey(iso);
    let d = days.get(k);
    if (!d) {
      d = { signups: 0, active: new Set<string>(), trips: 0, tripmatch: 0, trippy: 0, social: 0, favorites: 0 };
      days.set(k, d);
    }
    return d;
  };
  const inc = (d: Record<string, number | Set<string>>, k: string) => (d[k] = (d[k] as number) + 1);
  for (const u of users) if (!u.isAnonymous && inRange(u.createdAt)) inc(day(u.createdAt), "signups");
  for (const e of events) {
    if (!inRange(e.at)) continue;
    const d = day(e.at);
    (d.active as Set<string>).add(e.userId);
    if (e.kind === "trip") inc(d, "trips");
    else if (e.kind === "tripmatch") inc(d, "tripmatch");
    else if (e.kind === "trippy") inc(d, "trippy");
    else if (e.kind === "favorite") inc(d, "favorites");
    else if (["post", "comment", "review", "story", "like", "follow", "dm"].includes(e.kind)) inc(d, "social");
  }
  reports.push({
    id: "activity_daily",
    group: "activity",
    title: "פעילות יומית",
    description: "שורה לכל יום: נרשמים, משתמשים פעילים ופעולות בכל מוצר. נוח לגרפים ב-Excel.",
    columns: [
      col("date", "תאריך", "date"),
      col("signups", "נרשמים", "number"),
      col("active", "משתמשים פעילים", "number"),
      col("trips", "בניות טיול", "number"),
      col("tripmatch", "פעולות TripMatch", "number"),
      col("trippy", "Trippy AI", "number"),
      col("favorites", "לייקים/שמירות", "number"),
      col("social", "פעולות קהילה", "number"),
    ],
    rows: [...days.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, d]) => ({
        date,
        signups: d.signups as number,
        active: (d.active as Set<string>).size,
        trips: d.trips as number,
        tripmatch: d.tripmatch as number,
        trippy: d.trippy as number,
        favorites: d.favorites as number,
        social: d.social as number,
      })),
    barKey: "active",
    usesRange: true,
  });

  return { range, generatedAt: new Date().toISOString(), reports, warnings: errors };
}

export type ReportsData = Awaited<ReturnType<typeof buildReports>>;
