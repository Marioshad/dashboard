// Define subscription tier types and constants

export interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  features: string[];
  price: {
    monthly: number;
    yearly: number;
  };
  limits: {
    receiptScans: number;
    itemsPerReceipt: number;
    pantryUsers: number;
    locations: number;
  };
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Basic pantry management',
    features: [
      'Track up to 50 food items',
      '3 receipt scans per month',
      '50 items per receipt limit',
      'Up to 3 storage locations',
      'Expiry date tracking',
      'Basic inventory management'
    ],
    price: {
      monthly: 0,
      yearly: 0
    },
    limits: {
      receiptScans: 3,
      itemsPerReceipt: 50,
      pantryUsers: 1,
      locations: 3
    }
  },
  {
    id: 'smart',
    name: 'Smart Pantry',
    description: 'Advanced inventory tracking',
    features: [
      'Track unlimited food items',
      '20 receipt scans per month',
      'Unlimited items per receipt',
      'Up to 10 storage locations',
      'Advanced expiry alerts',
      'Price tracking & history',
      'Custom food tags',
      'Shopping list generator'
    ],
    price: {
      monthly: 9.99,
      yearly: 99.99
    },
    limits: {
      receiptScans: 20,
      itemsPerReceipt: 0, // Unlimited
      pantryUsers: 1,
      locations: 10
    }
  },
  {
    id: 'pro',
    name: 'Family Pantry Pro',
    description: 'Complete solution for families',
    features: [
      'All Smart Pantry features',
      'Unlimited receipt scans',
      'Share with up to 5 family members',
      'Unlimited storage locations',
      'Advanced analytics & reports',
      'Nutritional information',
      'Meal planning integration',
      'Priority support'
    ],
    price: {
      monthly: 19.99,
      yearly: 199.99
    },
    limits: {
      receiptScans: 0, // Unlimited
      itemsPerReceipt: 0, // Unlimited
      pantryUsers: 5,
      locations: 0 // Unlimited
    }
  }
];

/**
 * Get a subscription tier by ID
 * @param id Tier ID to find
 * @returns Subscription tier or the free tier if not found
 */
export function getSubscriptionTier(id: string): SubscriptionTier {
  return SUBSCRIPTION_TIERS.find(tier => tier.id === id) || SUBSCRIPTION_TIERS[0];
}

/**
 * Check if user has reached their scan limit
 * @param user User object with subscription data
 * @returns Boolean indicating if limit is reached
 */
export function hasReachedScanLimit(user: any): boolean {
  if (!user) return true;
  
  // Get current tier
  const tier = getSubscriptionTier(user.subscriptionTier || 'free');
  
  // If unlimited scans (tier.limits.receiptScans === 0)
  if (tier.limits.receiptScans === 0) return false;
  
  // Check against limit
  return (user.receiptScansUsed || 0) >= tier.limits.receiptScans;
}

/**
 * Format scans remaining/total for display
 * @param user User object with subscription data
 * @returns Formatted string or object with the scan information
 */
export function formatScansRemaining(user: any): { used: number, total: number | string, remaining: number | string } {
  if (!user) {
    return { used: 0, total: 0, remaining: 0 };
  }
  
  const tier = getSubscriptionTier(user.subscriptionTier || 'free');
  const used = user.receiptScansUsed || 0;
  
  // Handle unlimited case
  if (tier.limits.receiptScans === 0) {
    return { 
      used, 
      total: 'Unlimited', 
      remaining: 'Unlimited' 
    };
  }
  
  const total = tier.limits.receiptScans;
  const remaining = Math.max(0, total - used);
  
  return { used, total, remaining };
}

/**
 * Capitalize the first letter of a string
 * @param string String to capitalize
 * @returns Capitalized string
 */
export function capitalizeFirstLetter(string: string): string {
  return string.charAt(0).toUpperCase() + string.slice(1);
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