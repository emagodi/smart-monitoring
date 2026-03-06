import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";

// Import icons from lucide-react
import {
  Grid,
  MapPinned,
  Warehouse,
  Zap,
  Activity,
  User,
  Users,
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
  TestTube
} from 'lucide-react';

interface NavItem {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    name: "main",
    items: [
      {
        icon: <Grid className="w-5 h-5" />,
        name: "Dashboard",
        path: "/dashboard",
      },
    ],
  },
  {
    name: "FAULTS",
    items: [
       // Placeholder for faults if needed, using existing items for now or strictly what is available
       // Since I don't have specific fault routes in the original list, I will keep the original items but group them logically
       // based on the "Transformer" context.
       // However, the user said "look like the one shown in the picture".
       // If the picture shows "FAULTS", "Log", "My Faults", etc., I should probably add them?
       // But I don't have the backend/pages.
       // I will stick to the AVAILABLE pages but grouped.
    ]
  },
  {
    name: "assets",
    items: [
      {
        icon: <MapPinned className="w-5 h-5" />,
        name: "Regions",
        path: "/regions",
      },
      {
        icon: <MapPinned className="w-5 h-5" />,
        name: "Districts",
        path: "/districts",
      },
      {
        icon: <Warehouse className="w-5 h-5" />,
        name: "Depots",
        path: "/depots",
      },
      {
        icon: <Building className="w-5 h-5" />,
        name: "Sites",
        path: "/sites",
      },
      {
        icon: <Zap className="w-5 h-5" />,
        name: "Transformers",
        path: "/transformers",
      },
      {
        icon: <Activity className="w-5 h-5" />,
        name: "Sensors",
        path: "/sensors",
      },
      {
        icon: <Cpu className="w-5 h-5" />,
        name: "New Controllers",
        path: "/new-controllers",
      },
      {
        icon: <TestTube className="w-5 h-5" />,
        name: "Simulation",
        path: "/simulation",
      },
    ],
  },
  {
    name: "administration",
    items: [
      {
        icon: <Users className="w-5 h-5" />,
        name: "User",
        path: "/users",
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
  const location = useLocation();
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  const isActive = (path: string) => location.pathname === path;

  const toggleSubmenu = (index: string) => {
    setOpenSubmenus(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  return (
    <aside
      className={`fixed left-0 top-0 flex flex-col bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? "w-[200px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 font-outfit`}
    >
      {/* Logo Section */}
      <div className={`h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800 ${
        !isExpanded && !isMobileOpen ? "justify-center px-0" : ""
      }`}>
        <Link to="/" className="flex items-center gap-3">
            <img src="/images/powertel.png" alt="Logo" className="h-12 w-auto" />
        </Link>
      </div>

      <div className="flex flex-col flex-1 overflow-y-auto duration-300 ease-linear no-scrollbar py-4">
        <nav className="px-4 space-y-6">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {(isExpanded || isMobileOpen) && group.items.length > 0 && (
                <h3 className="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">
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
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${
                            !isExpanded && !isMobileOpen ? "justify-center px-2" : ""
                          } ${
                            isActive(item.path || "") 
                              ? "bg-blue-600 text-white" 
                              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span className={`${isActive(item.path || "") ? "text-white" : "text-gray-500"}`}>
                            {item.icon}
                          </span>
                          {(isExpanded || isMobileOpen) && (
                            <>
                              <span className="flex-1 text-sm font-medium text-left">{item.name}</span>
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  openSubmenus[`${groupIndex}-${index}`] ? "rotate-180" : ""
                                }`}
                              />
                            </>
                          )}
                        </button>
                        
                        {(isExpanded || isMobileOpen) && openSubmenus[`${groupIndex}-${index}`] && (
                          <ul className="pl-9 space-y-1">
                            {item.subItems.map((subItem, subIndex) => (
                              <li key={subIndex}>
                                <Link
                                  to={subItem.path}
                                  className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                                    isActive(subItem.path)
                                      ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                                      : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
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
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${
                          !isExpanded && !isMobileOpen ? "justify-center px-2" : ""
                        } ${
                          isActive(item.path || "")
                            ? "bg-blue-600 text-white"
                            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span className={`${isActive(item.path || "") ? "text-white" : "text-gray-500"}`}>
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
      </div>
    </aside>
  );
};

export default AppSidebar;
