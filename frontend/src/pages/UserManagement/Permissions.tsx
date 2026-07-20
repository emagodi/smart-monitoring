import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { KeySquare, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
    if (token) fetchPermissions();
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
      actions={
        <>
          <Button variant="outline" startIcon={<RefreshCw className="h-4 w-4" />} onClick={fetchPermissions}>
            Refresh
          </Button>
          {hasPermission("permissions.create") ? (
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Create Permission
            </Button>
          ) : null}
        </>
      }
      stats={[
        { label: "Permissions", value: permissions.length, tone: "blue" },
        { label: "Modules", value: new Set(permissions.map((permission) => permission.module)).size, tone: "purple" },
        { label: "Active", value: permissions.filter((permission) => (permission.status || "ACTIVE") === "ACTIVE").length, tone: "green" },
        { label: "Actions", value: new Set(permissions.map((permission) => permission.action)).size, tone: "amber" },
      ]}
    >
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <ToolbarCard>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search permission, module, action, or description"
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </label>
      </ToolbarCard>

      <DataCard>
        {loading ? (
          <div className="grid gap-4 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : filteredPermissions.length === 0 ? (
          <EmptyState
            title="No permissions found"
            message="Add the first permission to populate the RBAC catalog."
            action={hasPermission("permissions.create") ? <Button onClick={openCreate}>Create Permission</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950/40">
                <tr>
                  {["Permission", "Module", "Action", "Description", "Status", "Actions"].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredPermissions.map((permission) => (
                  <tr key={permission.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                          <KeySquare className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{permission.name}</p>
                          <p className="text-sm text-gray-500">{permission.module}.{permission.action}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge color="info">{permission.module}</Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{permission.action}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{permission.description || "No description"}</td>
                    <td className="px-4 py-4">
                      <Badge color={(permission.status || "ACTIVE") === "ACTIVE" ? "success" : "warning"}>
                        {permission.status || "ACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <ActionMenu
                        onView={() => openEdit(permission)}
                        onEdit={hasPermission("permissions.update") ? () => openEdit(permission) : undefined}
                        onDelete={hasPermission("permissions.delete") ? () => {
                          setActivePermission(permission);
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

      <Modal isOpen={showEditor} onClose={() => setShowEditor(false)} className="max-w-2xl p-0">
        <form onSubmit={savePermission} className="space-y-5 p-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activePermission ? "Edit Permission" : "Create Permission"}
            </h3>
            <p className="text-sm text-gray-500">Define the RBAC permission metadata used by roles and routes.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Permission Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
            <Field label="Module" value={form.module} onChange={(value) => setForm((current) => ({ ...current, module: value }))} />
            <Field label="Action" value={form.action} onChange={(value) => setForm((current) => ({ ...current, action: value }))} />
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
          <Field label="Description" value={form.description} onChange={(value) => setForm((current) => ({ ...current, description: value }))} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {activePermission ? "Save Permission" : "Create Permission"}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Permission</h3>
              <p className="text-sm text-gray-500">Removing a permission may affect assigned roles.</p>
            </div>
          </div>
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {activePermission?.name}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button isLoading={saving} onClick={deletePermission}>
              Delete Permission
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
