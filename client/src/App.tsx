import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import RolesPage from "@/pages/roles-page";
import RolesMap from "@/pages/roles-map";
import PermissionsPage from "@/pages/permissions-page";
import SettingsPage from "@/pages/settings-page";
import UsersPage from "@/pages/users-page";
import SubscribePage from "@/pages/subscribe-page";
import CheckoutPage from "@/pages/checkout-page";
// Import food tracking pages
import InventoryPage from "@/pages/inventory-page";
import LocationsPage from "@/pages/locations-page";
import ReceiptsPage from "@/pages/receipts-page";
import ExpiryTrackerPage from "@/pages/expiry-tracker-page";
import StoresPage from "@/pages/stores-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      {/* Roles and permissions routes */}
      <ProtectedRoute path="/roles" component={RolesPage} />
      <ProtectedRoute path="/roles/map" component={RolesMap} />
      <ProtectedRoute path="/permissions" component={PermissionsPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/users" component={UsersPage} />
      <ProtectedRoute path="/subscribe" component={SubscribePage} />
      <ProtectedRoute path="/checkout" component={CheckoutPage} />
      {/* Food inventory routes */}
      <ProtectedRoute path="/inventory" component={InventoryPage} />
      <ProtectedRoute path="/locations" component={LocationsPage} />
      <ProtectedRoute path="/receipts" component={ReceiptsPage} />
      <ProtectedRoute path="/expiry-tracker" component={ExpiryTrackerPage} />
      <ProtectedRoute path="/stores" component={StoresPage} />
      <ProtectedRoute path="/stores/:storeId" component={StoresPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;