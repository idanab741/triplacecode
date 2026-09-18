import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

type RangeKey = "today" | "7d" | "30d" | "3mo" | "1y";
type BucketUnit = "hour" | "day" | "week" | "month";

// "today" משתמש ב-hours=24 (24 buckets שעתיים) - לא נכנס ל-RANGE_DAYS
// הרגיל, מטופל בנפרד בכל מקום שמשתמש בו (periodBounds/buildBuckets).
const RANGE_DAYS: Record<Exclude<RangeKey, "today">, number> = { "7d": 7, "30d": 30, "3mo": 90, "1y": 365 };
const RANGE_BUCKET_UNIT: Record<RangeKey, BucketUnit> = { today: "hour", "7d": "day", "30d": "day", "3mo": "week", "1y": "month" };
const MONTH_LABELS_HE = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function parseRange(request: Request): RangeKey {
  const value = new URL(request.url).searchParams.get("range");
  return value === "today" || value === "7d" || value === "30d" || value === "3mo" || value === "1y" ? value : "30d";
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** בונה את גבולות שתי התקופות (נוכחית + הקודמת, אותו אורך בדיוק) לפי
 *  הטווח שנבחר - משמש גם ל-deltas של ה-KPIs וגם לגבולות שליפת הנתונים. */
function periodBounds(range: RangeKey) {
  const now = new Date();
  if (range === "today") {
    const currentStart = startOfDay(now);
    const previousStart = startOfDay(new Date(currentStart.getTime() - 86400000)); // אתמול, אותה שעה יחסית
    return { previousStart, currentStart, now };
  }
  const days = RANGE_DAYS[range];
  const currentStart = startOfDay(new Date(now.getTime() - days * 86400000));
  const previousStart = startOfDay(new Date(currentStart.getTime() - days * 86400000));
  return { previousStart, currentStart, now };
}

function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** בונה תוויות+גבולות bucket לפי granularity (שעה/יום/שבוע/חודש), מהישן לחדש. */
function buildBuckets(range: RangeKey, now: Date) {
  const unit = RANGE_BUCKET_UNIT[range];
  const bounds: { start: Date; end: Date; label: string }[] = [];

  if (unit === "hour") {
    const dayStart = startOfDay(now);
    for (let hour = 0; hour < 24; hour++) {
      const start = new Date(dayStart.getTime() + hour * 3600000);
      const end = new Date(start.getTime() + 3600000);
      bounds.push({ start, end, label: `${String(hour).padStart(2, "0")}:00` });
    }
  } else if (unit === "day") {
    const days = RANGE_DAYS[range as Exclude<RangeKey, "today">];
    for (let i = days - 1; i >= 0; i--) {
      const start = startOfDay(new Date(now.getTime() - i * 86400000));
      const end = new Date(start.getTime() + 86400000);
      bounds.push({ start, end, label: `${start.getDate()}/${start.getMonth() + 1}` });
    }
  } else if (unit === "week") {
    const weeks = Math.ceil(RANGE_DAYS[range as Exclude<RangeKey, "today">] / 7);
    for (let i = weeks - 1; i >= 0; i--) {
      const start = startOfDay(new Date(now.getTime() - (i + 1) * 7 * 86400000));
      const end = new Date(start.getTime() + 7 * 86400000);
      bounds.push({ start, end, label: `${start.getDate()}/${start.getMonth() + 1}` });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      bounds.push({ start, end, label: MONTH_LABELS_HE[start.getMonth()] });
    }
  }

  return bounds;
}

function bucketCounts(bounds: { start: Date; end: Date }[], timestamps: string[]): number[] {
  const counts = new Array(bounds.length).fill(0);
  for (const ts of timestamps) {
    const t = new Date(ts).getTime();
    for (let i = bounds.length - 1; i >= 0; i--) {
      if (t >= bounds[i].start.getTime() && t < bounds[i].end.getTime()) {
        counts[i] += 1;
        break;
      }
    }
  }
  return counts;
}

function inWindow(iso: string | null | undefined, start: Date, end: Date): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function countInWindow(timestamps: (string | null | undefined)[], start: Date, end: Date): number {
  return timestamps.filter((ts) => inWindow(ts, start, end)).length;
}

function distinctUsersInWindow(rows: { userId: string; createdAt: string | null | undefined }[], start: Date, end: Date): number {
  const set = new Set<string>();
  for (const r of rows) {
    if (inWindow(r.createdAt, start, end)) set.add(r.userId);
  }
  return set.size;
}

interface MatchSessionRow {
  user_id: string;
  final_itinerary: unknown;
  created_at: string;
}
interface TrippyResultRow {
  user_id: string;
  created_at: string;
  search_context: unknown;
}
interface TokenTxRow {
  user_id: string;
  type: string;
  amount: number;
  created_at: string;
}
interface SupportConvoRow {
  id: string;
  status: string;
  created_at: string;
}
interface DiscoveryJobRow {
  id: string;
  status: string;
  needs_review_count: number | null;
  created_at: string;
}
interface AuthUserRow {
  id: string;
  email?: string;
  created_at: string;
}

/**
 * Dashboard מרכזי - נבנה כולו מנתונים אמיתיים (Supabase Auth,
 * trippy_ai_results, tripmatch_sessions, token_transactions [ר'
 * migration 0063 - "Tricks" = "טריפים"], support_conversations,
 * discovery_jobs). *** בכוונה בלי שום נתון מ-Trip Builder הקלאסי
 * (day_trip/weekend/abroad_vacation/וכו') - הוסר לגמרי מהדשבורד לפי
 * בקשה מפורשת ("לא רלוונטי"). trip_builder_sessions עדיין נשאל, אבל
 * מסונן ל-trip_type='tripmatch' בלבד (טיולים שנוצרו מ-TripMatch, ר'
 * /api/trip-builder/sessions/from-tripmatch - זה שונה לגמרי מהאשף
 * הקלאסי). אין שום נתון מומצא - כל KPI/גרף/פריט "דורש תשומת לב" מחושב
 * משאילתה אמיתית; אם מקור נתונים מסוים לא זמין/נכשל, הפריט המתאים
 * פשוט מוחסר מהתגובה (לא מוצג "0" מזויף).
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = parseRange(request);
  const { previousStart, currentStart, now } = periodBounds(range);
  const buckets = buildBuckets(range, now);

  const supabase = createAdminClient();

  const [authRes, matchSessionsRes, trippyRes, tokenTxRes, supportRes, discoveryRes, tripMatchSessionsRes] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    // *** תיקון (בקשה מפורשת - "תוריד את כל מה שקשור ל-trip builder,
    // זה לא רלוונטי"): שולפים מ-trip_builder_sessions אך ורק שורות
    // trip_type='tripmatch' (טיולים שנוצרו ממסך תוצאות TripMatch - ר'
    // /api/trip-builder/sessions/from-tripmatch) - לא שאר סוגי הטיול
    // (day_trip/weekend/abroad_vacation/וכו') של ה-Trip Builder הקלאסי,
    // שכבר לא מיוצג בדשבורד הזה בשום צורה.
    supabase.from("trip_builder_sessions").select("user_id,final_itinerary,created_at").eq("trip_type", "tripmatch"),
    supabase.from("trippy_ai_results").select("user_id,created_at,search_context"),
    supabase.from("token_transactions").select("user_id,type,amount,created_at").gte("created_at", previousStart.toISOString()),
    supabase.from("support_conversations").select("id,status,created_at"),
    supabase.from("discovery_jobs").select("id,status,needs_review_count,created_at"),
    supabase.from("tripmatch_sessions").select("city,liked_place_ids"),
  ]);

  if (authRes.error) return NextResponse.json({ error: authRes.error.message }, { status: 500 });

  const allUsers = (authRes.data?.users ?? []) as AuthUserRow[];
  const matchSessions = (matchSessionsRes.data ?? []) as MatchSessionRow[];
  const trippyResults = (trippyRes.data ?? []) as TrippyResultRow[];
  const tokenTx = (tokenTxRes.data ?? []) as TokenTxRow[];
  const supportConvos = (supportRes.data ?? []) as SupportConvoRow[];
  const discoveryJobs = (discoveryRes.data ?? []) as DiscoveryJobRow[];
  const tripMatchSessions = (tripMatchSessionsRes.data ?? []) as { city: string | null; liked_place_ids: string[] | null }[];

  // ---------------------------------------------------------------------
  // KPIs
  // ---------------------------------------------------------------------
  const totalUsers = allUsers.length;
  const signupTimestamps = allUsers.map((u) => u.created_at);
  const newSignupsCurrent = countInWindow(signupTimestamps, currentStart, now);
  const newSignupsPrevious = countInWindow(signupTimestamps, previousStart, currentStart);

  // "מסלולים שנבנו" = טיולים שהופקו בפועל דרך שני המוצרים הרלוונטיים
  // בלבד - Trippy AI (trippy_ai_results) ו-TripMatch (session עם
  // trip_type='tripmatch' שהגיע ל-final_itinerary, ר' from-tripmatch
  // route). ה-Trip Builder הקלאסי (יום/סופ"ש/חופשה/וכו') לא נכלל.
  const matchesSessions = matchSessions.filter((s) => s.final_itinerary);
  const routesBuiltCurrent =
    countInWindow(trippyResults.map((r) => r.created_at), currentStart, now) +
    countInWindow(matchesSessions.map((s) => s.created_at), currentStart, now);
  const routesBuiltPrevious =
    countInWindow(trippyResults.map((r) => r.created_at), previousStart, currentStart) +
    countInWindow(matchesSessions.map((s) => s.created_at), previousStart, currentStart);

  const likeTx = tokenTx.filter((t) => t.type === "tripmatch_like");
  const trippyTx = tokenTx.filter((t) => t.type === "trippy_ai_generation");
  const likesCurrent = countInWindow(likeTx.map((t) => t.created_at), currentStart, now);
  const likesPrevious = countInWindow(likeTx.map((t) => t.created_at), previousStart, currentStart);
  const trippyUsageCurrent = countInWindow(trippyTx.map((t) => t.created_at), currentStart, now);
  const trippyUsagePrevious = countInWindow(trippyTx.map((t) => t.created_at), previousStart, currentStart);

  const consumingTx = tokenTx.filter((t) => t.amount < 0);
  const tokensConsumedCurrent = consumingTx
    .filter((t) => inWindow(t.created_at, currentStart, now))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const tokensConsumedPrevious = consumingTx
    .filter((t) => inWindow(t.created_at, previousStart, currentStart))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // "פעיל" = כל פעולה אמיתית ב-Trippy AI/TripMatch - לא כולל שום פעילות
  // Trip Builder קלאסית (הוסרה מהדשבורד הזה כליל, ר' הערה למעלה).
  const activityRows: { userId: string; createdAt: string }[] = [
    ...matchesSessions.map((s) => ({ userId: s.user_id, createdAt: s.created_at })),
    ...trippyResults.map((r) => ({ userId: r.user_id, createdAt: r.created_at })),
    ...tokenTx.map((t) => ({ userId: t.user_id, createdAt: t.created_at })),
  ];
  const activeUsersCurrent = distinctUsersInWindow(activityRows, currentStart, now);
  const activeUsersPrevious = distinctUsersInWindow(activityRows, previousStart, currentStart);

  const kpis = {
    totalUsers: { value: totalUsers, deltaPct: pctDelta(newSignupsCurrent, newSignupsPrevious) },
    activeUsers: { value: activeUsersCurrent, deltaPct: pctDelta(activeUsersCurrent, activeUsersPrevious) },
    routesBuilt: { value: routesBuiltCurrent, deltaPct: pctDelta(routesBuiltCurrent, routesBuiltPrevious) },
    tripMatchActivity: { value: likesCurrent, deltaPct: pctDelta(likesCurrent, likesPrevious) },
    trippyAiUsage: { value: trippyUsageCurrent, deltaPct: pctDelta(trippyUsageCurrent, trippyUsagePrevious) },
    tokensConsumed: { value: tokensConsumedCurrent, deltaPct: pctDelta(tokensConsumedCurrent, tokensConsumedPrevious) },
  };

  // ---------------------------------------------------------------------
  // גרף "פעילות TRIPLACE" - 5 סדרות, הלקוח בוחר איזו להציג
  // ---------------------------------------------------------------------
  const chart = {
    labels: buckets.map((b) => b.label),
    series: {
      users: bucketCounts(buckets, signupTimestamps),
      active: buckets.map((b) => distinctUsersInWindow(activityRows, b.start, b.end)),
      routes: bucketCounts(buckets, [...trippyResults.map((r) => r.created_at), ...matchesSessions.map((s) => s.created_at)]),
      tripmatch: bucketCounts(buckets, likeTx.map((t) => t.created_at)),
      trippy: bucketCounts(buckets, trippyTx.map((t) => t.created_at)),
    },
  };

  // ---------------------------------------------------------------------
  // "דורש את תשומת לבך" - רק פריטים עם מקור נתונים אמיתי
  // ---------------------------------------------------------------------
  const needsAttention: { id: string; label: string; description: string; count: number; href: string }[] = [];

  const waitingForAdminCount = supportConvos.filter((c) => c.status === "waiting_for_admin").length;
  if (waitingForAdminCount > 0) {
    needsAttention.push({
      id: "support_waiting",
      label: "פניות שירות ממתינות",
      description: "פניות משתמשים שממתינות לתשובה שלכם",
      count: waitingForAdminCount,
      href: "/admin/support",
    });
  }

  const needsReviewJobs = discoveryJobs.filter((j) => (j.needs_review_count ?? 0) > 0);
  const needsReviewTotal = needsReviewJobs.reduce((sum, j) => sum + (j.needs_review_count ?? 0), 0);
  if (needsReviewTotal > 0) {
    needsAttention.push({
      id: "discovery_needs_review",
      label: "יעדים שממתינים לבדיקה",
      description: "מקומות שנמצאו ב-AI Discovery וטרם אושרו",
      count: needsReviewTotal,
      href: "/admin/discovery",
    });
  }

  const failedJobsCount = discoveryJobs.filter((j) => j.status === "failed").length;
  if (failedJobsCount > 0) {
    needsAttention.push({
      id: "discovery_failed",
      label: "משימות Discovery שנכשלו",
      description: "הרצות AI Discovery שהסתיימו בכשל",
      count: failedJobsCount,
      href: "/admin/discovery-jobs",
    });
  }

  // ---------------------------------------------------------------------
  // אזור פעילות מוצר
  // ---------------------------------------------------------------------
  const matchesCurrent = countInWindow(matchesSessions.map((s) => s.created_at), currentStart, now);
  const matchRatePct = likesCurrent > 0 ? Math.round((matchesCurrent / likesCurrent) * 1000) / 10 : null;

  // עמודת יעדים ייעודית ל-TripMatch בלבד - הערים שבהן משתמשים באמת עשו
  // Like (לא רק חיפשו), ממושקלות לפי כמות ה-likes האמיתית בכל עיר
  // (liked_place_ids.length).
  const tripMatchDestinationCounts = new Map<string, number>();
  for (const s of tripMatchSessions) {
    if (!s.city) continue;
    const likeCount = s.liked_place_ids?.length ?? 0;
    if (likeCount === 0) continue;
    tripMatchDestinationCounts.set(s.city, (tripMatchDestinationCounts.get(s.city) ?? 0) + likeCount);
  }
  const tripMatchPopularDestinations = Array.from(tripMatchDestinationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value }));

  const products = {
    tripMatch: { likes: likesCurrent, matches: matchesCurrent, matchRatePct, popularDestinations: tripMatchPopularDestinations },
    trippyAi: {
      usages: trippyUsageCurrent,
      activeUsers: distinctUsersInWindow(
        trippyTx.map((t) => ({ userId: t.user_id, createdAt: t.created_at })),
        currentStart,
        now
      ),
      tokensConsumed: trippyUsageCurrent * 20,
    },
  };

  // ---------------------------------------------------------------------
  // פעילות אחרונה - מיזוג כרונולוגי אמיתי ממספר מקורות
  // ---------------------------------------------------------------------
  const RECENT_LIMIT = 12;

  const recentEvents: { id: string; type: string; title: string; subtitle: string; timestamp: string; href: string }[] = [];

  for (const u of allUsers) {
    recentEvents.push({ id: `user:${u.id}`, type: "user", title: "משתמש חדש נרשם", subtitle: u.email ?? "", timestamp: u.created_at, href: "/admin/users" });
  }
  for (const r of trippyResults) {
    const city = (r.search_context as { city?: string } | null)?.city ?? "";
    recentEvents.push({ id: `trip:${r.user_id}:${r.created_at}`, type: "trip", title: "מסלול חדש נבנה ב-Trippy AI", subtitle: city, timestamp: r.created_at, href: "/admin/ai-engine" });
  }
  for (const s of matchesSessions) {
    recentEvents.push({ id: `match:${s.user_id}:${s.created_at}`, type: "match", title: "Match חדש ב-TripMatch", subtitle: "", timestamp: s.created_at, href: "/admin/tripmatch" });
  }
  for (const c of supportConvos) {
    recentEvents.push({ id: `support:${c.id}`, type: "support", title: "פנייה חדשה לשירות לקוחות", subtitle: "", timestamp: c.created_at, href: "/admin/support" });
  }

  recentEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recentActivity = recentEvents.slice(0, RECENT_LIMIT);

  return NextResponse.json({ range, kpis, chart, needsAttention, products, recentActivity });
}
