import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function SubscribePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // This will be implemented once we have Stripe keys
  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // Stripe subscription logic will go here
    } catch (error) {
      console.error('Subscription error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Premium Subscription</h1>
          <p className="text-muted-foreground">
            Upgrade your account to access premium features
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="relative">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Premium Plan</CardTitle>
              </div>
              <CardDescription>
                Access enhanced features and capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">$9.99/month</div>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  Premium role access
                </li>
                <li className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  Enhanced features
                </li>
                <li className="flex items-center">
                  <Shield className="mr-2 h-4 w-4" />
                  Priority support
                </li>
              </ul>
              <Button 
                className="w-full" 
                onClick={handleSubscribe}
                disabled={loading || user?.subscriptionStatus === 'active'}
              >
                {user?.subscriptionStatus === 'active' 
                  ? 'Already Subscribed' 
                  : loading 
                    ? 'Processing...' 
                    : 'Subscribe Now'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
