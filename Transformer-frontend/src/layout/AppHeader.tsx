import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { Menu, Search } from "lucide-react";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const location = useLocation();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const getPageTitle = (pathname: string) => {
    if (pathname === "/" || pathname === "/dashboard") return "Dashboard";
    if (pathname.includes("/regions")) return "Regions";
    if (pathname.includes("/districts")) return "Districts";
    if (pathname.includes("/depots")) return "Depots";
    if (pathname.includes("/transformers")) return "Transformers";
    if (pathname.includes("/sensors")) return "Sensors";
    if (pathname.includes("/sites")) return "Sites";
    if (pathname.includes("/users")) return "User Management";
    if (pathname.includes("/profile")) return "Profile";
    return "Dashboard";
  };

  return (
    <header className="sticky top-0 z-40 flex w-full bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 h-16 font-outfit">
      <div className="flex flex-grow items-center justify-between px-4 md:px-6 2xl:px-11 h-full">
        {/* Left Side: Toggle + Logo(Mobile) + Title */}
        <div className="flex items-center gap-4">
          <button
            aria-controls="sidebar"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="flex items-center justify-center p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-gray-300 shadow-sm"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link className="block flex-shrink-0 lg:hidden" to="/">
             <span className="text-xl font-bold text-blue-600">TAIS</span>
          </Link>

          <div className="hidden sm:block">
             <div className="flex flex-col justify-center h-full">
               {/* <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                 {getPageTitle(location.pathname).toUpperCase()}
               </h1> */}
               <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Link to="/" className="hover:text-blue-600">Home</Link>
                  <span>/</span>
                  <span className="text-blue-600 font-medium">{getPageTitle(location.pathname)}</span>
               </div>
             </div>
          </div>
        </div>

        {/* Right Side: Actions + User */}
        <div className="flex items-center gap-3 2xsm:gap-7">
          <div className="hidden sm:block relative">
             {/* Optional Search or Actions */}
          </div>
          
          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
