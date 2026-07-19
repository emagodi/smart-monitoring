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
import AlertsIndex from "./pages/Alerts";
import SiteIndex from "./pages/Site";
import OculusControlIndex from "./pages/OculusControl";

const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();
  const isSupplierUser = Boolean(user?.supplierCode) || (user?.userType || "").toLowerCase() === "supplier";
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
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <RegionsIndex />}
            </ProtectedRoute>
          }
        />
        <Route
          path="districts"
          element={
            <ProtectedRoute permission="districts.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <DistrictsIndex />}
            </ProtectedRoute>
          }
        />
        <Route
          path="depots"
          element={
            <ProtectedRoute permission="depots.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <DepotsIndex />}
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
            <ProtectedRoute permission="transformers.create" disallowSupplier>
              <CreateTransformer />
            </ProtectedRoute>
          }
        />
        <Route
          path="transformers/:id/edit"
          element={
            <ProtectedRoute permission="transformers.update" disallowSupplier>
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
          path="alerts"
          element={
            <ProtectedRoute permission="alerts.read">
              <AlertsIndex />
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
          path="oculus-control"
          element={
            <ProtectedRoute permission="controllers.update" allowedSupplierCodes={["oculus"]}>
              <OculusControlIndex />
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
                {isSupplierUser ? <Navigate to="/dashboard" replace /> : <Users />}
            </ProtectedRoute>
          }
        />
        <Route
          path="roles"
          element={
            <ProtectedRoute permission="roles.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <RolesPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="permissions"
          element={
            <ProtectedRoute permission="permissions.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <PermissionsPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="user-types"
          element={
            <ProtectedRoute permission="usertypes.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <UserTypesPage />}
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
