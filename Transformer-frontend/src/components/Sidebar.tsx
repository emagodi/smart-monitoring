import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="sidebar">
      <div className="user-info">
        <h3>Welcome, {user?.username}!</h3>
        <p>{user?.first_name} {user?.last_name}</p>
      </div>
      
      <nav className="sidebar-nav">
        <ul>
          <li><Link to="/">Home</Link></li>
          <li><Link to="/items">Items</Link></li>
          {/* Conditional links based on role - in a real app, these would be based on actual permissions */}
          {user && (
            <>
              <li><Link to="/users">Users</Link></li>
              <li><Link to="/roles">Roles</Link></li>
              <li><Link to="/permissions">Permissions</Link></li>
            </>
          )}
        </ul>
      </nav>
      
      <button onClick={handleLogout} className="logout-btn">Logout</button>
    </div>
  );
};

export default Sidebar;