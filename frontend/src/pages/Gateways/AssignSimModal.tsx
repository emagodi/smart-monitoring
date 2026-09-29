import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { CardSim, Link2, Loader2, X } from "lucide-react";
import { Modal } from "../../components/ui/modal";

interface AvailableSim {
  id: number;
  iccid: string;
  msisdn?: string | null;
  operator?: string | null;
  status?: string | null;
}

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }
  return [];
};

const maskIccid = (iccid: string) => {
  if (!iccid) return "************0000";
  if (iccid.length <= 4) return `************${iccid}`;
  return `************${iccid.slice(-4)}`;
};

const maskMsisdn = (msisdn?: string | null) => {
  if (!msisdn) return null;
  if (msisdn.length <= 4) return `****${msisdn}`;
  return `****${msisdn.slice(-4)}`;
};

type AxiosErrorShape = {
  response?: { data?: { message?: string } };
  message?: string;
};

export function AssignSimModal({
  isOpen,
  onClose,
  gatewayId,
  onSaved,
  headers,
  apiBaseUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  gatewayId: number;
  onSaved: () => void;
  headers: Record<string, string>;
  apiBaseUrl: string;
}) {
  const [availableSims, setAvailableSims] = useState<AvailableSim[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [simId, setSimId] = useState<number | null>(null);
  const [slotNumber, setSlotNumber] = useState<number>(1);
  const [reason, setReason] = useState("");

  const loadAvailableSims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await axios.get(
        `${apiBaseUrl}/api/v1/sim-cards/available`,
        { headers }
      );
      setAvailableSims(normalizeList<AvailableSim>(resp.data));
    } catch (err) {
      console.error(err);
      const e = err as AxiosErrorShape;
      setError(
        "Failed to load available SIMs: " +
          (e.response?.data?.message || e.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, headers]);

  useEffect(() => {
    if (isOpen && gatewayId) {
      setSimId(null);
      setSlotNumber(1);
      setReason("");
      setError(null);
      void loadAvailableSims();
    }
  }, [isOpen, gatewayId, loadAvailableSims]);

  const onSubmit = async () => {
    if (simId === null) {
      setError("Please select a SIM card to assign.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await axios.post(
        `${apiBaseUrl}/api/v1/gateways/${gatewayId}/sims/assign`,
        { simId, slotNumber, reason },
        { headers }
      );
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      const e = err as AxiosErrorShape;
      setError(
        "Failed to assign SIM: " +
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
      className="max-w-3xl overflow-hidden rounded-[28px] bg-white p-0 shadow-2xl dark:bg-slate-950"
      backdropBlur
    >
      <div className="border-b border-slate-200/80 bg-gradient-to-r from-blue-50 via-white to-red-50 px-5 py-4 dark:border-slate-800 dark:from-blue-500/10 dark:via-slate-950 dark:to-red-500/10">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">
              Assign SIM Card
            </p>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
              Link SIM to gateway slot
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gateway ID #{gatewayId} — choose an available SIM card and slot.
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

      <div className="max-h-[68vh] space-y-4 overflow-y-auto px-5 py-4">
        {error !== null ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Slot Number</span>
            <select
              value={slotNumber}
              onChange={(e) => setSlotNumber(Number(e.target.value))}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value={1}>Slot 1</option>
              <option value={2}>Slot 2</option>
              <option value={3}>Slot 3</option>
              <option value={4}>Slot 4</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Assignment Reason</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Replacement SIM, new deployment"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        <div className="space-y-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Available SIM Card</span>
            <select
              value={simId ?? ""}
              onChange={(e) =>
                setSimId(e.target.value ? Number(e.target.value) : null)
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Select a SIM card...</option>
              {availableSims.map((sim) => (
                <option key={sim.id} value={sim.id}>
                  {maskIccid(sim.iccid)}
                  {sim.operator ? ` · ${sim.operator}` : ""}
                  {sim.msisdn ? ` · MSISDN ${maskMsisdn(sim.msisdn)}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="max-h-[340px] overflow-y-auto rounded-[22px] border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/60">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                Loading available SIMs...
              </div>
            ) : availableSims.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No available SIMs found. Add SIM cards in the SIM Inventory page.
              </div>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {availableSims.map((sim) => (
                  <button
                    key={sim.id}
                    type="button"
                    onClick={() => setSimId(sim.id)}
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition ${
                      simId === sim.id
                        ? "bg-blue-50/80 dark:bg-blue-500/10"
                        : "hover:bg-white dark:hover:bg-slate-900"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardSim className="h-3.5 w-3.5 text-slate-400" />
                        <p className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {maskIccid(sim.iccid)}
                        </p>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {sim.operator || "No operator"}
                        {sim.msisdn ? <> · MSISDN {maskMsisdn(sim.msisdn)}</> : null}
                        {sim.status ? <> · {sim.status}</> : null}
                      </p>
                    </div>
                    {simId === sim.id ? (
                      <span className="shrink-0 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        Selected
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || simId === null}
            onClick={() => void onSubmit()}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            {submitting ? "Assigning..." : "Confirm assign"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
