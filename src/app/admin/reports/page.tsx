"use client";

import { useMemo, useState } from "react";
import type { ReportsData, Report, ReportColumn, Cell } from "@/services/admin/insights/reports";
import { useAdminData, useStoredRange } from "@/screens/admin/kit/useAdminData";
import { fmt } from "@/screens/admin/kit/format";
import { PageHeader, Card, Segmented, Button, Pill, LoadingGrid, ErrorBanner, UpdatedAt, Empty } from "@/screens/admin/kit/ui";
import { Icon, type IconName } from "@/screens/admin/kit/Icon";
import { reportToCsv, reportsToXlsx, downloadBlob, XLSX_MIME, fileStamp } from "@/screens/admin/reports/exporters";

const RANGES = [
  { value: "all", label: "כל הזמנים" },
  { value: "365d", label: "שנה" },
  { value: "90d", label: "90 יום" },
  { value: "30d", label: "30 יום" },
  { value: "7d", label: "7 ימים" },
] as const;
type RangeValue = (typeof RANGES)[number]["value"];

const GROUPS: { value: Report["group"] | "all"; label: string; icon: IconName }[] = [
  { value: "all", label: "הכל", icon: "layers" },
  { value: "places", label: "מקומות אהובים", icon: "heart" },
  { value: "destinations", label: "יעדים", icon: "globe" },
  { value: "choices", label: "בחירות המשתמשים", icon: "sliders" },
  { value: "users", label: "משתמשים", icon: "users" },
  { value: "activity", label: "פעילות", icon: "pulse" },
];

/** עמודה ראשונה שמקבצת שורות (שאלה / פילוח / סוג) - מוצגת ככותרת קבוצה */
const GROUP_KEYS = new Set(["question", "dimension", "type", "kind"]);
const PREVIEW_ROWS = 10;

function formatCell(v: Cell, type: ReportColumn["type"]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "percent" && typeof v === "number") return `${v}%`;
  if (type === "number" && typeof v === "number") return fmt(v);
  if (type === "date" && typeof v === "string") {
    const [y, m, d] = v.split("-");
    return d ? `${Number(d)}.${Number(m)}.${y}` : v;
  }
  return String(v);
}

function ReportCard({ report, rangeLabel, generatedAt }: { report: Report; rangeLabel: string; generatedAt: string }) {
  const [expanded, setExpanded] = useState(false);
  const groupKey = GROUP_KEYS.has(report.columns[0]?.key) ? report.columns[0].key : null;
  const visibleColumns = groupKey ? report.columns.slice(1) : report.columns;
  const rows = expanded ? report.rows : report.rows.slice(0, PREVIEW_ROWS);

  // פס יחסי: בקבוצות - ביחס למקסימום בתוך הקבוצה
  const maxByGroup = useMemo(() => {
    const m = new Map<string, number>();
    if (!report.barKey) return m;
    for (const r of report.rows) {
      const g = groupKey ? String(r[groupKey] ?? "") : "";
      const v = Number(r[report.barKey] ?? 0);
      m.set(g, Math.max(m.get(g) ?? 0, v));
    }
    return m;
  }, [report, groupKey]);

  const exportName = `triplace-${report.id}-${fileStamp()}`;

  return (
    <Card padded={false} id={report.id}>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-semibold">{report.title}</h2>
            <Pill>{fmt(report.rows.length)} שורות</Pill>
            {!report.usesRange && <Pill tone="accent">מצב נוכחי</Pill>}
          </div>
          <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--admin-ink-secondary)" }}>
            {report.description}
          </p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" icon="download" disabled={!report.rows.length} onClick={() => downloadBlob(reportToCsv(report), `${exportName}.csv`, "text/csv;charset=utf-8")}>
            CSV
          </Button>
          <Button
            size="sm"
            icon="table"
            disabled={!report.rows.length}
            onClick={() => downloadBlob(reportsToXlsx([report], { rangeLabel: report.usesRange ? rangeLabel : "מצב נוכחי", generatedAt }), `${exportName}.xlsx`, XLSX_MIME)}
          >
            Excel
          </Button>
        </div>
      </div>

      {report.rows.length === 0 ? (
        <Empty text="אין נתונים בטווח שנבחר" />
      ) : (
        <>
          <div className={`admin-scrollbar overflow-x-auto ${expanded ? "max-h-[560px] overflow-y-auto" : ""}`}>
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead className="sticky top-0 z-[1]" style={{ background: "var(--admin-bg-surface)" }}>
                <tr style={{ color: "var(--admin-ink-faint)" }}>
                  {visibleColumns.map((c) => (
                    <th key={c.key} className={`whitespace-nowrap border-b px-3 py-2 font-medium ${c.type === "text" ? "" : "text-left"}`} style={{ borderColor: "var(--admin-border)" }}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const g = groupKey ? String(r[groupKey] ?? "") : null;
                  const startsGroup = groupKey !== null && (i === 0 || String(rows[i - 1][groupKey] ?? "") !== g);
                  const header =
                    startsGroup ? (
                      <tr key={`g-${i}`}>
                        <td colSpan={visibleColumns.length} className="px-3 pb-1.5 pt-3 text-[12.5px] font-semibold" style={{ color: "var(--admin-accent)" }}>
                          {g}
                        </td>
                      </tr>
                    ) : null;
                  const max = maxByGroup.get(g ?? "") || 1;
                  return [
                    header,
                    <tr key={i} className="transition hover:bg-[var(--admin-bg-surface-hover)]">
                      {visibleColumns.map((c) => {
                        const v = r[c.key] ?? null;
                        const isBar = c.key === report.barKey && typeof v === "number";
                        return (
                          <td
                            key={c.key}
                            className={`border-b px-3 py-2 ${c.type === "text" ? "max-w-[280px] truncate" : "admin-num whitespace-nowrap text-left"}`}
                            style={{ borderColor: "var(--admin-border)", color: c.key === "rank" ? "var(--admin-ink-faint)" : undefined }}
                            title={c.type === "text" && typeof v === "string" ? v : undefined}
                          >
                            {isBar ? (
                              <span className="flex items-center justify-end gap-2">
                                <span className="hidden h-1.5 w-20 overflow-hidden rounded-full sm:block" style={{ background: "var(--admin-bg-sunken)" }}>
                                  <span className="block h-full rounded-full" style={{ width: `${Math.max(4, ((v as number) / max) * 100)}%`, background: "var(--admin-chart-1)", marginInlineStart: "auto" }} />
                                </span>
                                <span className="font-semibold">{formatCell(v, c.type)}</span>
                              </span>
                            ) : (
                              formatCell(v, c.type)
                            )}
                          </td>
                        );
                      })}
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
          {report.rows.length > PREVIEW_ROWS && (
            <div className="flex justify-center p-2">
              <Button size="sm" variant="ghost" icon={expanded ? "chevronDown" : "chevronLeft"} onClick={() => setExpanded((e) => !e)}>
                {expanded ? "הצג פחות" : `הצג את כל ${fmt(report.rows.length)} השורות`}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const [range, setRange] = useStoredRange<RangeValue>("triplace_admin_reports_range", "all");
  const { data, error, loading, reload, updatedAt } = useAdminData<ReportsData>(`/api/admin/insights/reports?range=${range}`);
  const [group, setGroup] = useState<(typeof GROUPS)[number]["value"]>("all");
  const [search, setSearch] = useState("");
  const rangeLabel = RANGES.find((r) => r.value === range)?.label ?? "";

  const visible = useMemo(() => {
    const q = search.trim();
    return (data?.reports ?? []).filter((r) => (group === "all" || r.group === group) && (!q || `${r.title} ${r.description}`.includes(q)));
  }, [data, group, search]);

  function exportAll() {
    if (!data) return;
    const bytes = reportsToXlsx(visible, { rangeLabel, generatedAt: data.generatedAt });
    downloadBlob(bytes, `triplace-data-${group === "all" ? "all" : group}-${range}-${fileStamp()}.xlsx`, XLSX_MIME);
  }

  return (
    <div>
      <PageHeader
        icon="download"
        title="דוחות וייצוא"
        subtitle="כל הנתונים מסודרים בטבלאות: מה הכי אוהבים, לאן רוצים לנסוע, מה בוחרים בשאלונים - ואפשר להוריד הכל ל-Excel"
        actions={
          <>
            <UpdatedAt at={updatedAt} loading={loading} onRefresh={reload} />
            <Segmented value={range} onChange={setRange} options={RANGES} />
            <Button variant="primary" icon="download" disabled={!data || !visible.length} onClick={exportAll}>
              {group === "all" && !search ? "ייצוא הכל ל-Excel" : `ייצוא ${visible.length} דוחות ל-Excel`}
            </Button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={reload} />
        </div>
      )}
      {!data && loading && <LoadingGrid tiles={0} blocks={3} />}

      {data && (
        <div className="flex flex-col gap-4" style={{ opacity: loading ? 0.6 : 1 }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {GROUPS.map((g) => {
                const count = g.value === "all" ? data.reports.length : data.reports.filter((r) => r.group === g.value).length;
                const active = group === g.value;
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGroup(g.value)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition"
                    style={{
                      background: active ? "var(--admin-accent)" : "var(--admin-bg-surface)",
                      color: active ? "var(--admin-accent-ink)" : "var(--admin-ink-secondary)",
                      borderColor: active ? "transparent" : "var(--admin-border)",
                    }}
                  >
                    <Icon name={g.icon} size={13} />
                    {g.label}
                    <span className="admin-num opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative w-full sm:w-64">
              <Icon name="search" size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--admin-ink-faint)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש דוח..."
                className="w-full rounded-[var(--admin-radius-sm)] border py-1.5 pl-3 pr-8 text-[13px] outline-none"
                style={{ background: "var(--admin-bg-surface)", borderColor: "var(--admin-border)", color: "var(--admin-ink)" }}
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <Card>
              <Empty text="לא נמצאו דוחות" />
            </Card>
          ) : (
            visible.map((r) => <ReportCard key={`${r.id}-${range}`} report={r} rangeLabel={rangeLabel} generatedAt={data.generatedAt} />)
          )}

          {data.warnings.length > 0 && (
            <p className="text-[12px]" style={{ color: "var(--admin-ink-faint)" }}>
              חלק ממקורות הנתונים לא נטענו: {data.warnings.join(" · ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
