import { CurrencyCode, SUPPORTED_CURRENCIES } from "@shared/schema";

/**
 * Get the currency symbol for a given currency code
 */
export function getCurrencySymbol(currencyCode: CurrencyCode): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.symbol || '$';
}

/**
 * Format a price value to a localized currency string
 * @param price Price in the actual currency units (not cents)
 * @param currencyCode Target currency code
 * @returns Formatted price string with currency symbol
 */
export function formatPrice(price: number | null | undefined, currencyCode: CurrencyCode = 'USD'): string {
  if (price == null) return 'N/A';
  
  // No conversion needed - use actual price values from receipt
  const actualPrice = price;
  
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
  
  return new Intl.NumberFormat(locale, options).format(actualPrice);
}

/**
 * Create a price formatter function using the user's currency
 * @param userCurrency The user's currency code
 * @returns A function that formats prices
 */
export function createPriceFormatter(userCurrency: CurrencyCode = 'USD') {
  return (price: number | null | undefined) => formatPrice(price, userCurrency);
}

/**
 * Get localized name for currency
 */
export function getCurrencyName(currencyCode: CurrencyCode): string {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === currencyCode);
  return currency?.name || 'US Dollar';
}