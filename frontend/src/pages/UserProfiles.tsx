import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import axios from "axios";
import {
  BellOff,
  BellRing,
  Building2,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";

type NotificationPreference = {
  notificationType: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  allChannelsEnabled: boolean;
  muted: boolean;
  supplierCode?: string | null;
};

type Channel = "emailEnabled" | "smsEnabled" | "whatsappEnabled";

/** Plain-language meaning of each event, grouped so related ones sit together. */
const EVENTS: Record<string, { label: string; hint: string; group: "Security" | "Control" | "Health" | "System" }> = {
  CRITICAL_ALERT: { label: "Critical alert", hint: "Sensor intrusion: door, tilt or temperature", group: "Security" },
  CONTROLLER_TRIGGER: { label: "Intrusion trigger", hint: "Motion, door or vibration on a controller", group: "Security" },
  ARM_SUCCESS: { label: "Armed", hint: "A site was armed successfully", group: "Control" },
  DISARM_SUCCESS: { label: "Disarmed", hint: "A site was disarmed", group: "Control" },
  ARM_FAILED: { label: "Arm failed", hint: "An arm command did not go through", group: "Control" },
  DISARM_FAILED: { label: "Disarm failed", hint: "A disarm command did not go through", group: "Control" },
  CONTROLLER_OFFLINE: { label: "Controller offline", hint: "A site controller stopped reporting", group: "Health" },
  KEEPALIVE_MISSED: { label: "Keep-alive missed", hint: "A device missed its heartbeat", group: "Health" },
  SYSTEM_NOTICE: { label: "System notices", hint: "Dispatch links, account and platform messages", group: "System" },
};
const GROUP_ORDER = ["Security", "Control", "Health", "System"] as const;

const errText = (e: unknown, fallback: string) => {
  const d = (e as { response?: { data?: { message?: string } | string } })?.response?.data;
  return typeof d === "string" && d ? d : (d as { message?: string })?.message || fallback;
};

export default function UserProfiles() {
  const { user, token, updateUser, permissions } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "My profile";
  const initials = displayName
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roles = user?.roles?.length ? user.roles : [];
  const isAdmin = roles.some((r) => /admin/i.test(String(r)));
  const scope = user?.supplierName
    ? `Partner · ${user.supplierName}`
    : user?.depotId
      ? `Depot ${user.depotId}`
      : "National";

  // ---- personal details
  const [fullUser, setFullUser] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", whatsapp: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || "",
      phone: user.phone || "",
      whatsapp: user.whatsappNumber || "",
    });
  }, [user]);

  const startEdit = async () => {
    setEditing(true);
    setProfileMsg(null);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/auth/users`, { headers });
      const data = res.data as unknown;
      const list = (Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || []) as Array<{ id?: number }>;
      const me = list.find((u) => u.id === user?.id);
      if (me) setFullUser(me as Record<string, unknown>);
    } catch {
      /* fall back to what we have */
    }
  };

  const saveProfile = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setProfileMsg({ ok: false, text: "First name, last name and email are required." });
      return;
    }
    try {
      setSavingProfile(true);
      const f = (fullUser || {}) as Record<string, unknown>;
      await axios.put(
        `${API_BASE_URL}/api/v1/auth/update/id/${user?.id}`,
        {
          ...f,
          firstname: form.firstName.trim(),
          lastname: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          whatsappNumber: form.whatsapp.trim(),
          employeeNumber: (f.employeeNumber as string) || "",
          role: (f.role as string) || "",
          region: (f.region as string) || "",
          district: (f.district as string) || "",
          depot: (f.depot as string) || "",
        },
        { headers }
      );
      updateUser({
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        whatsappNumber: form.whatsapp.trim(),
      });
      setEditing(false);
      setProfileMsg({ ok: true, text: "Profile saved." });
    } catch (e) {
      setProfileMsg({ ok: false, text: errText(e, "Could not save your profile.") });
    } finally {
      setSavingProfile(false);
    }
  };

  // ---- password
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwOpen, setPwOpen] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const strength = pw.next.length >= 12 && /[A-Z]/.test(pw.next) && /\d/.test(pw.next) && /[^A-Za-z0-9]/.test(pw.next) ? 3 : pw.next.length >= 8 ? 2 : pw.next ? 1 : 0;

  const changePassword = async () => {
    if (!pw.current || !pw.next) return setPwMsg({ ok: false, text: "Fill in all password fields." });
    if (pw.next !== pw.confirm) return setPwMsg({ ok: false, text: "The new passwords do not match." });
    try {
      setPwBusy(true);
      await axios.post(
        `${API_BASE_URL}/api/v1/auth/change-password`,
        { currentPassword: pw.current, newPassword: pw.next },
        { headers }
      );
      setPw({ current: "", next: "", confirm: "" });
      setPwOpen(false);
      setPwMsg({ ok: true, text: "Password changed." });
    } catch (e) {
      setPwMsg({ ok: false, text: errText(e, "Could not change the password.") });
    } finally {
      setPwBusy(false);
    }
  };

  // ---- notification preferences
  const [prefs, setPrefs] = useState<NotificationPreference[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsDirty, setPrefsDirty] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setPrefsLoading(true);
      try {
        const r = await axios.get(`${API_BASE_URL}/api/v1/auth/me/notification-preferences`, { headers });
        const data = r.data as unknown;
        setPrefs(Array.isArray(data) ? (data as NotificationPreference[]) : []);
      } catch {
        setPrefsMsg({ ok: false, text: "Notification preferences could not be loaded." });
      } finally {
        setPrefsLoading(false);
      }
    })();
  }, [API_BASE_URL, headers, token]);

  const grouped = useMemo(() => {
    const byGroup = new Map<string, NotificationPreference[]>();
    prefs.forEach((p) => {
      const g = EVENTS[p.notificationType]?.group || "System";
      byGroup.set(g, [...(byGroup.get(g) || []), p]);
    });
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => [g, byGroup.get(g)!] as const);
  }, [prefs]);

  const setPref = (type: string, change: Partial<NotificationPreference>) => {
    setPrefsDirty(true);
    setPrefsMsg(null);
    setPrefs((cur) =>
      cur.map((p) => {
        if (p.notificationType !== type) return p;
        const n = { ...p, ...change };
        if (change.muted === true) {
          n.emailEnabled = false;
          n.smsEnabled = false;
          n.whatsappEnabled = false;
        }
        if (change.emailEnabled || change.smsEnabled || change.whatsappEnabled) n.muted = false;
        n.allChannelsEnabled = n.emailEnabled && n.smsEnabled && n.whatsappEnabled && !n.muted;
        return n;
      })
    );
  };

  const setColumn = (channel: Channel, on: boolean) => prefs.forEach((p) => setPref(p.notificationType, { [channel]: on } as Partial<NotificationPreference>));

  const savePrefs = async () => {
    try {
      setPrefsSaving(true);
      await axios.put(`${API_BASE_URL}/api/v1/auth/me/notification-preferences`, { preferences: prefs }, { headers });
      setPrefsDirty(false);
      setPrefsMsg({ ok: true, text: "Notification preferences saved." });
    } catch (e) {
      setPrefsMsg({ ok: false, text: errText(e, "Could not save preferences.") });
    } finally {
      setPrefsSaving(false);
    }
  };

  const activeChannels = new Set<string>();
  prefs.forEach((p) => {
    if (p.emailEnabled) activeChannels.add("Email");
    if (p.smsEnabled) activeChannels.add("SMS");
    if (p.whatsappEnabled) activeChannels.add("WhatsApp");
  });

  return (
    <>
      <PageMeta title="My profile | Transformer Monitoring System" description="Your account, security and alert delivery preferences." />
      <div className="space-y-4">
        {/* Identity banner */}
        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] p-6 text-white">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-gradient-to-br from-sky-400 to-indigo-600 text-2xl font-bold shadow-[0_18px_40px_-12px_rgba(56,189,248,0.6)] ring-4 ring-white/15">
                  {initials || "?"}
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 ring-4 ring-[#0a2a6b]" title={user?.status || "Active"}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">{isAdmin ? "Super administrator" : "My profile"}</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">{displayName}</h1>
                <p className="mt-0.5 text-sm text-blue-100/80">{user?.email}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                  <Chip>{user?.userType || "ZESA"}</Chip>
                  <Chip>
                    <Building2 className="h-3 w-3" /> {scope}
                  </Chip>
                  {roles.map((r) => (
                    <Chip key={r} strong>
                      <ShieldCheck className="h-3 w-3" /> {r}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:w-[420px]">
              <Stat label="Roles" value={roles.length || "—"} />
              <Stat label="Permissions" value={isAdmin ? "All" : permissions.length} />
              <Stat label="Alert channels" value={activeChannels.size ? [...activeChannels].join(" · ") : "None"} small />
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Personal details */}
          <Card
            icon={<Pencil className="h-4 w-4" />}
            title="Personal details"
            subtitle="Used for alert delivery and the audit trail."
            action={
              editing ? (
                <div className="flex gap-2">
                  <GhostBtn onClick={() => setEditing(false)}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </GhostBtn>
                  <PrimaryBtn onClick={() => void saveProfile()} busy={savingProfile}>
                    <Save className="h-3.5 w-3.5" /> Save
                  </PrimaryBtn>
                </div>
              ) : (
                <GhostBtn onClick={() => void startEdit()}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </GhostBtn>
              )
            }
          >
            {profileMsg ? <Msg m={profileMsg} /> : null}
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <Field label="First name" editing={editing} value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
              <Field label="Last name" editing={editing} value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
              <Field label="Email" icon={<Mail className="h-3.5 w-3.5" />} editing={editing} value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Phone (SMS)" icon={<Phone className="h-3.5 w-3.5" />} editing={editing} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="0772 000 000" />
              <Field
                label="WhatsApp"
                icon={<MessageCircle className="h-3.5 w-3.5" />}
                editing={editing}
                value={form.whatsapp}
                onChange={(v) => setForm({ ...form, whatsapp: v })}
                placeholder="+263 77 000 0000"
                hint="Used for WhatsApp alerts and arm/disarm chat commands."
              />
              <Field label="Employee number" editing={false} value={String((fullUser?.employeeNumber as string) || user?.employeeNumber || "")} onChange={() => undefined} />
            </div>
          </Card>

          {/* Security & access */}
          <div className="space-y-4">
            <Card
              icon={<KeyRound className="h-4 w-4" />}
              title="Password"
              subtitle="Use at least 12 characters with a number and a symbol."
              action={
                pwOpen ? null : (
                  <GhostBtn onClick={() => { setPwOpen(true); setPwMsg(null); }}>
                    <KeyRound className="h-3.5 w-3.5" /> Change
                  </GhostBtn>
                )
              }
            >
              {pwMsg ? <Msg m={pwMsg} /> : null}
              {pwOpen ? (
                <div className="space-y-3">
                  <Input type="password" placeholder="Current password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} />
                  <Input type="password" placeholder="New password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} />
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${strength >= i ? (strength === 3 ? "bg-emerald-500" : strength === 2 ? "bg-amber-500" : "bg-red-500") : "bg-slate-200 dark:bg-slate-700"}`} />
                    ))}
                  </div>
                  <Input type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} />
                  <div className="flex justify-end gap-2">
                    <GhostBtn onClick={() => setPwOpen(false)}>Cancel</GhostBtn>
                    <PrimaryBtn onClick={() => void changePassword()} busy={pwBusy}>
                      Update password
                    </PrimaryBtn>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">••••••••••••</p>
              )}
            </Card>

            <Card icon={<ShieldCheck className="h-4 w-4" />} title="Access" subtitle={isAdmin ? "Administrators can see and do everything." : "What your roles allow."}>
              <AccessSummary permissions={permissions} isAdmin={isAdmin} />
            </Card>
          </div>
        </div>

        {/* Notification matrix: full width */}
        <section className="enterprise-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 md:flex-row md:items-center md:justify-between dark:border-slate-800">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <BellRing className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">How you receive alerts</h2>
                <p className="text-xs text-slate-500">Pick the channels per event. WhatsApp uses the number above. Mute stops an event completely.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {prefsDirty ? <span className="text-xs font-medium text-amber-600">Unsaved changes</span> : null}
              <PrimaryBtn onClick={() => void savePrefs()} busy={prefsSaving} disabled={!prefsDirty}>
                <Save className="h-3.5 w-3.5" /> Save preferences
              </PrimaryBtn>
            </div>
          </div>
          {prefsMsg ? (
            <div className="px-5 pt-3">
              <Msg m={prefsMsg} />
            </div>
          ) : null}
          {prefsLoading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading preferences…
            </div>
          ) : (
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[40%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 text-[11px] uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900/60">
                  <th className="px-5 py-3 text-left font-semibold">Event</th>
                  <ColHead icon={<Mail className="h-3.5 w-3.5" />} label="Email" onAll={(on) => setColumn("emailEnabled", on)} />
                  <ColHead icon={<Smartphone className="h-3.5 w-3.5" />} label="SMS" onAll={(on) => setColumn("smsEnabled", on)} />
                  <ColHead icon={<MessageCircle className="h-3.5 w-3.5" />} label="WhatsApp" onAll={(on) => setColumn("whatsappEnabled", on)} />
                  <th className="px-3 py-3 text-center font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <BellOff className="h-3.5 w-3.5" /> Mute
                    </span>
                  </th>
                </tr>
              </thead>
              {grouped.map(([group, items]) => (
                <tbody key={group} className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td colSpan={5} className="bg-white px-5 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:bg-transparent">
                      {group}
                    </td>
                  </tr>
                  {items.map((p) => {
                    const meta = EVENTS[p.notificationType] || { label: p.notificationType.replace(/_/g, " ").toLowerCase(), hint: "" };
                    return (
                      <tr key={p.notificationType} className={`transition hover:bg-blue-50/40 dark:hover:bg-slate-900 ${p.muted ? "opacity-60" : ""}`}>
                        <td className="px-5 py-3">
                          <p className="font-medium capitalize text-slate-900 dark:text-slate-100">{meta.label}</p>
                          {meta.hint ? <p className="text-[11px] text-slate-500">{meta.hint}</p> : null}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Toggle on={p.emailEnabled} onChange={(v) => setPref(p.notificationType, { emailEnabled: v })} label={`Email for ${meta.label}`} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Toggle on={p.smsEnabled} onChange={(v) => setPref(p.notificationType, { smsEnabled: v })} label={`SMS for ${meta.label}`} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Toggle on={p.whatsappEnabled} onChange={(v) => setPref(p.notificationType, { whatsappEnabled: v })} label={`WhatsApp for ${meta.label}`} tone="emerald" />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Toggle on={p.muted} onChange={(v) => setPref(p.notificationType, { muted: v })} label={`Mute ${meta.label}`} tone="slate" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          )}
        </section>
      </div>
    </>
  );
}

function AccessSummary({ permissions, isAdmin }: { permissions: string[]; isAdmin: boolean }) {
  const modules = useMemo(() => {
    const m = new Map<string, number>();
    permissions.forEach((p) => {
      const mod = String(p).split(".")[0];
      m.set(mod, (m.get(mod) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [permissions]);
  if (isAdmin) {
    return <p className="text-sm text-slate-600 dark:text-slate-300">Full access to every module, depot and partner.</p>;
  }
  if (modules.length === 0) return <p className="text-sm text-slate-500">No permissions assigned yet. Ask an administrator.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {modules.map(([mod, n]) => (
        <span key={mod} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {mod}
          <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-blue-700 dark:bg-slate-900 dark:text-blue-300">{n}</span>
        </span>
      ))}
    </div>
  );
}

function Card({ icon, title, subtitle, action, children }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="enterprise-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">{icon}</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  editing,
  icon,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
  icon?: ReactNode;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {icon}
        {label}
      </p>
      {editing ? (
        <Input value={value} onChange={onChange} placeholder={placeholder} />
      ) : (
        <p className={`text-sm font-medium ${value ? "text-slate-900 dark:text-slate-100" : "text-slate-400"}`}>{value || "Not set"}</p>
      )}
      {hint && editing ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    />
  );
}

function Toggle({ on, onChange, label, tone = "blue" }: { on: boolean; onChange: (v: boolean) => void; label: string; tone?: "blue" | "emerald" | "slate" }) {
  const bg = on ? (tone === "emerald" ? "bg-emerald-500" : tone === "slate" ? "bg-slate-600" : "bg-blue-600") : "bg-slate-200 dark:bg-slate-700";
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${bg}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

function ColHead({ icon, label, onAll }: { icon: ReactNode; label: string; onAll: (on: boolean) => void }) {
  return (
    <th className="px-3 py-3 text-center font-semibold">
      <span className="inline-flex items-center gap-1">
        {icon} {label}
      </span>
      <div className="mt-1 flex justify-center gap-1 text-[10px] font-medium normal-case tracking-normal">
        <button type="button" onClick={() => onAll(true)} className="text-blue-600 hover:underline">
          all
        </button>
        <span className="text-slate-300">·</span>
        <button type="button" onClick={() => onAll(false)} className="text-slate-500 hover:underline">
          none
        </button>
      </div>
    </th>
  );
}

function Chip({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${strong ? "bg-white text-slate-900" : "bg-white/10 ring-1 ring-white/15"}`}>{children}</span>;
}

function Stat({ label, value, small }: { label: string; value: ReactNode; small?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
      <p className="text-[11px] text-blue-100/75">{label}</p>
      <p className={`mt-1 font-semibold ${small ? "text-xs leading-snug" : "text-xl"}`}>{value}</p>
    </div>
  );
}

function Msg({ m }: { m: { ok: boolean; text: string } }) {
  return (
    <div className={`mb-3 rounded-xl px-3 py-2 text-xs ${m.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300"}`}>
      {m.text}
    </div>
  );
}

function PrimaryBtn({ children, onClick, busy, disabled }: { children: ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-200">
      {children}
    </button>
  );
}
