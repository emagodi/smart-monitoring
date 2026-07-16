import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Building2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";
import { AdminShell, DataCard, EmptyState, ToolbarCard } from "./AdminShared";

type UserType = {
  id: number;
  name: string;
  description?: string;
  status?: string;
  userCount: number;
};

type UserTypeForm = {
  name: string;
  description: string;
  status: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const defaultForm: UserTypeForm = {
  name: "",
  description: "",
  status: "ACTIVE",
};

export default function UserTypesPage() {
  const { token, hasPermission } = useAuth();
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ variant: "success" | "error" | "info" | "warning"; title: string; message: string } | null>(null);
  const [activeUserType, setActiveUserType] = useState<UserType | null>(null);
  const [form, setForm] = useState<UserTypeForm>(defaultForm);
  const [showEditor, setShowEditor] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const filteredUserTypes = useMemo(() => {
    const query = search.trim().toLowerCase();
    return userTypes.filter((userType) => {
      if (!query) return true;
      return (
        userType.name.toLowerCase().includes(query) ||
        (userType.description || "").toLowerCase().includes(query)
      );
    });
  }, [userTypes, search]);

  const pushNotice = (variant: "success" | "error" | "info" | "warning", title: string, message: string) => {
    setNotice({ variant, title, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const fetchUserTypes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get<UserType[]>(`${API_BASE_URL}/api/v1/admin/user-types`, { headers });
      setUserTypes(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error(error);
      pushNotice("error", "Load failed", "Could not load user types.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) fetchUserTypes();
  }, [token, fetchUserTypes]);

  const openCreate = () => {
    setActiveUserType(null);
    setForm(defaultForm);
    setShowEditor(true);
  };

  const openEdit = (userType: UserType) => {
    setActiveUserType(userType);
    setForm({
      name: userType.name,
      description: userType.description || "",
      status: userType.status || "ACTIVE",
    });
    setShowEditor(true);
  };

  const saveUserType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      pushNotice("warning", "Validation", "User type name is required.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        status: form.status,
      };

      if (activeUserType) {
        await axios.put(`${API_BASE_URL}/api/v1/admin/user-types/${activeUserType.id}`, payload, { headers });
        pushNotice("success", "User type updated", "User type changes were saved.");
      } else {
        await axios.post(`${API_BASE_URL}/api/v1/admin/user-types`, payload, { headers });
        pushNotice("success", "User type created", "The new user type is now available for user assignment.");
      }
      setShowEditor(false);
      await fetchUserTypes();
    } catch (error) {
      console.error(error);
      pushNotice("error", "Save failed", "Could not save the user type.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUserType = async () => {
    if (!activeUserType) return;
    try {
      setSaving(true);
      await axios.delete(`${API_BASE_URL}/api/v1/admin/user-types/${activeUserType.id}`, { headers });
      setShowDelete(false);
      setActiveUserType(null);
      await fetchUserTypes();
      pushNotice("success", "User type deleted", "The selected user type was removed.");
    } catch (error) {
      console.error(error);
      pushNotice("error", "Delete failed", "Could not delete the user type.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell
      title="User Types"
      description="Manage configurable user categories like ZESA and Supplier to support scoped dashboards and access rules."
      actions={
        <>
          <Button variant="outline" startIcon={<RefreshCw className="h-4 w-4" />} onClick={fetchUserTypes}>
            Refresh
          </Button>
          {hasPermission("usertypes.create") ? (
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Create User Type
            </Button>
          ) : null}
        </>
      }
      stats={[
        { label: "User Types", value: userTypes.length, tone: "blue" },
        { label: "Assigned Users", value: userTypes.reduce((sum, type) => sum + type.userCount, 0), tone: "green" },
        { label: "Active Types", value: userTypes.filter((type) => (type.status || "ACTIVE") === "ACTIVE").length, tone: "purple" },
        { label: "Supplier Scoped", value: userTypes.filter((type) => type.name.toLowerCase().includes("supplier")).length, tone: "amber" },
      ]}
    >
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <ToolbarCard>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search user types or descriptions"
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
        ) : filteredUserTypes.length === 0 ? (
          <EmptyState
            title="No user types configured"
            message="Create a user type to support scoped dashboards and differentiated access behavior."
            action={hasPermission("usertypes.create") ? <Button onClick={openCreate}>Create User Type</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950/40">
                <tr>
                  {["User Type", "Description", "Users", "Status", "Actions"].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredUserTypes.map((userType) => (
                  <tr key={userType.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{userType.name}</p>
                          <p className="text-sm text-gray-500">{userType.userCount} users assigned</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{userType.description || "No description"}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{userType.userCount}</td>
                    <td className="px-4 py-4">
                      <Badge color={(userType.status || "ACTIVE") === "ACTIVE" ? "success" : "warning"}>
                        {userType.status || "ACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <ActionMenu
                        onView={() => openEdit(userType)}
                        onEdit={hasPermission("usertypes.update") ? () => openEdit(userType) : undefined}
                        onDelete={hasPermission("usertypes.delete") ? () => {
                          setActiveUserType(userType);
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
        <form onSubmit={saveUserType} className="space-y-5 p-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {activeUserType ? "Edit User Type" : "Create User Type"}
            </h3>
            <p className="text-sm text-gray-500">Maintain configurable user categories for RBAC and dashboard scoping.</p>
          </div>
          <Field label="Name" value={form.name} onChange={(value) => setForm((current) => ({ ...current, name: value }))} />
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
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowEditor(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {activeUserType ? "Save User Type" : "Create User Type"}
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete User Type</h3>
              <p className="text-sm text-gray-500">Removing a user type affects user classification and dashboard scoping.</p>
            </div>
          </div>
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {activeUserType?.name}
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button isLoading={saving} onClick={deleteUserType}>
              Delete User Type
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
