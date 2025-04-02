import Stripe from 'stripe';
import { User } from '@shared/schema';
import { log } from '../../vite';

// Initialize Stripe client
let stripe: Stripe | null = null;
let stripeAvailable = false;

try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-03-31.basil',
    });
    stripeAvailable = true;
    log('Stripe initialized successfully', 'stripe');
  } else {
    log('STRIPE_SECRET_KEY is not set, Stripe features will be disabled', 'stripe');
  }
} catch (error) {
  log(`Error initializing Stripe: ${error}`, 'stripe');
}

// Tier price mapping
const TIER_PRICE_MAP: Record<string, { monthly: string; yearly: string }> = {
  'smart_pantry': {
    monthly: process.env.STRIPE_SMART_PANTRY_MONTHLY_PRICE_ID || '',
    yearly: process.env.STRIPE_SMART_PANTRY_YEARLY_PRICE_ID || '',
  },
  'family_pantry_pro': {
    monthly: process.env.STRIPE_FAMILY_PANTRY_PRO_MONTHLY_PRICE_ID || '',
    yearly: process.env.STRIPE_FAMILY_PANTRY_PRO_YEARLY_PRICE_ID || '',
  }
};

/**
 * Check if Stripe service is available
 * @returns True if Stripe service is available, false otherwise
 */
export function isStripeServiceAvailable(): boolean {
  return stripeAvailable && !!stripe;
}

/**
 * Create a new Stripe customer
 * @param user User to create a customer for
 * @returns Stripe customer ID
 */
export async function createStripeCustomer(user: User): Promise<string> {
  if (!stripeAvailable || !stripe) {
    throw new Error('Stripe service is not available');
  }

  try {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      name: user.fullName || user.username,
      metadata: {
        userId: user.id.toString(),
      },
    });

    log(`Created Stripe customer for user ${user.id}: ${customer.id}`, 'stripe');
    return customer.id;
  } catch (error: any) {
    log(`Error creating Stripe customer: ${error.message}`, 'stripe');
    throw error;
  }
}

/**
 * Create a new subscription for a customer
 * @param customerId Stripe customer ID
 * @param tierId Tier ID
 * @param interval Billing interval
 * @returns Subscription ID and client secret
 */
export async function createSubscription(
  customerId: string,
  tierId: string,
  interval: 'monthly' | 'yearly'
): Promise<{ subscriptionId: string; clientSecret: string }> {
  if (!stripeAvailable || !stripe) {
    throw new Error('Stripe service is not available');
  }

  const priceId = TIER_PRICE_MAP[tierId]?.[interval];
  if (!priceId) {
    throw new Error(`No price ID found for tier ${tierId} with interval ${interval}`);
  }

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId,
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
    });

    // Type assertion to get the client secret
    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;
    const clientSecret = paymentIntent.client_secret;

    if (!clientSecret) {
      throw new Error('No client secret found in the payment intent');
    }

    log(`Created subscription for customer ${customerId}: ${subscription.id}`, 'stripe');
    return {
      subscriptionId: subscription.id,
      clientSecret,
    };
  } catch (error: any) {
    log(`Error creating subscription: ${error.message}`, 'stripe');
    throw error;
  }
}

/**
 * Get subscription details
 * @param subscriptionId Subscription ID
 * @returns Stripe subscription
 */
export async function getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  if (!stripeAvailable || !stripe) {
    throw new Error('Stripe service is not available');
  }

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error: any) {
    log(`Error retrieving subscription: ${error.message}`, 'stripe');
    throw error;
  }
}

/**
 * Cancel a subscription
 * @param subscriptionId Subscription ID
 * @returns Stripe subscription
 */
export async function cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  if (!stripeAvailable || !stripe) {
    throw new Error('Stripe service is not available');
  }

  try {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  } catch (error: any) {
    log(`Error canceling subscription: ${error.message}`, 'stripe');
    throw error;
  }
}

/**
 * Resume a subscription
 * @param subscriptionId Subscription ID
 * @returns Stripe subscription
 */
export async function resumeSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
  if (!stripeAvailable || !stripe) {
    throw new Error('Stripe service is not available');
  }

  try {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  } catch (error: any) {
    log(`Error resuming subscription: ${error.message}`, 'stripe');
    throw error;
  }
}

/**
 * Get customer's payment methods
 * @param customerId Stripe customer ID
 * @returns Array of payment methods
 */
export async function getCustomerPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
  if (!stripeAvailable || !stripe) {
    throw new Error('Stripe service is not available');
  }

  try {
    const { data } = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return data;
  } catch (error: any) {
    log(`Error getting payment methods: ${error.message}`, 'stripe');
    throw error;
  }
}

/**
 * Get customer's invoices
 * @param customerId Stripe customer ID
 * @returns Array of invoices
 */
export async function getCustomerInvoices(customerId: string): Promise<Stripe.Invoice[]> {
  if (!stripeAvailable || !stripe) {
    throw new Error('Stripe service is not available');
  }

  try {
    const { data } = await stripe.invoices.list({
      customer: customerId,
      limit: 10,
    });
    return data;
  } catch (error: any) {
    log(`Error getting invoices: ${error.message}`, 'stripe');
    throw error;
  }
}

/**
 * Format subscription data for frontend
 * @param subscription Stripe subscription
 * @returns Formatted subscription data
 */
export function formatSubscriptionData(subscription: Stripe.Subscription): any {
  const item = subscription.items.data[0];
  const price = item?.price;
  const product = price?.product as string;
  
  // Determine subscription tier from product ID
  let tier = 'unknown';
  if (product) {
    // Map product ID to tier
    // This is a simplified example, you might need a more complex mapping
    if (product.includes('smart_pantry')) {
      tier = 'smart_pantry';
    } else if (product.includes('family_pantry_pro')) {
      tier = 'family_pantry_pro';
    }
  }
  
  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    interval: price?.recurring?.interval || 'month',
    tier,
    amount: price?.unit_amount ? price.unit_amount / 100 : 0,
    currency: price?.currency || 'usd',
  };
}

/**
 * Format invoice data for frontend
 * @param invoice Stripe invoice
 * @returns Formatted invoice data
 */
export function formatInvoiceData(invoice: Stripe.Invoice): any {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    created: new Date(invoice.created * 1000),
    dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency,
    pdf: invoice.invoice_pdf,
  };
}

/**
 * Format payment method data for frontend
 * @param paymentMethod Stripe payment method
 * @returns Formatted payment method data
 */
export function formatPaymentMethodData(paymentMethod: Stripe.PaymentMethod): any {
  const card = paymentMethod.card;
  
  return {
    id: paymentMethod.id,
    type: paymentMethod.type,
    brand: card?.brand || '',
    last4: card?.last4 || '',
    expiryMonth: card?.exp_month || 0,
    expiryYear: card?.exp_year || 0,
    isDefault: paymentMethod.metadata?.default === 'true',
  };
}