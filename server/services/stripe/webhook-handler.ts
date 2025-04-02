import Stripe from 'stripe';
import { storage } from '../../storage';
import { SendNotificationFn } from '../../routes';
import { log } from '../../vite';
import { sendSubscriptionEmail } from '../email/email-service';

// Initialize Stripe client
let stripe: Stripe | null = null;

try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia',
    });
  }
} catch (error) {
  log(`Error initializing Stripe in webhook handler: ${error}`, 'stripe-webhook');
}

// Mappings for tiers and their limits
const TIER_LIMITS: Record<string, { scans: number; items: number; sharedUsers: number }> = {
  free: { scans: 3, items: 50, sharedUsers: 0 },
  smart_pantry: { scans: 20, items: 200, sharedUsers: 2 },
  family_pantry_pro: { scans: 100, items: 1000, sharedUsers: 10 },
};

// Localized tier names for notifications
const TIER_NAMES: Record<string, string> = {
  free: 'Free',
  smart_pantry: 'Smart Pantry',
  family_pantry_pro: 'Family Pantry Pro',
};

/**
 * Handle subscription creation or update
 * @param subscription Stripe subscription
 * @param sendNotification Function to send notifications
 */
async function handleSubscriptionCreatedOrUpdated(
  subscription: Stripe.Subscription,
  sendNotification: SendNotificationFn
): Promise<void> {
  // Skip if not an active subscription
  if (!['active', 'trialing'].includes(subscription.status)) {
    log(`Ignoring subscription with status: ${subscription.status}`, 'stripe-webhook');
    return;
  }

  try {
    // Get customer ID from subscription
    const customerId = subscription.customer as string;
    
    // Get user from database by Stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      log(`No user found with Stripe customer ID: ${customerId}`, 'stripe-webhook');
      return;
    }
    
    // Get subscription item and price details
    const item = subscription.items.data[0];
    const price = item?.price;
    const productId = price?.product as string;
    
    if (!productId) {
      log('No product ID found in subscription', 'stripe-webhook');
      return;
    }
    
    // Get product details from Stripe
    if (!stripe) {
      log('Stripe not initialized in webhook handler', 'stripe-webhook');
      return;
    }
    
    const product = await stripe.products.retrieve(productId);
    
    // Determine tier from product metadata or name
    let tier = 'unknown';
    if (product.metadata?.tier) {
      tier = product.metadata.tier;
    } else if (product.name) {
      if (product.name.toLowerCase().includes('smart pantry')) {
        tier = 'smart_pantry';
      } else if (product.name.toLowerCase().includes('family pantry pro')) {
        tier = 'family_pantry_pro';
      }
    }
    
    // Update user's subscription details
    await storage.updateUserSubscription(user.id, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionTier: tier,
      currentBillingPeriodStart: new Date(subscription.current_period_start * 1000),
      currentBillingPeriodEnd: new Date(subscription.current_period_end * 1000),
    });
    
    // Update user's limits based on tier
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    await storage.updateUserLimits(user.id, {
      receiptScansLimit: limits.scans,
      maxItems: limits.items,
      maxSharedUsers: limits.sharedUsers,
    });
    
    // Send notification to user
    const tierName = TIER_NAMES[tier] || tier;
    await sendNotification(
      user.id,
      'subscription_updated',
      `Your subscription has been updated to ${tierName}.`,
      undefined,
      { tier, status: subscription.status }
    );
    
    // Send confirmation email
    if (user.email) {
      await sendSubscriptionEmail(
        user.email,
        'Subscription Confirmation',
        tierName,
        price?.unit_amount ? price.unit_amount / 100 : 0,
        price?.currency || 'usd',
        new Date(subscription.current_period_end * 1000)
      );
    }
    
    log(`Updated subscription for user ${user.id} to tier ${tier}`, 'stripe-webhook');
  } catch (error) {
    log(`Error handling subscription created/updated: ${error}`, 'stripe-webhook');
  }
}

/**
 * Handle subscription deletion
 * @param subscription Stripe subscription
 * @param sendNotification Function to send notifications
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  sendNotification: SendNotificationFn
): Promise<void> {
  try {
    // Get customer ID from subscription
    const customerId = subscription.customer as string;
    
    // Get user from database by Stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      log(`No user found with Stripe customer ID: ${customerId}`, 'stripe-webhook');
      return;
    }
    
    // Update user's subscription details
    await storage.updateUserSubscription(user.id, {
      stripeSubscriptionId: "",
      subscriptionStatus: 'canceled',
      subscriptionTier: 'free',
      currentBillingPeriodStart: null,
      currentBillingPeriodEnd: null,
    });
    
    // Update user's limits to free tier
    const limits = TIER_LIMITS.free;
    await storage.updateUserLimits(user.id, {
      receiptScansLimit: limits.scans,
      maxItems: limits.items,
      maxSharedUsers: limits.sharedUsers,
    });
    
    // Send notification to user
    await sendNotification(
      user.id,
      'subscription_canceled',
      'Your subscription has been canceled. You have been downgraded to the Free tier.',
      undefined,
      { tier: 'free', status: 'canceled' }
    );
    
    // Send cancellation email
    if (user.email) {
      await sendSubscriptionEmail(
        user.email,
        'Subscription Canceled',
        'Free',
        0,
        'usd',
        null
      );
    }
    
    log(`Subscription canceled for user ${user.id}`, 'stripe-webhook');
  } catch (error) {
    log(`Error handling subscription deleted: ${error}`, 'stripe-webhook');
  }
}

/**
 * Handle payment success
 * @param paymentIntent Stripe payment intent
 * @param sendNotification Function to send notifications
 */
async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  sendNotification: SendNotificationFn
): Promise<void> {
  try {
    if (!stripe) {
      log('Stripe not initialized in webhook handler', 'stripe-webhook');
      return;
    }
    
    // Find the invoice associated with this payment
    const { data: invoices } = await stripe.invoices.list({
      payment_intent: paymentIntent.id,
    });
    
    if (invoices.length === 0) {
      log(`No invoice found for payment intent: ${paymentIntent.id}`, 'stripe-webhook');
      return;
    }
    
    const invoice = invoices[0];
    const customerId = invoice.customer as string;
    
    // Get user from database by Stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      log(`No user found with Stripe customer ID: ${customerId}`, 'stripe-webhook');
      return;
    }
    
    // Send notification to user
    await sendNotification(
      user.id,
      'payment_succeeded',
      `Your payment of ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()} has been processed successfully.`,
      undefined,
      { amount: paymentIntent.amount / 100, currency: paymentIntent.currency }
    );
    
    // If this is for subscription, make sure user has correct status
    const subscription = invoice.subscription ? 
      await stripe.subscriptions.retrieve(invoice.subscription as string) : null;
    
    if (subscription) {
      // Get subscription item and price details
      const item = subscription.items.data[0];
      const price = item?.price;
      const productId = price?.product as string;
      
      if (!productId) {
        return;
      }
      
      // Get product details from Stripe
      const product = await stripe.products.retrieve(productId);
      
      // Determine tier from product metadata or name
      let tier = 'unknown';
      if (product.metadata?.tier) {
        tier = product.metadata.tier;
      } else if (product.name) {
        if (product.name.toLowerCase().includes('smart pantry')) {
          tier = 'smart_pantry';
        } else if (product.name.toLowerCase().includes('family pantry pro')) {
          tier = 'family_pantry_pro';
        }
      }
      
      // Update user's subscription details if needed
      if (user.subscriptionStatus !== 'active' || user.subscriptionTier !== tier) {
        await storage.updateUserSubscription(user.id, {
          subscriptionStatus: 'active',
          subscriptionTier: tier,
        });
        
        // Update user's limits based on tier
        const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
        await storage.updateUserLimits(user.id, {
          receiptScansLimit: limits.scans,
          maxItems: limits.items,
          maxSharedUsers: limits.sharedUsers,
        });
      }
    }
    
    log(`Payment succeeded for user ${user.id}`, 'stripe-webhook');
  } catch (error) {
    log(`Error handling payment succeeded: ${error}`, 'stripe-webhook');
  }
}

/**
 * Handle payment failure
 * @param paymentIntent Stripe payment intent
 * @param sendNotification Function to send notifications
 */
async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent,
  sendNotification: SendNotificationFn
): Promise<void> {
  try {
    if (!stripe) {
      log('Stripe not initialized in webhook handler', 'stripe-webhook');
      return;
    }
    
    // Find the invoice associated with this payment
    const { data: invoices } = await stripe.invoices.list({
      payment_intent: paymentIntent.id,
    });
    
    if (invoices.length === 0) {
      log(`No invoice found for payment intent: ${paymentIntent.id}`, 'stripe-webhook');
      return;
    }
    
    const invoice = invoices[0];
    const customerId = invoice.customer as string;
    
    // Get user from database by Stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      log(`No user found with Stripe customer ID: ${customerId}`, 'stripe-webhook');
      return;
    }
    
    // Send notification to user
    await sendNotification(
      user.id,
      'payment_failed',
      `Your payment of ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()} has failed. Please update your payment method.`,
      undefined,
      { amount: paymentIntent.amount / 100, currency: paymentIntent.currency }
    );
    
    // If this is for subscription, check if we need to update status
    if (invoice.subscription) {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
      
      if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
        // Update user's subscription status
        await storage.updateUserSubscription(user.id, {
          subscriptionStatus: subscription.status,
        });
      }
    }
    
    log(`Payment failed for user ${user.id}`, 'stripe-webhook');
  } catch (error) {
    log(`Error handling payment failed: ${error}`, 'stripe-webhook');
  }
}

/**
 * Handle trial will end
 * @param subscription Stripe subscription
 * @param sendNotification Function to send notifications
 */
async function handleTrialWillEnd(
  subscription: Stripe.Subscription,
  sendNotification: SendNotificationFn
): Promise<void> {
  try {
    // Get customer ID from subscription
    const customerId = subscription.customer as string;
    
    // Get user from database by Stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      log(`No user found with Stripe customer ID: ${customerId}`, 'stripe-webhook');
      return;
    }
    
    // Get price from subscription
    const item = subscription.items.data[0];
    const price = item?.price;
    
    // Send notification to user
    await sendNotification(
      user.id,
      'trial_ending',
      `Your free trial will end on ${subscription.trial_end ? new Date(subscription.trial_end * 1000).toLocaleDateString() : 'soon'}. You will be charged ${price?.unit_amount ? (price.unit_amount / 100).toFixed(2) : '0.00'} ${price?.currency?.toUpperCase() || 'USD'} afterwards unless you cancel.`,
      undefined,
      { 
        trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : new Date().toISOString(),
        amount: price?.unit_amount ? price.unit_amount / 100 : 0,
        currency: price?.currency || 'usd'
      }
    );
    
    log(`Trial ending notification sent to user ${user.id}`, 'stripe-webhook');
  } catch (error) {
    log(`Error handling trial will end: ${error}`, 'stripe-webhook');
  }
}

/**
 * Handle Stripe webhook events
 * @param event Stripe event
 * @param sendNotification Function to send notifications
 */
export async function handleStripeWebhookEvent(
  event: Stripe.Event,
  sendNotification: SendNotificationFn
): Promise<void> {
  const eventType = event.type;
  
  log(`Processing Stripe webhook event: ${eventType}`, 'stripe-webhook');
  
  try {
    switch (eventType) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionCreatedOrUpdated(
          event.data.object as Stripe.Subscription,
          sendNotification
        );
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          sendNotification
        );
        break;
        
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(
          event.data.object as Stripe.PaymentIntent,
          sendNotification
        );
        break;
        
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(
          event.data.object as Stripe.PaymentIntent,
          sendNotification
        );
        break;
        
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(
          event.data.object as Stripe.Subscription,
          sendNotification
        );
        break;
        
      default:
        log(`Unhandled Stripe webhook event type: ${eventType}`, 'stripe-webhook');
    }
  } catch (error) {
    log(`Error handling Stripe webhook event: ${error}`, 'stripe-webhook');
  }
}