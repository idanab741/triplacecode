import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** בדיקת הרשאת אדמין אחידה לכל ה-API החדש. מחזיר Response אם אין הרשאה,
 *  אחרת null - כך שכל route פותח ב-`const denied = requireAdmin(req); if (denied) return denied;` */
export function requireAdmin(request: Request): NextResponse | null {
  const secret = request.headers.get("x-admin-secret");
  const expected = process.env.ADMIN_API_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_API_SECRET לא מוגדר בשרת" }, { status: 500 });
  }
  if (!secret || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export type Db = SupabaseClient;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Supabase מחזיר עד 1000 שורות לשאילתה - כאן שולפים הכל בעמודים.
 *  `build(from, to)` חייב להחזיר שאילתה עם `.range(from, to)` ו-order יציב. */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<PageResult<T>>, pageSize = 1000, maxRows = 50000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

/** שאילתה שנכשלת (טבלה חסרה וכו') לא מפילה את כל הדשבורד - מחזירה [] ורושמת את השגיאה. */
export async function safeFetchAll<T>(label: string, errors: string[], build: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  try {
    return await fetchAll(build);
  } catch (err) {
    errors.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export async function countRows(db: Db, table: string, apply?: (q: ReturnType<ReturnType<Db["from"]>["select"]>) => unknown): Promise<number | null> {
  let q = db.from(table).select("*", { count: "exact", head: true });
  if (apply) q = apply(q) as typeof q;
  const { count, error } = await q;
  if (error) return null;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// זמן - כל החלוקה לימים/שבועות/חודשים נעשית לפי שעון ישראל, לא UTC
// ---------------------------------------------------------------------------

export const TZ = "Asia/Jerusalem";
const DAY = 86400000;
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** YYYY-MM-DD לפי שעון ישראל */
export function dayKey(input: string | number | Date): string {
  return dayFormatter.format(new Date(input));
}

export type RangeKey = "7d" | "30d" | "90d" | "365d";
export const RANGE_DAYS: Record<RangeKey, number> = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

export function parseRange(request: Request, fallback: RangeKey = "30d"): RangeKey {
  const v = new URL(request.url).searchParams.get("range");
  return v === "7d" || v === "30d" || v === "90d" || v === "365d" ? v : fallback;
}

export interface Period {
  range: RangeKey;
  days: number;
  now: number;
  start: number;
  prevStart: number;
}

export function periodFor(range: RangeKey, now = Date.now()): Period {
  const days = RANGE_DAYS[range];
  return { range, days, now, start: now - days * DAY, prevStart: now - 2 * days * DAY };
}

export function ts(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

export function inCurrent(p: Period, iso: string | null | undefined): boolean {
  const t = ts(iso);
  return t !== null && t >= p.start && t <= p.now;
}

export function inPrevious(p: Period, iso: string | null | undefined): boolean {
  const t = ts(iso);
  return t !== null && t >= p.prevStart && t < p.start;
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type Granularity = "day" | "week" | "month";

function weekKeyOf(day: string): string {
  // שבוע מתחיל ביום ראשון (כמו בישראל)
  const d = new Date(`${day}T12:00:00Z`);
  const back = d.getUTCDay();
  return new Date(d.getTime() - back * DAY).toISOString().slice(0, 10);
}

const MONTHS_HE = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];

export interface Buckets {
  granularity: Granularity;
  keys: string[];
  labels: string[];
  keyOf: (iso: string | null | undefined) => string | null;
}

/** בונה את ציר הזמן לגרפים לפי הטווח: יומי עד 30 יום, שבועי ל-90, חודשי לשנה. */
export function buildBuckets(p: Period): Buckets {
  const granularity: Granularity = p.days <= 31 ? "day" : p.days <= 120 ? "week" : "month";
  const toKey = (day: string) => (granularity === "day" ? day : granularity === "week" ? weekKeyOf(day) : day.slice(0, 7));
  const keys: string[] = [];
  for (let t = p.start + DAY; t <= p.now + 1; t += DAY) {
    const k = toKey(dayKey(t));
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  const lastKey = toKey(dayKey(p.now));
  if (keys[keys.length - 1] !== lastKey) keys.push(lastKey);
  const labels = keys.map((k) => {
    if (granularity === "month") return `${MONTHS_HE[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`;
    const [, m, d] = k.split("-");
    return `${Number(d)}.${Number(m)}`;
  });
  const startKey = keys[0];
  return {
    granularity,
    keys,
    labels,
    keyOf: (iso) => {
      const t = ts(iso);
      if (t === null || t < p.start || t > p.now) return null;
      const k = toKey(dayKey(t));
      return k < startKey ? startKey : k;
    },
  };
}

export function seriesCount(b: Buckets, items: (string | null | undefined)[]): number[] {
  const idx = new Map(b.keys.map((k, i) => [k, i]));
  const out = new Array(b.keys.length).fill(0);
  for (const iso of items) {
    const k = b.keyOf(iso);
    if (k === null) continue;
    const i = idx.get(k);
    if (i !== undefined) out[i] += 1;
  }
  return out;
}

export function seriesDistinct(b: Buckets, items: { userId: string; at: string }[]): number[] {
  const idx = new Map(b.keys.map((k, i) => [k, i]));
  const sets = b.keys.map(() => new Set<string>());
  for (const e of items) {
    const k = b.keyOf(e.at);
    if (k === null) continue;
    const i = idx.get(k);
    if (i !== undefined) sets[i].add(e.userId);
  }
  return sets.map((s) => s.size);
}

export function topCounts(values: (string | null | undefined)[], limit = 8): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const key = (v ?? "").trim();
    if (!key) continue;
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

export const sinceIso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
export { DAY };
