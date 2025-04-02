import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SUBSCRIPTION_TIERS } from '@shared/schema';

interface Price {
  id: string;
  unit_amount: number;
  recurring: {
    interval: string;
  };
  product: {
    name: string;
    description: string;
    metadata?: {
      tier?: string;
    };
  };
}

export function useSubscriptionPricing() {
  // Load prices from Stripe
  const { data: prices, isLoading: isPricesLoading, error: pricesError } = useQuery<Price[]>({
    queryKey: ["/api/subscription/prices"],
  });

  // Function to get price for a specific tier and interval
  const getPriceForTierAndInterval = (tierId: string, interval: 'monthly' | 'yearly') => {
    // Fallback price IDs when Stripe fails
    const fallbackPriceIds = {
      smart: {
        monthly: 'price_smart_monthly',
        yearly: 'price_smart_yearly'
      },
      pro: {
        monthly: 'price_pro_monthly',
        yearly: 'price_pro_yearly'
      }
    };

    // Try to get the price from Stripe
    const stripePrice = prices?.find(p => 
      p.product.metadata?.tier === tierId && 
      p.recurring.interval === (interval === 'monthly' ? 'month' : 'year')
    );
    
    // If found, return it
    if (stripePrice) return stripePrice;
    
    // Otherwise return a fallback price for paid tiers
    if (tierId !== 'free' && fallbackPriceIds[tierId]) {
      return {
        id: fallbackPriceIds[tierId][interval],
        unit_amount: tierId === 'smart' 
          ? (interval === 'monthly' ? 999 : 9999) 
          : (interval === 'monthly' ? 1999 : 19999),
        recurring: {
          interval: interval === 'monthly' ? 'month' : 'year'
        },
        product: {
          name: `${tierId === 'smart' ? 'Smart Pantry' : 'Family Pantry Pro'} ${interval === 'monthly' ? 'Monthly' : 'Yearly'}`,
          description: `${tierId === 'smart' ? 'Smart Pantry' : 'Family Pantry Pro'} subscription billed ${interval === 'monthly' ? 'monthly' : 'yearly'}`,
          metadata: {
            tier: tierId
          }
        }
      };
    }
    
    return undefined;
  };

  return {
    prices,
    isPricesLoading,
    pricesError,
    getPriceForTierAndInterval,
    isStripeDisabled: pricesError && (pricesError as any)?.stripeDisabled === true
  };
}