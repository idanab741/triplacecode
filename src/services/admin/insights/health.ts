import { type Db, fetchAll, DAY } from "./core";
import { isValidPlaceCategory } from "@/constants/placeCategories";

export type Severity = "critical" | "warning" | "info";
export type Area = "system" | "operations" | "content" | "users";

export interface HealthSample {
  id: string;
  label: string;
  meta?: string;
  href?: string;
}

export interface HealthCheck {
  id: string;
  area: Area;
  severity: Severity;
  title: string;
  description: string;
  count: number;
  total?: number;
  samples: HealthSample[];
  href?: string;
  fix?: { action: FixAction; label: string; confirm: string };
}

export type FixAction = "mark_stuck_jobs_failed" | "abandon_stale_sessions" | "infer_country_from_city" | "disable_expired_notifications";

/** טבלאות שהקוד משתמש בהן - אם אחת חסרה ב-DB, פיצ'ר שלם שבור בשקט. */
const REQUIRED_TABLES: { table: string; feature: string; migration: string }[] = [
  { table: "custom_otp_codes", feature: "הרשמה עם קוד OTP (api/auth/custom-otp)", migration: "0055_custom_signup_otp_codes.sql" },
  { table: "admin_locations", feature: "מיקומי AI Discovery (api/admin/locations)", migration: "0028_admin_locations.sql" },
  { table: "profiles", feature: "פרופילים", migration: "0001_profiles.sql" },
  { table: "places", feature: "מקומות", migration: "0004_places.sql" },
  { table: "trip_builder_sessions", feature: "Trip Builder", migration: "0013_trip_builder.sql" },
  { table: "tripmatch_sessions", feature: "TripMatch", migration: "—" },
  { table: "trippy_ai_results", feature: "Trippy AI", migration: "0057_trippy_ai_results.sql" },
  { table: "token_transactions", feature: "מערכת טריפים", migration: "0063_token_system.sql" },
  { table: "support_conversations", feature: "שירות לקוחות", migration: "0062_support_chat.sql" },
  { table: "notifications", feature: "התראות", migration: "0059_notifications.sql" },
  { table: "posts", feature: "פיד קהילה", migration: "0068_social_posts_media_likes_comments.sql" },
  { table: "dm_messages", feature: "הודעות פרטיות", migration: "0093_direct_messages.sql" },
  { table: "trips", feature: "טיולים (פרופיל)", migration: "0090_trips.sql" },
  { table: "collections", feature: "מפות (אוספים)", migration: "0089_collections.sql" },
];

const REQUIRED_ENV: { key: string; feature: string; critical: boolean }[] = [
  { key: "NEXT_PUBLIC_SUPABASE_URL", feature: "חיבור ל-Supabase", critical: true },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", feature: "חיבור ל-Supabase", critical: true },
  { key: "SUPABASE_SERVICE_ROLE_KEY", feature: "פעולות שרת/אדמין", critical: true },
  { key: "ADMIN_API_SECRET", feature: "כניסה לאדמין", critical: true },
  { key: "GOOGLE_MAPS_API_KEY", feature: "Google Places / גיאוקוד", critical: true },
  { key: "ANTHROPIC_API_KEY", feature: "Trippy AI / סיווג AI", critical: true },
  { key: "NEXT_PUBLIC_MAPTILER_KEY", feature: "מפות", critical: false },
  { key: "RESEND_API_KEY", feature: "שליחת מיילים (OTP)", critical: false },
  { key: "RESEND_FROM_EMAIL", feature: "שליחת מיילים (OTP)", critical: false },
  { key: "TICKETMASTER_API_KEY", feature: "אירועים", critical: false },
  { key: "NEXT_PUBLIC_APP_URL", feature: "קישורי שיתוף/הזמנה", critical: false },
];

export interface PlaceRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  subcategory: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  is_legacy: boolean | null;
  source: string | null;
  created_at: string;
  has_description: boolean;
  image_count: number;
}

const placeHref = (id: string) => `/admin/places/${id}`;
const blank = (v: string | null | undefined) => !v || !v.trim();
const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/["'׳״`().,\-–|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function tableExists(db: Db, table: string): Promise<boolean> {
  const { error } = await db.from(table).select("*", { count: "exact", head: true });
  if (!error) return true;
  const msg = `${error.code ?? ""} ${error.message ?? ""}`;
  return !/PGRST205|42P01|does not exist|Could not find the table/i.test(msg);
}

export async function loadPlaces(db: Db): Promise<PlaceRow[]> {
  const rows = await fetchAll<{
    id: string;
    name: string;
    city: string | null;
    country: string | null;
    category: string | null;
    subcategory: string | null;
    latitude: number | null;
    longitude: number | null;
    rating: number | null;
    is_legacy: boolean | null;
    source: string | null;
    created_at: string;
    short_description: string | null;
    image_urls: string[] | null;
  }>((f, t) =>
    db
      .from("places")
      .select("id,name,city,country,category,subcategory,latitude,longitude,rating,is_legacy,source,created_at,short_description,image_urls")
      .order("id")
      .range(f, t)
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    country: r.country,
    category: r.category,
    subcategory: r.subcategory,
    latitude: r.latitude,
    longitude: r.longitude,
    rating: r.rating,
    is_legacy: r.is_legacy,
    source: r.source,
    created_at: r.created_at,
    has_description: !blank(r.short_description),
    image_count: r.image_urls?.length ?? 0,
  }));
}

/** מסיק מדינה חסרה לפי מקומות אחרים באותה עיר: רק אם יש לפחות 2 מקומות
 *  עם מדינה באותה עיר ולפחות 80% מהם מסכימים. שמרני בכוונה. */
export function inferCountries(places: PlaceRow[]): { id: string; name: string; city: string; country: string }[] {
  const byCity = new Map<string, Map<string, number>>();
  for (const p of places) {
    if (blank(p.city) || blank(p.country)) continue;
    const city = p.city!.trim();
    const m = byCity.get(city) ?? new Map<string, number>();
    m.set(p.country!, (m.get(p.country!) ?? 0) + 1);
    byCity.set(city, m);
  }
  const out: { id: string; name: string; city: string; country: string }[] = [];
  for (const p of places) {
    if (!blank(p.country) || blank(p.city)) continue;
    const m = byCity.get(p.city!.trim());
    if (!m) continue;
    const total = [...m.values()].reduce((s, v) => s + v, 0);
    const [best, bestCount] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
    if (total >= 2 && bestCount / total >= 0.8) out.push({ id: p.id, name: p.name, city: p.city!, country: best });
  }
  return out;
}

export async function buildHealth(db: Db) {
  const now = Date.now();
  const checks: HealthCheck[] = [];
  const add = (c: HealthCheck) => {
    if (c.count > 0) checks.push(c);
  };

  // ---------- מערכת ----------
  const tableResults = await Promise.all(REQUIRED_TABLES.map(async (t) => ({ ...t, exists: await tableExists(db, t.table) })));
  const missingTables = tableResults.filter((t) => !t.exists);
  add({
    id: "missing_tables",
    area: "system",
    severity: "critical",
    title: "טבלאות חסרות במסד הנתונים",
    description: "הקוד משתמש בטבלאות שלא קיימות ב-DB - הפיצ'רים האלה נכשלים בשקט בפרודקשן. יש להריץ את קובץ ה-migration המתאים ב-Supabase.",
    count: missingTables.length,
    samples: missingTables.map((t) => ({ id: t.table, label: t.table, meta: `${t.feature} · ${t.migration}` })),
  });

  const missingEnv = REQUIRED_ENV.filter((e) => !process.env[e.key]);
  add({
    id: "missing_env_critical",
    area: "system",
    severity: "critical",
    title: "משתני סביבה קריטיים חסרים",
    description: "בלי המפתחות האלה חלקים מרכזיים באפליקציה לא יעבדו בסביבה הזו.",
    count: missingEnv.filter((e) => e.critical).length,
    samples: missingEnv.filter((e) => e.critical).map((e) => ({ id: e.key, label: e.key, meta: e.feature })),
  });
  add({
    id: "missing_env_optional",
    area: "system",
    severity: "warning",
    title: "משתני סביבה משניים חסרים",
    description: "פיצ'רים משניים יהיו מושבתים בסביבה הזו.",
    count: missingEnv.filter((e) => !e.critical).length,
    samples: missingEnv.filter((e) => !e.critical).map((e) => ({ id: e.key, label: e.key, meta: e.feature })),
  });

  // ---------- תפעול ----------
  const [support, jobs, sessions, placeSubs, tripaddSubs, notifications, balances] = await Promise.all([
    db.from("support_conversations").select("id,user_id,status,last_message_at,created_at").eq("status", "waiting_for_admin"),
    db.from("discovery_jobs").select("id,trip_type,status,created_at,requested_quantity").in("status", ["pending", "running", "failed"]),
    db.from("trip_builder_sessions").select("id,user_id,trip_type,status,updated_at,created_at").in("status", ["building", "planning"]),
    db.from("place_submissions").select("id,name,city,created_at").eq("status", "pending"),
    db.from("tripadd_submissions").select("id,name,city,created_at").eq("status", "pending"),
    db.from("notifications").select("id,title,expires_at,status").eq("status", "active").not("expires_at", "is", null),
    db.from("user_token_balances").select("user_id,balance").lt("balance", 0),
  ]);

  const supportRows = (support.data ?? []) as { id: string; last_message_at: string | null; created_at: string }[];
  const overdue = supportRows.filter((r) => Date.parse(r.last_message_at ?? r.created_at) < now - DAY);
  add({
    id: "support_overdue",
    area: "operations",
    severity: "critical",
    title: "פניות שירות ללא מענה מעל 24 שעות",
    description: "משתמשים מחכים לתשובה יותר מיממה.",
    count: overdue.length,
    href: "/admin/support",
    samples: overdue.slice(0, 5).map((r) => ({ id: r.id, label: `פנייה ${r.id.slice(0, 8)}`, meta: r.last_message_at ?? r.created_at, href: "/admin/support" })),
  });
  add({
    id: "support_waiting",
    area: "operations",
    severity: "warning",
    title: "פניות שירות ממתינות",
    description: "פניות פתוחות שממתינות לתשובה מהצוות.",
    count: supportRows.length - overdue.length,
    href: "/admin/support",
    samples: [],
  });

  const jobRows = (jobs.data ?? []) as { id: string; trip_type: string | null; status: string; created_at: string }[];
  const stuckJobs = jobRows.filter((j) => j.status !== "failed" && Date.parse(j.created_at) < now - 2 * 60 * 60 * 1000);
  add({
    id: "jobs_stuck",
    area: "operations",
    severity: "warning",
    title: "משימות AI Discovery תקועות",
    description: "משימות במצב pending/running כבר יותר משעתיים - כנראה קרסו באמצע. סימון ככושלות מאפשר להריץ אותן מחדש.",
    count: stuckJobs.length,
    href: "/admin/discovery",
    samples: stuckJobs.slice(0, 5).map((j) => ({ id: j.id, label: `${j.trip_type ?? "משימה"} · ${j.status}`, meta: j.created_at, href: `/admin/discovery-jobs/${j.id}` })),
    fix: { action: "mark_stuck_jobs_failed", label: "סמן ככושלות", confirm: "לסמן את כל המשימות התקועות כ-failed?" },
  });
  const failedJobs = jobRows.filter((j) => j.status === "failed");
  add({
    id: "jobs_failed",
    area: "operations",
    severity: "info",
    title: "משימות AI Discovery שנכשלו",
    description: "כדאי לבדוק את הסיבה ולהריץ מחדש.",
    count: failedJobs.length,
    href: "/admin/discovery",
    samples: failedJobs.slice(0, 5).map((j) => ({ id: j.id, label: j.trip_type ?? "משימה", meta: j.created_at, href: `/admin/discovery-jobs/${j.id}` })),
  });

  const sessionRows = (sessions.data ?? []) as { id: string; trip_type: string; status: string; updated_at: string | null; created_at: string }[];
  const staleSessions = sessionRows.filter((s) => Date.parse(s.updated_at ?? s.created_at) < now - 6 * 60 * 60 * 1000);
  add({
    id: "sessions_stale",
    area: "operations",
    severity: "warning",
    title: "בניות טיול שנתקעו באמצע",
    description: "סשנים של Trip Builder שנשארו במצב building/planning יותר מ-6 שעות - סימן לכשל בצינור הבנייה. סימון כ'ננטש' מנקה אותם מהסטטיסטיקות.",
    count: staleSessions.length,
    samples: staleSessions.slice(0, 5).map((s) => ({ id: s.id, label: `${s.trip_type} · ${s.status}`, meta: s.updated_at ?? s.created_at })),
    fix: { action: "abandon_stale_sessions", label: "סמן כננטשו", confirm: "לסמן את כל הסשנים התקועים כ-abandoned?" },
  });

  const subs = [
    ...((placeSubs.data ?? []) as { id: string; name: string; city: string | null; created_at: string }[]).map((s) => ({ ...s, kind: "הצעת מקום" })),
    ...((tripaddSubs.data ?? []) as { id: string; name: string; city: string | null; created_at: string }[]).map((s) => ({ ...s, kind: "TripAdd" })),
  ];
  const oldSubs = subs.filter((s) => Date.parse(s.created_at) < now - 3 * DAY);
  add({
    id: "submissions_old",
    area: "operations",
    severity: "warning",
    title: "תוכן משתמשים ממתין לאישור מעל 3 ימים",
    description: "הצעות מקומות ו-TripAdd שמשתמשים שלחו ועדיין לא טופלו.",
    count: oldSubs.length,
    href: "/admin/community#submissions",
    samples: oldSubs.slice(0, 6).map((s) => ({ id: s.id, label: s.name, meta: `${s.kind}${s.city ? ` · ${s.city}` : ""}`, href: "/admin/community#submissions" })),
  });

  const expired = ((notifications.data ?? []) as { id: string; title: string; expires_at: string }[]).filter((n) => Date.parse(n.expires_at) < now);
  add({
    id: "notifications_expired",
    area: "operations",
    severity: "info",
    title: "התראות שפג תוקפן אך עדיין פעילות",
    description: "ניקוי שומר על רשימת ההתראות מסודרת.",
    count: expired.length,
    href: "/admin/notifications",
    samples: expired.slice(0, 5).map((n) => ({ id: n.id, label: n.title, meta: n.expires_at })),
    fix: { action: "disable_expired_notifications", label: "השבת פגי תוקף", confirm: "להשבית את כל ההתראות שפג תוקפן?" },
  });

  const negative = (balances.data ?? []) as { user_id: string; balance: number }[];
  add({
    id: "negative_balances",
    area: "users",
    severity: "warning",
    title: "משתמשים עם יתרת טריפים שלילית",
    description: "יתרה שלילית מעידה על חיוב כפול או באג בהחזרים.",
    count: negative.length,
    samples: negative.slice(0, 5).map((b) => ({ id: b.user_id, label: b.user_id.slice(0, 8), meta: `יתרה ${b.balance}`, href: `/admin/users?user=${b.user_id}` })),
  });

  // ---------- תוכן ----------
  const places = await loadPlaces(db);
  const active = places.filter((p) => !p.is_legacy);
  const legacyCount = places.length - active.length;
  const sample = (rows: PlaceRow[], meta?: (p: PlaceRow) => string) =>
    rows.slice(0, 6).map((p) => ({ id: p.id, label: p.name, meta: meta ? meta(p) : [p.city, p.category].filter(Boolean).join(" · "), href: placeHref(p.id) }));

  const noCoords = active.filter((p) => p.latitude == null || p.longitude == null);
  add({
    id: "places_no_coords",
    area: "content",
    severity: "critical",
    title: "מקומות פעילים בלי קואורדינטות",
    description: "מקום בלי מיקום לא יופיע במפה ולא ייכנס למסלולים.",
    count: noCoords.length,
    total: active.length,
    samples: sample(noCoords),
  });

  const noImages = active.filter((p) => p.image_count === 0);
  add({
    id: "places_no_images",
    area: "content",
    severity: "warning",
    title: "מקומות פעילים בלי תמונה",
    description: "כרטיסים בלי תמונה מורידים משמעותית את ההקלקות וה-Likes ב-TripMatch.",
    count: noImages.length,
    total: active.length,
    samples: sample(noImages),
  });

  const badCategory = active.filter((p) => !p.category || !isValidPlaceCategory(p.category));
  add({
    id: "places_bad_category",
    area: "content",
    severity: "warning",
    title: "קטגוריה ראשית לא תקנית",
    description: "places.category חייב להיות אחת מ-6 הקטגוריות הראשיות. ערכים אחרים שוברים סינון ומנוע התאמה. ניתן לתקן בכלי 'סיווג מחדש' במסך המקומות.",
    count: badCategory.length,
    total: active.length,
    href: "/admin/places",
    samples: sample(badCategory, (p) => `category = ${p.category ?? "ריק"}`),
  });

  const missingCountry = active.filter((p) => blank(p.country));
  const inferable = inferCountries(places).filter((x) => missingCountry.some((m) => m.id === x.id));
  add({
    id: "places_no_country",
    area: "content",
    severity: "warning",
    title: "מקומות פעילים בלי מדינה",
    description: `מקומות בלי מדינה לא נמצאים בחיפוש לפי יעד. ${inferable.length} מהם ניתנים להשלמה אוטומטית לפי מקומות אחרים באותה עיר.`,
    count: missingCountry.length,
    total: active.length,
    samples: sample(missingCountry, (p) => p.city ?? "בלי עיר"),
    fix: inferable.length
      ? { action: "infer_country_from_city", label: `השלם ${inferable.length} אוטומטית`, confirm: `להשלים מדינה ל-${inferable.length} מקומות לפי העיר שלהם?` }
      : undefined,
  });

  const noCity = active.filter((p) => blank(p.city));
  add({ id: "places_no_city", area: "content", severity: "warning", title: "מקומות פעילים בלי עיר", description: "משפיע על חיפוש, TripMatch ומסלולים לפי עיר.", count: noCity.length, total: active.length, samples: sample(noCity) });

  const dupGroups = new Map<string, PlaceRow[]>();
  for (const p of active) {
    const key = `${normName(p.name)}|${(p.city ?? "").trim()}`;
    const g = dupGroups.get(key) ?? [];
    g.push(p);
    dupGroups.set(key, g);
  }
  const dups = [...dupGroups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
  add({
    id: "places_duplicates",
    area: "content",
    severity: "warning",
    title: "כפילויות חשודות (אותו שם + אותה עיר)",
    description: "אותו מקום שמור כמה פעמים - מפצל ביקורות ו-Likes ומופיע פעמיים למשתמש.",
    count: dups.length,
    samples: dups.slice(0, 8).map((g) => ({ id: g[0].id, label: g[0].name, meta: `${g.length} עותקים${g[0].city ? ` · ${g[0].city}` : ""}`, href: placeHref(g[0].id) })),
  });

  const noDesc = active.filter((p) => !p.has_description);
  add({ id: "places_no_description", area: "content", severity: "info", title: "מקומות בלי תיאור קצר", description: "תיאור משפר המרה ועוזר ל-AI להתאים את המקום למשתמש.", count: noDesc.length, total: active.length, samples: sample(noDesc) });

  const noSub = active.filter((p) => blank(p.subcategory));
  add({ id: "places_no_subcategory", area: "content", severity: "info", title: "מקומות בלי תת-קטגוריה", description: "תת-קטגוריה משפרת את דיוק ההתאמה והסינון.", count: noSub.length, total: active.length, samples: sample(noSub) });

  const noRating = active.filter((p) => p.rating == null);
  add({ id: "places_no_rating", area: "content", severity: "info", title: "מקומות בלי דירוג", description: "ניתן להעשיר מ-Google בעמוד המקום.", count: noRating.length, total: active.length, samples: sample(noRating) });

  const { data: dests } = await db.from("destinations").select("id,name,country,image_url");
  const destRows = (dests ?? []) as { id: string; name: string; country: string | null; image_url: string | null }[];
  const destNoImg = destRows.filter((d) => blank(d.image_url));
  add({
    id: "destinations_no_image",
    area: "content",
    severity: "warning",
    title: "יעדים בלי תמונה",
    description: "יעד בלי תמונה מוצג ריק במסכי הבית והחיפוש.",
    count: destNoImg.length,
    total: destRows.length,
    href: "/admin/destinations",
    samples: destNoImg.slice(0, 6).map((d) => ({ id: d.id, label: d.name, meta: d.country ?? "", href: "/admin/destinations" })),
  });

  // ---------- משתמשים ----------
  const [{ data: profiles }, authList] = await Promise.all([
    db.from("profiles").select("id,username,full_name"),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const profileRows = (profiles ?? []) as { id: string; username: string | null; full_name: string | null }[];
  const profileIds = new Set(profileRows.map((p) => p.id));
  const authUsers = authList.data?.users ?? [];
  const noProfile = authUsers.filter((u) => !profileIds.has(u.id));
  add({
    id: "users_no_profile",
    area: "users",
    severity: "warning",
    title: "משתמשים בלי שורת פרופיל",
    description: "חשבון Auth קיים אבל אין לו profiles - המשתמש יראה מסכים שבורים.",
    count: noProfile.length,
    samples: noProfile.slice(0, 5).map((u) => ({ id: u.id, label: u.email ?? u.id.slice(0, 8), href: `/admin/users?user=${u.id}` })),
  });
  const registeredIds = new Set(authUsers.filter((u) => !u.is_anonymous).map((u) => u.id));
  const noUsername = profileRows.filter((p) => registeredIds.has(p.id) && blank(p.username));
  add({
    id: "users_no_username",
    area: "users",
    severity: "info",
    title: "משתמשים רשומים בלי שם משתמש",
    description: "בלי username אי אפשר לתייג אותם או למצוא אותם בחיפוש הקהילה.",
    count: noUsername.length,
    total: registeredIds.size,
    samples: noUsername.slice(0, 5).map((p) => ({ id: p.id, label: p.full_name ?? p.id.slice(0, 8), href: `/admin/users?user=${p.id}` })),
  });

  // ---------- ציון ----------
  const weights: Record<Severity, number> = { critical: 12, warning: 4, info: 1 };
  const score = Math.max(0, 100 - checks.reduce((s, c) => s + weights[c.severity], 0));
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  checks.sort((a, b) => order[a.severity] - order[b.severity] || b.count - a.count);

  const completeness = (pred: (p: PlaceRow) => boolean) => (active.length ? Math.round((active.filter(pred).length / active.length) * 1000) / 10 : 0);

  return {
    generatedAt: new Date().toISOString(),
    score,
    counts: {
      critical: checks.filter((c) => c.severity === "critical").length,
      warning: checks.filter((c) => c.severity === "warning").length,
      info: checks.filter((c) => c.severity === "info").length,
    },
    places: {
      total: places.length,
      active: active.length,
      legacy: legacyCount,
      completeness: [
        { key: "coords", label: "מיקום", pct: completeness((p) => p.latitude != null && p.longitude != null) },
        { key: "category", label: "קטגוריה תקנית", pct: completeness((p) => Boolean(p.category && isValidPlaceCategory(p.category))) },
        { key: "image", label: "תמונה", pct: completeness((p) => p.image_count > 0) },
        { key: "city", label: "עיר", pct: completeness((p) => !blank(p.city)) },
        { key: "country", label: "מדינה", pct: completeness((p) => !blank(p.country)) },
        { key: "rating", label: "דירוג", pct: completeness((p) => p.rating != null) },
        { key: "description", label: "תיאור", pct: completeness((p) => p.has_description) },
        { key: "subcategory", label: "תת-קטגוריה", pct: completeness((p) => !blank(p.subcategory)) },
      ],
    },
    checks,
  };
}

export type HealthData = Awaited<ReturnType<typeof buildHealth>>;

/** פעולות תיקון בטוחות וממוקדות. dryRun מחזיר תצוגה מקדימה בלי לשנות דבר. */
export async function runFix(db: Db, action: FixAction, dryRun: boolean): Promise<{ changed: number; preview: { id: string; label: string; meta?: string }[] }> {
  const now = Date.now();
  if (action === "mark_stuck_jobs_failed") {
    const cutoff = new Date(now - 2 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.from("discovery_jobs").select("id,trip_type,status").in("status", ["pending", "running"]).lt("created_at", cutoff);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; trip_type: string | null; status: string }[];
    if (!dryRun && rows.length) {
      const { error: upErr } = await db.from("discovery_jobs").update({ status: "failed", completed_at: new Date().toISOString() }).in("id", rows.map((r) => r.id));
      if (upErr) throw new Error(upErr.message);
    }
    return { changed: rows.length, preview: rows.map((r) => ({ id: r.id, label: r.trip_type ?? "משימה", meta: r.status })) };
  }
  if (action === "abandon_stale_sessions") {
    const cutoff = new Date(now - 6 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.from("trip_builder_sessions").select("id,trip_type,status").in("status", ["building", "planning"]).lt("updated_at", cutoff);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; trip_type: string; status: string }[];
    if (!dryRun && rows.length) {
      const { error: upErr } = await db.from("trip_builder_sessions").update({ status: "abandoned" }).in("id", rows.map((r) => r.id));
      if (upErr) throw new Error(upErr.message);
    }
    return { changed: rows.length, preview: rows.map((r) => ({ id: r.id, label: r.trip_type, meta: r.status })) };
  }
  if (action === "disable_expired_notifications") {
    const { data, error } = await db.from("notifications").select("id,title").eq("status", "active").lt("expires_at", new Date().toISOString());
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; title: string }[];
    if (!dryRun && rows.length) {
      const { error: upErr } = await db.from("notifications").update({ status: "disabled" }).in("id", rows.map((r) => r.id));
      if (upErr) throw new Error(upErr.message);
    }
    return { changed: rows.length, preview: rows.map((r) => ({ id: r.id, label: r.title })) };
  }
  if (action === "infer_country_from_city") {
    const places = await loadPlaces(db);
    const fixes = inferCountries(places).filter((f) => !places.find((p) => p.id === f.id)?.is_legacy);
    if (!dryRun) {
      const byCountry = new Map<string, string[]>();
      for (const f of fixes) byCountry.set(f.country, [...(byCountry.get(f.country) ?? []), f.id]);
      for (const [country, ids] of byCountry) {
        for (let i = 0; i < ids.length; i += 200) {
          const { error } = await db.from("places").update({ country }).in("id", ids.slice(i, i + 200)).is("country", null);
          if (error) throw new Error(error.message);
        }
      }
    }
    return { changed: fixes.length, preview: fixes.map((f) => ({ id: f.id, label: f.name, meta: `${f.city} → ${f.country}` })) };
  }
  throw new Error("פעולה לא מוכרת");
}

export const FIX_ACTIONS: FixAction[] = ["mark_stuck_jobs_failed", "abandon_stale_sessions", "infer_country_from_city", "disable_expired_notifications"];
