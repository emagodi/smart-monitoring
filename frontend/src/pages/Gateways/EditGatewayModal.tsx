import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, Pencil, X } from "lucide-react";
import { Modal } from "../../components/ui/modal";
import { depotDistrictId, districtRegionId, useGeography } from "../Registry/geo";

interface GatewayItem {
  id: number;
  name: string;
  depotName?: string | null;
  regionName?: string | null;
  districtName?: string | null;
  regionId?: number | null;
  districtId?: number | null;
  depotId?: number | null;
  description?: string | null;
  customer?: string | null;
  altitude?: number | string | null;
  commissioningDate?: string | null;
  locationVerified?: boolean | null;
  networkName?: string | null;
  operator?: string | null;
  lat?: number;
  lng?: number;
  address?: string | null;
}

type AxiosErrorShape = {
  response?: { data?: { message?: string } };
  message?: string;
};

export function EditGatewayModal({
  isOpen,
  onClose,
  gateway,
  onSaved,
  token,
  apiBaseUrl,
  headers,
  depotOptions,
  regionOptions,
  networkOptions,
  operatorOptions,
  embed,
  onCancel,
  canSave = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  gateway: GatewayItem;
  onSaved: () => void;
  token: string;
  apiBaseUrl: string;
  headers: Record<string, string>;
  depotOptions: string[];
  regionOptions: string[];
  networkOptions: string[];
  operatorOptions: string[];
  embed?: boolean;
  onCancel?: () => void;
  canSave?: boolean;
}) {
  void depotOptions;
  void regionOptions;
  const geo = useGeography(token || null);
  const [name, setName] = useState(gateway.name || "");
  // Region / district / depot come from the configured lists (Regions, Districts, Depots pages) and are saved by id.
  const [regionId, setRegionId] = useState<number | null>(gateway.regionId ?? null);
  const [districtId, setDistrictId] = useState<number | null>(gateway.districtId ?? null);
  const [depotId, setDepotId] = useState<number | null>(gateway.depotId ?? null);
  const [matched, setMatched] = useState(false);
  const [networkName, setNetworkName] = useState(gateway.networkName || "");
  const [operator, setOperator] = useState(gateway.operator || "");
  const [latitude, setLatitude] = useState(
    typeof gateway.lat === "number" ? String(gateway.lat) : ""
  );
  const [longitude, setLongitude] = useState(
    typeof gateway.lng === "number" ? String(gateway.lng) : ""
  );
  const [address, setAddress] = useState(gateway.address || "");
  const [commissioningDate, setCommissioningDate] = useState(gateway.commissioningDate ? String(gateway.commissioningDate).slice(0, 10) : "");
  const [locationVerified, setLocationVerified] = useState(Boolean(gateway.locationVerified));

  const norm = (v?: string | null) => (v || "").trim().toLowerCase();
  const regionOf = (dId: number | null) => {
    const d = dId == null ? undefined : geo.districts.find((x) => x.id === dId);
    return d ? districtRegionId(d) ?? null : null;
  };
  const districtOf = (pId: number | null) => {
    const p = pId == null ? undefined : geo.depots.find((x) => x.id === pId);
    return p ? depotDistrictId(p) ?? null : null;
  };

  /* Once the lists load: fill blanks from the depot/district chosen, and match old free-typed names to the configured entries. */
  useEffect(() => {
    if (matched || !geo.depots.length || !geo.regions.length) return;
    const p = depotId ?? geo.depots.find((d) => norm(d.name) === norm(gateway.depotName))?.id ?? null;
    let d = districtId ?? geo.districts.find((x) => norm(x.name) === norm(gateway.districtName))?.id ?? null;
    if (p != null && d == null) d = districtOf(p);
    let r = regionId ?? geo.regions.find((x) => norm(x.name) === norm(gateway.regionName))?.id ?? null;
    if (d != null && r == null) r = regionOf(d);
    setDepotId(p);
    setDistrictId(d);
    setRegionId(r);
    setMatched(true);
  }, [geo.depots, geo.districts, geo.regions]); // eslint-disable-line react-hooks/exhaustive-deps

  const districtChoices = useMemo(
    () => geo.districts.filter((d) => regionId == null || districtRegionId(d) === regionId).sort((a, b) => a.name.localeCompare(b.name)),
    [geo.districts, regionId]
  );
  const depotChoices = useMemo(
    () =>
      geo.depots
        .filter((p) => {
          const d = depotDistrictId(p);
          if (districtId != null) return d === districtId;
          if (regionId != null) return d != null && regionOf(d) === regionId;
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [geo.depots, geo.districts, districtId, regionId] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const regionChoices = useMemo(() => [...geo.regions].sort((a, b) => a.name.localeCompare(b.name)), [geo.regions]);

  const pickRegion = (id: number | null) => {
    setRegionId(id);
    if (id != null && districtId != null && regionOf(districtId) !== id) { setDistrictId(null); setDepotId(null); }
  };
  const pickDistrict = (id: number | null) => {
    setDistrictId(id);
    if (id != null) setRegionId(regionOf(id) ?? regionId);
    if (id != null && depotId != null && districtOf(depotId) !== id) setDepotId(null);
  };
  const pickDepot = (id: number | null) => {
    setDepotId(id);
    if (id != null) {
      const d = districtOf(id);
      if (d != null) { setDistrictId(d); setRegionId(regionOf(d) ?? regionId); }
    }
  };
  const legacy = matched
    ? [
        !regionId && gateway.regionName ? `region "${gateway.regionName}"` : null,
        !districtId && gateway.districtName ? `district "${gateway.districtName}"` : null,
        !depotId && gateway.depotName ? `depot "${gateway.depotName}"` : null,
      ].filter(Boolean)
    : [];

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = () => {
    if (onCancel) onCancel();
    else onClose();
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const requestBody = {
        name,
        // if the lists could not load, keep what the gateway already had instead of clearing it
        ...(matched
          ? {
              regionId,
              districtId,
              depotId,
              regionName: geo.regions.find((r) => r.id === regionId)?.name ?? null,
              districtName: geo.districts.find((d) => d.id === districtId)?.name ?? null,
              depotName: geo.depots.find((d) => d.id === depotId)?.name ?? null,
            }
          : {
              regionId: gateway.regionId ?? null,
              districtId: gateway.districtId ?? null,
              depotId: gateway.depotId ?? null,
              regionName: gateway.regionName ?? null,
              districtName: gateway.districtName ?? null,
              depotName: gateway.depotName ?? null,
            }),
        // keep fields this form does not show, so saving does not clear them
        description: gateway.description ?? null,
        customer: gateway.customer ?? null,
        altitude: gateway.altitude != null && gateway.altitude !== "" ? Number(gateway.altitude) : null,
        networkName: networkName || null,
        operator: operator || null,
        latitude: latitude !== "" ? parseFloat(latitude) : null,
        longitude: longitude !== "" ? parseFloat(longitude) : null,
        address: address || null,
        commissioningDate: commissioningDate || null,
        locationVerified,
      };
      await axios.put(
        `${apiBaseUrl}/api/v1/gateways/${gateway.id}`,
        requestBody,
        { headers }
      );
      onSaved();
      if (!embed) onClose();
    } catch (err) {
      console.error(err);
      const e = err as AxiosErrorShape;
      setError(
        "Failed to save changes: " +
          (e.response?.data?.message || e.message || "Unknown error")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const Footer = (
    <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
      <button
        type="button"
        onClick={handleCancel}
        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {embed ? "Back to view" : "Cancel"}
      </button>
      <button
        type="button"
        disabled={submitting || !canSave}
        onClick={() => void onSubmit()}
        title={canSave ? "Save changes to gateway metadata" : "You do not have the 'gateways.edit' permission. Ask an administrator to grant it before you can save."}
        className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
        {submitting ? "Saving..." : "Save changes"}
      </button>
    </div>
  );

  const FormBody = (
    <div className="space-y-4">
      {embed ? (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-slate-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-300">
          Tip for coordinates: Find gateway on maps.google.com → right-click the exact spot → copy first pair of numbers as Latitude (e.g. -17.825...) and second as Longitude (31.033...). Save → appears immediately on Gateways Map page.
        </div>
      ) : null}
      {error !== null ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Region</span>
          <select value={regionId ?? ""} onChange={(e) => pickRegion(e.target.value ? Number(e.target.value) : null)} disabled={!geo.regions.length} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="">{geo.regions.length ? "Choose a region…" : "Loading…"}</option>
            {regionChoices.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">District</span>
          <select value={districtId ?? ""} onChange={(e) => pickDistrict(e.target.value ? Number(e.target.value) : null)} disabled={!geo.districts.length} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="">{regionId ? "Choose a district…" : "Any district"}</option>
            {districtChoices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Depot</span>
          <select value={depotId ?? ""} onChange={(e) => pickDepot(e.target.value ? Number(e.target.value) : null)} disabled={!geo.depots.length} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <option value="">{depotChoices.length ? "Choose a depot…" : "No depots in this area"}</option>
            {depotChoices.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>

        <p className="self-end pb-2 text-[11px] text-slate-500 dark:text-slate-400">
          {legacy.length
            ? `Previously typed ${legacy.join(", ")} is not in the configured list — choose the matching entry.`
            : "Lists come from the Regions, Districts and Depots pages. Choosing a depot fills in its district and region."}
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Network Name</span>
          <input
            type="text"
            list="network-list"
            value={networkName}
            onChange={(e) => setNetworkName(e.target.value)}
            placeholder="Select or type..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <datalist id="network-list">
            {networkOptions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Operator</span>
          <input
            type="text"
            list="operator-list"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            placeholder="Select or type..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <datalist id="operator-list">
            {operatorOptions.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Latitude</span>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="e.g. -17.825"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Longitude</span>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="e.g. 31.033"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Commissioning Date</span>
          <input
            type="date"
            value={commissioningDate}
            onChange={(e) => setCommissioningDate(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            checked={locationVerified}
            onChange={(e) => setLocationVerified(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Location Verified
          </span>
        </label>

        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Address</span>
          <textarea
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Full physical address..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
      </div>
    </div>
  );

  if (embed) {
    return (
      <div className="flex max-h-[75vh] flex-col">
        <div className="overflow-y-auto px-5 py-4">
          {FormBody}
        </div>
        {Footer}
      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl overflow-hidden rounded-[28px] bg-white p-0 shadow-2xl dark:bg-slate-950"
      backdropBlur
    >
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-50 via-white to-red-50 px-5 py-4 dark:border-slate-800 dark:from-blue-500/10 dark:via-slate-950 dark:to-red-500/10">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Edit Gateway
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
              {gateway.name} — update manual metadata
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Saved values are stored as source=MANUAL and override empty LORIOT API sync fields.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
        {FormBody}
      </div>
      {Footer}
    </Modal>
  );
}
