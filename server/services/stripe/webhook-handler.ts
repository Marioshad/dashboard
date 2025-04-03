import Stripe from 'stripe';
import { storage } from '../../storage';
import { SendNotificationFn } from '../../routes';
import { log } from '../../vite';
import { sendSubscriptionEmail, sendInvoiceEmail } from '../email/email-service';

// Initialize Stripe client
let stripe: Stripe | null = null;

try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-03-31.basil',
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
      // Get tier from metadata and standardize
      tier = product.metadata.tier;
      log(`Found tier in product metadata: ${tier}`, 'stripe-webhook');
      
      // Convert simple tier IDs to system tier names if needed
      if (tier === 'smart') {
        tier = 'smart_pantry';
        log('Converted "smart" tier to "smart_pantry"', 'stripe-webhook');
      } else if (tier === 'pro') {
        tier = 'family_pantry_pro';
        log('Converted "pro" tier to "family_pantry_pro"', 'stripe-webhook');
      }
    } else if (product.name) {
      log(`No tier in metadata, checking product name: ${product.name}`, 'stripe-webhook');
      if (product.name.toLowerCase().includes('smart pantry')) {
        tier = 'smart_pantry';
        log('Determined tier from product name: smart_pantry', 'stripe-webhook');
      } else if (product.name.toLowerCase().includes('family pantry pro')) {
        tier = 'family_pantry_pro';
        log('Determined tier from product name: family_pantry_pro', 'stripe-webhook');
      }
    }
    
    // Update user's subscription details
    await storage.updateUserSubscription(user.id, {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionTier: tier,
      currentBillingPeriodStart: new Date((subscription as any).current_period_start * 1000),
      currentBillingPeriodEnd: new Date((subscription as any).current_period_end * 1000),
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
        new Date((subscription as any).current_period_end * 1000)
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
    
    // Check if we have tier info in the payment intent metadata
    let tierId = paymentIntent.metadata?.tier as string;
    let subscriptionId = paymentIntent.metadata?.subscriptionId as string;
    
    // Log payment intent metadata for debugging
    log(`Payment intent metadata: ${JSON.stringify(paymentIntent.metadata || {})}`, 'stripe-webhook');
    
    // Find the invoice associated with this payment
    // @ts-ignore - payment_intent is not in the TypeScript definitions but is supported by the API
    const { data: invoices } = await stripe.invoices.list({
      payment_intent: paymentIntent.id,
    });
    
    if (invoices.length === 0) {
      log(`No invoice found for payment intent: ${paymentIntent.id}`, 'stripe-webhook');
      
      // Even without an invoice, we might have customer info in the payment intent
      if (paymentIntent.customer) {
        const customerId = typeof paymentIntent.customer === 'string' 
          ? paymentIntent.customer
          : paymentIntent.customer.id;
          
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          // Send generic payment notification
          await sendNotification(
            user.id,
            'payment_succeeded',
            `Your payment of ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()} has been processed successfully.`,
            undefined,
            { amount: paymentIntent.amount / 100, currency: paymentIntent.currency }
          );
        }
      }
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
    
    // First check if we already have tier information from payment intent metadata
    let effectiveTierId = tierId;
    let effectiveSubscriptionId = subscriptionId;
    
    // If this is for subscription, make sure user has correct status
    const subscription = (invoice as any).subscription ? 
      await stripe.subscriptions.retrieve((invoice as any).subscription as string) : null;
    
    if (subscription) {
      // Use subscription ID from actual subscription
      effectiveSubscriptionId = subscription.id;
      
      // Get subscription item and price details
      const item = subscription.items.data[0];
      const price = item?.price;
      const productId = price?.product as string;
      
      if (productId) {
        // Get product details from Stripe
        const product = await stripe.products.retrieve(productId);
        
        // Determine tier from product metadata or name
        if (product.metadata?.tier) {
          // Get tier from metadata and standardize
          effectiveTierId = product.metadata.tier;
          log(`Found tier in product metadata: ${effectiveTierId}`, 'stripe-webhook');
          
          // Convert simple tier IDs to system tier names if needed
          if (effectiveTierId === 'smart') {
            effectiveTierId = 'smart_pantry';
            log('Converted "smart" tier to "smart_pantry"', 'stripe-webhook');
          } else if (effectiveTierId === 'pro') {
            effectiveTierId = 'family_pantry_pro';
            log('Converted "pro" tier to "family_pantry_pro"', 'stripe-webhook');
          }
        } else if (product.name) {
          log(`No tier in metadata, checking product name: ${product.name}`, 'stripe-webhook');
          if (product.name.toLowerCase().includes('smart pantry')) {
            effectiveTierId = 'smart_pantry';
            log('Determined tier from product name: smart_pantry', 'stripe-webhook');
          } else if (product.name.toLowerCase().includes('family pantry pro')) {
            effectiveTierId = 'family_pantry_pro';
            log('Determined tier from product name: family_pantry_pro', 'stripe-webhook');
          }
        }
      }
    }
    
    // We might have tier info from payment intent metadata but no subscription yet
    if (!subscription && tierId) {
      // Check if this is one of our known tiers and convert to system tier name if needed
      if (tierId === 'smart') effectiveTierId = 'smart_pantry';
      else if (tierId === 'pro') effectiveTierId = 'family_pantry_pro';
    }
    
    if (effectiveTierId) {
      log(`Updating user ${user.id} subscription to tier ${effectiveTierId}`, 'stripe-webhook');
      
      // Update user's subscription details
      await storage.updateUserSubscription(user.id, {
        stripeSubscriptionId: effectiveSubscriptionId || user.stripeSubscriptionId || '',
        subscriptionStatus: 'active',
        subscriptionTier: effectiveTierId,
      });
      
      // Convert simple tier IDs to system tier names if needed
      const systemTierId = effectiveTierId === 'smart' ? 'smart_pantry' 
        : effectiveTierId === 'pro' ? 'family_pantry_pro' 
        : effectiveTierId;
      
      // Update user's limits based on tier
      const limits = TIER_LIMITS[systemTierId] || TIER_LIMITS.free;
      await storage.updateUserLimits(user.id, {
        receiptScansLimit: limits.scans,
        maxItems: limits.items,
        maxSharedUsers: limits.sharedUsers,
      });
      
      // Send tier upgrade notification
      const tierName = TIER_NAMES[systemTierId] || systemTierId;
      await sendNotification(
        user.id,
        'subscription_activated',
        `Your ${tierName} subscription has been activated! You now have access to all features.`,
        undefined,
        { tier: systemTierId, status: 'active' }
      );
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
    
    // Log payment intent metadata for debugging
    log(`Payment intent metadata for failed payment: ${JSON.stringify(paymentIntent.metadata || {})}`, 'stripe-webhook');
    
    // Find the invoice associated with this payment
    // @ts-ignore - payment_intent is not in the TypeScript definitions but is supported by the API
    const { data: invoices } = await stripe.invoices.list({
      payment_intent: paymentIntent.id,
    });
    
    // Handle direct customer info from payment intent if no invoice
    if (invoices.length === 0) {
      log(`No invoice found for payment intent: ${paymentIntent.id}`, 'stripe-webhook');
      
      // Even without an invoice, we might have customer info in the payment intent
      if (paymentIntent.customer) {
        const customerId = typeof paymentIntent.customer === 'string' 
          ? paymentIntent.customer
          : paymentIntent.customer.id;
          
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (user) {
          // Send generic payment failure notification
          await sendNotification(
            user.id,
            'payment_failed',
            `Your payment of ${(paymentIntent.amount / 100).toFixed(2)} ${paymentIntent.currency.toUpperCase()} has failed. Please update your payment method.`,
            undefined,
            { amount: paymentIntent.amount / 100, currency: paymentIntent.currency }
          );
        }
      }
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
    if ((invoice as any).subscription) {
      const subscription = await stripe.subscriptions.retrieve((invoice as any).subscription as string);
      
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
 * Handle invoice finalization
 * @param invoice Stripe invoice
 * @param sendNotification Function to send notifications
 */
async function handleInvoiceFinalized(
  invoice: Stripe.Invoice,
  sendNotification: SendNotificationFn
): Promise<void> {
  try {
    if (!stripe) {
      log('Stripe not initialized in webhook handler', 'stripe-webhook');
      return;
    }
    
    const customerId = invoice.customer as string;
    
    // Get user from database by Stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      log(`No user found with Stripe customer ID: ${customerId}`, 'stripe-webhook');
      return;
    }
    
    // Get formatted invoice details for notification
    const amount = invoice.amount_due / 100;
    const currency = invoice.currency;
    const invoiceNumber = invoice.number || invoice.id;
    const invoiceUrl = invoice.hosted_invoice_url;
    
    // Send notification to user
    await sendNotification(
      user.id,
      'invoice_created',
      `Your invoice #${invoiceNumber} for ${amount.toFixed(2)} ${currency.toUpperCase()} has been created.`,
      undefined,
      { 
        invoiceId: invoice.id,
        invoiceNumber,
        amount,
        currency,
        invoiceUrl,
        status: invoice.status
      }
    );
    
    // Send invoice email if user has an email
    if (user.email && invoiceUrl) {
      const tierName = user.subscriptionTier === 'smart_pantry' 
        ? 'Smart Pantry' 
        : user.subscriptionTier === 'family_pantry_pro' 
          ? 'Family Pantry Pro' 
          : 'Free';
      
      await sendInvoiceEmail(
        user.email,
        {
          invoiceNumber,
          invoiceDate: new Date(invoice.created * 1000),
          amount,
          currency,
          status: invoice.status || 'open',
          tierName,
          invoiceUrl
        }
      );
    }
    
    log(`Invoice finalized for user ${user.id}`, 'stripe-webhook');
  } catch (error) {
    log(`Error handling invoice finalized: ${error}`, 'stripe-webhook');
  }
}

/**
 * Handle invoice paid
 * @param invoice Stripe invoice
 * @param sendNotification Function to send notifications
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  sendNotification: SendNotificationFn
): Promise<void> {
  try {
    if (!stripe) {
      log('Stripe not initialized in webhook handler', 'stripe-webhook');
      return;
    }
    
    const customerId = invoice.customer as string;
    log(`Processing paid invoice for customer: ${customerId}`, 'stripe-webhook');
    
    // Get user from database by Stripe customer ID
    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) {
      log(`No user found with Stripe customer ID: ${customerId}`, 'stripe-webhook');
      return;
    }
    
    // Get formatted invoice details for notification
    const amount = invoice.amount_paid / 100;
    const currency = invoice.currency;
    const invoiceNumber = invoice.number || invoice.id;
    const invoiceUrl = invoice.hosted_invoice_url;
    const pdfUrl = invoice.invoice_pdf;
    
    // Get the subscription ID from the invoice
    const subscriptionId = invoice.subscription as string;
    log(`Found subscription ID in invoice: ${subscriptionId}`, 'stripe-webhook');
    
    if (subscriptionId) {
      try {
        // Fetch the subscription details to get the product info
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price.product']
        });
        log(`Retrieved subscription ${subscriptionId} for invoice ${invoice.id}`, 'stripe-webhook');
        
        // Get first item in the subscription
        const item = subscription.items.data[0];
        if (item && item.price && item.price.product) {
          log(`Processing subscription item for product`, 'stripe-webhook');
          
          // Extract product details
          const product = item.price.product as Stripe.Product;
          
          // Determine tier from product name or metadata
          let tier = 'free'; // Default to free
          
          // First check metadata for tier information
          if (product.metadata && product.metadata.tier) {
            tier = product.metadata.tier;
            log(`Found tier in product metadata: ${tier}`, 'stripe-webhook');
            
            // Convert simple tier IDs to system tier names if needed
            if (tier === 'smart') {
              tier = 'smart_pantry';
              log('Converted "smart" tier to "smart_pantry"', 'stripe-webhook');
            } else if (tier === 'pro') {
              tier = 'family_pantry_pro';
              log('Converted "pro" tier to "family_pantry_pro"', 'stripe-webhook');
            }
          } 
          // If no tier in metadata, try to determine from product name
          else if (product.name) {
            log(`No tier in metadata, checking product name: ${product.name}`, 'stripe-webhook');
            
            const productNameLower = product.name.toLowerCase();
            if (productNameLower.includes('smart')) {
              tier = 'smart_pantry';
              log('Determined tier from product name: smart_pantry', 'stripe-webhook');
            } else if (productNameLower.includes('family') || productNameLower.includes('pro')) {
              tier = 'family_pantry_pro';
              log('Determined tier from product name: family_pantry_pro', 'stripe-webhook');
            }
          }
          
          // If we have a valid tier, update the user's subscription in our database
          if (tier && tier !== 'free' && TIER_LIMITS[tier]) {
            log(`Updating user ${user.id} subscription to tier: ${tier}`, 'stripe-webhook');
            
            // Update subscription data in our database
            const updatedUser = await storage.updateUserSubscription(user.id, {
              stripeSubscriptionId: subscriptionId,
              subscriptionStatus: subscription.status,
              subscriptionTier: tier,
              currentBillingPeriodStart: new Date(subscription.current_period_start * 1000),
              currentBillingPeriodEnd: new Date(subscription.current_period_end * 1000)
            });
            
            // Update user limits based on the new tier
            await storage.updateUserLimits(user.id, {
              receiptScansLimit: TIER_LIMITS[tier].scans,
              maxItems: TIER_LIMITS[tier].items,
              maxSharedUsers: TIER_LIMITS[tier].sharedUsers
            });
            
            log(`Updated subscription tier for user ${user.id} to ${tier}`, 'stripe-webhook');
            
            // Send notification about the subscription upgrade
            await sendNotification(
              user.id,
              'subscription_upgraded',
              `Your subscription has been upgraded to ${TIER_NAMES[tier]}. Enjoy your new benefits!`,
              undefined,
              {
                tier,
                tierName: TIER_NAMES[tier],
                receiptScansLimit: TIER_LIMITS[tier].scans,
                maxItems: TIER_LIMITS[tier].items,
                maxSharedUsers: TIER_LIMITS[tier].sharedUsers
              }
            );
          } else {
            log(`Could not determine valid tier from product (${product.id}), using default`, 'stripe-webhook');
          }
        } else {
          log(`No subscription item or price found for subscription ${subscriptionId}`, 'stripe-webhook');
        }
      } catch (subError) {
        log(`Error processing subscription for invoice: ${subError}`, 'stripe-webhook');
      }
    }
    
    // Send notification to user about invoice payment
    await sendNotification(
      user.id,
      'invoice_paid',
      `Your payment of ${amount.toFixed(2)} ${currency.toUpperCase()} for invoice #${invoiceNumber} has been processed successfully.`,
      undefined,
      { 
        invoiceId: invoice.id,
        invoiceNumber,
        amount,
        currency,
        invoiceUrl,
        pdfUrl,
        status: 'paid'
      }
    );
    
    // Send receipt email if user has an email
    if (user.email) {
      // Get the current tier name after possible update
      const updatedUser = await storage.getUser(user.id);
      const tierName = updatedUser && updatedUser.subscriptionTier === 'smart_pantry'
        ? 'Smart Pantry' 
        : updatedUser && updatedUser.subscriptionTier === 'family_pantry_pro' 
          ? 'Family Pantry Pro' 
          : 'Free';
      
      await sendInvoiceEmail(
        user.email,
        {
          invoiceNumber,
          invoiceDate: new Date(invoice.created * 1000),
          amount,
          currency,
          status: 'paid',
          tierName,
          invoiceUrl,
          pdfUrl
        }
      );
    }
    
    log(`Invoice paid and processed for user ${user.id}`, 'stripe-webhook');
  } catch (error) {
    log(`Error handling invoice paid: ${error}`, 'stripe-webhook');
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
        
      case 'invoice.finalized':
        await handleInvoiceFinalized(
          event.data.object as Stripe.Invoice,
          sendNotification
        );
        break;
        
      case 'invoice.paid':
        await handleInvoicePaid(
          event.data.object as Stripe.Invoice,
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