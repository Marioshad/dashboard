import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function capitalizeFirstLetter(string: string): string {
  if (!string) return ''
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
}

/**
 * Format currency based on locale
 * @param amount Amount to format
 * @param currency Currency code (e.g., USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
