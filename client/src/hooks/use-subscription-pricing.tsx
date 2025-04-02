import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SUBSCRIPTION_TIERS } from '@shared/schema';

interface Price {
  id: string;
  unit_amount: number;
  recurring: {
    interval: string;
  };
  product: {
    id?: string;
    name: string;
    description: string;
    metadata?: {
      tier?: string;
    };
  };
}

export interface PriceWithDiscount extends Price {
  discount_percentage?: number;
  monthly_equivalent?: number;
  total_savings?: number;
}

export function useSubscriptionPricing() {
  // Load prices from Stripe
  const { data: prices, isLoading: isPricesLoading, error: pricesError } = useQuery<Price[]>({
    queryKey: ["/api/subscription/prices"],
  });

  // Organize prices by tier and interval for easier lookup
  const organizedPrices = useMemo(() => {
    if (!prices) return null;
    
    const result: Record<string, Record<string, PriceWithDiscount | undefined>> = {
      smart: { monthly: undefined, yearly: undefined },
      pro: { monthly: undefined, yearly: undefined }
    };
    
    // First, organize prices by tier and interval
    prices.forEach(price => {
      const tier = price.product.metadata?.tier;
      if (!tier || !['smart', 'pro'].includes(tier)) return;
      
      const interval = price.recurring.interval === 'month' ? 'monthly' : 'yearly';
      result[tier][interval] = {...price};
    });
    
    // Then calculate discounts for yearly prices
    Object.keys(result).forEach(tier => {
      const monthly = result[tier].monthly;
      const yearly = result[tier].yearly;
      
      if (monthly && yearly) {
        // Calculate monthly equivalent cost of yearly subscription
        const monthlyEquivalent = yearly.unit_amount / 12;
        
        // Calculate discount percentage
        const monthlyAmount = monthly.unit_amount;
        const discountPercentage = Math.round((1 - (monthlyEquivalent / monthlyAmount)) * 100);
        
        // Calculate total annual savings
        const totalSavings = (monthlyAmount * 12) - yearly.unit_amount;
        
        // Add these calculations to the yearly price object
        result[tier].yearly = {
          ...yearly,
          discount_percentage: discountPercentage,
          monthly_equivalent: monthlyEquivalent,
          total_savings: totalSavings
        };
      }
    });
    
    return result;
  }, [prices]);

  // Function to get price for a specific tier and interval
  const getPriceForTierAndInterval = (tierId: string, interval: 'monthly' | 'yearly'): PriceWithDiscount | undefined => {
    // For the free tier, we don't need a price
    if (tierId === 'free') return undefined;
    
    // Try to get the price from organized Stripe prices
    if (organizedPrices && organizedPrices[tierId] && organizedPrices[tierId][interval]) {
      return organizedPrices[tierId][interval];
    }
    
    // If no organized prices are available yet, try to get the price directly from the prices array
    const stripePrice = prices?.find(p => 
      p.product.metadata?.tier === tierId && 
      p.recurring.interval === (interval === 'monthly' ? 'month' : 'year')
    );
    
    if (stripePrice) {
      if (interval === 'yearly' && tierId !== 'free') {
        // Find the monthly price for this tier to calculate discount
        const monthlyPrice = prices?.find(p => 
          p.product.metadata?.tier === tierId && 
          p.recurring.interval === 'month'
        );
        
        if (monthlyPrice) {
          const monthlyEquivalent = stripePrice.unit_amount / 12;
          const discountPercentage = Math.round((1 - (monthlyEquivalent / monthlyPrice.unit_amount)) * 100);
          const totalSavings = (monthlyPrice.unit_amount * 12) - stripePrice.unit_amount;
          
          return {
            ...stripePrice,
            discount_percentage: discountPercentage,
            monthly_equivalent: monthlyEquivalent,
            total_savings: totalSavings
          };
        }
      }
      return stripePrice as PriceWithDiscount;
    }
    
    // Otherwise return a fallback price for paid tiers
    // Fallback price IDs when Stripe fails
    const fallbackPriceIds: Record<string, Record<string, string>> = {
      smart: {
        monthly: 'price_smart_monthly',
        yearly: 'price_smart_yearly'
      },
      pro: {
        monthly: 'price_pro_monthly',
        yearly: 'price_pro_yearly'
      }
    };
    
    if (tierId !== 'free' && fallbackPriceIds[tierId]) {
      const monthlyAmount = tierId === 'smart' ? 499 : 1999;
      const yearlyAmount = tierId === 'smart' ? 3999 : 19999;
      const monthlyEquivalent = yearlyAmount / 12;
      const discountPercentage = Math.round((1 - (monthlyEquivalent / monthlyAmount)) * 100);
      const totalSavings = (monthlyAmount * 12) - yearlyAmount;
      
      return {
        id: fallbackPriceIds[tierId][interval],
        unit_amount: interval === 'monthly' ? monthlyAmount : yearlyAmount,
        recurring: {
          interval: interval === 'monthly' ? 'month' : 'year'
        },
        product: {
          id: `prod_${tierId}`,
          name: `${tierId === 'smart' ? 'Smart Pantry' : 'Family Pantry Pro'} ${interval === 'monthly' ? 'Monthly' : 'Yearly'}`,
          description: `${tierId === 'smart' ? 'Smart Pantry' : 'Family Pantry Pro'} subscription billed ${interval === 'monthly' ? 'monthly' : 'yearly'}`,
          metadata: {
            tier: tierId
          }
        },
        ...(interval === 'yearly' ? {
          discount_percentage: discountPercentage,
          monthly_equivalent: monthlyEquivalent,
          total_savings: totalSavings
        } : {})
      };
    }
    
    return undefined;
  };

  // Get the maximum discount percentage available
  const maxDiscountPercentage = useMemo(() => {
    if (!organizedPrices) return 18; // Default value if prices aren't loaded yet
    
    let maxDiscount = 0;
    Object.keys(organizedPrices).forEach(tier => {
      const yearlyPrice = organizedPrices[tier].yearly;
      if (yearlyPrice && yearlyPrice.discount_percentage && yearlyPrice.discount_percentage > maxDiscount) {
        maxDiscount = yearlyPrice.discount_percentage;
      }
    });
    
    return maxDiscount || 18; // Return at least a default value
  }, [organizedPrices]);

  return {
    prices,
    organizedPrices,
    isPricesLoading,
    pricesError,
    getPriceForTierAndInterval,
    maxDiscountPercentage,
    isStripeDisabled: pricesError && (pricesError as any)?.stripeDisabled === true
  };
}