import { useEffect, useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {} 
          }
        },
        redirect: "if_required"
      });

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Payment successful
        toast({
          title: "Payment successful",
          description: "Your subscription has been activated",
        });
        // Redirect to settings page after successful payment
        setLocation("/settings");
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
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <div className="flex justify-between">
        <Button variant="outline" type="button" onClick={() => setLocation('/subscribe')}>
          Back to Plans
        </Button>
        <Button type="submit" disabled={!stripe || loading}>
          {loading ? "Processing..." : "Complete Payment"}
        </Button>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const clientSecret = params.get('secret');
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!clientSecret || clientSecret === 'undefined') {
      console.error('No valid client secret found in URL');
      setLocation('/subscribe');
    }
  }, [clientSecret, setLocation]);

  if (!clientSecret || clientSecret === 'undefined') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Complete Your Subscription</CardTitle>
          <CardDescription>
            Enter your payment details to start your premium subscription
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm />
          </Elements>
        </CardContent>
      </Card>
    </div>
  );
}