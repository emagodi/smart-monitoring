import { useEffect, useRef, useState } from "react";
import { Loader2, MapPinned } from "lucide-react";
import { loadGoogleMaps } from "../../components/maps/GoogleAssetMap";

export type HeatPoint = {
  transformerId: number;
  transformerName: string;
  lat: number;
  lng: number;
  value: number;
  sub?: string;
};

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

/**
 * Heat map drawn as overlapping translucent circles (radius and colour grow with the count). Works without the
 * Google heatmap library (retired by Google), and every hot spot is clickable.
 */
export default function HeatMap({ points, color = "#dc2626", label = "alerts", className = "h-[460px]" }: { points: HeatPoint[]; color?: string; label?: string; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const shapesRef = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const infoRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!MAPS_KEY) {
      setState("error");
      return;
    }
    let cancelled = false;
    loadGoogleMaps(MAPS_KEY)
      .then(() => {
        if (cancelled || !ref.current) return;
        const g = (window as any).google; // eslint-disable-line @typescript-eslint/no-explicit-any
        mapRef.current = new g.maps.Map(ref.current, {
          center: { lat: -19.0, lng: 29.8 },
          zoom: 6,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
        });
        infoRef.current = new g.maps.InfoWindow();
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state !== "ready" || !mapRef.current) return;
    const g = (window as any).google; // eslint-disable-line @typescript-eslint/no-explicit-any
    shapesRef.current.forEach((s) => s.setMap(null));
    shapesRef.current = [];
    const max = Math.max(1, ...points.map((p) => p.value));
    const bounds = new g.maps.LatLngBounds();
    points
      .filter((p) => p.value > 0 && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      .sort((a, b) => a.value - b.value)
      .forEach((p) => {
        const k = Math.sqrt(p.value / max);
        // a soft halo and a stronger core give the "heat" look
        [
          { r: 1800 + 9000 * k, o: 0.12 + 0.18 * k },
          { r: 600 + 2500 * k, o: 0.35 + 0.4 * k },
        ].forEach(({ r, o }, i) => {
          const c = new g.maps.Circle({
            map: mapRef.current,
            center: { lat: p.lat, lng: p.lng },
            radius: r,
            fillColor: color,
            fillOpacity: o,
            strokeOpacity: i === 1 ? 0.6 : 0,
            strokeColor: color,
            strokeWeight: 1,
            clickable: i === 1,
          });
          if (i === 1) {
            c.addListener("click", () => {
              infoRef.current.setContent(
                `<div style="font:13px system-ui;max-width:220px"><b>${escapeHtml(p.transformerName)}</b><br/>${p.value} ${label}${p.sub ? `<br/><span style="color:#64748b">${escapeHtml(p.sub)}</span>` : ""}</div>`
              );
              infoRef.current.setPosition({ lat: p.lat, lng: p.lng });
              infoRef.current.open(mapRef.current);
            });
          }
          shapesRef.current.push(c);
        });
        bounds.extend({ lat: p.lat, lng: p.lng });
      });
    if (!bounds.isEmpty()) mapRef.current.fitBounds(bounds, 40);
  }, [points, state, color, label]);

  if (state === "error") {
    // No map available: list the hot spots instead.
    const top = points.slice().sort((a, b) => b.value - a.value).slice(0, 12);
    return (
      <div className={`${className} overflow-y-auto rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900`}>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <MapPinned className="h-4 w-4" /> Map unavailable here, hottest spots:
        </p>
        <ol className="space-y-1.5">
          {top.map((p) => (
            <li key={p.transformerId} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 rounded-full" style={{ width: `${Math.max(8, (p.value / Math.max(1, top[0]?.value ?? 1)) * 120)}px`, background: color }} />
              <span className="font-medium text-slate-800 dark:text-slate-100">{p.transformerName}</span>
              <span className="text-xs text-slate-500">{p.value}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  return (
    <div className={`relative ${className} overflow-hidden rounded-2xl`}>
      <div ref={ref} className="h-full w-full" />
      {state === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
        </div>
      ) : null}
    </div>
  );
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
