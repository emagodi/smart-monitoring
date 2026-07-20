import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";

// Import icons from lucide-react
import {
  Grid,
  MapPinned,
  Warehouse,
  Zap,
  Activity,
  User,
  Users,
  Shield,
  ChevronDown,
  Building,
  LogOut,
  Settings,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Briefcase,
  Cpu,
  KeySquare
} from 'lucide-react';

interface NavItem {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
  permission?: string;
  hideForSupplier?: boolean;
  supplierCodes?: string[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    name: "Dashboard",
    items: [
      {
        icon: <Grid className="w-5 h-5" />,
        name: "Dashboard",
        path: "/dashboard",
        permission: "dashboard.read",
      },
    ],
  },
  {
    name: "Assets",
    items: [
      {
        icon: <MapPinned className="w-5 h-5" />,
        name: "Regions",
        path: "/regions",
        permission: "regions.read",
        hideForSupplier: true,
      },
      {
        icon: <MapPinned className="w-5 h-5" />,
        name: "Districts",
        path: "/districts",
        permission: "districts.read",
        hideForSupplier: true,
      },
      {
        icon: <Warehouse className="w-5 h-5" />,
        name: "Depots",
        path: "/depots",
        permission: "depots.read",
        hideForSupplier: true,
      },
      {
        icon: <Building className="w-5 h-5" />,
        name: "Sites",
        path: "/sites",
        permission: "sites.read",
      },
      {
        icon: <Zap className="w-5 h-5" />,
        name: "Transformers",
        path: "/transformers",
        permission: "transformers.read",
      },
      {
        icon: <Activity className="w-5 h-5" />,
        name: "Sensors",
        path: "/sensors",
        permission: "sensors.read",
      },
    ],
  },
  {
    name: "Operations",
    items: [
      {
        icon: <AlertTriangle className="w-5 h-5" />,
        name: "Alerts",
        path: "/alerts",
        permission: "alerts.read",
      },
      {
        icon: <Cpu className="w-5 h-5" />,
        name: "New Controllers",
        path: "/new-controllers",
        permission: "controllers.read",
      },
      {
        icon: <Shield className="w-5 h-5" />,
        name: "Oculus Control",
        path: "/oculus-control",
        permission: "controllers.update",
        supplierCodes: ["oculus"],
      },
    ],
  },
  {
    name: "Administration",
    items: [
      {
        icon: <Users className="w-5 h-5" />,
        name: "Users",
        path: "/users",
        permission: "users.read",
        hideForSupplier: true,
      },
      {
        icon: <Shield className="w-5 h-5" />,
        name: "Roles",
        path: "/roles",
        permission: "roles.read",
        hideForSupplier: true,
      },
      {
        icon: <KeySquare className="w-5 h-5" />,
        name: "Permissions",
        path: "/permissions",
        permission: "permissions.read",
        hideForSupplier: true,
      },
      {
        icon: <Building className="w-5 h-5" />,
        name: "User Types",
        path: "/user-types",
        permission: "usertypes.read",
        hideForSupplier: true,
      },
      {
        icon: <User className="w-5 h-5" />,
        name: "Profile",
        path: "/profile",
      },
    ],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen } = useSidebar();
  const { hasPermission, user } = useAuth();
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || '').toLowerCase() === 'supplier';

  const isActive = (path: string) => location.pathname === path;

  const toggleSubmenu = (index: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const filteredNavGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            (!item.permission || hasPermission(item.permission)) &&
            !(isSupplierUser && item.hideForSupplier) &&
            (!isSupplierUser ||
              !item.supplierCodes ||
              item.supplierCodes.map((code) => code.toLowerCase()).includes((user?.supplierCode || "").toLowerCase()))
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [hasPermission, isSupplierUser, user?.supplierCode]);

  return (
    <aside
      className={`fixed left-0 top-0 flex flex-col bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? "w-[220px]" : "w-[72px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 font-outfit`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.94)_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(15,23,42,0.96)_100%)]" />

      <div className={`relative flex h-16 items-center border-b border-slate-200/80 px-4 dark:border-slate-800 ${
        !isExpanded && !isMobileOpen ? "justify-center px-0" : ""
      }`}>
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-blue-500/25">
            TM
          </div>
          {(isExpanded || isMobileOpen) && (
            <div>
              <p className="text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Powertel TMS
              </p>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Utility Operations
              </p>
            </div>
          )}
        </Link>
      </div>

      <div className="relative flex flex-1 flex-col overflow-y-auto py-4 no-scrollbar">
        <nav className="space-y-5 px-3">
          {filteredNavGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {(isExpanded || isMobileOpen) && group.items.length > 0 && (
                <h3 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {group.name}
                </h3>
              )}
              
              <ul className="space-y-1">
                {group.items.map((item, index) => (
                  <li key={`${groupIndex}-${index}`}>
                    {item.subItems ? (
                      <div className="space-y-1">
                        <button
                          onClick={() => toggleSubmenu(`${groupIndex}-${index}`)}
                          className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                            !isExpanded && !isMobileOpen ? "justify-center px-2" : ""
                          } ${
                            isActive(item.path || "") 
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20" 
                              : "text-slate-600 hover:bg-[rgba(37,99,235,.1)] hover:text-blue-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-slate-50"
                          }`}
                        >
                          <span className={`${isActive(item.path || "") ? "text-white" : "text-slate-400 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-300"}`}>
                            {item.icon}
                          </span>
                          {(isExpanded || isMobileOpen) && (
                            <>
                              <span className="flex-1 text-left text-sm font-medium">{item.name}</span>
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  openSubmenus[`${groupIndex}-${index}`] ? "rotate-180" : ""
                                }`}
                              />
                            </>
                          )}
                        </button>
                        
                        {(isExpanded || isMobileOpen) && openSubmenus[`${groupIndex}-${index}`] && (
                          <ul className="space-y-1 pl-9">
                            {item.subItems.map((subItem, subIndex) => (
                              <li key={subIndex}>
                                <Link
                                  to={subItem.path}
                                  className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                                    isActive(subItem.path)
                                      ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                                      : "text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                                  }`}
                                >
                                  {subItem.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        to={item.path || "#"}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 ${
                          !isExpanded && !isMobileOpen ? "justify-center px-2" : ""
                        } ${
                          isActive(item.path || "")
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"
                            : "text-slate-600 hover:bg-[rgba(37,99,235,.1)] hover:text-blue-700 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-slate-50"
                        }`}
                      >
                        <span className={`${isActive(item.path || "") ? "text-white" : "text-slate-400 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-300"}`}>
                          {item.icon}
                        </span>
                        {(isExpanded || isMobileOpen) && (
                          <span className="text-sm font-medium">{item.name}</span>
                        )}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative mt-auto px-3 pb-3 pt-5">
          <div className={`enterprise-subtle-card overflow-hidden p-3 ${!isExpanded && !isMobileOpen ? "items-center justify-center px-2 py-3" : ""}`}>
            {isExpanded || isMobileOpen ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                  Grid Status
                </p>
                <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                  Utility platform online
                </p>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Real-time telemetry and alert services are ready.
                </p>
              </>
            ) : (
              <div className="flex justify-center">
                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.65)]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
