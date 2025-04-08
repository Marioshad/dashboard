import { db } from '../db';
import { subscriptionTiers } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Seeds default subscription tiers (free, smart, pro)
 */
export async function seedSubscriptionTiers() {
  const tiers = [
    {
      tier: 'free',
      name: 'Basic Pantry',
      priceMonthly: '0.00',
      priceYearly: '0.00',
      maxItems: 50,
      receiptScansPerMonth: 3,
      maxSharedUsers: 1,
      description: 'Free plan for casual users and small households',
      features: [
        "Track up to 50 items",
        "Receipt scanning up to 3 times per month",
        "Expiration reminders (email or in-app)",
        "Manual grocery input",
        "Simple shopping list",
        "Basic analytics: estimated savings / waste",
        "1 shared user/device",
        "Limited categories"
      ]
    },
    {
      tier: 'smart',
      name: 'Smart Pantry',
      priceMonthly: '4.99',
      priceYearly: '49.00',
      maxItems: -1,
      receiptScansPerMonth: 20,
      maxSharedUsers: 3,
      description: 'For organized households looking to save money',
      features: [
        "Unlimited items",
        "Receipt scanning up to 20 times per month",
        "Smart reminders (customizable thresholds)",
        "Auto-sorting food categories",
        "AI-powered suggestions: \"Use These Soon\" recipes",
        "Smart shopping list based on inventory + history",
        "Household sharing (up to 3 users)",
        "Export pantry data (PDF/CSV)",
        "Gamification: track waste reduction over time"
      ]
    },
    {
      tier: 'pro',
      name: 'Family Pantry Pro',
      priceMonthly: '9.99',
      priceYearly: '99.00',
      maxItems: -1,
      receiptScansPerMonth: -1,
      maxSharedUsers: 6,
      description: 'For families, meal planners, and power users',
      features: [
        "Everything in Smart Pantry",
        "Share with up to 6 users/devices",
        "Meal planning calendar",
        "Barcode scanner or voice entry",
        "Pantry sync & cloud backup",
        "Pantry zones (fridge, freezer, garage, etc.)",
        "Advanced analytics (food waste %, savings by category)",
        "Priority email/chat support"
      ]
    }
  ];

  for (const tier of tiers) {
    const exists = await db.query.subscriptionTiers.findFirst({
      where: eq(subscriptionTiers.tier, tier.tier),
    });

    if (!exists) {
      await db.insert(subscriptionTiers).values({
        ...tier,
        // JSON is okay to pass directly as long as features is jsonb
        features: tier.features,
      });
      console.log(`✅ Seeded tier: ${tier.tier}`);
    } else {
      console.log(`ℹ️ Subscription tier already exists: ${tier.tier}`);
    }
  }

  return { success: true };
}
