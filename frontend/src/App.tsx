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
import NewControllersIndex from "./pages/NewControllers";
import EditController from "./pages/NewControllers/EditController";
import CreateTransformer from "./pages/Transformers/CreateTransformer";
import EditTransformer from "./pages/Transformers/EditTransformer";
import AlertsIndex from "./pages/Alerts";
import SiteIndex from "./pages/Site";
import PartnersPage from "./pages/Partners";
import PartnerDetail from "./pages/Partners/PartnerDetail";
import NotificationCenter from "./pages/NotificationCenter";
import GatewaysIndex from "./pages/Gateways";
import GatewaysMapIndex from "./pages/Gateways/Map";
import SimsIndex from "./pages/Sims";
import ResponseDesk from "./pages/Response";
import FleetPage from "./pages/Response/Fleet";
import CrewRespond from "./pages/Response/CrewRespond";
import TransformerRegistry from "./pages/Registry";
import InsightsPage from "./pages/Insights";
import IntegrationsPage from "./pages/Integrations";

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
        <Route
          path="dashboard/:view"
          element={
            <ProtectedRoute permission="dashboard.read">
              <DashboardHome />
            </ProtectedRoute>
          }
        />
        <Route path="signin" element={<Navigate to="/" replace />} />
        <Route path="signup" element={<Navigate to="/" replace />} />
        <Route path="profile" element={<UserProfiles />} />
        <Route path="notification-settings" element={<NotificationCenter />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="blank" element={<Blank />} />
        <Route
          path="regions"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="regions.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <RegionsIndex />}
            </ProtectedRoute>
          }
        />
        <Route
          path="districts"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="districts.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <DistrictsIndex />}
            </ProtectedRoute>
          }
        />
        <Route
          path="depots"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="depots.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <DepotsIndex />}
            </ProtectedRoute>
          }
        />
        <Route
          path="transformers"
          element={
            <ProtectedRoute permission="transformers.read">
              <TransformerRegistry />
            </ProtectedRoute>
          }
        />
        <Route path="transformers/classic" element={<Navigate to="/transformers" replace />} />
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
        {/* Sensors were retired: the system works with controllers only. */}
        <Route path="sensors" element={<Navigate to="/transformers" replace />} />
        <Route
          path="gateways"
          element={
            <ProtectedRoute scopes={["NATIONAL", "DEPOT"]} depotAnyOf={["gateways.view", "transformers.read"]} permission="gateways.view" disallowSupplier>
              <GatewaysIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="gateways-map"
          element={
            <ProtectedRoute scopes={["NATIONAL", "DEPOT"]} depotAnyOf={["gateways.view", "transformers.read"]} permission="gateways.view" disallowSupplier>
              <GatewaysMapIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="sims"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="sims.view" disallowSupplier>
              <SimsIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="new-controllers"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="controllers.read">
              <NewControllersIndex />
            </ProtectedRoute>
          }
        />
        <Route
          path="new-controllers/:id/edit"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="controllers.update">
              <EditController />
            </ProtectedRoute>
          }
        />
        <Route
          path="insights"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="dashboard.read">
              <InsightsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="insights/depots"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="dashboard.read">
              <InsightsPage view="depots" />
            </ProtectedRoute>
          }
        />
        <Route
          path="integrations"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="integrations.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <IntegrationsPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="response"
          element={
            <ProtectedRoute permission="response.read">
              <ResponseDesk />
            </ProtectedRoute>
          }
        />
        <Route
          path="fleet"
          element={
            <ProtectedRoute scopes={["NATIONAL", "DEPOT"]} permission="fleet.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <FleetPage />}
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
            <ProtectedRoute permission="sites.read" depotAnyOf={["sites.read", "transformers.read"]}>
              <SiteIndex />
            </ProtectedRoute>
          }
        />
        <Route path="oculus-control" element={<Navigate to="/partners/oculus" replace />} />
        <Route
          path="partners"
          element={
            <ProtectedRoute permission="controllers.read">
              <PartnersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="partners/:code"
          element={
            <ProtectedRoute permission="controllers.read">
              <PartnerDetail />
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
            <ProtectedRoute scopes={["NATIONAL"]} permission="users.read">
                {isSupplierUser ? <Navigate to="/dashboard" replace /> : <Users />}
            </ProtectedRoute>
          }
        />
        <Route
          path="roles"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="roles.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <RolesPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="permissions"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="permissions.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <PermissionsPage />}
            </ProtectedRoute>
          }
        />
        <Route
          path="user-types"
          element={
            <ProtectedRoute scopes={["NATIONAL"]} permission="usertypes.read">
              {isSupplierUser ? <Navigate to="/dashboard" replace /> : <UserTypesPage />}
            </ProtectedRoute>
          }
        />
      </Route>
      {/* Crew response link (also works when someone is logged in on the same phone) */}
      <Route path="/respond/:token" element={<CrewRespond />} />
    </Routes>
  ) : (
    <Routes>
      {/* Crew response link: public, the token in the URL is the credential */}
      <Route path="/respond/:token" element={<CrewRespond />} />
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
