import { Express, Request, Response } from 'express';
import { User } from '@shared/schema';
import { storage } from '../../storage';
import { log } from '../../vite';
import {
  isStripeServiceAvailable,
  createStripeCustomer,
  createSubscription,
  getSubscription,
  cancelSubscription,
  resumeSubscription,
  getCustomerPaymentMethods,
  getCustomerInvoices,
  formatSubscriptionData,
  formatInvoiceData,
  formatPaymentMethodData,
} from './stripe-service';
import { handleStripeWebhookEvent } from './webhook-handler';
import { SendNotificationFn } from '../../routes';
import Stripe from 'stripe';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Register billing-related routes
 * @param app Express application
 * @param sendNotification Function to send notifications
 */
export function registerBillingRoutes(app: Express, sendNotification: SendNotificationFn) {
  // Check if Stripe service is available
  const stripeAvailable = isStripeServiceAvailable();
  log(`Stripe service available: ${stripeAvailable}`, 'billing');

  // Stripe webhook endpoint
  app.post('/api/billing/webhook', async (req: Request, res: Response) => {
    if (!stripeAvailable) {
      return res.status(503).json({ error: 'Stripe service is not available' });
    }

    const sig = req.headers['stripe-signature'];
    if (!sig || !STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({ error: 'Missing required Stripe signature or webhook secret' });
    }

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      });

      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );

      // Handle the webhook event
      await handleStripeWebhookEvent(event, sendNotification);

      return res.json({ received: true });
    } catch (err: any) {
      log(`Webhook Error: ${err.message}`, 'billing');
      return res.status(400).json({ error: err.message });
    }
  });

  // Get user's subscription
  app.get('/api/billing/subscription', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!stripeAvailable) {
      return res.json({ stripeDisabled: true });
    }

    try {
      const user = req.user as User;
      
      // If user has no subscription ID, they're on the free tier
      if (!user.stripeSubscriptionId) {
        return res.json({
          subscription: {
            tier: 'free',
            status: user.subscriptionStatus || 'active',
          }
        });
      }
      
      // Get the subscription from Stripe
      const subscription = await getSubscription(user.stripeSubscriptionId);
      
      // Format the subscription data for the frontend
      const formattedSubscription = formatSubscriptionData(subscription);
      
      return res.json({ subscription: formattedSubscription });
    } catch (err: any) {
      log(`Error getting subscription: ${err.message}`, 'billing');
      return res.status(500).json({ error: err.message });
    }
  });

  // Get user's invoices
  app.get('/api/billing/invoices', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!stripeAvailable) {
      return res.json({ invoices: [] });
    }

    try {
      const user = req.user as User;
      
      // If user has no customer ID, they have no invoices
      if (!user.stripeCustomerId) {
        return res.json({ invoices: [] });
      }
      
      // Get invoices from Stripe
      const invoices = await getCustomerInvoices(user.stripeCustomerId);
      
      // Format the invoices data for the frontend
      const formattedInvoices = invoices.map(formatInvoiceData);
      
      return res.json({ invoices: formattedInvoices });
    } catch (err: any) {
      log(`Error getting invoices: ${err.message}`, 'billing');
      return res.status(500).json({ error: err.message });
    }
  });

  // Get user's payment methods
  app.get('/api/billing/payment-methods', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!stripeAvailable) {
      return res.json({ paymentMethods: [] });
    }

    try {
      const user = req.user as User;
      
      // If user has no customer ID, they have no payment methods
      if (!user.stripeCustomerId) {
        return res.json({ paymentMethods: [] });
      }
      
      // Get payment methods from Stripe
      const paymentMethods = await getCustomerPaymentMethods(user.stripeCustomerId);
      
      // Format the payment methods data for the frontend
      const formattedPaymentMethods = paymentMethods.map(formatPaymentMethodData);
      
      return res.json({ paymentMethods: formattedPaymentMethods });
    } catch (err: any) {
      log(`Error getting payment methods: ${err.message}`, 'billing');
      return res.status(500).json({ error: err.message });
    }
  });

  // Create a subscription
  app.post('/api/billing/create-subscription', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!stripeAvailable) {
      return res.status(503).json({ error: 'Stripe service is not available' });
    }

    try {
      const user = req.user as User;
      const { tierId, interval = 'monthly' } = req.body;
      
      if (!tierId) {
        return res.status(400).json({ error: 'Missing tier ID' });
      }
      
      // Free tier doesn't need a subscription
      if (tierId === 'free') {
        return res.status(400).json({ error: 'Cannot create a subscription for the free tier' });
      }
      
      // Ensure the user has a Stripe customer ID
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        // Create a new Stripe customer
        customerId = await createStripeCustomer(user);
        
        // Update the user's Stripe customer ID
        await storage.updateStripeCustomerId(user.id, customerId);
      }
      
      // Create a new subscription
      const { subscriptionId, clientSecret } = await createSubscription(
        customerId,
        tierId,
        interval as 'monthly' | 'yearly'
      );
      
      return res.json({ subscriptionId, clientSecret });
    } catch (err: any) {
      log(`Error creating subscription: ${err.message}`, 'billing');
      return res.status(500).json({ error: err.message });
    }
  });

  // Cancel a subscription
  app.post('/api/billing/cancel-subscription', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!stripeAvailable) {
      return res.status(503).json({ error: 'Stripe service is not available' });
    }

    try {
      const user = req.user as User;
      
      // If user has no subscription ID, they have nothing to cancel
      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ error: 'No active subscription' });
      }
      
      // Cancel the subscription
      const subscription = await cancelSubscription(user.stripeSubscriptionId);
      
      // Format the subscription data for the frontend
      const formattedSubscription = formatSubscriptionData(subscription);
      
      return res.json({ subscription: formattedSubscription });
    } catch (err: any) {
      log(`Error canceling subscription: ${err.message}`, 'billing');
      return res.status(500).json({ error: err.message });
    }
  });

  // Resume a subscription
  app.post('/api/billing/resume-subscription', async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!stripeAvailable) {
      return res.status(503).json({ error: 'Stripe service is not available' });
    }

    try {
      const user = req.user as User;
      
      // If user has no subscription ID, they have nothing to resume
      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ error: 'No active subscription' });
      }
      
      // Resume the subscription
      const subscription = await resumeSubscription(user.stripeSubscriptionId);
      
      // Format the subscription data for the frontend
      const formattedSubscription = formatSubscriptionData(subscription);
      
      return res.json({ subscription: formattedSubscription });
    } catch (err: any) {
      log(`Error resuming subscription: ${err.message}`, 'billing');
      return res.status(500).json({ error: err.message });
    }
  });
}