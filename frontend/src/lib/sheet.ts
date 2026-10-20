/**
 * Read the first worksheet of an .xlsx (or a .csv) into rows of strings, in the browser, with no library.
 * An .xlsx is a zip of XML files: we walk the zip directory, inflate the parts we need with the browser's
 * DecompressionStream, and read shared strings + the first sheet with DOMParser.
 */

export type SheetRows = string[][];

export async function readSheet(file: File): Promise<SheetRows> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    return parseCsv(await file.text());
  }
  if (name.endsWith(".xls")) {
    throw new Error("Old .xls files are not supported. In Excel use File → Save As → Excel Workbook (.xlsx) or CSV.");
  }
  return readXlsx(await file.arrayBuffer());
}

// ------------------------------------------------------------------------------------------- zip

type ZipEntry = { name: string; method: number; compSize: number; offset: number };

function zipEntries(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf);
  // End of central directory: signature 0x06054b50, searched backwards (comment may follow it).
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This file is not a valid .xlsx workbook.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const method = v.getUint16(p + 10, true);
    const compSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out.push({ name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function zipRead(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const v = new DataView(buf);
  const nameLen = v.getUint16(e.offset + 26, true);
  const extraLen = v.getUint16(e.offset + 28, true);
  const start = e.offset + 30 + nameLen + extraLen;
  const data = new Uint8Array(buf, start, e.compSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error(`Unsupported compression in ${e.name}`);
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot open .xlsx files. Save the sheet as CSV and upload that instead.");
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// ------------------------------------------------------------------------------------------ xlsx

const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

async function readXlsx(buf: ArrayBuffer): Promise<SheetRows> {
  const entries = zipEntries(buf);
  const byName = new Map(entries.map((e) => [e.name.replace(/^\//, ""), e]));
  const get = async (n: string) => {
    const e = byName.get(n);
    return e ? zipRead(buf, e) : null;
  };
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");

  // Which file is the first sheet? workbook.xml lists sheets in tab order; the rels file maps id -> path.
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = await get("xl/workbook.xml");
  const rels = await get("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const first = xml(wb).getElementsByTagName("sheet")[0];
    const rid = first?.getAttributeNS(NS_REL, "id") || first?.getAttribute("r:id");
    const rel = Array.from(xml(rels).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  if (!byName.has(sheetPath)) {
    const any = entries.find((e) => /^xl\/worksheets\/[^/]+\.xml$/.test(e.name));
    if (!any) throw new Error("No worksheet found in this workbook.");
    sheetPath = any.name;
  }

  const shared: string[] = [];
  const ss = await get("xl/sharedStrings.xml");
  if (ss) {
    for (const si of Array.from(xml(ss).getElementsByTagName("si"))) {
      shared.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
    }
  }

  const sheet = xml((await get(sheetPath)) || "");
  const rows: SheetRows = [];
  for (const row of Array.from(sheet.getElementsByTagName("row"))) {
    const rIdx = Number(row.getAttribute("r") || rows.length + 1) - 1;
    const cells: string[] = [];
    let col = 0;
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r");
      if (ref) col = colIndex(ref);
      const t = c.getAttribute("t");
      let val = "";
      if (t === "inlineStr") {
        val = Array.from(c.getElementsByTagName("t")).map((x) => x.textContent ?? "").join("");
      } else {
        const raw = c.getElementsByTagName("v")[0]?.textContent ?? "";
        if (t === "s") val = shared[Number(raw)] ?? "";
        else if (t === "b") val = raw === "1" ? "TRUE" : "FALSE";
        else val = numberText(raw);
      }
      cells[col] = val;
      col++;
    }
    for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = "";
    rows[rIdx] = cells;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

function colIndex(ref: string) {
  let n = 0;
  for (const ch of ref.replace(/[0-9]/g, "")) n = n * 26 + (ch.toUpperCase().charCodeAt(0) - 64);
  return n - 1;
}

/** Long numbers typed into Excel come back as 8.92630419576201E+18; keep integers as plain digits where safe. */
function numberText(raw: string) {
  if (!/e/i.test(raw)) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  try {
    return BigInt(Math.round(n)).toString();
  } catch {
    return raw;
  }
}

// ------------------------------------------------------------------------------------------- csv

export function parseCsv(text: string): SheetRows {
  const rows: SheetRows = [];
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
