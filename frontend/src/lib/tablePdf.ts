/**
 * Generic landscape table report (PDF) and CSV export in the TAIS report style: navy header band, filters line,
 * summary tiles, a striped table, page numbers. jsPDF is loaded on demand.
 */
export type ReportColumn<T> = { header: string; value: (row: T) => string | number | null | undefined; width?: number; align?: "left" | "right" | "center" };

export type ReportSpec<T> = {
  title: string;
  subtitle?: string;
  generatedBy?: string;
  filters?: Array<[string, string]>;
  tiles?: Array<{ label: string; value: string; color?: [number, number, number] }>;
  columns: Array<ReportColumn<T>>;
  rows: T[];
  fileName: string;
  orientation?: "landscape" | "portrait";
  footnote?: string;
};

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

export async function downloadTablePdf<T>(spec: ReportSpec<T>) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: spec.orientation ?? "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const navy: [number, number, number] = [10, 42, 107];
  const blue: [number, number, number] = [11, 79, 196];
  const muted: [number, number, number] = [100, 116, 139];
  const now = new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 24, "F");
  doc.setFillColor(...blue);
  doc.rect(0, 24, W, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(spec.title, M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(191, 219, 254);
  doc.text(spec.subtitle ?? "Transformer Monitoring System  ·  Powertel / ZESA", M, 18);
  doc.text(`Generated ${now}`, W - M, 10, { align: "right" });
  if (spec.generatedBy) doc.text(`By ${spec.generatedBy}`, W - M, 15.5, { align: "right" });
  doc.text(`${spec.rows.length} row${spec.rows.length === 1 ? "" : "s"}`, W - M, 21, { align: "right" });

  let y = 31;
  if (spec.filters?.length) {
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.text("FILTERS", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(spec.filters.map(([k, v]) => `${k}: ${v}`).join("     "), W - 2 * M - 18), M + 16, y);
    y += 5;
  }
  if (spec.tiles?.length) {
    const gap = 3;
    const tw = (W - 2 * M - gap * (spec.tiles.length - 1)) / spec.tiles.length;
    spec.tiles.forEach((t, i) => {
      const x = M + i * (tw + gap);
      const c = t.color ?? blue;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, tw, 15, 2, 2, "FD");
      doc.setFillColor(...c);
      doc.rect(x, y + 2, 1.2, 11, "F");
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text(t.label.toUpperCase(), x + 3.5, y + 5.5);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...c);
      doc.text(t.value, x + 3.5, y + 12);
      doc.setFont("helvetica", "normal");
    });
    y += 20;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 14, bottom: 13 },
    head: [spec.columns.map((c) => c.header)],
    body: spec.rows.map((r) => spec.columns.map((c) => {
      const v = c.value(r);
      return v == null || v === "" ? "—" : String(v);
    })),
    theme: "grid",
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.8, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.2, valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold", lineColor: navy },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: Object.fromEntries(spec.columns.map((c, i) => [i, { cellWidth: c.width ?? "auto", halign: c.align ?? "left" }])),
    didDrawPage: () => {
      if (doc.getCurrentPageInfo().pageNumber > 1) {
        doc.setFillColor(...navy);
        doc.rect(0, 0, W, 8, "F");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text(spec.title, M, 5.5);
        doc.text(`Generated ${now}`, W - M, 5.5, { align: "right" });
      }
    },
  });
  if (!spec.rows.length) {
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text("Nothing matches the selected filters.", W / 2, y + 22, { align: "center" });
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(spec.footnote ?? "TAIS · Transformer Monitoring System", M, H - 5);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 5, { align: "right" });
  }
  doc.setProperties({ title: spec.title, creator: "TAIS" });
  doc.save(`${spec.fileName}_${stamp()}.pdf`);
}

export function downloadTableCsv<T>(spec: Pick<ReportSpec<T>, "columns" | "rows" | "fileName">) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [spec.columns.map((c) => esc(c.header)).join(","), ...spec.rows.map((r) => spec.columns.map((c) => esc(c.value(r))).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${spec.fileName}_${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
