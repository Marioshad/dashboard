import DashboardLayout from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, ServerCog, CreditCard } from "lucide-react";
import { Link } from "wouter";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to the administration dashboard. Here you can manage system configuration,
          external service integrations, and more.
        </p>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Stripe Settings</CardTitle>
              <CreditCard className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Configure Stripe product IDs, price IDs, and other payment settings.
              </CardDescription>
              <Link 
                href="/admin/stripe-settings" 
                className={cn(buttonVariants({ variant: "default" }), "w-full")}
              >
                Manage Stripe Settings
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">System</CardTitle>
              <Database className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                View system status, logs, and perform maintenance tasks.
              </CardDescription>
              <Link 
                href="/admin/system" 
                className={cn(buttonVariants({ variant: "default" }), "w-full")}
              >
                System Dashboard
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">Server Settings</CardTitle>
              <ServerCog className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Configure server parameters, caching, and service integrations.
              </CardDescription>
              <Link 
                href="/admin/server" 
                className={cn(buttonVariants({ variant: "default" }), "w-full")}
              >
                Server Configuration
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}