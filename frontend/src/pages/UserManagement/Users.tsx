import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Eye, KeyRound, Pencil, Plus, Power, RefreshCw, Search, ShieldCheck, Trash2, UserCog, Users2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import Alert from "../../components/ui/alert/Alert";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";
import { AdminShell, DataCard, EmptyState, ToolbarCard } from "./AdminShared";

type AdminUser = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  employeeNumber?: string;
  status?: string;
  userType?: string;
  userTypeId?: number | null;
  supplierId?: number | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  roles: string[];
  roleIds: number[];
  region?: string;
  district?: string;
  depot?: string;
  lastLoginAt?: string | null;
  createdDate?: string | null;
};

type RoleOption = {
  id: number;
  name: string;
};

type UserTypeOption = {
  id: number;
  name: string;
};

type SupplierOption = {
  id: number;
  code: string;
  name: string;
};

type UserFormState = {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  employeeNumber: string;
  password: string;
  status: string;
  userTypeId: string;
  supplierId: string;
  roleIds: string[];
  region: string;
  district: string;
  depot: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const defaultFormState: UserFormState = {
  firstname: "",
  lastname: "",
  email: "",
  phone: "",
  employeeNumber: "",
  password: "",
  status: "ACTIVE",
  userTypeId: "",
  supplierId: "",
  roleIds: [],
  region: "",
  district: "",
  depot: "",
};

const formatDate = (value?: string | null) => {
  if (!value) return "Never";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const resolveApiMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    if (typeof payload === "string" && payload.trim()) {
      return payload;
    }
    if (payload && typeof payload === "object" && "message" in payload) {
      const message = (payload as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }
  return fallback;
};

export default function Users() {
  const { token, hasPermission } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: "success" | "error" | "info" | "warning"; title: string; message: string } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [userTypeFilter, setUserTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null);
  const [formState, setFormState] = useState<UserFormState>(defaultFormState);
  const [showEditor, setShowEditor] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [bulkRoleId, setBulkRoleId] = useState("");
  const [resetPassword, setResetPassword] = useState("Password@123");

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const selectedUserTypeName = useMemo(
    () => userTypes.find((item) => String(item.id) === formState.userTypeId)?.name || "",
    [formState.userTypeId, userTypes]
  );
  const isSupplierUserType = selectedUserTypeName.toLowerCase() === "supplier";

  const showNotice = (variant: "success" | "error" | "info" | "warning", title: string, message: string) => {
    setNotice({ variant, title, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersResponse, rolesResponse, userTypesResponse, suppliersResponse] = await Promise.all([
        axios.get<AdminUser[]>(`${API_BASE_URL}/api/v1/admin/users`, { headers }),
        axios.get<RoleOption[]>(`${API_BASE_URL}/api/v1/admin/roles`, { headers }),
        axios.get<UserTypeOption[]>(`${API_BASE_URL}/api/v1/admin/user-types`, { headers }),
        axios.get<SupplierOption[]>(`${API_BASE_URL}/api/v1/admin/suppliers`, { headers }),
      ]);

      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setRoles(Array.isArray(rolesResponse.data) ? rolesResponse.data : []);
      setUserTypes(Array.isArray(userTypesResponse.data) ? userTypesResponse.data : []);
      setSuppliers(Array.isArray(suppliersResponse.data) ? suppliersResponse.data : []);
    } catch (fetchError) {
      setError("Failed to load administration users.");
      console.error(fetchError);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (token) {
      fetchAll();
    }
  }, [token, fetchAll]);

  useEffect(() => {
    if (!isSupplierUserType && formState.supplierId) {
      setFormState((current) => ({ ...current, supplierId: "" }));
    }
  }, [formState.supplierId, isSupplierUserType]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !query ||
        `${user.firstname} ${user.lastname}`.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.employeeNumber || "").toLowerCase().includes(query) ||
        (user.phone || "").toLowerCase().includes(query) ||
        (user.supplierName || "").toLowerCase().includes(query);
      const matchesRole = roleFilter === "ALL" || user.roles.includes(roleFilter);
      const matchesUserType = userTypeFilter === "ALL" || user.userType === userTypeFilter;
      const matchesStatus = statusFilter === "ALL" || (user.status || "ACTIVE") === statusFilter;
      return matchesSearch && matchesRole && matchesUserType && matchesStatus;
    });
  }, [users, search, roleFilter, userTypeFilter, statusFilter]);

  const activeCount = users.filter((user) => (user.status || "ACTIVE") === "ACTIVE").length;
  const adminCount = users.filter((user) => user.roles.includes("Administrator")).length;

  const resetForm = () => {
    setFormState(defaultFormState);
    setActiveUser(null);
  };

  const openCreate = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEdit = (user: AdminUser) => {
    setActiveUser(user);
    setFormState({
      firstname: user.firstname || "",
      lastname: user.lastname || "",
      email: user.email || "",
      phone: user.phone || "",
      employeeNumber: user.employeeNumber || "",
      password: "",
      status: user.status || "ACTIVE",
      userTypeId: user.userTypeId ? String(user.userTypeId) : "",
      supplierId: user.supplierId ? String(user.supplierId) : "",
      roleIds: (user.roleIds || []).map((value) => String(value)),
      region: user.region || "",
      district: user.district || "",
      depot: user.depot || "",
    });
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    resetForm();
  };

  const updateForm = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const submitUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formState.firstname.trim() || !formState.lastname.trim() || !formState.email.trim()) {
      showNotice("warning", "Validation", "First name, last name, and email are required.");
      return;
    }
    if (!activeUser && !formState.password.trim()) {
      showNotice("warning", "Validation", "Set an initial password for the new user.");
      return;
    }
    if (formState.roleIds.length === 0) {
      showNotice("warning", "Validation", "Assign at least one role.");
      return;
    }
    if (isSupplierUserType && !formState.supplierId) {
      showNotice("warning", "Validation", "Select a supplier for supplier-scoped users.");
      return;
    }

    const payload = {
      firstname: formState.firstname.trim(),
      lastname: formState.lastname.trim(),
      email: formState.email.trim(),
      phone: formState.phone.trim(),
      employeeNumber: formState.employeeNumber.trim(),
      password: formState.password.trim() || undefined,
      status: formState.status,
      userTypeId: formState.userTypeId ? Number(formState.userTypeId) : null,
      supplierId: formState.supplierId ? Number(formState.supplierId) : null,
      roleIds: formState.roleIds.map(Number),
      region: formState.region.trim(),
      district: formState.district.trim(),
      depot: formState.depot.trim(),
    };

    try {
      setSaving(true);
      if (activeUser) {
        await axios.put(`${API_BASE_URL}/api/v1/admin/users/${activeUser.id}`, payload, { headers });
        showNotice("success", "User updated", "User details were saved successfully.");
      } else {
        await axios.post(`${API_BASE_URL}/api/v1/admin/users`, payload, { headers });
        showNotice("success", "User created", "The new user is ready for access assignment.");
      }
      closeEditor();
      await fetchAll();
    } catch (submitError) {
      console.error(submitError);
      showNotice("error", "Save failed", resolveApiMessage(submitError, "Could not save the user. Please review the entered values."));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (userId: number, status: "ACTIVE" | "INACTIVE") => {
    try {
      await axios.patch(`${API_BASE_URL}/api/v1/admin/users/${userId}/status?status=${status}`, null, { headers });
      await fetchAll();
      showNotice("success", "Status updated", `User is now ${status.toLowerCase()}.`);
    } catch (statusError) {
      console.error(statusError);
      showNotice("error", "Status update failed", "Could not update the user status.");
    }
  };

  const confirmDelete = async () => {
    if (!activeUser) return;
    try {
      setSaving(true);
      await axios.delete(`${API_BASE_URL}/api/v1/admin/users/${activeUser.id}`, { headers });
      setShowDelete(false);
      setActiveUser(null);
      setSelectedIds((current) => current.filter((id) => id !== activeUser.id));
      await fetchAll();
      showNotice("success", "User deleted", "The user was removed from the system.");
    } catch (deleteError) {
      console.error(deleteError);
      showNotice("error", "Delete failed", "Could not delete the selected user.");
    } finally {
      setSaving(false);
    }
  };

  const submitPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeUser || !resetPassword.trim()) return;
    try {
      setSaving(true);
      await axios.post(
        `${API_BASE_URL}/api/v1/admin/users/${activeUser.id}/reset-password`,
        { password: resetPassword.trim() },
        { headers }
      );
      setShowResetPassword(false);
      setResetPassword("Password@123");
      showNotice("success", "Password reset", "The user can now log in with the new password.");
    } catch (passwordError) {
      console.error(passwordError);
      showNotice("error", "Reset failed", "Could not reset the user password.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (userId: number) => {
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const bulkAssignRole = async () => {
    if (!bulkRoleId || selectedIds.length === 0) return;
    try {
      setSaving(true);
      await Promise.all(
        selectedIds.map((userId) =>
          axios.patch(
            `${API_BASE_URL}/api/v1/admin/users/${userId}/roles`,
            { roleIds: [Number(bulkRoleId)] },
            { headers }
          )
        )
      );
      setBulkRoleId("");
      setSelectedIds([]);
      await fetchAll();
      showNotice("success", "Roles assigned", "Selected users were updated with the chosen role.");
    } catch (bulkError) {
      console.error(bulkError);
      showNotice("error", "Bulk assign failed", "Could not assign the selected role.");
    } finally {
      setSaving(false);
    }
  };

  const selectedUsers = users.filter((user) => selectedIds.includes(user.id));

  return (
    <AdminShell
      title="Users"
      description="Manage all system users, assign multiple roles, and control account status from a single administration workspace."
      actions={
        <>
          <Button variant="outline" startIcon={<RefreshCw className="h-4 w-4" />} onClick={fetchAll}>
            Refresh
          </Button>
          {hasPermission("users.create") ? (
            <Button startIcon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Create User
            </Button>
          ) : null}
        </>
      }
      stats={[
        { label: "Total Users", value: users.length, tone: "blue" },
        { label: "Active Users", value: activeCount, tone: "green" },
        { label: "Administrators", value: adminCount, tone: "purple" },
        { label: "User Types", value: userTypes.length, tone: "amber" },
      ]}
    >
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <ToolbarCard>
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr,1fr,1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, employee number, or phone"
              className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="ALL">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.name}>
                {role.name}
              </option>
            ))}
          </select>

          <select
            value={userTypeFilter}
            onChange={(event) => setUserTypeFilter(event.target.value)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="ALL">All User Types</option>
            {userTypes.map((type) => (
              <option key={type.id} value={type.name}>
                {type.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {selectedIds.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-500/10 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
              {selectedIds.length} users selected for bulk actions
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={bulkRoleId}
                onChange={(event) => setBulkRoleId(event.target.value)}
                className="h-10 rounded-xl border border-brand-200 bg-white px-3 text-sm text-gray-700 outline-none dark:border-brand-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Assign role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={bulkAssignRole} disabled={!bulkRoleId || saving}>
                Assign Role
              </Button>
              <Button variant="outline" onClick={() => Promise.all(selectedIds.map((id) => updateStatus(id, "ACTIVE")))} disabled={saving}>
                Enable
              </Button>
              <Button variant="outline" onClick={() => Promise.all(selectedIds.map((id) => updateStatus(id, "INACTIVE")))} disabled={saving}>
                Disable
              </Button>
            </div>
          </div>
        ) : null}
      </ToolbarCard>

      <DataCard>
        {loading ? (
          <div className="grid gap-4 p-6">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        ) : error ? (
          <div className="p-6">
            <Alert variant="error" title="Failed to load users" message={error} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            message="Try adjusting your search and filters, or create the first user for this administration scope."
            action={hasPermission("users.create") ? <Button onClick={openCreate}>Create User</Button> : null}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                    <input
                      type="checkbox"
                      checked={selectedIds.length > 0 && selectedIds.length === filteredUsers.length}
                      onChange={(event) =>
                        setSelectedIds(event.target.checked ? filteredUsers.map((user) => user.id) : [])
                      }
                    />
                  </th>
                  {["User", "Employee #", "Contact", "User Type", "Organisation", "Roles", "Status", "Last Login", "Created", "Actions"].map((label) => (
                    <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-4">
                      <input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => toggleSelection(user.id)} />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                          {`${user.firstname?.[0] || ""}${user.lastname?.[0] || ""}`.toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.firstname} {user.lastname}
                          </p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{user.employeeNumber || "N/A"}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{user.phone || "N/A"}</td>
                    <td className="px-4 py-4">
                      <Badge color="info">{user.userType || "Unassigned"}</Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {user.supplierName || "Internal"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex max-w-[220px] flex-wrap gap-2">
                        {user.roles.length > 0 ? user.roles.map((role) => <Badge key={role} color="primary">{role}</Badge>) : <Badge color="light">No role</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Badge color={(user.status || "ACTIVE") === "ACTIVE" ? "success" : "warning"}>
                        {user.status || "ACTIVE"}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(user.createdDate)}</td>
                    <td className="px-4 py-4">
                      <ActionMenu
                        onView={() => {
                          setActiveUser(user);
                          setShowViewer(true);
                        }}
                        onEdit={hasPermission("users.update") ? () => openEdit(user) : undefined}
                        onDelete={hasPermission("users.delete") ? () => {
                          setActiveUser(user);
                          setShowDelete(true);
                        } : undefined}
                        extras={[
                          ...(hasPermission("users.reset.password")
                            ? [{
                                label: "Reset Password",
                                onClick: () => {
                                  setActiveUser(user);
                                  setResetPassword("Password@123");
                                  setShowResetPassword(true);
                                },
                                icon: <KeyRound className="h-4 w-4" />,
                              }]
                            : []),
                          ...(hasPermission("users.assign.role")
                            ? [{
                                label: "Assign Roles",
                                onClick: () => openEdit(user),
                                icon: <ShieldCheck className="h-4 w-4" />,
                              }]
                            : []),
                          ...(hasPermission("users.update")
                            ? [{
                                label: (user.status || "ACTIVE") === "ACTIVE" ? "Disable" : "Enable",
                                onClick: () => updateStatus(user.id, (user.status || "ACTIVE") === "ACTIVE" ? "INACTIVE" : "ACTIVE"),
                                icon: <Power className="h-4 w-4" />,
                              }]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <Modal isOpen={showEditor} onClose={closeEditor} className="max-w-4xl p-0">
        <form onSubmit={submitUser} className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {activeUser ? "Edit User" : "Create User"}
              </h3>
              <p className="text-sm text-gray-500">
                Configure personal details, access, user type, and role membership.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-4 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <header className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Users2 className="h-4 w-4 text-brand-500" />
                Personal Information
              </header>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="First Name" value={formState.firstname} onChange={(value) => updateForm("firstname", value)} />
                <Field label="Last Name" value={formState.lastname} onChange={(value) => updateForm("lastname", value)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Email" type="email" value={formState.email} onChange={(value) => updateForm("email", value)} />
                <Field label="Phone" value={formState.phone} onChange={(value) => updateForm("phone", value)} />
              </div>
              <Field label="Employee Number" value={formState.employeeNumber} onChange={(value) => updateForm("employeeNumber", value)} />
            </section>

            <section className="space-y-4 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
              <header className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <UserCog className="h-4 w-4 text-brand-500" />
                Account & Access
              </header>
              <Field
                label={activeUser ? "New Password (optional)" : "Password"}
                type="password"
                value={formState.password}
                onChange={(value) => updateForm("password", value)}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField
                  label="User Type"
                  value={formState.userTypeId}
                  onChange={(value) => updateForm("userTypeId", value)}
                  options={userTypes.map((item) => ({ value: String(item.id), label: item.name }))}
                />
                <SelectField
                  label="Status"
                  value={formState.status}
                  onChange={(value) => updateForm("status", value)}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
              </div>
              {isSupplierUserType ? (
                <div className="space-y-2">
                  <SelectField
                    label="Supplier"
                    value={formState.supplierId}
                    onChange={(value) => updateForm("supplierId", value)}
                    options={suppliers.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                  />
                  <p className="text-xs text-gray-500">
                    Supplier users are restricted to devices, transformers, alerts, and other records owned by the selected organisation.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Roles</label>
                <div className="grid gap-3 md:grid-cols-2">
                  {roles.map((role) => {
                    const checked = formState.roleIds.includes(String(role.id));
                    return (
                      <label
                        key={role.id}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                            : "border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            updateForm(
                              "roleIds",
                              checked
                                ? formState.roleIds.filter((id) => id !== String(role.id))
                                : [...formState.roleIds, String(role.id)]
                            )
                          }
                        />
                        <span>{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          <section className="space-y-4 rounded-2xl border border-gray-200 p-5 dark:border-gray-800">
            <header className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <ShieldCheck className="h-4 w-4 text-brand-500" />
              Scope & Location
            </header>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Region" value={formState.region} onChange={(value) => updateForm("region", value)} />
              <Field label="District" value={formState.district} onChange={(value) => updateForm("district", value)} />
              <Field label="Depot" value={formState.depot} onChange={(value) => updateForm("depot", value)} />
            </div>
          </section>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {activeUser ? "Save User" : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showViewer} onClose={() => setShowViewer(false)} className="max-w-2xl p-0">
        {activeUser ? (
          <div className="space-y-6 p-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {activeUser.firstname} {activeUser.lastname}
              </h3>
              <p className="text-sm text-gray-500">{activeUser.email}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InfoItem label="Employee Number" value={activeUser.employeeNumber || "N/A"} />
              <InfoItem label="Phone" value={activeUser.phone || "N/A"} />
              <InfoItem label="User Type" value={activeUser.userType || "Unassigned"} />
              <InfoItem label="Organisation" value={activeUser.supplierName || "Internal"} />
              <InfoItem label="Status" value={activeUser.status || "ACTIVE"} />
              <InfoItem label="Region" value={activeUser.region || "N/A"} />
              <InfoItem label="District" value={activeUser.district || "N/A"} />
              <InfoItem label="Depot" value={activeUser.depot || "N/A"} />
              <InfoItem label="Last Login" value={formatDate(activeUser.lastLoginAt)} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned Roles</p>
              <div className="flex flex-wrap gap-2">
                {activeUser.roles.map((role) => (
                  <Badge key={role} color="primary">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} className="max-w-lg p-0">
        <div className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-error-50 p-3 text-error-500 dark:bg-error-500/15">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete User</h3>
              <p className="text-sm text-gray-500">This action permanently removes the selected user account.</p>
            </div>
          </div>
          <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {activeUser ? `${activeUser.firstname} ${activeUser.lastname} (${activeUser.email})` : ""}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowDelete(false)}>
              Cancel
            </Button>
            <Button isLoading={saving} onClick={confirmDelete}>
              Delete User
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showResetPassword} onClose={() => setShowResetPassword(false)} className="max-w-lg p-0">
        <form onSubmit={submitPasswordReset} className="space-y-5 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-brand-50 p-3 text-brand-500 dark:bg-brand-500/15">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Reset Password</h3>
              <p className="text-sm text-gray-500">
                Set a new password for {activeUser?.firstname} {activeUser?.lastname}.
              </p>
            </div>
          </div>
          <Field label="New Password" type="password" value={resetPassword} onChange={setResetPassword} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowResetPassword(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Reset Password
            </Button>
          </div>
        </form>
      </Modal>
    </AdminShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
      >
        <option value="">Select {label}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 px-4 py-3 dark:border-gray-800">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">{label}</p>
      <p className="mt-2 text-sm text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}
