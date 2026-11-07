import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, ClipboardCheck, Download, FileText, History, Loader2, MapPin, Plus, XCircle } from "lucide-react";
import { Button, Notice, Panel } from "../../components/ui/page";
import { cachedGet } from "../../lib/cache";
import { useGeography } from "../Registry/geo";
import { apiError } from "../Response/shared";
import { CancelInstallDialog, NextStep, ReadyDialog, ScheduleDialog, StatusBadge, Stepper, Timeline } from "./components";
import { downloadPatPdf } from "./patPdf";
import { API, daysBetween, fmtDate, fmtDateTime, lifecyclePost, who, useLifecycleRights, type Attempt, type InstallationDetail as Detail } from "./shared";

export default function InstallationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rights = useLifecycleRights();
  const { token, isPartner } = rights;
  const geo = useGeography(token ?? null);
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"ready" | "schedule" | "cancel" | null>(null);
  const [pdfBusy, setPdfBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setD(await cachedGet<Detail>(`${API}/installations/${id}`, token, 0, true));
    } catch (e) {
      setError(apiError(e, "Could not load this installation."));
    }
  }, [id, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const done = (msg: string) => {
    setDialog(null);
    setNotice(msg);
    void load();
  };

  const openForm = async () => {
    if (!d) return;
    try {
      const a = await lifecyclePost<{ id: number }>(token, `/installations/${d.id}/attempts`);
      navigate(`/installations/${d.id}/attempts/${a.id}`);
    } catch (e) {
      setError(apiError(e, "Could not open the commissioning form."));
    }
  };

  const pdf = async (attemptId: number) => {
    setPdfBusy(attemptId);
    try {
      const a = await cachedGet<Attempt>(`${API}/attempts/${attemptId}`, token, 0, true);
      await downloadPatPdf(a, { depotName: d?.depotId ? geo.pathOf(d.depotId).depotName : undefined });
    } catch (e) {
      setError(apiError(e, "Could not create the PDF."));
    } finally {
      setPdfBusy(null);
    }
  };

  if (!d) {
    return error ? <Notice>{error}</Notice> : <div className="flex items-center gap-2 p-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }
  const path = d.depotId ? geo.pathOf(d.depotId) : null;
  const canAttempt = rights.canPerform && ["READY", "SCHEDULED", "FAILED"].includes(d.status);

  const facts: Array<[string, React.ReactNode]> = [
    ["Partner (contractor)", d.supplierName ?? d.supplierCode ?? "—"],
    ["Depot", path ? `${path.depotName}, ${path.regionName}` : "—"],
    ["Green light", d.requestReference ? <Link className="text-blue-600 hover:underline" to={`/installations?tab=requests`}>{d.requestReference}</Link> : <span className="text-amber-600">None on record</span>],
    ["Installed", `${fmtDate(d.installedOn)}${d.installedBy ? ` · recorded by ${who(d.installedBy)}` : ""}`],
    ["Device", d.deviceEui ?? "—"],
    ["Ready for commissioning", d.readyAt ? `${fmtDateTime(d.readyAt)} · ${who(d.readyBy)}` : "Not yet"],
    ["Tentative date", d.tentativeDate ? `${fmtDate(d.tentativeDate)}${d.scheduledBy ? ` · set by ${who(d.scheduledBy)}` : ""}` : "Not set"],
    ["Commissioned", d.commissionedAt ? `${fmtDateTime(d.commissionedAt)} · ${daysBetween(d.installedOn, d.commissionedAt)} days after install` : "—"],
    ["Attempts", d.attempts],
  ];

  return (
    <div className="space-y-4">
      <Link to="/installations" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300">
        <ArrowLeft className="h-4 w-4" /> Installations
      </Link>

      <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-4 py-4 text-white shadow-[0_18px_40px_-24px_rgba(11,79,196,0.7)] sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">Installation #{d.id}</p>
            <h1 className="mt-0.5 truncate text-xl font-semibold sm:text-2xl">{d.transformerName}</h1>
            <p className="text-sm text-blue-100/80">
              {d.transformerNumber ? `No. ${d.transformerNumber} · ` : ""}
              {d.supplierName ?? d.supplierCode}
              {path ? ` · ${path.depotName}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={d.status} attempts={d.attempts} />
              <span className="text-xs text-blue-100/80">
                <NextStep inst={d} isPartner={isPartner} />
              </span>
            </div>
          </div>
          <div className="hero-actions flex flex-wrap gap-2">
            {rights.canReady && (d.status === "INSTALLED" || d.status === "FAILED") ? (
              <Button variant="primary" icon={<ClipboardCheck className="h-3.5 w-3.5" />} onClick={() => setDialog("ready")}>
                Mark ready for commissioning
              </Button>
            ) : null}
            {rights.canSchedule && ["READY", "SCHEDULED", "FAILED"].includes(d.status) ? (
              <Button icon={<CalendarClock className="h-3.5 w-3.5" />} onClick={() => setDialog("schedule")}>
                {d.tentativeDate ? "Change date" : "Set tentative date"}
              </Button>
            ) : null}
            {canAttempt ? (
              <Button variant="primary" icon={d.openDraftId ? <FileText className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} onClick={() => void openForm()}>
                {d.openDraftId ? "Continue commissioning form" : d.attempts > 0 ? `Start attempt ${d.attempts + 1}` : "Start commissioning"}
              </Button>
            ) : null}
            {d.lat && d.lng ? (
              <Button icon={<MapPin className="h-3.5 w-3.5" />} onClick={() => navigate(`/sites?t=${d.transformerId}`)}>
                Map
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-white/95 px-3 py-3 dark:bg-slate-950/90">
          <Stepper status={d.status} />
        </div>
      </section>

      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {notice ? (
        <Notice tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Panel title="Commissioning attempts" icon={<ClipboardCheck className="h-4 w-4" />} subtitle="Every attempt keeps its own PAT form, signatures and result.">
            {d.attemptHistory.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {d.status === "INSTALLED" ? "Commissioning starts after the partner marks the site ready." : "No attempts yet."}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {d.attemptHistory
                  .slice()
                  .reverse()
                  .map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Attempt {a.attemptNo}
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              a.status === "PASSED" ? "bg-emerald-100 text-emerald-700" : a.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {a.status === "PASSED" ? "Passed" : a.status === "FAILED" ? "Failed" : "Draft"}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Test {fmtDate(a.testDate)} · opened by {who(a.createdBy)}
                          {a.decidedBy ? ` · decided by ${who(a.decidedBy)} ${fmtDateTime(a.decidedAt)}` : ""}
                        </p>
                        {a.decisionNote ? <p className="text-xs text-slate-600 dark:text-slate-300">“{a.decisionNote}”</p> : null}
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} busy={pdfBusy === a.id} onClick={() => void pdf(a.id)}>
                          PDF
                        </Button>
                        {!isPartner ? (
                          <Button size="sm" variant={a.status === "DRAFT" ? "primary" : "secondary"} icon={<FileText className="h-3.5 w-3.5" />} onClick={() => navigate(`/installations/${d.id}/attempts/${a.id}`)}>
                            {a.status === "DRAFT" ? "Continue" : "View"}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </Panel>

          <Panel title="Details">
            <dl className="divide-y divide-slate-100 dark:divide-slate-800">
              {facts.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[150px_1fr] gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-slate-800 dark:text-slate-100">{v}</dd>
                </div>
              ))}
              {d.installNote || d.readyNote || d.scheduleNote ? (
                <div className="space-y-1 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                  {d.installNote ? <p><b>Install:</b> {d.installNote}</p> : null}
                  {d.readyNote ? <p><b>Partner:</b> {d.readyNote}</p> : null}
                  {d.scheduleNote ? <p><b>Schedule:</b> {d.scheduleNote}</p> : null}
                </div>
              ) : null}
            </dl>
            {rights.canRecord && d.status !== "CANCELLED" && d.status !== "COMMISSIONED" ? (
              <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                <Button size="sm" variant="ghost" icon={<XCircle className="h-3.5 w-3.5" />} onClick={() => setDialog("cancel")}>
                  Cancel installation
                </Button>
              </div>
            ) : null}
          </Panel>
        </div>

        <Panel title="Audit trail" icon={<History className="h-4 w-4" />} subtitle="Who did what, when, from which organisation.">
          <div className="p-4">
            <Timeline events={d.events} />
          </div>
        </Panel>
      </div>

      <ReadyDialog inst={dialog === "ready" ? d : null} onClose={() => setDialog(null)} onDone={() => done("Marked ready for commissioning.")} token={token} />
      <ScheduleDialog inst={dialog === "schedule" ? d : null} onClose={() => setDialog(null)} onDone={() => done("Tentative date saved.")} token={token} />
      <CancelInstallDialog inst={dialog === "cancel" ? d : null} onClose={() => setDialog(null)} onDone={() => done("Installation cancelled.")} token={token} />
    </div>
  );
}
