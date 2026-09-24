import { useState } from "react";
import axios from "axios";
import { Loader2, Pencil, X } from "lucide-react";
import { Modal } from "../../components/ui/modal";

interface GatewayItem {
  id: number;
  name: string;
  depotName?: string | null;
  regionName?: string | null;
  districtName?: string | null;
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
}) {
  void token;
  const [name, setName] = useState(gateway.name || "");
  const [depotName, setDepotName] = useState(gateway.depotName || "");
  const [regionName, setRegionName] = useState(gateway.regionName || "");
  const [districtName, setDistrictName] = useState(gateway.districtName || "");
  const [networkName, setNetworkName] = useState(gateway.networkName || "");
  const [operator, setOperator] = useState(gateway.operator || "");
  const [latitude, setLatitude] = useState(
    typeof gateway.lat === "number" ? String(gateway.lat) : ""
  );
  const [longitude, setLongitude] = useState(
    typeof gateway.lng === "number" ? String(gateway.lng) : ""
  );
  const [address, setAddress] = useState(gateway.address || "");
  const [commissioningDate, setCommissioningDate] = useState("");
  const [locationVerified, setLocationVerified] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const requestBody = {
        name,
        depotName: depotName || null,
        regionName: regionName || null,
        districtName: districtName || null,
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
      onClose();
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

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
        {error !== null ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-500/20 dark:bg-blue-500/10">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Tip for coordinates: Find gateway on maps.google.com → right-click the exact spot → copy first pair of numbers as Latitude (e.g. -17.825...) and second as Longitude (31.033...). Save → appears immediately on Gateways Map page.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Depot</span>
            <input
              type="text"
              list="depot-list"
              value={depotName}
              onChange={(e) => setDepotName(e.target.value)}
              placeholder="Select or type..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <datalist id="depot-list">
              {depotOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Region</span>
            <input
              type="text"
              list="region-list"
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              placeholder="Select or type..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <datalist id="region-list">
              {regionOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">District</span>
            <input
              type="text"
              value={districtName}
              onChange={(e) => setDistrictName(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>

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

      <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void onSubmit()}
          className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
          {submitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </Modal>
  );
}
