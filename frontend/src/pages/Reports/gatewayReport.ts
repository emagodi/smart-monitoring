/**
 * Gateway locations & status report: data loading, shared formatting, and the PDF / CSV builders.
 * jsPDF is imported on demand (only when someone downloads), so it never weighs on page loads.
 */
import axios from "axios";

export type GatewayStatus = "ONLINE" | "OFFLINE" | "DEGRADED" | "NEVER_SEEN" | "UNKNOWN";

export interface ReportGateway {
  id: number;
  name: string;
  gatewayEui?: string | null;
  loriotGatewayId?: string | null;
  regionId?: number | null;
  regionName?: string | null;
  depotId?: number | null;
  depotName?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  address?: string | null;
  effectiveStatus?: GatewayStatus | null;
  lastSeenAt?: string | null;
  lastLoriotSeenAt?: string | null;
  decommissioned?: boolean;
}

export const STATUS_INFO: Record<GatewayStatus, { label: string; rgb: [number, number, number]; dot: string; pill: string }> = {
  ONLINE: { label: "Online", rgb: [16, 150, 72], dot: "bg-emerald-500", pill: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300" },
  OFFLINE: { label: "Offline", rgb: [214, 40, 40], dot: "bg-red-500", pill: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300" },
  DEGRADED: { label: "Degraded", rgb: [205, 120, 0], dot: "bg-amber-500", pill: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300" },
  NEVER_SEEN: { label: "Never seen", rgb: [100, 116, 139], dot: "bg-slate-400", pill: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  UNKNOWN: { label: "Unknown", rgb: [120, 120, 120], dot: "bg-slate-300", pill: "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400" },
};

export const statusOf = (g: ReportGateway): GatewayStatus => {
  const s = (g.effectiveStatus || "UNKNOWN").toString().toUpperCase() as GatewayStatus;
  return s in STATUS_INFO ? s : "UNKNOWN";
};

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Valid coordinates only (0,0 and out-of-range values count as "no location"). */
export const coordsOf = (g: ReportGateway): { lat: number; lng: number } | null => {
  const lat = num(g.latitude);
  const lng = num(g.longitude);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
};

export const fmtCoord = (n: number) => n.toFixed(6);

export const mapsUrl = (c: { lat: number; lng: number }) => `https://www.google.com/maps?q=${c.lat},${c.lng}`;

export const lastSeenOf = (g: ReportGateway) => g.lastSeenAt || g.lastLoriotSeenAt || null;

export const fmtDateTime = (iso?: string | null) => {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

/** "5 min ago", "3 h ago", "12 d ago". */
export const fmtAgo = (iso?: string | null) => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 172800) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
};

const listOf = (payload: unknown): ReportGateway[] => {
  if (Array.isArray(payload)) return payload as ReportGateway[];
  const o = payload as Record<string, unknown> | null;
  for (const k of ["content", "items", "data"]) if (o && Array.isArray(o[k])) return o[k] as ReportGateway[];
  return [];
};

/** All gateways the user may see (the API applies depot scoping), fetched in pages of 500. */
export async function loadAllGateways(apiBase: string, token: string, signal?: AbortSignal): Promise<ReportGateway[]> {
  const headers = { Authorization: `Bearer ${token}` };
  const out: ReportGateway[] = [];
  const size = 500;
  for (let page = 0; page < 40; page++) {
    if (signal?.aborted) throw new Error("aborted");
    const res = await axios.get(`${apiBase}/api/v1/gateways`, { headers, params: { page, size, sort: "name,asc" } });
    const data = res.data as { totalPages?: number } | null;
    const items = listOf(data);
    out.push(...items);
    const totalPages = typeof data?.totalPages === "number" ? data.totalPages : 1;
    if (page + 1 >= totalPages || items.length < size) break;
  }
  // de-duplicate defensively (paging over a changing table)
  const seen = new Set<number>();
  return out.filter((g) => (seen.has(g.id) ? false : (seen.add(g.id), true)));
}

export interface ReportMeta {
  generatedBy: string;
  filters: Array<[string, string]>;
}

const STATUS_ORDER: GatewayStatus[] = ["ONLINE", "OFFLINE", "DEGRADED", "NEVER_SEEN", "UNKNOWN"];

export const countByStatus = (rows: ReportGateway[]) => {
  const c: Record<GatewayStatus, number> = { ONLINE: 0, OFFLINE: 0, DEGRADED: 0, NEVER_SEEN: 0, UNKNOWN: 0 };
  rows.forEach((g) => c[statusOf(g)]++);
  return c;
};

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

// ------------------------------------------------------------------ PDF

export async function downloadGatewayPdf(rows: ReportGateway[], meta: ReportMeta) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const navy: [number, number, number] = [10, 42, 107];
  const blue: [number, number, number] = [11, 79, 196];
  const ink: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];
  const generatedAt = new Date();

  // ---- header band
  doc.setFillColor(...navy);
  doc.rect(0, 0, W, 26, "F");
  doc.setFillColor(...blue);
  doc.rect(0, 26, W, 1.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("Gateway Locations & Status Report", M, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(191, 219, 254);
  doc.text("Transformer Monitoring System  ·  Powertel / ZESA", M, 19);
  doc.setFontSize(8.5);
  doc.text(`Generated ${fmtDateTime(generatedAt.toISOString())}`, W - M, 11, { align: "right" });
  doc.text(`By ${meta.generatedBy}`, W - M, 16.5, { align: "right" });
  doc.text(`${rows.length} gateway${rows.length === 1 ? "" : "s"}`, W - M, 22, { align: "right" });

  // ---- filters line
  let y = 34;
  doc.setFontSize(8.5);
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold");
  doc.text("FILTERS", M, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...ink);
  doc.text(meta.filters.map(([k, v]) => `${k}: ${v}`).join("     "), M + 16, y);

  // ---- summary tiles
  y += 5;
  const counts = countByStatus(rows);
  const withCoords = rows.filter((g) => coordsOf(g)).length;
  const tiles: Array<{ label: string; value: string; rgb: [number, number, number] }> = [
    { label: "Total gateways", value: String(rows.length), rgb: blue },
    ...STATUS_ORDER.filter((s) => s === "ONLINE" || s === "OFFLINE" || counts[s] > 0).map((s) => ({
      label: STATUS_INFO[s].label,
      value: `${counts[s]}${rows.length ? `  (${Math.round((counts[s] / rows.length) * 100)}%)` : ""}`,
      rgb: STATUS_INFO[s].rgb,
    })),
    { label: "With coordinates", value: `${withCoords} / ${rows.length}`, rgb: [71, 85, 105] },
  ];
  const gap = 4;
  const tw = (W - 2 * M - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach((t, i) => {
    const x = M + i * (tw + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, tw, 16, 2, 2, "FD");
    doc.setFillColor(...t.rgb);
    doc.rect(x, y + 2, 1.2, 12, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(t.label.toUpperCase(), x + 4, y + 6);
    doc.setFontSize(12.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...t.rgb);
    doc.text(t.value, x + 4, y + 13);
    doc.setFont("helvetica", "normal");
  });
  y += 22;

  // ---- table
  const body = rows.map((g, i) => {
    const c = coordsOf(g);
    const seen = lastSeenOf(g);
    return [
      String(i + 1),
      g.name || `Gateway ${g.id}`,
      g.gatewayEui || g.loriotGatewayId || "—",
      g.regionName || "—",
      g.depotName || "—",
      ...(c
        ? [fmtCoord(c.lat), fmtCoord(c.lng)]
        : [{ content: "No location", colSpan: 2, styles: { halign: "center" as const, font: "helvetica", fontStyle: "italic" as const, textColor: [180, 83, 9] as [number, number, number] } }]),
      STATUS_INFO[statusOf(g)].label,
      seen ? `${fmtDateTime(seen)}${fmtAgo(seen) ? `\n${fmtAgo(seen)}` : ""}` : "Never",
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 16, bottom: 14 },
    head: [["#", "Gateway", "EUI", "Region", "Depot", "Latitude", "Longitude", "Status", "Last seen"]],
    body,
    theme: "grid",
    rowPageBreak: "avoid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 2, bottom: 2, left: 2.2, right: 2.2 }, textColor: ink, lineColor: [226, 232, 240], lineWidth: 0.2, valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold", fontSize: 8, lineColor: navy },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: "right", textColor: muted },
      1: { cellWidth: 46, fontStyle: "bold" },
      2: { cellWidth: 41, fontSize: 7.5, textColor: [71, 85, 105] },
      3: { cellWidth: 28 },
      4: { cellWidth: 33 },
      5: { cellWidth: 23, halign: "right", font: "courier", fontSize: 7.5 },
      6: { cellWidth: 23, halign: "right", font: "courier", fontSize: 7.5 },
      7: { cellWidth: 26, fontStyle: "bold" },
      8: { cellWidth: "auto", fontSize: 7.5 },
    },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const g = rows[d.row.index];
      if (!g) return;
      if (d.column.index === 7) {
        d.cell.styles.textColor = STATUS_INFO[statusOf(g)].rgb;
        d.cell.styles.cellPadding = { top: 2, bottom: 2, left: 6, right: 2 };
      }
      if ((d.column.index === 5 || d.column.index === 6) && coordsOf(g)) d.cell.styles.textColor = blue;
    },
    didDrawCell: (d) => {
      if (d.section !== "body") return;
      const g = rows[d.row.index];
      if (!g) return;
      if (d.column.index === 7) {
        doc.setFillColor(...STATUS_INFO[statusOf(g)].rgb);
        doc.circle(d.cell.x + 3.2, d.cell.y + d.cell.height / 2, 1.1, "F");
      }
      const c = coordsOf(g);
      if (c && (d.column.index === 5 || d.column.index === 6)) {
        doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url: mapsUrl(c) });
      }
    },
    didDrawPage: () => {
      // slim running header on continuation pages
      if (doc.getCurrentPageInfo().pageNumber > 1) {
        doc.setFillColor(...navy);
        doc.rect(0, 0, W, 9, "F");
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text("Gateway Locations & Status Report", M, 6);
        doc.setFont("helvetica", "normal");
        doc.text(`Generated ${fmtDateTime(generatedAt.toISOString())}`, W - M, 6, { align: "right" });
      }
    },
  });

  if (!rows.length) {
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text("No gateways match the selected filters.", W / 2, y + 22, { align: "center" });
  }

  // ---- footers
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text("Status is the gateway's live state from LORIOT at the time of generation. Click a coordinate to open it in Google Maps.", M, H - 5);
    doc.text(`Page ${p} of ${pages}`, W - M, H - 5, { align: "right" });
  }

  doc.setProperties({ title: "Gateway Locations & Status Report", subject: "Gateways", author: meta.generatedBy, creator: "TAIS" });
  doc.save(`gateway-status-report_${stamp()}.pdf`);
}

// ------------------------------------------------------------------ CSV (for Excel)

export function downloadGatewayCsv(rows: ReportGateway[]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ["Gateway", "EUI", "Region", "Depot", "Latitude", "Longitude", "Status", "Last seen", "Google Maps"].join(","),
    ...rows.map((g) => {
      const c = coordsOf(g);
      return [g.name, g.gatewayEui || g.loriotGatewayId || "", g.regionName || "", g.depotName || "", c ? fmtCoord(c.lat) : "", c ? fmtCoord(c.lng) : "", STATUS_INFO[statusOf(g)].label, lastSeenOf(g) || "", c ? mapsUrl(c) : ""]
        .map(esc)
        .join(",");
    }),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gateway-status-report_${stamp()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
