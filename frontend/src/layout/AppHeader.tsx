import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { ChevronRight, Menu, Search } from "lucide-react";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const pageMeta = (() => {
    const titleMap: Record<string, { title: string; description: string }> = {
      dashboard: {
        title: "Dashboard",
        description: "Monitor transformer health, alarms, telemetry, and field activity.",
      },
      regions: {
        title: "Regions",
        description: "Manage grid coverage, district alignment, and operational capacity by region.",
      },
      districts: {
        title: "Districts",
        description: "Review district-level infrastructure, maintenance hubs, and network performance.",
      },
      depots: {
        title: "Depots",
        description: "Coordinate service depots, field logistics, and assigned transformer assets.",
      },
      transformers: {
        title: "Transformers",
        description: "Track transformer inventory, telemetry health, and assignment status.",
      },
      sensors: {
        title: "Sensors",
        description: "Supervise telemetry devices, controller activity, and monitoring readiness.",
      },
      alerts: {
        title: "Alerts",
        description: "Investigate active incidents, thresholds, and utility response priorities.",
      },
      sites: {
        title: "Sites",
        description: "Visualize field locations, geospatial coverage, and monitored transformer sites.",
      },
      users: {
        title: "Users",
        description: "Administer operator accounts, access scope, and user lifecycle actions.",
      },
      roles: {
        title: "Roles",
        description: "Configure enterprise access roles and utility governance permissions.",
      },
      permissions: {
        title: "Permissions",
        description: "Review fine-grained access controls for the monitoring platform.",
      },
      profile: {
        title: "Profile",
        description: "Manage your account preferences and platform identity settings.",
      },
    };

    const activeKey = pathSegments[0] || "dashboard";
    return titleMap[activeKey] || titleMap.dashboard;
  })();

  const breadcrumbs = [
    { label: "Home", to: "/dashboard" },
    ...pathSegments.map((segment, index) => ({
      label: segment
        .split("-")
        .map((value) => value.charAt(0).toUpperCase() + value.slice(1))
        .join(" "),
      to: `/${pathSegments.slice(0, index + 1).join("/")}`,
    })),
  ];

  return (
    <header className="sticky top-0 z-40 px-3 pb-1 pt-2 md:px-4 md:pt-3 xl:px-6">
      <div className="enterprise-card flex min-h-[72px] items-center justify-between px-3 py-3 md:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            aria-controls="sidebar"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="enterprise-chip flex h-10 w-10 items-center justify-center text-slate-600 transition hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>

          <Link className="block flex-shrink-0 lg:hidden" to="/">
            <span className="text-lg font-semibold text-blue-600 dark:text-blue-300">TMS</span>
          </Link>

          <div className="min-w-0">
            <div className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex dark:text-slate-400">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.to} className="flex items-center gap-2">
                  {index > 0 && <ChevronRight className="h-4 w-4" />}
                  <Link
                    to={crumb.to}
                    className={`transition hover:text-blue-600 dark:hover:text-blue-300 ${
                      index === breadcrumbs.length - 1
                        ? "font-semibold text-blue-600 dark:text-blue-300"
                        : ""
                    }`}
                  >
                    {crumb.label}
                  </Link>
                </div>
              ))}
            </div>
            <div className="mt-0.5">
              <h1 className="truncate text-[26px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {pageMeta.title}
              </h1>
              <p className="hidden max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400 xl:block">
                {pageMeta.description}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="enterprise-chip hidden items-center gap-2.5 px-3 py-2.5 lg:flex">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search transformers, sites, alerts..."
              className="w-56 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 xl:w-64"
            />
          </div>

          <NotificationDropdown />
          <ThemeToggleButton />
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
