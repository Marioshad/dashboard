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
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [tierId, setTierId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Match /:tierId route pattern if available
  const [match, params] = useRoute('/checkout/:tierId');
  
  useEffect(() => {
    async function initializeCheckout() {
      try {
        // Get the client secret from the URL query parameters
        const queryParams = new URLSearchParams(window.location.search);
        const secretFromUrl = queryParams.get('secret');
        
        // Determine the tier ID using both route params and query params
        let foundTierId: string | undefined = undefined;
        
        // First check route params (highest priority)
        if (match && params && params.tierId) {
          foundTierId = params.tierId;
          console.log('Found tier ID from route params:', foundTierId);
        }
        
        // Then check query params
        const tierIdFromQuery = queryParams.get('tierId');
        if (!foundTierId && tierIdFromQuery) {
          foundTierId = tierIdFromQuery;
          console.log('Found tier ID from query params:', foundTierId);
        }
        
        // If we still don't have a tier ID but have a client secret, try to get tier from subscription API
        if (!foundTierId && secretFromUrl) {
          try {
            // This endpoint would need to be implemented on the server
            const response = await fetch(`/api/subscription/info?secret=${secretFromUrl}`);
            if (response.ok) {
              const data = await response.json();
              if (data.tierId) {
                foundTierId = data.tierId;
                console.log('Found tier ID from subscription info API:', foundTierId);
              }
            }
          } catch (err) {
            console.error('Error fetching subscription info:', err);
          }
        }
        
        // Set the tier ID if we found one
        if (foundTierId) {
          setTierId(foundTierId);
        }
        
        if (secretFromUrl) {
          // If we have a client secret in the URL, use it
          setClientSecret(secretFromUrl);
          setLoading(false);
        } else {
          // If no client secret, redirect to subscribe page
          toast({
            title: 'Checkout Error',
            description: 'No payment information found. Please select a plan first.',
            variant: 'destructive',
          });
          setLocation('/subscribe');
        }
      } catch (err) {
        console.error('Error initializing checkout:', err);
        setError('Failed to initialize checkout. Please try again.');
        setLoading(false);
      }
    }
    
    initializeCheckout();
  }, [toast, setLocation, match, params]);
  
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
        ) : clientSecret ? (
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm 
              clientSecret={clientSecret}
              tierId={tierId}
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