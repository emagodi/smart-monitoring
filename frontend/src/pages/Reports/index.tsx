import type { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Flame, Hammer, Router, Wrench } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { PageHero } from "../../components/ui/page";
import GatewayReport from "./GatewayReport";
import { CommissioningReport, FaultsReport, InstallationsReport } from "./TableReports";

type Entry = { id: string; title: string; description: string; icon: ReactNode; formats: string[]; allowed: boolean; to?: string; view?: ReactNode };

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const { isPartner } = useScope();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const alarms = hasPermission("alerts.read") || hasPermission("response.read") || hasPermission("reports.read") || isPartner;
  const entries: Entry[] = [
    {
      id: "installations",
      title: "Installations",
      description: "Which partner installed on which transformer and when, with the commissioning status of each site. Date, region, depot and partner filters.",
      icon: <Hammer className="h-5 w-5" />,
      formats: ["PDF", "CSV"],
      allowed: hasPermission("installations.read"),
      view: <InstallationsReport />,
    },
    {
      id: "commissioning",
      title: "Commissioning attempts",
      description: "Every PAT attempt with its result, who decided it and why; pass rate and first-time pass rate.",
      icon: <ClipboardCheck className="h-5 w-5" />,
      formats: ["PDF", "CSV"],
      allowed: hasPermission("commissioning.read") || hasPermission("installations.read"),
      view: <CommissioningReport />,
    },
    {
      id: "alarms",
      title: "Alarms, false alarms & heat map",
      description: "Where alarms happen and how they ended, per partner and depot: real threats, false alarms, technical faults and reaction times.",
      icon: <Flame className="h-5 w-5" />,
      formats: ["Map", "PDF", "CSV"],
      allowed: alarms,
      to: "/alarm-insights",
    },
    {
      id: "faults",
      title: "Fault alarms",
      description: "Equipment faults per transformer and partner: what failed, when, and how long it took to fix.",
      icon: <Wrench className="h-5 w-5" />,
      formats: ["PDF", "CSV"],
      allowed: hasPermission("faults.read") || hasPermission("faults.record"),
      view: <FaultsReport />,
    },
    {
      id: "gateways",
      title: "Gateway locations & status",
      description: "Every gateway with its coordinates and whether it is online or offline right now.",
      icon: <Router className="h-5 w-5" />,
      formats: ["PDF", "CSV"],
      allowed: hasPermission("gateways.view") && !isPartner,
      view: <GatewayReport />,
    },
  ].filter((e) => e.allowed);

  const selected = entries.find((e) => e.id === params.get("r"));
  if (selected?.view) {
    return (
      <div className="space-y-3">
        <Link to="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300">
          <ArrowLeft className="h-4 w-4" /> All reports
        </Link>
        {selected.view}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHero eyebrow="Reports" title="Reports" subtitle="Choose a report, narrow it down with the filters, and download it as a PDF (or CSV for Excel). Reports use live data at the moment you open them." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => (r.to ? navigate(r.to) : setParams({ r: r.id }))}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-blue-50/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-600/10 dark:border-slate-800 dark:from-slate-900 dark:to-blue-950/30"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0a2a6b] to-[#0b4fc4] text-white shadow-sm shadow-blue-600/30">{r.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 dark:text-slate-100">{r.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{r.description}</p>
                <div className="mt-2 flex gap-1.5">
                  {r.formats.map((f) => (
                    <span key={f} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </button>
        ))}
        {entries.length === 0 ? <p className="text-sm text-slate-500">No reports are available for your role.</p> : null}
      </div>
    </div>
  );
}
