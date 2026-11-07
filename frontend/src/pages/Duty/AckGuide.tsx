import { BellRing, Check, CheckCheck, Globe, MessageCircle, MonitorSmartphone, Phone, ShieldCheck, Siren } from "lucide-react";

/** The three ways the reaction team acknowledges and updates an alert, shown as what they will actually see. */
export default function AckGuide() {
  return (
    <section className="ui-panel overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#0a2a6b] to-[#0b4fc4] text-white shadow-sm shadow-blue-600/30">
            <MonitorSmartphone className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">How the team acknowledges</h2>
            <p className="text-xs text-slate-500">Any channel works. Whichever is used first updates the Response Desk for everyone.</p>
          </div>
        </div>
        <ol className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
          {["Alert", "Acknowledge", "On site", "Close with outcome"].map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`rounded-full px-2.5 py-1 ${i === 0 ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" : "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"}`}>{s}</span>
              {i < 3 ? <span className="text-slate-300">→</span> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-3">
        {/* Web */}
        <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <header className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-white">
            <Globe className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Web</p>
              <p className="text-[11px] text-blue-100">Any page in TAIS</p>
            </div>
          </header>
          <div className="flex-1 space-y-3 p-4">
            <div className="overflow-hidden rounded-xl border border-red-200 shadow-sm">
              <div className="flex items-center gap-2 bg-red-600 px-3 py-2 text-[11px] text-white">
                <Siren className="h-3.5 w-3.5 animate-pulse" />
                <span className="flex-1 truncate font-semibold">1 unacknowledged alert · #1288 Glen View 3</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 font-bold text-red-700">
                  <Check className="h-3 w-3" /> Acknowledge
                </span>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-2">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> The siren rings on every page for people on duty until someone acknowledges.
              </li>
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /> Acknowledge on the red banner, or dispatch and close on the Response Desk.
              </li>
            </ul>
          </div>
        </article>

        {/* WhatsApp */}
        <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <header className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-green-500 px-4 py-3 text-white">
            <MessageCircle className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">WhatsApp</p>
              <p className="text-[11px] text-emerald-100">Reply to the alert message</p>
            </div>
          </header>
          <div className="flex-1 space-y-2 bg-[#efeae2] p-4 dark:bg-slate-900">
            <div className="max-w-[90%] rounded-xl rounded-tl-sm bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm">
              <b className="text-red-600">INTRUSION ALERT #1288</b>: motion at Glen View 3 (Warren Park). Reply <b>ACK 1288</b> to acknowledge.
            </div>
            {[
              ["ACK 1288", "acknowledge"],
              ["ARRIVED 1288", "team on site"],
              ["CLOSE 1288 FALSE", "close: FALSE · REAL · FAULT · AUTH"],
            ].map(([cmd, what]) => (
              <div key={cmd} className="flex items-center justify-end gap-2">
                <span className="text-[10px] text-slate-500">{what}</span>
                <span className="inline-flex items-center gap-1 rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-1.5 font-mono text-[12px] font-semibold text-slate-800 shadow-sm">
                  {cmd} <CheckCheck className="h-3.5 w-3.5 text-sky-500" />
                </span>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-slate-500">
              Send <b className="font-mono">OPEN</b> to list open alerts in your area.
            </p>
          </div>
        </article>

        {/* USSD */}
        <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <header className="flex items-center gap-2.5 bg-gradient-to-r from-violet-600 to-indigo-500 px-4 py-3 text-white">
            <Phone className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">USSD</p>
              <p className="text-[11px] text-violet-100">Any phone · no data needed</p>
            </div>
          </header>
          <div className="flex flex-1 items-center justify-center bg-slate-50 p-4 dark:bg-slate-900">
            <div className="w-full max-w-[230px] rounded-[22px] border-[6px] border-slate-800 bg-slate-800 shadow-lg">
              <div className="rounded-[14px] bg-gradient-to-b from-slate-100 to-white px-3 py-3 font-mono text-[12px] leading-relaxed text-slate-800">
                <p className="mb-1 font-bold">TAIS reaction desk</p>
                <p>1. Open alerts</p>
                <p>2. Acknowledge alert</p>
                <p>3. Team on site</p>
                <p>4. Close alert</p>
                <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                  <span className="rounded bg-white px-2 py-0.5 ring-1 ring-slate-300">2</span>
                  <span className="font-sans font-semibold text-violet-700">Send</span>
                </div>
              </div>
            </div>
          </div>
          <p className="px-4 pb-3 pt-2 text-[11px] text-slate-500">Choose an option, then enter the alert number. Closing asks for the outcome.</p>
        </article>
      </div>

      <p className="flex items-center gap-1.5 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500 dark:border-slate-800">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
        The phone number must be on the person&apos;s user profile. Every action runs with their own permissions and is recorded in the incident timeline.
      </p>
    </section>
  );
}
