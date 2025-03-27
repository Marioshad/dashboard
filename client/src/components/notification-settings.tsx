import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function NotificationSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Helper function to safely convert nullable boolean to required boolean
  const safeBoolean = (value: boolean | null | undefined): boolean => value === true;

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: {
      [key: string]: boolean;
    }) => {
      return await apiRequest("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Settings updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSetting = (key: string, value: boolean) => {
    updateSettingsMutation.mutate({
      [key]: value,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose how you want to be notified about activity in your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="email-notifications">Email Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive email notifications about important updates
            </p>
          </div>
          <Switch
            id="email-notifications"
            checked={user?.emailNotifications === true}
            onCheckedChange={(checked) =>
              updateSetting("emailNotifications", checked)
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="web-notifications">Web Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive notifications in your browser
            </p>
          </div>
          <Switch
            id="web-notifications"
            checked={user?.webNotifications === true}
            onCheckedChange={(checked) =>
              updateSetting("webNotifications", checked)
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="mention-notifications">Mention Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Get notified when someone mentions you
            </p>
          </div>
          <Switch
            id="mention-notifications"
            checked={user?.mentionNotifications === true}
            onCheckedChange={(checked) =>
              updateSetting("mentionNotifications", checked)
            }
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="follow-notifications">Follow Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Get notified when someone follows you
            </p>
          </div>
          <Switch
            id="follow-notifications"
            checked={user?.followNotifications === true}
            onCheckedChange={(checked) =>
              updateSetting("followNotifications", checked)
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}
