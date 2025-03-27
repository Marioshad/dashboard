import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Shield } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { NotificationSettings } from "@/components/notification-settings";
import { FoodTrackerTest } from "@/components/food-tracker-test";

interface AdminSettings {
  require2FA: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  // Check role ID for admin status
  const isAdmin = (user?.roleId === 1 || user?.roleId === 2); // Superadmin or Admin

  const { data: adminSettings } = useQuery<AdminSettings>({
    queryKey: ["/api/settings/admin"],
    enabled: isAdmin,
  });

  const updateAdminSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<AdminSettings>) => {
      const response = await fetch("/api/settings/admin", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error("Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/admin"] });
      toast({
        title: "Settings updated",
        description: "The settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggle2FAMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await fetch("/api/user/2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled }),
      });
      if (!response.ok) {
        throw new Error("Failed to update 2FA settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "2FA settings updated",
        description: "Your two-factor authentication settings have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your application settings and security preferences
          </p>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Admin Settings</CardTitle>
              </div>
              <CardDescription>
                Configure global security settings and authentication requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="require2fa">Require Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, all users will be required to set up 2FA
                  </p>
                </div>
                <Switch
                  id="require2fa"
                  checked={adminSettings?.require2FA}
                  onCheckedChange={(checked) => {
                    updateAdminSettingsMutation.mutate({
                      require2FA: checked,
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enhance your account security with two-factor authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <Label htmlFor="2fa">Enable 2FA for your account</Label>
                <p className="text-sm text-muted-foreground">
                  Use an authenticator app to add an extra layer of security
                </p>
              </div>
              <Switch
                id="2fa"
                checked={user?.twoFactorEnabled}
                disabled={!adminSettings?.require2FA && !isAdmin}
                onCheckedChange={(checked) => {
                  toggle2FAMutation.mutate(checked);
                }}
              />
            </div>
            {!adminSettings?.require2FA && !isAdmin && (
              <p className="text-sm text-muted-foreground">
                Two-factor authentication is currently disabled by your administrator
              </p>
            )}
          </CardContent>
        </Card>

        {/* Add the NotificationSettings component */}
        <NotificationSettings />
        
        {/* Food Tracker Test Component */}
        <FoodTrackerTest />
      </div>
    </DashboardLayout>
  );
}