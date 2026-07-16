import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  Map, 
  Settings, 
  Users, 
  BarChart3, 
  Activity, 
  AlertTriangle,
  Power,
  Package,
  Globe,
  Building2,
  Zap
} from 'lucide-react';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  if (!token) {
    navigate('/signin');
    return null;
  }

  const menuItems = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Regions', href: '/regions', icon: Map },
    { name: 'Depots', href: '/depots', icon: Building2 },
    { name: 'Transformers', href: '/transformers', icon: Power },
    { name: 'Sensors', href: '/sensors', icon: Activity },
    { name: 'Alerts', href: '/alerts', icon: AlertTriangle },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-800 transition-transform duration-300 ease-in-out transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex items-center justify-center h-16 px-4 bg-slate-900">
          <span className="text-xl font-bold text-white">ZESA Dashboard</span>
        </div>
        <nav className="px-2 mt-5">
          <ul>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <a
                    href={item.href}
                    className="flex items-center px-4 py-2 mt-1 text-base font-normal text-white transition duration-200 hover:bg-slate-700"
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="absolute bottom-0 w-full p-4">
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2 text-left text-white bg-red-600 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 w-full overflow-hidden lg:ml-0">
        {/* Top navigation */}
        <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <div className="flex items-center">
            <button
              className="p-2 mr-4 text-gray-600 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                ></path>
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-800">
              {window.location.pathname === '/' ? 'Master Dashboard' : 
               window.location.pathname.includes('regions') ? 'Regions Management' :
               window.location.pathname.includes('depots') ? 'Depots Management' :
               window.location.pathname.includes('transformers') ? 'Transformers Management' :
               window.location.pathname.includes('sensors') ? 'Sensors Monitoring' :
               window.location.pathname.includes('alerts') ? 'Alerts Center' :
               window.location.pathname.includes('users') ? 'User Management' :
               window.location.pathname.includes('reports') ? 'Reports' : 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="mr-3 text-right">
                <p className="text-sm font-medium text-gray-800">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-gray-500">{user?.username}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
                {user?.first_name?.charAt(0).toUpperCase()}{user?.last_name?.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;