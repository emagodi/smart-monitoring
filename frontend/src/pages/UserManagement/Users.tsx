import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Check,
  Mail,
  MessageCircle,
  Phone,
  UserPlus,
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
import { HeroStat, HeroStats, MobileFilters, PageHero } from "../../components/ui/page";
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
  const [showPassword, setShowPassword] = useState(false);
  // Inline validation: which required fields are missing, shown on the fields themselves (not a toast behind the window).
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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
    setFormErrors({});
    setShowPassword(false);
    resetForm();
  };

  const updateForm = <K extends keyof UserFormState>(key: K, value: UserFormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
    setFormErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
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
    const errs: Record<string, string> = {};
    if (!formState.firstname.trim()) errs.firstname = "Enter the first name.";
    if (!formState.lastname.trim()) errs.lastname = "Enter the last name.";
    if (!formState.email.trim()) errs.email = "Enter the email address they will sign in with.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) errs.email = "This doesn't look like an email address.";
    if (!activeUser && !formState.password.trim()) errs.password = "Set a first password so they can sign in.";
    else if (formState.password.trim() && formState.password.trim().length < 6) errs.password = "Use at least 6 characters.";
    if (!formState.userTypeId) errs.userTypeId = "Choose the user type.";
    if (formState.roleIds.length === 0) errs.roleIds = "Pick at least one role.";
    if (isSupplierUserType && !formState.supplierId) errs.supplierId = "Choose the partner this user belongs to.";
    setFormErrors(errs);
    if (Object.keys(errs).length) {
      window.setTimeout(() => document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
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
      const msg = (deleteError as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setShowDelete(false);
      showNotice("error", "Delete failed", msg || "Could not delete the selected user.");
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

  const canCreate = hasPermission("users.create");
  const canUpdate = hasPermission("users.update");
  const canDelete = hasPermission("users.delete");
  const canResetPassword = hasPermission("users.reset.password");
  const canAssignRole = hasPermission("users.assign.role");
  const selectedAllVisible =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user.id));

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Administration · Users"
        title="Users"
        subtitle="Everyone who can sign in: their role, user type, scope and whether the account is active."
      >
        <HeroStats cols={6}>
          <HeroStat icon={<Users2 className="h-3.5 w-3.5" />} label="Users" value={users.length.toLocaleString()} sub={`${filteredUsers.length.toLocaleString()} in this view`} />
          <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />} label="Active" value={activeCount.toLocaleString()} sub="can sign in" tone="good" />
          <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Inactive" value={inactiveCount.toLocaleString()} sub="blocked from signing in" tone={inactiveCount ? "warn" : undefined} />
          <HeroStat icon={<UserCog className="h-3.5 w-3.5" />} label="Administrators" value={adminCount.toLocaleString()} sub="full access" />
          <HeroStat icon={<Building2 className="h-3.5 w-3.5" />} label="Partner users" value={supplierUsersCount.toLocaleString()} sub="supplier portals" />
          <HeroStat icon={<Users2 className="h-3.5 w-3.5" />} label="User types" value={userTypes.length.toLocaleString()} sub={selectedIds.length ? `${selectedIds.length} selected` : "configured"} />
        </HeroStats>
      </PageHero>
      {notice ? <Alert variant={notice.variant} title={notice.title} message={notice.message} /> : null}

      <section className="ui-panel flex max-h-[75vh] min-h-0 flex-col overflow-hidden">
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

              <MobileFilters active={[roleFilter, userTypeFilter, statusFilter].filter((v) => v !== "ALL").length}>
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
              </MobileFilters>
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
        className="max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex max-h-[94vh] flex-col bg-white dark:bg-slate-950">
          {/* Header: same blue hero as every page */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-6 py-4 text-white">
            <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-sky-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-red-400/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
                  {activeUser ? <UserCog className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-200/80">
                    Users · {activeUser ? "Edit user" : "New user"}
                  </p>
                  <h3 className="mt-0.5 truncate text-xl font-semibold tracking-tight">
                    {activeUser
                      ? `${activeUser.firstname ?? ""} ${activeUser.lastname ?? ""}`.trim() || activeUser.email
                      : [formState.firstname, formState.lastname].filter(Boolean).join(" ") || "Add a new user"}
                  </h3>
                  <p className="mt-0.5 truncate text-[13px] text-blue-100/80">
                    {formState.email || "Their details, how they sign in, what they can do and which part of the network they look after."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Close"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form onSubmit={submitUser} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-5 py-4 dark:bg-slate-950">
              {Object.keys(formErrors).length ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <b>{Object.keys(formErrors).length} thing{Object.keys(formErrors).length === 1 ? "" : "s"} to fix before saving:</b>{" "}
                    {Object.values(formErrors).join(" ")}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Fields marked <span className="font-semibold text-red-600">*</span> are required.
                </p>
              )}
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <EditorCard icon={<Users2 className="h-4 w-4" />} title="Personal details" subtitle="Who this person is and how to reach them">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field required error={formErrors.firstname} label="First name" value={formState.firstname} onChange={(v) => updateForm("firstname", v)} placeholder="e.g. Elisha" />
                    <Field required error={formErrors.lastname} label="Last name" value={formState.lastname} onChange={(v) => updateForm("lastname", v)} placeholder="e.g. Mufambirwi" />
                    <Field
                      className="sm:col-span-2"
                      label="Email address"
                      required
                      error={formErrors.email}
                      type="email"
                      icon={<Mail className="h-4 w-4" />}
                      value={formState.email}
                      onChange={(v) => updateForm("email", v)}
                      placeholder="name@powertel.co.zw"
                      hint="They sign in with this address."
                    />
                    <Field label="Phone" icon={<Phone className="h-4 w-4" />} value={formState.phone} onChange={(v) => updateForm("phone", v)} placeholder="+263 …" />
                    <Field label="WhatsApp" icon={<MessageCircle className="h-4 w-4" />} value={formState.whatsappNumber} onChange={(v) => updateForm("whatsappNumber", v)} placeholder="+263 …" />
                    <Field className="sm:col-span-2" label="Employee number" icon={<BadgeCheck className="h-4 w-4" />} value={formState.employeeNumber} onChange={(v) => updateForm("employeeNumber", v)} placeholder="Optional" />
                  </div>
                </EditorCard>

                <EditorCard icon={<KeyRound className="h-4 w-4" />} title="Sign-in" subtitle="Password, account type and status">
                  <div className="space-y-3">
                    <Field
                      label={activeUser ? "New password (optional)" : "Password"}
                      required={!activeUser}
                      error={formErrors.password}
                      type={showPassword ? "text" : "password"}
                      icon={<KeyRound className="h-4 w-4" />}
                      value={formState.password}
                      onChange={(v) => updateForm("password", v)}
                      placeholder={activeUser ? "Leave blank to keep the current one" : "At least 6 characters"}
                      hint={activeUser ? "Only fill this in to reset their password." : "Share it with them securely; they can change it from their profile."}
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="rounded-full px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-slate-800"
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      }
                    />
                    <SelectField
                      required
                      error={formErrors.userTypeId}
                      label="User type"
                      value={formState.userTypeId}
                      onChange={(v) => updateForm("userTypeId", v)}
                      options={userTypes.map((item) => ({ value: String(item.id), label: item.name }))}
                      placeholder="Choose a user type"
                    />
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Status</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["ACTIVE", "Active", "Can sign in", "bg-emerald-600 ring-emerald-600 shadow-emerald-600/25"],
                            ["INACTIVE", "Inactive", "Sign-in blocked", "bg-red-600 ring-red-600 shadow-red-600/25"],
                          ] as const
                        ).map(([v, l, sub, on]) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => updateForm("status", v)}
                            className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
                              formState.status === v
                                ? `${on} text-white shadow-sm`
                                : "bg-white text-slate-600 ring-slate-200 hover:ring-blue-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                            }`}
                          >
                            <span className="block text-sm font-semibold">{l}</span>
                            <span className={`block text-[11px] ${formState.status === v ? "text-white/80" : "text-slate-400"}`}>{sub}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {isSupplierUserType ? (
                      <SelectField
                        required
                        error={formErrors.supplierId}
                        label="Partner organisation"
                        value={formState.supplierId}
                        onChange={(v) => updateForm("supplierId", v)}
                        options={suppliers.map((item) => ({ value: String(item.id), label: item.name }))}
                        placeholder="Choose the partner"
                        hint="Partner users only see their own organisation's devices, transformers and alerts."
                      />
                    ) : null}
                  </div>
                </EditorCard>
              </div>

              <EditorCard
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Roles *"
                subtitle="What this person can do. Pick one or more."
                aside={<span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">{formState.roleIds.length} selected</span>}
              >
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {roles.map((role) => {
                    const checked = formState.roleIds.includes(String(role.id));
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() =>
                          updateForm(
                            "roleIds",
                            checked ? formState.roleIds.filter((id) => id !== String(role.id)) : [...formState.roleIds, String(role.id)]
                          )
                        }
                        className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ring-1 transition ${
                          checked
                            ? "bg-blue-50 text-blue-800 ring-blue-300 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/40"
                            : "bg-white text-slate-700 ring-slate-200 hover:ring-blue-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700"
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                            checked ? "bg-blue-600 text-white" : "ring-1 ring-slate-300 dark:ring-slate-600"
                          }`}
                        >
                          {checked ? <Check className="h-3.5 w-3.5" /> : null}
                        </span>
                        <span className="truncate font-medium">{role.name}</span>
                      </button>
                    );
                  })}
                </div>
                {formErrors.roleIds ? (
                  <p data-field-error className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                    {formErrors.roleIds}
                  </p>
                ) : null}
              </EditorCard>

              <EditorCard icon={<Building2 className="h-4 w-4" />} title="Area of responsibility" subtitle="Leave the depot empty for national users; a depot limits them to that depot's sites">
                {isSupplierUserType ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Partner users follow their organisation; they do not use region, district or depot.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    <SelectField
                      label="Region"
                      value={formState.region}
                      onChange={handleRegionChange}
                      options={regionOptions.map((item) => ({ value: item.name, label: item.name }))}
                      placeholder="All regions"
                    />
                    <SelectField
                      label="District"
                      value={formState.district}
                      onChange={handleDistrictChange}
                      options={districtOptions.map((item) => ({ value: item.name, label: item.name }))}
                      placeholder={formState.region ? "All districts" : "Choose a region first"}
                      disabled={!formState.region}
                    />
                    <SelectField
                      label="Depot"
                      value={formState.depot}
                      onChange={(v) => updateForm("depot", v)}
                      options={depotOptions.map((item) => ({ value: item.name, label: item.name }))}
                      placeholder={formState.district ? "No depot (wider access)" : "Choose a district first"}
                      disabled={!formState.district}
                    />
                  </div>
                )}
              </EditorCard>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formState.roleIds.length ? `${formState.roleIds.length} role${formState.roleIds.length === 1 ? "" : "s"}` : "No role yet"}
                {formState.depot ? ` · ${formState.depot} depot` : formState.region ? ` · ${formState.region}` : isSupplierUserType ? " · partner portal" : " · national"}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 min-w-[150px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#0a2a6b] to-[#0b4fc4] px-5 text-sm font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : activeUser ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {saving ? "Saving…" : activeUser ? "Save changes" : "Create user"}
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
  icon,
  placeholder,
  hint,
  trailing,
  className = "",
  required = false,
  error,
}: {
  required?: boolean;
  error?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  icon?: React.ReactNode;
  placeholder?: string;
  hint?: string;
  trailing?: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`} {...(error ? { "data-field-error": true } : {})}>
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      <span className="relative block">
        {icon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span> : null}
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          className={`h-9 w-full rounded-xl border bg-white text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 dark:bg-slate-900 dark:text-slate-100 ${
            error
              ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-100 dark:border-red-500/60 dark:focus:ring-red-500/20"
              : "border-slate-200 focus:border-blue-400 focus:ring-blue-100 dark:border-slate-700 dark:focus:ring-blue-500/20"
          } ${
            icon ? "pl-9" : "pl-3"
          } ${trailing ? "pr-16" : "pr-3"}`}
        />
        {trailing ? <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span> : null}
      </span>
      {error ? (
        <span className="block text-[11px] font-medium text-red-600 dark:text-red-400">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
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
  hint,
  required = false,
  error,
}: {
  required?: boolean;
  error?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block space-y-1" {...(error ? { "data-field-error": true } : {})}>
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      <select
        aria-invalid={error ? true : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className={`h-9 w-full rounded-xl border bg-white px-3 text-sm text-slate-900 outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:bg-slate-900 dark:text-slate-100 ${
          error
            ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:ring-red-100 dark:border-red-500/60"
            : "border-slate-200 focus:border-blue-400 focus:ring-blue-100 dark:border-slate-700 dark:focus:ring-blue-500/20"
        }`}
      >
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="block text-[11px] font-medium text-red-600 dark:text-red-400">{error}</span>
      ) : hint ? (
        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{hint}</span>
      ) : null}
    </label>
  );
}

function EditorCard({ icon, title, subtitle, aside, children }: { icon: React.ReactNode; title: string; subtitle?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20">{icon}</span>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h4>
            {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
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
