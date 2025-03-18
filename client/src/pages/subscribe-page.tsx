import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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
  const [selectedPrice, setSelectedPrice] = useState<string>();
  const [clientSecret, setClientSecret] = useState<string>();
  const { toast } = useToast();

  const { data: prices } = useQuery<Price[]>({
    queryKey: ["/api/subscription/prices"],
  });

  useEffect(() => {
    if (!selectedPrice || user?.subscriptionStatus === 'active') return;

    apiRequest("POST", "/api/get-or-create-subscription", { priceId: selectedPrice })
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
  }, [selectedPrice, user]);

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
              className={`relative cursor-pointer transition-all ${
                selectedPrice === price.id ? 'border-primary ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedPrice(price.id)}
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

                {selectedPrice === price.id && clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <SubscribeForm />
                  </Elements>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}