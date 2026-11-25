import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent as RWheelEvent } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Locate, Minus, Network, Plus, Radio, Ruler, Waypoints, X, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { cachedGet } from "../../lib/cache";
import { useGeography, districtRegionId, depotDistrictId } from "../Registry/geo";
import { HeroStat, HeroStats, Notice, PageHero, SelectBox, fmtNum } from "../../components/ui/page";
import { distanceKm, fmtCoord, fmtDistance, toLatLng, type LatLng } from "../../lib/distance";

const API = import.meta.env.VITE_API_BASE_URL || "";

/* ------------------------------------------------------------------ data */

type GatewayPoint = { id: number; name: string; latitude?: number | string | null; longitude?: number | string | null; effectiveStatus?: string | null; depotId?: number | null; lastSeenAt?: string | null };
type TransformerRow = { id: number; name: string; transformerNumber?: string | null; depotId?: number | null; lat?: number | string | null; lng?: number | string | null; status?: string | null; supplierName?: string | null };
type LinkInfo = { gatewayId: number; name?: string; status?: string; rssi?: number | null };

type Kind = "gateway" | "transformer";
type GNode = LatLng & {
  key: string;
  id: number;
  kind: Kind;
  name: string;
  sub?: string | null;
  status: string;
  depotId: number | null;
  depotInferred?: boolean;
  gatewayId?: number | null;
};
type Edge = { a: number; b: number; km: number; kind: "mesh" | "uplink" };

const STATUS_HEX: Record<string, string> = {
  ONLINE: "#10b981",
  DEGRADED: "#f59e0b",
  DELAYED: "#f59e0b",
  OFFLINE: "#ef4444",
  NEVER_SEEN: "#94a3b8",
  NO_DEVICE: "#cbd5e1",
  UNKNOWN: "#94a3b8",
};
const STATUS_LABEL: Record<string, string> = { ONLINE: "Online", DEGRADED: "Degraded", DELAYED: "Delayed", OFFLINE: "Offline", NEVER_SEEN: "Never seen", NO_DEVICE: "No device", UNKNOWN: "Unknown" };
const hex = (s?: string | null) => STATUS_HEX[(s || "UNKNOWN").toUpperCase()] ?? STATUS_HEX.UNKNOWN;

/* ------------------------------------------------------------- geometry */

/** Minimum spanning tree (Prim, O(n²)): the shortest set of lines that joins every dot. */
function spanningTree(nodes: LatLng[]): Edge[] {
  const n = nodes.length;
  if (n < 2) return [];
  const inTree = new Array<boolean>(n).fill(false);
  const best = new Array<number>(n).fill(Infinity);
  const from = new Array<number>(n).fill(-1);
  best[0] = 0;
  const out: Edge[] = [];
  for (let it = 0; it < n; it++) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!inTree[i] && (u === -1 || best[i] < best[u])) u = i;
    inTree[u] = true;
    if (from[u] >= 0) out.push({ a: from[u], b: u, km: best[u], kind: "mesh" });
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const d = distanceKm(nodes[u], nodes[v]);
      if (d < best[v]) {
        best[v] = d;
        from[v] = u;
      }
    }
  }
  return out;
}

/** Each dot joined to its k nearest neighbours (deduplicated). */
function nearestEdges(nodes: LatLng[], k: number): Edge[] {
  const seen = new Set<string>();
  const out: Edge[] = [];
  nodes.forEach((p, i) => {
    nodes
      .map((q, j) => ({ j, d: i === j ? Infinity : distanceKm(p, q) }))
      .sort((x, y) => x.d - y.d)
      .slice(0, k)
      .forEach(({ j, d }) => {
        if (!Number.isFinite(d)) return;
        const id = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(id)) return;
        seen.add(id);
        out.push({ a: i, b: j, km: d, kind: "mesh" });
      });
  });
  return out;
}

const W = 1000;
const H = 620;
const PAD = 40;

/** Equirectangular projection scaled by cos(latitude) so distances look right for Zimbabwe-sized areas. */
function projector(points: LatLng[]) {
  if (!points.length) return { x: () => W / 2, y: () => H / 2, kmPerUnit: 1 };
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  points.forEach((p) => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  });
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * kx, 0.01);
  const spanY = Math.max(maxLat - minLat, 0.01);
  const s = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const ox = (W - spanX * s) / 2;
  const oy = (H - spanY * s) / 2;
  return {
    x: (p: LatLng) => ox + (p.lng - minLng) * kx * s,
    y: (p: LatLng) => oy + (maxLat - p.lat) * s,
    kmPerUnit: 111.32 / s, // 1 degree of latitude ≈ 111.32 km
  };
}

/** A round number of km that spans ~1/6 of the drawing at the current zoom. */
function scaleBar(kmPerUnit: number, zoom: number) {
  const target = (W / 6) * (kmPerUnit / zoom);
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const km = steps.reduce((b, s) => (Math.abs(s - target) < Math.abs(b - target) ? s : b), steps[0]);
  return { km, units: (km / kmPerUnit) * zoom };
}

/* -------------------------------------------------------------------- page */

type Level = "national" | "region" | "district" | "depot";

export default function NetworkGraphPage() {
  const { token } = useAuth();
  const { isDepot, depotId: myDepot } = useScope();
  const geo = useGeography(token);

  const [tab, setTab] = useState<Kind>("gateway");
  const [level, setLevel] = useState<Level>(isDepot ? "depot" : "national");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [depotId, setDepotId] = useState<number | null>(isDepot ? myDepot : null);
  const [mode, setMode] = useState<"tree" | "near">("tree");
  const [showUplinks, setShowUplinks] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const [gateways, setGateways] = useState<GatewayPoint[] | null>(null);
  const [transformers, setTransformers] = useState<TransformerRow[] | null>(null);
  const [links, setLinks] = useState<Record<string, LinkInfo>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setError(null);
    Promise.all([
      cachedGet<GatewayPoint[]>(`${API}/api/v1/gateways/map`, token, 60_000),
      cachedGet<{ content: TransformerRow[] }>(`${API}/api/v1/transformers/registry/page?page=0&size=10000&sort=name&dir=asc`, token, 60_000),
      cachedGet<Record<string, LinkInfo>>(`${API}/api/v1/gateways/links/by-transformer`, token, 60_000).catch(() => ({})),
    ])
      .then(([g, t, l]) => {
        setGateways(Array.isArray(g) ? g : []);
        setTransformers(t?.content ?? []);
        setLinks(l ?? {});
      })
      .catch(() => setError("Could not load gateways and transformers for the graph."));
  }, [token]);

  useEffect(() => {
    if (isDepot && myDepot) {
      setLevel("depot");
      setDepotId(myDepot);
    }
  }, [isDepot, myDepot]);

  /* ---- geography helpers */
  const districtOf = useMemo(() => new Map(geo.depots.map((d) => [d.id, depotDistrictId(d)])), [geo.depots]);
  const regionOfDistrict = useMemo(() => new Map(geo.districts.map((d) => [d.id, districtRegionId(d)])), [geo.districts]);
  const inScope = useCallback(
    (dep: number | null) => {
      if (level === "national") return true;
      if (dep == null) return false;
      if (level === "depot") return depotId == null || dep === depotId;
      const dist = districtOf.get(dep) ?? null;
      if (level === "district") return districtId == null || dist === districtId;
      const reg = dist != null ? regionOfDistrict.get(dist) ?? null : null;
      return regionId == null || reg === regionId;
    },
    [level, depotId, districtId, regionId, districtOf, regionOfDistrict]
  );

  /* ---- nodes */
  const allNodes = useMemo(() => {
    const gwDepotVotes = new Map<number, Map<number, number>>();
    (transformers ?? []).forEach((t) => {
      const l = links[String(t.id)];
      if (!l || t.depotId == null) return;
      const m = gwDepotVotes.get(l.gatewayId) ?? new Map<number, number>();
      m.set(t.depotId, (m.get(t.depotId) ?? 0) + 1);
      gwDepotVotes.set(l.gatewayId, m);
    });
    const inferDepot = (gid: number) => {
      const m = gwDepotVotes.get(gid);
      if (!m) return null;
      return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };
    const gws: Array<GNode | null> = (gateways ?? []).map((g) => {
      const p = toLatLng(g.latitude, g.longitude);
      const inferred = g.depotId == null ? inferDepot(g.id) : null;
      return {
        key: `g${g.id}`,
        id: g.id,
        kind: "gateway",
        name: g.name,
        status: (g.effectiveStatus || "UNKNOWN").toUpperCase(),
        depotId: g.depotId ?? inferred,
        depotInferred: g.depotId == null && inferred != null,
        lat: p?.lat ?? NaN,
        lng: p?.lng ?? NaN,
      };
    });
    const trs: GNode[] = (transformers ?? []).map((t) => {
      const p = toLatLng(t.lat, t.lng);
      return {
        key: `t${t.id}`,
        id: t.id,
        kind: "transformer",
        name: t.name,
        sub: t.transformerNumber ? `No. ${t.transformerNumber}` : null,
        status: (t.status || "UNKNOWN").toUpperCase(),
        depotId: t.depotId ?? null,
        gatewayId: links[String(t.id)]?.gatewayId ?? null,
        lat: p?.lat ?? NaN,
        lng: p?.lng ?? NaN,
      };
    });
    return { gateways: gws.filter(Boolean) as GNode[], transformers: trs };
  }, [gateways, transformers, links]);

  const hasCoord = (n: GNode) => Number.isFinite(n.lat) && Number.isFinite(n.lng);
  const statusOk = (n: GNode) => !statusFilter || n.status === statusFilter;

  const scoped = useMemo(() => {
    const primary = (tab === "gateway" ? allNodes.gateways : allNodes.transformers).filter((n) => inScope(n.depotId) && statusOk(n));
    return { primary, placed: primary.filter(hasCoord), missing: primary.filter((n) => !hasCoord(n)) };
  }, [allNodes, tab, inScope, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  /* secondary layer: in the gateway view, the transformers each gateway hears; in the transformer view, their gateways */
  const secondary = useMemo(() => {
    if (!showUplinks) return [] as GNode[];
    if (tab === "gateway") {
      const ids = new Set(scoped.placed.map((g) => g.id));
      return allNodes.transformers.filter((t) => hasCoord(t) && t.gatewayId != null && ids.has(t.gatewayId) && inScope(t.depotId));
    }
    const ids = new Set(scoped.placed.map((t) => t.gatewayId).filter((x): x is number => x != null));
    return allNodes.gateways.filter((g) => hasCoord(g) && ids.has(g.id));
  }, [showUplinks, tab, scoped.placed, allNodes, inScope]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodes = useMemo(() => [...scoped.placed, ...secondary], [scoped.placed, secondary]);
  const index = useMemo(() => new Map(nodes.map((n, i) => [n.key, i])), [nodes]);

  const meshEdges = useMemo(() => {
    const pts = scoped.placed;
    const e = mode === "tree" ? spanningTree(pts) : nearestEdges(pts, 2);
    return e; // indices into scoped.placed == indices into nodes (placed come first)
  }, [scoped.placed, mode]);

  const uplinkEdges = useMemo(() => {
    if (!showUplinks) return [] as Edge[];
    const out: Edge[] = [];
    nodes.forEach((n, i) => {
      if (n.kind !== "transformer" || n.gatewayId == null) return;
      const j = index.get(`g${n.gatewayId}`);
      if (j == null) return;
      out.push({ a: j, b: i, km: distanceKm(nodes[j], n), kind: "uplink" });
    });
    return out;
  }, [showUplinks, nodes, index]);

  const nearestOf = useMemo(() => {
    const pts = scoped.placed;
    return pts.map((p, i) => {
      let best = Infinity, bj = -1;
      pts.forEach((q, j) => {
        if (i === j) return;
        const d = distanceKm(p, q);
        if (d < best) { best = d; bj = j; }
      });
      return bj >= 0 ? { j: bj, km: best } : null;
    });
  }, [scoped.placed]);

  const proj = useMemo(() => projector(nodes), [nodes]);

  /* ---- stats */
  const spanKm = meshEdges.reduce((a, e) => a + e.km, 0);
  const nn = nearestOf.filter((x): x is { j: number; km: number } => !!x).map((x) => x.km);
  const avgNn = nn.length ? nn.reduce((a, b) => a + b, 0) / nn.length : null;
  const maxNn = nn.length ? Math.max(...nn) : null;
  const isolatedIdx = nn.length ? nearestOf.findIndex((x) => x?.km === maxNn) : -1;
  const upKms = uplinkEdges.map((e) => e.km);
  const avgUp = upKms.length ? upKms.reduce((a, b) => a + b, 0) / upKms.length : null;

  /* ---- zoom & pan */
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [tab, level, regionId, districtId, depotId]);
  const toSvg = (cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const s = Math.max(W / r.width, H / r.height);
    const offX = (r.width * s - W) / 2, offY = (r.height * s - H) / 2;
    return { x: (cx - r.left) * s - offX, y: (cy - r.top) * s - offY };
  };
  const zoomAt = (factor: number, at = { x: W / 2, y: H / 2 }) =>
    setView((v) => {
      const k = Math.min(40, Math.max(1, v.k * factor));
      const f = k / v.k;
      return k === 1 ? { k: 1, x: 0, y: 0 } : { k, x: at.x - (at.x - v.x) * f, y: at.y - (at.y - v.y) * f };
    });
  const onWheel = (e: RWheelEvent<SVGSVGElement>) => {
    zoomAt(e.deltaY < 0 ? 1.25 : 0.8, toSvg(e.clientX, e.clientY));
  };
  useEffect(() => {
    // stop the page from scrolling while the wheel zooms the graph
    const el = svgRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  }, []);
  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const a = toSvg(d.x, d.y), b = toSvg(e.clientX, e.clientY);
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, x: d.vx + (b.x - a.x), y: d.vy + (b.y - a.y) }));
  };
  const onUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };

  /* ---- hover & selection */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; node?: number; edge?: Edge } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [tab]);
  const tip = (e: RPointerEvent<Element>, h: { node?: number; edge?: Edge }) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    setHover({ x: e.clientX - r.left, y: e.clientY - r.top, ...h });
  };
  const selIdx = selected != null ? index.get(selected) ?? null : null;
  const neighbours = useMemo(() => {
    if (selIdx == null) return [];
    const p = nodes[selIdx];
    return scoped.placed
      .map((q) => ({ q, km: distanceKm(p, q) }))
      .filter((x) => x.q.key !== p.key)
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
  }, [selIdx, nodes, scoped.placed]);
  const connected = useMemo(() => {
    const s = new Set<number>();
    if (selIdx == null) return s;
    [...meshEdges, ...uplinkEdges].forEach((e) => {
      if (e.a === selIdx) s.add(e.b);
      if (e.b === selIdx) s.add(e.a);
    });
    return s;
  }, [selIdx, meshEdges, uplinkEdges]);

  /* ---- labels: greedy placement in screen space so names never sit on top of each other */
  const labelled = useMemo(() => {
    const out = new Set<number>();
    const boxes: Array<[number, number, number, number]> = [];
    scoped.placed.forEach((n, i) => {
      const x = proj.x(n) * view.k + view.x;
      const y = proj.y(n) * view.k + view.y;
      if (x < -50 || x > W + 50 || y < -20 || y > H + 20) return;
      const w = Math.min(n.name.length, 28) * 6.2 + 12;
      const box: [number, number, number, number] = [x - 6, y - 9, x + w, y + 9];
      if (boxes.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1])) return;
      boxes.push(box);
      out.add(i);
    });
    return out;
  }, [scoped.placed, proj, view]);
  const showNames = (_n: GNode, i: number) => i !== selIdx && hover?.node !== i && labelled.has(i);

  const loading = gateways == null || transformers == null;
  const sb = scaleBar(proj.kmPerUnit, view.k);
  const r0 = 1 / Math.sqrt(view.k); // dots shrink a little as you zoom in, never vanish

  /* ---- filter options */
  const regionOpts = geo.regions;
  const districtOpts = geo.districts.filter((d) => regionId == null || districtRegionId(d) === regionId);
  const depotOpts = geo.depots.filter((d) => {
    const dist = depotDistrictId(d);
    if (districtId != null) return dist === districtId;
    if (regionId != null) return dist != null && regionOfDistrict.get(dist) === regionId;
    return true;
  });
  const scopeLabel =
    level === "national"
      ? "National"
      : level === "region"
        ? regionOpts.find((r) => r.id === regionId)?.name ?? "Choose a region"
        : level === "district"
          ? districtOpts.find((d) => d.id === districtId)?.name ?? "Choose a district"
          : geo.depots.find((d) => d.id === depotId)?.name ?? "Choose a depot";
  const statusChoices = tab === "gateway" ? ["ONLINE", "DEGRADED", "OFFLINE", "NEVER_SEEN"] : ["ONLINE", "DELAYED", "OFFLINE", "NEVER_SEEN", "NO_DEVICE"];

  const primaryName = tab === "gateway" ? "gateways" : "transformers";
  const hNode = hover?.node != null ? nodes[hover.node] : null;
  const hNear = hover?.node != null && hover.node < scoped.placed.length ? nearestOf[hover.node] : null;
  const hGw = hNode?.kind === "transformer" && hNode.gatewayId != null ? index.get(`g${hNode.gatewayId}`) : undefined;

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Network"
        title="Network graph"
        subtitle="Gateways and transformers drawn at their saved coordinates and joined dot to dot, so you can see how the network is spread and how far apart things are. Hover a dot for its name and coordinates; click it for its nearest neighbours."
      >
        <HeroStats cols={5}>
          <HeroStat icon={tab === "gateway" ? <Radio className="h-4 w-4" /> : <Zap className="h-4 w-4" />} label={`${tab === "gateway" ? "Gateways" : "Transformers"} in view`} value={fmtNum(scoped.primary.length)} sub={`${fmtNum(scoped.placed.length)} with coordinates`} loading={loading} />
          <HeroStat icon={<Locate className="h-4 w-4" />} label="Missing coordinates" value={fmtNum(scoped.missing.length)} sub="not drawn" loading={loading} tone={scoped.missing.length ? "warn" : undefined} />
          <HeroStat icon={<Ruler className="h-4 w-4" />} label="Average gap to nearest" value={fmtDistance(avgNn)} sub={`between ${primaryName}`} loading={loading} />
          <HeroStat icon={<Waypoints className="h-4 w-4" />} label="Most isolated" value={fmtDistance(maxNn)} sub={isolatedIdx >= 0 ? scoped.placed[isolatedIdx]?.name : "—"} loading={loading} />
          <HeroStat icon={<Network className="h-4 w-4" />} label={showUplinks ? "Avg transformer → gateway" : "Network span"} value={showUplinks ? fmtDistance(avgUp) : fmtDistance(spanKm)} sub={showUplinks ? `${fmtNum(uplinkEdges.length)} uplink lines` : "total line length"} loading={loading} />
        </HeroStats>
      </PageHero>

      {error ? <Notice>{error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {(["gateway", "transformer"] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${tab === k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
              {k === "gateway" ? <Radio className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              {k === "gateway" ? "Gateways" : "Transformers"}
            </button>
          ))}
        </div>

        {!isDepot ? (
          <SelectBox
            label="View"
            value={level}
            onChange={(v) => {
              setLevel(v as Level);
              if (v === "national") { setRegionId(null); setDistrictId(null); setDepotId(null); }
            }}
          >
            <option value="national">National</option>
            <option value="region">Region</option>
            <option value="district">District</option>
            <option value="depot">Depot</option>
          </SelectBox>
        ) : null}
        {!isDepot && level !== "national" ? (
          <SelectBox label="Region" value={regionId ?? ""} onChange={(v) => { setRegionId(v ? Number(v) : null); setDistrictId(null); setDepotId(null); }}>
            <option value="">{level === "region" ? "Choose…" : "All regions"}</option>
            {regionOpts.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectBox>
        ) : null}
        {!isDepot && (level === "district" || level === "depot") ? (
          <SelectBox label="District" value={districtId ?? ""} onChange={(v) => { setDistrictId(v ? Number(v) : null); setDepotId(null); }}>
            <option value="">{level === "district" ? "Choose…" : "All districts"}</option>
            {districtOpts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectBox>
        ) : null}
        {!isDepot && level === "depot" ? (
          <SelectBox label="Depot" value={depotId ?? ""} onChange={(v) => setDepotId(v ? Number(v) : null)}>
            <option value="">Choose…</option>
            {depotOpts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectBox>
        ) : null}

        <SelectBox label="Status" value={statusFilter} onChange={setStatusFilter}>
          <option value="">All</option>
          {statusChoices.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </SelectBox>
        <SelectBox label="Lines" value={mode} onChange={(v) => setMode(v as "tree" | "near")}>
          <option value="tree">Shortest path joining all</option>
          <option value="near">Two nearest neighbours</option>
        </SelectBox>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input type="checkbox" checked={showUplinks} onChange={(e) => setShowUplinks(e.target.checked)} className="h-4 w-4 accent-blue-600" />
          {tab === "gateway" ? "Show transformers each gateway hears" : "Show the gateway each one reports through"}
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <div ref={wrapRef} className="relative overflow-hidden [--ng-halo:#ffffff] dark:[--ng-halo:#020617] rounded-[22px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="pointer-events-none absolute left-4 top-3 z-10">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{scopeLabel}</p>
            <p className="text-[11px] text-slate-500">
              {fmtNum(scoped.placed.length)} {primaryName} · {fmtNum(meshEdges.length)} lines{showUplinks && uplinkEdges.length ? ` · ${fmtNum(uplinkEdges.length)} uplinks` : ""}
            </p>
          </div>
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-1">
            {[
              { icon: <Plus className="h-4 w-4" />, on: () => zoomAt(1.5), t: "Zoom in" },
              { icon: <Minus className="h-4 w-4" />, on: () => zoomAt(1 / 1.5), t: "Zoom out" },
              { icon: <Locate className="h-4 w-4" />, on: () => setView({ k: 1, x: 0, y: 0 }), t: "Fit all" },
            ].map((b) => (
              <button key={b.t} type="button" title={b.t} aria-label={b.t} onClick={b.on} className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white/90 text-slate-600 shadow-sm hover:text-blue-600 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300">
                {b.icon}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid h-[620px] place-items-center text-sm text-slate-500">Loading the network…</div>
          ) : scoped.placed.length === 0 ? (
            <div className="grid h-[620px] place-items-center px-6 text-center">
              <div>
                <Network className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Nothing to draw here</p>
                <p className="text-xs text-slate-500">
                  {level !== "national" && ((level === "region" && regionId == null) || (level === "district" && districtId == null) || (level === "depot" && depotId == null))
                    ? `Choose a ${level} above.`
                    : `No ${primaryName} with coordinates in this view${scoped.missing.length ? ` (${scoped.missing.length} have no coordinates)` : ""}.`}
                </p>
              </div>
            </div>
          ) : (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className={`block h-[620px] w-full touch-none select-none ${drag.current?.moved ? "cursor-grabbing" : "cursor-grab"}`}
              onWheel={onWheel}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerLeave={() => { drag.current = null; setHover(null); }}
              onClick={() => { if (!drag.current?.moved) setSelected(null); }}
              role="img"
              aria-label={`Network graph of ${scoped.placed.length} ${primaryName}`}
            >
              <defs>
                <pattern id="ng-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" className="stroke-slate-100 dark:stroke-slate-900" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width={W} height={H} fill="url(#ng-grid)" />
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                {/* uplink lines (transformer → gateway) */}
                {uplinkEdges.map((e, i) => {
                  const a = nodes[e.a], b = nodes[e.b];
                  const on = selIdx != null && (e.a === selIdx || e.b === selIdx);
                  const dim = selIdx != null && !on;
                  return (
                    <g key={`u${i}`}>
                      <line x1={proj.x(a)} y1={proj.y(a)} x2={proj.x(b)} y2={proj.y(b)} stroke={on ? "#2563eb" : "#94a3b8"} strokeOpacity={dim ? 0.12 : on ? 0.9 : 0.45} strokeWidth={(on ? 1.6 : 1) / view.k} strokeDasharray={`${3 / view.k} ${3 / view.k}`} />
                      <line x1={proj.x(a)} y1={proj.y(a)} x2={proj.x(b)} y2={proj.y(b)} stroke="transparent" strokeWidth={8 / view.k} onPointerMove={(ev) => tip(ev, { edge: e })} onPointerLeave={() => setHover(null)} />
                    </g>
                  );
                })}
                {/* mesh lines (dot to dot) */}
                {meshEdges.map((e, i) => {
                  const a = nodes[e.a], b = nodes[e.b];
                  const on = selIdx != null && (e.a === selIdx || e.b === selIdx);
                  const dim = selIdx != null && !on;
                  const isHover = hover?.edge === e;
                  return (
                    <g key={`m${i}`}>
                      <line x1={proj.x(a)} y1={proj.y(a)} x2={proj.x(b)} y2={proj.y(b)} stroke={on || isHover ? "#2563eb" : tab === "gateway" ? "#0b4fc4" : "#64748b"} strokeOpacity={dim ? 0.15 : on || isHover ? 1 : 0.55} strokeWidth={(on || isHover ? 2.5 : 1.6) / view.k} strokeLinecap="round" />
                      <line x1={proj.x(a)} y1={proj.y(a)} x2={proj.x(b)} y2={proj.y(b)} stroke="transparent" strokeWidth={10 / view.k} onPointerMove={(ev) => tip(ev, { edge: e })} onPointerLeave={() => setHover(null)} />
                      {(on || (view.k >= 2.5 && meshEdges.length <= 60) || (tab === "gateway" && meshEdges.length <= 25)) && !dim ? (
                        <text x={(proj.x(a) + proj.x(b)) / 2} y={(proj.y(a) + proj.y(b)) / 2 - 4 / view.k} textAnchor="middle" fontSize={10 / view.k} className="pointer-events-none fill-slate-500 dark:fill-slate-400" style={{ paintOrder: "stroke" }} stroke="var(--ng-halo, white)" strokeWidth={3 / view.k}>
                          {fmtDistance(e.km)}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {/* dots */}
                {nodes.map((n, i) => {
                  const primary = n.kind === tab;
                  const on = i === selIdx;
                  const near = connected.has(i);
                  const dim = selIdx != null && !on && !near;
                  const r = (primary ? (n.kind === "gateway" ? 7 : 4.5) : n.kind === "gateway" ? 6 : 3) * r0 * (on ? 1.4 : 1);
                  const cx = proj.x(n), cy = proj.y(n);
                  return (
                    <g
                      key={n.key}
                      opacity={dim ? 0.3 : 1}
                      className="cursor-pointer"
                      onPointerMove={(ev) => { ev.stopPropagation(); tip(ev, { node: i }); }}
                      onPointerLeave={() => setHover(null)}
                      onClick={(ev) => { ev.stopPropagation(); if (!drag.current?.moved) setSelected(on ? null : n.key); }}
                    >
                      <circle cx={cx} cy={cy} r={r + 8 / view.k} fill="transparent" />
                      {n.kind === "gateway" ? (
                        <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={r * 0.35} transform={`rotate(45 ${cx} ${cy})`} fill={hex(n.status)} stroke={on ? "#1d4ed8" : "white"} strokeWidth={(on ? 2.5 : 1.5) / view.k} />
                      ) : (
                        <circle cx={cx} cy={cy} r={r} fill={hex(n.status)} fillOpacity={primary ? 1 : 0.75} stroke={on ? "#1d4ed8" : "white"} strokeWidth={(on ? 2.5 : primary ? 1.2 : 0.8) / view.k} />
                      )}
                      {showNames(n, i) || on ? (
                        <text x={cx + r + 4 / view.k} y={cy + 3.5 / view.k} fontSize={(n.kind === "gateway" ? 11 : 10) / view.k} className="pointer-events-none fill-slate-700 font-medium dark:fill-slate-200" style={{ paintOrder: "stroke" }} stroke="var(--ng-halo, white)" strokeWidth={3 / view.k}>
                          {n.name}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
              </g>
              {/* scale bar */}
              <g transform={`translate(${PAD - 20} ${H - 22})`} className="pointer-events-none">
                <line x1={0} y1={0} x2={sb.units} y2={0} stroke="#475569" strokeWidth={2} />
                <line x1={0} y1={-4} x2={0} y2={4} stroke="#475569" strokeWidth={2} />
                <line x1={sb.units} y1={-4} x2={sb.units} y2={4} stroke="#475569" strokeWidth={2} />
                <text x={sb.units / 2} y={-7} textAnchor="middle" fontSize={11} className="fill-slate-600 dark:fill-slate-300">{fmtDistance(sb.km)}</text>
              </g>
            </svg>
          )}

          {/* tooltip */}
          {hover && (hNode || hover.edge) ? (
            <div className="pointer-events-none absolute z-20 w-64 rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95" style={{ left: Math.min(hover.x + 14, (wrapRef.current?.clientWidth ?? 800) - 270), top: Math.max(8, hover.y - 10) }}>
              {hNode ? (
                <>
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: hex(hNode.status) }} />
                    {hNode.kind === "gateway" ? "Gateway" : "Transformer"} · {hNode.name}
                  </p>
                  {hNode.sub ? <p className="text-slate-500">{hNode.sub}</p> : null}
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-600 dark:text-slate-300">
                    <dt className="text-slate-400">Status</dt><dd>{STATUS_LABEL[hNode.status] ?? hNode.status}</dd>
                    <dt className="text-slate-400">Coordinates</dt><dd className="font-mono text-[11px]">{fmtCoord(hNode)}</dd>
                    <dt className="text-slate-400">Depot</dt><dd className="truncate">{hNode.depotId ? geo.pathOf(hNode.depotId).depotName : "—"}{hNode.depotInferred ? " (from its transformers)" : ""}</dd>
                    {hNear ? (<><dt className="text-slate-400">Nearest</dt><dd className="truncate">{scoped.placed[hNear.j]?.name} · <b>{fmtDistance(hNear.km)}</b></dd></>) : null}
                    {hGw != null ? (<><dt className="text-slate-400">Gateway</dt><dd className="truncate">{nodes[hGw].name} · <b>{fmtDistance(distanceKm(hNode, nodes[hGw]))}</b></dd></>) : null}
                  </dl>
                  <p className="mt-1.5 text-[10px] text-slate-400">Click to see its nearest neighbours</p>
                </>
              ) : hover.edge ? (
                <>
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                    <Ruler className="h-3.5 w-3.5" /> {fmtDistance(hover.edge.km)}
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    {nodes[hover.edge.a]?.name} ↔ {nodes[hover.edge.b]?.name}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{hover.edge.kind === "uplink" ? "Transformer to the gateway it reports through" : "Straight-line distance"}</p>
                </>
              ) : null}
            </div>
          ) : null}

          {/* legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-slate-400" /> Gateway</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Transformer</span>
            {statusChoices.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: hex(s) }} /> {STATUS_LABEL[s]}</span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-[#0b4fc4]" /> {mode === "tree" ? "Shortest joining line" : "Nearest-neighbour line"}</span>
            {showUplinks ? <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-slate-400" /> Reports through</span> : null}
            <span className="ml-auto">Scroll to zoom · drag to move</span>
          </div>
        </div>

        {/* side panel */}
        <aside className="space-y-3">
          {selIdx != null ? (
            <SidePanel title={nodes[selIdx].name} onClose={() => setSelected(null)}>
              <p className="text-xs text-slate-500">
                {nodes[selIdx].kind === "gateway" ? "Gateway" : "Transformer"} · {STATUS_LABEL[nodes[selIdx].status] ?? nodes[selIdx].status}
                <br />
                <span className="font-mono">{fmtCoord(nodes[selIdx])}</span>
              </p>
              <Link to={nodes[selIdx].kind === "gateway" ? `/gateways?q=${encodeURIComponent(nodes[selIdx].name)}` : `/transformer/${nodes[selIdx].id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                Open <ExternalLink className="h-3 w-3" />
              </Link>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nearest {primaryName}</p>
              <ol className="mt-1 divide-y divide-slate-100 dark:divide-slate-800">
                {neighbours.map(({ q, km }) => (
                  <li key={q.key}>
                    <button type="button" onClick={() => setSelected(q.key)} className="flex w-full items-center gap-2 py-1.5 text-left text-xs hover:text-blue-600">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hex(q.status) }} />
                      <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{q.name}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtDistance(km)}</span>
                    </button>
                  </li>
                ))}
                {!neighbours.length ? <li className="py-2 text-xs text-slate-500">No other {primaryName} in this view.</li> : null}
              </ol>
            </SidePanel>
          ) : (
            <SidePanel title={`Farthest apart (${primaryName})`}>
              <p className="text-xs text-slate-500">The {primaryName} whose nearest neighbour is farthest away — the gaps in coverage.</p>
              <ol className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {nearestOf
                  .map((x, i) => ({ i, x }))
                  .filter((v): v is { i: number; x: { j: number; km: number } } => !!v.x)
                  .sort((a, b) => b.x.km - a.x.km)
                  .slice(0, 10)
                  .map(({ i, x }) => (
                    <li key={scoped.placed[i].key}>
                      <button type="button" onClick={() => setSelected(scoped.placed[i].key)} className="flex w-full items-center gap-2 py-1.5 text-left text-xs hover:text-blue-600">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: hex(scoped.placed[i].status) }} />
                        <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{scoped.placed[i].name}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{fmtDistance(x.km)}</span>
                      </button>
                    </li>
                  ))}
              </ol>
            </SidePanel>
          )}
          {scoped.missing.length ? (
            <SidePanel title={`No coordinates (${scoped.missing.length})`}>
              <p className="text-xs text-slate-500">These are not drawn. Add their latitude and longitude to place them.</p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-xs text-slate-700 dark:text-slate-300">
                {scoped.missing.slice(0, 60).map((n) => (
                  <li key={n.key} className="truncate">
                    <Link to={n.kind === "gateway" ? `/gateways?q=${encodeURIComponent(n.name)}` : `/transformer/${n.id}`} className="hover:text-blue-600">{n.name}</Link>
                  </li>
                ))}
                {scoped.missing.length > 60 ? <li className="text-slate-400">…and {scoped.missing.length - 60} more</li> : null}
              </ul>
            </SidePanel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function SidePanel({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-1">{children}</div>
    </section>
  );
}
