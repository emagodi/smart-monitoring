/** Great-circle distance helpers (haversine) for gateway / transformer coordinates. */

export type LatLng = { lat: number; lng: number };

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** A usable coordinate: numeric, in range and not the 0,0 placeholder. */
export function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  const a = lat == null || lat === "" ? NaN : Number(lat);
  const b = lng == null || lng === "" ? NaN : Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  if (a === 0 && b === 0) return null;
  return { lat: a, lng: b };
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "850 m", "4.2 km", "126 km". */
export function fmtDistance(km?: number | null): string {
  if (km == null || !Number.isFinite(km)) return "—";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

export const fmtCoord = (p: LatLng) => `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
