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
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar"; // Assuming Navbar component exists

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>(['users', 'home', 'food']);

  const isAdmin = user?.roleId === 1 || user?.roleId === 2; // Superadmin or Admin

  const isMenuOpen = (menu: string) => openMenus.includes(menu);
  const toggleMenu = (menu: string) => {
    setOpenMenus(prev =>
      prev.includes(menu)
        ? prev.filter(m => m !== menu)
        : [...prev, menu]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex">
        <aside className="w-64 bg-card border-r min-h-[calc(100vh-4rem)] p-4">
          <div className="flex flex-col h-full">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold mb-4">Dashboard</h2>
              <nav className="space-y-2">
                {/* Home Section */}
                <Collapsible
                  open={isMenuOpen('home')}
                  onOpenChange={() => toggleMenu('home')}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-between",
                        isMenuOpen('home') && "bg-accent"
                      )}
                    >
                      <span className="flex items-center">
                        <Home className="mr-2 h-4 w-4" />
                        Home
                      </span>
                      <span className={cn(
                        "transition-transform",
                        isMenuOpen('home') && "rotate-90"
                      )}>›</span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 space-y-1">
                    <Link href="/profile">
                      <Button
                        variant={location === "/profile" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <UserCircle className="mr-2 h-4 w-4" />
                        Profile
                      </Button>
                    </Link>
                  </CollapsibleContent>
                </Collapsible>

                {/* Subscription Section */}
                <Link href="/subscribe">
                  <Button
                    variant={location === "/subscribe" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Premium Subscription
                  </Button>
                </Link>

                {/* Food Inventory Section */}
                <Collapsible
                  open={isMenuOpen('food')}
                  onOpenChange={() => toggleMenu('food')}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-between",
                        isMenuOpen('food') && "bg-accent"
                      )}
                    >
                      <span className="flex items-center">
                        <Apple className="mr-2 h-4 w-4" />
                        Food Inventory
                      </span>
                      <span className={cn(
                        "transition-transform",
                        isMenuOpen('food') && "rotate-90"
                      )}>›</span>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 space-y-1">
                    <Link href="/inventory">
                      <Button
                        variant={location === "/inventory" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <Apple className="mr-2 h-4 w-4" />
                        All Items
                      </Button>
                    </Link>
                    <Link href="/locations">
                      <Button
                        variant={location === "/locations" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <Warehouse className="mr-2 h-4 w-4" />
                        Locations
                      </Button>
                    </Link>
                    <Link href="/shopping-list">
                      <Button
                        variant={location === "/shopping-list" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Shopping List
                      </Button>
                    </Link>
                    <Link href="/receipts">
                      <Button
                        variant={location === "/receipts" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        Receipt Upload
                      </Button>
                    </Link>
                    <Link href="/expiry-tracker">
                      <Button
                        variant={location === "/expiry-tracker" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <CalendarClock className="mr-2 h-4 w-4" />
                        Expiry Dates
                      </Button>
                    </Link>
                    <Link href="/analytics">
                      <Button
                        variant={location === "/analytics" ? "secondary" : "ghost"}
                        className="w-full justify-start"
                      >
                        <LineChart className="mr-2 h-4 w-4" />
                        Analytics
                      </Button>
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
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-between",
                          isMenuOpen('users') && "bg-accent"
                        )}
                      >
                        <span className="flex items-center">
                          <Users className="mr-2 h-4 w-4" />
                          Users
                        </span>
                        <span className={cn(
                          "transition-transform",
                          isMenuOpen('users') && "rotate-90"
                        )}>›</span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-1">
                      <Link href="/users">
                        <Button
                          variant={location === "/users" ? "secondary" : "ghost"}
                          className="w-full justify-start"
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Users List
                        </Button>
                      </Link>
                      <Link href="/roles">
                        <Button
                          variant={location === "/roles" ? "secondary" : "ghost"}
                          className="w-full justify-start"
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Roles
                        </Button>
                      </Link>
                      <Link href="/roles/map">
                        <Button
                          variant={location === "/roles/map" ? "secondary" : "ghost"}
                          className="w-full justify-start"
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Roles Map
                        </Button>
                      </Link>
                      <Link href="/permissions">
                        <Button
                          variant={location === "/permissions" ? "secondary" : "ghost"}
                          className="w-full justify-start"
                        >
                          <Key className="mr-2 h-4 w-4" />
                          Permissions
                        </Button>
                      </Link>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </nav>
            </div>

            <div className="mt-auto space-y-4">
              {/* Settings */}
              <Link href="/settings">
                <Button
                  variant={location === "/settings" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>

              {/* User Profile */}
              <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-secondary">
                <UserCircle className="h-4 w-4" />
                <span className="font-medium">{user?.username}</span>
              </div>

              {/* Logout */}
              <Button
                variant="destructive"
                className="w-full"
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
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}