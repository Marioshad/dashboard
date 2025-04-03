import DashboardLayout from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Check, Zap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useCurrency } from "@/hooks/use-currency";
import { SUBSCRIPTION_TIERS } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useSubscriptionPricing } from "@/hooks/use-subscription-pricing";

export default function SubscribePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string>();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { formatPrice, currencySymbol } = useCurrency();
  const {
    getPriceForTierAndInterval,
    isPricesLoading,
    isStripeDisabled,
    maxDiscountPercentage,
  } = useSubscriptionPricing();

  const handleSubscribe = async (priceId: string) => {
    if (user?.subscriptionStatus === "active") {
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
          description:
            "The premium subscription system is currently unavailable. Please contact the administrator.",
          variant: "destructive",
        });
        return;
      }

      if (!data.clientSecret) {
        throw new Error("Unable to create subscription. Please try again.");
      }

      // Redirect to checkout page with subscription data
      // Extract the tier from the product metadata
      // First find the tier by matching the price ID with our subscription pricing data
      let tierValue = '';
      
      if (priceId.includes('smart')) {
        tierValue = 'smart';
      } else if (priceId.includes('family') || priceId.includes('pro')) {
        tierValue = 'pro';
      } else {
        // Try to extract from price ID format
        const parts = priceId.split('_');
        if (parts.length >= 3) {
          // Check if any part contains a tier keyword
          for (const part of parts) {
            if (part === 'smart' || part === 'pro' || part === 'family') {
              tierValue = part === 'family' ? 'pro' : part;
              break;
            }
          }
        }
      }
      
      // Use both path param and query param for maximum compatibility
      setLocation(`/checkout/${tierValue}?secret=${data.clientSecret}&tierId=${tierValue}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description:
          error.message || "Failed to create subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(undefined);
    }
  };

  if (user?.subscriptionStatus === "active") {
    // Find the current tier information
    const currentTier =
      SUBSCRIPTION_TIERS.find((tier) => tier.id === user.subscriptionTier) ||
      SUBSCRIPTION_TIERS[0];
    const tierIcon =
      currentTier.id === "free" ? (
        <Shield className="h-6 w-6 text-slate-500" />
      ) : currentTier.id === "smart" ? (
        <Zap className="h-6 w-6 text-amber-500" />
      ) : (
        <Users className="h-6 w-6 text-indigo-500" />
      );

    return (
      <DashboardLayout>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Active Subscription
          </h1>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                {tierIcon}
                <div>
                  <CardTitle>Current Plan: {currentTier.name}</CardTitle>
                  <CardDescription>
                    Your subscription is active. You have access to all{" "}
                    {currentTier.name} features!
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Your Benefits:</h4>
                  <ul className="space-y-2">
                    {currentTier.features.map((feature, i) => (
                      <li key={i} className="flex items-start text-sm">
                        <Check className="mr-2 h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {user.currentBillingPeriodEnd && (
                  <div className="text-sm text-muted-foreground pt-4 border-t">
                    <p>
                      Current billing period ends:{" "}
                      {new Date(
                        user.currentBillingPeriodEnd,
                      ).toLocaleDateString()}
                    </p>
                    {user.subscriptionTier !== "free" &&
                      typeof user.receiptScansLimit === "number" && (
                        <p className="mt-1">
                          Receipt scans used:{" "}
                          {typeof user.receiptScansUsed === "number"
                            ? user.receiptScansUsed
                            : 0}{" "}
                          /
                          {user.receiptScansLimit > 0
                            ? user.receiptScansLimit
                            : "Unlimited"}
                        </p>
                      )}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={() => setLocation("/subscribe")}
                className="w-full"
              >
                Manage Subscription
              </Button>
            </CardFooter>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (isStripeDisabled) {
    return (
      <DashboardLayout>
        <div className="space-y-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Subscription Plans
          </h1>
          <Card>
            <CardHeader>
              <CardTitle>Payment System Disabled</CardTitle>
              <CardDescription>
                Our subscription system is currently unavailable. Please contact
                the administrator for assistance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Administrator: Please set STRIPE_SECRET_KEY and
                VITE_STRIPE_PUBLIC_KEY environment variables to enable the
                payment system.
              </p>
            </CardContent>
          </Card>

          {/* Show plan information even if Stripe is disabled */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6">Available Plans</h2>
            <div className="grid gap-6 lg:grid-cols-3">
              {SUBSCRIPTION_TIERS.map((tier) => (
                <Card key={tier.id} className="relative">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      {tier.id === "free" ? (
                        <Shield className="h-6 w-6 text-slate-500" />
                      ) : tier.id === "smart" ? (
                        <Zap className="h-6 w-6 text-amber-500" />
                      ) : (
                        <Users className="h-6 w-6 text-indigo-500" />
                      )}
                      <CardTitle>{tier.name}</CardTitle>
                    </div>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold mb-4">
                      {tier.id === "free"
                        ? "Free"
                        : `${currencySymbol}${tier.price.monthly}/month or ${currencySymbol}${tier.price.yearly}/year`}
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Features:</h4>
                      <ul className="space-y-2 text-sm">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="flex items-start">
                            <Check className="mr-2 h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const renderTierIcon = (tier: (typeof SUBSCRIPTION_TIERS)[number]) => {
    switch (tier.id) {
      case "free":
        return <Shield className="h-6 w-6 text-slate-500" />;
      case "smart":
        return <Zap className="h-6 w-6 text-amber-500" />;
      case "pro":
        return <Users className="h-6 w-6 text-indigo-500" />;
      default:
        return <Shield className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Subscription Plans
          </h1>
          <p className="text-muted-foreground">
            Choose a plan that works for your needs
          </p>
        </div>

        {isPricesLoading ? (
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-4">
                  <div className="h-6 bg-muted rounded-md w-1/3" />
                  <div className="h-4 bg-muted rounded-md w-2/3" />
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="h-8 bg-muted rounded-md w-1/4" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-4 bg-muted rounded-md w-3/4" />
                    ))}
                  </div>
                  <div className="h-10 bg-muted rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <>
            <Tabs defaultValue="monthly" className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList>
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly">
                    Yearly
                    <Badge variant="outline" className="ml-2 bg-primary/10">
                      Save up to {maxDiscountPercentage}%
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="monthly" className="mt-0">
                <div className="grid gap-6 md:grid-cols-3">
                  {SUBSCRIPTION_TIERS.map((tier) => {
                    const price = getPriceForTierAndInterval(
                      tier.id,
                      "monthly",
                    );
                    const isFree = tier.id === "free";

                    return (
                      <Card
                        key={tier.id}
                        className={`relative transition-all ${
                          tier.id === "smart"
                            ? "border-primary"
                            : "hover:border-primary"
                        }`}
                      >
                        {tier.id === "smart" && (
                          <div className="absolute -top-3 left-0 right-0 flex justify-center">
                            <Badge className="bg-primary hover:bg-primary">
                              Popular
                            </Badge>
                          </div>
                        )}
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            {renderTierIcon(tier)}
                            <CardTitle>{tier.name}</CardTitle>
                          </div>
                          <CardDescription>{tier.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-3xl font-bold">
                            {isFree ? (
                              "Free"
                            ) : (
                              <>
                                {price ? (
                                  <>
                                    {currencySymbol}
                                    {(price.unit_amount / 100).toFixed(2)}
                                    <span className="text-sm font-normal text-muted-foreground">
                                      /month
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {currencySymbol}
                                    {tier.price.monthly}
                                    <span className="text-sm font-normal text-muted-foreground">
                                      /month
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">
                              What's included:
                            </h4>
                            <ul className="space-y-2 text-sm">
                              {tier.features.map((feature, i) => (
                                <li key={i} className="flex items-start">
                                  <Check className="mr-2 h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className={`w-full ${isFree ? "bg-muted hover:bg-muted/80 text-foreground" : ""}`}
                            onClick={() => price && handleSubscribe(price.id)}
                            disabled={
                              loading !== undefined ||
                              (isFree && user?.subscriptionTier === "free")
                            }
                            variant={isFree ? "outline" : "default"}
                          >
                            {loading === price?.id
                              ? "Processing..."
                              : isFree
                                ? user?.subscriptionTier === "free"
                                  ? "Current Plan"
                                  : "Downgrade"
                                : price
                                  ? "Subscribe"
                                  : "Loading Plan..."}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="yearly" className="mt-0">
                <div className="grid gap-6 md:grid-cols-3">
                  {SUBSCRIPTION_TIERS.map((tier) => {
                    const price = getPriceForTierAndInterval(tier.id, "yearly");
                    const isFree = tier.id === "free";

                    return (
                      <Card
                        key={tier.id}
                        className={`relative transition-all ${
                          tier.id === "smart"
                            ? "border-primary"
                            : "hover:border-primary"
                        }`}
                      >
                        {tier.id === "smart" && (
                          <div className="absolute -top-3 left-0 right-0 flex justify-center">
                            <Badge className="bg-primary hover:bg-primary">
                              Popular
                            </Badge>
                          </div>
                        )}
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            {renderTierIcon(tier)}
                            <CardTitle>{tier.name}</CardTitle>
                          </div>
                          <CardDescription>{tier.description}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="text-3xl font-bold">
                            {isFree ? (
                              "Free"
                            ) : (
                              <>
                                {price ? (
                                  <>
                                    {currencySymbol}
                                    {(price.unit_amount / 100).toFixed(2)}
                                    <span className="text-sm font-normal text-muted-foreground">
                                      /year
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {currencySymbol}
                                    {tier.price.yearly}
                                    <span className="text-sm font-normal text-muted-foreground">
                                      /year
                                    </span>
                                  </>
                                )}
                              </>
                            )}
                          </div>

                          {!isFree && price?.discount_percentage && (
                            <div className="flex flex-col gap-1 text-sm">
                              <div className="inline-flex items-center text-emerald-600 font-medium">
                                <span className="mr-1">
                                  Save {price.discount_percentage}%
                                </span>
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-50 text-emerald-600 border-emerald-200"
                                >
                                  {currencySymbol}
                                  {(price.total_savings! / 100).toFixed(2)}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground">
                                Equals {currencySymbol}
                                {(price.monthly_equivalent! / 100).toFixed(2)}
                                /month
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <h4 className="text-sm font-medium">
                              What's included:
                            </h4>
                            <ul className="space-y-2 text-sm">
                              {tier.features.map((feature, i) => (
                                <li key={i} className="flex items-start">
                                  <Check className="mr-2 h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </CardContent>
                        <CardFooter>
                          <Button
                            className={`w-full ${isFree ? "bg-muted hover:bg-muted/80 text-foreground" : ""}`}
                            onClick={() => price && handleSubscribe(price.id)}
                            disabled={
                              loading !== undefined ||
                              (isFree && user?.subscriptionTier === "free")
                            }
                            variant={isFree ? "outline" : "default"}
                          >
                            {loading === price?.id
                              ? "Processing..."
                              : isFree
                                ? user?.subscriptionTier === "free"
                                  ? "Current Plan"
                                  : "Downgrade"
                                : price
                                  ? "Subscribe"
                                  : "Loading Plan..."}
                          </Button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
