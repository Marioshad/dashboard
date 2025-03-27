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
import { useCurrency } from "@/hooks/use-currency";

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
  const { formatPrice, currencySymbol } = useCurrency();

  const { data: prices, isLoading: isPricesLoading, error: pricesError } = useQuery<Price[]>({
    queryKey: ["/api/subscription/prices"],
  });

  const handleSubscribe = async (priceId: string) => {
    if (user?.subscriptionStatus === 'active') {
      toast({
        title: "Already Subscribed",
        description: "You already have an active subscription.",
      });
      return;
    }

    setLoading(priceId);
    try {
      const data = await apiRequest("/api/get-or-create-subscription", {
        method: "POST",
        body: JSON.stringify({ priceId }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      // Check if Stripe is disabled
      if (data.stripeDisabled) {
        toast({
          title: "Payment System Unavailable",
          description: "The premium subscription system is currently unavailable. Please contact the administrator.",
          variant: "destructive",
        });
        return;
      }
      
      if (!data.clientSecret) {
        throw new Error('Unable to create subscription. Please try again.');
      }

      // Redirect to checkout page with subscription data
      setLocation(`/checkout?secret=${data.clientSecret}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || 'Failed to create subscription. Please try again.',
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

  if (pricesError) {
    const error = pricesError as any;
    const isPaymentDisabled = error?.stripeDisabled;

    return (
      <DashboardLayout>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight">Premium Subscription</h1>
          <Card>
            <CardHeader>
              <CardTitle>
                {isPaymentDisabled ? "Payment System Disabled" : "Error Loading Plans"}
              </CardTitle>
              <CardDescription>
                {isPaymentDisabled 
                  ? "The premium subscription system is currently unavailable. Please contact the administrator for assistance."
                  : "We encountered an error loading the subscription plans. Please try again later."}
              </CardDescription>
            </CardHeader>
            {isPaymentDisabled && (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Administrator: Please set STRIPE_SECRET_KEY and VITE_STRIPE_PUBLIC_KEY environment variables to enable payments.
                </p>
              </CardContent>
            )}
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

        {isPricesLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-4">
                  <div className="h-6 bg-muted rounded-md w-1/3" />
                  <div className="h-4 bg-muted rounded-md w-2/3" />
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="h-8 bg-muted rounded-md w-1/4" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-4 bg-muted rounded-md w-3/4" />
                    ))}
                  </div>
                  <div className="h-10 bg-muted rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
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
                    {formatPrice(price.unit_amount)}/{price.recurring.interval}
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
        )}
      </div>
    </DashboardLayout>
  );
}