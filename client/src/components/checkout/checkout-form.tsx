import React, { useState, useEffect } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { getSubscriptionTier } from '@/lib/subscription';
import { formatCurrency } from '@/lib/utils';

interface CheckoutFormProps {
  clientSecret: string;
  tierId?: string;
  returnUrl?: string;
}

export function CheckoutForm({ clientSecret, tierId, returnUrl = '/billing' }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Get tier information for display if available
  const tier = tierId ? getSubscriptionTier(tierId) : null;

  // State to track when elements are ready
  const [elementsReady, setElementsReady] = useState(false);
  
  // Listen for element ready event
  useEffect(() => {
    if (elements) {
      setElementsReady(true);
    }
  }, [elements]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements || !elementsReady) {
      // Stripe.js or Elements have not loaded yet
      toast({
        title: "Payment System Loading",
        description: "Please wait while the payment system initializes...",
      });
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Use confirmPayment or confirmSetup based on whether this is a new subscription
      // or updating a payment method
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}${returnUrl}?success=true`,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Show error to user
        setErrorMessage(error.message || 'An unexpected error occurred.');
        toast({
          title: 'Payment Failed',
          description: error.message || 'An unexpected error occurred. Please try again.',
          variant: 'destructive',
        });
      } else {
        // Redirect to billing page with success message
        toast({
          title: 'Payment Successful',
          description: tier ? `Your subscription to ${tier.name} has been activated!` : 'Your subscription has been activated!',
        });
        setLocation(returnUrl);
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
      toast({
        title: 'Payment Error',
        description: err.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Complete Your Subscription</CardTitle>
        <CardDescription>
          {tier ? 
            `Subscribe to the ${tier.name} plan for ${formatCurrency(tier.price.monthly)} per month` :
            'Complete payment to activate your subscription'
          }
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {tier ? (
            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                </div>
                <div className="text-lg font-bold">
                  {formatCurrency(tier.price.monthly)}<span className="text-sm font-normal text-muted-foreground">/month</span>
                </div>
              </div>
              <ul className="space-y-2">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Icons.check className="h-4 w-4 mt-1 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-md border p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Premium Subscription</h3>
                  <p className="text-sm text-muted-foreground">Access all premium features</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <h3 className="font-medium text-md">Payment Information</h3>
            <PaymentElement />
          </div>
          
          {errorMessage && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-500">
              {errorMessage}
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row gap-4">
          <Button 
            type="button"
            variant="ghost"
            onClick={() => setLocation('/subscribe')}
            disabled={isLoading}
          >
            Back to Plans
          </Button>
          
          <Button 
            type="submit"
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600"
            disabled={!stripe || isLoading}
          >
            {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
            Subscribe Now
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}