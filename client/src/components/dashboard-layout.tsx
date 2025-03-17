import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  LogOut,
  Settings,
  Home,
  Users,
  Shield,
  Key,
  BarChart3, // Changed from Chart to BarChart3 which exists in lucide-react
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [openMenus, setOpenMenus] = useState<string[]>(['users']);

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
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-card border-r min-h-screen p-4">
          <div className="flex flex-col h-full">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold mb-4">Dashboard</h2>
              <nav className="space-y-2">
                <Link href="/">
                  <Button
                    variant={location === "/" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Home
                  </Button>
                </Link>

                {/* Users Section */}
                <Collapsible open={isMenuOpen('users')} onOpenChange={() => toggleMenu('users')}>
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

                <Link href="/profile">
                  <Button
                    variant={location === "/profile" ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                </Link>
              </nav>
            </div>
            <div className="mt-auto">
              <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-secondary">
                <Users className="h-4 w-4" />
                <span className="font-medium">{user?.username}</span>
              </div>
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