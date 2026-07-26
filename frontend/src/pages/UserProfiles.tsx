import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BellRing, Mail, MessageSquareText, Phone, ShieldCheck, UserRound } from "lucide-react";
import Checkbox from "../components/form/input/Checkbox";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import { AdminShell, DataCard } from "./UserManagement/AdminShared";

type NotificationPreference = {
  notificationType: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  allChannelsEnabled: boolean;
  muted: boolean;
  supplierCode?: string | null;
};

export default function UserProfiles() {
  const { user, token } = useAuth();
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Profile";
  const roles = user?.roles?.length ? user.roles : ["Standard access"];
  const primaryRole = roles[0];
  const accountStatus = user?.status || "ACTIVE";
  const accessScope = /admin/i.test(primaryRole) ? "Enterprise" : user?.userType || "Standard";
  const contactMode = user?.whatsappNumber ? "Email, phone and WhatsApp" : user?.phone ? "Email and phone" : "Email only";
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preferenceNotice, setPreferenceNotice] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const profileHighlights = [
    {
      label: "Username",
      value: user?.username || "Not available",
      icon: <UserRound className="h-4 w-4" />,
    },
    {
      label: "Email",
      value: user?.email || "Not available",
      icon: <Mail className="h-4 w-4" />,
    },
    {
      label: "Phone",
      value: user?.phone || "Not provided",
      icon: <Phone className="h-4 w-4" />,
    },
    {
      label: "WhatsApp",
      value: user?.whatsappNumber || "Not provided",
      icon: <MessageSquareText className="h-4 w-4" />,
    },
    {
      label: "Primary role",
      value: primaryRole,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];
  const orderedPreferences = useMemo(
    () =>
      [...preferences].sort((a, b) =>
        a.notificationType.replaceAll("_", " ").localeCompare(b.notificationType.replaceAll("_", " "))
      ),
    [preferences]
  );

  useEffect(() => {
    if (!token) return;
    const fetchPreferences = async () => {
      try {
        setLoadingPreferences(true);
        setPreferenceError(null);
        const response = await axios.get<NotificationPreference[]>(`${API_BASE_URL}/api/v1/auth/me/notification-preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPreferences(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error(error);
        setPreferenceError("Notification preferences could not be loaded.");
      } finally {
        setLoadingPreferences(false);
      }
    };
    void fetchPreferences();
  }, [API_BASE_URL, token]);

  const updatePreference = (notificationType: string, changes: Partial<NotificationPreference>) => {
    setPreferences((current) =>
      current.map((item) => {
        if (item.notificationType !== notificationType) return item;
        const next = { ...item, ...changes };
        if (changes.allChannelsEnabled === true) {
          next.emailEnabled = true;
          next.smsEnabled = true;
          next.whatsappEnabled = true;
        }
        if (
          changes.allChannelsEnabled === false &&
          item.allChannelsEnabled &&
          changes.emailEnabled === undefined &&
          changes.smsEnabled === undefined &&
          changes.whatsappEnabled === undefined
        ) {
          next.emailEnabled = item.emailEnabled;
          next.smsEnabled = item.smsEnabled;
          next.whatsappEnabled = item.whatsappEnabled;
        }
        next.allChannelsEnabled = next.emailEnabled && next.smsEnabled && next.whatsappEnabled && !next.muted;
        if (changes.muted === true) {
          next.allChannelsEnabled = false;
        }
        return next;
      })
    );
  };

  const savePreferences = async () => {
    try {
      setSavingPreferences(true);
      setPreferenceNotice(null);
      setPreferenceError(null);
      await axios.put(
        `${API_BASE_URL}/api/v1/auth/me/notification-preferences`,
        { preferences },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPreferenceNotice("Notification preferences saved.");
    } catch (error) {
      console.error(error);
      setPreferenceError("Notification preferences could not be saved.");
    } finally {
      setSavingPreferences(false);
    }
  };

  return (
    <>
      <PageMeta
        title="User Profile | Transformer Monitoring System"
        description="Enterprise profile workspace for reviewing account details, access roles, and contact information."
      />
      <AdminShell
        title="User Profile"
        description="Manage your account identity, review contact details, and keep access information aligned with the enterprise administration workspace."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Account Status", value: accountStatus, tone: "green" },
            { label: "Primary Role", value: primaryRole, tone: "blue" },
            { label: "Role Assignments", value: roles.length, tone: "purple" },
            { label: "Contact Mode", value: contactMode, tone: "amber" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border border-slate-200/80 px-4 py-3 shadow-sm dark:border-gray-800 ${
                stat.tone === "green"
                  ? "bg-emerald-50/70 dark:bg-emerald-500/5"
                  : stat.tone === "blue"
                    ? "bg-blue-50/70 dark:bg-blue-500/5"
                    : stat.tone === "purple"
                      ? "bg-violet-50/70 dark:bg-violet-500/5"
                      : "bg-amber-50/70 dark:bg-amber-500/5"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                {stat.label}
              </p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_320px]">
          <div className="space-y-4">
            <DataCard>
              <div className="p-4 lg:p-5">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-700 dark:bg-white/5 dark:text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                          Profile Overview
                        </p>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                          {displayName}
                        </h2>
                      </div>
                      <p className="text-sm leading-5 text-slate-500 dark:text-gray-400">
                        Access scope: {accessScope}. Keep personal details current so notifications, approvals, and audit trails remain accurate.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {profileHighlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-gray-800 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                          {item.icon}
                        </span>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{item.label}</p>
                      </div>
                      <p className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </DataCard>

            <UserInfoCard />

            <DataCard>
              <div className="p-4 lg:p-5">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                      <BellRing className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                        Notification Matrix
                      </p>
                      <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                        Channel preferences by event type
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                        Control SMS, email, and WhatsApp delivery for each event type. The WhatsApp bridge uses your saved number.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={savePreferences}
                    disabled={savingPreferences || loadingPreferences || preferences.length === 0}
                    className="inline-flex items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingPreferences ? "Saving..." : "Save Preferences"}
                  </button>
                </div>

                {preferenceError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                    {preferenceError}
                  </div>
                ) : null}
                {preferenceNotice ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                    {preferenceNotice}
                  </div>
                ) : null}

                <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200 dark:border-gray-800">
                  <div className="grid grid-cols-[minmax(0,1.8fr)_repeat(5,minmax(84px,1fr))] gap-px bg-slate-200 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                    {["Event Type", "Email", "SMS", "WhatsApp", "All", "Mute"].map((heading) => (
                      <div key={heading} className="bg-slate-50 px-4 py-3 dark:bg-slate-950">
                        {heading}
                      </div>
                    ))}
                  </div>
                  {loadingPreferences ? (
                    <div className="bg-white px-4 py-8 text-sm text-slate-500 dark:bg-slate-900 dark:text-gray-400">
                      Loading notification preferences...
                    </div>
                  ) : orderedPreferences.length === 0 ? (
                    <div className="bg-white px-4 py-8 text-sm text-slate-500 dark:bg-slate-900 dark:text-gray-400">
                      No notification preferences are available for this account yet.
                    </div>
                  ) : (
                    orderedPreferences.map((item) => (
                      <div
                        key={item.notificationType}
                        className="grid grid-cols-[minmax(0,1.8fr)_repeat(5,minmax(84px,1fr))] gap-px border-t border-slate-200 bg-slate-200 dark:border-gray-800 dark:bg-gray-800"
                      >
                        <div className="bg-white px-4 py-3 dark:bg-slate-900">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.notificationType.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                            {item.supplierCode ? `Supplier scope: ${item.supplierCode}` : "Global routing"}
                          </p>
                        </div>
                        <PreferenceCell>
                          <Checkbox
                            checked={item.emailEnabled}
                            onChange={(checked) => updatePreference(item.notificationType, { emailEnabled: checked, muted: false })}
                          />
                        </PreferenceCell>
                        <PreferenceCell>
                          <Checkbox
                            checked={item.smsEnabled}
                            onChange={(checked) => updatePreference(item.notificationType, { smsEnabled: checked, muted: false })}
                          />
                        </PreferenceCell>
                        <PreferenceCell>
                          <Checkbox
                            checked={item.whatsappEnabled}
                            onChange={(checked) => updatePreference(item.notificationType, { whatsappEnabled: checked, muted: false })}
                            disabled={!user?.whatsappNumber}
                          />
                        </PreferenceCell>
                        <PreferenceCell>
                          <Checkbox
                            checked={item.allChannelsEnabled}
                            onChange={(checked) => updatePreference(item.notificationType, { allChannelsEnabled: checked, muted: false })}
                            disabled={!user?.whatsappNumber}
                          />
                        </PreferenceCell>
                        <PreferenceCell>
                          <Checkbox
                            checked={item.muted}
                            onChange={(checked) =>
                              updatePreference(item.notificationType, {
                                muted: checked,
                                allChannelsEnabled: checked ? false : item.allChannelsEnabled,
                              })
                            }
                          />
                        </PreferenceCell>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </DataCard>
          </div>

          <div className="space-y-4">
            <DataCard>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                      Access Summary
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                      Account at a glance
                    </h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {accountStatus}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                      User Type
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.userType || "Standard user"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                      Employee Number
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.employeeNumber || "Not assigned"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                      Supplier
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.supplierName || user?.supplierCode || "Internal account"}
                    </p>
                  </div>
                </div>
              </div>
            </DataCard>

            <UserMetaCard />
          </div>
        </div>
      </AdminShell>
    </>
  );
}

function PreferenceCell({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center bg-white px-3 py-3 dark:bg-slate-900">{children}</div>;
}
