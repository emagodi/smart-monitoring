import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";

/** PIN / PUK captured when a SIM goes into a gateway (they are printed on the SIM plastic, not in operator exports). */
export type PinPuk = { pin: string; puk: string };

export const pinPukError = (v: PinPuk) => {
  if (v.pin && !/^\d{4,8}$/.test(v.pin)) return "PIN must be 4 to 8 digits.";
  if (v.puk && !/^\d{8}$/.test(v.puk)) return "PUK must be 8 digits.";
  return null;
};

export function PinPukFields({ value, onChange, hasPin, hasPuk }: { value: PinPuk; onChange: (v: PinPuk) => void; hasPin?: boolean | null; hasPuk?: boolean | null }) {
  const err = pinPukError(value);
  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white p-3 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-slate-950">
      <div className="mb-2 flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-blue-600" />
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">PIN &amp; PUK from the SIM plastic</p>
        <span className="ml-auto text-[10px] font-medium text-slate-400">optional · stored encrypted</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Secret label="PIN" value={value.pin} onChange={(pin) => onChange({ ...value, pin })} onFile={hasPin} max={8} placeholder="4–8 digits" />
        <Secret label="PUK" value={value.puk} onChange={(puk) => onChange({ ...value, puk })} onFile={hasPuk} max={8} placeholder="8 digits" />
      </div>
      {err ? <p className="mt-1.5 text-[11px] font-medium text-red-600">{err}</p> : null}
    </div>
  );
}

function Secret({ label, value, onChange, onFile, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; onFile?: boolean | null; max: number; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
        {onFile ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold normal-case tracking-normal text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30">
            <ShieldCheck className="h-2.5 w-2.5" /> on file — leave blank to keep
          </span>
        ) : null}
      </span>
      <span className="flex h-10 items-center rounded-xl border border-slate-200 bg-white pr-1 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 dark:border-slate-700 dark:bg-slate-900">
        <input
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          value={value}
          maxLength={max}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-sm tracking-widest text-slate-900 outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 dark:text-slate-100"
        />
        <button type="button" onClick={() => setShow(!show)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800" aria-label={show ? `Hide ${label}` : `Show ${label}`}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}
