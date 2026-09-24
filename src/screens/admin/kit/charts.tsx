"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmt } from "./format";

/** סדר צבעים קטגורי קבוע (מאומת ל-CVD) - צבע נקבע לפי זהות הסדרה, לא לפי דירוג. */
export const SERIES_COLORS = ["var(--admin-chart-1)", "var(--admin-chart-2)", "var(--admin-chart-3)", "var(--admin-chart-4)", "var(--admin-chart-5)"];
const SEQ = ["var(--admin-seq-0)", "var(--admin-seq-1)", "var(--admin-seq-2)", "var(--admin-seq-3)", "var(--admin-seq-4)", "var(--admin-seq-5)", "var(--admin-seq-6)"];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** ציר עם 4 מרווחים עגולים (1/2/5 × 10^n) - תוויות נקיות כמו 0/25/50/75/100. */
function niceScale(v: number): { max: number; step: number } {
  const raw = Math.max(1, v) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow);
  const rounded = step < 1 ? 1 : Number.isInteger(step) ? step : Math.ceil(step);
  return { max: rounded * 4, step: rounded };
}

function niceMax(v: number): number {
  return niceScale(v).max;
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const TW = 180;
  const left = Math.min(Math.max(x - TW / 2, 0), Math.max(0, width - TW));
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-[var(--admin-radius-sm)] border px-3 py-2 text-[12px]"
      dir="rtl"
      style={{ left, top: Math.max(0, y), width: TW, background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", boxShadow: "var(--admin-shadow-md)", color: "var(--admin-ink)" }}
    >
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--admin-ink-secondary)" }}>
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
          {it.value !== undefined && (
            <span className="admin-num font-semibold" style={{ color: "var(--admin-ink)" }}>
              {it.value}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function Sparkline({ values, label, width = 96, height = 32 }: { values: number[]; label: string; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const pad = 4;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const last = values.length - 1;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`מגמה: ${label}`} style={{ direction: "ltr", flexShrink: 0 }}>
      <path d={`${d} L${x(last)} ${height - pad} L${x(0)} ${height - pad} Z`} fill="var(--admin-chart-1)" opacity={0.1} />
      <path d={d} fill="none" stroke="var(--admin-ink-faint)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(last)} cy={y(values[last] ?? 0)} r={3} fill="var(--admin-chart-1)" stroke="var(--admin-bg-surface)" strokeWidth={1.5} />
    </svg>
  );
}

export interface TrendSeries {
  key: string;
  label: string;
  values: number[];
  color?: string;
}

/** גרף מגמה: קווים 2px + מילוי עדין, קו-כוונת ו-tooltip עם כל הסדרות. ציר אחד בלבד. */
export function TrendChart({ labels, series, height = 260, showLegend = true }: { labels: string[]; series: TrendSeries[]; height?: number; showLegend?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }));
  const pad = { top: 12, right: 12, bottom: 26, left: 40 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const { max, step } = niceScale(Math.max(1, ...colored.flatMap((s) => s.values)));
  const n = labels.length;
  const x = (i: number) => pad.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 64))));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const rel = e.clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round((rel / rect.width) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  return (
    <div className="flex flex-col gap-3">
      {showLegend && colored.length > 1 && <Legend items={colored.map((s) => ({ label: s.label, color: s.color }))} />}
      <div ref={ref} className="relative w-full" style={{ height, direction: "ltr" }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={colored.map((s) => s.label).join(", ")}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--admin-grid)" strokeWidth={1} />
                <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--admin-ink-faint)" className="admin-num">
                  {fmt(t)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--admin-ink-faint)">
                  {l}
                </text>
              ) : null
            )}
            {colored.map((s) => {
              const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
              return (
                <g key={s.key}>
                  {colored.length <= 2 && <path d={`${d} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={s.color} opacity={0.1} />}
                  <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                </g>
              );
            })}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--admin-border-strong)" strokeWidth={1} />
                {colored.map((s) => (
                  <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="var(--admin-bg-surface)" strokeWidth={2} />
                ))}
              </g>
            )}
            <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}
        {hover !== null && width > 0 && (
          <Tooltip x={x(hover)} y={4} width={width}>
            <div className="mb-1 font-semibold">{labels[hover]}</div>
            {colored.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2 py-0.5">
                <span className="inline-flex items-center gap-1.5" style={{ color: "var(--admin-ink-secondary)" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="admin-num font-semibold">{fmt(s.values[hover] ?? 0)}</span>
              </div>
            ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/** עמודות אנכיות לסדרה אחת, עם tooltip וערך על העמודה המסומנת. */
export function ColumnChart({ labels, values, height = 200, color = "var(--admin-chart-1)", valueLabel = "" }: { labels: string[]; values: number[]; height?: number; color?: string; valueLabel?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { top: 18, bottom: 24, left: 8, right: 8 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const n = Math.max(1, values.length);
  const slot = innerW / n;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const max = niceMax(Math.max(1, ...values));
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 56))));
  const r = Math.min(4, barW / 2);
  return (
    <div ref={ref} className="relative w-full" style={{ height, direction: "ltr" }} onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={valueLabel}>
          <line x1={pad.left} x2={width - pad.right} y1={pad.top + innerH} y2={pad.top + innerH} stroke="var(--admin-grid)" />
          {values.map((v, i) => {
            const h = (v / max) * innerH;
            const bx = pad.left + i * slot + (slot - barW) / 2;
            const by = pad.top + innerH - h;
            const d =
              h <= 0
                ? ""
                : `M${bx} ${pad.top + innerH} L${bx} ${by + Math.min(r, h)} Q${bx} ${by} ${bx + r} ${by} L${bx + barW - r} ${by} Q${bx + barW} ${by} ${bx + barW} ${by + Math.min(r, h)} L${bx + barW} ${pad.top + innerH} Z`;
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" />
                {d && <path d={d} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />}
                {hover === i && (
                  <text x={bx + barW / 2} y={by - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--admin-ink)">
                    {fmt(v)}
                  </text>
                )}
              </g>
            );
          })}
          {labels.map((l, i) =>
            i % labelEvery === 0 ? (
              <text key={i} x={pad.left + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--admin-ink-faint)">
                {l}
              </text>
            ) : null
          )}
        </svg>
      )}
    </div>
  );
}

/** רשימת פסים אופקיים - לדירוגים (ערים, מקורות, קטגוריות). הערך מוצג תמיד. */
export function BarList({
  items,
  color = "var(--admin-chart-1)",
  max: maxProp,
  emptyText = "אין נתונים בתקופה",
  suffix,
}: {
  items: { label: string; value: number; href?: string; sub?: ReactNode; color?: string }[];
  color?: string;
  max?: number;
  emptyText?: string;
  suffix?: string;
}) {
  if (!items.length) {
    return (
      <p className="py-6 text-center text-[13px]" style={{ color: "var(--admin-ink-faint)" }}>
        {emptyText}
      </p>
    );
  }
  const max = maxProp ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((it) => {
        const row = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate" style={{ color: "var(--admin-ink)" }} title={it.label}>
                {it.label}
                {it.sub && (
                  <span className="mr-1.5 text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                    {it.sub}
                  </span>
                )}
              </span>
              <span className="admin-num shrink-0 font-semibold" style={{ color: "var(--admin-ink)" }}>
                {fmt(it.value)}
                {suffix}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--admin-bg-sunken)" }}>
              <div className="h-full rounded-full" style={{ width: `${it.value > 0 ? Math.max(2, (it.value / max) * 100) : 0}%`, background: it.color ?? color }} />
            </div>
          </>
        );
        return (
          <li key={it.label}>
            {it.href ? (
              <Link href={it.href} className="block rounded-[6px] transition hover:opacity-80">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** משפך: כל שלב כאחוז מהשלב הראשון + שיעור המעבר מהשלב הקודם. */
export function Funnel({ steps }: { steps: { key: string; label: string; value: number }[] }) {
  const first = steps[0]?.value || 1;
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / first) * 100);
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <span style={{ color: "var(--admin-ink)" }}>
                <span className="admin-num ml-2 text-[11px]" style={{ color: "var(--admin-ink-faint)" }}>
                  {i + 1}
                </span>
                {s.label}
              </span>
              <span className="flex items-baseline gap-2">
                {conv !== null && (
                  <span className="text-[11.5px]" style={{ color: "var(--admin-ink-faint)" }}>
                    {conv}% מהשלב הקודם
                  </span>
                )}
                <span className="admin-num font-semibold">{fmt(s.value)}</span>
              </span>
            </div>
            <div className="h-7 w-full overflow-hidden rounded-[6px]" style={{ background: "var(--admin-bg-sunken)" }}>
              <div
                className="flex h-full items-center justify-end rounded-[6px] px-2 text-[11.5px] font-semibold text-white transition-[width] duration-500"
                style={{ width: `${Math.max(pct, 3)}%`, background: "var(--admin-chart-1)", opacity: 1 - i * 0.12 }}
              >
                {pct >= 12 ? `${pct}%` : ""}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

/** מפת חום יום×שעה - רמפה רציפה אחת (כחול), tooltip לכל תא. */
export function Heatmap({ grid }: { grid: number[][] }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...grid.flat());
  const step = (v: number) => (v === 0 ? 0 : Math.min(6, 1 + Math.floor((v / max) * 5.999)));
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: "28px repeat(24, minmax(0, 1fr))", direction: "ltr" }}>
        {grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="flex items-center justify-end pr-1.5 text-[11px]" style={{ color: "var(--admin-ink-faint)" }}>
              {WEEKDAYS[d]}
            </span>
            {row.map((v, h) => (
              <span
                key={h}
                onPointerEnter={() => setHover({ d, h })}
                onPointerLeave={() => setHover(null)}
                className="aspect-square rounded-[3px]"
                style={{ background: SEQ[step(v)], outline: hover?.d === d && hover?.h === h ? "2px solid var(--admin-ink)" : "none" }}
                title={`יום ${WEEKDAYS[d]} ${h}:00 — ${v} פעולות`}
              />
            ))}
          </div>
        ))}
        <span />
        {Array.from({ length: 24 }).map((_, h) => (
          <span key={h} className="text-center text-[10px]" style={{ color: "var(--admin-ink-faint)" }}>
            {h % 3 === 0 ? h : ""}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
        <span>{hover ? `יום ${WEEKDAYS[hover.d]}, ${hover.h}:00–${hover.h + 1}:00 · ${fmt(grid[hover.d][hover.h])} פעולות` : "שעון ישראל · רחפו על תא לפרטים"}</span>
        <span className="flex items-center gap-1" style={{ direction: "ltr" }}>
          <span>פחות</span>
          {SEQ.slice(1).map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />
          ))}
          <span>יותר</span>
        </span>
      </div>
    </div>
  );
}

/** טבלת קוהורטות שימור שבועיות. */
export function CohortTable({ cohorts }: { cohorts: { label: string; size: number; retention: (number | null)[] }[] }) {
  const weeks = Math.max(0, ...cohorts.map((c) => c.retention.length));
  const shade = (v: number) => SEQ[Math.min(6, Math.max(1, Math.ceil(v / 17)))];
  return (
    <div className="admin-scrollbar overflow-x-auto">
      <table className="w-full border-separate text-[12px]" style={{ borderSpacing: 2 }}>
        <thead>
          <tr style={{ color: "var(--admin-ink-faint)" }}>
            <th className="px-2 py-1 font-medium">שבוע הרשמה</th>
            <th className="px-2 py-1 font-medium">נרשמו</th>
            {Array.from({ length: weeks }).map((_, i) => (
              <th key={i} className="px-2 py-1 text-center font-medium">
                {i === 0 ? "שבוע 0" : `+${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.label}>
              <td className="whitespace-nowrap px-2 py-1.5" style={{ color: "var(--admin-ink-secondary)" }}>
                {c.label}
              </td>
              <td className="admin-num px-2 py-1.5 font-semibold">{c.size}</td>
              {Array.from({ length: weeks }).map((_, i) => {
                const v = c.retention[i];
                if (v === undefined) return <td key={i} />;
                if (v === null)
                  return (
                    <td key={i} className="rounded-[4px] text-center" style={{ background: "var(--admin-bg-sunken)", color: "var(--admin-ink-faint)" }}>
                      —
                    </td>
                  );
                return (
                  <td key={i} className="admin-num rounded-[4px] px-2 py-1.5 text-center font-medium" style={{ background: shade(v), color: v >= 50 ? "#fff" : "var(--admin-ink)" }} title={`${v}% מהקוהורטה היו פעילים`}>
                    {v}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** פס הרכב יחיד (100%) - עד 5 חלקים, השאר מקופל ל"אחר". */
export function StackedBar({ parts }: { parts: { label: string; value: number }[] }) {
  const sorted = [...parts].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, 4);
  const rest = sorted.slice(4).reduce((s, p) => s + p.value, 0);
  const all = rest > 0 ? [...head, { label: "אחר", value: rest }] : head;
  const total = all.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {all.map((p, i) => (
          <div key={p.label} title={`${p.label}: ${fmt(p.value)}`} style={{ width: `${(p.value / total) * 100}%`, background: SERIES_COLORS[i] }} />
        ))}
      </div>
      <Legend items={all.map((p, i) => ({ label: p.label, color: SERIES_COLORS[i], value: `${Math.round((p.value / total) * 100)}%` }))} />
    </div>
  );
}
