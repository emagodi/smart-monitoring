import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Download, Loader2, Save, ShieldCheck, Trash2, XCircle } from "lucide-react";
import axios from "axios";
import { Button, Dialog, Field, inputCls, Notice, Panel } from "../../components/ui/page";
import { cachedGet, invalidateCache } from "../../lib/cache";
import { useGeography } from "../Registry/geo";
import { apiError } from "../Response/shared";
import { SignaturePad } from "./SignaturePad";
import { downloadPatPdf } from "./patPdf";
import { StatusBadge } from "./components";
import { API, SIGNATORIES, authHeaders, fmtDate, fmtDateTime, lifecyclePost, lifecyclePut, useLifecycleRights, type Attempt, type CheckResult, type PatItem, type Signature } from "./shared";

const RESULT_BTN: Array<{ v: Exclude<CheckResult, null>; label: string; on: string }> = [
  { v: "YES", label: "Yes", on: "bg-emerald-600 text-white border-emerald-600" },
  { v: "NA", label: "N/A", on: "bg-slate-600 text-white border-slate-600" },
  { v: "NO", label: "No", on: "bg-red-600 text-white border-red-600" },
];

export default function CommissioningForm() {
  const { id, attemptId } = useParams();
  const navigate = useNavigate();
  const rights = useLifecycleRights();
  const { token } = rights;
  const geo = useGeography(token ?? null);
  const [a, setA] = useState<Attempt | null>(null);
  const [items, setItems] = useState<PatItem[]>([]);
  const [sigs, setSigs] = useState<Record<string, Signature>>({});
  const [head, setHead] = useState({ testDate: "", depotLabel: "", locationLabel: "", ssNumber: "", comments: "" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [finalise, setFinalise] = useState<"PASSED" | "FAILED" | null>(null);
  const [finalNote, setFinalNote] = useState("");

  const load = useCallback(async () => {
    if (!token || !attemptId) return;
    try {
      const r = await cachedGet<Attempt>(`${API}/attempts/${attemptId}`, token, 0, true);
      setA(r);
      setItems(r.items);
      setSigs(Object.fromEntries((r.signatures ?? []).map((s) => [s.role, s])));
      setHead({
        testDate: r.testDate ?? "",
        depotLabel: r.depotLabel ?? "",
        locationLabel: r.locationLabel ?? r.installation?.transformerName ?? "",
        ssNumber: r.ssNumber ?? r.installation?.transformerNumber ?? "",
        comments: r.comments ?? "",
      });
      setDirty(false);
    } catch (e) {
      setError(apiError(e, "Could not open the commissioning form."));
    }
  }, [attemptId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Depot name defaults from the geography once it has loaded.
  useEffect(() => {
    if (a && !head.depotLabel && a.installation?.depotId && geo.loaded) {
      setHead((h) => ({ ...h, depotLabel: geo.pathOf(a.installation.depotId!).depotName }));
    }
  }, [a, geo.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = a?.status === "DRAFT" && rights.canPerform;
  const answered = items.filter((i) => i.result).length;
  const noCount = items.filter((i) => i.result === "NO").length;
  const signed = SIGNATORIES.filter((s) => sigs[s.role]?.image).length;

  const payload = useMemo(
    () => ({
      ...head,
      testDate: head.testDate || null,
      items: items.map((i) => ({ key: i.key, result: i.result, remark: i.remark ?? null })),
      signatures: SIGNATORIES.map((s) => sigs[s.role] ?? { role: s.role }).map((s) => ({ role: s.role, name: s.name ?? null, image: s.image ?? null, signedAt: s.signedAt ?? null })),
    }),
    [head, items, sigs]
  );

  const save = async (quiet = false) => {
    if (!a) return null;
    setBusy("save");
    setError(null);
    try {
      const r = await lifecyclePut<Attempt>(token, `/attempts/${a.id}`, payload);
      setA(r);
      setDirty(false);
      if (!quiet) setNotice("Saved.");
      return r;
    } catch (e) {
      setError(apiError(e, "Could not save the form."));
      return null;
    } finally {
      setBusy(null);
    }
  };

  const doFinalise = async () => {
    if (!a || !finalise) return;
    const saved = dirty ? await save(true) : a;
    if (!saved) return;
    setBusy("final");
    try {
      const r = await lifecyclePost<Attempt>(token, `/attempts/${a.id}/finalise`, { result: finalise, note: finalNote });
      setA(r);
      setFinalise(null);
      setNotice(finalise === "PASSED" ? "Commissioned. The transformer is now live for reaction." : "Recorded as failed. The partner fixes the issues and marks the site ready for the next attempt.");
      invalidateCache("/api/v1/lifecycle");
    } catch (e) {
      setError(apiError(e, "Could not finalise."));
      setFinalise(null);
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!a) return;
    setBusy("discard");
    try {
      await axios.delete(`${API}/attempts/${a.id}`, { headers: authHeaders(token) });
      invalidateCache("/api/v1/lifecycle");
      navigate(`/installations/${id}`);
    } catch (e) {
      setError(apiError(e, "Could not discard the draft."));
      setBusy(null);
    }
  };

  const setItem = (key: string, patch: Partial<PatItem>) => {
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    setDirty(true);
  };
  const setSig = (role: string, patch: Partial<Signature>) => {
    setSigs((s) => ({ ...s, [role]: { ...(s[role] ?? { role }), ...patch, role } }));
    setDirty(true);
  };

  if (!a) {
    return (
      <div className="space-y-4">
        {error ? <Notice>{error}</Notice> : <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Opening the form…</div>}
      </div>
    );
  }
  const inst = a.installation;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/installations/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" /> {inst.transformerName}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download className="h-3.5 w-3.5" />} onClick={() => void downloadPatPdf({ ...a, ...head, items, signatures: payload.signatures } as Attempt, { depotName: head.depotLabel })}>
            PDF
          </Button>
          {editable ? (
            <Button icon={<Save className="h-3.5 w-3.5" />} busy={busy === "save"} onClick={() => void save()} variant={dirty ? "primary" : "secondary"}>
              {dirty ? "Save" : "Saved"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* paper-form style header */}
      <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-4 py-4 sm:px-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <img src="/images/brand/zesa-crest.png" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} alt="ZESA" className="h-14 w-auto sm:h-16" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">Commissioning · attempt {a.attemptNo}</p>
            <h1 className="text-base font-bold leading-tight text-slate-900 sm:text-lg dark:text-slate-50">Preliminary Acceptance Test (PAT) Report for Transformer Anti-Intrusion System (TAIS)</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <StatusBadge status={inst.status} attempts={inst.attempts} />
              <span>{inst.supplierName ?? inst.supplierCode} (contractor)</span>
              {a.status !== "DRAFT" ? (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${a.status === "PASSED" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {a.status === "PASSED" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {a.status === "PASSED" ? "Pass" : "Fail"} · {fmtDateTime(a.decidedAt)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-4 sm:px-6">
          <Field label="Depot">
            <input className={inputCls} disabled={!editable} value={head.depotLabel} onChange={(e) => { setHead({ ...head, depotLabel: e.target.value }); setDirty(true); }} />
          </Field>
          <Field label="Location">
            <input className={inputCls} disabled={!editable} value={head.locationLabel} onChange={(e) => { setHead({ ...head, locationLabel: e.target.value }); setDirty(true); }} />
          </Field>
          <Field label="Date">
            <input type="date" className={inputCls} disabled={!editable} value={head.testDate} onChange={(e) => { setHead({ ...head, testDate: e.target.value }); setDirty(true); }} />
          </Field>
          <Field label="SS No.">
            <input className={inputCls} disabled={!editable} value={head.ssNumber} onChange={(e) => { setHead({ ...head, ssNumber: e.target.value }); setDirty(true); }} />
          </Field>
        </div>
      </section>

      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {notice ? (
        <Notice tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Notice>
      ) : null}

      <Panel
        title="Compliance assessment"
        icon={<ClipboardCheck className="h-4 w-4" />}
        subtitle={`${answered}/${items.length} answered${noCount ? ` · ${noCount} not compliant` : ""}. Items not required here are marked N/A and count as a pass.`}
        actions={
          editable ? (
            <Button
              size="sm"
              onClick={() => {
                setItems((l) => l.map((i) => (i.result ? i : { ...i, result: "YES" })));
                setDirty(true);
              }}
            >
              Mark the rest Yes
            </Button>
          ) : null
        }
      >
        <ol className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((it, idx) => (
            <li key={it.key} className={`grid gap-2 px-4 py-3 sm:grid-cols-[28px_1fr_1fr_auto] sm:items-center sm:gap-4 ${it.result === "NO" ? "bg-red-50/60 dark:bg-red-500/5" : ""}`}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white dark:bg-slate-700">{idx + 1}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{it.requirement}</p>
                <p className="text-xs text-slate-500 sm:hidden">{it.criteria}</p>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">{it.criteria}</p>
              <div className="flex flex-col gap-1.5 sm:items-end">
                <div className="inline-flex overflow-hidden rounded-full border border-slate-200 dark:border-slate-700">
                  {RESULT_BTN.map((b) => (
                    <button
                      key={b.v}
                      type="button"
                      disabled={!editable}
                      onClick={() => setItem(it.key, { result: it.result === b.v ? null : b.v })}
                      className={`min-w-[52px] border-r px-3 py-1.5 text-xs font-bold last:border-r-0 disabled:cursor-default ${it.result === b.v ? b.on : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900"}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
                {editable || it.remark ? (
                  <input
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400 sm:w-56 dark:border-slate-700 dark:bg-slate-900"
                    placeholder="Remark (optional)"
                    disabled={!editable}
                    value={it.remark ?? ""}
                    onChange={(e) => setItem(it.key, { remark: e.target.value })}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Comments" subtitle="Recommendations agreed on site (e.g. louder buzzer for isolated sites, flashlight specification, anti-tamper feature).">
        <div className="p-4">
          <textarea className={`${inputCls} h-28 py-2`} disabled={!editable} value={head.comments} onChange={(e) => { setHead({ ...head, comments: e.target.value }); setDirty(true); }} />
        </div>
      </Panel>

      <Panel title="Signatures" subtitle={`${signed}/${SIGNATORIES.length} signed. Stakeholder representatives sign to acknowledge the test results. Hand the phone or tablet to each person.`}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {SIGNATORIES.map((s) => {
            const sig = sigs[s.role];
            return (
              <div key={s.role} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {s.label}
                    {s.role === "CONTRACTOR" && (inst.supplierName || inst.supplierCode) ? <span className="ml-1 text-xs font-normal text-slate-500">({inst.supplierName ?? inst.supplierCode})</span> : null}
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.org}</span>
                </div>
                <input className={`${inputCls} mb-2`} placeholder="Full name" disabled={!editable} value={sig?.name ?? ""} onChange={(e) => setSig(s.role, { name: e.target.value })} />
                <SignaturePad value={sig?.image ?? null} disabled={!editable} onChange={(img) => setSig(s.role, { image: img, signedAt: img ? new Date().toISOString() : null })} />
                {sig?.signedAt ? <p className="mt-1 text-right text-[10px] text-slate-400">Signed {fmtDateTime(sig.signedAt)}</p> : null}
              </div>
            );
          })}
        </div>
      </Panel>

      <p className="px-1 text-xs text-slate-500">
        Opened by {a.createdBy} on {fmtDateTime(a.createdAt)} · last saved by {a.updatedBy ?? "—"} {a.updatedAt ? `on ${fmtDateTime(a.updatedAt)}` : ""}
        {a.decidedBy ? ` · final result by ${a.decidedBy} on ${fmtDateTime(a.decidedAt)}` : ""} · installed {fmtDate(inst.installedOn)}
      </p>

      {/* sticky action bar */}
      {a.status === "DRAFT" && (rights.canPerform || rights.canDecide) ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:left-[220px] dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {answered}/{items.length} checks · {signed}/{SIGNATORIES.length} signatures
              {!rights.canDecide ? " · Loss Control gives the final result" : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {rights.canPerform ? (
                <Button variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} busy={busy === "discard"} onClick={() => void discard()}>
                  Discard draft
                </Button>
              ) : null}
              {rights.canDecide ? (
                <>
                  <Button variant="danger" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setFinalise("FAILED")}>
                    Fail
                  </Button>
                  <Button variant="primary" icon={<ShieldCheck className="h-3.5 w-3.5" />} disabled={noCount > 0 || answered < items.length} onClick={() => setFinalise("PASSED")}>
                    Pass · commission
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {finalise ? (
        <Dialog
          open
          onClose={() => setFinalise(null)}
          icon={finalise === "PASSED" ? <ShieldCheck className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          title={finalise === "PASSED" ? "Commission this site?" : "Record this attempt as failed?"}
          subtitle={`${inst.transformerName} · attempt ${a.attemptNo}. This is final; the form is locked afterwards.`}
          footer={
            <>
              <Button onClick={() => setFinalise(null)}>Back</Button>
              <Button variant={finalise === "PASSED" ? "primary" : "danger"} busy={busy === "final"} onClick={() => void doFinalise()}>
                {finalise === "PASSED" ? "Yes, commissioned" : "Yes, failed"}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {finalise === "PASSED" && signed < SIGNATORIES.length ? <Notice tone="warn">Only {signed} of {SIGNATORIES.length} signatures captured. You can still pass it, but the PDF will show the missing ones as blank.</Notice> : null}
            <Field label={finalise === "PASSED" ? "Note (optional)" : "What failed and what must be fixed?"}>
              <textarea className={`${inputCls} h-24 py-2`} value={finalNote} onChange={(e) => setFinalNote(e.target.value)} />
            </Field>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
