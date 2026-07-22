import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BellRing,
  Building2,
  Mail,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Save,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { Modal } from "../components/ui/modal";
import Checkbox from "../components/form/input/Checkbox";
import Alert from "../components/ui/alert/Alert";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import { AdminShell, DataCard } from "./UserManagement/AdminShared";

type NotificationType =
  | "CRITICAL_ALERT"
  | "CONTROLLER_TRIGGER"
  | "CONTROLLER_OFFLINE"
  | "ARM_SUCCESS"
  | "DISARM_SUCCESS"
  | "ARM_FAILED"
  | "DISARM_FAILED"
  | "KEEPALIVE_MISSED"
  | "SYSTEM_NOTICE";

type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";

type NotificationPreference = {
  notificationType: NotificationType;
  emailEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  allChannelsEnabled: boolean;
  muted: boolean;
  supplierCode?: string | null;
};

type SupplierScope = {
  id: number;
  code: string;
  name: string;
  status: string;
};

type DirectoryEntry = {
  id: number;
  supplierCode: string;
  supplierName: string;
  displayName: string;
  channel: NotificationChannel;
  destination: string;
  enabled: boolean;
  allNotificationTypes: boolean;
  notificationTypes: NotificationType[];
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type WorkspaceResponse = {
  canManageAllSuppliers: boolean;
  activeSupplierCode: string;
  activeSupplierName: string;
  suppliers: SupplierScope[];
  entries: DirectoryEntry[];
  availableNotificationTypes: NotificationType[];
  availableChannels: NotificationChannel[];
};

type DirectoryFormState = {
  id?: number;
  supplierCode: string;
  displayName: string;
  channel: NotificationChannel;
  destination: string;
  enabled: boolean;
  allNotificationTypes: boolean;
  notificationTypes: NotificationType[];
  notes: string;
};

const defaultFormState: DirectoryFormState = {
  supplierCode: "",
  displayName: "",
  channel: "WHATSAPP",
  destination: "",
  enabled: true,
  allNotificationTypes: true,
  notificationTypes: [],
  notes: "",
};

const channelMeta: Record<NotificationChannel, { label: string; icon: React.ReactNode; tone: string }> = {
  EMAIL: {
    label: "Email",
    icon: <Mail className="h-4 w-4" />,
    tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  },
  SMS: {
    label: "SMS",
    icon: <Smartphone className="h-4 w-4" />,
    tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  },
  WHATSAPP: {
    label: "WhatsApp",
    icon: <MessageSquareText className="h-4 w-4" />,
    tone: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
};

const prettyType = (value: string) => value.replaceAll("_", " ");

export default function NotificationCenter() {
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const { token, user } = useAuth();
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [formState, setFormState] = useState<DirectoryFormState>(defaultFormState);
  const [notice, setNotice] = useState<{ variant: "success" | "error" | "info" | "warning"; title: string; message: string } | null>(null);

  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : undefined), [token]);

  const activeSupplierCode = selectedSupplier || workspace?.activeSupplierCode || user?.supplierCode || "";
  const activeSupplier = useMemo(
    () => workspace?.suppliers.find((supplier) => supplier.code === activeSupplierCode) ?? null,
    [activeSupplierCode, workspace?.suppliers]
  );

  const setFlash = (variant: "success" | "error" | "info" | "warning", title: string, message: string) => {
    setNotice({ variant, title, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const fetchWorkspace = async (supplierCode?: string) => {
    try {
      setLoadingWorkspace(true);
      const response = await axios.get<WorkspaceResponse>(`${API_BASE_URL}/api/v1/auth/notification-directory`, {
        headers,
        params: supplierCode ? { supplierCode } : undefined,
      });
      const nextWorkspace = response.data;
      setWorkspace(nextWorkspace);
      setSelectedSupplier(nextWorkspace.activeSupplierCode);
    } catch (error) {
      console.error(error);
      setFlash("error", "Directory load failed", "Notification directory settings could not be loaded.");
    } finally {
      setLoadingWorkspace(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      setLoadingPreferences(true);
      const response = await axios.get<NotificationPreference[]>(`${API_BASE_URL}/api/v1/auth/me/notification-preferences`, {
        headers,
      });
      setPreferences(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(error);
      setFlash("error", "Preference load failed", "Personal notification preferences could not be loaded.");
    } finally {
      setLoadingPreferences(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void Promise.all([fetchWorkspace(user?.supplierCode || undefined), fetchPreferences()]);
  }, [token]);

  const orderedPreferences = useMemo(
    () =>
      [...preferences].sort((a, b) => prettyType(a.notificationType).localeCompare(prettyType(b.notificationType))),
    [preferences]
  );

  const supplierEntries = useMemo(() => {
    const entries = workspace?.entries ?? [];
    return [...entries].sort((a, b) => {
      if (a.channel !== b.channel) return a.channel.localeCompare(b.channel);
      return a.displayName.localeCompare(b.displayName);
    });
  }, [workspace?.entries]);

  const totals = useMemo(() => {
    const entries = workspace?.entries ?? [];
    return {
      total: entries.length,
      whatsapp: entries.filter((entry) => entry.channel === "WHATSAPP").length,
      sms: entries.filter((entry) => entry.channel === "SMS").length,
      email: entries.filter((entry) => entry.channel === "EMAIL").length,
    };
  }, [workspace?.entries]);

  const updatePreference = (notificationType: NotificationType, changes: Partial<NotificationPreference>) => {
    setPreferences((current) =>
      current.map((item) => {
        if (item.notificationType !== notificationType) return item;
        const next = { ...item, ...changes };
        if (changes.allChannelsEnabled === true) {
          next.emailEnabled = true;
          next.smsEnabled = true;
          next.whatsappEnabled = true;
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
      await axios.put(
        `${API_BASE_URL}/api/v1/auth/me/notification-preferences`,
        { preferences },
        { headers }
      );
      setFlash("success", "Preferences saved", "Personal channel preferences were updated.");
    } catch (error) {
      console.error(error);
      setFlash("error", "Save failed", "Notification preferences could not be saved.");
    } finally {
      setSavingPreferences(false);
    }
  };

  const openCreate = () => {
    setFormState({
      ...defaultFormState,
      supplierCode: activeSupplierCode,
    });
    setShowEditor(true);
  };

  const openEdit = (entry: DirectoryEntry) => {
    setFormState({
      id: entry.id,
      supplierCode: entry.supplierCode,
      displayName: entry.displayName,
      channel: entry.channel,
      destination: entry.destination,
      enabled: entry.enabled,
      allNotificationTypes: entry.allNotificationTypes,
      notificationTypes: entry.notificationTypes || [],
      notes: entry.notes || "",
    });
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setFormState(defaultFormState);
  };

  const saveEntry = async () => {
    if (!formState.displayName.trim() || !formState.destination.trim()) {
      setFlash("warning", "Validation", "Display name and destination are required.");
      return;
    }
    if (!formState.allNotificationTypes && formState.notificationTypes.length === 0) {
      setFlash("warning", "Validation", "Select at least one notification type or enable all event types.");
      return;
    }

    try {
      setSavingEntry(true);
      const payload = {
        supplierCode: formState.supplierCode || activeSupplierCode,
        displayName: formState.displayName.trim(),
        channel: formState.channel,
        destination: formState.destination.trim(),
        enabled: formState.enabled,
        allNotificationTypes: formState.allNotificationTypes,
        notificationTypes: formState.notificationTypes,
        notes: formState.notes.trim(),
      };

      if (formState.id) {
        await axios.put(`${API_BASE_URL}/api/v1/auth/notification-directory/${formState.id}`, payload, { headers });
        setFlash("success", "Recipient updated", "The notification recipient was updated.");
      } else {
        await axios.post(`${API_BASE_URL}/api/v1/auth/notification-directory`, payload, { headers });
        setFlash("success", "Recipient added", "The notification recipient was added.");
      }
      closeEditor();
      await fetchWorkspace(activeSupplierCode);
    } catch (error) {
      console.error(error);
      setFlash("error", "Save failed", "The notification recipient could not be saved.");
    } finally {
      setSavingEntry(false);
    }
  };

  const deleteEntry = async (entryId: number) => {
    try {
      setDeletingEntryId(entryId);
      await axios.delete(`${API_BASE_URL}/api/v1/auth/notification-directory/${entryId}`, { headers });
      setFlash("success", "Recipient removed", "The notification recipient was removed.");
      await fetchWorkspace(activeSupplierCode);
    } catch (error) {
      console.error(error);
      setFlash("error", "Delete failed", "The notification recipient could not be removed.");
    } finally {
      setDeletingEntryId(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Notification Center | Transformer Monitoring System"
        description="Manage supplier-scoped notification recipients and personal channel preferences."
      />
      <AdminShell
        title="Notification Center"
        description="Configure how transformer alerts fan out across WhatsApp, SMS, and email. Admin can manage every supplier. Supplier teams can manage only their own alert recipients and delivery rules."
        actions={
          <>
            <button
              type="button"
              onClick={() => void fetchWorkspace(activeSupplierCode)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Recipient
            </button>
          </>
        }
        stats={[
          { label: "Active Supplier", value: activeSupplier?.name || workspace?.activeSupplierName || "Not selected", tone: "blue" },
          { label: "WhatsApp Targets", value: totals.whatsapp, tone: "green" },
          { label: "SMS Targets", value: totals.sms, tone: "amber" },
          { label: "Email Targets", value: totals.email, tone: "purple" },
        ]}
      >
        {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

        <DataCard>
          <div className="p-4 lg:p-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-gray-800 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                    Delivery Overview
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                    Top-level routing control
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    Start from the selected supplier and review the current delivery footprint before editing recipient sections below.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.03]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                    Supplier
                  </p>
                  <select
                    value={activeSupplierCode}
                    onChange={(event) => void fetchWorkspace(event.target.value)}
                    disabled={!workspace?.canManageAllSuppliers && Boolean(activeSupplierCode)}
                    className="mt-1 bg-transparent text-sm font-semibold text-slate-900 outline-none dark:text-white"
                  >
                    {(workspace?.suppliers ?? []).map((supplier) => (
                      <option key={supplier.code} value={supplier.code}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                    Scope
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                    {workspace?.canManageAllSuppliers ? "Admin cross-supplier control" : "Supplier-owned directory"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <InfoCard label="Supplier" value={activeSupplier?.name || workspace?.activeSupplierName || "Not selected"} />
              <InfoCard label="Recipient Entries" value={String(totals.total)} />
              <InfoCard label="My WhatsApp" value={user?.whatsappNumber || "Not configured"} />
              <InfoCard label="Directory Mode" value={workspace?.canManageAllSuppliers ? "Admin managed" : "Supplier managed"} />
              <InfoCard label="Live Coverage" value={`${totals.whatsapp + totals.sms + totals.email} total endpoints`} />
            </div>
          </div>
        </DataCard>

        <DataCard>
          <div className="p-4 lg:p-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                    Supplier Routing
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                    Channel recipient directory
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    Maintain the supplier numbers and emails that should receive live transformer notifications.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryBadge
                icon={<MessageSquareText className="h-4 w-4" />}
                label="WhatsApp Broadcast"
                value={`${totals.whatsapp} numbers`}
                tone="green"
              />
              <SummaryBadge
                icon={<Smartphone className="h-4 w-4" />}
                label="SMS Broadcast"
                value={`${totals.sms} numbers`}
                tone="amber"
              />
              <SummaryBadge
                icon={<Mail className="h-4 w-4" />}
                label="Email Broadcast"
                value={`${totals.email} mailboxes`}
                tone="blue"
              />
              <SummaryBadge
                icon={<BellRing className="h-4 w-4" />}
                label="Broadcast Registry"
                value={`${totals.total} recipient entries`}
                tone="violet"
              />
            </div>
          </div>
        </DataCard>

        <DataCard>
          <div className="p-4 lg:p-5">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                    Personal Matrix
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                    My own event preferences
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    Keep your personal delivery preferences aligned with the supplier directory.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={savePreferences}
                disabled={savingPreferences || loadingPreferences || orderedPreferences.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingPreferences ? "Saving..." : "Save My Preferences"}
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <div className="min-w-[920px] overflow-hidden rounded-3xl border border-slate-200 dark:border-gray-800">
                <div className="grid grid-cols-[minmax(220px,1.8fr)_repeat(5,minmax(84px,1fr))] gap-px bg-slate-200 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-gray-800 dark:text-gray-400">
                  {["Event Type", "Email", "SMS", "WhatsApp", "All", "Mute"].map((heading) => (
                    <div key={heading} className="bg-slate-50 px-4 py-3 dark:bg-slate-950">
                      {heading}
                    </div>
                  ))}
                </div>
                {loadingPreferences ? (
                  <div className="bg-white px-4 py-8 text-sm text-slate-500 dark:bg-slate-900 dark:text-gray-400">
                    Loading personal preferences...
                  </div>
                ) : (
                  orderedPreferences.map((item) => (
                    <div
                      key={item.notificationType}
                      className="grid grid-cols-[minmax(220px,1.8fr)_repeat(5,minmax(84px,1fr))] gap-px border-t border-slate-200 bg-slate-200 dark:border-gray-800 dark:bg-gray-800"
                    >
                      <div className="bg-white px-4 py-3 dark:bg-slate-900">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{prettyType(item.notificationType)}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                          {item.supplierCode ? `Supplier scope: ${item.supplierCode}` : "Global routing"}
                        </p>
                      </div>
                      <PreferenceCell>
                        <Checkbox checked={item.emailEnabled} onChange={(checked) => updatePreference(item.notificationType, { emailEnabled: checked, muted: false })} />
                      </PreferenceCell>
                      <PreferenceCell>
                        <Checkbox checked={item.smsEnabled} onChange={(checked) => updatePreference(item.notificationType, { smsEnabled: checked, muted: false })} />
                      </PreferenceCell>
                      <PreferenceCell>
                        <Checkbox checked={item.whatsappEnabled} onChange={(checked) => updatePreference(item.notificationType, { whatsappEnabled: checked, muted: false })} />
                      </PreferenceCell>
                      <PreferenceCell>
                        <Checkbox checked={item.allChannelsEnabled} onChange={(checked) => updatePreference(item.notificationType, { allChannelsEnabled: checked, muted: false })} />
                      </PreferenceCell>
                      <PreferenceCell>
                        <Checkbox checked={item.muted} onChange={(checked) => updatePreference(item.notificationType, { muted: checked })} />
                      </PreferenceCell>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </DataCard>

        <DataCard>
          <div className="p-4 lg:p-5">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-gray-800 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                  Supplier Recipient Directory
                </p>
                <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                  Full-width broadcast registry
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                  Every configured recipient for the selected supplier is listed here for WhatsApp, SMS, and email routing.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Channel Recipient
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                    <th className="px-3 py-2">Recipient</th>
                    <th className="px-3 py-2">Channel</th>
                    <th className="px-3 py-2">Destination</th>
                    <th className="px-3 py-2">Events</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingWorkspace ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-sm text-slate-500 dark:text-gray-400">
                        Loading supplier recipients...
                      </td>
                    </tr>
                  ) : supplierEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10">
                        <div className="rounded-3xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-gray-700 dark:text-gray-400">
                          No recipients configured for this supplier yet. Add WhatsApp numbers, SMS numbers, and emails to activate live alert fanout.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    supplierEntries.map((entry) => (
                      <tr key={entry.id} className="rounded-[22px] bg-slate-50/70 dark:bg-slate-900">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{entry.displayName}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{entry.supplierName}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${channelMeta[entry.channel].tone}`}>
                            {channelMeta[entry.channel].icon}
                            {channelMeta[entry.channel].label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm font-medium text-slate-700 dark:text-gray-200">{entry.destination}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            {entry.allNotificationTypes ? (
                              <MiniChip label="All event types" tone="blue" />
                            ) : (
                              entry.notificationTypes.map((type) => <MiniChip key={type} label={prettyType(type)} tone="slate" />)
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <MiniChip label={entry.enabled ? "Active" : "Disabled"} tone={entry.enabled ? "green" : "amber"} />
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(entry)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-slate-950 dark:text-gray-200 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteEntry(entry.id)}
                              disabled={deletingEntryId === entry.id}
                              className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {deletingEntryId === entry.id ? "Removing..." : "Remove"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DataCard>
      </AdminShell>

      <Modal
        isOpen={showEditor}
        onClose={closeEditor}
        variant="center"
        showCloseButton={false}
        backdropBlur={true}
        className="max-w-[1080px] overflow-hidden rounded-[32px] border border-slate-200/90 bg-white p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex flex-col bg-white dark:bg-slate-950">
          <div className="relative overflow-hidden border-b border-slate-200/90 bg-gradient-to-r from-blue-50/95 via-white to-slate-50/95 px-5 py-3.5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.08),transparent_32%)]" />
            <div className="relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-600/20">
                  <BellRing className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
                    {formState.id ? "Edit Recipient" : "Add Recipient"}
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {formState.id ? "Update supplier notification recipient" : "Create supplier notification recipient"}
                  </h3>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    Premium supplier alert routing with compact channel and event controls.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            </div>
          </div>

          <div className="bg-slate-50/60 px-5 py-4 dark:bg-slate-950">
            <div className="grid items-start gap-4 lg:grid-cols-[0.94fr_1.06fr]">
              <Panel title="Recipient Identity" description="Name the recipient target and choose the supplier scope.">
                <Field label="Supplier">
                  <select
                    value={formState.supplierCode || activeSupplierCode}
                    onChange={(event) => setFormState((current) => ({ ...current, supplierCode: event.target.value }))}
                    disabled={!workspace?.canManageAllSuppliers}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {(workspace?.suppliers ?? []).map((supplier) => (
                      <option key={supplier.code} value={supplier.code}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Display Name">
                  <input
                    value={formState.displayName}
                    onChange={(event) => setFormState((current) => ({ ...current, displayName: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="Oculus Operations Lead"
                  />
                </Field>
                <Field label="Channel">
                  <select
                    value={formState.channel}
                    onChange={(event) => setFormState((current) => ({ ...current, channel: event.target.value as NotificationChannel }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {(workspace?.availableChannels ?? ["EMAIL", "SMS", "WHATSAPP"]).map((channel) => (
                      <option key={channel} value={channel}>
                        {channelMeta[channel].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={formState.channel === "EMAIL" ? "Email Address" : "Destination"}>
                  <input
                    value={formState.destination}
                    onChange={(event) => setFormState((current) => ({ ...current, destination: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    placeholder={formState.channel === "EMAIL" ? "alerts@supplier.com" : "+2637..."}
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    value={formState.notes}
                    onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="Optional routing notes for operations."
                  />
                </Field>
              </Panel>

              <Panel title="Routing Rules" description="Choose which alert events this destination should receive.">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <ToggleRow
                    label="Recipient active"
                    description="Turn this destination on or off without deleting it."
                    checked={formState.enabled}
                    onChange={(checked) => setFormState((current) => ({ ...current, enabled: checked }))}
                  />
                  <ToggleRow
                    label="All event types"
                    description="Use one destination for every transformer and system notification."
                    checked={formState.allNotificationTypes}
                    onChange={(checked) =>
                      setFormState((current) => ({
                        ...current,
                        allNotificationTypes: checked,
                        notificationTypes: checked ? [] : current.notificationTypes,
                      }))
                    }
                  />
                </div>
                <div className="mt-3 grid gap-2 grid-cols-3">
                  {(workspace?.availableNotificationTypes ?? []).map((type) => {
                    const checked = formState.notificationTypes.includes(type);
                    return (
                      <label
                        key={type}
                        className={`flex min-h-[46px] items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] leading-4 ${
                          checked
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        } ${formState.allNotificationTypes ? "opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={formState.allNotificationTypes}
                          onChange={() =>
                            setFormState((current) => ({
                              ...current,
                              notificationTypes: checked
                                ? current.notificationTypes.filter((item) => item !== type)
                                : [...current.notificationTypes, type],
                            }))
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-semibold tracking-tight">{prettyType(type)}</span>
                      </label>
                    );
                  })}
                </div>
              </Panel>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEntry()}
                disabled={savingEntry}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingEntry ? "Saving..." : formState.id ? "Save Recipient" : "Create Recipient"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function SummaryBadge({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "amber" | "blue" | "violet";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
        : tone === "violet"
          ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300"
          : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className={`inline-flex rounded-xl p-2 ${toneClass}`}>{icon}</div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">{title}</p>
      <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-gray-400">{description}</p>
      <div className="mt-4 space-y-3.5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-700 dark:bg-slate-950">
      <div>
        <p className="text-[13px] font-semibold text-slate-900 dark:text-white">{label}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-gray-400">{description}</p>
      </div>
      <Checkbox checked={checked} onChange={onChange} />
    </div>
  );
}

function MiniChip({ label, tone }: { label: string; tone: "blue" | "slate" | "green" | "amber" }) {
  const toneClass =
    tone === "blue"
      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        : tone === "amber"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`}>{label}</span>;
}

function PreferenceCell({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center bg-white px-3 py-3 dark:bg-slate-900">{children}</div>;
}
