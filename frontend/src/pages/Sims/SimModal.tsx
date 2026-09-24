import { useState } from "react";
import axios from "axios";
import { Loader2, Plus, X } from "lucide-react";
import { Modal } from "../../components/ui/modal";

interface SimCardItem {
  id: number;
  iccid: string;
  imsi?: string | null;
  msisdn?: string | null;
  pin?: string | null;
  puk?: string | null;
  operator?: string | null;
  networkName?: string | null;
  status?: string | null;
  slotNumber?: number | null;
  assignedGatewayId?: number | null;
  assignedGatewayName?: string | null;
  assignedAt?: string | null;
  unassignedAt?: string | null;
  activatedAt?: string | null;
  cardSerialNumber?: string | null;
  apn?: string | null;
  pin2?: string | null;
  puk2?: string | null;
  ki?: string | null;
  opc?: string | null;
  activationDate?: string | null;
  expiryDate?: string | null;
  dataPlanGb?: number | null;
  allowanceGb?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const maskIccid = (iccid: string) => {
  if (!iccid) return "************0000";
  if (iccid.length <= 4) return `************${iccid}`;
  return `************${iccid.slice(-4)}`;
};

const trim = (s: string | null | undefined): string | null => {
  if (typeof s === "string") {
    const t = s.trim();
    return t.length > 0 ? t : null;
  }
  return null;
};

export function SimModal({
  isOpen,
  onClose,
  isEdit,
  existing,
  onSaved,
  headers,
  apiBaseUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  isEdit: boolean;
  existing?: SimCardItem | null;
  onSaved: () => void;
  headers: Record<string, string>;
  apiBaseUrl: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [iccid, setIccid] = useState<string>(isEdit && existing?.iccid ? existing.iccid : "");
  const [imsi, setImsi] = useState<string>(isEdit && existing?.imsi ? String(existing.imsi) : "");
  const [msisdn, setMsisdn] = useState<string>(isEdit && existing?.msisdn ? String(existing.msisdn) : "");
  const [cardSerialNumber, setCardSerialNumber] = useState<string>(isEdit && existing?.cardSerialNumber ? String(existing.cardSerialNumber) : "");
  const [operator, setOperator] = useState<string>(isEdit && existing?.operator ? String(existing.operator) : "");
  const [apn, setApn] = useState<string>(isEdit && existing?.apn ? String(existing.apn) : "");

  const [pin, setPin] = useState<string>(isEdit && existing?.pin ? String(existing.pin) : "");
  const [puk, setPuk] = useState<string>(isEdit && existing?.puk ? String(existing.puk) : "");
  const [pin2, setPin2] = useState<string>(isEdit && existing?.pin2 ? String(existing.pin2) : "");
  const [puk2, setPuk2] = useState<string>(isEdit && existing?.puk2 ? String(existing.puk2) : "");
  const [ki, setKi] = useState<string>(isEdit && existing?.ki ? String(existing.ki) : "");
  const [opc, setOpc] = useState<string>(isEdit && existing?.opc ? String(existing.opc) : "");

  const [status, setStatus] = useState<string>(isEdit && existing?.status ? String(existing.status) : "");
  const [activationDate, setActivationDate] = useState<string>(isEdit && existing?.activationDate ? String(existing.activationDate).slice(0, 10) : "");
  const [expiryDate, setExpiryDate] = useState<string>(isEdit && existing?.expiryDate ? String(existing.expiryDate).slice(0, 10) : "");
  const [dataPlanGb, setDataPlanGb] = useState<string>(isEdit && typeof existing?.dataPlanGb === "number" ? String(existing.dataPlanGb) : "");
  const [allowanceGb, setAllowanceGb] = useState<string>(isEdit && typeof existing?.allowanceGb === "number" ? String(existing.allowanceGb) : "");
  const [notes, setNotes] = useState<string>(isEdit && existing?.notes ? String(existing.notes) : "");

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const body = {
        iccid: trim(iccid),
        imsi: trim(imsi),
        msisdn: trim(msisdn),
        cardSerialNumber: trim(cardSerialNumber),
        operator: trim(operator),
        apn: trim(apn),
        pin: trim(pin),
        puk: trim(puk),
        pin2: trim(pin2),
        puk2: trim(puk2),
        ki: trim(ki),
        opc: trim(opc),
        status: trim(status),
        activationDate: trim(activationDate),
        expiryDate: trim(expiryDate),
        dataPlanGb: dataPlanGb ? parseFloat(dataPlanGb) : null,
        allowanceGb: allowanceGb ? parseFloat(allowanceGb) : null,
        notes: trim(notes),
      };

      if (isEdit && existing) {
        await axios.put(`${apiBaseUrl}/api/v1/sim-cards/${existing.id}`, body, { headers });
      } else {
        await axios.post(`${apiBaseUrl}/api/v1/sim-cards`, body, { headers });
      }

      onSaved();
      onClose();
    } catch (submitError) {
      console.error(submitError);
      setError(isEdit ? "Failed to save SIM changes." : "Failed to create SIM card.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelClass = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400";
  const inputClass =
    "rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

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
              {isEdit ? "Edit SIM Card" : "New SIM Card"}
            </p>
            <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">
              {isEdit
                ? existing
                  ? existing.iccid
                    ? maskIccid(existing.iccid)
                    : `SIM #${existing.id}`
                  : "Edit SIM Card"
                : "Register a new SIM card"}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isEdit
                ? "Update metadata or rotate PIN/PUK credentials."
                : "Capture ICCID/MSISDN/PIN/PUK + all other identifiers printed on the SIM plastic. Sensitive values are AES-GCM encrypted at rest."}
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
        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-3 text-xs text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Core Identifiers
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>ICCID</span>
              <input
                type="text"
                value={iccid}
                onChange={(e) => setIccid(e.target.value)}
                placeholder="8944110061234567890"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>IMSI</span>
              <input
                type="text"
                value={imsi}
                onChange={(e) => setImsi(e.target.value)}
                placeholder="654010012345678"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>MSISDN / Phone Number</span>
              <input
                type="text"
                value={msisdn}
                onChange={(e) => setMsisdn(e.target.value)}
                placeholder="263771234567"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Card Body Serial Number</span>
              <input
                type="text"
                value={cardSerialNumber}
                onChange={(e) => setCardSerialNumber(e.target.value)}
                placeholder="Printed on plastic, not ICCID"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Operator</span>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Econet, NetOne, Powertel, Liquid"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>APN</span>
              <input
                type="text"
                value={apn}
                onChange={(e) => setApn(e.target.value)}
                placeholder="internet"
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-500">
            Security Credentials (encrypted)
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>PIN</span>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-8 digits"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>PUK</span>
              <input
                type="text"
                value={puk}
                onChange={(e) => setPuk(e.target.value)}
                placeholder="8 digits"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>PIN2 (optional)</span>
              <input
                type="text"
                value={pin2}
                onChange={(e) => setPin2(e.target.value)}
                placeholder=""
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>PUK2 (optional)</span>
              <input
                type="text"
                value={puk2}
                onChange={(e) => setPuk2(e.target.value)}
                placeholder=""
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>KI</span>
              <input
                type="text"
                value={ki}
                onChange={(e) => setKi(e.target.value)}
                placeholder="32 hex operator key material"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>OPC</span>
              <input
                type="text"
                value={opc}
                onChange={(e) => setOpc(e.target.value)}
                placeholder="32 hex operator variant"
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Lifecycle &amp; Billing
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="">— Select status —</option>
                <option value="AVAILABLE">Available</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="RETIRED">Retired</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Activation Date</span>
              <input
                type="date"
                value={activationDate}
                onChange={(e) => setActivationDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Expiry Date</span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Data Plan (GB)</span>
              <input
                type="number"
                step="0.01"
                value={dataPlanGb}
                onChange={(e) => setDataPlanGb(e.target.value)}
                placeholder="25.00"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Allowance (GB)</span>
              <input
                type="number"
                step="0.01"
                value={allowanceGb}
                onChange={(e) => setAllowanceGb(e.target.value)}
                placeholder="25.00"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className={labelClass}>Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Provisioning notes, plan details, replacement history..."
                className={inputClass}
              />
            </label>
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
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {submitting
              ? isEdit
                ? "Saving..."
                : "Creating..."
              : isEdit
              ? "Save changes"
              : "Create SIM card"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
