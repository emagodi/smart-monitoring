import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { KeySquare, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";
import { AdminShell, EmptyState } from "./AdminShared";

type PermissionItem = {
  id: number;
  name: string;
  module: string;
  action: string;
  description?: string;
  status?: string;
};

type PermissionForm = {
  name: string;
  module: string;
  action: string;
  description: string;
  status: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const defaultForm: PermissionForm = {
  name: "",
  module: "",
  action: "",
  description: "",
  status: "ACTIVE",
};

export default function PermissionsPage() {
  const { token, hasPermission } = useAuth();
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ variant: "success" | "error" | "info" | "warning"; title: string; message: string } | null>(null);
  const [activePermission, setActivePermission] = useState<PermissionItem | null>(null);
  const [form, setForm] = useState<PermissionForm>(defaultForm);
  const [showEditor, setShowEditor] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const filteredPermissions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return permissions.filter((permission) => {
      if (!query) return true;
      return (
        permission.name.toLowerCase().includes(query) ||
        permission.module.toLowerCase().includes(query) ||
        permission.action.toLowerCase().includes(query) ||
        (permission.description || "").toLowerCase().includes(query)
      );
    });
  }, [permissions, search]);

  const pushNotice = (variant: "success" | "error" | "info" | "warning", title: string, message: string) => {
    setNotice({ variant, title, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const activePermissionsCount = useMemo(
    () => permissions.filter((permission) => (permission.status || "ACTIVE") === "ACTIVE").length,
    [permissions]
  );

  const topModules = useMemo(
    () =>
      Array.from(
        permissions.reduce((accumulator, permission) => {
          const key = permission.module || "general";
          accumulator.set(key, (accumulator.get(key) || 0) + 1);
          return accumulator;
        }, new Map<string, number>())
      )
        .sort(([, left], [, right]) => right - left)
        .slice(0, 4),
    [permissions]
  );

  const actionMix = useMemo(
    () =>
      Array.from(
        permissions.reduce((accumulator, permission) => {
          const key = permission.action || "unknown";
          accumulator.set(key, (accumulator.get(key) || 0) + 1);
          return accumulator;
        }, new Map<string, number>())
      )
        .sort(([, left], [, right]) => right - left)
        .slice(0, 4),
    [permissions]
  );

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<PermissionItem[]>(`${API_BASE_URL}/api/v1/admin/permissions`, { headers });
      setPermissions(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(error);
      pushNotice("error", "Load failed", "Could not load permissions.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) void fetchPermissions();
  }, [token, fetchPermissions]);

  const openCreate = () => {
    setActivePermission(null);
    setForm(defaultForm);
    setShowEditor(true);
  };

  const openEdit = (permission: PermissionItem) => {
    setActivePermission(permission);
    setForm({
      name: permission.name,
      module: permission.module,
      action: permission.action,
      description: permission.description || "",
      status: permission.status || "ACTIVE",
    });
    setShowEditor(true);
  };

  const openDelete = (permission: PermissionItem) => {
    setActivePermission(permission);
    setShowDelete(true);
  };

  const savePermission = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.module.trim() || !form.action.trim()) {
      pushNotice("warning", "Validation", "Permission name, module, and action are required.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        module: form.module.trim(),
        action: form.action.trim(),
        description: form.description.trim(),
        status: form.status,
      };
      if (activePermission) {
        await axios.put(`${API_BASE_URL}/api/v1/admin/permissions/${activePermission.id}`, payload, { headers });
        pushNotice("success", "Permission updated", "Permission metadata was saved.");
      } else {
        await axios.post(`${API_BASE_URL}/api/v1/admin/permissions`, payload, { headers });
        pushNotice("success", "Permission created", "The permission is ready for role assignment.");
      }
      setShowEditor(false);
      await fetchPermissions();
    } catch (error) {
      console.error(error);
      pushNotice("error", "Save failed", "Could not save the permission.");
    } finally {
      setSaving(false);
    }
  };

  const deletePermission = async () => {
    if (!activePermission) return;
    try {
      setSaving(true);
      await axios.delete(`${API_BASE_URL}/api/v1/admin/permissions/${activePermission.id}`, { headers });
      setShowDelete(false);
      setActivePermission(null);
      await fetchPermissions();
      pushNotice("success", "Permission deleted", "The permission was removed.");
    } catch (error) {
      console.error(error);
      pushNotice("error", "Delete failed", "Could not delete the permission.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Permissions"
      description="Maintain the database-driven permission catalog that powers dynamic frontend authorization and role assignment."
      stats={[
        { label: "Permissions", value: permissions.length, tone: "blue" },
        { label: "Modules", value: new Set(permissions.map((permission) => permission.module)).size, tone: "purple" },
        { label: "Active", value: activePermissionsCount, tone: "green" },
        { label: "Actions", value: new Set(permissions.map((permission) => permission.action)).size, tone: "amber" },
      ]}
    >
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Summary
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                Catalog health
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <KeySquare className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {[
              ["Active permissions", activePermissionsCount],
              ["Inactive permissions", permissions.length - activePermissionsCount],
              ["Modules", new Set(permissions.map((permission) => permission.module)).size],
              ["Distinct actions", new Set(permissions.map((permission) => permission.action)).size],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="enterprise-subtle-card flex items-center justify-between px-3 py-2.5"
              >
                <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Module Concentration
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Highest-volume modules
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {topModules.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No modules are available yet.
              </div>
            ) : (
              topModules.slice(0, 3).map(([module, count]) => (
                <div
                  key={module}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{module}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Permissions mapped in this module</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    {count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Action Mix
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Common capability verbs
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {actionMix.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Common actions will appear here once the catalog loads.
              </div>
            ) : (
              actionMix.slice(0, 3).map(([action, count]) => (
                <div key={action}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{action}</span>
                    <span className="text-slate-500 dark:text-slate-400">{count} permissions</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                      style={{
                        width: `${Math.max(
                          permissions.length ? (count / permissions.length) * 100 : 0,
                          count > 0 ? 8 : 0
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Permission Catalog
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  Frontend authorization registry
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Keep modules, actions, and route control metadata organized in one premium shell.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchPermissions()}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                {hasPermission("permissions.create") ? (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create Permission
                  </button>
                ) : null}
              </div>
            </div>

          <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search permission, module, action, or description"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {filteredPermissions.length}
              </span>
              matching entries
            </div>
          </div>
        </div>

          {loading ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-[22px] bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : filteredPermissions.length === 0 ? (
            <EmptyState
              title="No permissions found"
              message="Add the first permission to populate the RBAC catalog."
              action={hasPermission("permissions.create") ? <Button onClick={openCreate}>Create Permission</Button> : null}
            />
          ) : (
            <div className="overflow-x-auto p-4 pt-0">
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Permission</th>
                    <th className="px-3 py-2.5">Module</th>
                    <th className="px-3 py-2.5">Action</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPermissions.map((permission) => {
                    const status = permission.status || "ACTIVE";

                    return (
                      <tr key={permission.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <KeySquare className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                                {permission.name}
                              </p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                {permission.module}.{permission.action}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                            {permission.module}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {permission.action}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {permission.description || "No description added for this permission yet."}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"
                                }`}
                              />
                              {status}
                            </span>
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">
                              {status === "ACTIVE" ? "Available for role mapping" : "Hidden from new mapping"}
                            </span>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ActionMenu
                            placement="bottom-end"
                            onView={() => openEdit(permission)}
                            onEdit={hasPermission("permissions.update") ? () => openEdit(permission) : undefined}
                            onDelete={hasPermission("permissions.delete") ? () => openDelete(permission) : undefined}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <PermissionEditorModal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSubmit={savePermission}
        activePermission={activePermission}
        form={form}
        saving={saving}
        onUpdate={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
      />

      <PermissionDeleteModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={deletePermission}
        permission={activePermission}
        deleting={saving}
      />
    </AdminShell>
  );
}

function PermissionEditorModal({
  open,
  onClose,
  onSubmit,
  activePermission,
  form,
  saving,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  activePermission: PermissionItem | null;
  form: PermissionForm;
  saving: boolean;
  onUpdate: <K extends keyof PermissionForm>(key: K, value: PermissionForm[K]) => void;
}) {
  const isEdit = Boolean(activePermission);
  const permissionKey =
    form.module.trim() && form.action.trim() ? `${form.module.trim()}.${form.action.trim()}` : "Pending definition";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[90vh] max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                {isEdit ? <KeySquare className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  {isEdit ? "Edit Permission" : "Create Permission"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {isEdit ? "Update permission metadata" : "Add a new RBAC permission"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Manage permission naming, module ownership, and action semantics from a centered modal.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryPill label="Workflow" value={isEdit ? "Edit in modal" : "Create in modal"} />
              <SummaryPill label="Permission key" value={permissionKey} />
              <SummaryPill label="Status" value={form.status} />
            </div>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                  Permission Information
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Metadata definition
                </h4>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TextField
                  label="Permission Name"
                  value={form.name}
                  onChange={(value) => onUpdate("name", value)}
                  placeholder="Enter permission name"
                />
                <TextField
                  label="Module"
                  value={form.module}
                  onChange={(value) => onUpdate("module", value)}
                  placeholder="e.g. users"
                />
                <TextField
                  label="Action"
                  value={form.action}
                  onChange={(value) => onUpdate("action", value)}
                  placeholder="e.g. create"
                />
                <SelectField
                  label="Status"
                  value={form.status}
                  onChange={(value) => onUpdate("status", value)}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
              </div>

              <div className="mt-4">
                <TextAreaField
                  label="Description"
                  value={form.description}
                  onChange={(value) => onUpdate("description", value)}
                  placeholder="Describe what this permission unlocks"
                />
              </div>
            </section>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-[176px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save Permission"
                    : "Create Permission"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function PermissionDeleteModal({
  open,
  onClose,
  onConfirm,
  permission,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  permission: PermissionItem | null;
  deleting: boolean;
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="w-full max-w-md overflow-hidden rounded-[28px] border border-red-200 bg-white p-0 shadow-2xl dark:border-red-500/20 dark:bg-slate-900"
      backdropBlur={true}
    >
      <div className="px-6 py-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300">
          <Trash2 className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete Permission?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Remove <span className="font-semibold text-slate-950 dark:text-slate-50">{permission?.name || "this permission"}</span> from the catalog. Assigned roles may need follow-up updates.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex min-w-[154px] items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {deleting ? "Deleting..." : "Delete Permission"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
