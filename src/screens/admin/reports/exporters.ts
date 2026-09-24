import type { Report, ReportColumn, Cell } from "@/services/admin/insights/reports";

/* ==========================================================================
   ייצוא דוחות: CSV שנפתח נכון ב-Excel עם עברית, וקובץ Excel (xlsx) אמיתי
   עם גיליון לכל דוח - נכתב ידנית (zip ללא דחיסה + XML), בלי תלות חיצונית.
   ========================================================================== */

// ------------------------------------------------------------------ CSV

function csvCell(v: Cell, type: ReportColumn["type"]): string {
  if (v === null || v === undefined) return "";
  const s = type === "percent" && typeof v === "number" ? `${v}%` : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report: Report): string {
  const lines = [report.columns.map((c) => csvCell(c.label, "text")).join(",")];
  for (const row of report.rows) lines.push(report.columns.map((c) => csvCell(row[c.key] ?? null, c.type)).join(","));
  // BOM כדי ש-Excel יזהה UTF-8 ויציג עברית תקינה
  return "﻿" + lines.join("\r\n");
}

// ------------------------------------------------------------------ ZIP

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** zip בשיטת "store" (ללא דחיסה) - תקני לגמרי ו-Excel פותח אותו כרגיל */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8 names
    lv.setUint16(8, 0, true); // store
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0x21, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, f.data.length, true);
    lv.setUint32(22, f.data.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    chunks.push(local, f.data);

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, f.data.length, true);
    cv.setUint32(24, f.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length + f.data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const all = [...chunks, ...central, end];
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0));
  let p = 0;
  for (const c of all) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// ------------------------------------------------------------------ XLSX

const esc = (s: string) =>
  s
    // תווי בקרה אסורים ב-XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function colName(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
function excelDate(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return null;
  return (Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - EXCEL_EPOCH) / 86400000;
}

// סגנונות: 0 רגיל, 1 כותרת, 2 אחוז, 3 תאריך, 4 כותרת גיליון, 5 טקסט משני
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font><font><sz val="10"/><color rgb="FF5B6474"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F6FE5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function cellXml(ref: string, v: Cell, type: ReportColumn["type"] | "header" | "title" | "muted"): string {
  if (v === null || v === undefined || v === "") return "";
  if (type === "header") return `<c r="${ref}" s="1" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
  if (type === "title") return `<c r="${ref}" s="4" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
  if (type === "muted") return `<c r="${ref}" s="5" t="inlineStr"><is><t>${esc(String(v))}</t></is></c>`;
  if (type === "percent" && typeof v === "number") return `<c r="${ref}" s="2"><v>${v / 100}</v></c>`;
  if (type === "date" && typeof v === "string") {
    const serial = excelDate(v);
    if (serial !== null) return `<c r="${ref}" s="3"><v>${serial}</v></c>`;
  }
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function sheetXml(columns: ReportColumn[], rows: Record<string, Cell>[], opts: { freezeHeader: boolean; widths?: number[] }): string {
  const width = (c: ReportColumn, i: number) => {
    if (opts.widths?.[i]) return opts.widths[i];
    const longest = Math.max(c.label.length, ...rows.slice(0, 200).map((r) => String(r[c.key] ?? "").length));
    return Math.min(60, Math.max(c.type === "text" ? 12 : 9, longest + 3));
  };
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${width(c, i)}" customWidth="1"/>`).join("");
  const header = `<row r="1">${columns.map((c, i) => cellXml(`${colName(i)}1`, c.label, "header")).join("")}</row>`;
  const body = rows
    .map((r, ri) => `<row r="${ri + 2}">${columns.map((c, ci) => cellXml(`${colName(ci)}${ri + 2}`, r[c.key] ?? null, c.type)).join("")}</row>`)
    .join("");
  const lastRef = `${colName(columns.length - 1)}${Math.max(1, rows.length + 1)}`;
  const pane = opts.freezeHeader ? `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0" rightToLeft="1">${pane}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${header}${body}</sheetData>
${rows.length ? `<autoFilter ref="A1:${lastRef}"/>` : ""}
</worksheet>`;
}

function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 28) || "גיליון";
  let name = base;
  let i = 2;
  while (used.has(name)) name = `${base.slice(0, 26)} ${i++}`;
  used.add(name);
  return name;
}

export interface WorkbookMeta {
  rangeLabel: string;
  generatedAt: string;
}

/** קובץ Excel עם גיליון "תוכן עניינים" + גיליון לכל דוח */
export function reportsToXlsx(reports: Report[], meta: WorkbookMeta): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const used = new Set<string>();
  const indexName = sheetName("תוכן עניינים", used);
  const sheets = reports.map((r) => ({ name: sheetName(r.title, used), report: r }));

  const indexColumns: ReportColumn[] = [
    { key: "sheet", label: "גיליון", type: "text" },
    { key: "description", label: "מה יש בו", type: "text" },
    { key: "rows", label: "שורות", type: "number" },
  ];
  const indexRows = [
    { sheet: "TRIPLACE - ייצוא נתונים", description: `טווח: ${meta.rangeLabel} · הופק: ${new Date(meta.generatedAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`, rows: null },
    ...sheets.map((s) => ({ sheet: s.name, description: s.report.description, rows: s.report.rows.length })),
  ];

  const files: { name: string; data: Uint8Array }[] = [];
  const all = [{ name: indexName, xml: sheetXml(indexColumns, indexRows, { freezeHeader: true, widths: [34, 110, 10] }) }, ...sheets.map((s) => ({ name: s.name, xml: sheetXml(s.report.columns, s.report.rows, { freezeHeader: true }) }))];

  files.push({
    name: "[Content_Types].xml",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${all
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`
    ),
  });
  files.push({
    name: "_rels/.rels",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ),
  });
  files.push({
    name: "xl/workbook.xml",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${all
        .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`
    ),
  });
  files.push({
    name: "xl/_rels/workbook.xml.rels",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${all
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${all.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    ),
  });
  files.push({ name: "xl/styles.xml", data: enc.encode(STYLES) });
  all.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(s.xml) }));
  return zip(files);
}

// ------------------------------------------------------------------ הורדה

export function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function fileStamp(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
}
