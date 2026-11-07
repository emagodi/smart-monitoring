import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
import axios from "axios";
import { BellRing, Loader2, Mail, MessageCircle, Phone, Save, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useScope } from "../../lib/scope";
import { cachedGet, invalidateCache } from "../../lib/cache";
import { Button, EmptyRow, HeroStat, HeroStats, Notice, PageHero, Panel, SearchBox, SelectBox, SkeletonRows, tableCls } from "../../components/ui/page";
import { useGeography } from "../Registry/geo";
import { apiError } from "../Response/shared";
import AckGuide from "./AckGuide";

const API = (import.meta.env.VITE_API_BASE_URL || "") + "/api/v1/duty";

type Person = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  depotId?: number | null;
  depot?: string | null;
  regionId?: number | null;
  region?: string | null;
  roles?: string[];
  canAcknowledge?: boolean;
  onDuty: "ALL" | "SOME" | "NONE";
  onDutyDepots: number[];
  notifySms: boolean;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
  shiftNote?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  stale?: boolean;
};

type Roster = { depotIds: number[]; people: Person[]; onDutyCount: number };

type Draft = { onDuty: boolean; notifySms: boolean; notifyWhatsapp: boolean; notifyEmail: boolean; shiftNote: string };

export default function DutyRoster() {
  const { token, hasPermission } = useAuth();
  const { isDepot, depotId: myDepot } = useScope();
  const geo = useGeography(token);
  const canManage = hasPermission("duty.manage");
  const [regionId, setRegionId] = useState<string>("");
  const [depotId, setDepotId] = useState<string>(myDepot ? String(myDepot) : "");
  const [roster, setRoster] = useState<Roster | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [onlyAck, setOnlyAck] = useState(true);

  const regionDepots = useMemo(() => (regionId ? geo.depots.filter((d) => geo.pathOf(d.id).regionId === Number(regionId)) : []), [geo, regionId]);
  // A whole region is managed by ticking people for all of its depots at once.
  const depotIds = useMemo(() => (depotId ? [Number(depotId)] : regionDepots.map((d) => d.id)), [depotId, regionDepots]);
  const scopeLabel = depotId ? `${geo.pathOf(Number(depotId)).depotName} depot` : regionId ? `all ${regionDepots.length} depots of ${geo.regions.find((r) => r.id === Number(regionId))?.name ?? "the region"}` : "";

  useEffect(() => {
    if (isDepot && myDepot) setDepotId(String(myDepot));
  }, [isDepot, myDepot]);

  const loadCoverage = useCallback(() => {
    if (!token) return;
    cachedGet<Record<string, number>>(`${API}/coverage`, token, 0, true)
      .then((c) => setCoverage(c ?? {}))
      .catch(() => setCoverage({}));
  }, [token]);

  useEffect(loadCoverage, [loadCoverage]);

  const load = useCallback(async () => {
    if (!token || depotIds.length === 0) {
      setRoster(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ depotIds: depotIds.join(",") });
      if (regionId) qs.set("regionId", regionId);
      else if (depotId) {
        const r = geo.pathOf(Number(depotId)).regionId;
        if (r) qs.set("regionId", String(r));
      }
      const r = await cachedGet<Roster>(`${API}?${qs}`, token, 0, true);
      setRoster(r);
      setDrafts(
        Object.fromEntries(
          r.people.map((p) => [p.id, { onDuty: p.onDuty === "ALL", notifySms: p.notifySms, notifyWhatsapp: p.notifyWhatsapp, notifyEmail: p.notifyEmail, shiftNote: p.shiftNote ?? "" }])
        )
      );
    } catch (e) {
      setError(apiError(e, "Could not load the roster."));
    } finally {
      setLoading(false);
    }
  }, [token, depotIds, regionId, depotId, geo]);

  useEffect(() => {
    void load();
  }, [load]);

  const changed = useMemo(() => {
    if (!roster) return [] as number[];
    return roster.people
      .filter((p) => {
        const d = drafts[p.id];
        if (!d) return false;
        return d.onDuty !== (p.onDuty === "ALL") || d.notifySms !== p.notifySms || d.notifyWhatsapp !== p.notifyWhatsapp || d.notifyEmail !== p.notifyEmail || d.shiftNote !== (p.shiftNote ?? "");
      })
      .map((p) => p.id);
  }, [roster, drafts]);

  const save = async () => {
    if (!roster || !changed.length) return;
    setSaving(true);
    setError(null);
    try {
      await axios.put(
        `${API}${regionId ? `?regionId=${regionId}` : ""}`,
        { depotIds, entries: changed.map((id) => ({ userId: id, ...drafts[id] })) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      invalidateCache("/api/v1/duty");
      setNotice(`Roster saved for ${scopeLabel}. On-duty staff now receive and acknowledge its alerts.`);
      await load();
      loadCoverage();
    } catch (e) {
      setError(apiError(e, "Could not save the roster."));
    } finally {
      setSaving(false);
    }
  };

  const set = (id: number, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const people = (roster?.people ?? []).filter((p) => {
    if (onlyAck && p.canAcknowledge === false && !drafts[p.id]?.onDuty) return false;
    const s = q.trim().toLowerCase();
    return !s || [p.name, p.email, p.depot, p.region, ...(p.roles ?? [])].some((v) => v && v.toLowerCase().includes(s));
  });
  const onNow = (roster?.people ?? []).filter((p) => drafts[p.id]?.onDuty).length;
  const coveredDepots = Object.keys(coverage).length;
  const totalDepots = geo.depots.length;

  const channelBtn = (on: boolean, disabled: boolean, onClick: () => void, icon: ReactElement, label: string) => (
    <button
      type="button"
      disabled={disabled || !canManage}
      onClick={onClick}
      title={disabled ? `No ${label} number on this user's profile` : label}
      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        on && !disabled ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Reaction · Loss Control"
        title="Duty roster"
        subtitle="Tick who is on duty for each depot. They are paged for every alert there (SMS / WhatsApp / e-mail with the alert number), hear the siren on the web, and can acknowledge on the web, WhatsApp or USSD."
        actions={
          canManage ? (
            <Button variant="primary" icon={<Save className="h-3.5 w-3.5" />} busy={saving} disabled={!changed.length} onClick={() => void save()}>
              {changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Saved"}
            </Button>
          ) : null
        }
      >
        <HeroStats cols={4}>
          <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Depots covered" value={`${coveredDepots}/${totalDepots || "—"}`} tone={coveredDepots < totalDepots ? "warn" : "good"} sub="with someone on duty" />
          <HeroStat icon={<UserCheck className="h-3.5 w-3.5" />} label="On duty here" value={roster ? onNow : "—"} sub={scopeLabel || "choose an area"} />
          <HeroStat icon={<Users className="h-3.5 w-3.5" />} label="Staff in this area" value={roster?.people.length ?? "—"} sub="ZESA group users" />
          <HeroStat icon={<BellRing className="h-3.5 w-3.5" />} label="Paging" value="SMS · WhatsApp" sub="+ siren on the web" />
        </HeroStats>
      </PageHero>

      {error ? <Notice onClose={() => setError(null)}>{error}</Notice> : null}
      {notice ? (
        <Notice tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Notice>
      ) : null}

      <Panel
        toolbar={
          <div className="flex w-full flex-wrap items-center gap-2">
            {!isDepot ? (
              <SelectBox label="Region" value={regionId} onChange={(v) => { setRegionId(v); setDepotId(""); }}>
                <option value="">Choose…</option>
                {geo.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </SelectBox>
            ) : null}
            {!isDepot ? (
              <SelectBox label="Depot" value={depotId} onChange={setDepotId}>
                <option value="">{regionId ? `All depots in region (${regionDepots.length})` : "Choose…"}</option>
                {(regionId ? regionDepots : geo.depots).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {coverage[String(d.id)] ? ` · ${coverage[String(d.id)]} on duty` : " · nobody on duty"}
                  </option>
                ))}
              </SelectBox>
            ) : (
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{geo.pathOf(myDepot ?? 0).depotName} depot</span>
            )}
            <SearchBox value={q} onChange={setQ} placeholder="Name, role, depot…" className="max-w-xs" />
            <label className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <input type="checkbox" checked={onlyAck} onChange={(e) => setOnlyAck(e.target.checked)} className="accent-blue-600" />
              Only people who can acknowledge
            </label>
          </div>
        }
      >
        {!depotIds.length ? (
          <p className="px-4 py-12 text-center text-sm text-slate-500">Choose a region (all its depots) or a single depot to set its duty roster.</p>
        ) : (
          <div className={tableCls.wrap}>
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>On duty</th>
                  <th className={tableCls.th}>Person</th>
                  <th className={tableCls.th}>Works at</th>
                  <th className={tableCls.th}>Paged by</th>
                  <th className={tableCls.th}>Shift / note</th>
                </tr>
              </thead>
              <tbody className={tableCls.tbody}>
                {loading && !roster ? (
                  <SkeletonRows rows={6} cols={5} />
                ) : people.length === 0 ? (
                  <EmptyRow cols={5}>No ZESA group users found for this area. Give users a region and depot under Users first.</EmptyRow>
                ) : (
                  people.map((p) => {
                    const d = drafts[p.id] ?? { onDuty: false, notifySms: true, notifyWhatsapp: true, notifyEmail: false, shiftNote: "" };
                    const partial = p.onDuty === "SOME" && !changed.includes(p.id);
                    return (
                      <tr key={p.id} className={`${tableCls.tr} ${d.onDuty ? "bg-emerald-50/50 dark:bg-emerald-500/5" : ""}`}>
                        <td className={tableCls.td} data-label="On duty">
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() => set(p.id, { onDuty: !d.onDuty })}
                            aria-pressed={d.onDuty}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:cursor-not-allowed ${d.onDuty ? "bg-emerald-500" : partial ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-700"}`}
                          >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${d.onDuty ? "translate-x-5" : "translate-x-0.5"}`} />
                          </button>
                          {partial ? <p className="mt-1 text-[10px] text-amber-600">On duty for {p.onDutyDepots.length} of {depotIds.length}</p> : null}
                        </td>
                        <td className={tableCls.td} data-label="Person">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {p.name || p.email}
                            {p.stale ? <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500">not in area any more</span> : null}
                          </p>
                          <p className="text-[11px] text-slate-500">{(p.roles ?? []).join(", ") || p.email}</p>
                          {p.canAcknowledge === false ? <p className="text-[10px] text-amber-600">Cannot acknowledge alerts (role has no response.acknowledge)</p> : null}
                        </td>
                        <td className={tableCls.td} data-label="Works at">
                          {p.depot ? p.depot : p.region ? `${p.region} region` : "National"}
                        </td>
                        <td className={tableCls.td} data-label="Paged by">
                          <div className="flex flex-wrap gap-1">
                            {channelBtn(d.notifySms, !p.phone, () => set(p.id, { notifySms: !d.notifySms }), <Phone className="h-3 w-3" />, "SMS")}
                            {channelBtn(d.notifyWhatsapp, !p.whatsappNumber, () => set(p.id, { notifyWhatsapp: !d.notifyWhatsapp }), <MessageCircle className="h-3 w-3" />, "WhatsApp")}
                            {channelBtn(d.notifyEmail, !p.email, () => set(p.id, { notifyEmail: !d.notifyEmail }), <Mail className="h-3 w-3" />, "E-mail")}
                          </div>
                          <p className="mt-1 text-[10px] text-slate-400">{[p.phone, p.whatsappNumber && p.whatsappNumber !== p.phone ? p.whatsappNumber : null].filter(Boolean).join(" · ") || "No phone on profile"}</p>
                        </td>
                        <td className={tableCls.td} data-label="Shift / note">
                          <input
                            disabled={!canManage}
                            value={d.shiftNote}
                            onChange={(e) => set(p.id, { shiftNote: e.target.value })}
                            placeholder="e.g. Night shift 18:00–06:00"
                            className="h-8 w-full min-w-[160px] rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900"
                          />
                          {p.updatedBy ? <p className="mt-0.5 text-[10px] text-slate-400">by {p.updatedBy.split("@")[0]}</p> : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {loading && roster ? (
          <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500 dark:border-slate-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Refreshing…
          </div>
        ) : null}
      </Panel>

      <AckGuide />
    </div>
  );
}
