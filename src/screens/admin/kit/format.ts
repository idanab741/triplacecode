const compact = new Intl.NumberFormat("he-IL", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("he-IL");

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return Math.abs(n) >= 10000 ? compact.format(n) : full.format(n);
}

export function fmtPct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function pctOf(part: number, whole: number): number | null {
  return whole ? Math.round((part / whole) * 1000) / 10 : null;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Math.max(0, Date.now() - Date.parse(iso));
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} ד׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} ש׳`;
  const d = Math.floor(h / 24);
  if (d === 1) return "אתמול";
  if (d < 30) return `לפני ${d} ימים`;
  const mo = Math.floor(d / 30);
  return mo <= 1 ? "לפני חודש" : `לפני ${mo} חודשים`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const RANGE_OPTIONS = [
  { value: "7d", label: "7 ימים" },
  { value: "30d", label: "30 יום" },
  { value: "90d", label: "90 יום" },
  { value: "365d", label: "שנה" },
] as const;

export type RangeValue = (typeof RANGE_OPTIONS)[number]["value"];
