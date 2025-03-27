import { useEffect, useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Make Stripe payment optional
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string>();
  const [isReady, setIsReady] = useState(false);

  // Check if elements are ready
  useEffect(() => {
    if (!stripe || !elements) {
      return;
    }

    const checkElement = async () => {
      const element = elements.getElement(PaymentElement);
      setIsReady(!!element);
    };

    checkElement();
  }, [stripe, elements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !isReady) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/settings`,
        },
        redirect: 'if_required'
      });

      if (result.error) {
        if (result.error.type === 'card_error' || result.error.type === 'validation_error') {
          setError(result.error.message);
        } else {
          setError('An unexpected error occurred.');
        }
        setLoading(false);
      } else if (result.paymentIntent?.status === 'succeeded') {
        toast({
          title: "Payment successful",
          description: "Your subscription has been activated",
        });
        setLocation("/settings");
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setError('Failed to process payment. Please try again.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && (
        <div className="text-sm text-destructive font-medium">
          {error}
        </div>
      )}
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          type="button" 
          onClick={() => setLocation('/subscribe')}
        >
          Back to Plans
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || !elements || !isReady || loading}
        >
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
  const { toast } = useToast();

  useEffect(() => {
    console.log('CheckoutPage mounted', { clientSecret });
    if (!clientSecret || clientSecret === 'undefined') {
      console.error('No valid client secret found in URL');
      setLocation('/subscribe');
    }
  }, [clientSecret, setLocation]);

  // If Stripe is not configured, show error
  if (!stripePromise) {
    useEffect(() => {
      toast({
        title: "Payment Service Unavailable",
        description: "The payment service is currently unavailable. Please contact support.",
        variant: "destructive",
      });
      setLocation('/subscribe');
    }, []);
    return null;
  }

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