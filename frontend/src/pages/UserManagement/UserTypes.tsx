import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Building2, Loader2, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";
import { AdminShell, EmptyState } from "./AdminShared";

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

  const activeTypesCount = useMemo(
    () => userTypes.filter((type) => (type.status || "ACTIVE") === "ACTIVE").length,
    [userTypes]
  );

  const topAssignedTypes = useMemo(
    () => userTypes.slice().sort((a, b) => b.userCount - a.userCount).slice(0, 4),
    [userTypes]
  );

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
    if (token) void fetchUserTypes();
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

  const openDelete = (userType: UserType) => {
    setActiveUserType(userType);
    setShowDelete(true);
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
      stats={[
        { label: "User Types", value: userTypes.length, tone: "blue" },
        { label: "Assigned Users", value: userTypes.reduce((sum, type) => sum + type.userCount, 0), tone: "green" },
        { label: "Active Types", value: activeTypesCount, tone: "purple" },
        { label: "Supplier Scoped", value: userTypes.filter((type) => type.name.toLowerCase().includes("supplier")).length, tone: "amber" },
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
                Type portfolio health
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {[
              ["Active user types", activeTypesCount],
              ["Inactive user types", userTypes.length - activeTypesCount],
              ["Assigned users", userTypes.reduce((sum, type) => sum + type.userCount, 0)],
              ["Supplier scoped", userTypes.filter((type) => type.name.toLowerCase().includes("supplier")).length],
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
              Most used classifications
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {topAssignedTypes.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No user type assignments are available yet.
              </div>
            ) : (
              topAssignedTypes.map((userType) => {
                const totalUsers = userTypes.reduce((sum, type) => sum + type.userCount, 0);
                const width = totalUsers ? (userType.userCount / totalUsers) * 100 : 0;

                return (
                  <div key={userType.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {userType.name}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {userType.userCount} users
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                        style={{ width: `${Math.max(width, userType.userCount > 0 ? 8 : 0)}%` }}
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
              Status Mix
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Readiness for assignment
            </h3>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs text-slate-500 dark:text-slate-400">Assignment coverage</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                {userTypes.filter((type) => type.userCount > 0).length}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                User types currently in use across the platform
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs text-slate-500 dark:text-slate-400">Unassigned templates</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">
                {userTypes.filter((type) => type.userCount === 0).length}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Categories ready to be used in future onboarding
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="enterprise-card overflow-hidden">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  User Type Directory
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  Classification and access scope
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Manage configurable user categories that shape dashboard scope and operational behavior.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchUserTypes()}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
                {hasPermission("usertypes.create") ? (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create User Type
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
                  placeholder="Search user types or descriptions"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            <div className="enterprise-chip inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {filteredUserTypes.length}
              </span>
              matching types
            </div>
          </div>
        </div>

          {loading ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 animate-pulse rounded-[22px] bg-slate-100 dark:bg-slate-800"
                />
              ))}
            </div>
          ) : filteredUserTypes.length === 0 ? (
            <EmptyState
              title="No user types configured"
              message="Create a user type to support scoped dashboards and differentiated access behavior."
              action={hasPermission("usertypes.create") ? <Button onClick={openCreate}>Create User Type</Button> : null}
            />
          ) : (
            <div className="overflow-x-auto p-4 pt-0">
              <table className="min-w-full border-separate border-spacing-y-2.5">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                    <th className="px-3 py-2.5">User Type</th>
                    <th className="px-3 py-2.5">Description</th>
                    <th className="px-3 py-2.5">Users</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUserTypes.map((userType) => {
                    const status = userType.status || "ACTIVE";

                    return (
                      <tr key={userType.id} className="enterprise-subtle-card">
                        <td className="rounded-l-[22px] px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                              <Building2 className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                                {userType.name}
                              </p>
                              <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                                {userType.userCount} assigned user{userType.userCount === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
                            {userType.description || "No description added for this user type yet."}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1.5">
                            <div
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                userType.userCount > 0
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {userType.userCount} user{userType.userCount === 1 ? "" : "s"}
                            </div>
                            <p className="text-[12px] text-slate-400 dark:text-slate-500">
                              Current classification footprint
                            </p>
                          </div>
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
                              {status === "ACTIVE" ? "Available for new assignments" : "Held out of new assignments"}
                            </span>
                          </div>
                        </td>
                        <td className="rounded-r-[22px] px-3 py-3 text-right">
                          <ActionMenu
                            placement="bottom-end"
                            onView={() => openEdit(userType)}
                            onEdit={hasPermission("usertypes.update") ? () => openEdit(userType) : undefined}
                            onDelete={hasPermission("usertypes.delete") ? () => openDelete(userType) : undefined}
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

      <UserTypeEditorModal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        onSubmit={saveUserType}
        activeUserType={activeUserType}
        form={form}
        saving={saving}
        onUpdate={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
      />

      <UserTypeDeleteModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={deleteUserType}
        userType={activeUserType}
        deleting={saving}
      />
    </AdminShell>
  );
}

function UserTypeEditorModal({
  open,
  onClose,
  onSubmit,
  activeUserType,
  form,
  saving,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  activeUserType: UserType | null;
  form: UserTypeForm;
  saving: boolean;
  onUpdate: <K extends keyof UserTypeForm>(key: K, value: UserTypeForm[K]) => void;
}) {
  const isEdit = Boolean(activeUserType);

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
                {isEdit ? <Building2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  {isEdit ? "Edit User Type" : "Create User Type"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {isEdit ? "Update user classification" : "Add a new user classification"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Keep classification rules and dashboard scope definitions in a centered modal workflow.
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
              <SummaryPill label="Assigned users" value={String(activeUserType?.userCount ?? 0)} />
              <SummaryPill label="Status" value={form.status} />
            </div>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                  User Type Information
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Classification details
                </h4>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <TextField
                  label="Name"
                  value={form.name}
                  onChange={(value) => onUpdate("name", value)}
                  placeholder="Enter user type name"
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
                  placeholder="Describe the access scope for this user type"
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
                className="inline-flex min-w-[166px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving
                  ? isEdit
                    ? "Saving..."
                    : "Creating..."
                  : isEdit
                    ? "Save User Type"
                    : "Create User Type"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function UserTypeDeleteModal({
  open,
  onClose,
  onConfirm,
  userType,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userType: UserType | null;
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
        <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete User Type?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Remove <span className="font-semibold text-slate-950 dark:text-slate-50">{userType?.name || "this user type"}</span>. Existing user classification and dashboard scoping may need review.
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
            {deleting ? "Deleting..." : "Delete User Type"}
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
