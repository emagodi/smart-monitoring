import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import UserProfiles from "./pages/UserProfiles";
import Users from "./pages/UserManagement/Users";
import Calendar from "./pages/Calendar";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute"
import DashboardHome from "./pages/Dashboard/DashboardHome";
import TransformerDetail from "./pages/Dashboard/TransformerDetail";
import RegionsIndex from "./pages/Regions";
import DistrictsIndex from "./pages/Districts";
import DepotsIndex from "./pages/Depots";
import TransformersIndex from "./pages/Transformers";
import SensorsIndex from "./pages/Sensors";
import SiteIndex from "./pages/Site";

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <Routes>
      <Route
        path="/"
        element={
            <AppLayout />
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="signin" element={<Navigate to="/" replace />} />
        <Route path="signup" element={<Navigate to="/" replace />} />
        <Route path="profile" element={<UserProfiles />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="blank" element={<Blank />} />
        <Route path="regions" element={<RegionsIndex />} />
        <Route path="districts" element={<DistrictsIndex />} />
        <Route path="depots" element={<DepotsIndex />} />
        <Route path="transformers" element={<TransformersIndex />} />
        <Route path="sensors" element={<SensorsIndex />} />
        <Route path="sites" element={<SiteIndex />} />
        <Route path="transformer/:id" element={<TransformerDetail />} />
        <Route
          path="users"
          element={
            <ProtectedRoute>
                <Users />
            </ProtectedRoute>
          }
        />
        
      </Route>
    </Routes>
  ) : (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="*" element={<Navigate to="/signin" />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
