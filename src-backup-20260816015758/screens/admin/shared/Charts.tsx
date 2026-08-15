"use client";

import { useState } from "react";

interface Series {
  label: string;
  color: string;
  values: number[];
}

/** גרף קו אינטראקטיבי (Hover לפרטים), בנוי SVG טהור - בלי תלות בספריית
 *  גרפים חיצונית (לא ידוע אם מותקנת בפרויקט). תומך בכמה סדרות במקביל. */
export function LineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: Series[];
  height?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 640;
  const padding = { top: 16, right: 12, bottom: 28, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(...allValues, 1) * 1.15;
  const min = Math.min(0, ...allValues);

  const xFor = (i: number) => padding.left + (i / (labels.length - 1)) * innerW;
  const yFor = (v: number) => padding.top + innerH - ((v - min) / (max - min)) * innerH;

  function pathFor(values: number[]) {
    return values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
  }
  function areaFor(values: number[]) {
    const line = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
    return `${line} L ${xFor(values.length - 1)} ${padding.top + innerH} L ${xFor(0)} ${padding.top + innerH} Z`;
  }

  return (
    <div className="relative w-full" onMouseLeave={() => setHoverIdx(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: "block" }}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerH * f}
            y2={padding.top + innerH * f}
            stroke="var(--admin-border)"
            strokeWidth={1}
          />
        ))}

        {series.map((s) => (
          <path key={s.label + "-area"} d={areaFor(s.values)} fill={s.color} opacity={0.08} />
        ))}
        {series.map((s) => (
          <path key={s.label + "-line"} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {hoverIdx !== null && (
          <line x1={xFor(hoverIdx)} x2={xFor(hoverIdx)} y1={padding.top} y2={padding.top + innerH} stroke="var(--admin-border-strong)" strokeWidth={1} strokeDasharray="3 3" />
        )}
        {series.map((s) =>
          hoverIdx !== null ? (
            <circle key={s.label + "-dot"} cx={xFor(hoverIdx)} cy={yFor(s.values[hoverIdx])} r={3.5} fill={s.color} stroke="var(--admin-bg-surface)" strokeWidth={2} />
          ) : null
        )}

        {labels.map((_, i) => (
          <rect
            key={i}
            x={xFor(i) - innerW / labels.length / 2}
            y={0}
            width={innerW / labels.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHoverIdx(i)}
            style={{ cursor: "crosshair" }}
          />
        ))}

        {labels.map((l, i) =>
          i % Math.ceil(labels.length / 7) === 0 ? (
            <text key={l} x={xFor(i)} y={height - 6} textAnchor="middle" fontSize={10.5} fill="var(--admin-ink-faint)" className="admin-mono">
              {l}
            </text>
          ) : null
        )}
      </svg>

      {hoverIdx !== null && (
        <div
          className="admin-mono pointer-events-none absolute top-1 z-10 flex flex-col gap-1 rounded-[var(--admin-radius-sm)] border px-2.5 py-2 text-[11.5px]"
          style={{
            left: `${(xFor(hoverIdx) / width) * 100}%`,
            transform: "translateX(-50%)",
            background: "var(--admin-bg-surface)",
            borderColor: "var(--admin-border)",
            boxShadow: "var(--admin-shadow-md)",
          }}
        >
          <span style={{ color: "var(--admin-ink-faint)" }}>{labels[hoverIdx]}</span>
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5" style={{ color: "var(--admin-ink)" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
              {s.label}: {s.values[hoverIdx].toLocaleString()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** גרף עמודות אופקי - למשל "יעדים מובילים", "ערים מובילות". */
export function HorizontalBarChart({ data, color = "var(--admin-chart-1)" }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-[12.5px]" style={{ color: "var(--admin-ink-secondary)" }}>
            {d.label}
          </span>
          <div className="h-6 flex-1 overflow-hidden rounded-[var(--admin-radius-sm)]" style={{ background: "var(--admin-bg-sunken)" }}>
            <div
              className="admin-fade-in h-full rounded-[var(--admin-radius-sm)]"
              style={{ width: `${(d.value / max) * 100}%`, background: color }}
            />
          </div>
          <span className="admin-mono w-14 shrink-0 text-left text-[12.5px] font-medium" style={{ color: "var(--admin-ink)" }}>
            {d.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}
