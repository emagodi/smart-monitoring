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
      <div className="rounded-2xl border border-slate-200/90 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-h-[48px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-controls="sidebar"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-blue-300"
            >
              <Menu className="h-4 w-4" />
            </button>

            <Link className="block flex-shrink-0 lg:hidden" to="/">
              <span className="text-base font-semibold text-blue-600 dark:text-blue-300">TMS</span>
            </Link>

            <div className="hidden min-w-0 items-center gap-1.5 text-xs text-slate-500 sm:flex dark:text-slate-400">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.to} className="flex items-center gap-1.5">
                  {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
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
          </div>

          <div className="flex items-center gap-2">
            <button className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-300">
              <Search className="h-4 w-4" />
            </button>
            <NotificationDropdown />
            <ThemeToggleButton />
            <UserDropdown />
          </div>
        </div>

      {/*   <div className="px-1 pb-1 pt-2">
          <h1 className="truncate text-[18px] font-semibold tracking-tight text-slate-950 dark:text-slate-50 md:text-[20px]">
            {pageMeta.title}
          </h1>
          <p className="mt-0.5 max-w-2xl text-[11px] leading-4 text-slate-500 dark:text-slate-400 md:text-xs">
            {pageMeta.description}
          </p>
        </div> */}
      </div>
    </header>
  );
};

export default AppHeader;
