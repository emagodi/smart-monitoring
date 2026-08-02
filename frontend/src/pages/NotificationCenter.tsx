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

type WhatsAppEligibility = {
  waId: string;
  phoneNumber: string;
  optedIn: boolean;
  optInAt?: string | null;
  optInSource?: string | null;
  freeFormEligible: boolean;
  conversationWindowOpenUntil?: string | null;
  lastInboundMessageType?: string | null;
  lastInboundMessageBody?: string | null;
  lastInboundMessageAt?: string | null;
  lastOutboundMode?: string | null;
  lastTemplateName?: string | null;
  lastOutboundAcceptedAt?: string | null;
  lastStatus?: string | null;
  lastStatusAt?: string | null;
  lastDecisionReason?: string | null;
  lastConversationId?: string | null;
};

type WhatsAppTemplateCatalogEntry = {
  id: number;
  notificationType: NotificationType;
  templateName: string;
  languageCode: string;
  enabled: boolean;
  defaultTemplate: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TemplateFormState = {
  id?: number;
  notificationType: NotificationType;
  templateName: string;
  languageCode: string;
  enabled: boolean;
  defaultTemplate: boolean;
  notes: string;
};

type DirectoryFormState = {
  supplierCode: string;
  displayName: string;
  entryIds: Partial<Record<NotificationChannel, number>>;
  whatsappDestination: string;
  smsDestination: string;
  emailDestination: string;
  enabled: boolean;
  allNotificationTypes: boolean;
  notificationTypes: NotificationType[];
};

const defaultFormState: DirectoryFormState = {
  supplierCode: "",
  displayName: "",
  entryIds: {},
  whatsappDestination: "",
  smsDestination: "",
  emailDestination: "",
  enabled: true,
  allNotificationTypes: true,
  notificationTypes: [],
};

const defaultTemplateFormState: TemplateFormState = {
  notificationType: "SYSTEM_NOTICE",
  templateName: "",
  languageCode: "en",
  enabled: true,
  defaultTemplate: false,
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
  const [whatsAppEligibility, setWhatsAppEligibility] = useState<WhatsAppEligibility[]>([]);
  const [whatsAppTemplates, setWhatsAppTemplates] = useState<WhatsAppTemplateCatalogEntry[]>([]);
  const [loadingWhatsAppAdmin, setLoadingWhatsAppAdmin] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
  const [templateFormState, setTemplateFormState] = useState<TemplateFormState>(defaultTemplateFormState);
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

  const fetchWhatsAppAdmin = async () => {
    try {
      setLoadingWhatsAppAdmin(true);
      const [eligibilityResponse, templatesResponse] = await Promise.all([
        axios.get<WhatsAppEligibility[]>(`${API_BASE_URL}/v1/notification/whatsapp/eligibility`, { headers }),
        axios.get<WhatsAppTemplateCatalogEntry[]>(`${API_BASE_URL}/v1/notification/whatsapp/templates`, { headers }),
      ]);
      setWhatsAppEligibility(Array.isArray(eligibilityResponse.data) ? eligibilityResponse.data : []);
      setWhatsAppTemplates(Array.isArray(templatesResponse.data) ? templatesResponse.data : []);
    } catch (error) {
      console.error(error);
      setFlash("error", "WhatsApp admin load failed", "Eligibility telemetry or template catalog could not be loaded.");
    } finally {
      setLoadingWhatsAppAdmin(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void Promise.all([fetchWorkspace(user?.supplierCode || undefined), fetchPreferences(), fetchWhatsAppAdmin()]);
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

  const whatsappAdminTotals = useMemo(() => {
    return {
      contacts: whatsAppEligibility.length,
      openWindow: whatsAppEligibility.filter((item) => item.freeFormEligible).length,
      templateOnly: whatsAppEligibility.filter((item) => !item.freeFormEligible).length,
      templates: whatsAppTemplates.length,
    };
  }, [whatsAppEligibility, whatsAppTemplates]);

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
    const relatedEntries = (workspace?.entries ?? []).filter(
      (candidate) =>
        candidate.supplierCode === entry.supplierCode &&
        candidate.displayName === entry.displayName &&
        candidate.allNotificationTypes === entry.allNotificationTypes &&
        sameNotificationTypes(candidate.notificationTypes, entry.notificationTypes)
    );

    const entryIds: Partial<Record<NotificationChannel, number>> = {};
    let whatsappDestination = "";
    let smsDestination = "";
    let emailDestination = "";

    relatedEntries.forEach((item) => {
      entryIds[item.channel] = item.id;
      if (item.channel === "WHATSAPP") whatsappDestination = item.destination;
      if (item.channel === "SMS") smsDestination = item.destination;
      if (item.channel === "EMAIL") emailDestination = item.destination;
    });

    setFormState({
      supplierCode: entry.supplierCode,
      displayName: entry.displayName,
      entryIds,
      whatsappDestination,
      smsDestination,
      emailDestination,
      enabled: entry.enabled,
      allNotificationTypes: entry.allNotificationTypes,
      notificationTypes: entry.notificationTypes || [],
    });
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setFormState(defaultFormState);
  };

  const openTemplateCreate = () => {
    setTemplateFormState(defaultTemplateFormState);
    setShowTemplateEditor(true);
  };

  const openTemplateEdit = (template: WhatsAppTemplateCatalogEntry) => {
    setTemplateFormState({
      id: template.id,
      notificationType: template.notificationType,
      templateName: template.templateName,
      languageCode: template.languageCode || "en",
      enabled: template.enabled,
      defaultTemplate: template.defaultTemplate,
      notes: template.notes || "",
    });
    setShowTemplateEditor(true);
  };

  const closeTemplateEditor = () => {
    setShowTemplateEditor(false);
    setTemplateFormState(defaultTemplateFormState);
  };

  const saveEntry = async () => {
    if (!formState.displayName.trim()) {
      setFlash("warning", "Validation", "Display name is required.");
      return;
    }
    const channelValues: Array<{ channel: NotificationChannel; destination: string }> = [
      { channel: "WHATSAPP", destination: formState.whatsappDestination.trim() },
      { channel: "SMS", destination: formState.smsDestination.trim() },
      { channel: "EMAIL", destination: formState.emailDestination.trim() },
    ];
    const selectedChannels = channelValues.filter((item) => item.destination);
    if (selectedChannels.length === 0) {
      setFlash("warning", "Validation", "Enter at least one WhatsApp number, SMS number, or email address.");
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
        enabled: formState.enabled,
        allNotificationTypes: formState.allNotificationTypes,
        notificationTypes: formState.notificationTypes,
      };

      const upserts = selectedChannels.map(({ channel, destination }) => {
        const requestPayload = {
          ...payload,
          channel,
          destination,
        };
        const entryId = formState.entryIds[channel];
        return entryId
          ? axios.put(`${API_BASE_URL}/api/v1/auth/notification-directory/${entryId}`, requestPayload, { headers })
          : axios.post(`${API_BASE_URL}/api/v1/auth/notification-directory`, requestPayload, { headers });
      });

      const deletions = (Object.entries(formState.entryIds) as Array<[NotificationChannel, number]>)
        .filter(([channel, entryId]) => Boolean(entryId) && !selectedChannels.some((item) => item.channel === channel))
        .map(([, entryId]) => axios.delete(`${API_BASE_URL}/api/v1/auth/notification-directory/${entryId}`, { headers }));

      await Promise.all([...upserts, ...deletions]);
      setFlash(
        "success",
        "Recipient saved",
        "The supplier recipient was saved with the selected WhatsApp, SMS, and email channels."
      );
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

  const saveTemplate = async () => {
    if (!templateFormState.templateName.trim()) {
      setFlash("warning", "Validation", "Template name is required.");
      return;
    }
    try {
      setSavingTemplate(true);
      const payload = {
        notificationType: templateFormState.notificationType,
        templateName: templateFormState.templateName.trim(),
        languageCode: templateFormState.languageCode.trim() || "en",
        enabled: templateFormState.enabled,
        defaultTemplate: templateFormState.defaultTemplate,
        notes: templateFormState.notes.trim() || null,
      };
      if (templateFormState.id) {
        await axios.put(`${API_BASE_URL}/v1/notification/whatsapp/templates/${templateFormState.id}`, payload, { headers });
      } else {
        await axios.post(`${API_BASE_URL}/v1/notification/whatsapp/templates`, payload, { headers });
      }
      setFlash("success", "Template saved", "The WhatsApp template catalog entry was saved.");
      closeTemplateEditor();
      await fetchWhatsAppAdmin();
    } catch (error) {
      console.error(error);
      setFlash("error", "Template save failed", "The WhatsApp template catalog entry could not be saved.");
    } finally {
      setSavingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId: number) => {
    try {
      setDeletingTemplateId(templateId);
      await axios.delete(`${API_BASE_URL}/v1/notification/whatsapp/templates/${templateId}`, { headers });
      setFlash("success", "Template removed", "The WhatsApp template catalog entry was removed.");
      await fetchWhatsAppAdmin();
    } catch (error) {
      console.error(error);
      setFlash("error", "Template delete failed", "The WhatsApp template catalog entry could not be removed.");
    } finally {
      setDeletingTemplateId(null);
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

        <DataCard>
          <div className="p-4 lg:p-5">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                    WhatsApp Governance
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                    Eligibility registry and template control
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    Review who is inside the 24-hour free-form window, what template was used last, and which managed templates are active.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void fetchWhatsAppAdmin()}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh WhatsApp
                </button>
                <button
                  type="button"
                  onClick={openTemplateCreate}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Template
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryBadge icon={<MessageSquareText className="h-4 w-4" />} label="Tracked Contacts" value={`${whatsappAdminTotals.contacts}`} tone="green" />
              <SummaryBadge icon={<BellRing className="h-4 w-4" />} label="Open Windows" value={`${whatsappAdminTotals.openWindow}`} tone="blue" />
              <SummaryBadge icon={<X className="h-4 w-4" />} label="Template Only" value={`${whatsappAdminTotals.templateOnly}`} tone="amber" />
              <SummaryBadge icon={<Save className="h-4 w-4" />} label="Managed Templates" value={`${whatsappAdminTotals.templates}`} tone="violet" />
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-gray-800">
                <table className="min-w-full border-separate border-spacing-y-0">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                      <th className="px-4 py-3">WhatsApp Number</th>
                      <th className="px-4 py-3">Eligibility</th>
                      <th className="px-4 py-3">Window</th>
                      <th className="px-4 py-3">Last Mode</th>
                      <th className="px-4 py-3">Last Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingWhatsAppAdmin ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-sm text-slate-500 dark:text-gray-400">
                          Loading WhatsApp eligibility...
                        </td>
                      </tr>
                    ) : whatsAppEligibility.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-sm text-slate-500 dark:text-gray-400">
                          No WhatsApp contact state recorded yet.
                        </td>
                      </tr>
                    ) : (
                      whatsAppEligibility.map((item) => (
                        <tr key={item.waId} className="border-t border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-900">
                          <td className="px-4 py-3 align-top">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.phoneNumber || item.waId}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{item.optInSource || "No opt-in source"}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <MiniChip label={item.freeFormEligible ? "Free-form open" : "Template only"} tone={item.freeFormEligible ? "green" : "amber"} />
                            <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">{item.lastDecisionReason || "No decision yet"}</p>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-slate-700 dark:text-gray-200">
                            {formatDateTime(item.conversationWindowOpenUntil)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <MiniChip label={item.lastOutboundMode || "Unknown"} tone={item.lastOutboundMode === "TEXT" ? "blue" : item.lastOutboundMode === "TEMPLATE" ? "green" : "slate"} />
                            <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">{item.lastTemplateName || "No template tracked"}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <MiniChip label={item.lastStatus || "Unknown"} tone={resolveStatusTone(item.lastStatus)} />
                            <p className="mt-2 text-xs text-slate-500 dark:text-gray-400">{formatDateTime(item.lastStatusAt)}</p>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-gray-800">
                <table className="min-w-full border-separate border-spacing-y-0">
                  <thead className="bg-slate-50 dark:bg-slate-950">
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                      <th className="px-4 py-3">Template</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingWhatsAppAdmin ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-sm text-slate-500 dark:text-gray-400">
                          Loading template catalog...
                        </td>
                      </tr>
                    ) : whatsAppTemplates.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-sm text-slate-500 dark:text-gray-400">
                          No managed WhatsApp templates configured yet.
                        </td>
                      </tr>
                    ) : (
                      whatsAppTemplates.map((template) => (
                        <tr key={template.id} className="border-t border-slate-200 bg-white dark:border-gray-800 dark:bg-slate-900">
                          <td className="px-4 py-3 align-top">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{template.templateName}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{template.languageCode || "en"}</p>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-slate-700 dark:text-gray-200">{prettyType(template.notificationType)}</td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              <MiniChip label={template.enabled ? "Enabled" : "Disabled"} tone={template.enabled ? "green" : "amber"} />
                              {template.defaultTemplate ? <MiniChip label="Default" tone="blue" /> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => openTemplateEdit(template)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-600 dark:border-gray-700 dark:bg-slate-950 dark:text-gray-200 dark:hover:border-blue-500/40 dark:hover:text-blue-300"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteTemplate(template.id)}
                                disabled={deletingTemplateId === template.id}
                                className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                {deletingTemplateId === template.id ? "Removing..." : "Remove"}
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
          </div>
        </DataCard>
      </AdminShell>

      <Modal
        isOpen={showEditor}
        onClose={closeEditor}
        variant="center"
        showCloseButton={false}
        backdropBlur={true}
        className="w-[96vw] max-w-[1380px] overflow-hidden rounded-[32px] border border-slate-200/90 bg-white p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950"
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
                    {Object.keys(formState.entryIds).length > 0 ? "Edit Recipient" : "Add Recipient"}
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {Object.keys(formState.entryIds).length > 0
                      ? "Update supplier notification recipient"
                      : "Create supplier notification recipient"}
                  </h3>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    Configure one recipient with separate WhatsApp, SMS, and email destinations in a single save flow.
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
            <div className="grid items-stretch gap-4 lg:grid-cols-[1fr_1fr]">
              <Panel title="Recipient Identity" description="Name the recipient target and choose the supplier scope.">
                <Field label="Supplier">
                  <select
                    value={formState.supplierCode || activeSupplierCode}
                    onChange={(event) => setFormState((current) => ({ ...current, supplierCode: event.target.value }))}
                    disabled={!workspace?.canManageAllSuppliers}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
                    className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="Oqulus Operations Lead"
                  />
                </Field>
                <div className="rounded-[20px] border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                      <MessageSquareText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Channel Destinations
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Add one or more contact points for the same recipient.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 grid gap-2.5 xl:grid-cols-[1fr_1fr_1.35fr]">
                    <ChannelInput
                      label="WhatsApp Number"
                      icon={<MessageSquareText className="h-4 w-4" />}
                      value={formState.whatsappDestination}
                      onChange={(value) => setFormState((current) => ({ ...current, whatsappDestination: value }))}
                      placeholder="+2637..."
                      tone="green"
                    />
                    <ChannelInput
                      label="SMS Number"
                      icon={<Smartphone className="h-4 w-4" />}
                      value={formState.smsDestination}
                      onChange={(value) => setFormState((current) => ({ ...current, smsDestination: value }))}
                      placeholder="+2637..."
                      tone="amber"
                    />
                    <ChannelInput
                      label="Email Address"
                      icon={<Mail className="h-4 w-4" />}
                      value={formState.emailDestination}
                      onChange={(value) => setFormState((current) => ({ ...current, emailDestination: value }))}
                      placeholder="alerts@supplier.com"
                      tone="blue"
                    />
                  </div>
                </div>
              </Panel>

              <Panel title="Routing Rules" description="Choose which alert events this destination should receive.">
                <div className="flex h-full flex-col">
                  <div className="grid gap-2 sm:grid-cols-2">
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
                  <div className="mt-2.5 grid gap-1.5 grid-cols-3">
                    {(workspace?.availableNotificationTypes ?? []).map((type) => {
                      const checked = formState.notificationTypes.includes(type);
                      return (
                        <label
                          key={type}
                          className={`flex min-h-[38px] items-center gap-1.5 rounded-xl border px-1.5 py-1.5 text-[10px] leading-3 ${
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
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-2.5 py-2 dark:border-blue-500/20 dark:from-blue-500/10 dark:to-slate-900">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">Blue Policy</p>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Operational routing profile</p>
                    </div>
                    <div className="rounded-xl border border-rose-100 bg-gradient-to-r from-rose-50 to-white px-2.5 py-2 dark:border-rose-500/20 dark:from-rose-500/10 dark:to-slate-900">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Red Policy</p>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">High-priority incident profile</p>
                    </div>
                  </div>
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
                {savingEntry ? "Saving..." : Object.keys(formState.entryIds).length > 0 ? "Save Recipient" : "Create Recipient"}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showTemplateEditor}
        onClose={closeTemplateEditor}
        variant="center"
        showCloseButton={false}
        backdropBlur={true}
        className="w-[92vw] max-w-[880px] overflow-hidden rounded-[32px] border border-slate-200/90 bg-white p-0 shadow-[0_30px_90px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex flex-col bg-white dark:bg-slate-950">
          <div className="border-b border-slate-200/90 bg-gradient-to-r from-emerald-50/95 via-white to-slate-50/95 px-5 py-4 dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-600/20">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                    {templateFormState.id ? "Edit Template" : "Add Template"}
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    Managed WhatsApp template catalog
                  </h3>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                    Maintain the approved template that should be used when free-form messaging is not allowed.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeTemplateEditor}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 bg-slate-50/60 px-5 py-4 dark:bg-slate-950 lg:grid-cols-2">
            <Field label="Notification Type">
              <select
                value={templateFormState.notificationType}
                onChange={(event) =>
                  setTemplateFormState((current) => ({ ...current, notificationType: event.target.value as NotificationType }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {(workspace?.availableNotificationTypes ?? []).map((type) => (
                  <option key={type} value={type}>
                    {prettyType(type)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Language Code">
              <input
                value={templateFormState.languageCode}
                onChange={(event) => setTemplateFormState((current) => ({ ...current, languageCode: event.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="en"
              />
            </Field>
            <Field label="Template Name">
              <input
                value={templateFormState.templateName}
                onChange={(event) => setTemplateFormState((current) => ({ ...current, templateName: event.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                placeholder="critical_alert_template"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <ToggleRow
                label="Enabled"
                description="Use this template for live WhatsApp delivery."
                checked={templateFormState.enabled}
                onChange={(checked) => setTemplateFormState((current) => ({ ...current, enabled: checked }))}
              />
              <ToggleRow
                label="Default"
                description="Fallback template when no event-specific template exists."
                checked={templateFormState.defaultTemplate}
                onChange={(checked) => setTemplateFormState((current) => ({ ...current, defaultTemplate: checked }))}
              />
            </div>
            <div className="lg:col-span-2">
              <Field label="Notes">
                <textarea
                  value={templateFormState.notes}
                  onChange={(event) => setTemplateFormState((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-[110px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Approved Meta utility template for controller trigger alerts."
                />
              </Field>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeTemplateEditor}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveTemplate()}
                disabled={savingTemplate}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingTemplate ? "Saving..." : templateFormState.id ? "Save Template" : "Create Template"}
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
  const compactRouting = title === "Routing Rules";
  return (
    <section className={`flex h-full flex-col rounded-[22px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${compactRouting ? "p-3.5" : "p-4"}`}>
      <p className={`${compactRouting ? "text-[9px] tracking-[0.17em]" : "text-[10px] tracking-[0.2em]"} font-semibold uppercase text-blue-600 dark:text-blue-300`}>
        {title}
      </p>
      <p className={`mt-1 text-slate-500 dark:text-gray-400 ${compactRouting ? "text-[11px] leading-4" : "text-[12px] leading-5"}`}>
        {description}
      </p>
      <div className={`${compactRouting ? "mt-3 space-y-3" : "mt-4 space-y-3.5"} flex-1`}>{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{label}</span>
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
    <div className="flex min-h-[64px] items-center justify-between gap-2 rounded-2xl border border-blue-100/80 bg-gradient-to-r from-blue-50/85 via-white to-slate-50/85 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-blue-500/20 dark:from-blue-500/10 dark:via-slate-900 dark:to-slate-900">
      <div className="flex-1">
        <p className="text-[11px] font-semibold tracking-tight text-slate-900 dark:text-white">{label}</p>
        <p className="mt-1 text-[9px] leading-3.5 text-slate-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 shadow-sm ring-1 ring-blue-100 dark:bg-slate-800 dark:ring-blue-500/20">
        <Checkbox checked={checked} onChange={onChange} />
      </div>
    </div>
  );
}

function ChannelInput({
  className,
  label,
  icon,
  value,
  onChange,
  placeholder,
  tone,
}: {
  className?: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  tone: "green" | "amber" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : tone === "amber"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneClass}`}>{icon}</div>
        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        placeholder={placeholder}
      />
    </div>
  );
}

function sameNotificationTypes(left: NotificationType[] = [], right: NotificationType[] = []) {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.every((value, index) => value === rightSorted[index]);
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

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function resolveStatusTone(status?: string | null): "blue" | "slate" | "green" | "amber" {
  const normalized = (status || "").toLowerCase();
  if (normalized === "read" || normalized === "delivered" || normalized === "sent" || normalized === "accepted" || normalized === "inbound") {
    return "green";
  }
  if (normalized === "failed") {
    return "amber";
  }
  if (normalized === "unknown") {
    return "slate";
  }
  return "blue";
}
