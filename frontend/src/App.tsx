import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import UserProfiles from "./pages/UserProfiles";
import Users from "./pages/UserManagement/Users";
import RolesPage from "./pages/UserManagement/Roles";
import PermissionsPage from "./pages/UserManagement/Permissions";
import UserTypesPage from "./pages/UserManagement/UserTypes";
import ForbiddenPage from "./pages/UserManagement/Forbidden";
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
import NewControllersIndex from "./pages/NewControllers";
import EditController from "./pages/NewControllers/EditController";
import CreateTransformer from "./pages/Transformers/CreateTransformer";
import EditTransformer from "./pages/Transformers/EditTransformer";
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
        <Route
          index
          element={
            <ProtectedRoute permission="dashboard.read">
              <DashboardHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute permission="dashboard.read">
              <DashboardHome />
            </ProtectedRoute>
          }
        />
        <Route path="signin" element={<Navigate to="/" replace />} />
        <Route path="signup" element={<Navigate to="/" replace />} />
        <Route path="profile" element={<UserProfiles />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="blank" element={<Blank />} />
        <Route
          path="regions"
          element={
            <ProtectedRoute permission="regions.read">
              <RegionsIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="districts"
          element={
            <ProtectedRoute permission="districts.read">
              <DistrictsIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="depots"
          element={
            <ProtectedRoute permission="depots.read">
              <DepotsIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="transformers"
          element={
            <ProtectedRoute permission="transformers.read">
              <TransformersIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="transformers/new"
          element={
            <ProtectedRoute permission="transformers.create">
              <CreateTransformer />
            </ProtectedRoute>
          }
        />
        <Route
          path="transformers/:id/edit"
          element={
            <ProtectedRoute permission="transformers.update">
              <EditTransformer />
            </ProtectedRoute>
          }
        />
        <Route
          path="sensors"
          element={
            <ProtectedRoute permission="sensors.read">
              <SensorsIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="new-controllers"
          element={
            <ProtectedRoute permission="controllers.read">
              <NewControllersIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="new-controllers/:id/edit"
          element={
            <ProtectedRoute permission="controllers.update">
              <EditController />
            </ProtectedRoute>
          }
        />
        <Route
          path="sites"
          element={
            <ProtectedRoute permission="sites.read">
              <SiteIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="transformer/:id"
          element={
            <ProtectedRoute permission="dashboard.read">
              <TransformerDetail />
            </ProtectedRoute>
          }
        />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route
          path="users"
          element={
            <ProtectedRoute permission="users.read">
                <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="roles"
          element={
            <ProtectedRoute permission="roles.read">
              <RolesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="permissions"
          element={
            <ProtectedRoute permission="permissions.read">
              <PermissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="user-types"
          element={
            <ProtectedRoute permission="usertypes.read">
              <UserTypesPage />
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
