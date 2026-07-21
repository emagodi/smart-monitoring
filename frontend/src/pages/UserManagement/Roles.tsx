import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, Plus, RefreshCw, Search, Shield, Trash2, X } from "lucide-react";
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

type RoleItem = {
  id: number;
  name: string;
  description?: string;
  status?: string;
  usersAssigned: number;
  permissionsCount: number;
  permissionIds: number[];
  permissions: string[];
};

type RoleForm = {
  name: string;
  description: string;
  status: string;
  permissionIds: string[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const defaultForm: RoleForm = {
  name: "",
  description: "",
  status: "ACTIVE",
  permissionIds: [],
};

const getRoleStatusTone = (status: string) =>
  status === "ACTIVE"
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";

const toTitleCase = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function RolesPage() {
  const { token, hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{
    variant: "success" | "error" | "info" | "warning";
    title: string;
    message: string;
  } | null>(null);
  const [activeRole, setActiveRole] = useState<RoleItem | null>(null);
  const [form, setForm] = useState<RoleForm>(defaultForm);
  const [showEditor, setShowEditor] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, PermissionItem[]>>((accumulator, permission) => {
      const key = permission.module || "general";
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(permission);
      return accumulator;
    }, {});
  }, [permissions]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return roles.filter((role) => {
      if (!query) return true;
      return (
        role.name.toLowerCase().includes(query) ||
        (role.description || "").toLowerCase().includes(query) ||
        role.permissions.some((permission) => permission.toLowerCase().includes(query))
      );
    });
  }, [roles, search]);

  const activeRolesCount = useMemo(
    () => roles.filter((role) => (role.status || "ACTIVE") === "ACTIVE").length,
    [roles]
  );

  const inactiveRolesCount = roles.length - activeRolesCount;
  const totalAssignments = useMemo(
    () => roles.reduce((sum, role) => sum + role.usersAssigned, 0),
    [roles]
  );
  const averagePermissions = roles.length
    ? Math.round(
        roles.reduce((sum, role) => sum + role.permissionsCount, 0) / roles.length
      )
    : 0;

  const topAssignedRoles = useMemo(
    () => roles.slice().sort((a, b) => b.usersAssigned - a.usersAssigned).slice(0, 4),
    [roles]
  );

  const topPermissionModules = useMemo(
    () =>
      Object.entries(groupedPermissions)
        .sort(([, left], [, right]) => right.length - left.length)
        .slice(0, 4),
    [groupedPermissions]
  );

  const pushNotice = (
    variant: "success" | "error" | "info" | "warning",
    title: string,
    message: string
  ) => {
    setNotice({ variant, title, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesResponse, permissionsResponse] = await Promise.all([
        axios.get<RoleItem[]>(`${API_BASE_URL}/api/v1/admin/roles`, { headers }),
        axios.get<PermissionItem[]>(`${API_BASE_URL}/api/v1/admin/permissions`, { headers }),
      ]);
      setRoles(Array.isArray(rolesResponse.data) ? rolesResponse.data : []);
      setPermissions(Array.isArray(permissionsResponse.data) ? permissionsResponse.data : []);
    } catch (error) {
      console.error(error);
      pushNotice("error", "Load failed", "Could not load roles and permissions.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) void fetchAll();
  }, [token, fetchAll]);

  const openCreate = () => {
    setActiveRole(null);
    setForm(defaultForm);
    setShowEditor(true);
  };

  const openEdit = (role: RoleItem) => {
    setActiveRole(role);
    setForm({
      name: role.name,
      description: role.description || "",
      status: role.status || "ACTIVE",
      permissionIds: role.permissionIds.map(String),
    });
    setShowEditor(true);
  };

  const openDelete = (role: RoleItem) => {
    setActiveRole(role);
    setShowDelete(true);
  };

  const togglePermission = (permissionId: number) => {
    const value = String(permissionId);
    setForm((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(value)
        ? current.permissionIds.filter((id) => id !== value)
        : [...current.permissionIds, value],
    }));
  };

  const saveRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      pushNotice("warning", "Validation", "Role name is required.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
        permissionIds: form.permissionIds.map(Number),
      };

      if (activeRole) {
        await axios.put(`${API_BASE_URL}/api/v1/admin/roles/${activeRole.id}`, payload, {
          headers,
        });
        pushNotice("success", "Role updated", "Role permissions were saved.");
      } else {
        await axios.post(`${API_BASE_URL}/api/v1/admin/roles`, payload, { headers });
        pushNotice("success", "Role created", "The new role is ready for assignment.");
      }
      setShowEditor(false);
      await fetchAll();
    } catch (error) {
      console.error(error);
      pushNotice("error", "Save failed", "Could not save the role.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    if (!activeRole) return;
    try {
      setSaving(true);
      await axios.delete(`${API_BASE_URL}/api/v1/admin/roles/${activeRole.id}`, { headers });
      setShowDelete(false);
      setActiveRole(null);
      await fetchAll();
      pushNotice("success", "Role deleted", "The selected role was removed.");
    } catch (error) {
      console.error(error);
      pushNotice("error", "Delete failed", "Could not delete the selected role.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="Roles"
      description="Create dynamic roles, assign enterprise permissions, and manage role usage across the platform."
      stats={[
        { label: "Roles", value: roles.length, tone: "blue" },
        { label: "Permissions", value: permissions.length, tone: "purple" },
        { label: "Active Roles", value: activeRolesCount, tone: "green" },
        { label: "Assignments", value: totalAssignments, tone: "amber" },
      ]}
    >
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Summary
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                Role portfolio health
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Shield className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {[
              ["Active roles", activeRolesCount],
              ["Inactive roles", inactiveRolesCount],
              ["Assignments", totalAssignments],
              ["Avg permissions", averagePermissions],
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
              Assignment Leaders
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Most deployed roles
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {topAssignedRoles.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No role assignments are available yet.
              </div>
            ) : (
              topAssignedRoles.map((role) => {
                const width = totalAssignments
                  ? (role.usersAssigned / totalAssignments) * 100
                  : 0;

                return (
                  <div key={role.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {role.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {role.usersAssigned} assigned
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                        style={{ width: `${Math.max(width, role.usersAssigned > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              Permission Landscape
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Heaviest modules
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {topPermissionModules.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Permission modules will appear here once the catalog loads.
              </div>
            ) : (
              topPermissionModules.map(([module, items]) => (
                <div
                  key={module}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                      {toTitleCase(module)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {items.filter((item) => (item.status || "ACTIVE") === "ACTIVE").length} active actions
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    {items.length}
                  </span>
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
                  Role Directory
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  Enterprise access architecture
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Review role assignments, permission density, and lifecycle status from a single workspace.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchAll()}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                {hasPermission("roles.create") ? (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create Role
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
                  placeholder="Search roles, descriptions, or permissions"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {filteredRoles.length}
              </span>
              matching roles
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
          ) : filteredRoles.length === 0 ? (
            <EmptyState
              title="No roles available"
              message="Create the first dynamic role to start assigning database-driven access."
              action={hasPermission("roles.create") ? <Button onClick={openCreate}>Create Role</Button> : null}
            />
          ) : (
            <div className="overflow-x-auto p-4 pt-0">
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">Role</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">Assignments</th>
                    <th className="px-3 py-2.5">Permission Set</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((role) => {
                    const status = role.status || "ACTIVE";

                    return (
                      <tr key={role.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <Shield className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                                {role.name}
                              </p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                {role.permissionsCount} mapped permission
                                {role.permissionsCount === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {role.description || "No description added for this role yet."}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1.5">
                            <div
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                role.usersAssigned > 0
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {role.usersAssigned} user{role.usersAssigned === 1 ? "" : "s"}
                            </div>
                            <p className="text-[12px] text-slate-400 dark:text-slate-500">
                              Current platform assignments
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex max-w-[320px] flex-wrap gap-2">
                            {role.permissions.slice(0, 3).map((permission) => (
                              <span
                                key={permission}
                                className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                              >
                                {permission}
                              </span>
                            ))}
                            {role.permissions.length > 3 ? (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                +{role.permissions.length - 3} more
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  status === "ACTIVE"
                                    ? "bg-emerald-500"
                                    : "bg-amber-500"
                                }`}
                              />
                              {status}
                            </span>
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">
                              {role.permissionsCount} controls provisioned
                            </span>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ActionMenu
                            placement="bottom-end"
                            onView={() => openEdit(role)}
                            onEdit={hasPermission("roles.update") ? () => openEdit(role) : undefined}
                            onDelete={hasPermission("roles.delete") ? () => openDelete(role) : undefined}
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

      <RoleEditorModal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSubmit={saveRole}
        activeRole={activeRole}
        form={form}
        saving={saving}
        groupedPermissions={groupedPermissions}
        onUpdate={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        onTogglePermission={togglePermission}
      />

      <RoleDeleteModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={deleteRole}
        role={activeRole}
        deleting={saving}
      />
    </AdminShell>
  );
}

function RoleEditorModal({
  open,
  onClose,
  onSubmit,
  activeRole,
  form,
  saving,
  groupedPermissions,
  onUpdate,
  onTogglePermission,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  activeRole: RoleItem | null;
  form: RoleForm;
  saving: boolean;
  groupedPermissions: Record<string, PermissionItem[]>;
  onUpdate: <K extends keyof RoleForm>(key: K, value: RoleForm[K]) => void;
  onTogglePermission: (permissionId: number) => void;
}) {
  const isEdit = Boolean(activeRole);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[90vh] max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                {isEdit ? <Shield className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  {isEdit ? "Edit Role" : "Create Role"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {isEdit ? "Update role access profile" : "Add a new enterprise role"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Define role metadata and manage the permission matrix from a centered modal.
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
              <SummaryPill label="Selected permissions" value={String(form.permissionIds.length)} />
              <SummaryPill label="Status" value={form.status} tone={getRoleStatusTone(form.status)} />
            </div>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                  Role Information
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Primary details
                </h4>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1.2fr_0.8fr]">
                <TextField
                  label="Role Name"
                  value={form.name}
                  onChange={(value) => onUpdate("name", value)}
                  placeholder="Enter role name"
                />
                <TextAreaField
                  label="Description"
                  value={form.description}
                  onChange={(value) => onUpdate("description", value)}
                  placeholder="Describe how this role is used"
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
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                    Permission Matrix
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                    Access selection
                  </h4>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {form.permissionIds.length} selected
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
                  <div
                    key={module}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                          {toTitleCase(module)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {modulePermissions.length} available actions
                        </p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        {modulePermissions.length}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {modulePermissions.map((permission) => {
                        const checked = form.permissionIds.includes(String(permission.id));

                        return (
                          <label
                            key={permission.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                              checked
                                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                                : "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onTogglePermission(permission.id)}
                              className="mt-0.5"
                            />
                            <div>
                              <p className="font-medium">{permission.name}</p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {permission.description || permission.action}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
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
                className="inline-flex min-w-[156px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Role" : "Create Role"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function RoleDeleteModal({
  open,
  onClose,
  onConfirm,
  role,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  role: RoleItem | null;
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
        <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete Role?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Remove <span className="font-semibold text-slate-950 dark:text-slate-50">{role?.name || "this role"}</span> and its assignment profile from the RBAC catalog.
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
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {deleting ? "Deleting..." : "Delete Role"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={`mt-2 text-sm font-semibold ${tone ?? "text-slate-900 dark:text-slate-100"}`}>
        {value}
      </p>
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
