import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Plus, RefreshCw, Search, Shield, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";
import { AdminShell, DataCard, EmptyState, ToolbarCard } from "./AdminShared";

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

export default function RolesPage() {
  const { token, hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ variant: "success" | "error" | "info" | "warning"; title: string; message: string } | null>(null);
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

  const pushNotice = (variant: "success" | "error" | "info" | "warning", title: string, message: string) => {
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
    if (token) fetchAll();
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
        await axios.put(`${API_BASE_URL}/api/v1/admin/roles/${activeRole.id}`, payload, { headers });
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
      actions={
        <>
          <Button variant="outline" startIcon={<RefreshCw className="h-4 w-4" />} onClick={fetchAll}>
            Refresh
          </Button>
          {hasPermission("roles.create") ? (
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Create Role
            </Button>
          ) : null}
        </>
      }
      stats={[
        { label: "Roles", value: roles.length, tone: "blue" },
        { label: "Permissions", value: permissions.length, tone: "purple" },
        { label: "Active Roles", value: roles.filter((role) => (role.status || "ACTIVE") === "ACTIVE").length, tone: "green" },
        { label: "Assignments", value: roles.reduce((sum, role) => sum + role.usersAssigned, 0), tone: "amber" },
      ]}
    >
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <ToolbarCard>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search roles, descriptions, or permissions"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
      </ToolbarCard>

      <DataCard>
        {loading ? (
          <div className="grid gap-4 p-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : filteredRoles.length === 0 ? (
          <EmptyState
            title="No roles available"
            message="Create the first dynamic role to start assigning database-driven access."
            action={hasPermission("roles.create") ? <Button onClick={openCreate}>Create Role</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950/40">
                <tr>
                  {["Role", "Description", "Users Assigned", "Permissions", "Status", "Actions"].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                          <Shield className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{role.name}</p>
                          <p className="text-sm text-gray-500">{role.permissionsCount} permissions</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{role.description || "No description"}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{role.usersAssigned}</td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[280px] flex-wrap gap-2">
                        {role.permissions.slice(0, 4).map((permission) => (
                          <Badge key={permission} color="primary">
                            {permission}
                          </Badge>
                        ))}
                        {role.permissions.length > 4 ? <Badge color="light">+{role.permissions.length - 4} more</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge color={(role.status || "ACTIVE") === "ACTIVE" ? "success" : "warning"}>{role.status || "ACTIVE"}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <ActionMenu
                        onView={() => openEdit(role)}
                        onEdit={hasPermission("roles.update") ? () => openEdit(role) : undefined}
                        onDelete={hasPermission("roles.delete") ? () => {
                          setActiveRole(role);
                          setShowDelete(true);
                        } : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <Modal isOpen={showEditor} onClose={() => setShowEditor(false)} className="max-w-5xl p-0">
        <form onSubmit={saveRole} className="space-y-6 p-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeRole ? "Edit Role" : "Create Role"}
            </h3>
            <p className="text-sm text-gray-500">Define the role details, status, and permission matrix.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Role Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <Field label="Description" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
              <select
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
          </div>

          <section className="space-y-4 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">Permission Matrix</h4>
              <p className="text-sm text-gray-500">{form.permissionIds.length} permissions selected</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
                <div key={module} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 flex items-center justify-between">
                    <h5 className="font-semibold capitalize text-gray-900 dark:text-white">{module}</h5>
                    <Badge color="info">{modulePermissions.length} actions</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {modulePermissions.map((permission) => {
                      const checked = form.permissionIds.includes(String(permission.id));
                      return (
                        <label
                          key={permission.id}
                          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                            checked
                              ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                              : "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                          }`}
                        >
                          <input type="checkbox" checked={checked} onChange={() => togglePermission(permission.id)} />
                          <div>
                            <p className="font-medium">{permission.name}</p>
                            <p className="text-xs text-gray-500">{permission.description || permission.action}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {activeRole ? "Save Role" : "Create Role"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} className="max-w-lg p-0">
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-error-50 p-3 text-error-500 dark:bg-error-500/15">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Role</h3>
              <p className="text-sm text-gray-500">This removes the role and its assignment profile.</p>
            </div>
          </div>
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {activeRole?.name}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button isLoading={saving} onClick={deleteRole}>
              Delete Role
            </Button>
          </div>
        </div>
      </Modal>
    </AdminShell>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      />
    </label>
  );
}
