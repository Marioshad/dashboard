import { useCallback, useMemo } from 'react';
import { useAuth } from './use-auth';
import { createPriceFormatter, getCurrencySymbol } from '@/lib/currency';
import { SUPPORTED_CURRENCIES, CurrencyCode } from '@shared/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

/**
 * Hook to manage user currency and price formatting
 */
export function useCurrency() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const userCurrency = useMemo<CurrencyCode>(() => {
    return (user?.currency as CurrencyCode) || 'USD';
  }, [user?.currency]);
  
  // Create formatter function for the user's currency
  const formatPrice = useMemo(() => {
    return createPriceFormatter(userCurrency);
  }, [userCurrency]);
  
  // Get currency symbol
  const currencySymbol = useMemo(() => {
    return getCurrencySymbol(userCurrency);
  }, [userCurrency]);
  
  // Mutation to update user's currency
  const updateCurrency = useMutation({
    mutationFn: async (currency: CurrencyCode) => {
      return await apiRequest('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({ currency }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    },
    onSuccess: () => {
      // Invalidate user query to refresh the user data
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
  });
  
  return {
    currency: userCurrency,
    formatPrice,
    currencySymbol,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    updateCurrency: updateCurrency.mutate,
    isUpdating: updateCurrency.isPending,
  };
}