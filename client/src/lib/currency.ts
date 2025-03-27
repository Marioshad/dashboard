import { CurrencyCode, SUPPORTED_CURRENCIES } from "@shared/schema";

/**
 * Get the currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || '$';
}

/**
 * Format a price value (in cents) to a localized currency string
 * @param priceInCents Price in cents (in USD)
 * @param currencyCode Target currency code
 * @returns Formatted price string with currency symbol
 */
export function formatPrice(priceInCents: number | null | undefined, currencyCode: CurrencyCode = 'USD'): string {
  if (priceInCents == null) return 'N/A';
  
  // Convert cents to dollars
  const priceInDollars = priceInCents / 100;
  
  // Exchange rates relative to USD (simplified)
  // In a real app, you would use a currency conversion API
  const exchangeRates: Record<CurrencyCode, number> = {
    USD: 1,
    EUR: 0.93,
    GBP: 0.79,
    JPY: 151.83,
    CAD: 1.37,
    AUD: 1.53,
    CNY: 7.24,
    INR: 83.52,
    BRL: 5.17,
    MXN: 16.94,
  };
  
  // Convert to target currency
  const rate = exchangeRates[currencyCode] || 1;
  const convertedPrice = priceInDollars * rate;
  
  // Format according to locale
  const localeMap: Record<CurrencyCode, string> = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    JPY: 'ja-JP',
    CAD: 'en-CA',
    AUD: 'en-AU',
    CNY: 'zh-CN',
    INR: 'en-IN',
    BRL: 'pt-BR',
    MXN: 'es-MX',
  };
  
  const locale = localeMap[currencyCode] || 'en-US';
  
  // Special case for JPY which doesn't use decimal places
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
    maximumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
  };
  
  return new Intl.NumberFormat(locale, options).format(convertedPrice);
}

/**
 * Create a price formatter function using the user's currency
 * @param userCurrency The user's currency code
 * @returns A function that formats prices
 */
export function createPriceFormatter(userCurrency: CurrencyCode = 'USD') {
  return (priceInCents: number | null | undefined) => formatPrice(priceInCents, userCurrency);
}

/**
 * Get localized name for currency
 */
export function getCurrencyName(currencyCode: CurrencyCode): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.name || 'US Dollar';
}