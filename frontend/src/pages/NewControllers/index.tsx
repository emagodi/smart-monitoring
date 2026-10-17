import { useMemo, useState } from "react";
import axios from "axios";
import { Check, Cpu, Hash, Link2, Pencil, Radio, Search, Signal, Wifi, WifiOff, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { invalidateCache, useCachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { useGeography } from "../Registry/geo";
import {
  Button,
  Chips,
  Dialog,
  EmptyRow,
  HeroButton,
  HeroStat,
  HeroStats,
  Notice,
  PageHero,
  Pager,
  Panel,
  SearchBox,
  SelectBox,
  SkeletonRows,
  inputCls,
  tableCls,
  timeAgo,
} from "../../components/ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";

/** Row of GET /api/v1/controllers/unmatched: devices that reported in but have no transformer. */
type Unmatched = {
  id: number;
  devEui: string;
  deviceId?: string | null;
  name?: string | null;
  type?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  lastReadingAt?: string | null;
  online: boolean;
  battery?: number | null;
  rssi?: number | null;
  createdAt?: string | null;
};

/** Row of GET /api/v1/transformers/registry (only the fields the picker needs). */
type TransformerRow = {
  id: number;
  name: string;
  transformerNumber?: string | null;
  type?: string | null;
  depotId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  controllerEuis: string[];
};

type Filter = "all" | "online" | "silent";

const errText = (e: unknown, fallback: string) => {
  const r = (e as { response?: { data?: { message?: string } | string; status?: number } })?.response;
  if (r?.status === 403) return "Your role cannot link controllers.";
  if (typeof r?.data === "string" && r.data) return r.data;
  return (r?.data as { message?: string } | undefined)?.message || fallback;
};

const label = (c: Unmatched) => (c.name && !/^new controller/i.test(c.name) && !/^controller /i.test(c.name) ? c.name : `Controller ${c.devEui.slice(-8)}`);

/**
 * New controllers: devices our partner feeds heard that are not linked to a transformer yet.
 * Link each one to its transformer (search by transformer name, number or depot).
 */
export default function NewControllersIndex() {
  const { token, hasPermission } = useAuth();
  const geo = useGeography(token);
  const list = useCachedGet<Unmatched[]>(token ? `${API}/api/v1/controllers/unmatched` : null, token, { maxAgeMs: 20_000, errorText: "Could not load new controllers." });
  const reg = useCachedGet<TransformerRow[]>(token ? `${API}/api/v1/transformers/registry` : null, token, { maxAgeMs: 30_000 });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [partner, setPartner] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [assigning, setAssigning] = useState<Unmatched | null>(null);
  const [renaming, setRenaming] = useState<{ c: Unmatched; name: string } | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const canUpdate = hasPermission("controllers.update") || hasPermission("transformers.update");

  const items = list.data ?? [];
  const partners = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of items) if (c.supplierCode) m.set(c.supplierCode, displayPartner(c.supplierName, c.supplierCode));
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items
      .filter((c) => (filter === "online" ? c.online : filter === "silent" ? !c.online : true))
      .filter((c) => !partner || c.supplierCode === partner)
      .filter((c) => !term || [c.devEui, c.name, c.deviceId, c.supplierName].filter(Boolean).some((v) => String(v).toLowerCase().includes(term)))
      .sort((a, b) => Number(b.online) - Number(a.online) || String(b.lastReadingAt ?? "").localeCompare(String(a.lastReadingAt ?? "")));
  }, [filter, items, partner, q]);

  const online = items.filter((c) => c.online).length;
  const shown = rows.slice(page * pageSize, page * pageSize + pageSize);
  const loading = !list.data && !list.error;

  const refresh = () => {
    invalidateCache("/api/v1/controllers/unmatched");
    invalidateCache("/api/v1/transformers/registry");
    void list.reload();
    void reg.reload();
  };

  const saveName = async () => {
    if (!renaming) return;
    const { c, name } = renaming;
    try {
      await axios.put(
        `${API}/api/v1/controllers/${c.id}`,
        { name: name.trim() || label(c), deviceId: c.deviceId || c.devEui, devEui: c.devEui, type: c.type },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      setNotice({ tone: "success", text: `Renamed to ${name.trim()}.` });
      setRenaming(null);
      refresh();
    } catch (e) {
      setNotice({ tone: "error", text: errText(e, "Could not rename the controller.") });
    }
  };

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Operations · New controllers"
        title="New controllers"
        subtitle="Devices our partner feeds have heard that are not linked to a transformer yet. Link each one so its alerts reach the right depot."
        actions={<HeroButton onClick={refresh} busy={list.refreshing || list.loading}>Refresh</HeroButton>}
      >
        <HeroStats cols={4}>
          <HeroStat icon={<Cpu className="h-3.5 w-3.5 text-amber-300" />} label="Waiting" value={items.length.toLocaleString()} sub="not linked to a transformer" tone={items.length ? "warn" : "good"} loading={loading} />
          <HeroStat icon={<Wifi className="h-3.5 w-3.5 text-emerald-300" />} label="Reporting now" value={online.toLocaleString()} sub="heard in the last 15 min" tone="good" loading={loading} />
          <HeroStat icon={<WifiOff className="h-3.5 w-3.5" />} label="Silent" value={(items.length - online).toLocaleString()} sub="not heard recently" loading={loading} />
          <HeroStat icon={<Zap className="h-3.5 w-3.5" />} label="Transformers" value={(reg.data?.length ?? 0).toLocaleString()} sub="available to link to" loading={!reg.data} />
        </HeroStats>
      </PageHero>

      {notice ? (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      ) : null}
      {list.error && !list.data ? <Notice>{list.error}</Notice> : null}

      <Panel
        icon={<Cpu className="h-4 w-4" />}
        title={`${rows.length.toLocaleString()} controller${rows.length === 1 ? "" : "s"} waiting`}
        subtitle="Devices reporting now are listed first."
        toolbar={
          <>
            <SearchBox value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Find by EUI or name…" className="max-w-sm" />
            <Chips<Filter>
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(0);
              }}
              options={[
                { value: "all", label: "All", count: items.length },
                { value: "online", label: "Reporting now", dot: "bg-emerald-500", count: online },
                { value: "silent", label: "Silent", dot: "bg-slate-400", count: items.length - online },
              ]}
            />
            {partners.length > 1 ? (
              <SelectBox value={partner} onChange={(v) => { setPartner(v); setPage(0); }} label="Partner">
                <option value="">All partners</option>
                {partners.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </SelectBox>
            ) : null}
          </>
        }
      >
        <div className={tableCls.wrap}>
          <table className={`${tableCls.table} min-w-[860px]`}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Controller</th>
                <th className={tableCls.th}>Partner</th>
                <th className={tableCls.th}>Last heard</th>
                <th className={tableCls.th}>First seen</th>
                <th className={`${tableCls.th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className={tableCls.tbody}>
              {loading ? <SkeletonRows rows={6} cols={5} /> : null}
              {shown.map((c) => (
                <tr key={c.id} className={tableCls.tr}>
                  <td className={tableCls.td}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">
                        <Cpu className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{label(c)}</p>
                        <p className="font-mono text-[11px] tracking-wide text-slate-500">{c.devEui}</p>
                      </div>
                    </div>
                  </td>
                  <td className={tableCls.td}>{c.supplierCode ? displayPartner(c.supplierName, c.supplierCode) : <span className="text-slate-400">Unknown</span>}</td>
                  <td className={tableCls.td}>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                        c.online
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                          : "bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${c.online ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {c.online ? "Reporting" : "Silent"}
                    </span>
                    <span className="ml-2 text-[11px] text-slate-500">{c.lastReadingAt ? timeAgo(c.lastReadingAt) : "never"}</span>
                    {c.rssi != null ? (
                      <span className="ml-2 inline-flex items-center gap-0.5 text-[11px] text-slate-400" title="Signal strength (RSSI)">
                        <Signal className="h-3 w-3" /> {c.rssi} dBm
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tableCls.td} text-[12px] text-slate-500`}>{c.createdAt ? timeAgo(c.createdAt) : "—"}</td>
                  <td className={`${tableCls.td} text-right`}>
                    {canUpdate ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRenaming({ c, name: label(c) })}
                          title="Rename"
                          className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssigning(c)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-blue-600/25 transition hover:bg-blue-700"
                        >
                          <Link2 className="h-3.5 w-3.5" /> Link to transformer
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">View only</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <EmptyRow cols={5}>{items.length ? "Nothing matches these filters." : "Every controller is linked to a transformer."}</EmptyRow>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pager
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPage={setPage}
          onPageSize={(n) => {
            setPageSize(n);
            setPage(0);
          }}
        />
      </Panel>

      {assigning ? (
        <AssignDialog
          controller={assigning}
          transformers={reg.data ?? []}
          loadingTransformers={!reg.data}
          geo={geo}
          token={token}
          onClose={() => setAssigning(null)}
          onDone={(t) => {
            setNotice({ tone: "success", text: `${label(assigning)} is now linked to ${t.name}. Its alerts go to ${geo.pathOf(t.depotId).depotName}.` });
            setAssigning(null);
            refresh();
          }}
        />
      ) : null}

      <Dialog
        open={Boolean(renaming)}
        onClose={() => setRenaming(null)}
        icon={<Pencil className="h-4 w-4" />}
        title="Rename controller"
        subtitle={renaming ? `Device ${renaming.c.devEui}` : undefined}
        width="max-w-lg"
        footer={
          <>
            <Button size="lg" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button size="lg" variant="primary" icon={<Check className="h-4 w-4" />} onClick={() => void saveName()}>
              Save name
            </Button>
          </>
        }
      >
        {renaming ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Name</span>
            <input
              autoFocus
              value={renaming.name}
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && void saveName()}
              className={`${inputCls} h-12 text-[15px]`}
            />
          </label>
        ) : null}
      </Dialog>
    </div>
  );
}

function AssignDialog({
  controller,
  transformers,
  loadingTransformers,
  geo,
  token,
  onClose,
  onDone,
}: {
  controller: Unmatched;
  transformers: TransformerRow[];
  loadingTransformers: boolean;
  geo: ReturnType<typeof useGeography>;
  token: string | null;
  onClose: () => void;
  onDone: (t: TransformerRow) => void;
}) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<TransformerRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Same partner first, then the rest; search across name, number, depot, district and region.
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    const scored = transformers
      .map((t) => {
        const path = geo.pathOf(t.depotId);
        const hay = [t.name, t.transformerNumber, path.depotName, path.districtName, path.regionName].filter(Boolean).join(" ").toLowerCase();
        return { t, path, ok: !term || hay.includes(term), same: Boolean(controller.supplierCode) && t.supplierCode === controller.supplierCode };
      })
      .filter((x) => x.ok)
      .sort((a, b) => Number(b.same) - Number(a.same) || a.t.name.localeCompare(b.t.name));
    return scored.slice(0, 60);
  }, [controller.supplierCode, geo, q, transformers]);

  const save = async () => {
    if (!picked) return setError("Choose the transformer this controller is fitted to.");
    try {
      setBusy(true);
      setError(null);
      await axios.put(
        `${API}/api/v1/controllers/${controller.id}`,
        { name: controller.name || label(controller), deviceId: controller.deviceId || controller.devEui, devEui: controller.devEui, type: controller.type, transformerId: picked.id },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      onDone(picked);
    } catch (e) {
      setError(errText(e, "Could not link the controller."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      icon={<Link2 className="h-4 w-4" />}
      title="Link controller to a transformer"
      subtitle={`${label(controller)} · ${controller.devEui}`}
      width="max-w-2xl"
      footer={
        <>
          <Button size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" variant="primary" busy={busy} disabled={!picked} icon={<Link2 className="h-4 w-4" />} onClick={() => void save()}>
            {picked ? `Link to ${picked.name}` : "Choose a transformer"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Fact icon={<Radio className="h-3.5 w-3.5" />} label="Partner" value={controller.supplierCode ? displayPartner(controller.supplierName, controller.supplierCode) : "Unknown"} />
          <Fact icon={controller.online ? <Wifi className="h-3.5 w-3.5 text-emerald-600" /> : <WifiOff className="h-3.5 w-3.5" />} label="Last heard" value={controller.lastReadingAt ? timeAgo(controller.lastReadingAt) : "never"} />
          <Fact icon={<Cpu className="h-3.5 w-3.5" />} label="First seen" value={controller.createdAt ? timeAgo(controller.createdAt) : "—"} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Transformer <span className="text-red-500">*</span>
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by transformer name, number or depot…"
              className={`${inputCls} h-12 pl-10 text-[15px]`}
            />
          </div>
          <ul className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            {loadingTransformers ? <li className="px-4 py-3 text-sm text-slate-500">Loading transformers…</li> : null}
            {matches.map(({ t, path, same }) => {
              const on = picked?.id === t.id;
              return (
                <li key={t.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPicked(t)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${on ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600"}`}
                    >
                      {on ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>
                        {t.transformerNumber ? (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Hash className="h-2.5 w-2.5" />
                            {t.transformerNumber}
                          </span>
                        ) : null}
                        {same ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Same partner</span> : null}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {path.depotName} · {path.districtName} · {path.regionName}
                        {t.controllerEuis?.length ? ` · ${t.controllerEuis.length} device${t.controllerEuis.length === 1 ? "" : "s"} already` : " · no device yet"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {!loadingTransformers && matches.length === 0 ? <li className="px-4 py-3 text-sm text-slate-500">No transformer matches “{q}”.</li> : null}
          </ul>
          <p className="text-xs text-slate-500">
            Not in the list? Add it on the Transformers page with “Add from device EUI”, which creates the transformer and links this device in one step.
          </p>
        </div>

        {error ? <Notice>{error}</Notice> : null}
      </div>
    </Dialog>
  );
}

function Fact({ icon, label: l, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        {icon}
        {l}
      </p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
