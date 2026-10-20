import { useMemo, useRef, useState } from "react";
import axios from "axios";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Button, Dialog, Notice, inputCls } from "../../components/ui/page";
import { readSheet, type SheetRows } from "../../lib/sheet";

/**
 * Upload an operator SIM export (.xlsx / .csv) to pre-populate the inventory. Columns are recognised by their
 * headers (ICCID, IMSI, Number/MSISDN, Company/Operator, Primary NE, SIM Card State, SIM Card Type). PIN and PUK
 * are not in these exports: they are captured when the SIM is assigned to a gateway.
 */

type Field = "iccid" | "imsi" | "msisdn" | "operator" | "networkName" | "state" | "simType";
const FIELDS: { key: Field; label: string; match: RegExp; required?: boolean }[] = [
  { key: "iccid", label: "ICCID", match: /iccid/i, required: true },
  { key: "imsi", label: "IMSI", match: /imsi/i },
  { key: "msisdn", label: "Number (MSISDN)", match: /^(number|msisdn|phone|mobile|sim ?number|cell|line)/i },
  { key: "operator", label: "Operator", match: /company|operator|carrier|provider/i },
  { key: "networkName", label: "Network", match: /primary ?ne|network|hlr/i },
  { key: "state", label: "State", match: /state|status/i },
  { key: "simType", label: "SIM type", match: /type/i },
];

type Row = { rowNumber: number } & Partial<Record<Field, string>>;
type Result = { received: number; created: number; updated: number; unchanged: number; skipped: number; issues: { rowNumber?: number; iccidTail?: string; message: string }[] };

const clean = (s: unknown) => String(s ?? "").replace(/[\t ]/g, " ").trim();
const iccidOk = (s?: string) => (s || "").replace(/[^0-9a-fA-F]/g, "").length >= 10;

function toRows(sheet: SheetRows) {
  const headerIdx = sheet.slice(0, 15).findIndex((r) => r.some((c) => /iccid/i.test(clean(c))));
  if (headerIdx < 0) return { rows: [] as Row[], mapping: {} as Partial<Record<Field, number>>, headers: [] as string[], error: "Could not find an ICCID column. The first row should have headings such as ICCID, IMSI, Number." };
  const headers = sheet[headerIdx].map(clean);
  const mapping: Partial<Record<Field, number>> = {};
  for (const f of FIELDS) {
    const i = headers.findIndex((h, idx) => f.match.test(h) && !Object.values(mapping).includes(idx));
    if (i >= 0) mapping[f.key] = i;
  }
  const rows: Row[] = [];
  for (let r = headerIdx + 1; r < sheet.length; r++) {
    const cells = sheet[r] || [];
    if (!cells.some((c) => clean(c))) continue; // blank line
    const row: Row = { rowNumber: r + 1 };
    for (const f of FIELDS) {
      const i = mapping[f.key];
      if (i !== undefined) row[f.key] = clean(cells[i]) || undefined;
    }
    rows.push(row);
  }
  return { rows, mapping, headers, error: null as string | null };
}

export function SimImportDialog({ open, onClose, onDone, apiBase, headers }: { open: boolean; onClose: () => void; onDone: () => void; apiBase: string; headers: Record<string, string> }) {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ReturnType<typeof toRows> | null>(null);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [defaultOperator, setDefaultOperator] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [drag, setDrag] = useState(false);

  const reset = () => {
    setFileName(null);
    setParsed(null);
    setErr(null);
    setResult(null);
    setProgress(0);
    setDefaultOperator("");
    if (input.current) input.current.value = "";
  };
  const close = () => {
    if (busy) return;
    if (result && (result.created || result.updated)) onDone();
    reset();
    onClose();
  };

  const load = async (file?: File | null) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setReading(true);
    try {
      const p = toRows(await readSheet(file));
      if (p.error) setErr(p.error);
      setParsed(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read this file.");
    } finally {
      setReading(false);
    }
  };

  const stats = useMemo(() => {
    const rows = parsed?.rows ?? [];
    const seen = new Set<string>();
    let bad = 0;
    let dup = 0;
    for (const r of rows) {
      if (!iccidOk(r.iccid)) {
        bad++;
        continue;
      }
      const k = (r.iccid || "").replace(/[^0-9a-fA-F]/g, "").toUpperCase();
      if (seen.has(k)) dup++;
      else seen.add(k);
    }
    return { total: rows.length, ready: seen.size, bad, dup };
  }, [parsed]);

  const run = async () => {
    if (!parsed?.rows.length) return;
    setBusy(true);
    setErr(null);
    const sum: Result = { received: 0, created: 0, updated: 0, unchanged: 0, skipped: 0, issues: [] };
    try {
      const chunk = 500;
      for (let i = 0; i < parsed.rows.length; i += chunk) {
        const res = await axios.post<Result>(
          `${apiBase}/api/v1/sim-cards/import`,
          { defaultOperator: defaultOperator.trim() || undefined, rows: parsed.rows.slice(i, i + chunk) },
          { headers }
        );
        const d = res.data;
        sum.received += d.received;
        sum.created += d.created;
        sum.updated += d.updated;
        sum.unchanged += d.unchanged;
        sum.skipped += d.skipped;
        sum.issues.push(...(d.issues || []));
        setProgress(Math.min(parsed.rows.length, i + chunk));
      }
      setResult(sum);
    } catch (e) {
      const ax = e as { response?: { data?: { message?: string } }; message?: string };
      setErr(`Upload failed: ${ax.response?.data?.message || ax.message || "unknown error"}${sum.received ? ` (${sum.received} rows were saved before the error)` : ""}`);
      if (sum.received) setResult(sum);
    } finally {
      setBusy(false);
    }
  };

  const missingOperator = parsed && parsed.mapping.operator === undefined;
  const preview = (parsed?.rows ?? []).slice(0, 6);

  return (
    <Dialog
      open={open}
      onClose={close}
      width="max-w-3xl"
      icon={<FileSpreadsheet className="h-5 w-5" />}
      title="Upload SIM inventory"
      subtitle="Load SIMs from the operator's spreadsheet. PIN and PUK are added later, when a SIM is assigned to a gateway."
      footer={
        result ? (
          <>
            <Button onClick={reset}>Upload another file</Button>
            <Button variant="primary" onClick={close}>Done</Button>
          </>
        ) : (
          <>
            <Button onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="primary" icon={<Upload className="h-3.5 w-3.5" />} busy={busy} disabled={!stats.ready || !!parsed?.error} onClick={() => void run()}>
              {busy ? `Uploading ${progress}/${stats.total}…` : stats.ready ? `Import ${stats.ready.toLocaleString()} SIM${stats.ready === 1 ? "" : "s"}` : "Import SIMs"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        {err ? <Notice tone="error">{err}</Notice> : null}

        {result ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm text-emerald-900 dark:text-emerald-100">
                <p className="font-semibold">Import finished</p>
                <p className="text-xs">{result.received.toLocaleString()} rows read from {fileName}.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Added", result.created, "text-emerald-600"],
                ["Updated", result.updated, "text-blue-600"],
                ["Already up to date", result.unchanged, "text-slate-600"],
                ["Skipped", result.skipped, result.skipped ? "text-amber-600" : "text-slate-600"],
              ].map(([l, n, c]) => (
                <div key={l as string} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{l}</p>
                  <p className={`mt-1 text-2xl font-semibold ${c}`}>{(n as number).toLocaleString()}</p>
                </div>
              ))}
            </div>
            {result.issues.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10">
                <p className="border-b border-amber-200 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:text-amber-200">Rows not imported</p>
                <ul className="max-h-48 divide-y divide-amber-100 overflow-y-auto text-xs dark:divide-amber-500/20">
                  {result.issues.map((i, k) => (
                    <li key={k} className="flex gap-3 px-3 py-1.5 text-amber-900 dark:text-amber-100">
                      <span className="w-16 shrink-0 font-mono">Row {i.rowNumber ?? "?"}</span>
                      <span className="flex-1">{i.message}</span>
                      {i.iccidTail ? <span className="font-mono text-amber-700">…{i.iccidTail}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                void load(e.dataTransfer.files?.[0]);
              }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
                drag ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40 dark:border-slate-700 dark:bg-slate-900"
              }`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-red-500 text-white shadow-lg shadow-blue-600/20">
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{reading ? "Reading…" : fileName ? fileName : "Choose an Excel or CSV file"}</span>
              <span className="text-xs text-slate-500">.xlsx or .csv · first sheet · headings like ICCID, IMSI, Number, Company, SIM Card State</span>
            </button>
            <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => void load(e.target.files?.[0])} />

            {parsed && !parsed.error ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Rows" value={stats.total} />
                  <Stat label="Ready" value={stats.ready} tone="text-emerald-600" />
                  <Stat label="No ICCID" value={stats.bad} tone={stats.bad ? "text-amber-600" : undefined} />
                  <Stat label="Repeated" value={stats.dup} tone={stats.dup ? "text-amber-600" : undefined} />
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Columns found</p>
                  <div className="flex flex-wrap gap-1.5">
                    {FIELDS.map((f) => {
                      const i = parsed.mapping[f.key];
                      const ok = i !== undefined;
                      return (
                        <span key={f.key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${ok ? "bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/30" : "bg-slate-50 text-slate-400 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700"}`}>
                          {f.label}
                          {ok ? <span className="text-blue-500">← “{parsed.headers[i!]}”</span> : <span>· not in file</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {missingOperator ? (
                  <label className="block space-y-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Operator for these SIMs</span>
                    <input className={inputCls} value={defaultOperator} onChange={(e) => setDefaultOperator(e.target.value)} placeholder="e.g. Econet Zimbabwe" />
                  </label>
                ) : null}

                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">ICCID</th>
                        <th className="px-3 py-2">IMSI</th>
                        <th className="px-3 py-2">Number</th>
                        <th className="px-3 py-2">Operator</th>
                        <th className="px-3 py-2">State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {preview.map((r) => (
                        <tr key={r.rowNumber} className={iccidOk(r.iccid) ? "" : "bg-amber-50/60 dark:bg-amber-500/5"}>
                          <td className="px-3 py-1.5 text-slate-400">{r.rowNumber}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-800 dark:text-slate-100">{r.iccid || <span className="text-amber-600">missing</span>}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{r.imsi || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 font-mono text-slate-600 dark:text-slate-300">{r.msisdn || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.operator || defaultOperator || "—"}</td>
                          <td className="whitespace-nowrap px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.state || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {stats.total > preview.length ? <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-500 dark:border-slate-800">…and {(stats.total - preview.length).toLocaleString()} more rows</p> : null}
                </div>

                <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  <span>
                    New ICCIDs are added as <b>Available</b> stock. ICCIDs already in the inventory get their IMSI, number and operator updated; their PIN, PUK and gateway assignment are left as they are. Local numbers like 782271685 are stored as 263782271685.
                  </span>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${tone ?? "text-slate-900 dark:text-slate-50"}`}>{value.toLocaleString()}</p>
    </div>
  );
}
