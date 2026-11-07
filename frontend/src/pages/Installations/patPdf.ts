/**
 * Preliminary Acceptance Test (PAT) report for the Transformer Anti-Intrusion System (TAIS), as a PDF that follows
 * the paper form agreed by Powertel and ZESA Loss Control: header, 14 checks with Yes / No / N/A, total, comments,
 * and the four signatories (ZETDC, ZESA Loss Control, Powertel, Contractor).
 */
import { SIGNATORIES, fmtDate, fmtDateTime, type Attempt } from "./shared";

const LOGOS = ["/images/brand/zesa-logo.png", "/images/brand/zesa-crest.png"];

async function loadImage(urls: string[]): Promise<{ data: string; w: number; h: number } | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) continue;
      const blob = await res.blob();
      const data = await new Promise<string>((ok, fail) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = fail;
        r.readAsDataURL(blob);
      });
      const dims = await new Promise<{ w: number; h: number }>((ok) => {
        const img = new Image();
        img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => ok({ w: 1, h: 1 });
        img.src = data;
      });
      return { data, ...dims };
    } catch {
      // try the next one
    }
  }
  return null;
}

export async function downloadPatPdf(a: Attempt, opts: { depotName?: string; partnerName?: string } = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const ink: [number, number, number] = [15, 23, 42];
  const muted: [number, number, number] = [100, 116, 139];
  const dark: [number, number, number] = [51, 51, 51];
  const inst = a.installation;

  // ---- header with the ZESA logo
  const logo = await loadImage(LOGOS);
  let y = 12;
  if (logo) {
    const h = 20;
    const w = (logo.w / logo.h) * h;
    doc.addImage(logo.data, "PNG", M, y, w, h);
  }
  doc.setTextColor(...ink);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Preliminary Acceptance Test (PAT) Report", W / 2 + 10, y + 8, { align: "center" });
  doc.text("for Transformer Anti-Intrusion System (TAIS)", W / 2 + 10, y + 14, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  doc.text(`Commissioning attempt ${a.attemptNo}${a.status === "DRAFT" ? "  ·  DRAFT (not final)" : ""}`, W / 2 + 10, y + 20, { align: "center" });
  y += 25;

  // ---- form header: Depot / Location / Date / SS No.
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2.2, textColor: ink, lineColor: [120, 120, 120], lineWidth: 0.2 },
    body: [
      [
        { content: "Depot", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        a.depotLabel || opts.depotName || "",
        { content: "Location", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        a.locationLabel || inst?.transformerName || "",
        { content: "Date", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        fmtDate(a.testDate),
        { content: "SS No.", styles: { fontStyle: "bold", fillColor: [235, 235, 235] } },
        a.ssNumber || inst?.transformerNumber || "",
      ],
    ],
    columnStyles: { 0: { cellWidth: 15 }, 1: { cellWidth: 34 }, 2: { cellWidth: 18 }, 3: { cellWidth: 46 }, 4: { cellWidth: 12 }, 5: { cellWidth: 24 }, 6: { cellWidth: 15 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2;

  // ---- the 14 checks
  const mark = (r: string | null, want: "YES" | "NO") => (r === want ? (want === "YES" ? "Yes" : "No") : r === "NA" && want === "YES" ? "N/A" : "");
  const passed = a.items.every((i) => i.result === "YES" || i.result === "NA");
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    head: [
      [
        { content: "", rowSpan: 2 },
        { content: "Requirement", rowSpan: 2 },
        { content: "Test criteria", rowSpan: 2 },
        { content: "Compliance assessment", colSpan: 2, styles: { halign: "center" } },
      ],
      [
        { content: "Yes / (N/A)", styles: { halign: "center" } },
        { content: "No", styles: { halign: "center" } },
      ],
    ],
    body: [
      ...a.items.map((it, i) => [String(i + 1), it.requirement + (it.remark ? `\n(${it.remark})` : ""), it.criteria, mark(it.result, "YES"), mark(it.result, "NO")]),
      [
        { content: "", styles: { fillColor: dark } },
        { content: "TOTAL", styles: { fontStyle: "bold" } },
        "",
        { content: a.status === "DRAFT" ? "" : passed && a.status === "PASSED" ? "Pass" : "", styles: { halign: "center", fontStyle: "bold", textColor: [5, 120, 80] } },
        { content: a.status === "FAILED" ? "Fail" : "", styles: { halign: "center", fontStyle: "bold", textColor: [200, 30, 30] } },
      ],
    ],
    styles: { font: "helvetica", fontSize: 7.9, cellPadding: 1.45, textColor: ink, lineColor: [120, 120, 120], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: dark, textColor: 255, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 8, halign: "center", fillColor: dark, textColor: 255, fontStyle: "bold" }, 1: { cellWidth: 56 }, 2: { cellWidth: 70 }, 3: { cellWidth: 24, halign: "center" }, 4: { cellWidth: 24, halign: "center" } },
    didParseCell: (d) => {
      if (d.section === "body" && (d.column.index === 3 || d.column.index === 4) && d.row.index < a.items.length) {
        const r = a.items[d.row.index].result;
        if (d.column.index === 3 && r === "YES") d.cell.styles.textColor = [5, 120, 80];
        if (d.column.index === 4 && r === "NO") d.cell.styles.textColor = [200, 30, 30];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // ---- rules + comments
  doc.setFontSize(8.3);
  doc.setTextColor(...ink);
  doc.text("All applicable parameters must pass for the solution to be deemed as acceptable for use.", M, y);
  y += 4.5;
  const rule = doc.splitTextToSize(
    "Items which cannot be ascertained at the time of test are expected to be compliant during continuous assessment to be done within the warranty period. Items which may not be required in some circumstances must be indicated as N/A and be regarded as pass.",
    W - 2 * M
  );
  doc.text(rule, M, y);
  y += rule.length * 3.8 + 2;
  doc.setFont("helvetica", "bold");
  doc.text("Comments:", M, y);
  doc.setFont("helvetica", "normal");
  const comments = doc.splitTextToSize(a.comments || a.decisionNote || "—", W - 2 * M - 20);
  doc.text(comments, M + 18, y);
  y += Math.max(1, comments.length) * 3.9 + 4;

  // ---- signatures
  if (y > H - 76) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.text("Stakeholder representatives must sign below to acknowledge the test results presented in this document", M, y);
  y += 4;
  const colW = (W - 2 * M) / 2;
  const boxH = 22;
  SIGNATORIES.forEach((s, i) => {
    const sig = a.signatures.find((x) => x.role === s.role);
    const x = M + (i % 2) * colW;
    const by = y + Math.floor(i / 2) * (boxH + 3);
    doc.setDrawColor(150, 150, 150);
    doc.roundedRect(x, by, colW - 3, boxH, 1.5, 1.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...ink);
    doc.text(s.label === "Contractor" ? `Contractor${opts.partnerName || inst?.supplierName ? ` (${opts.partnerName || inst?.supplierName})` : ""}` : s.label, x + 2.5, by + 5);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${sig?.name || "................................"}`, x + 2.5, by + 10);
    doc.text("Sign:", x + 2.5, by + 17);
    if (sig?.image) {
      try {
        doc.addImage(sig.image, "PNG", x + 12, by + 11, 30, 10);
      } catch {
        // unreadable signature image: leave the line blank
      }
    } else {
      doc.text("................................", x + 12, by + 17);
    }
    if (sig?.signedAt) {
      doc.setFontSize(6.8);
      doc.setTextColor(...muted);
      doc.text(fmtDateTime(sig.signedAt), x + colW - 6, by + boxH - 2.5, { align: "right" });
    }
  });
  y += 2 * (boxH + 3) + 3;

  // ---- system record (audit)
  doc.setFontSize(7.4);
  doc.setTextColor(...muted);
  const outcome = a.status === "PASSED" ? "PASSED – commissioned" : a.status === "FAILED" ? "FAILED – to be retested" : "DRAFT – not yet signed off";
  const audit = [
    `Final result: ${outcome}${a.decidedBy ? ` by ${a.decidedBy} on ${fmtDateTime(a.decidedAt)}` : ""}${a.decisionNote ? ` · ${a.decisionNote}` : ""}`,
    `Transformer: ${inst?.transformerName ?? ""}${inst?.transformerNumber ? ` (No. ${inst.transformerNumber})` : ""} · Partner: ${inst?.supplierName ?? inst?.supplierCode ?? ""} · Installed ${fmtDate(inst?.installedOn)} · Attempt ${a.attemptNo}`,
    `Form opened by ${a.createdBy ?? "—"} on ${fmtDateTime(a.createdAt)}; last saved by ${a.updatedBy ?? "—"} on ${fmtDateTime(a.updatedAt)}. Generated ${fmtDateTime(new Date().toISOString())}.`,
  ];
  const auditLines = audit.flatMap((l) => doc.splitTextToSize(l, W - 2 * M));
  if (y + auditLines.length * 3.2 > H - 10) {
    doc.addPage();
    y = 20;
  }
  doc.text(auditLines, M, y);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`TAIS · PAT report · ${inst?.transformerName ?? ""} · attempt ${a.attemptNo}`, M, H - 6);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 6, { align: "right" });
  }
  const safe = (inst?.transformerName ?? "site").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.setProperties({ title: `PAT report – ${inst?.transformerName ?? ""} – attempt ${a.attemptNo}`, creator: "TAIS" });
  doc.save(`PAT_${safe}_attempt-${a.attemptNo}.pdf`);
}
