import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function SubscribeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/settings`,
        },
      });

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={!stripe || loading} className="w-full">
        {loading ? "Processing..." : "Subscribe Now"}
      </Button>
    </form>
  );
}

export default function SubscribePage() {
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState<string>();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.subscriptionStatus === 'active') return;

    apiRequest("POST", "/api/get-or-create-subscription")
      .then((res) => res.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
      })
      .catch((error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      });
  }, [user]);

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
            <CardContent className="space-y-6">
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

              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <SubscribeForm />
                </Elements>
              ) : (
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}