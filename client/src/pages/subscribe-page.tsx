import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface Price {
  id: string;
  unit_amount: number;
  recurring: {
    interval: string;
  };
  product: {
    name: string;
    description: string;
  };
}

export default function SubscribePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: prices } = useQuery<Price[]>({
    queryKey: ["/api/subscription/prices"],
  });

  const handleSubscribe = async (priceId: string) => {
    if (user?.subscriptionStatus === 'active') return;

    setLoading(priceId);
    try {
      const response = await apiRequest("POST", "/api/get-or-create-subscription", { priceId });
      const data = await response.json();

      // Redirect to checkout page with subscription data
      setLocation(`/checkout?session=${data.subscriptionId}&secret=${data.clientSecret}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(undefined);
    }
  };

  if (user?.subscriptionStatus === 'active') {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight">Premium Subscription</h1>
          <Card>
            <CardHeader>
              <CardTitle>Already Subscribed</CardTitle>
              <CardDescription>
                You are already a premium subscriber. Enjoy all the premium features!
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Premium Subscription</h1>
          <p className="text-muted-foreground">
            Choose a plan that works for you
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {prices?.map((price) => (
            <Card 
              key={price.id} 
              className="relative transition-all hover:border-primary"
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <CardTitle>{price.product.name}</CardTitle>
                </div>
                <CardDescription>
                  {price.product.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-2xl font-bold">
                  ${(price.unit_amount / 100).toFixed(2)}/{price.recurring.interval}
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Premium role access
                  </li>
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Enhanced features
                  </li>
                  <li className="flex items-center">
                    <Check className="mr-2 h-4 w-4 text-primary" />
                    Priority support
                  </li>
                </ul>

                <Button 
                  className="w-full"
                  onClick={() => handleSubscribe(price.id)}
                  disabled={loading !== undefined}
                >
                  {loading === price.id ? "Processing..." : "Subscribe Now"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}