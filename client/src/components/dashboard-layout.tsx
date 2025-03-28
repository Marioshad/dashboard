import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  LogOut,
  Settings,
  Home,
  Users,
  Shield,
  Key,
  BarChart3,
  UserCircle,
  Warehouse,
  ShoppingCart,
  Apple,
  CalendarClock,
  LineChart,
  Receipt,
  Building,
  Menu,
  X,
  Tag,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar"; // Assuming Navbar component exists
import { useIsMobile } from "@/hooks/use-mobile"; // Use the existing mobile hook

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>(['users', 'home', 'food']);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  // Close sidebar by default on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);

  // Check role ID for admin status
  const isAdmin = (user?.roleId === 1 || user?.roleId === 2); // Superadmin or Admin

  const isMenuOpen = (menu: string) => openMenus.includes(menu);
  const toggleMenu = (menu: string) => {
    setOpenMenus(prev =>
      prev.includes(menu)
        ? prev.filter(m => m !== menu)
        : [...prev, menu]
    );
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  return (
    <div className="dashboard-layout">
      <div className="navbar-container">
        <Navbar />
        
        {/* Mobile sidebar toggle button */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="mobile-sidebar-toggle fixed top-4 left-4 z-50"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        )}
      </div>
      
      {/* Sidebar */}
      <aside className={cn(
        "fruity-sidebar-gradient",
        isMobile && "mobile-sidebar",
        isMobile && !sidebarOpen && "mobile-sidebar-hidden",
        isMobile && sidebarOpen && "mobile-sidebar-visible"
      )}>
        <div className="flex flex-col h-full py-6 px-3">
          {/* App Logo/Brand */}
          <div className="px-3 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Apple className="h-8 w-8 text-primary mr-2" />
                <h2 className="text-xl font-bold text-dark">FoodVault</h2>
              </div>
              
              {/* Close button visible only on mobile when sidebar is open */}
              {isMobile && sidebarOpen && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="sidebar-close-btn"
                  onClick={toggleSidebar}
                  aria-label="Close sidebar"
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="space-y-1 mb-6">
            {/* Home Section */}
            <Collapsible
              open={isMenuOpen('home')}
              onOpenChange={() => toggleMenu('home')}
            >
              <CollapsibleTrigger asChild>
                <div className={cn(
                  "nav-link cursor-pointer",
                  (location === "/" || location === "/profile") && "active"
                )}>
                  <span className="flex items-center">
                    <Home className="nav-link-icon" />
                    Dashboard
                  </span>
                  <span className={cn(
                    "transition-transform ml-auto",
                    isMenuOpen('home') && "rotate-90"
                  )}>›</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 mt-1 space-y-1">
                <Link href="/profile">
                  <div className={cn(
                    "nav-link",
                    location === "/profile" && "active"
                  )}>
                    <UserCircle className="nav-link-icon" />
                    Profile
                  </div>
                </Link>
              </CollapsibleContent>
            </Collapsible>

            {/* Subscription Section */}
            <Link href="/subscribe">
              <div className={cn(
                "nav-link",
                location === "/subscribe" && "active"
              )}>
                <Shield className="nav-link-icon" />
                Premium
              </div>
            </Link>

            {/* Food Inventory Section */}
            <Collapsible
              open={isMenuOpen('food')}
              onOpenChange={() => toggleMenu('food')}
            >
              <CollapsibleTrigger asChild>
                <div className={cn(
                  "nav-link cursor-pointer",
                  ["/inventory", "/locations", "/shopping-list", "/receipts", "/expiry-tracker", "/analytics", "/stores", "/tags"].includes(location) && "active"
                )}>
                  <span className="flex items-center">
                    <Apple className="nav-link-icon" />
                    Food Inventory
                  </span>
                  <span className={cn(
                    "transition-transform ml-auto",
                    isMenuOpen('food') && "rotate-90"
                  )}>›</span>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 mt-1 space-y-1">
                <Link href="/inventory">
                  <div className={cn(
                    "nav-link",
                    location === "/inventory" && "active"
                  )}>
                    <Apple className="nav-link-icon" />
                    All Items
                  </div>
                </Link>
                <Link href="/locations">
                  <div className={cn(
                    "nav-link",
                    location === "/locations" && "active"
                  )}>
                    <Warehouse className="nav-link-icon" />
                    Locations
                  </div>
                </Link>
                <Link href="/shopping-list">
                  <div className={cn(
                    "nav-link",
                    location === "/shopping-list" && "active"
                  )}>
                    <ShoppingCart className="nav-link-icon" />
                    Shopping List
                  </div>
                </Link>
                <Link href="/receipts">
                  <div className={cn(
                    "nav-link",
                    location === "/receipts" && "active"
                  )}>
                    <Receipt className="nav-link-icon" />
                    Receipt Upload
                  </div>
                </Link>
                <Link href="/expiry-tracker">
                  <div className={cn(
                    "nav-link",
                    location === "/expiry-tracker" && "active"
                  )}>
                    <CalendarClock className="nav-link-icon" />
                    Expiry Dates
                  </div>
                </Link>
                <Link href="/stores">
                  <div className={cn(
                    "nav-link",
                    location === "/stores" && "active"
                  )}>
                    <Building className="nav-link-icon" />
                    Stores
                  </div>
                </Link>
                <Link href="/tags">
                  <div className={cn(
                    "nav-link",
                    location === "/tags" && "active"
                  )}>
                    <Tag className="nav-link-icon" />
                    Tags
                  </div>
                </Link>
                <Link href="/analytics">
                  <div className={cn(
                    "nav-link",
                    location === "/analytics" && "active"
                  )}>
                    <LineChart className="nav-link-icon" />
                    Analytics
                  </div>
                </Link>
              </CollapsibleContent>
            </Collapsible>

            {/* Users Section - Only visible to admins */}
            {isAdmin && (
              <Collapsible
                open={isMenuOpen('users')}
                onOpenChange={() => toggleMenu('users')}
              >
                <CollapsibleTrigger asChild>
                  <div className={cn(
                    "nav-link cursor-pointer",
                    ["/users", "/roles", "/roles/map", "/permissions"].includes(location) && "active"
                  )}>
                    <span className="flex items-center">
                      <Users className="nav-link-icon" />
                      Users & Roles
                    </span>
                    <span className={cn(
                      "transition-transform ml-auto",
                      isMenuOpen('users') && "rotate-90"
                    )}>›</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-6 mt-1 space-y-1">
                  <Link href="/users">
                    <div className={cn(
                      "nav-link",
                      location === "/users" && "active"
                    )}>
                      <Users className="nav-link-icon" />
                      Users List
                    </div>
                  </Link>
                  <Link href="/roles">
                    <div className={cn(
                      "nav-link",
                      location === "/roles" && "active"
                    )}>
                      <Shield className="nav-link-icon" />
                      Roles
                    </div>
                  </Link>
                  <Link href="/roles/map">
                    <div className={cn(
                      "nav-link",
                      location === "/roles/map" && "active"
                    )}>
                      <BarChart3 className="nav-link-icon" />
                      Roles Map
                    </div>
                  </Link>
                  <Link href="/permissions">
                    <div className={cn(
                      "nav-link",
                      location === "/permissions" && "active"
                    )}>
                      <Key className="nav-link-icon" />
                      Permissions
                    </div>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <div className="mt-auto space-y-4 px-3">
            {/* Settings */}
            <Link href="/settings">
              <div className={cn(
                "nav-link",
                location === "/settings" && "active"
              )}>
                <Settings className="nav-link-icon" />
                Settings
              </div>
            </Link>

            {/* User Profile */}
            <div className="fruity-profile-card flex items-center gap-2 p-3 mb-4">
              <div className="flex items-center justify-center bg-primary/10 h-10 w-10 rounded-lg text-primary">
                <UserCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-dark text-sm">{user?.username}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>

            {/* Logout */}
            <Button
              className="w-full fruity-logout-btn"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="dashboard-content">
        <main className="fruity-main-content">{children}</main>
      </div>
      
      {/* Mobile sidebar overlay - only shown when sidebar is open on mobile */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-30"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}
    </div>
  );
}