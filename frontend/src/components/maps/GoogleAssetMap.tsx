import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

declare global {
  interface Window {
    google?: any;
    __googleMapsInit?: () => void;
  }
}

export type GoogleAssetMapPoint = {
  id: number | string;
  name: string;
  lat: number;
  lng: number;
  isActive?: boolean;
};

type MarkerColors = {
  fillColor: string;
  strokeColor: string;
};

type GoogleAssetMapProps<T extends GoogleAssetMapPoint> = {
  apiKey?: string;
  points: T[];
  className?: string;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  selectedPointId?: number | string | null;
  emptyLabel?: string;
  onPointSelect?: (point: T) => void;
  onPointAction?: (point: T) => void;
  actionLabel?: string;
  getMarkerColors?: (point: T, isSelected: boolean) => MarkerColors;
  renderDetails?: (point: T) => ReactNode;
};

const GOOGLE_MAP_SCRIPT_ID = "powertel-google-maps-script";

const DEFAULT_CENTER = { lat: -19.0154, lng: 29.1549 };

const DEFAULT_MAP_STYLES = [
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#e2e8f0" }],
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [{ color: "#cfe8ff" }],
  },
  {
    featureType: "landscape",
    elementType: "geometry.fill",
    stylers: [{ color: "#f8fafc" }],
  },
];

const loadGoogleMaps = (apiKey: string) =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")), { once: true });
      return;
    }

    window.__googleMapsInit = () => resolve();

    const script = document.createElement("script");
    script.id = GOOGLE_MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=__googleMapsInit`;
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });

const defaultMarkerColors = <T extends GoogleAssetMapPoint>(point: T): MarkerColors =>
  point.isActive === false
    ? { fillColor: "#ef4444", strokeColor: "#b91c1c" }
    : { fillColor: "#2563eb", strokeColor: "#1d4ed8" };

const buildMarkerIcon = (googleMaps: any, colors: MarkerColors, isSelected: boolean) => ({
  path: googleMaps.SymbolPath.CIRCLE,
  fillColor: colors.fillColor,
  fillOpacity: 0.96,
  strokeColor: colors.strokeColor,
  strokeOpacity: 1,
  strokeWeight: isSelected ? 4 : 2,
  scale: isSelected ? 9 : 7,
});

export default function GoogleAssetMap<T extends GoogleAssetMapPoint>({
  apiKey,
  points,
  className = "h-[460px]",
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = 6,
  selectedPointId,
  emptyLabel = "No mapped assets are available for this view.",
  onPointSelect,
  onPointAction,
  actionLabel,
  getMarkerColors,
  renderDetails,
}: GoogleAssetMapProps<T>) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<number | string, any>>(new Map());
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<number | string | null>(null);

  const pointMap = useMemo(() => new Map(points.map((point) => [point.id, point])), [points]);
  const activeSelectedId = selectedPointId ?? internalSelectedId;
  const selectedPoint = (activeSelectedId != null ? pointMap.get(activeSelectedId) : undefined) ?? points[0] ?? null;

  useEffect(() => {
    if (selectedPointId !== undefined) {
      setInternalSelectedId(selectedPointId ?? null);
      return;
    }

    if (!points.length) {
      setInternalSelectedId(null);
      return;
    }

    if (internalSelectedId == null || !pointMap.has(internalSelectedId)) {
      setInternalSelectedId(points[0].id);
    }
  }, [internalSelectedId, pointMap, points, selectedPointId]);

  useEffect(() => {
    if (!apiKey) {
      setLoadState("error");
      setLoadError("Google Maps key missing. Set VITE_GOOGLE_MAPS_API_KEY in the frontend environment.");
      return;
    }

    let cancelled = false;
    setLoadState("loading");
    setLoadError(null);

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled) return;
        setLoadState("ready");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setLoadState("error");
        setLoadError(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    if (loadState !== "ready" || !mapContainerRef.current || mapRef.current) return;

    const googleMaps = window.google?.maps;
    if (!googleMaps) return;

    mapRef.current = new googleMaps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      clickableIcons: false,
      gestureHandling: "greedy",
      styles: DEFAULT_MAP_STYLES,
    });
  }, [defaultCenter, defaultZoom, loadState]);

  useEffect(() => {
    if (loadState !== "ready" || !mapRef.current || !window.google?.maps) return;

    const googleMaps = window.google.maps;
    const map = mapRef.current;

    markersRef.current.forEach((marker) => {
      googleMaps.event.clearInstanceListeners(marker);
      marker.setMap(null);
    });
    markersRef.current.clear();

    if (!points.length) {
      map.setCenter(defaultCenter);
      map.setZoom(defaultZoom);
      return;
    }

    const bounds = new googleMaps.LatLngBounds();

    points.forEach((point) => {
      const position = { lat: point.lat, lng: point.lng };
      const marker = new googleMaps.Marker({
        map,
        position,
        title: point.name,
        icon: buildMarkerIcon(
          googleMaps,
          (getMarkerColors ?? defaultMarkerColors)(point, point.id === activeSelectedId),
          point.id === activeSelectedId
        ),
      });

      marker.addListener("click", () => {
        setInternalSelectedId(point.id);
        onPointSelect?.(point);
      });

      markersRef.current.set(point.id, marker);
      bounds.extend(position);
    });

    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(Math.max(defaultZoom + 3, 10));
      return;
    }

    map.fitBounds(bounds, 72);
  }, [activeSelectedId, defaultCenter, defaultZoom, getMarkerColors, loadState, onPointSelect, points]);

  useEffect(() => {
    if (loadState !== "ready" || !mapRef.current || !window.google?.maps) return;

    const googleMaps = window.google.maps;
    markersRef.current.forEach((marker, pointId) => {
      const point = pointMap.get(pointId);
      if (!point) return;
      marker.setIcon(
        buildMarkerIcon(
          googleMaps,
          (getMarkerColors ?? defaultMarkerColors)(point, pointId === activeSelectedId),
          pointId === activeSelectedId
        )
      );
    });

    if (!selectedPoint) return;
    mapRef.current.panTo({ lat: selectedPoint.lat, lng: selectedPoint.lng });
  }, [activeSelectedId, getMarkerColors, loadState, pointMap, selectedPoint]);

  if (loadState === "error") {
    return (
      <div className={`${className} flex items-center justify-center rounded-[28px] bg-slate-100 px-6 text-center text-sm text-slate-600`}>
        {loadError}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-[28px] ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full bg-slate-100" />

      {loadState !== "ready" ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-medium text-slate-600 backdrop-blur-sm">
          Loading Google Maps...
        </div>
      ) : null}

      {loadState === "ready" && points.length === 0 ? (
        <div className="absolute inset-x-4 top-4 rounded-2xl border border-slate-200/90 bg-white/95 px-4 py-3 text-sm text-slate-600 shadow-lg">
          {emptyLabel}
        </div>
      ) : null}

      {loadState === "ready" && selectedPoint ? (
        <div className="absolute bottom-4 left-4 right-4 max-w-md rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.42)] backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Selected Asset</p>
              <h4 className="mt-1 text-base font-semibold text-slate-950">{selectedPoint.name}</h4>
            </div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                selectedPoint.isActive === false ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {selectedPoint.isActive === false ? "Offline" : "Online"}
            </span>
          </div>

          {renderDetails ? <div className="mt-3">{renderDetails(selectedPoint)}</div> : null}

          {actionLabel && onPointAction ? (
            <button
              type="button"
              onClick={() => onPointAction(selectedPoint)}
              className="mt-4 rounded-full bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
