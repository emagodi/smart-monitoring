import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Locate, Minus, Network, Plus, Radio, Ruler, Search, Waypoints, X, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { cachedGet } from "../../lib/cache";
import { useGeography, districtRegionId, depotDistrictId } from "../Registry/geo";
import { HeroStat, HeroStats, Notice, PageHero, Pager, SelectBox, fmtNum } from "../../components/ui/page";
import { distanceKm, fmtCoord, fmtDistance, toLatLng, type LatLng } from "../../lib/distance";

const API = import.meta.env.VITE_API_BASE_URL || "";

/* ------------------------------------------------------------------ data */

type GatewayPoint = { id: number; name: string; latitude?: number | string | null; longitude?: number | string | null; effectiveStatus?: string | null; depotId?: number | null };
type TransformerRow = { id: number; name: string; transformerNumber?: string | null; depotId?: number | null; lat?: number | string | null; lng?: number | string | null; status?: string | null };
type LinkInfo = { gatewayId: number };

type Kind = "gateway" | "transformer";
type GNode = LatLng & {
  key: string;
  id: number;
  kind: Kind;
  name: string;
  sub?: string | null;
  status: string;
  depotId: number | null;
  gatewayId?: number | null;
};
type Edge = { a: number; b: number; km: number; kind: "mesh" | "uplink" };

/** Simple colours: green online, red offline, amber in between, grey never heard. */
const tone = (s?: string | null) => {
  switch ((s || "").toUpperCase()) {
    case "ONLINE": return { hex: "#10b981", label: "Online" };
    case "OFFLINE": return { hex: "#ef4444", label: "Offline" };
    case "DEGRADED": return { hex: "#f59e0b", label: "Degraded" };
    case "DELAYED": return { hex: "#f59e0b", label: "Delayed" };
    case "NO_DEVICE": return { hex: "#cbd5e1", label: "No device" };
    default: return { hex: "#94a3b8", label: "Never seen" };
  }
};

/* ------------------------------------------------------------- geometry */

/** Minimum spanning tree (Prim): the shortest lines that join every dot. */
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
      if (d < best[v]) { best[v] = d; from[v] = u; }
    }
  }
  return out;
}

const W = 1000;
const H = 600;
const PAD = 48;

function projector(points: LatLng[]) {
  if (!points.length) return { x: () => W / 2, y: () => H / 2, kmPerUnit: 1 };
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  points.forEach((p) => {
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng);
  });
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * kx, 0.01);
  const spanY = Math.max(maxLat - minLat, 0.01);
  const s = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const ox = (W - spanX * s) / 2;
  const oy = (H - spanY * s) / 2;
  return { x: (p: LatLng) => ox + (p.lng - minLng) * kx * s, y: (p: LatLng) => oy + (maxLat - p.lat) * s, kmPerUnit: 111.32 / s };
}

function scaleBar(kmPerUnit: number, zoom: number) {
  const target = (W / 7) * (kmPerUnit / zoom);
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500];
  const km = steps.reduce((b, s) => (Math.abs(s - target) < Math.abs(b - target) ? s : b), steps[0]);
  return { km, units: (km / kmPerUnit) * zoom };
}

const short = (s: string, n = 26) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/* -------------------------------------------------------------------- page */

type Level = "national" | "region" | "district" | "depot";
const PAGE = 8;

export default function NetworkGraphPage() {
  const { token } = useAuth();
  const { isDepot, depotId: myDepot } = useScope();
  const geo = useGeography(token);

  const [tab, setTab] = useState<Kind>("gateway");
  const [level, setLevel] = useState<Level>(isDepot ? "depot" : "national");
  const [regionId, setRegionId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [depotId, setDepotId] = useState<number | null>(isDepot ? myDepot : null);
  const [statusFilter, setStatusFilter] = useState("");
  const [showLinks, setShowLinks] = useState(false);

  /* Gateways come first (small and quick); transformers load behind them and join the graph when ready. */
  const [gateways, setGateways] = useState<GatewayPoint[] | null>(null);
  const [transformers, setTransformers] = useState<TransformerRow[] | null>(null);
  const [links, setLinks] = useState<Record<string, LinkInfo>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setError(null);
    cachedGet<GatewayPoint[]>(`${API}/api/v1/gateways/map`, token, 60_000)
      .then((g) => setGateways(Array.isArray(g) ? g : []))
      .catch(() => { setGateways([]); setError("Could not load gateways."); });
    Promise.all([
      cachedGet<{ content: TransformerRow[] }>(`${API}/api/v1/transformers/registry/page?page=0&size=10000&sort=name&dir=asc`, token, 60_000),
      cachedGet<Record<string, LinkInfo>>(`${API}/api/v1/gateways/links/by-transformer`, token, 60_000).catch(() => ({})),
    ])
      .then(([t, l]) => { setTransformers(t?.content ?? []); setLinks(l ?? {}); })
      .catch(() => { setTransformers([]); setError("Could not load transformers."); });
  }, [token]);

  useEffect(() => {
    if (isDepot && myDepot) { setLevel("depot"); setDepotId(myDepot); }
  }, [isDepot, myDepot]);

  /* ---- area filter */
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
  const all = useMemo(() => {
    const votes = new Map<number, Map<number, number>>();
    (transformers ?? []).forEach((t) => {
      const l = links[String(t.id)];
      if (!l || t.depotId == null) return;
      const m = votes.get(l.gatewayId) ?? new Map<number, number>();
      m.set(t.depotId, (m.get(t.depotId) ?? 0) + 1);
      votes.set(l.gatewayId, m);
    });
    const inferDepot = (gid: number) => {
      const m = votes.get(gid);
      return m ? [...m.entries()].sort((a, b) => b[1] - a[1])[0][0] : null;
    };
    const gws: GNode[] = (gateways ?? []).map((g) => {
      const p = toLatLng(g.latitude, g.longitude);
      return { key: `g${g.id}`, id: g.id, kind: "gateway", name: g.name, status: (g.effectiveStatus || "").toUpperCase(), depotId: g.depotId ?? inferDepot(g.id), lat: p?.lat ?? NaN, lng: p?.lng ?? NaN };
    });
    const trs: GNode[] = (transformers ?? []).map((t) => {
      const p = toLatLng(t.lat, t.lng);
      return { key: `t${t.id}`, id: t.id, kind: "transformer", name: t.name, sub: t.transformerNumber ? `No. ${t.transformerNumber}` : null, status: (t.status || "").toUpperCase(), depotId: t.depotId ?? null, gatewayId: links[String(t.id)]?.gatewayId ?? null, lat: p?.lat ?? NaN, lng: p?.lng ?? NaN };
    });
    return { gateways: gws, transformers: trs };
  }, [gateways, transformers, links]);

  const placed = (n: GNode) => Number.isFinite(n.lat) && Number.isFinite(n.lng);
  const statusOk = useCallback(
    (n: GNode) => !statusFilter || (statusFilter === "OTHER" ? n.status !== "ONLINE" && n.status !== "OFFLINE" : n.status === statusFilter),
    [statusFilter]
  );

  const scoped = useMemo(() => {
    const list = (tab === "gateway" ? all.gateways : all.transformers).filter((n) => inScope(n.depotId) && statusOk(n));
    return { list, placed: list.filter(placed), missing: list.filter((n) => !placed(n)) };
  }, [all, tab, inScope, statusOk]);

  /** Optional second layer: transformers around their gateway, or the gateways transformers report through. */
  const extra = useMemo(() => {
    if (!showLinks) return [] as GNode[];
    if (tab === "gateway") {
      const ids = new Set(scoped.placed.map((g) => g.id));
      return all.transformers.filter((t) => placed(t) && t.gatewayId != null && ids.has(t.gatewayId));
    }
    const ids = new Set(scoped.placed.map((t) => t.gatewayId).filter((x): x is number => x != null));
    return all.gateways.filter((g) => placed(g) && ids.has(g.id));
  }, [showLinks, tab, scoped.placed, all]);

  const nodes = useMemo(() => [...scoped.placed, ...extra], [scoped.placed, extra]);
  const index = useMemo(() => new Map(nodes.map((n, i) => [n.key, i])), [nodes]);
  const mesh = useMemo(() => spanningTree(scoped.placed), [scoped.placed]);
  const uplinks = useMemo(() => {
    if (!showLinks) return [] as Edge[];
    const out: Edge[] = [];
    nodes.forEach((n, i) => {
      if (n.kind !== "transformer" || n.gatewayId == null) return;
      const j = index.get(`g${n.gatewayId}`);
      if (j != null) out.push({ a: j, b: i, km: distanceKm(nodes[j], n), kind: "uplink" });
    });
    return out;
  }, [showLinks, nodes, index]);

  /** Nearest neighbour of every placed dot of the active kind. */
  const nearest = useMemo(
    () =>
      scoped.placed.map((p, i) => {
        let km = Infinity, j = -1;
        scoped.placed.forEach((q, k) => {
          if (k === i) return;
          const d = distanceKm(p, q);
          if (d < km) { km = d; j = k; }
        });
        return j >= 0 ? { node: scoped.placed[j], km } : null;
      }),
    [scoped.placed]
  );
  const nearestByKey = useMemo(() => new Map(scoped.placed.map((n, i) => [n.key, nearest[i]])), [scoped.placed, nearest]);

  /** Gateways: the transformers each one serves. */
  const servedBy = useMemo(() => {
    const m = new Map<number, GNode[]>();
    all.transformers.forEach((t) => {
      if (t.gatewayId == null) return;
      const arr = m.get(t.gatewayId) ?? [];
      arr.push(t);
      m.set(t.gatewayId, arr);
    });
    return m;
  }, [all.transformers]);
  const gatewayById = useMemo(() => new Map(all.gateways.map((g) => [g.id, g])), [all.gateways]);

  const proj = useMemo(() => projector(nodes), [nodes]);

  /* ---- stats */
  const nnKm = nearest.filter(Boolean).map((x) => x!.km);
  const avgNn = nnKm.length ? nnKm.reduce((a, b) => a + b, 0) / nnKm.length : null;
  const maxNn = nnKm.length ? Math.max(...nnKm) : null;
  const isolated = maxNn != null ? scoped.placed[nearest.findIndex((x) => x?.km === maxNn)] : null;

  /* ---- zoom & pan */
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  useEffect(() => setView({ k: 1, x: 0, y: 0 }), [tab, level, regionId, districtId, depotId, statusFilter]);
  const toSvg = (cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const s = Math.max(W / r.width, H / r.height);
    return { x: (cx - r.left) * s - (r.width * s - W) / 2, y: (cy - r.top) * s - (r.height * s - H) / 2 };
  };
  const zoomAt = (f: number, at = { x: W / 2, y: H / 2 }) =>
    setView((v) => {
      const k = Math.min(40, Math.max(1, v.k * f));
      const r = k / v.k;
      return k === 1 ? { k: 1, x: 0, y: 0 } : { k, x: at.x - (at.x - v.x) * r, y: at.y - (at.y - v.y) * r };
    });
  const focus = (n: GNode) =>
    setView(() => {
      // zoom just enough that the nearest neighbour sits ~180 units away on screen
      const nb = nearestByKey.get(n.key)?.node;
      const d = nb ? Math.hypot(proj.x(n) - proj.x(nb), proj.y(n) - proj.y(nb)) : 0;
      const k = d > 0 ? Math.min(8, Math.max(1, 180 / d)) : 2;
      return { k, x: W / 2 - proj.x(n) * k, y: H / 2 - proj.y(n) * k };
    });
  const onWheel = (e: RWheelEvent<SVGSVGElement>) => zoomAt(e.deltaY < 0 ? 1.25 : 0.8, toSvg(e.clientX, e.clientY));
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", stop, { passive: false });
    return () => el.removeEventListener("wheel", stop);
  });
  const onDown = (e: RPointerEvent<SVGSVGElement>) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) d.moved = true;
    if (!d.moved) return;
    const a = toSvg(d.x, d.y), b = toSvg(e.clientX, e.clientY);
    setView((v) => ({ ...v, x: d.vx + (b.x - a.x), y: d.vy + (b.y - a.y) }));
  };
  const onUp = () => setTimeout(() => (drag.current = null), 0);

  /* ---- hover & selection */
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; node?: number; edge?: Edge } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => setSelected(null), [tab]);
  const tip = (e: RPointerEvent<Element>, h: { node?: number; edge?: Edge }) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (r) setHover({ x: e.clientX - r.left, y: e.clientY - r.top, ...h });
  };
  const selIdx = selected != null ? index.get(selected) ?? null : null;
  const linked = useMemo(() => {
    const s = new Set<number>();
    if (selIdx == null) return s;
    [...mesh, ...uplinks].forEach((e) => { if (e.a === selIdx) s.add(e.b); if (e.b === selIdx) s.add(e.a); });
    return s;
  }, [selIdx, mesh, uplinks]);

  /* ---- labels: dots are obstacles; a name goes right of its dot, else left, else is hidden */
  const labels = useMemo(() => {
    const out = new Map<number, "r" | "l">();
    const sx = (n: GNode) => proj.x(n) * view.k + view.x;
    const sy = (n: GNode) => proj.y(n) * view.k + view.y;
    const boxes: Array<[number, number, number, number]> = nodes.map((n) => [sx(n) - 7, sy(n) - 7, sx(n) + 7, sy(n) + 7]);
    const hit = (b: [number, number, number, number], self: number) => boxes.some((o, i) => i !== self && b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
    const limit = tab === "gateway" ? 200 : 120;
    scoped.placed.slice(0, 2000).forEach((n, i) => {
      if (out.size >= limit) return;
      const x = sx(n), y = sy(n);
      if (x < 0 || x > W || y < 0 || y > H) return;
      const w = short(n.name).length * 6.4 + 4;
      const right: [number, number, number, number] = [x + 10, y - 8, x + 10 + w, y + 8];
      const left: [number, number, number, number] = [x - 10 - w, y - 8, x - 10, y + 8];
      if (!hit(right, i) && right[2] < W) { boxes.push(right); out.set(i, "r"); }
      else if (!hit(left, i) && left[0] > 0) { boxes.push(left); out.set(i, "l"); }
    });
    return out;
  }, [nodes, scoped.placed, proj, view, tab]);

  /* distance labels on lines: only where the line is long enough on screen to hold the text */
  const edgeLabel = (e: Edge) => {
    const a = nodes[e.a], b = nodes[e.b];
    return Math.hypot(proj.x(a) - proj.x(b), proj.y(a) - proj.y(b)) * view.k > 56;
  };

  /* ---- right-hand list (paged; details are only worked out for the rows on screen) */
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "nearest" | "farthest">("nearest");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [tab, q, sortBy, level, regionId, districtId, depotId, statusFilter]);
  const farthestServed = useCallback(
    (g: GNode): { node: GNode; km: number } | null => {
      if (!placed(g)) return null;
      let best: { node: GNode; km: number } | null = null;
      for (const t of servedBy.get(g.id) ?? []) {
        if (!placed(t)) continue;
        const km = distanceKm(g, t);
        if (!best || km > best.km) best = { node: t, km };
      }
      return best;
    },
    [servedBy]
  );
  const gwDistance = useCallback(
    (n: GNode) => {
      const g = n.gatewayId != null ? gatewayById.get(n.gatewayId) : null;
      return g && placed(g) && placed(n) ? distanceKm(g, n) : null;
    },
    [gatewayById]
  );
  const listRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = scoped.list.filter((n) => !needle || n.name.toLowerCase().includes(needle));
    const nk = (n: GNode) => nearestByKey.get(n.key)?.km ?? -1;
    const fk = (n: GNode) => (tab === "gateway" ? farthestServed(n)?.km : gwDistance(n)) ?? -1;
    if (sortBy === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "nearest") rows.sort((a, b) => nk(b) - nk(a));
    else rows.sort((a, b) => fk(b) - fk(a));
    return rows;
  }, [scoped.list, q, sortBy, nearestByKey, farthestServed, gwDistance, tab]);
  const pageRows = listRows.slice(page * PAGE, page * PAGE + PAGE);
  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { listRef.current?.scrollTo({ top: 0 }); }, [page]);

  const pick = (n: GNode) => {
    if (!placed(n)) return;
    setSelected(n.key);
    focus(n);
  };

  /* ---- filter options */
  const districtOpts = geo.districts.filter((d) => regionId == null || districtRegionId(d) === regionId);
  const depotOpts = geo.depots.filter((d) => {
    const dist = depotDistrictId(d);
    if (districtId != null) return dist === districtId;
    if (regionId != null) return dist != null && regionOfDistrict.get(dist) === regionId;
    return true;
  });
  const areaName =
    level === "national" ? "National"
      : level === "region" ? geo.regions.find((r) => r.id === regionId)?.name ?? "Choose a region"
        : level === "district" ? districtOpts.find((d) => d.id === districtId)?.name ?? "Choose a district"
          : geo.depots.find((d) => d.id === depotId)?.name ?? "Choose a depot";
  const needsChoice = (level === "region" && regionId == null) || (level === "district" && districtId == null) || (level === "depot" && depotId == null);

  const plural = tab === "gateway" ? "gateways" : "transformers";
  const loadingMain = tab === "gateway" ? gateways == null : transformers == null;
  const loadingTransformers = transformers == null;
  const sb = scaleBar(proj.kmPerUnit, view.k);
  const rs = 1 / Math.sqrt(view.k);
  const hNode = hover?.node != null ? nodes[hover.node] : null;
  const hNear = hNode ? nearestByKey.get(hNode.key) : null;
  const hGw = hNode?.kind === "transformer" && hNode.gatewayId != null ? gatewayById.get(hNode.gatewayId) : null;
  const hFar = hNode?.kind === "gateway" ? farthestServed(hNode) : null;

  return (
    <div className="space-y-4">
      <PageHero eyebrow="Network" title="Network graph" subtitle="Every gateway and transformer at its saved coordinates, joined by the shortest lines. Hover a dot for its details; click it or a row on the right to zoom to it.">
        <HeroStats cols={4}>
          <HeroStat icon={tab === "gateway" ? <Radio className="h-4 w-4" /> : <Zap className="h-4 w-4" />} label={tab === "gateway" ? "Gateways" : "Transformers"} value={fmtNum(scoped.list.length)} sub={`${fmtNum(scoped.placed.length)} on the graph`} loading={loadingMain} />
          <HeroStat icon={<Ruler className="h-4 w-4" />} label="Average gap to nearest" value={fmtDistance(avgNn)} sub={`between ${plural}`} loading={loadingMain} />
          <HeroStat icon={<Waypoints className="h-4 w-4" />} label="Most isolated" value={fmtDistance(maxNn)} sub={isolated?.name ?? "—"} loading={loadingMain} />
          <HeroStat icon={<Locate className="h-4 w-4" />} label="Missing coordinates" value={fmtNum(scoped.missing.length)} sub="not on the graph" loading={loadingMain} tone={scoped.missing.length ? "warn" : undefined} />
        </HeroStats>
      </PageHero>

      {error ? <Notice>{error}</Notice> : null}

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {(["gateway", "transformer"] as Kind[]).map((k) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${tab === k ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
              {k === "gateway" ? <Radio className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
              {k === "gateway" ? "Gateways" : "Transformers"}
            </button>
          ))}
        </div>
        {!isDepot ? (
          <SelectBox label="Area" value={level} onChange={(v) => { setLevel(v as Level); setRegionId(null); setDistrictId(null); setDepotId(null); }}>
            <option value="national">National</option>
            <option value="region">Region</option>
            <option value="district">District</option>
            <option value="depot">Depot</option>
          </SelectBox>
        ) : null}
        {!isDepot && level !== "national" ? (
          <SelectBox value={regionId ?? ""} onChange={(v) => { setRegionId(v ? Number(v) : null); setDistrictId(null); setDepotId(null); }}>
            <option value="">{level === "region" ? "Choose region…" : "Any region"}</option>
            {geo.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </SelectBox>
        ) : null}
        {!isDepot && (level === "district" || level === "depot") ? (
          <SelectBox value={districtId ?? ""} onChange={(v) => { setDistrictId(v ? Number(v) : null); setDepotId(null); }}>
            <option value="">{level === "district" ? "Choose district…" : "Any district"}</option>
            {districtOpts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectBox>
        ) : null}
        {!isDepot && level === "depot" ? (
          <SelectBox value={depotId ?? ""} onChange={(v) => setDepotId(v ? Number(v) : null)}>
            <option value="">Choose depot…</option>
            {depotOpts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectBox>
        ) : null}
        <SelectBox label="Status" value={statusFilter} onChange={setStatusFilter}>
          <option value="">All</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="OTHER">Other</option>
        </SelectBox>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} className="h-4 w-4 accent-blue-600" />
          {tab === "gateway" ? "Show their transformers" : "Show their gateways"}
        </label>
        {loadingTransformers && tab === "gateway" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading transformers…</span>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        {/* graph */}
        <div ref={wrapRef} className="relative flex h-[640px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white [--ng-halo:#ffffff] dark:border-slate-800 dark:bg-slate-950 dark:[--ng-halo:#020617]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{areaName}</p>
              <p className="text-[11px] text-slate-500">{fmtNum(scoped.placed.length)} {plural} · lines show the shortest distance between them</p>
            </div>
            <div className="flex items-center gap-1">
              {[
                { icon: <Minus className="h-4 w-4" />, on: () => zoomAt(1 / 1.5), t: "Zoom out" },
                { icon: <Plus className="h-4 w-4" />, on: () => zoomAt(1.5), t: "Zoom in" },
                { icon: <Locate className="h-4 w-4" />, on: () => { setView({ k: 1, x: 0, y: 0 }); setSelected(null); }, t: "Show all" },
              ].map((b) => (
                <button key={b.t} type="button" title={b.t} aria-label={b.t} onClick={b.on} className="grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800">
                  {b.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {loadingMain ? (
              <div className="grid h-full place-items-center text-sm text-slate-500"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading the network…</span></div>
            ) : scoped.placed.length === 0 ? (
              <div className="grid h-full place-items-center px-6 text-center">
                <div>
                  <Network className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Nothing to draw</p>
                  <p className="text-xs text-slate-500">{needsChoice ? `Choose a ${level} above.` : `No ${plural} with coordinates here.`}</p>
                </div>
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="block h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
                onWheel={onWheel}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={() => { drag.current = null; setHover(null); }}
                onClick={() => { if (!drag.current?.moved) setSelected(null); }}
                role="img"
                aria-label={`Graph of ${scoped.placed.length} ${plural}`}
              >
                <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                  {uplinks.map((e, i) => {
                    const a = nodes[e.a], b = nodes[e.b];
                    const on = selIdx != null && (e.a === selIdx || e.b === selIdx);
                    return (
                      <line key={`u${i}`} x1={proj.x(a)} y1={proj.y(a)} x2={proj.x(b)} y2={proj.y(b)} stroke={on ? "#2563eb" : "#cbd5e1"} strokeOpacity={selIdx != null && !on ? 0.25 : 1} strokeWidth={(on ? 1.4 : 0.9) / view.k} strokeDasharray={`${2.5 / view.k} ${2.5 / view.k}`} onPointerMove={(ev) => tip(ev, { edge: e })} onPointerLeave={() => setHover(null)} />
                    );
                  })}
                  {mesh.map((e, i) => {
                    const a = nodes[e.a], b = nodes[e.b];
                    const on = (selIdx != null && (e.a === selIdx || e.b === selIdx)) || hover?.edge === e;
                    const dim = selIdx != null && !on;
                    const x1 = proj.x(a), y1 = proj.y(a), x2 = proj.x(b), y2 = proj.y(b);
                    let ang = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
                    if (ang > 90) ang -= 180;
                    if (ang < -90) ang += 180;
                    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
                    return (
                      <g key={`m${i}`} opacity={dim ? 0.25 : 1}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? "#2563eb" : "#93c5fd"} strokeWidth={(on ? 2.4 : 1.6) / view.k} strokeLinecap="round" />
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12 / view.k} onPointerMove={(ev) => tip(ev, { edge: e })} onPointerLeave={() => setHover(null)} />
                        {edgeLabel(e) || on ? (
                          <text transform={`translate(${mx} ${my}) rotate(${ang})`} y={-5 / view.k} textAnchor="middle" fontSize={10.5 / view.k} fontWeight={600} className={`pointer-events-none ${on ? "fill-blue-700 dark:fill-blue-300" : "fill-slate-500 dark:fill-slate-400"}`} style={{ paintOrder: "stroke" }} stroke="var(--ng-halo)" strokeWidth={3 / view.k}>
                            {fmtDistance(e.km)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                  {nodes.map((n, i) => {
                    const main = n.kind === tab;
                    const on = i === selIdx;
                    const dim = selIdx != null && !on && !linked.has(i);
                    const r = (main ? (tab === "gateway" ? 7 : 5) : 3.5) * rs;
                    const cx = proj.x(n), cy = proj.y(n);
                    const c = tone(n.status).hex;
                    const side = labels.get(i);
                    return (
                      <g key={n.key} opacity={dim ? 0.3 : main ? 1 : 0.8} className="cursor-pointer"
                        onPointerMove={(ev) => { ev.stopPropagation(); tip(ev, { node: i }); }}
                        onPointerLeave={() => setHover(null)}
                        onClick={(ev) => { ev.stopPropagation(); if (!drag.current?.moved) setSelected(on ? null : n.key); }}>
                        <circle cx={cx} cy={cy} r={r + 9 / view.k} fill="transparent" />
                        {main ? <circle cx={cx} cy={cy} r={r * 1.9} fill={c} fillOpacity={on ? 0.28 : 0.14} /> : null}
                        <circle cx={cx} cy={cy} r={r} fill={c} stroke={on ? "#1d4ed8" : "var(--ng-halo)"} strokeWidth={(on ? 2.5 : 1.6) / view.k} />
                        {(side && hover?.node !== i) || on ? (
                          <text x={side === "l" ? cx - r - 5 / view.k : cx + r + 5 / view.k} y={cy + 3.8 / view.k} textAnchor={side === "l" ? "end" : "start"} fontSize={11 / view.k} fontWeight={on ? 700 : 500} className="pointer-events-none fill-slate-700 dark:fill-slate-200" style={{ paintOrder: "stroke" }} stroke="var(--ng-halo)" strokeWidth={3.5 / view.k}>
                            {short(n.name)}
                          </text>
                        ) : null}
                      </g>
                    );
                  })}
                </g>
                <g transform={`translate(24 ${H - 20})`} className="pointer-events-none">
                  <line x1={0} y1={0} x2={sb.units} y2={0} stroke="#64748b" strokeWidth={2} strokeLinecap="round" />
                  <text x={sb.units / 2} y={-6} textAnchor="middle" fontSize={11} className="fill-slate-500">{fmtDistance(sb.km)}</text>
                </g>
              </svg>
            )}

            {hover && (hNode || hover.edge) ? (
              <div className="pointer-events-none absolute z-20 w-64 rounded-2xl border border-slate-200 bg-white/95 p-3 text-xs shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95" style={{ left: Math.min(hover.x + 14, (wrapRef.current?.clientWidth ?? 800) - 272), top: Math.max(6, hover.y - 70) }}>
                {hNode ? (
                  <>
                    <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone(hNode.status).hex }} />
                      <span className="truncate">{hNode.name}</span>
                    </p>
                    <p className="text-slate-500">{hNode.kind === "gateway" ? "Gateway" : "Transformer"} · {tone(hNode.status).label}{hNode.sub ? ` · ${hNode.sub}` : ""}</p>
                    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-600 dark:text-slate-300">
                      <dt className="text-slate-400">Coordinates</dt><dd className="font-mono text-[11px]">{fmtCoord(hNode)}</dd>
                      {hNear ? (<><dt className="text-slate-400">Nearest</dt><dd className="truncate"><b>{fmtDistance(hNear.km)}</b> · {hNear.node.name}</dd></>) : null}
                      {hFar ? (<><dt className="text-slate-400">Farthest TX</dt><dd className="truncate"><b>{fmtDistance(hFar.km)}</b> · {hFar.node.name}</dd></>) : null}
                      {hGw ? (<><dt className="text-slate-400">Gateway</dt><dd className="truncate">{placed(hGw) ? <b>{fmtDistance(distanceKm(hNode, hGw))} · </b> : null}{hGw.name}</dd></>) : null}
                    </dl>
                  </>
                ) : hover.edge ? (
                  <>
                    <p className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100"><Ruler className="h-3.5 w-3.5" /> {fmtDistance(hover.edge.km)}</p>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">{nodes[hover.edge.a]?.name} ↔ {nodes[hover.edge.b]?.name}</p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800">
            {["ONLINE", "OFFLINE", tab === "gateway" ? "DEGRADED" : "DELAYED", "NEVER_SEEN"].map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: tone(s).hex }} /> {tone(s).label}</span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="w-5 border-t-2 border-blue-300" /> Shortest distance</span>
            <span className="ml-auto hidden sm:inline">Scroll to zoom · drag to move</span>
          </div>
        </div>

        {/* list */}
        <div className="flex h-[640px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="space-y-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tab === "gateway" ? "Gateways" : "Transformers"} <span className="font-normal text-slate-500">({fmtNum(listRows.length)})</span></p>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                <option value="nearest">Most isolated first</option>
                <option value="farthest">{tab === "gateway" ? "Farthest transformer first" : "Farthest from gateway first"}</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
            <label className="flex h-8 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm dark:border-slate-700">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Find a ${tab}…`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              {q ? <button type="button" onClick={() => setQ("")} aria-label="Clear"><X className="h-3.5 w-3.5 text-slate-400" /></button> : null}
            </label>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
            {loadingMain ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="space-y-2 px-4 py-3"><div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /><div className="h-2.5 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" /></li>
                ))}
              </ul>
            ) : pageRows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">{needsChoice ? `Choose a ${level} above.` : "Nothing matches."}</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {pageRows.map((n) => {
                  const near = nearestByKey.get(n.key);
                  const far = tab === "gateway" ? farthestServed(n) : null;
                  const served = tab === "gateway" ? servedBy.get(n.id)?.length ?? 0 : 0;
                  const gw = tab === "transformer" && n.gatewayId != null ? gatewayById.get(n.gatewayId) : null;
                  const gwKm = tab === "transformer" ? gwDistance(n) : null;
                  const active = selected === n.key;
                  return (
                    <li key={n.key}>
                      <div role="button" tabIndex={0} onClick={() => pick(n)} onKeyDown={(e) => { if (e.key === "Enter") pick(n); }} className={`block w-full cursor-pointer px-4 py-2.5 text-left transition ${active ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone(n.status).hex }} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100" title={n.name}>{n.name}</span>
                          <Link to={n.kind === "gateway" ? `/gateways?q=${encodeURIComponent(n.name)}` : `/transformer/${n.id}`} onClick={(e) => e.stopPropagation()} className="rounded-full p-1 text-slate-300 hover:text-blue-600" title="Open">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                        {!placed(n) ? (
                          <p className="mt-1 pl-[18px] text-xs text-amber-600">No coordinates — not on the graph</p>
                        ) : (
                          <dl className="mt-1 grid grid-cols-[76px_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-0.5 pl-[18px] text-xs">
                            <dt className="text-slate-400">Nearest</dt>
                            <dd className="truncate text-slate-600 dark:text-slate-300" title={near?.node.name}>{near?.node.name ?? "—"}</dd>
                            <dd className="text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmtDistance(near?.km)}</dd>
                            {tab === "gateway" ? (
                              <>
                                <dt className="text-slate-400">Farthest TX</dt>
                                <dd className="truncate text-slate-600 dark:text-slate-300" title={far?.node.name}>
                                  {loadingTransformers ? "Loading…" : far ? far.node.name : served ? "No coordinates" : "None yet"}
                                  {served ? <span className="text-slate-400"> · {served} served</span> : null}
                                </dd>
                                <dd className="text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmtDistance(far?.km)}</dd>
                              </>
                            ) : (
                              <>
                                <dt className="text-slate-400">Gateway</dt>
                                <dd className="truncate text-slate-600 dark:text-slate-300" title={gw?.name}>{gw?.name ?? "Not heard yet"}</dd>
                                <dd className="text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">{fmtDistance(gwKm)}</dd>
                              </>
                            )}
                          </dl>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Pager page={page} pageSize={PAGE} total={listRows.length} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}
