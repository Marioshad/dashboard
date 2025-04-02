import React, { useState, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import DashboardLayout from '@/components/dashboard-layout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getSubscriptionTier } from '@/lib/subscription';

// Load Stripe outside of component render to avoid recreating the Stripe object on every render
// Make sure the key exists
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.error('Missing required environment variable: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

export default function CheckoutPage() {
  const [match, params] = useRoute('/checkout/:tierId');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const tierId = params?.tierId;
  const tier = tierId ? getSubscriptionTier(tierId) : null;

  useEffect(() => {
    // If no tier ID in URL or tier doesn't exist, redirect to subscribe page
    if (!tierId || !tier || tierId === 'free') {
      setLocation('/subscribe');
      return;
    }

    async function createPaymentIntent() {
      setLoading(true);
      setError(null);
      
      try {
        // Create the subscription to get the client secret
        const response = await apiRequest('/api/billing/create-subscription', { 
          method: 'POST',
          body: JSON.stringify({ 
            tierId,
            interval: 'monthly' // We could make this configurable later
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to create subscription');
        }
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('No client secret returned');
        }
      } catch (err: any) {
        console.error('Error creating payment intent:', err);
        setError(err.message || 'Failed to initialize checkout. Please try again.');
        toast({
          title: 'Checkout Error',
          description: err.message || 'Failed to initialize checkout. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }
    
    createPaymentIntent();
  }, [tierId, toast, setLocation]);
  
  // Stripe Elements options
  const options = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#4f46e5',
        colorBackground: '#ffffff',
        colorText: '#1f2937',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        borderRadius: '8px',
      },
    },
  } : {};
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Upgrade Your Plan</h1>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Preparing your checkout...</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Checkout Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex justify-center">
              <Button onClick={() => setLocation('/subscribe')}>
                Return to Plans
              </Button>
            </div>
          </div>
        ) : clientSecret && tier ? (
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm 
              clientSecret={clientSecret} 
              tierId={tierId || ""} 
              returnUrl="/billing"
            />
          </Elements>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No payment information available.</p>
            <Button onClick={() => setLocation('/subscribe')}>
              Return to Plans
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}