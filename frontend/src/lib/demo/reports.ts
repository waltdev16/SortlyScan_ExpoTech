// Reportes de la demostración generados EN EL NAVEGADOR (CSV, Excel .xlsx y PDF).
// Cada archivo lleva la leyenda obligatoria «Datos de demostración — SortlyScan Interactive Demo.»
// Excel se arma a mano (SpreadsheetML + fflate) y PDF con jsPDF; ambos se cargan solo al descargar.

export const DEMO_LEGEND = "Datos de demostración — SortlyScan Interactive Demo.";

export type Cell = string | number | null | undefined;
export interface ReportSection { heading?: string; columns: string[]; rows: Cell[][] }
export interface ReportDoc {
  title: string;
  institution: string;
  period: string;
  generatedBy: string;
  sections: ReportSection[];
  notes: string[];
}

const text = (v: Cell) => (v === null || v === undefined || (typeof v === "number" && Number.isNaN(v)) ? "" : String(v));

// 01. toCsv
function toCsv(doc: ReportDoc): Blob {
  const esc = (v: Cell) => {
    let s = text(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita fórmulas al abrir en Excel
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: Cell[][] = [[DEMO_LEGEND], [doc.title], [doc.institution], [`Periodo: ${doc.period}`], [`Generado por: ${doc.generatedBy}`], []];
  for (const s of doc.sections) {
    if (s.heading) lines.push([s.heading]);
    lines.push(s.columns, ...s.rows, []);
  }
  for (const n of doc.notes) lines.push([n]);
  lines.push([], [DEMO_LEGEND]);
  return new Blob(["﻿" + lines.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // caracteres de control no permitidos en XML
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

// 02. toXlsx
async function toXlsx(doc: ReportDoc): Promise<Blob> {
  const { zipSync, strToU8 } = await import("fflate");
  const col = (i: number) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
  const rows: string[] = [];
  let r = 0;
  const put = (cells: Cell[], style = 0) => {
    r++;
    rows.push(`<row r="${r}">${cells.map((v, i) => {
      const ref = `${col(i)}${r}`;
      const s = style ? ` s="${style}"` : "";
      if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
      const t = text(v);
      return t ? `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(t)}</t></is></c>` : "";
    }).join("")}</row>`);
  };
  put([DEMO_LEGEND], 2);
  put([doc.title], 1);
  put([doc.institution]);
  put([`Periodo: ${doc.period}`]);
  put([`Generado por: ${doc.generatedBy}`]);
  r++;
  for (const s of doc.sections) {
    if (s.heading) put([s.heading], 1);
    put(s.columns, 3);
    for (const row of s.rows) put(row);
    r++;
  }
  for (const n of doc.notes) put([n]);
  r++;
  put([DEMO_LEGEND], 2);
  const widest = Math.max(1, ...doc.sections.map((s) => s.columns.length));
  const cols = Array.from({ length: widest }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 0 ? 34 : 18}" customWidth="1"/>`).join("");
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows.join("")}</sheetData></worksheet>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="12"/><color rgb="FF254D35"/><name val="Calibri"/></font><font><i/><sz val="11"/><color rgb="FF254D35"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDE9CE"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>
</styleSheet>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reporte (demo)" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": sheet,
    "xl/styles.xml": styles,
  };
  const zipped = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 6 });
  return new Blob([zipped as Uint8Array<ArrayBuffer>], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// Las fuentes estándar de PDF (Helvetica) usan WinAnsi: se reemplazan los pocos símbolos que no admite.
const pdfSafe = (s: string) => s.replace(/[≥]/g, ">=").replace(/[≤]/g, "<=").replace(/[÷]/g, "/").replace(/[×]/g, "x")
  .replace(/[  ]/g, " ").replace(/[^\u0000-ÿ–—‘’“”•…€]/g, "");

// 03. toPdf
async function toPdf(doc: ReportDoc): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 42;
  let y = M;
  const forest: [number, number, number] = [37, 77, 53];
  const carbon: [number, number, number] = [16, 20, 16];
  const sage: [number, number, number] = [221, 233, 206];
  const lime: [number, number, number] = [197, 243, 107];
  const ensure = (h: number) => { if (y + h > H - 56) { pdf.addPage(); y = M; } };
  pdf.setFillColor(...lime);
  pdf.rect(0, 0, W, 6, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...forest);
  pdf.setFontSize(9);
  pdf.text(pdfSafe(DEMO_LEGEND), M, y);
  y += 22;
  pdf.setFontSize(18);
  pdf.setTextColor(...carbon);
  pdf.text(pdfSafe(doc.title), M, y);
  y += 18;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  for (const line of [doc.institution, `Periodo: ${doc.period}`, `Generado por: ${doc.generatedBy} · ${new Date().toLocaleString("es-SV")}`]) {
    pdf.text(pdfSafe(line), M, y);
    y += 14;
  }
  y += 8;
  for (const s of doc.sections) {
    if (s.heading) {
      ensure(30);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...forest);
      pdf.text(pdfSafe(s.heading), M, y);
      y += 14;
    }
    const n = Math.max(1, s.columns.length);
    const usable = W - 2 * M;
    const first = n > 1 ? Math.min(usable * 0.38, usable / n * 1.6) : usable;
    const widths = [first, ...Array(n - 1).fill((usable - first) / Math.max(1, n - 1))];
    const drawRow = (cells: Cell[], header: boolean) => {
      pdf.setFont("helvetica", header ? "bold" : "normal");
      pdf.setFontSize(header ? 8.5 : 8.5);
      const wrapped = cells.map((c, i) => pdf.splitTextToSize(pdfSafe(text(c)), widths[i] - 8) as string[]);
      const h = Math.max(1, ...wrapped.map((x) => x.length)) * 10.5 + 7;
      ensure(h);
      if (header) { pdf.setFillColor(...sage); pdf.rect(M, y - 9, usable, h, "F"); }
      pdf.setTextColor(...carbon);
      let x = M;
      wrapped.forEach((lines, i) => { pdf.text(lines, x + 4, y + 1); x += widths[i]; });
      y += h;
      if (!header) { pdf.setDrawColor(221, 226, 216); pdf.line(M, y - 9, M + usable, y - 9); }
    };
    drawRow(s.columns, true);
    if (!s.rows.length) drawRow(["Sin registros en el periodo."], false);
    for (const row of s.rows) drawRow(row, false);
    y += 14;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(80, 90, 78);
  for (const note of doc.notes) {
    const lines = pdf.splitTextToSize(pdfSafe(note), W - 2 * M) as string[];
    ensure(lines.length * 11 + 4);
    pdf.text(lines, M, y);
    y += lines.length * 11 + 4;
  }
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(...forest);
    pdf.text(pdfSafe(DEMO_LEGEND), M, H - 26);
    pdf.text(`${p} / ${pages}`, W - M, H - 26, { align: "right" });
  }
  pdf.setProperties({ title: `${doc.title} (demostración)`, subject: DEMO_LEGEND, creator: "SortlyScan Interactive Demo" });
  return pdf.output("blob");
}

// 04. buildReport
export async function buildReport(doc: ReportDoc, format: "csv" | "xlsx" | "pdf"): Promise<Blob> {
  if (format === "csv") return toCsv(doc);
  if (format === "xlsx") return toXlsx(doc);
  return toPdf(doc);
}
