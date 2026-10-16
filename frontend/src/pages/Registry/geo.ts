import { useEffect, useMemo, useState } from "react";
import axios from "axios";

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

  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    const get = (url: string) => axios.get(`${API_BASE_URL}${url}`, { headers }).then((r) => r.data).catch(() => []);
    void Promise.all([get("/api/v1/regions"), get("/api/v1/districts?page=0&size=1000"), get("/api/v1/depots")]).then(([r, d, p]) => {
      setRegions(list<Region>(r).sort((a, b) => a.name.localeCompare(b.name)));
      setDistricts(list<District>(d).sort((a, b) => a.name.localeCompare(b.name)));
      setDepots(list<Depot>(p).sort((a, b) => a.name.localeCompare(b.name)));
      setLoaded(true);
    });
  }, [token]);

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

  return { regions, districts, depots, loaded, ...lookup };
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
