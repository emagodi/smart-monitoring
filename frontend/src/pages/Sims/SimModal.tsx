import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Eye, EyeOff, Loader2, Pencil, Plus, Save, X } from "lucide-react";
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

const looksLikeMask = (s: string | null | undefined) => {
  const t = (s ?? "").trim();
  if (!t) return true;
  if (t === "****") return true;
  if (t.startsWith("*") && (t.includes("************") || t.includes("********"))) return true;
  if (/^\*+$/.test(t)) return true;
  return false;
};

const passwordWrapper = "flex flex-col gap-1.5";
const labelClass = "text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400";
const inputBase =
  "rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const inputClass = inputBase + " w-full";
const inputPasswordInner =
  "rounded-l-2xl border border-r-0 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 w-full";
const revealBtn =
  "inline-flex h-full items-center justify-center rounded-r-2xl border border-l-0 border-slate-200 bg-white px-3 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100";

const PasswordInput = ({
  label,
  value,
  onChange,
  placeholder,
  maskedDisplay,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maskedDisplay?: string;
}) => {
  const [show, setShow] = useState(false);
  const displayValue = show ? value : (maskedDisplay ?? "****");
  return (
    <label className={passwordWrapper}>
      <span className={labelClass}>{label}</span>
      <div className="flex">
        <input
          type="text"
          value={displayValue}
          placeholder={placeholder ?? ""}
          readOnly={!show}
          onChange={(e) => {
            if (!show) return;
            onChange(e.target.value);
          }}
          className={inputPasswordInner + (show ? "" : " cursor-default select-none")}
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className={revealBtn}
          title={show ? "Hide" : "Show"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
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
  const [loadingReveal, setLoadingReveal] = useState(false);

  const [iccid, setIccid] = useState("");
  const [imsi, setImsi] = useState("");
  const [msisdn, setMsisdn] = useState("");
  const [cardSerialNumber, setCardSerialNumber] = useState("");
  const [operator, setOperator] = useState("");
  const [networkName, setNetworkName] = useState("");
  const [apn, setApn] = useState("");

  const [pin, setPin] = useState("");
  const [puk, setPuk] = useState("");
  const [pin2, setPin2] = useState("");
  const [puk2, setPuk2] = useState("");

  const [status, setStatus] = useState("");
  const [activationDate, setActivationDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [dataPlanGb, setDataPlanGb] = useState("");
  const [allowanceGb, setAllowanceGb] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
    if (isEdit && existing) {
      setIccid(existing.iccid ? String(existing.iccid) : "");
      setImsi(existing.imsi ?? "");
      setMsisdn(existing.msisdn ?? "");
      setCardSerialNumber(existing.cardSerialNumber ?? "");
      setOperator(existing.operator ?? "");
      setNetworkName(existing.networkName ?? "");
      setApn(existing.apn ?? "");
      setPin(existing.pin ?? "");
      setPuk(existing.puk ?? "");
      setPin2(existing.pin2 ?? "");
      setPuk2(existing.puk2 ?? "");
      setStatus(existing.status ?? "");
      setActivationDate(existing.activationDate ? String(existing.activationDate).slice(0, 10) : "");
      setExpiryDate(existing.expiryDate ? String(existing.expiryDate).slice(0, 10) : "");
      setDataPlanGb(typeof existing.dataPlanGb === "number" ? String(existing.dataPlanGb) : "");
      setAllowanceGb(typeof existing.allowanceGb === "number" ? String(existing.allowanceGb) : "");
      setNotes(existing.notes ?? "");

      setLoadingReveal(true);
      (async () => {
        try {
          const resp = await axios.post(
            `${apiBaseUrl}/api/v1/sim-cards/${existing.id}/reveal-sensitive`,
            { reason: "edit-modal auto-reveal (DB load)" },
            { headers }
          );
          const d = (resp.data || {}) as Record<string, unknown>;
          if (typeof d.iccid === "string" && d.iccid.length > 0) setIccid(d.iccid);
          if (typeof d.imsi === "string" && d.imsi.length > 0) setImsi(d.imsi);
          if (typeof d.msisdn === "string" && d.msisdn.length > 0) setMsisdn(d.msisdn);
          if (typeof d.pin === "string" && d.pin.length > 0) setPin(d.pin);
          if (typeof d.puk === "string" && d.puk.length > 0) setPuk(d.puk);
          if (typeof d.pin2 === "string" && d.pin2.length > 0) setPin2(d.pin2);
          if (typeof d.puk2 === "string" && d.puk2.length > 0) setPuk2(d.puk2);
        } catch (e) {
          console.warn("reveal for edit failed, using masked values from list", e);
        } finally {
          setLoadingReveal(false);
        }
      })();
    } else {
      setLoadingReveal(false);
      setIccid("");
      setImsi("");
      setMsisdn("");
      setCardSerialNumber("");
      setOperator("");
      setNetworkName("");
      setApn("");
      setPin("");
      setPuk("");
      setPin2("");
      setPuk2("");
      setStatus("AVAILABLE");
      setActivationDate("");
      setExpiryDate("");
      setDataPlanGb("");
      setAllowanceGb("");
      setNotes("");
    }
  }, [isOpen, existing, isEdit, apiBaseUrl, headers]);

  const header = useMemo(() => {
    if (!isEdit) return { title: "Register a new SIM card", subtitle: "Capture ICCID/MSISDN/PIN/PUK + all other identifiers printed on the SIM plastic. Sensitive values are AES-GCM encrypted at rest." };
    const sub = existing?.iccid ? maskIccid(String(existing.iccid)) : existing?.id ? `SIM #${existing.id}` : "Edit SIM Card";
    return {
      title: sub,
      subtitle: "Update metadata or rotate PIN/PUK credentials. Fields showing masked placeholders are left unchanged unless you type new values.",
    };
  }, [isEdit, existing]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const body: Record<string, unknown> = {
        iccid: isEdit ? (looksLikeMask(iccid) ? null : trim(iccid)) : trim(iccid),
        imsi: isEdit ? (looksLikeMask(imsi) ? null : trim(imsi)) : trim(imsi),
        msisdn: isEdit ? (looksLikeMask(msisdn) ? null : trim(msisdn)) : trim(msisdn),
        cardSerialNumber: isEdit ? (looksLikeMask(cardSerialNumber) ? null : trim(cardSerialNumber)) : trim(cardSerialNumber),
        operator: trim(operator),
        networkName: trim(networkName),
        apn: trim(apn),
        status: trim(status),
        activationDate: trim(activationDate),
        expiryDate: trim(expiryDate),
        dataPlanGb: dataPlanGb ? parseFloat(dataPlanGb) : null,
        allowanceGb: allowanceGb ? parseFloat(allowanceGb) : null,
        notes: trim(notes),
      };

      if (isEdit) {
        if (!looksLikeMask(pin) && trim(pin) != null) body.pin = trim(pin);
        if (!looksLikeMask(puk) && trim(puk) != null) body.puk = trim(puk);
        if (!looksLikeMask(pin2) && trim(pin2) != null) body.pin2 = trim(pin2);
        if (!looksLikeMask(puk2) && trim(puk2) != null) body.puk2 = trim(puk2);
      } else {
        body.pin = trim(pin);
        body.puk = trim(puk);
        body.pin2 = trim(pin2);
        body.puk2 = trim(puk2);
      }

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
              {header.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {header.subtitle}
              {loadingReveal ? (
                <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-300">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading actual values from database...
                </span>
              ) : null}
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
              <span className={labelClass}>Network Name</span>
              <input
                type="text"
                value={networkName}
                onChange={(e) => setNetworkName(e.target.value)}
                placeholder="Powertel LoRaWAN, Econet LTE"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-2">
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
            <PasswordInput label="PIN" value={pin} onChange={setPin} placeholder="4-8 digits" />
            <PasswordInput label="PUK" value={puk} onChange={setPuk} placeholder="8 digits" />
            <PasswordInput label="PIN2 (optional)" value={pin2} onChange={setPin2} />
            <PasswordInput label="PUK2 (optional)" value={puk2} onChange={setPuk2} />
          </div>
        </div>

        <div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Lifecycle &amp; Billing
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
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
              <input type="date" value={activationDate} onChange={(e) => setActivationDate(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={labelClass}>Expiry Date</span>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
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
            disabled={submitting || loadingReveal}
            className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEdit ? (
              <Save className="h-4 w-4" />
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
