import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Building2,
  KeyRound,
  Loader2,
  Plus,
  Power,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users2,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Alert from "../../components/ui/alert/Alert";
import { Modal } from "../../components/ui/modal";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";

type AdminUser = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  whatsappNumber?: string;
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

type LocationOption = {
  id: number;
  name: string;
};

type UserFormState = {
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  whatsappNumber: string;
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
  whatsappNumber: "",
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
  const initialLoadTokenRef = useRef<string | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [userTypes, setUserTypes] = useState<UserTypeOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [regionOptions, setRegionOptions] = useState<LocationOption[]>([]);
  const [districtOptions, setDistrictOptions] = useState<LocationOption[]>([]);
  const [depotOptions, setDepotOptions] = useState<LocationOption[]>([]);
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

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );
  const selectedUserTypeName = useMemo(
    () => userTypes.find((item) => String(item.id) === formState.userTypeId)?.name || "",
    [formState.userTypeId, userTypes]
  );
  const isSupplierUserType = selectedUserTypeName.toLowerCase() === "supplier";

  const showNotice = (variant: "success" | "error" | "info" | "warning", title: string, message: string) => {
    setNotice({ variant, title, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const normalizeLocationOptions = (payload: unknown): LocationOption[] => {
    if (Array.isArray(payload)) return payload as LocationOption[];

    const response = payload as Record<string, unknown>;
    const candidates = ["content", "data", "items", "records"];
    for (const key of candidates) {
      const value = response?.[key];
      if (Array.isArray(value)) return value as LocationOption[];
    }

    return [];
  };

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersResponse, rolesResponse, userTypesResponse, suppliersResponse, regionsResponse] = await Promise.all([
        axios.get<AdminUser[]>(`${API_BASE_URL}/api/v1/admin/users`, { headers }),
        axios.get<RoleOption[]>(`${API_BASE_URL}/api/v1/admin/roles`, { headers }),
        axios.get<UserTypeOption[]>(`${API_BASE_URL}/api/v1/admin/user-types`, { headers }),
        axios.get<SupplierOption[]>(`${API_BASE_URL}/api/v1/admin/suppliers`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/regions?page=0&size=1000`, { headers }),
      ]);

      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      setRoles(Array.isArray(rolesResponse.data) ? rolesResponse.data : []);
      setUserTypes(Array.isArray(userTypesResponse.data) ? userTypesResponse.data : []);
      setSuppliers(Array.isArray(suppliersResponse.data) ? suppliersResponse.data : []);
      setRegionOptions(normalizeLocationOptions(regionsResponse.data));
    } catch (fetchError) {
      setError("Failed to load administration users.");
      console.error(fetchError);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    if (!token) {
      initialLoadTokenRef.current = null;
      return;
    }

    if (initialLoadTokenRef.current === token) return;

    initialLoadTokenRef.current = token;
    void fetchAll();
  }, [token, fetchAll]);

  useEffect(() => {
    if (!isSupplierUserType && formState.supplierId) {
      setFormState((current) => ({ ...current, supplierId: "" }));
    }
  }, [formState.supplierId, isSupplierUserType]);

  useEffect(() => {
    if (isSupplierUserType && (formState.region || formState.district || formState.depot)) {
      setFormState((current) => ({
        ...current,
        region: "",
        district: "",
        depot: "",
      }));
    }
  }, [formState.depot, formState.district, formState.region, isSupplierUserType]);

  const fetchDistrictOptions = useCallback(
    async (regionId: number) => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/districts/region/${regionId}`, { headers });
        const list = normalizeLocationOptions(response.data);
        setDistrictOptions(list);
        return list;
      } catch (locationError) {
        console.error(locationError);
        setDistrictOptions([]);
        return [];
      }
    },
    [headers]
  );

  const fetchDepotOptions = useCallback(
    async (districtId: number) => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/v1/depots/district/${districtId}`, { headers });
        const list = normalizeLocationOptions(response.data);
        setDepotOptions(list);
        return list;
      } catch (locationError) {
        console.error(locationError);
        setDepotOptions([]);
        return [];
      }
    },
    [headers]
  );

  useEffect(() => {
    if (!showEditor || isSupplierUserType || !formState.region) {
      setDistrictOptions([]);
      setDepotOptions([]);
      return;
    }

    const selectedRegion = regionOptions.find((region) => region.name === formState.region);
    if (!selectedRegion) {
      setDistrictOptions([]);
      setDepotOptions([]);
      return;
    }

    void fetchDistrictOptions(selectedRegion.id);
  }, [fetchDistrictOptions, formState.region, isSupplierUserType, regionOptions, showEditor]);

  useEffect(() => {
    if (!showEditor || isSupplierUserType || !formState.district) {
      setDepotOptions([]);
      return;
    }

    const selectedDistrict = districtOptions.find((district) => district.name === formState.district);
    if (!selectedDistrict) {
      setDepotOptions([]);
      return;
    }

    void fetchDepotOptions(selectedDistrict.id);
  }, [districtOptions, fetchDepotOptions, formState.district, isSupplierUserType, showEditor]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !query ||
        `${user.firstname} ${user.lastname}`.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        (user.employeeNumber || "").toLowerCase().includes(query) ||
        (user.phone || "").toLowerCase().includes(query) ||
        (user.whatsappNumber || "").toLowerCase().includes(query) ||
        (user.supplierName || "").toLowerCase().includes(query);
      const matchesRole = roleFilter === "ALL" || user.roles.includes(roleFilter);
      const matchesUserType = userTypeFilter === "ALL" || user.userType === userTypeFilter;
      const matchesStatus = statusFilter === "ALL" || (user.status || "ACTIVE") === statusFilter;
      return matchesSearch && matchesRole && matchesUserType && matchesStatus;
    });
  }, [users, search, roleFilter, userTypeFilter, statusFilter]);

  const activeCount = users.filter((user) => (user.status || "ACTIVE") === "ACTIVE").length;
  const inactiveCount = users.length - activeCount;
  const adminCount = users.filter((user) => user.roles.includes("Administrator")).length;
  const supplierUsersCount = users.filter((user) => (user.userType || "").toLowerCase() === "supplier").length;
  const hasFilters =
    search.trim().length > 0 ||
    roleFilter !== "ALL" ||
    userTypeFilter !== "ALL" ||
    statusFilter !== "ALL";

  const resetForm = () => {
    setFormState(defaultFormState);
    setActiveUser(null);
    setDistrictOptions([]);
    setDepotOptions([]);
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
      whatsappNumber: user.whatsappNumber || "",
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

  const handleRegionChange = async (value: string) => {
    setFormState((current) => ({
      ...current,
      region: value,
      district: "",
      depot: "",
    }));

    setDepotOptions([]);

    const selectedRegion = regionOptions.find((region) => region.name === value);
    if (!selectedRegion) {
      setDistrictOptions([]);
      return;
    }

    await fetchDistrictOptions(selectedRegion.id);
  };

  const handleDistrictChange = async (value: string) => {
    setFormState((current) => ({
      ...current,
      district: value,
      depot: "",
    }));

    const selectedDistrict = districtOptions.find((district) => district.name === value);
    if (!selectedDistrict) {
      setDepotOptions([]);
      return;
    }

    await fetchDepotOptions(selectedDistrict.id);
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
      whatsappNumber: formState.whatsappNumber.trim(),
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

  const bulkUpdateStatus = async (status: "ACTIVE" | "INACTIVE") => {
    if (selectedIds.length === 0) return;
    try {
      setSaving(true);
      await Promise.all(
        selectedIds.map((userId) =>
          axios.patch(`${API_BASE_URL}/api/v1/admin/users/${userId}/status?status=${status}`, null, { headers })
        )
      );
      await fetchAll();
      showNotice(
        "success",
        status === "ACTIVE" ? "Users enabled" : "Users disabled",
        `Selected users are now ${status.toLowerCase()}.`
      );
    } catch (bulkStatusError) {
      console.error(bulkStatusError);
      showNotice("error", "Bulk status update failed", "Could not update the selected user statuses.");
    } finally {
      setSaving(false);
    }
  };

  const selectedUsers = useMemo(
    () => users.filter((user) => selectedIds.includes(user.id)),
    [selectedIds, users]
  );
  const focusUser = activeUser ?? selectedUsers[0] ?? filteredUsers[0] ?? users[0] ?? null;
  const canCreate = hasPermission("users.create");
  const canUpdate = hasPermission("users.update");
  const canDelete = hasPermission("users.delete");
  const canResetPassword = hasPermission("users.reset.password");
  const canAssignRole = hasPermission("users.assign.role");
  const selectedAllVisible =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user.id));

  return (
    <div className="space-y-4">
      <PageBreadcrumb pageTitle="Users" />
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Users",
            value: users.length,
            subtitle: "Accounts in the administration workspace",
            tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300",
            icon: <Users2 className="h-6 w-6" />,
          },
          {
            label: "Active Users",
            value: activeCount,
            subtitle: `${inactiveCount} inactive account${inactiveCount === 1 ? "" : "s"}`,
            tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300",
            icon: <ShieldCheck className="h-6 w-6" />,
          },
          {
            label: "Administrators",
            value: adminCount,
            subtitle: "Users with elevated administration access",
            tone: "bg-violet-50 text-violet-600 dark:bg-violet-500/14 dark:text-violet-300",
            icon: <UserCog className="h-6 w-6" />,
          },
          {
            label: "Supplier Users",
            value: supplierUsersCount,
            subtitle: `${userTypes.length} configured user type${userTypes.length === 1 ? "" : "s"}`,
            tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300",
            icon: <Building2 className="h-6 w-6" />,
          },
        ].map((card) => (
          <div key={card.label} className="enterprise-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {card.value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{card.subtitle}</p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.tone}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Workspace Summary
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                Account posture overview
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[repeat(5,minmax(0,0.7fr))_minmax(0,1.5fr)]">
            <SummaryTile label="Visible users" value={filteredUsers.length} />
            <SummaryTile label="Selected users" value={selectedIds.length} />
            <SummaryTile label="Active accounts" value={activeCount} />
            <SummaryTile label="Inactive accounts" value={inactiveCount} />
            <SummaryTile label="User types" value={userTypes.length} />

            {focusUser ? (
              <div className="enterprise-subtle-card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">In Focus</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                    {`${focusUser.firstname?.[0] || ""}${focusUser.lastname?.[0] || ""}`.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {focusUser.firstname} {focusUser.lastname}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{focusUser.email}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <StatusPill status={(focusUser.status || "ACTIVE") as "ACTIVE" | "INACTIVE"} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="enterprise-subtle-card px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">In Focus</p>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No user selected</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="enterprise-card flex max-h-[70vh] min-h-0 flex-col overflow-hidden">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  User Directory
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  Access, identity, and account lifecycle management
                </h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                  Manage user records, assign roles, reset passwords, and control account status from one workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAll}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("ALL");
                      setUserTypeFilter("ALL");
                      setStatusFilter("ALL");
                    }}
                    className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
                  >
                    Reset Filters
                  </button>
                ) : null}
                {canCreate ? (
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Create User
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_repeat(3,minmax(0,0.78fr))]">
              <label className="enterprise-chip flex items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, email, employee number, phone, or supplier"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </label>

              <div className="enterprise-chip flex items-center gap-3 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Role</span>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-600 outline-none dark:text-slate-300"
                >
                  <option value="ALL">All Roles</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.name}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="enterprise-chip flex items-center gap-3 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Type</span>
                <select
                  value={userTypeFilter}
                  onChange={(event) => setUserTypeFilter(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-600 outline-none dark:text-slate-300"
                >
                  <option value="ALL">All User Types</option>
                  {userTypes.map((type) => (
                    <option key={type.id} value={type.name}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="enterprise-chip flex items-center gap-3 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-600 outline-none dark:text-slate-300"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

          {selectedIds.length > 0 ? (
            <div className="mt-4 rounded-[24px] border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                      {selectedIds.length} user{selectedIds.length === 1 ? "" : "s"} selected
                    </p>
                    <p className="mt-1 text-xs text-blue-700/80 dark:text-blue-200/80">
                      Apply a bulk role assignment or update account status without leaving the table.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-blue-200 bg-white px-3 py-2 dark:border-blue-500/30 dark:bg-slate-900">
                      <select
                        value={bulkRoleId}
                        onChange={(event) => setBulkRoleId(event.target.value)}
                        className="bg-transparent text-sm text-slate-700 outline-none dark:text-slate-100"
                      >
                        <option value="">Assign role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={bulkAssignRole}
                      disabled={!bulkRoleId || saving}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
                    >
                      Assign Role
                    </button>
                    <button
                      type="button"
                      onClick={() => bulkUpdateStatus("ACTIVE")}
                      disabled={saving}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                    >
                      Enable
                    </button>
                    <button
                      type="button"
                      onClick={() => bulkUpdateStatus("INACTIVE")}
                      disabled={saving}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-amber-500/40 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
                    >
                      Disable
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="rounded-full px-3 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
              </div>
            </div>
          ) : null}
        </div>

          {loading ? (
            <div className="grid gap-3 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-18 animate-pulse rounded-[22px] bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="error" title="Failed to load users" message={error} />
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-auto p-4 pt-0">
                <table className="min-w-full border-separate border-spacing-y-2.5">
                  <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur dark:bg-slate-950/95">
                    <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      <th className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedAllVisible}
                          onChange={(event) =>
                            setSelectedIds(event.target.checked ? filteredUsers.map((user) => user.id) : [])
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-3 py-2.5">User</th>
                      <th className="px-3 py-2.5">User Type</th>
                      <th className="px-3 py-2.5">Organisation</th>
                      <th className="px-3 py-2.5">Roles</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Last Login</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12">
                          <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            No users match the current filters. Adjust the search or create a new account.
                            {canCreate ? (
                              <div className="mt-4">
                                <button
                                  type="button"
                                  onClick={openCreate}
                                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                                >
                                  <Plus className="h-4 w-4" />
                                  Create User
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const initials =
                          `${user.firstname?.[0] || ""}${user.lastname?.[0] || ""}`.toUpperCase() || "U";
                        const isActive = (user.status || "ACTIVE") === "ACTIVE";

                        return (
                          <tr key={user.id} className="enterprise-subtle-card">
                            <td className="rounded-l-[22px] px-3 py-3">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(user.id)}
                                onChange={() => toggleSelection(user.id)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-sm font-semibold text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                                  {initials}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[15px] font-medium text-slate-900 dark:text-slate-100">
                                    {user.firstname} {user.lastname}
                                  </p>
                                  <p className="truncate text-[12px] text-slate-400 dark:text-slate-500">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <SoftChip tone="blue">{user.userType || "Unassigned"}</SoftChip>
                            </td>
                            <td className="px-3 py-3">
                              <div className="space-y-1">
                                <p
                                  className={`text-sm ${
                                    user.supplierName ? "font-medium text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"
                                  }`}
                                >
                                  {user.supplierName || "Internal"}
                                </p>
                                {!user.supplierName && (user.region || user.district || user.depot) ? (
                                  <p className="text-[12px] text-slate-400 dark:text-slate-500">
                                    {[user.region, user.district, user.depot].filter(Boolean).join(" / ")}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex max-w-[250px] flex-wrap gap-2">
                                {user.roles.length > 0 ? (
                                  user.roles.map((role) => (
                                    <SoftChip key={role} tone="slate">
                                      {role}
                                    </SoftChip>
                                  ))
                                ) : (
                                  <SoftChip tone="slate">No role</SoftChip>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <StatusPill status={isActive ? "ACTIVE" : "INACTIVE"} />
                            </td>
                            <td className="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                              {formatDate(user.lastLoginAt)}
                            </td>
                            <td className="rounded-r-[22px] px-3 py-3 text-right">
                              <ActionMenu
                                placement="bottom-end"
                                buttonClassName="hover:bg-slate-200/70 dark:hover:bg-slate-800/80"
                                onView={() => {
                                  setActiveUser(user);
                                  setShowViewer(true);
                                }}
                                onEdit={canUpdate ? () => openEdit(user) : undefined}
                                onDelete={
                                  canDelete
                                    ? () => {
                                        setActiveUser(user);
                                        setShowDelete(true);
                                      }
                                    : undefined
                                }
                                extras={[
                                  ...(canResetPassword
                                    ? [
                                        {
                                          label: "Reset Password",
                                          onClick: () => {
                                            setActiveUser(user);
                                            setResetPassword("Password@123");
                                            setShowResetPassword(true);
                                          },
                                          icon: <KeyRound className="h-4 w-4" />,
                                        },
                                      ]
                                    : []),
                                  ...(canAssignRole
                                    ? [
                                        {
                                          label: "Assign Roles",
                                          onClick: () => openEdit(user),
                                          icon: <ShieldCheck className="h-4 w-4" />,
                                        },
                                      ]
                                    : []),
                                  ...(canUpdate
                                    ? [
                                        {
                                          label: isActive ? "Disable" : "Enable",
                                          onClick: () => updateStatus(user.id, isActive ? "INACTIVE" : "ACTIVE"),
                                          icon: <Power className="h-4 w-4" />,
                                        },
                                      ]
                                    : []),
                                ]}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Showing {filteredUsers.length.toLocaleString()} of {users.length.toLocaleString()} users
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="enterprise-chip px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {selectedIds.length} selected
                    </span>
                    <span className="enterprise-chip px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {activeCount} active
                    </span>
                    <span className="enterprise-chip px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {inactiveCount} inactive
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
      </section>

      <Modal
        isOpen={showEditor}
        onClose={closeEditor}
        variant="center"
        showCloseButton={false}
        backdropBlur={true}
        className="max-h-[92vh] max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex max-h-[92vh] flex-col bg-white dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  {activeUser ? <UserCog className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    {activeUser ? "Edit User" : "Create User"}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {activeUser ? "Update user profile and access" : "Add a new user account"}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Configure personal details, role membership, access scope, and authentication settings in a centered modal.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form onSubmit={submitUser} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
              <div className="grid grid-cols-2 gap-3">
                <InfoTile label="Workflow" value={activeUser ? "Edit in modal" : "Create in modal"} />
                <InfoTile label="Module" value="User Management" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <Users2 className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                        Personal Information
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                        Identity and contact details
                      </h4>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Field label="First Name" value={formState.firstname} onChange={(value) => updateForm("firstname", value)} />
                    <Field label="Last Name" value={formState.lastname} onChange={(value) => updateForm("lastname", value)} />
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="Email"
                      type="email"
                      value={formState.email}
                      onChange={(value) => updateForm("email", value)}
                    />
                    <Field label="Phone" value={formState.phone} onChange={(value) => updateForm("phone", value)} />
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Field
                      label="WhatsApp Number"
                      value={formState.whatsappNumber}
                      onChange={(value) => updateForm("whatsappNumber", value)}
                    />
                    <Field
                      label="Employee Number"
                      value={formState.employeeNumber}
                      onChange={(value) => updateForm("employeeNumber", value)}
                    />
                  </div>
                </section>

                <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                        Account & Access
                      </p>
                      <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                        Authentication and permissions
                      </h4>
                    </div>
                  </div>

                  <div className="mt-5">
                    <Field
                      label={activeUser ? "New Password (optional)" : "Password"}
                      type="password"
                      value={formState.password}
                      onChange={(value) => updateForm("password", value)}
                    />
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {activeUser
                        ? "Leave blank to keep the current password unchanged."
                        : "Set an initial password so the new user can sign in."}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                    <div className="mt-4">
                      <SelectField
                        label="Supplier"
                        value={formState.supplierId}
                        onChange={(value) => updateForm("supplierId", value)}
                        options={suppliers.map((item) => ({
                          value: String(item.id),
                          label: item.name,
                        }))}
                      />
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Supplier users are restricted to the selected organisation&apos;s devices, transformers, alerts, and related records.
                      </p>
                    </div>
                  ) : null}
                </section>
              </div>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                      Role Membership
                    </p>
                    <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                      Access entitlements
                    </h4>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {roles.map((role) => {
                    const checked = formState.roleIds.includes(String(role.id));
                    return (
                      <label
                        key={role.id}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
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
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{role.name}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                      Scope & Location
                    </p>
                    <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                      Operational assignment
                    </h4>
                  </div>
                </div>

                {isSupplierUserType ? (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Supplier-scoped users inherit organisation access from the selected supplier and do not use internal region, district, or depot fields.
                  </div>
                ) : (
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <SelectField
                      label="Region"
                      value={formState.region}
                      onChange={handleRegionChange}
                      options={regionOptions.map((item) => ({ value: item.name, label: item.name }))}
                      placeholder="Select Region"
                    />
                    <SelectField
                      label="District"
                      value={formState.district}
                      onChange={handleDistrictChange}
                      options={districtOptions.map((item) => ({ value: item.name, label: item.name }))}
                      placeholder="Select District"
                      disabled={!formState.region}
                    />
                    <SelectField
                      label="Depot"
                      value={formState.depot}
                      onChange={(value) => updateForm("depot", value)}
                      options={depotOptions.map((item) => ({ value: item.name, label: item.name }))}
                      placeholder="Select Depot"
                      disabled={!formState.district}
                    />
                  </div>
                )}
              </section>
            </div>

            <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {saving ? "Saving..." : activeUser ? "Save User" : "Create User"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        isOpen={showViewer}
        onClose={() => setShowViewer(false)}
        variant="center"
        showCloseButton={false}
        backdropBlur={true}
        className="max-h-[88vh] max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        {activeUser ? (
          <div className="flex max-h-[88vh] flex-col bg-white dark:bg-slate-950">
            <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                    <Users2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                      User Details
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                      {activeUser.firstname} {activeUser.lastname}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{activeUser.email}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowViewer(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overview</p>
                    <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">Account summary</p>
                  </div>
                  <StatusPill status={(activeUser.status || "ACTIVE") as "ACTIVE" | "INACTIVE"} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <InfoTile label="User Type" value={activeUser.userType || "Unassigned"} />
                  <InfoTile label="Organisation" value={activeUser.supplierName || "Internal"} />
                  <InfoTile label="Last Login" value={formatDate(activeUser.lastLoginAt)} />
                  <InfoTile label="Created" value={formatDate(activeUser.createdDate)} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoItem label="Employee Number" value={activeUser.employeeNumber || "Not assigned"} />
                <InfoItem label="Phone" value={activeUser.phone || "No phone"} />
                <InfoItem label="WhatsApp" value={activeUser.whatsappNumber || "No WhatsApp"} />
                {activeUser.userType !== "Supplier" ? <InfoItem label="Region" value={activeUser.region || "N/A"} /> : null}
                {activeUser.userType !== "Supplier" ? <InfoItem label="District" value={activeUser.district || "N/A"} /> : null}
                {activeUser.userType !== "Supplier" ? <InfoItem label="Depot" value={activeUser.depot || "N/A"} /> : null}
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned Roles</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeUser.roles.length > 0 ? (
                    activeUser.roles.map((role) => (
                      <SoftChip key={role} tone="blue">
                        {role}
                      </SoftChip>
                    ))
                  ) : (
                    <SoftChip tone="slate">No role</SoftChip>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        variant="center"
        showCloseButton={false}
        backdropBlur={true}
        className="w-full max-w-md overflow-hidden rounded-[28px] border border-red-200 bg-white p-0 shadow-2xl dark:border-red-500/20 dark:bg-slate-900"
      >
        <div className="px-6 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-300">
            <Trash2 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete User?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Permanently remove{" "}
            <span className="font-semibold text-slate-950 dark:text-slate-50">
              {activeUser ? `${activeUser.firstname} ${activeUser.lastname}` : "this user"}
            </span>
            {" "}from the platform. This action cannot be undone.
          </p>
          <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            {activeUser ? `${activeUser.email}${activeUser.employeeNumber ? ` • ${activeUser.employeeNumber}` : ""}` : ""}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowDelete(false)}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={saving}
              className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Deleting..." : "Delete User"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showResetPassword}
        onClose={() => setShowResetPassword(false)}
        variant="center"
        showCloseButton={false}
        backdropBlur={true}
        className="w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <form onSubmit={submitPasswordReset} className="flex max-h-[82vh] flex-col bg-white dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                    Reset Password
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    Set a new password
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Update sign-in credentials for {activeUser?.firstname} {activeUser?.lastname}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetPassword(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Credential reset</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Share the updated password securely with the user after saving this change.
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Field label="New Password" type="password" value={resetPassword} onChange={setResetPassword} />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResetPassword(false)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="enterprise-subtle-card px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

function SoftChip({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "blue" | "slate";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        tone === "blue"
          ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: "ACTIVE" | "INACTIVE" }) {
  const active = status === "ACTIVE";
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
      <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-amber-500"}`} />
      {active ? "Active" : "Inactive"}
    </span>
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
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-900"
      >
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}
