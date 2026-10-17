import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "./GoogleAssetMap";

export type MapPoint = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  status: string;
  openAlerts?: number;
};

export type MapCluster = { lat: number; lng: number; count: number; online: number; offline: number };

export type MapView = { south: number; west: number; north: number; east: number; zoom: number };

/** Ask the map to move. Change `key` to repeat the same move. */
export type MapFocus =
  | { key: number; kind: "point"; lat: number; lng: number; zoom?: number }
  | { key: number; kind: "bounds"; south: number; west: number; north: number; east: number }
  | { key: number; kind: "home" };

const ZIMBABWE = { south: -22.42, west: 25.24, north: -15.61, east: 33.07 };
const HOME_CENTER = { lat: -19.0154, lng: 29.1549 };

// Status colours: green online, red offline (reserved meaning across the system).
const STATUS_FILL: Record<string, string> = {
  ONLINE: "#10b981",
  DELAYED: "#f59e0b",
  OFFLINE: "#ef4444",
  NEVER_SEEN: "#94a3b8",
  NO_DEVICE: "#cbd5e1",
};

const MAP_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#1d4ed8" }, { weight: 1.6 }] },
  { featureType: "administrative.country", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#e2e8f0" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#cfe8ff" }] },
  { featureType: "landscape", elementType: "geometry.fill", stylers: [{ color: "#f8fafc" }] },
];

const pointIcon = (g: any, status: string, selected: boolean, alerting: boolean) => ({
  path: g.SymbolPath.CIRCLE,
  fillColor: STATUS_FILL[status] ?? STATUS_FILL.NO_DEVICE,
  fillOpacity: 1,
  strokeColor: selected ? "#1d4ed8" : alerting ? "#7f1d1d" : "#ffffff",
  strokeWeight: selected ? 4 : alerting ? 3 : 2,
  scale: selected ? 11 : 7,
});

const clusterIcon = (g: any, c: MapCluster) => {
  const offlineShare = c.count ? c.offline / c.count : 0;
  const fill = offlineShare >= 0.5 ? "#ef4444" : offlineShare >= 0.2 ? "#f59e0b" : "#10b981";
  return {
    path: g.SymbolPath.CIRCLE,
    fillColor: fill,
    fillOpacity: 0.88,
    strokeColor: "#ffffff",
    strokeWeight: 3,
    scale: Math.min(30, 13 + Math.log10(Math.max(c.count, 1)) * 7),
  };
};

type Props = {
  apiKey?: string;
  points: MapPoint[];
  clusters: MapCluster[];
  selectedId?: number | null;
  focus?: MapFocus | null;
  onSelect: (id: number) => void;
  onClusterClick?: (c: MapCluster) => void;
  onViewChange: (v: MapView) => void;
  className?: string;
};

/**
 * Google map of transformers as small status dots. It reports what area is on screen so the
 * page can load only those transformers, and draws numbered groups when an area holds too many.
 * Clicking a dot never opens a pop-up; it tells the page, which shows the details beside the map.
 */
export default function TransformerMap({ apiKey, points, clusters, selectedId, focus, onSelect, onClusterClick, onViewChange, className = "h-full" }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const markers = useRef(new Map<number, { m: any; status: string; alerting: boolean }>());
  const clusterMarkers = useRef<any[]>([]);
  const cb = useRef({ onSelect, onClusterClick, onViewChange });
  cb.current = { onSelect, onClusterClick, onViewChange };
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!apiKey) {
      setState("error");
      setError("Google Maps key missing. Set VITE_GOOGLE_MAPS_API_KEY in the frontend environment.");
      return;
    }
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => !cancelled && setState("ready"))
      .catch((e: Error) => {
        if (cancelled) return;
        setState("error");
        setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Create the map once.
  useEffect(() => {
    if (state !== "ready" || !box.current || map.current) return;
    const g = window.google.maps;
    const m = new g.Map(box.current, {
      center: HOME_CENTER,
      zoom: 7,
      minZoom: 6,
      maxZoom: 19,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
      styles: MAP_STYLES,
      // Zimbabwe only: the view can never leave the country (a small margin keeps border sites clear of the edge).
      restriction: {
        latLngBounds: new g.LatLngBounds({ lat: ZIMBABWE.south - 0.35, lng: ZIMBABWE.west - 0.35 }, { lat: ZIMBABWE.north + 0.35, lng: ZIMBABWE.east + 0.35 }),
        strictBounds: true,
      },
    });
    map.current = m;
    m.fitBounds(new g.LatLngBounds({ lat: ZIMBABWE.south, lng: ZIMBABWE.west }, { lat: ZIMBABWE.north, lng: ZIMBABWE.east }), 0);
    let timer: number | undefined;
    m.addListener("idle", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const b = m.getBounds();
        if (!b) return;
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        cb.current.onViewChange({ south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng(), zoom: m.getZoom() ?? 7 });
      }, 250);
    });
  }, [state]);

  // Points: add / update / remove by id (no full redraw on every pan).
  useEffect(() => {
    if (state !== "ready" || !map.current) return;
    const g = window.google.maps;
    const seen = new Set<number>();
    for (const p of points) {
      seen.add(p.id);
      const alerting = (p.openAlerts ?? 0) > 0;
      const selected = p.id === selectedId;
      const existing = markers.current.get(p.id);
      if (existing) {
        existing.m.setPosition({ lat: p.lat, lng: p.lng });
        if (existing.status !== p.status || existing.alerting !== alerting) {
          existing.m.setIcon(pointIcon(g, p.status, selected, alerting));
          existing.status = p.status;
          existing.alerting = alerting;
        }
        continue;
      }
      const m = new g.Marker({
        map: map.current,
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        icon: pointIcon(g, p.status, selected, alerting),
        optimized: true,
        zIndex: p.status === "OFFLINE" || alerting ? 20 : 10,
      });
      m.addListener("click", () => cb.current.onSelect(p.id));
      markers.current.set(p.id, { m, status: p.status, alerting });
    }
    markers.current.forEach((v, id) => {
      if (!seen.has(id)) {
        g.event.clearInstanceListeners(v.m);
        v.m.setMap(null);
        markers.current.delete(id);
      }
    });
  }, [points, selectedId, state]);

  // Selection highlight.
  useEffect(() => {
    if (state !== "ready") return;
    const g = window.google.maps;
    markers.current.forEach((v, id) => {
      v.m.setIcon(pointIcon(g, v.status, id === selectedId, v.alerting));
      v.m.setZIndex(id === selectedId ? 1000 : v.status === "OFFLINE" || v.alerting ? 20 : 10);
    });
  }, [selectedId, state]);

  // Groups (when an area holds more transformers than we draw one by one).
  useEffect(() => {
    if (state !== "ready" || !map.current) return;
    const g = window.google.maps;
    clusterMarkers.current.forEach((m) => {
      g.event.clearInstanceListeners(m);
      m.setMap(null);
    });
    clusterMarkers.current = clusters.map((c) => {
      const m = new g.Marker({
        map: map.current,
        position: { lat: c.lat, lng: c.lng },
        icon: clusterIcon(g, c),
        label: { text: c.count > 999 ? `${Math.round(c.count / 100) / 10}k` : String(c.count), color: "#ffffff", fontSize: "11px", fontWeight: "700" },
        title: `${c.count} transformers · ${c.online} online · ${c.offline} offline. Click to zoom in.`,
        zIndex: 5,
      });
      m.addListener("click", () => {
        if (cb.current.onClusterClick) cb.current.onClusterClick(c);
        else {
          map.current.panTo({ lat: c.lat, lng: c.lng });
          map.current.setZoom((map.current.getZoom() ?? 7) + 2);
        }
      });
      return m;
    });
  }, [clusters, state]);

  // Imperative moves requested by the page.
  useEffect(() => {
    if (state !== "ready" || !map.current || !focus) return;
    const g = window.google.maps;
    if (focus.kind === "point") {
      map.current.panTo({ lat: focus.lat, lng: focus.lng });
      if (focus.zoom && (map.current.getZoom() ?? 0) < focus.zoom) map.current.setZoom(focus.zoom);
    } else if (focus.kind === "bounds") {
      const b = new g.LatLngBounds({ lat: focus.south, lng: focus.west }, { lat: focus.north, lng: focus.east });
      map.current.fitBounds(b, 60);
      g.event.addListenerOnce(map.current, "idle", () => {
        if ((map.current.getZoom() ?? 0) > 15) map.current.setZoom(15);
      });
    } else {
      map.current.fitBounds(new g.LatLngBounds({ lat: ZIMBABWE.south, lng: ZIMBABWE.west }, { lat: ZIMBABWE.north, lng: ZIMBABWE.east }), 0);
    }
  }, [focus, state]);

  if (state === "error") {
    return <div className={`${className} flex items-center justify-center bg-slate-100 px-6 text-center text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300`}>{error}</div>;
  }
  return (
    <div className={`relative ${className}`}>
      <div ref={box} className="h-full w-full bg-slate-100 dark:bg-slate-900" />
      {state === "loading" ? <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-600 backdrop-blur-sm">Loading map…</div> : null}
    </div>
  );
}
