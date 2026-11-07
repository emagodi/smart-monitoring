import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Hammer,
  Plus,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import {
  Button,
  Chips,
  Dialog,
  EmptyRow,
  HeroStat,
  HeroStats,
  MobileFilters,
  Notice,
  PageHero,
  Pager,
  Panel,
  SearchBox,
  SelectBox,
  SkeletonRows,
  tableCls,
} from "../../components/ui/page";
import { cachedGet } from "../../lib/cache";
import { useGeography } from "../Registry/geo";
import {
  CancelInstallDialog,
  DecideRequestDialog,
  NewRequestDialog,
  NextStep,
  ReadyDialog,
  RecordInstallDialog,
  RequestBadge,
  ScheduleDialog,
  StatusBadge,
  Timeline,
  usePartners,
} from "./components";
import { API, fmtDate, lifecyclePost, STATUS_META, useLifecycleRights, type InstallRequest, type InstallStatus, type Installation, type Paged, type RequestStatus } from "./shared";
import { apiError } from "../Response/shared";

type Tab = "installations" | "requests";
type StatusFilter = InstallStatus | "ALL" | "OPEN";

export default function InstallationsPage() {
  const rights = useLifecycleRights();
  const { token, isPartner, isDepot } = rights;
  const geo = useGeography(token ?? null);
  const partners = usePartners(token);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "installations");

  // ---- filters (shared by both tabs)
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [regionId, setRegionId] = useState("");
  const [depotId, setDepotId] = useState("");
  const [partner, setPartner] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateField, setDateField] = useState("installed");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) || "OPEN");
  const [reqStatus, setReqStatus] = useState<RequestStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const depotIds = useMemo(() => {
    if (depotId) return depotId;
    if (!regionId) return "";
    return geo.depots
      .filter((d) => geo.pathOf(d.id).regionId === Number(regionId))
      .map((d) => d.id)
      .join(",");
  }, [depotId, regionId, geo]);

  const qs = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), size: String(size) });
    if (debounced) p.set("q", debounced);
    if (depotIds) p.set("depotIds", depotIds);
    if (partner) p.set("supplierCode", partner);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (tab === "installations") {
      p.set("dateField", dateField);
      if (status === "OPEN") p.set("status", "INSTALLED,READY,SCHEDULED,FAILED");
      else if (status !== "ALL") p.set("status", status);
    } else if (reqStatus !== "ALL") p.set("status", reqStatus);
    return p.toString();
  }, [page, size, debounced, depotIds, partner, from, to, tab, dateField, status, reqStatus]);

  const filterKey = qs.replace(/(^|&)page=\d+/, "");
  const [lastKey, setLastKey] = useState(filterKey);
  if (filterKey !== lastKey) {
    setLastKey(filterKey);
    if (page !== 0) setPage(0);
  }

  const [installs, setInstalls] = useState<Paged<Installation> | null>(null);
  const [requests, setRequests] = useState<Paged<InstallRequest> | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(
    async (force = false) => {
      if (!token) return;
      const s = ++seq.current;
      setLoading(true);
      try {
        const url = `${API}/${tab === "installations" ? "installations" : "requests"}?${qs}`;
        const r = await cachedGet<Paged<Installation> & Paged<InstallRequest>>(url, token, 15_000, force);
        if (s !== seq.current) return;
        if (tab === "installations") setInstalls(r as Paged<Installation>);
        else setRequests(r as Paged<InstallRequest>);
        setError(null);
        const pend = await cachedGet<Paged<InstallRequest>>(`${API}/requests?status=PENDING&size=1`, token, 15_000, force).catch(() => null);
        if (s === seq.current) setPendingCount(pend?.totalElements ?? 0);
      } catch (e) {
        if (s === seq.current) setError(apiError(e, "Could not load installations."));
      } finally {
        if (s === seq.current) setLoading(false);
      }
    },
    [qs, tab, token]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    const next = new URLSearchParams(params);
    next.set("tab", tab);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ---- dialogs
  const [newRequest, setNewRequest] = useState(false);
  const [recordFor, setRecordFor] = useState<InstallRequest | null | undefined>(undefined);
  const [readyFor, setReadyFor] = useState<Installation | null>(null);
  const [scheduleFor, setScheduleFor] = useState<Installation | null>(null);
  const [cancelFor, setCancelFor] = useState<Installation | null>(null);
  const [decide, setDecide] = useState<{ r: InstallRequest; approve: boolean } | null>(null);
  const [openRequest, setOpenRequest] = useState<InstallRequest | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = (msg?: string) => {
    if (msg) setNotice(msg);
    void load(true);
  };

  const showRequest = async (id: number) => {
    try {
      setOpenRequest(await cachedGet<InstallRequest>(`${API}/requests/${id}`, token, 0, true));
    } catch (e) {
      setError(apiError(e, "Could not open the request."));
    }
  };

  const startCommissioning = async (inst: Installation) => {
    try {
      const a = await lifecyclePost<{ id: number }>(token, `/installations/${inst.id}/attempts`);
      navigate(`/installations/${inst.id}/attempts/${a.id}`);
    } catch (e) {
      setError(apiError(e, "Could not open the commissioning form."));
    }
  };

  const counts = installs?.counts ?? {};
  const c = (s: InstallStatus) => counts[s] ?? 0;
  const openTotal = c("INSTALLED") + c("READY") + c("SCHEDULED") + c("FAILED");
  const anyFilter = Boolean(q || regionId || depotId || partner || from || to);

  const statusOptions: Array<{ value: StatusFilter; label: string; count?: number; dot?: string }> = [
    { value: "OPEN", label: "In progress", count: openTotal },
    ...(["INSTALLED", "READY", "SCHEDULED", "FAILED", "COMMISSIONED"] as InstallStatus[]).map((s) => ({ value: s as StatusFilter, label: STATUS_META[s].short, count: c(s), dot: STATUS_META[s].dot })),
    { value: "CANCELLED", label: "Cancelled", count: c("CANCELLED") },
    { value: "ALL", label: "All" },
  ];

  const actionsFor = (i: Installation) => {
    const out: ReactElement[] = [];
    if (rights.canReady && (i.status === "INSTALLED" || i.status === "FAILED"))
      out.push(
        <Button key="ready" size="sm" variant="primary" icon={<ClipboardCheck className="h-3.5 w-3.5" />} onClick={() => setReadyFor(i)}>
          Mark ready
        </Button>
      );
    if (rights.canSchedule && (i.status === "READY" || i.status === "SCHEDULED" || i.status === "FAILED"))
      out.push(
        <Button key="sched" size="sm" variant={i.status === "READY" ? "primary" : "secondary"} icon={<CalendarClock className="h-3.5 w-3.5" />} onClick={() => setScheduleFor(i)}>
          {i.tentativeDate ? "Change date" : "Set date"}
        </Button>
      );
    if (rights.canPerform && (i.status === "SCHEDULED" || i.status === "READY" || i.status === "FAILED"))
      out.push(
        <Button key="comm" size="sm" variant={i.status === "SCHEDULED" ? "primary" : "secondary"} icon={<FileText className="h-3.5 w-3.5" />} onClick={() => void startCommissioning(i)}>
          {i.openDraftId ? "Continue form" : i.attempts > 0 ? `Attempt ${i.attempts + 1}` : "Commission"}
        </Button>
      );
    return out;
  };

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Installation & commissioning"
        title={isPartner ? `My installations${rights.supplierName ? ` · ${rights.supplierName}` : ""}` : "Installations"}
        subtitle={
          isPartner
            ? "Transformers your team installed. Test each site, then mark it ready for commissioning; ZESA agrees a date and Loss Control signs it off."
            : "Green light from the region and depot → installed by the partner → ready for commissioning → tentative date → commissioning test (PAT) signed off by Loss Control."
        }
        actions={
          <>
            {rights.canRequest && !isPartner ? (
              <Button icon={<Building2 className="h-3.5 w-3.5" />} onClick={() => setNewRequest(true)}>
                Ask for green light
              </Button>
            ) : null}
            {rights.canRecord ? (
              <Button variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setRecordFor(null)}>
                Record installation
              </Button>
            ) : null}
          </>
        }
      >
        <HeroStats cols={6}>
          <HeroStat icon={<Building2 className="h-3.5 w-3.5" />} label="Awaiting green light" value={pendingCount} tone={pendingCount ? "warn" : undefined} onClick={() => { setTab("requests"); setReqStatus("PENDING"); }} active={tab === "requests" && reqStatus === "PENDING"} />
          <HeroStat icon={<Hammer className="h-3.5 w-3.5" />} label="Installed" value={c("INSTALLED")} loading={!installs && loading} onClick={() => { setTab("installations"); setStatus("INSTALLED"); }} active={tab === "installations" && status === "INSTALLED"} />
          <HeroStat icon={<ClipboardCheck className="h-3.5 w-3.5" />} label="Ready for commissioning" value={c("READY")} tone={c("READY") ? "warn" : undefined} loading={!installs && loading} onClick={() => { setTab("installations"); setStatus("READY"); }} active={tab === "installations" && status === "READY"} />
          <HeroStat icon={<CalendarClock className="h-3.5 w-3.5" />} label="Scheduled" value={c("SCHEDULED")} loading={!installs && loading} onClick={() => { setTab("installations"); setStatus("SCHEDULED"); }} active={tab === "installations" && status === "SCHEDULED"} />
          <HeroStat icon={<XCircle className="h-3.5 w-3.5" />} label="Failed, to retest" value={c("FAILED")} tone={c("FAILED") ? "bad" : undefined} loading={!installs && loading} onClick={() => { setTab("installations"); setStatus("FAILED"); }} active={tab === "installations" && status === "FAILED"} />
          <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Commissioned" value={c("COMMISSIONED")} tone="good" loading={!installs && loading} onClick={() => { setTab("installations"); setStatus("COMMISSIONED"); }} active={tab === "installations" && status === "COMMISSIONED"} />
        </HeroStats>
      </PageHero>

      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {notice ? (
        <Notice tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Notice>
      ) : null}

      <div className="flex gap-1 rounded-full border border-slate-200 bg-white p-1 text-sm font-semibold sm:w-fit dark:border-slate-800 dark:bg-slate-900">
        {([
          ["installations", "Installations", openTotal],
          ["requests", "Green light requests", pendingCount],
        ] as Array<[Tab, string, number]>).map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`flex-1 rounded-full px-4 py-1.5 transition sm:flex-none ${tab === k ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            {label}
            {n ? <span className={`ml-1.5 rounded-full px-1.5 text-[10px] ${tab === k ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"}`}>{n}</span> : null}
          </button>
        ))}
      </div>

      <Panel
        toolbar={
          <div className="flex w-full flex-col gap-2.5">
            {tab === "installations" ? (
              <Chips value={status} onChange={setStatus} options={statusOptions} />
            ) : (
              <Chips
                value={reqStatus}
                onChange={setReqStatus}
                options={[
                  { value: "ALL", label: "All", count: requests?.totalElements },
                  ...(["PENDING", "APPROVED", "DECLINED", "CANCELLED"] as RequestStatus[]).map((s) => ({ value: s as RequestStatus | "ALL", label: s.charAt(0) + s.slice(1).toLowerCase(), count: requests?.counts?.[s] ?? 0 })),
                ]}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder={tab === "installations" ? "Transformer, number, device EUI…" : "Reference, depot, site…"} className="max-w-sm" />
              <MobileFilters active={[regionId, depotId, partner, from, to].filter(Boolean).length}>
                {!isDepot && !isPartner ? (
                  <SelectBox label="Region" value={regionId} onChange={(v) => { setRegionId(v); setDepotId(""); }}>
                    <option value="">All</option>
                    {geo.regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
                {!isDepot ? (
                  <SelectBox label="Depot" value={depotId} onChange={setDepotId}>
                    <option value="">All</option>
                    {geo.depots
                      .filter((d) => !regionId || geo.pathOf(d.id).regionId === Number(regionId))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </SelectBox>
                ) : null}
                {!isPartner ? (
                  <SelectBox label="Partner" value={partner} onChange={setPartner}>
                    <option value="">All</option>
                    {partners.map(([code, name]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </SelectBox>
                ) : null}
                {tab === "installations" ? (
                  <SelectBox label="Date" value={dateField} onChange={setDateField}>
                    <option value="installed">Installed</option>
                    <option value="ready">Ready</option>
                    <option value="tentative">Tentative date</option>
                    <option value="commissioned">Commissioned</option>
                  </SelectBox>
                ) : null}
                <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  From
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
                </label>
                <label className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                  To
                  <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="bg-transparent text-sm text-slate-800 outline-none dark:text-slate-100" />
                </label>
                {anyFilter ? (
                  <Button size="sm" variant="ghost" onClick={() => { setQ(""); setRegionId(""); setDepotId(""); setPartner(""); setFrom(""); setTo(""); }}>
                    Clear
                  </Button>
                ) : null}
              </MobileFilters>
            </div>
          </div>
        }
      >
        {tab === "installations" ? (
          <>
            <div className={tableCls.wrap}>
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>Transformer</th>
                    {!isPartner ? <th className={tableCls.th}>Partner</th> : null}
                    <th className={tableCls.th}>Depot</th>
                    <th className={tableCls.th}>Installed</th>
                    <th className={tableCls.th}>Status</th>
                    <th className={tableCls.th}>Commissioning</th>
                    <th className={`${tableCls.th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tableCls.tbody}>
                  {loading && !installs ? (
                    <SkeletonRows rows={6} cols={isPartner ? 6 : 7} />
                  ) : !installs?.content.length ? (
                    <EmptyRow cols={isPartner ? 6 : 7}>
                      {status === "OPEN" ? "Nothing in progress. Installations appear here once Powertel records them." : "No installations match these filters."}
                    </EmptyRow>
                  ) : (
                    installs.content.map((i) => (
                      <tr key={i.id} className={`${tableCls.tr} cursor-pointer`} onClick={() => navigate(`/installations/${i.id}`)}>
                        <td className={tableCls.td} data-label="Transformer">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{i.transformerName}</p>
                          <p className="text-[11px] text-slate-500">
                            {i.transformerNumber ? `No. ${i.transformerNumber}` : "No number"}
                            {i.requestReference ? ` · ${i.requestReference}` : ""}
                          </p>
                        </td>
                        {!isPartner ? (
                          <td className={tableCls.td} data-label="Partner">
                            {i.supplierName ?? i.supplierCode ?? "—"}
                          </td>
                        ) : null}
                        <td className={tableCls.td} data-label="Depot">
                          <p>{i.depotId ? geo.pathOf(i.depotId).depotName : "—"}</p>
                          <p className="text-[11px] text-slate-500">{i.depotId ? geo.pathOf(i.depotId).regionName : ""}</p>
                        </td>
                        <td className={`${tableCls.td} whitespace-nowrap`} data-label="Installed">
                          {fmtDate(i.installedOn)}
                        </td>
                        <td className={tableCls.td} data-label="Status">
                          <StatusBadge status={i.status} attempts={i.attempts} />
                        </td>
                        <td className={tableCls.td} data-label="Commissioning">
                          <NextStep inst={i} isPartner={isPartner} />
                        </td>
                        <td className={`${tableCls.td} text-right`} data-actions onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {actionsFor(i)}
                            <Link to={`/installations/${i.id}`} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" aria-label="Open">
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {installs && installs.totalElements > 0 ? <Pager page={page} pageSize={size} total={installs.totalElements} onPage={setPage} onPageSize={setSize} /> : null}
          </>
        ) : (
          <>
            <div className={tableCls.wrap}>
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>Request</th>
                    <th className={tableCls.th}>Region / depot</th>
                    <th className={tableCls.th}>Planned</th>
                    {!isPartner ? <th className={tableCls.th}>Partner</th> : null}
                    <th className={tableCls.th}>Sites</th>
                    <th className={tableCls.th}>Status</th>
                    <th className={`${tableCls.th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={tableCls.tbody}>
                  {loading && !requests ? (
                    <SkeletonRows rows={5} cols={7} />
                  ) : !requests?.content.length ? (
                    <EmptyRow cols={7}>No green-light requests{reqStatus !== "ALL" ? ` that are ${reqStatus.toLowerCase()}` : ""}.</EmptyRow>
                  ) : (
                    requests.content.map((r) => (
                      <tr key={r.id} className={`${tableCls.tr} cursor-pointer`} onClick={() => void showRequest(r.id)}>
                        <td className={tableCls.td} data-label="Request">
                          <p className="font-mono text-[12px] font-semibold text-slate-900 dark:text-slate-100">{r.reference}</p>
                          <p className="text-[11px] capitalize text-slate-500">by {(r.requestedBy ?? "").split("@")[0].replace(/[._]/g, " ")}</p>
                        </td>
                        <td className={tableCls.td} data-label="Region / depot">
                          <p>{r.depotName ?? "—"}</p>
                          <p className="text-[11px] text-slate-500">{r.regionName ?? ""}</p>
                        </td>
                        <td className={`${tableCls.td} whitespace-nowrap`} data-label="Planned">
                          {fmtDate(r.plannedDate)}
                          {r.plannedEndDate ? <span className="text-slate-400"> → {fmtDate(r.plannedEndDate)}</span> : null}
                        </td>
                        {!isPartner ? (
                          <td className={tableCls.td} data-label="Partner">
                            {r.supplierName ?? "—"}
                          </td>
                        ) : null}
                        <td className={tableCls.td} data-label="Sites">
                          <span className="font-semibold">{r.installedCount ?? 0}</span>
                          <span className="text-slate-400"> / {r.itemCount ?? 0} installed</span>
                        </td>
                        <td className={tableCls.td} data-label="Status">
                          <RequestBadge status={r.status} />
                        </td>
                        <td className={`${tableCls.td} text-right`} data-actions onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {rights.canApprove && r.status === "PENDING" ? (
                              <>
                                <Button size="sm" variant="primary" icon={<ThumbsUp className="h-3.5 w-3.5" />} onClick={() => setDecide({ r, approve: true })}>
                                  Approve
                                </Button>
                                <Button size="sm" icon={<ThumbsDown className="h-3.5 w-3.5" />} onClick={() => setDecide({ r, approve: false })}>
                                  Decline
                                </Button>
                              </>
                            ) : null}
                            {rights.canRecord && r.status === "APPROVED" && (r.installedCount ?? 0) < (r.itemCount ?? 0) ? (
                              <Button
                                size="sm"
                                variant="primary"
                                icon={<Hammer className="h-3.5 w-3.5" />}
                                onClick={async () => setRecordFor(await cachedGet<InstallRequest>(`${API}/requests/${r.id}`, token, 0, true))}
                              >
                                Record installs
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {requests && requests.totalElements > 0 ? <Pager page={page} pageSize={size} total={requests.totalElements} onPage={setPage} onPageSize={setSize} /> : null}
          </>
        )}
      </Panel>

      <NewRequestDialog open={newRequest} onClose={() => setNewRequest(false)} onDone={(r) => { setTab("requests"); reload(`${r.reference} sent to ${r.depotName ?? "the depot"} for the green light.`); }} token={token} isPartner={isPartner} lockedDepotId={isDepot ? rights.depotId : null} />
      <RecordInstallDialog open={recordFor !== undefined} request={recordFor ?? null} onClose={() => setRecordFor(undefined)} onDone={() => { setRecordFor(undefined); setTab("installations"); setStatus("INSTALLED"); reload("Installation recorded. The partner can now test and mark the site ready."); }} token={token} />
      <ReadyDialog inst={readyFor} onClose={() => setReadyFor(null)} onDone={() => { setReadyFor(null); reload("Marked ready for commissioning. ZESA will agree a date."); }} token={token} />
      <ScheduleDialog inst={scheduleFor} onClose={() => setScheduleFor(null)} onDone={() => { setScheduleFor(null); reload("Tentative commissioning date saved."); }} token={token} />
      <CancelInstallDialog inst={cancelFor} onClose={() => setCancelFor(null)} onDone={() => { setCancelFor(null); reload("Installation cancelled."); }} token={token} />
      {decide ? (
        <DecideRequestDialog
          request={decide.r}
          approve={decide.approve}
          onClose={() => setDecide(null)}
          onDone={() => {
            setDecide(null);
            setOpenRequest(null);
            reload(decide.approve ? "Green light given. Powertel can now install." : "Request declined.");
          }}
          token={token}
        />
      ) : null}

      {openRequest ? (
        <Dialog
          open
          onClose={() => setOpenRequest(null)}
          width="max-w-2xl"
          icon={<Building2 className="h-5 w-5" />}
          title={openRequest.reference}
          subtitle={`${openRequest.depotName ?? "Depot"}, ${openRequest.regionName ?? ""} · planned ${fmtDate(openRequest.plannedDate)}${openRequest.supplierName ? ` · ${openRequest.supplierName}` : ""}`}
          footer={
            <>
              {rights.canRequest && openRequest.status === "PENDING" ? (
                <Button
                  onClick={async () => {
                    try {
                      await lifecyclePost(token, `/requests/${openRequest.id}/cancel`, {});
                      setOpenRequest(null);
                      reload("Request cancelled.");
                    } catch (e) {
                      setError(apiError(e, "Could not cancel."));
                    }
                  }}
                >
                  Cancel request
                </Button>
              ) : null}
              {rights.canApprove && openRequest.status === "PENDING" ? (
                <>
                  <Button icon={<ThumbsDown className="h-3.5 w-3.5" />} onClick={() => setDecide({ r: openRequest, approve: false })}>
                    Decline
                  </Button>
                  <Button variant="primary" icon={<ThumbsUp className="h-3.5 w-3.5" />} onClick={() => setDecide({ r: openRequest, approve: true })}>
                    Approve
                  </Button>
                </>
              ) : null}
              {rights.canRecord && openRequest.status === "APPROVED" ? (
                <Button variant="primary" icon={<Hammer className="h-3.5 w-3.5" />} onClick={() => { setRecordFor(openRequest); setOpenRequest(null); }}>
                  Record installs
                </Button>
              ) : null}
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <RequestBadge status={openRequest.status} />
              {openRequest.decisionNote ? <span className="text-xs text-slate-500">“{openRequest.decisionNote}”</span> : null}
            </div>
            {openRequest.accessNote ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Switching / access</p>
                {openRequest.accessNote}
              </div>
            ) : null}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sites ({openRequest.items?.length ?? 0})</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {(openRequest.items ?? []).map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{it.transformerName ?? it.siteLabel}</span>
                      {it.transformerNumber ? <span className="ml-1 text-xs text-slate-500">No. {it.transformerNumber}</span> : null}
                      {!it.transformerId ? <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-700">not in registry yet</span> : null}
                    </span>
                    {it.installationStatus ? (
                      <Link to={`/installations/${it.installationId}`} onClick={() => setOpenRequest(null)}>
                        <StatusBadge status={it.installationStatus} />
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">Not installed</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">History</p>
              <Timeline events={openRequest.events ?? []} />
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
