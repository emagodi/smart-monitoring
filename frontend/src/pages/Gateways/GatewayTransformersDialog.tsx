import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ExternalLink, Loader2, MapPin, Radio, Ruler, Signal, Zap } from "lucide-react";
import { Dialog, Notice, timeAgo } from "../../components/ui/page";
import { cachedGet } from "../../lib/cache";
import { displayPartner } from "../../lib/brand";
import { useGeography } from "../Registry/geo";
import { apiError } from "../Response/shared";
import { distanceKm, fmtCoord, fmtDistance, toLatLng, type LatLng } from "../../lib/distance";

const API = import.meta.env.VITE_API_BASE_URL || "";

type Row = {
  transformerId: number;
  transformerName: string;
  transformerNumber?: string | null;
  depotId?: number | null;
  supplierName?: string | null;
  devEui?: string | null;
  lastHeardAt?: string | null;
  firstHeardAt?: string | null;
  lastRssi?: number | null;
  lastSnr?: number | null;
  uplinks?: number | null;
  gatewaysHearing?: number | null;
  lastTelemetryAt?: string | null;
  source: "UPLINK" | "MANUAL";
  notes?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
};

type GatewayInfo = { id: number; name: string; latitude?: number | string | null; longitude?: number | string | null };
type SortKey = "heard" | "distance" | "signal" | "name";

/** Signal quality from RSSI (dBm): what a field technician would call it. */
const quality = (rssi?: number | null) => {
  if (rssi == null) return { label: "—", bars: 0, tone: "text-slate-400" };
  if (rssi >= -90) return { label: "Strong", bars: 4, tone: "text-emerald-600" };
  if (rssi >= -105) return { label: "Good", bars: 3, tone: "text-emerald-600" };
  if (rssi >= -115) return { label: "Weak", bars: 2, tone: "text-amber-600" };
  return { label: "Very weak", bars: 1, tone: "text-red-600" };
};

function Bars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`w-1 rounded-sm ${i <= n ? "bg-current" : "bg-slate-200 dark:bg-slate-700"}`} style={{ height: 3 + i * 3 }} />
      ))}
    </span>
  );
}

/** Transformers whose devices are heard through a gateway (learnt automatically from every uplink). */
export default function GatewayTransformersDialog({
  gateway,
  token,
  onClose,
}: {
  gateway: { id: number; name: string } | null;
  token: string | null | undefined;
  onClose: () => void;
}) {
  const geo = useGeography(token ?? null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [gw, setGw] = useState<GatewayInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "heard", dir: -1 });

  useEffect(() => {
    if (!gateway || !token) return;
    setRows(null);
    setGw(null);
    setError(null);
    cachedGet<{ gateway?: GatewayInfo; transformers: Row[] }>(`${API}/api/v1/gateways/${gateway.id}/transformers`, token, 20_000, true)
      .then((r) => {
        setGw(r?.gateway ?? null);
        setRows(r?.transformers ?? []);
      })
      .catch((e) => setError(apiError(e, "Could not load the transformers on this gateway.")));
  }, [gateway, token]);

  const gwPoint: LatLng | null = gw ? toLatLng(gw.latitude, gw.longitude) : null;
  const view = useMemo(() => {
    const withKm = (rows ?? []).map((r) => {
      const p = toLatLng(r.lat, r.lng);
      return { r, p, km: p && gwPoint ? distanceKm(gwPoint, p) : null };
    });
    const val = (x: (typeof withKm)[number]): number | string | null => {
      switch (sort.key) {
        case "distance": return x.km;
        case "signal": return x.r.lastRssi ?? null;
        case "name": return (x.r.transformerName || "").toLowerCase();
        default: return x.r.lastHeardAt ? new Date(x.r.lastHeardAt).getTime() : null;
      }
    };
    return withKm.sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1; // blanks always last
      if (vb == null) return -1;
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [rows, gwPoint?.lat, gwPoint?.lng, sort.key, sort.dir]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!gateway) return null;
  const kms = view.map((v) => v.km).filter((k): k is number => k != null);
  const farthest = kms.length ? Math.max(...kms) : null;
  const avg = kms.length ? kms.reduce((a, b) => a + b, 0) / kms.length : null;
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" || key === "distance" ? 1 : -1 }));
  const SortBtn = ({ k, children, className = "" }: { k: SortKey; children: string; className?: string }) => (
    <button type="button" onClick={() => toggle(k)} className={`inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200 ${sort.key === k ? "text-slate-800 dark:text-slate-100" : ""} ${className}`}>
      {children}
      {sort.key === k ? sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
    </button>
  );
  const recent = (rows ?? []).filter((r) => r.lastHeardAt && Date.now() - new Date(r.lastHeardAt).getTime() < 24 * 3600_000).length;

  return (
    <Dialog open onClose={onClose} width="max-w-6xl" icon={<Radio className="h-5 w-5" />} title={`Transformers on ${gateway.name}`} subtitle="Devices whose uplinks this gateway received, with the signal it last heard them at. Learnt automatically from every message.">
      {error ? <Notice>{error}</Notice> : null}
      {!rows && !error ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows && rows.length === 0 ? (
        <div className="py-10 text-center">
          <Radio className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">No transformer has been heard through this gateway yet</p>
          <p className="text-xs text-slate-500">Links appear after the first uplink from a device linked to a transformer.</p>
        </div>
      ) : rows ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Transformers", rows.length],
              ["Heard in last 24 h", recent],
              ["Also heard by other gateways", rows.filter((r) => (r.gatewaysHearing ?? 0) > 1).length],
              ["Distance (avg · farthest)", gwPoint ? (kms.length ? `${fmtDistance(avg)} · ${fmtDistance(farthest)}` : "No transformer coordinates") : "Gateway has no coordinates"],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-900">
                <p className="text-[11px] text-slate-500">{k}</p>
                <p className={`font-semibold text-slate-900 dark:text-slate-100 ${typeof v === "number" ? "text-lg" : "truncate pt-1 text-sm"}`}>{v}</p>
              </div>
            ))}
          </div>
          <div className="hidden items-center gap-3 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:flex">
            <span className="w-9" />
            <SortBtn k="name" className="flex-1">Transformer</SortBtn>
            <SortBtn k="distance" className="w-40">Distance from gateway</SortBtn>
            <SortBtn k="signal" className="w-24">Signal</SortBtn>
            <SortBtn k="heard" className="w-28 justify-end">Last heard</SortBtn>
            <span className="w-7" />
          </div>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {view.map(({ r, p, km }) => {
              const q = quality(r.lastRssi);
              const stale = !r.lastHeardAt || Date.now() - new Date(r.lastHeardAt).getTime() > 24 * 3600_000;
              return (
                <li key={`${r.transformerId}-${r.source}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${stale ? "bg-slate-100 text-slate-400 dark:bg-slate-800" : "bg-blue-50 text-blue-600 dark:bg-blue-500/10"}`}>
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {r.transformerName}
                      {r.transformerNumber ? <span className="ml-1 text-xs font-normal text-slate-500">No. {r.transformerNumber}</span> : null}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {r.depotId ? geo.pathOf(r.depotId).depotName : "No depot"}
                      {r.supplierName ? ` · ${displayPartner(r.supplierName)}` : ""}
                      {r.devEui ? ` · ${r.devEui}` : ""}
                      {r.source === "MANUAL" ? " · linked by hand" : ""}
                    </p>
                  </div>
                  <div className="w-40 text-xs" title={p ? `Transformer at ${fmtCoord(p)}${gwPoint ? `\nGateway at ${fmtCoord(gwPoint)}` : ""}` : undefined}>
                    {km != null ? (
                      <>
                        <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
                          <Ruler className="h-3.5 w-3.5 text-slate-400" /> {fmtDistance(km)}
                        </span>
                        <span className="text-[10px] text-slate-500">straight line</span>
                      </>
                    ) : (
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <MapPin className="h-3.5 w-3.5" /> {!gwPoint ? "Gateway has no coordinates" : "No coordinates"}
                      </span>
                    )}
                  </div>
                  <div className={`w-24 text-xs ${q.tone}`}>
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Bars n={q.bars} /> {q.label}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {r.lastRssi != null ? `${r.lastRssi} dBm` : ""}
                      {r.lastSnr != null ? ` · SNR ${r.lastSnr}` : ""}
                    </span>
                  </div>
                  <div className="w-28 text-right text-xs">
                    <p className={stale ? "text-amber-600" : "text-slate-700 dark:text-slate-200"}>{r.lastHeardAt ? timeAgo(r.lastHeardAt) : "—"}</p>
                    <p className="text-[10px] text-slate-500">
                      {r.uplinks ? `${r.uplinks} uplinks` : ""}
                      {(r.gatewaysHearing ?? 0) > 1 ? ` · ${r.gatewaysHearing} gateways` : ""}
                    </p>
                  </div>
                  <Link to={`/transformer/${r.transformerId}`} onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800" title="Open transformer">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Signal className="h-3.5 w-3.5" /> Signal: strong ≥ −90 dBm · good ≥ −105 · weak ≥ −115. A transformer heard by several gateways keeps reporting if one goes offline. Distance is the straight line between the saved coordinates.
          </p>
        </div>
      ) : null}
    </Dialog>
  );
}
