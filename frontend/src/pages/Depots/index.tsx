import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import axios from "axios";
import {
  Building2,
  Filter,
  Hash,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../../components/ui/modal";
import Alert from "../../components/ui/alert/Alert";
import { ActionMenu } from "../../components/ui/dropdown/ActionMenu";
import { SearchableSelect } from "../../components/ui/select/SearchableSelect";

interface Depot {
  id: number;
  name: string;
  districtId?: number;
  district?: { id: number; name: string; regionId?: number };
}

interface DistrictOption {
  id: number;
  name: string;
  regionId?: number;
}

type DepotRollup = {
  id: number;
  name: string;
  districtId: number | null;
  districtName: string;
  status: "Assigned" | "Unassigned";
};

type NoticeState = {
  variant: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
};

const normalizeList = <T,>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of ["data", "content", "items", "records"]) {
    const value = obj[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
};

function ModalErrorNotice({ error }: { error?: string | null }) {
  if (!error) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
      {error}
    </div>
  );
}

type DepotFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
  name: string;
  setName: (value: string) => void;
  districtId: number | "";
  setDistrictId: (value: number | "") => void;
  districts: DistrictOption[];
  saving?: boolean;
  error?: string | null;
  mode: "create" | "edit";
};

function DepotFormModal({
  open,
  onClose,
  onSubmit,
  name,
  setName,
  districtId,
  setDistrictId,
  districts,
  saving,
  error,
  mode,
}: DepotFormModalProps) {
  const isEdit = mode === "edit";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[90vh] max-w-[620px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
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
                  {isEdit ? "Edit Depot" : "Create Depot"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {isEdit ? "Update depot details" : "Add a new service depot"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {isEdit
                    ? "Keep the depot aligned to the correct district without leaving the page."
                    : "Create the depot in a centered modal so operators stay in context."}
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

        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/70 px-6 py-6 dark:bg-slate-950">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Workflow</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isEdit ? "Edit in modal" : "Create in modal"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">District options</p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {districts.length.toLocaleString()}
                </p>
              </div>
            </div>

            <ModalErrorNotice error={error} />

            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-300">
                  Depot Information
                </p>
                <h4 className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Primary details
                </h4>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Depot name *
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Warehouse className="h-4.5 w-4.5 text-blue-500" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter depot name"
                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-900"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Use a recognizable operating hub name for field and maintenance teams.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  District *
                </label>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800">
                  <SearchableSelect
                    options={districts}
                    value={districtId}
                    onChange={setDistrictId}
                    placeholder="Select district"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  The selected district is used for depot coverage and reporting.
                </p>
              </div>
            </div>
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
                className="inline-flex min-w-[148px] items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Depot"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export default function DepotsIndex() {
  const { token, hasPermission } = useAuth();
  const initialLoadTokenRef = useRef<string | null>(null);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [districtFilter, setDistrictFilter] = useState<number | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [activeDepot, setActiveDepot] = useState<Depot | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [districtInput, setDistrictInput] = useState<number | "">("");
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token]
  );
  const canCreate = hasPermission("depots.create");
  const canUpdate = hasPermission("depots.update");
  const canDelete = hasPermission("depots.delete");

  const fetchDepotData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [depotsRes, districtsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v1/depots`, { headers }),
        axios.get(`${API_BASE_URL}/api/v1/districts?page=0&size=1000`, { headers }),
      ]);

      setDepots(
        normalizeList<any>(depotsRes.data).map((depot) => ({
          id: depot.id,
          name: depot.name ?? "",
          districtId: depot.districtId ?? depot.district_id,
          district: depot.district,
        }))
      );
      setDistricts(
        normalizeList<any>(districtsRes.data).map((district) => ({
          id: district.id,
          name: district.name,
          regionId: district.regionId ?? district.region_id,
        }))
      );
    } catch {
      setError("Failed to fetch depots");
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, headers]);

  useEffect(() => {
    if (!token) {
      initialLoadTokenRef.current = null;
      return;
    }

    if (initialLoadTokenRef.current === token) return;

    initialLoadTokenRef.current = token;
    void fetchDepotData();
  }, [token, fetchDepotData]);

  const districtLabelMap = useMemo(
    () => new Map(districts.map((district) => [district.id, district.name])),
    [districts]
  );

  const depotRollups = useMemo<DepotRollup[]>(
    () =>
      depots.map((depot) => {
        const resolvedDistrictId = depot.district?.id ?? depot.districtId ?? null;
        const districtName =
          (typeof resolvedDistrictId === "number" ? districtLabelMap.get(resolvedDistrictId) : null) ??
          depot.district?.name ??
          "Unassigned";

        return {
          id: depot.id,
          name: depot.name,
          districtId: typeof resolvedDistrictId === "number" ? resolvedDistrictId : null,
          districtName,
          status: typeof resolvedDistrictId === "number" ? "Assigned" : "Unassigned",
        };
      }),
    [depots, districtLabelMap]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return depotRollups.filter((depot) => {
      const matchesDistrict = districtFilter === "" || depot.districtId === Number(districtFilter);
      if (!query) return matchesDistrict;
      return matchesDistrict && `${depot.name} ${depot.districtName} ${depot.status}`.toLowerCase().includes(query);
    });
  }, [depotRollups, districtFilter, search]);

  const totals = useMemo(() => {
    const assignedCount = depotRollups.filter((depot) => depot.status === "Assigned").length;
    const assignedDistricts = new Set(
      depotRollups
        .map((depot) => depot.districtId)
        .filter((districtId): districtId is number => typeof districtId === "number")
    ).size;
    const districtCoverage = districts.length ? Math.round((assignedDistricts / districts.length) * 100) : 0;

    return {
      totalDepots: depotRollups.length,
      assignedCount,
      unassignedCount: depotRollups.length - assignedCount,
      assignedDistricts,
      districtCoverage,
    };
  }, [depotRollups, districts.length]);

  const visibleSummary = useMemo(() => {
    const assignedVisible = filtered.filter((depot) => depot.status === "Assigned").length;
    return {
      visible: filtered.length,
      assignedVisible,
      unassignedVisible: filtered.length - assignedVisible,
    };
  }, [filtered]);

  const leadingDistricts = useMemo(() => {
    const counts = new Map<string, number>();
    depotRollups.forEach((depot) => {
      if (!depot.districtId) return;
      counts.set(depot.districtName, (counts.get(depot.districtName) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [depotRollups]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = filtered.length === 0 ? 0 : Math.min(page * pageSize, filtered.length);
  const selectedDistrictLabel =
    districtFilter === "" ? "All districts" : districtLabelMap.get(Number(districtFilter)) ?? "Selected district";

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openCreate = () => {
    setNameInput("");
    setDistrictInput("");
    setActiveDepot(null);
    setFormError(null);
    setShowCreate(true);
  };

  const openEdit = async (depot: Depot) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots/${depot.id}`, { headers });
      const nextDepot = (res.data as Depot) || depot;
      setActiveDepot(nextDepot);
      setNameInput(nextDepot.name);
      setDistrictInput(nextDepot.district?.id ?? nextDepot.districtId ?? "");
    } catch {
      setActiveDepot(depot);
      setNameInput(depot.name);
      setDistrictInput(depot.district?.id ?? depot.districtId ?? "");
    }
    setFormError(null);
    setShowEdit(true);
  };

  const openView = async (depot: Depot) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots/${depot.id}`, { headers });
      setActiveDepot(res.data as Depot);
    } catch {
      setActiveDepot(depot);
    }
    setShowView(true);
  };

  const openDelete = (depot: Depot) => {
    setActiveDepot(depot);
    setDeleteError(null);
    setShowDelete(true);
  };

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!nameInput || nameInput.trim().length < 2) {
        setFormError("Enter a valid name");
        return;
      }
      if (!districtInput || typeof districtInput !== "number") {
        setFormError("Select a district");
        return;
      }
      setSavingCreate(true);
      setFormError(null);
      await axios.post(
        `${API_BASE_URL}/api/v1/depots/create`,
        { name: nameInput.trim(), districtId: districtInput },
        { headers }
      );
      setShowCreate(false);
      setNameInput("");
      setDistrictInput("");
      await fetchDepotData();
      setNotice({
        variant: "success",
        title: "Depot created",
        message: "The depot was created successfully.",
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError("Failed to create depot");
      setNotice({
        variant: "error",
        title: "Create failed",
        message: "Could not create the depot.",
      });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (!activeDepot) return;
      if (!nameInput || nameInput.trim().length < 2) {
        setFormError("Enter a valid name");
        return;
      }
      if (!districtInput || typeof districtInput !== "number") {
        setFormError("Select a district");
        return;
      }
      setSavingEdit(true);
      setFormError(null);
      await axios.put(
        `${API_BASE_URL}/api/v1/depots/${activeDepot.id}`,
        { name: nameInput.trim(), districtId: districtInput },
        { headers }
      );
      setShowEdit(false);
      setActiveDepot(null);
      setNameInput("");
      setDistrictInput("");
      await fetchDepotData();
      setNotice({
        variant: "success",
        title: "Depot updated",
        message: "Changes were saved successfully.",
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError("Failed to update depot");
      setNotice({
        variant: "error",
        title: "Update failed",
        message: "Could not update the depot.",
      });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!activeDepot) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      await axios.delete(`${API_BASE_URL}/api/v1/depots/${activeDepot.id}`, { headers });
      setShowDelete(false);
      setActiveDepot(null);
      await fetchDepotData();
      setNotice({
        variant: "success",
        title: "Depot deleted",
        message: "The depot was deleted successfully.",
      });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setDeleteError("Failed to delete depot");
      setNotice({
        variant: "error",
        title: "Delete failed",
        message: "Could not delete the depot.",
      });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="enterprise-card flex h-96 items-center justify-center gap-3 text-slate-500 dark:text-slate-300">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span>Loading depots...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <Alert variant={notice.variant} title={notice.title} message={notice.message} />}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Depots",
            value: totals.totalDepots,
            subtitle: "Total service and maintenance hubs",
            icon: <Warehouse className="h-6 w-6" />,
            tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/14 dark:text-blue-300",
          },
          {
            label: "District Links",
            value: totals.assignedDistricts,
            subtitle: `${totals.districtCoverage}% district coverage`,
            icon: <MapPin className="h-6 w-6" />,
            tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/14 dark:text-indigo-300",
          },
          {
            label: "Assigned",
            value: totals.assignedCount,
            subtitle: "Depots mapped to districts",
            icon: <ShieldCheck className="h-6 w-6" />,
            tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/14 dark:text-emerald-300",
          },
          {
            label: "Unassigned",
            value: totals.unassignedCount,
            subtitle: "Depots requiring district mapping",
            icon: <Hash className="h-6 w-6" />,
            tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/14 dark:text-amber-300",
          },
        ].map((card) => (
          <div key={card.label} className="enterprise-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                  {card.value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {card.subtitle}
                </p>
              </div>
              <div className={`rounded-xl p-2.5 ${card.tone}`}>{card.icon}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                Depot Summary
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
                Filtered overview
              </h3>
            </div>
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Building2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            {[
              ["Visible depots", visibleSummary.visible],
              ["Assigned in view", visibleSummary.assignedVisible],
              ["Unassigned in view", visibleSummary.unassignedVisible],
              ["Current filter", selectedDistrictLabel],
            ].map(([label, value]) => (
              <div key={String(label)} className="enterprise-subtle-card flex items-center justify-between px-3 py-2.5">
                <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
              </div>
            ))}
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10 dark:hover:text-blue-300"
            >
              Open Create Modal
            </button>
          )}
        </div>

        <div className="enterprise-card p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
              District Mix
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              Highest depot concentration
            </h3>
          </div>

          <div className="mt-4 space-y-3">
            {leadingDistricts.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                No district assignments available yet.
              </div>
            ) : (
              leadingDistricts.map(([districtName, count]) => {
                const maxCount = leadingDistricts[0]?.[1] || 1;
                const width = (count / maxCount) * 100;

                return (
                  <div key={districtName}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{districtName}</span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {count.toLocaleString()} depot{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                        style={{ width: `${Math.max(width, 8)}%` }}
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
              Coverage Health
            </p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-slate-50 md:text-base">
              District assignment status
            </h3>
          </div>

          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Coverage rate</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-slate-50">
                  {totals.districtCoverage}%
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                {totals.assignedDistricts}/{Math.max(districts.length, 0)} districts linked
              </span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600"
                style={{ width: `${Math.max(totals.districtCoverage, 8)}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Unassigned depots stay visible in the table so operators can close coverage gaps quickly.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4">
        <div className="enterprise-card overflow-hidden">
          <div className="border-b border-slate-200/80 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Depot Table
                </p>
                <h3 className="mt-0.5 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-lg">
                  Service depots and district assignments
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void fetchDepotData()}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
                <button
                  onClick={() => {
                    setSearch("");
                    setDistrictFilter("");
                    setPage(1);
                  }}
                  className="enterprise-chip inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:text-amber-600 dark:text-slate-200 dark:hover:text-amber-300"
                >
                  <Filter className="h-4 w-4" />
                  Reset
                </button>
                {canCreate && (
                  <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    Add Depot
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="enterprise-chip inline-flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-transparent text-sm outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="enterprise-chip flex items-center gap-3 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold text-slate-900 dark:text-slate-100">District</span>
                <div className="min-w-[220px] flex-1">
                  <SearchableSelect
                    options={districts}
                    value={districtFilter}
                    onChange={(value) => {
                      setDistrictFilter(value);
                      setPage(1);
                    }}
                    placeholder="All districts"
                    compact
                  />
                </div>
              </div>

              <div className="enterprise-chip flex flex-1 items-center gap-3 px-3 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search depots, districts, or status..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto p-4 pt-0">
            <table className="min-w-full border-separate border-spacing-y-2.5">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  <th className="px-3 py-2.5">Depot</th>
                  <th className="px-3 py-2.5">District</th>
                  <th className="px-3 py-2.5">Link Status</th>
                  <th className="px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12">
                      <div className="rounded-[22px] border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        No depots found for the current filter.
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated.map((depot) => (
                    <tr key={depot.id} className="enterprise-subtle-card">
                      <td className="rounded-l-[22px] px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                            <Warehouse className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                              {depot.name}
                            </p>
                            <p className="mt-0.5 text-[12px] text-slate-400 dark:text-slate-500">
                              Depot ID #{depot.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <MapPin
                            className={`h-4 w-4 ${
                              depot.status === "Assigned"
                                ? "text-blue-500"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          />
                          <span
                            className={
                              depot.status === "Assigned"
                                ? "font-medium text-slate-900 dark:text-slate-100"
                                : "text-slate-500 dark:text-slate-400"
                            }
                          >
                            {depot.districtName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                depot.status === "Assigned"
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            {depot.status}
                          </span>
                          <span className="text-[12px] text-slate-400 dark:text-slate-500">
                            {depot.status === "Assigned"
                              ? "Included in district coverage metrics"
                              : "Needs district assignment"}
                          </span>
                        </div>
                      </td>
                      <td className="rounded-r-[22px] px-3 py-3 text-right">
                        <ActionMenu
                          placement="bottom-end"
                          onView={() => void openView({ id: depot.id, name: depot.name, districtId: depot.districtId ?? undefined })}
                          onEdit={
                            canUpdate
                              ? () =>
                                  void openEdit({
                                    id: depot.id,
                                    name: depot.name,
                                    districtId: depot.districtId ?? undefined,
                                  })
                              : undefined
                          }
                          onDelete={
                            canDelete
                              ? () =>
                                  openDelete({
                                    id: depot.id,
                                    name: depot.name,
                                    districtId: depot.districtId ?? undefined,
                                  })
                              : undefined
                          }
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {rangeStart} to {rangeEnd} of {filtered.length} depots
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
                >
                  Previous
                </button>
                <div className="rounded-full bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white">{page}</div>
                <button
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="enterprise-chip rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:text-slate-200"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <DepotCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={submitCreate}
        name={nameInput}
        setName={setNameInput}
        districtId={districtInput}
        setDistrictId={setDistrictInput}
        districts={districts}
        saving={savingCreate}
        error={formError}
      />
      <DepotEditModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSubmit={submitEdit}
        name={nameInput}
        setName={setNameInput}
        districtId={districtInput}
        setDistrictId={setDistrictInput}
        districts={districts}
        saving={savingEdit}
        error={formError}
      />
      <DepotViewModal
        open={showView}
        onClose={() => setShowView(false)}
        depot={activeDepot}
        districts={districts}
      />
      <DepotDeleteModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={confirmDelete}
        depot={activeDepot}
        deleting={deleting}
        error={deleteError}
      />
    </div>
  );
}

export function DepotCreateModal(props: Omit<DepotFormModalProps, "mode">) {
  return <DepotFormModal {...props} mode="create" />;
}

export function DepotEditModal(props: Omit<DepotFormModalProps, "mode">) {
  return <DepotFormModal {...props} mode="edit" />;
}

export function DepotViewModal({
  open,
  onClose,
  depot,
  districts,
}: {
  open: boolean;
  onClose: () => void;
  depot: Depot | null;
  districts: DistrictOption[];
}) {
  if (!depot) return null;

  const districtId = depot.district?.id ?? depot.districtId ?? null;
  const districtName =
    (typeof districtId === "number" ? districts.find((item) => item.id === districtId)?.name : null) ??
    depot.district?.name ??
    "Unassigned";
  const status = typeof districtId === "number" ? "Assigned" : "Unassigned";

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      variant="center"
      showCloseButton={false}
      className="max-h-[88vh] max-w-[560px] overflow-hidden rounded-[28px] border border-slate-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      backdropBlur={true}
    >
      <div className="flex max-h-[88vh] flex-col bg-white dark:bg-slate-950">
        <div className="border-b border-slate-200 bg-slate-50/90 px-6 py-5 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                <Warehouse className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-300">
                  Depot Details
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">{depot.name}</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Centered modal view for quick operational context.
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

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Overview</p>
                <p className="mt-1 text-base font-semibold text-slate-950 dark:text-slate-50">
                  Assignment snapshot
                </p>
              </div>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                  status === "Assigned"
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                }`}
              >
                {status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: "Depot ID", value: `#${depot.id}` },
                { label: "District", value: districtName },
                { label: "Link status", value: status },
                { label: "Module", value: "Depots" },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">{metric.label}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Context</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Depot name</p>
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{depot.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">District coverage</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {status === "Assigned"
                      ? `${districtName} receives this depot in coverage reporting.`
                      : "This depot is not yet mapped to a district."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function DepotDeleteModal({
  open,
  onClose,
  onConfirm,
  depot,
  deleting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  depot: Depot | null;
  deleting: boolean;
  error?: string | null;
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
        <h3 className="mt-4 text-xl font-semibold text-slate-950 dark:text-slate-50">Delete Depot?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-slate-950 dark:text-slate-50">
            {depot?.name || "this depot"}
          </span>
          ? This action cannot be undone.
        </p>

        <div className="mt-5">
          <ModalErrorNotice error={error} />
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex min-w-[132px] items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
