import {
  type Db,
  type RangeKey,
  periodFor,
  buildBuckets,
  seriesCount,
  seriesDistinct,
  inCurrent,
  inPrevious,
  pctDelta,
  topCounts,
  dayKey,
  ts,
  TZ,
  DAY,
  countRows,
} from "./core";
import { loadActivity, displayName, ACTIVITY_LABELS, type ActivityEvent, type ActivityKind } from "./activity";
import { TRIP_TYPE_LABELS, PROVIDER_LABELS, label } from "./labels";

export interface Kpi {
  key: string;
  label: string;
  value: number;
  previous: number;
  deltaPct: number | null;
  spark: number[];
  hint: string;
}

const SOCIAL_KINDS: ActivityKind[] = ["post", "comment", "review", "story", "like", "follow", "dm"];
const MEANINGFUL = (e: ActivityEvent) => e.kind !== "seen";

const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23", weekday: "short" });
const WEEKDAY_IDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function hourAndWeekday(iso: string): { hour: number; weekday: number } {
  const parts = hourFmt.formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const weekday = WEEKDAY_IDX[parts.find((p) => p.type === "weekday")?.value ?? "Sun"] ?? 0;
  return { hour, weekday };
}

function distinctUsers(events: ActivityEvent[], from: number, to: number): number {
  const s = new Set<string>();
  for (const e of events) {
    const t = ts(e.at);
    if (t !== null && t >= from && t <= to) s.add(e.userId);
  }
  return s.size;
}

export async function buildOverview(db: Db, range: RangeKey) {
  const p = periodFor(range);
  const b = buildBuckets(p);
  const data = await loadActivity(db);
  const { users, profiles, tripSessions, trippy, tripMatch, tokens, events } = data;

  const registered = users.filter((u) => !u.isAnonymous);
  const registeredIds = new Set(registered.map((u) => u.id));
  const profileById = new Map(profiles.map((x) => [x.id, x]));
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const meaningful = events.filter(MEANINGFUL);
  const social = events.filter((e) => SOCIAL_KINDS.includes(e.kind));
  const tripsBuilt = [
    ...tripSessions.filter((s) => s.status === "completed").map((s) => s.created_at),
    ...trippy.map((r) => r.created_at),
  ];
  const tokenSpend = tokens.filter((t) => t.amount < 0);

  const cur = <T,>(rows: T[], at: (r: T) => string | null | undefined) => rows.filter((r) => inCurrent(p, at(r))).length;
  const prev = <T,>(rows: T[], at: (r: T) => string | null | undefined) => rows.filter((r) => inPrevious(p, at(r))).length;

  const kpi = (key: string, lbl: string, hint: string, value: number, previous: number, spark: number[]): Kpi => ({
    key,
    label: lbl,
    hint,
    value,
    previous,
    deltaPct: pctDelta(value, previous),
    spark,
  });

  const activeCur = distinctUsers(events, p.start, p.now);
  const activePrev = distinctUsers(events, p.prevStart, p.start - 1);

  const kpis: Kpi[] = [
    kpi("signups", "נרשמים חדשים", "משתמשים רשומים (לא אורחים) שנרשמו בתקופה", cur(registered, (u) => u.createdAt), prev(registered, (u) => u.createdAt), seriesCount(b, registered.map((u) => u.createdAt))),
    kpi("active", "משתמשים פעילים", "משתמשים ייחודיים עם כל פעולה/כניסה בתקופה", activeCur, activePrev, seriesDistinct(b, events)),
    kpi("trips", "טיולים שנוצרו", "Trip Builder שהושלם + Trippy AI", tripsBuilt.filter((x) => inCurrent(p, x)).length, tripsBuilt.filter((x) => inPrevious(p, x)).length, seriesCount(b, tripsBuilt)),
    kpi(
      "tripmatch",
      "סשנים ב-TripMatch",
      "סשני החלקה שנפתחו בתקופה",
      cur(tripMatch, (r) => r.created_at),
      prev(tripMatch, (r) => r.created_at),
      seriesCount(b, tripMatch.map((r) => r.created_at))
    ),
    kpi("social", "פעולות קהילה", "פוסטים, תגובות, ביקורות, סטוריז, לייקים, מעקבים והודעות", cur(social, (e) => e.at), prev(social, (e) => e.at), seriesCount(b, social.map((e) => e.at))),
    kpi(
      "tokens",
      "טריפים שנצרכו",
      "סך הטוקנים שחויבו (ללא החזרים)",
      tokenSpend.filter((t) => inCurrent(p, t.created_at)).reduce((s, t) => s - t.amount, 0),
      tokenSpend.filter((t) => inPrevious(p, t.created_at)).reduce((s, t) => s - t.amount, 0),
      seriesCount(b, tokenSpend.map((t) => t.created_at))
    ),
  ];

  // --- stickiness ---
  const now = Date.now();
  const dau = distinctUsers(events, now - DAY, now);
  const wau = distinctUsers(events, now - 7 * DAY, now);
  const mau = distinctUsers(events, now - 30 * DAY, now);

  // --- גרף פעילות ראשי ---
  const chart = {
    labels: b.labels,
    granularity: b.granularity,
    series: [
      { key: "active", label: "משתמשים פעילים", values: seriesDistinct(b, events) },
      { key: "signups", label: "נרשמים חדשים", values: seriesCount(b, registered.map((u) => u.createdAt)) },
      { key: "trips", label: "טיולים שנוצרו", values: seriesCount(b, tripsBuilt) },
      { key: "tripmatch", label: "סשני TripMatch", values: seriesCount(b, tripMatch.map((r) => r.created_at)) },
      { key: "social", label: "פעולות קהילה", values: seriesCount(b, social.map((e) => e.at)) },
    ],
  };

  // --- משפך הפעלה (כל הזמנים, משתמשים רשומים) ---
  const onboarded = new Set(profiles.filter((x) => x.main_onboarding_completed_at && registeredIds.has(x.id)).map((x) => x.id));
  const creators = new Set<string>([
    ...tripSessions.map((s) => s.user_id),
    ...trippy.map((r) => r.user_id),
    ...tripMatch.map((r) => r.user_id),
  ]);
  const activeDays = new Map<string, Set<string>>();
  for (const e of events) {
    if (!registeredIds.has(e.userId)) continue;
    const set = activeDays.get(e.userId) ?? new Set<string>();
    set.add(dayKey(e.at));
    activeDays.set(e.userId, set);
  }
  const returning = new Set([...activeDays.entries()].filter(([, s]) => s.size >= 2).map(([id]) => id));
  const socialUsers = new Set(social.map((e) => e.userId));
  // משפך מקונן: כל שלב סופר רק משתמשים שעברו גם את כל השלבים הקודמים
  const stepDefs: { key: string; label: string; test: (id: string) => boolean }[] = [
    { key: "registered", label: "נרשמו", test: () => true },
    { key: "onboarded", label: "השלימו אונבורדינג", test: (id) => onboarded.has(id) },
    { key: "created", label: "יצרו טיול / TripMatch", test: (id) => creators.has(id) },
    { key: "returning", label: "חזרו ביותר מיום אחד", test: (id) => returning.has(id) },
    { key: "social", label: "פעילים בקהילה", test: (id) => socialUsers.has(id) },
  ];
  let remaining = [...registeredIds];
  const funnel = stepDefs.map((step) => {
    remaining = remaining.filter(step.test);
    return { key: step.key, label: step.label, value: remaining.length };
  });

  // --- מקורות הרשמה ---
  const providers = topCounts(users.map((u) => u.provider), 10).map((x) => ({ ...x, label: label(PROVIDER_LABELS, x.label) }));

  // --- תמהיל מוצר בתקופה ---
  const productMix = topCounts(
    [
      ...tripSessions.filter((s) => inCurrent(p, s.created_at)).map((s) => s.trip_type),
      ...trippy.filter((r) => inCurrent(p, r.created_at)).map(() => "trippy"),
    ],
    12
  ).map((x) => ({ ...x, label: label(TRIP_TYPE_LABELS, x.label) }));

  // --- ערים מבוקשות ---
  const topCities = topCounts(
    [...tripMatch.filter((r) => inCurrent(p, r.created_at)).map((r) => r.city), ...trippy.filter((r) => inCurrent(p, r.created_at)).map((r) => r.city)],
    8
  );

  // --- פעילות לפי סוג ---
  const byKind = topCounts(meaningful.filter((e) => inCurrent(p, e.at)).map((e) => e.kind), 20).map((x) => ({
    key: x.label,
    label: ACTIVITY_LABELS[x.label as ActivityKind] ?? x.label,
    value: x.value,
  }));

  // --- מפת חום: יום בשבוע × שעה (שעון ישראל) ---
  const heatmap = Array.from({ length: 7 }, () => new Array(24).fill(0) as number[]);
  for (const e of meaningful) {
    if (!inCurrent(p, e.at)) continue;
    const { hour, weekday } = hourAndWeekday(e.at);
    heatmap[weekday][hour] += 1;
  }

  // --- קוהורטות שימור שבועיות (8 שבועות אחרונים) ---
  const WEEKS = 8;
  const cohortStart = now - WEEKS * 7 * DAY;
  const eventsByUser = new Map<string, number[]>();
  for (const e of events) {
    const t = ts(e.at);
    if (t === null) continue;
    const list = eventsByUser.get(e.userId) ?? [];
    list.push(t);
    eventsByUser.set(e.userId, list);
  }
  const cohorts: { label: string; size: number; retention: (number | null)[] }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const from = cohortStart + w * 7 * DAY;
    const to = from + 7 * DAY;
    const members = registered.filter((u) => {
      const t = ts(u.createdAt);
      return t !== null && t >= from && t < to;
    });
    const retention: (number | null)[] = [];
    for (let k = 0; k < WEEKS - w; k++) {
      if (members.length === 0) {
        retention.push(null);
        continue;
      }
      const winFrom = from + k * 7 * DAY;
      const winTo = winFrom + 7 * DAY;
      const retained = members.filter((u) => {
        const signup = ts(u.createdAt) ?? 0;
        return (eventsByUser.get(u.id) ?? []).some((t) => t >= Math.max(winFrom, k === 0 ? signup + 60 * 60 * 1000 : winFrom) && t < winTo);
      }).length;
      retention.push(Math.round((retained / members.length) * 100));
    }
    const d = new Date(from);
    cohorts.push({ label: `${d.getUTCDate()}.${d.getUTCMonth() + 1}`, size: members.length, retention });
  }

  // --- המשתמשים הפעילים ביותר בתקופה ---
  const perUser = new Map<string, number>();
  for (const e of meaningful) if (inCurrent(p, e.at)) perUser.set(e.userId, (perUser.get(e.userId) ?? 0) + 1);
  const topUsers = [...perUser.entries()]
    .sort((a, c) => c[1] - a[1])
    .slice(0, 8)
    .map(([id, value]) => ({
      id,
      name: displayName(profileById.get(id), emailById.get(id)),
      avatarUrl: profileById.get(id)?.avatar_url ?? null,
      value,
    }));

  // --- פיד פעילות חי ---
  const feed = [
    ...registered.map((u) => ({ userId: u.id, at: u.createdAt, kind: "signup" as const })),
    ...meaningful.filter((e) => e.kind !== "token"),
  ]
    .sort((a, c) => (ts(c.at) ?? 0) - (ts(a.at) ?? 0))
    .slice(0, 25)
    .map((e, i) => ({
      id: `${e.kind}:${e.userId}:${i}`,
      kind: e.kind,
      label: e.kind === "signup" ? "הצטרף/ה ל-TRIPLACE" : ACTIVITY_LABELS[e.kind],
      userId: e.userId,
      userName: displayName(profileById.get(e.userId), emailById.get(e.userId)),
      avatarUrl: profileById.get(e.userId)?.avatar_url ?? null,
      at: e.at,
    }));

  // --- דורש טיפול ---
  const [supportWaiting, placeSubs, tripaddSubs, jobsFailed, jobsStuck] = await Promise.all([
    countRows(db, "support_conversations", (q) => q.eq("status", "waiting_for_admin")),
    countRows(db, "place_submissions", (q) => q.eq("status", "pending")),
    countRows(db, "tripadd_submissions", (q) => q.eq("status", "pending")),
    countRows(db, "discovery_jobs", (q) => q.eq("status", "failed")),
    countRows(db, "discovery_jobs", (q) => q.in("status", ["pending", "running"]).lt("created_at", new Date(now - 2 * 60 * 60 * 1000).toISOString())),
  ]);
  const attention = [
    { id: "support", label: "פניות שירות ממתינות לתשובה", count: supportWaiting ?? 0, href: "/admin/support", tone: "danger" as const },
    { id: "place_submissions", label: "הצעות מקומות ממשתמשים", count: placeSubs ?? 0, href: "/admin/community#submissions", tone: "warning" as const },
    { id: "tripadd", label: "TripAdd ממתינים לאישור", count: tripaddSubs ?? 0, href: "/admin/community#submissions", tone: "warning" as const },
    { id: "jobs_stuck", label: "משימות Discovery תקועות", count: jobsStuck ?? 0, href: "/admin/health", tone: "danger" as const },
    { id: "jobs_failed", label: "משימות Discovery שנכשלו", count: jobsFailed ?? 0, href: "/admin/discovery", tone: "neutral" as const },
  ].filter((x) => x.count > 0);

  return {
    range,
    generatedAt: new Date().toISOString(),
    totals: {
      registered: registered.length,
      guests: users.length - registered.length,
      newThisPeriod: kpis[0].value,
    },
    kpis,
    stickiness: { dau, wau, mau, dauMauPct: mau ? Math.round((dau / mau) * 1000) / 10 : null },
    chart,
    funnel,
    providers,
    productMix,
    topCities,
    byKind,
    heatmap,
    cohorts,
    topUsers,
    feed,
    attention,
    warnings: data.errors,
  };
}

export type OverviewData = Awaited<ReturnType<typeof buildOverview>>;
