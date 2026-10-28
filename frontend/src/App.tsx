import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { lazyPage } from "./lib/lazyPage";
import SignIn from "./pages/AuthPages/SignIn";
const SignUp = lazyPage(() => import("./pages/AuthPages/SignUp"));
const UserProfiles = lazyPage(() => import("./pages/UserProfiles"));
const Users = lazyPage(() => import("./pages/UserManagement/Users"));
const RolesPage = lazyPage(() => import("./pages/UserManagement/Roles"));
const PermissionsPage = lazyPage(() => import("./pages/UserManagement/Permissions"));
const UserTypesPage = lazyPage(() => import("./pages/UserManagement/UserTypes"));
const ForbiddenPage = lazyPage(() => import("./pages/UserManagement/Forbidden"));
const Calendar = lazyPage(() => import("./pages/Calendar"));
const Blank = lazyPage(() => import("./pages/Blank"));
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ProtectedRoute from "./components/ProtectedRoute"
const DashboardHome = lazyPage(() => import("./pages/Dashboard/DashboardHome"));
const TransformerDetail = lazyPage(() => import("./pages/Dashboard/TransformerDetail"));
const RegionsIndex = lazyPage(() => import("./pages/Regions"));
const DistrictsIndex = lazyPage(() => import("./pages/Districts"));
const DepotsIndex = lazyPage(() => import("./pages/Depots"));
const NewControllersIndex = lazyPage(() => import("./pages/NewControllers"));
const EditController = lazyPage(() => import("./pages/NewControllers/EditController"));
const CreateTransformer = lazyPage(() => import("./pages/Transformers/CreateTransformer"));
const EditTransformer = lazyPage(() => import("./pages/Transformers/EditTransformer"));
const AlertsIndex = lazyPage(() => import("./pages/Alerts"));
const SiteIndex = lazyPage(() => import("./pages/Site"));
const PartnersPage = lazyPage(() => import("./pages/Partners"));
const PartnerDetail = lazyPage(() => import("./pages/Partners/PartnerDetail"));
const NotificationCenter = lazyPage(() => import("./pages/NotificationCenter"));
const GatewaysIndex = lazyPage(() => import("./pages/Gateways"));
const GatewaysMapIndex = lazyPage(() => import("./pages/Gateways/Map"));
const SimsIndex = lazyPage(() => import("./pages/Sims"));
const ResponseDesk = lazyPage(() => import("./pages/Response"));
const FleetPage = lazyPage(() => import("./pages/Response/Fleet"));
const CrewRespond = lazyPage(() => import("./pages/Response/CrewRespond"));
const TransformerRegistry = lazyPage(() => import("./pages/Registry"));
const InsightsPage = lazyPage(() => import("./pages/Insights"));
const ReportsPage = lazyPage(() => import("./pages/Reports"));
const IntegrationsPage = lazyPage(() => import("./pages/Integrations"));

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
          path="reports"
          element={
            <ProtectedRoute scopes={["NATIONAL", "DEPOT"]} depotAnyOf={["gateways.view", "transformers.read"]} permission="gateways.view" disallowSupplier>
              <ReportsPage />
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
