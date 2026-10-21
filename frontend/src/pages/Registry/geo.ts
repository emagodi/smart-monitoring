import { useEffect, useMemo, useState, useCallback } from "react";
import { cachedGet, invalidateCache } from "../../lib/cache";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export type Region = { id: number; name: string };
export type District = { id: number; name: string; regionId?: number | null; region_id?: number | null; region?: { id: number } | null };
export type Depot = { id: number; name: string; districtId?: number | null; district_id?: number | null; district?: { id: number; regionId?: number } | null };

const list = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
  }
  return [];
};

export const districtRegionId = (d: District) => d.regionId ?? d.region_id ?? d.region?.id ?? null;
export const depotDistrictId = (d: Depot) => d.districtId ?? d.district_id ?? d.district?.id ?? null;

export type GeoPath = { regionId: number | null; regionName: string; districtId: number | null; districtName: string; depotName: string };

/** Loads the Region → District → Depot hierarchy once and offers lookups. */
export function useGeography(token: string | null) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    // Cached for the session (5 min): the hierarchy rarely changes and many screens need it.
    const get = (url: string) => cachedGet<unknown>(`${API_BASE_URL}${url}`, token, 300_000).catch(() => []);
    void Promise.all([get("/api/v1/regions"), get("/api/v1/districts?page=0&size=1000"), get("/api/v1/depots")]).then(([r, d, p]) => {
      setRegions(list<Region>(r).slice().sort((a, b) => a.name.localeCompare(b.name)));
      setDistricts(list<District>(d).slice().sort((a, b) => a.name.localeCompare(b.name)));
      setDepots(list<Depot>(p).slice().sort((a, b) => a.name.localeCompare(b.name)));
      setLoaded(true);
    });
  }, [token, version]);

  const lookup = useMemo(() => {
    const regionById = new Map(regions.map((r) => [r.id, r]));
    const districtById = new Map(districts.map((d) => [d.id, d]));
    const depotById = new Map(depots.map((d) => [d.id, d]));
    const pathOf = (depotId?: number | null): GeoPath => {
      const depot = depotId != null ? depotById.get(depotId) : undefined;
      const district = depot ? districtById.get(depotDistrictId(depot) ?? -1) : undefined;
      const region = district ? regionById.get(districtRegionId(district) ?? -1) : undefined;
      return {
        regionId: region?.id ?? null,
        regionName: region?.name ?? (depot ? "Unmapped region" : "—"),
        districtId: district?.id ?? null,
        districtName: district?.name ?? (depot ? "Unmapped district" : "—"),
        depotName: depot?.name ?? (depotId != null ? `Depot ${depotId}` : "No depot"),
      };
    };
    return { regionById, districtById, depotById, pathOf };
  }, [depots, districts, regions]);

  /** Re-read the hierarchy after a region / district / depot was created, renamed or removed. */
  const refresh = useCallback(() => {
    invalidateCache("/api/v1/regions");
    invalidateCache("/api/v1/districts");
    invalidateCache("/api/v1/depots");
    setVersion((v) => v + 1);
  }, []);

  // One stable object per data change. Returning a fresh object on every render made every screen that lists
  // `geo` in a dependency array re-run its effects on each render (on the Transformers page: an endless
  // fetch/render loop that froze clicks and paging).
  return useMemo(() => ({ regions, districts, depots, loaded, refresh, ...lookup }), [regions, districts, depots, loaded, refresh, lookup]);
}

/** Suggest a depot from free text such as the partner's station name ("Kuwadzana"). */
export const suggestDepot = (depots: Depot[], ...hints: Array<string | null | undefined>) => {
  const words = hints
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 4);
  if (!words.length) return null;
  let best: { depot: Depot; score: number } | null = null;
  for (const d of depots) {
    const name = d.name.toLowerCase();
    const score = words.reduce((s, w) => s + (name.includes(w) ? w.length : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { depot: d, score };
  }
  return best?.depot ?? null;
};
