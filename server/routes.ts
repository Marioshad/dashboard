import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { updateProfileSchema } from "@shared/schema";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import express from 'express';
import { db, pool } from "./db";
import { format } from "date-fns";
import { 
  roles, permissions, rolePermissions, users, appSettings, notifications,
  locations, foodItems, stores, tags, foodItemTags, insertLocationSchema, updateLocationSchema,
  insertFoodItemSchema, updateFoodItemSchema, insertStoreSchema, updateStoreSchema
} from "@shared/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import Stripe from "stripe";
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Socket } from 'net';
import { parse } from 'cookie';
import cookieSignature from 'cookie-signature';
import { log } from './vite';
import { registerBillingRoutes } from './services/stripe/billing-routes';
import { registerAdminRoutes } from './services/admin/admin-routes';

const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat';

// Make Stripe integration optional
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  console.log("Stripe payment processing initialized successfully");
} else {
  console.warn("STRIPE_SECRET_KEY not provided. Payment features will be disabled.");
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const multerStorage = multer.diskStorage({
  destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadsDir);
  },
  filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
});

// Import the WebSocket handlers
import { sendNotification as wsSendNotification } from './websockets/handlers/notificationHandler';
import { updateReceiptScanUsage as wsUpdateReceiptScanUsage } from './websockets/handlers/usageUpdateHandler';
import { getConnectedClients } from './websockets/index';

async function sendNotification(userId: number, type: string, message: string, actorId?: number, metadata?: any) {
  try {
    log(`Sending notification to user ${userId}: ${type} - ${message}`);
    
    // Use the specialized notification handler from the websockets module 
    // which handles both database and WebSocket operations
    const notification = await wsSendNotification(
      userId,
      type,
      message,
      actorId,
      metadata,
      getConnectedClients() // Get the current connected clients map
    );
    
    log(`Notification sent and saved with ID ${notification.id}`);
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get('/ping', (_req, res) => {
    res.status(200).send('pong');
  });

  setupAuth(app);

  app.post('/api/profile/avatar', upload.single('avatar'), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const avatarUrl = `/uploads/${req.file.filename}`;
      // Get current user data to ensure we maintain required fields
      const currentUser = await storage.getUser(req.user.id);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user has required fields (should always be true, but let's be safe)
      const userFullName = currentUser.fullName || '';
      const userEmail = currentUser.email || '';
      
      if (!userFullName || !userEmail) {
        return res.status(400).json({ message: "User profile is missing required fields" });
      }
      
      // Update only the avatarUrl while preserving other required fields
      const updatedUser = await storage.updateProfile(req.user.id, {
        fullName: userFullName,
        email: userEmail,
        avatarUrl
      });
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });

  app.use('/uploads', express.static(uploadsDir));

  app.patch('/api/profile', async (req, res, next) => {
    try {
      console.log('=== PROFILE UPDATE API ===');
      console.log('Request body:', req.body);
      
      if (!req.isAuthenticated()) {
        console.log('Profile update failed: User not authenticated');
        return res.sendStatus(401);
      }
      
      console.log('User authenticated, ID:', req.user.id);
      console.log('Username:', req.user.username);

      const result = updateProfileSchema.safeParse(req.body);
      if (!result.success) {
        console.log('Profile update validation failed:', result.error);
        return res.status(400).json({ message: "Invalid profile data", errors: result.error.format() });
      }
      
      console.log('Validation successful, parsed data:', result.data);
      console.log('Calling storage.updateProfile with data:', JSON.stringify(result.data));

      const updatedUser = await storage.updateProfile(req.user.id, result.data);
      console.log('Profile updated successfully, returning user:', JSON.stringify(updatedUser));
      
      res.json(updatedUser);
    } catch (error) {
      console.error('Profile update ERROR:', error);
      next(error);
    }
  });

  app.get('/api/roles', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const rolesWithPermissions = await db.query.roles.findMany({
        where: isNull(roles.deletedAt),
        with: {
          rolePermissions: {
            with: {
              permission: true
            }
          }
        }
      });

      const transformedRoles = rolesWithPermissions.map(role => ({
        ...role,
        permissions: role.rolePermissions.map(rp => rp.permission)
      }));

      res.json(transformedRoles);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/roles', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const { permissions: permissionIds, ...roleData } = req.body;

      const [role] = await db.insert(roles)
        .values(roleData)
        .returning();

      if (permissionIds?.length) {
        await db.insert(rolePermissions)
          .values(permissionIds.map((id: number) => ({
            roleId: role.id,
            permissionId: id
          })));
      }

      res.status(201).json(role);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/roles/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const { permissions: permissionIds, ...roleData } = req.body;

      const [role] = await db.update(roles)
        .set({ ...roleData, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(roles.id, parseInt(req.params.id)))
        .returning();

      if (permissionIds) {
        await db.delete(rolePermissions)
          .where(eq(rolePermissions.roleId, role.id));

        if (permissionIds.length) {
          await db.insert(rolePermissions)
            .values(permissionIds.map((id: number) => ({
              roleId: role.id,
              permissionId: id
            })));
        }
      }

      res.json(role);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/roles/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      await db.update(roles)
        .set({
          deletedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(roles.id, parseInt(req.params.id)));

      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/permissions', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const permissionsList = await db.select()
        .from(permissions)
        .where(isNull(permissions.deletedAt));

      res.json(permissionsList);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/permissions', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const [permission] = await db.insert(permissions)
        .values(req.body)
        .returning();

      res.status(201).json(permission);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/permissions/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const [permission] = await db.update(permissions)
        .set(req.body)
        .where(eq(permissions.id, parseInt(req.params.id)))
        .returning();

      res.json(permission);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/permissions/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      await db.update(permissions)
        .set({ deletedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(permissions.id, parseInt(req.params.id)));

      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/users', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const userRole = await db.query.roles.findFirst({
        where: eq(roles.id, req.user.roleId as number),
      });

      if (!userRole || !['Superadmin', 'Admin'].includes(userRole.name)) {
        return res.sendStatus(403);
      }

      const usersList = await db.query.users.findMany({
        where: isNull(users.deletedAt),
        with: {
          role: true
        }
      });

      res.json(usersList);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/settings/admin', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const userRole = await db.query.roles.findFirst({
        where: eq(roles.id, req.user.roleId as number),
      });

      if (!userRole || !['Superadmin', 'Admin'].includes(userRole.name)) {
        return res.sendStatus(403);
      }

      const [settings] = await db.select().from(appSettings).limit(1);
      res.json(settings || { require2FA: false });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/settings/admin', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const userRole = await db.query.roles.findFirst({
        where: eq(roles.id, req.user.roleId as number),
      });

      if (!userRole || !['Superadmin', 'Admin'].includes(userRole.name)) {
        return res.sendStatus(403);
      }

      const [settings] = await db.select().from(appSettings).limit(1);

      if (settings) {
        const [updated] = await db
          .update(appSettings)
          .set({
            ...req.body,
            updatedBy: req.user.id,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(appSettings.id, settings.id))
          .returning();
        res.json(updated);
      } else {
        const [created] = await db
          .insert(appSettings)
          .values({
            ...req.body,
            updatedBy: req.user.id,
          })
          .returning();
        res.json(created);
      }
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/user/2fa', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const [settings] = await db.select().from(appSettings).limit(1);
      const userRole = await db.query.roles.findFirst({
        where: eq(roles.id, req.user.roleId as number),
      });

      // Safely check if user role includes admin roles, handling the case where userRole might be undefined
      const isAdmin = userRole && ['Superadmin', 'Admin'].includes(userRole.name);
      
      if (!req.body.enabled && settings?.require2FA && !isAdmin) {
        return res.status(403).json({ message: "2FA is required by administrator" });
      }

      const [updated] = await db
        .update(users)
        .set({
          twoFactorEnabled: req.body.enabled,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, req.user.id))
        .returning();

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });


  app.get('/api/notifications', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const userNotifications = await db.query.notifications.findMany({
        where: eq(notifications.userId, req.user.id),
        orderBy: desc(notifications.createdAt),
        with: {
          actor: true
        }
      });

      res.json(userNotifications);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/notifications/read', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const userId = req.user.id;

      // Get the count of unread notifications before update
      const unreadCountBefore = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
          )
        )
        .then(result => result[0]?.count || 0);

      // Skip update if there are no unread notifications
      if (unreadCountBefore === 0) {
        return res.sendStatus(200);
      }

      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
          )
        );

      // Send a WebSocket notification to update badge count in real-time
      if (app.locals.sendWebSocketNotification) {
        app.locals.sendWebSocketNotification(userId, 'notification', {
          type: 'unread_count_update',
          unreadCount: 0, // All notifications are now read
          timestamp: new Date().toISOString()
        });
      }

      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });
  
  // Route to mark a single notification as read
  app.post('/api/notifications/:id/read', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const notificationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ error: 'Invalid notification ID' });
      }

      // Mark single notification as read
      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.id, notificationId),
            eq(notifications.userId, userId)
          )
        );
      
      // Get the updated count of unread notifications
      const unreadCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            eq(notifications.read, false)
          )
        )
        .then(result => result[0]?.count || 0);
      
      // Send a WebSocket notification to update badge count in real-time
      if (app.locals.sendWebSocketNotification) {
        app.locals.sendWebSocketNotification(userId, 'notification', {
          type: 'unread_count_update',
          unreadCount: unreadCount,
          timestamp: new Date().toISOString()
        });
      }
      
      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/subscription/prices', async (req, res) => {
    try {
      // Function to get database settings
      async function getDbSettings() {
        try {
          const client = await pool.connect();
          try {
            // Get settings from the database
            const result = await client.query(`
              SELECT 
                stripe_smart_product_id,
                stripe_pro_product_id,
                stripe_smart_monthly_price_id,
                stripe_smart_yearly_price_id,
                stripe_pro_monthly_price_id,
                stripe_pro_yearly_price_id
              FROM app_settings 
              WHERE id = 1
            `);
            
            return result.rows[0] || {};
          } finally {
            client.release();
          }
        } catch (dbError) {
          console.error('Error fetching Stripe settings from database:', dbError);
          return {};
        }
      }
      
      // Function to create a set of manual prices using DB settings if available
      async function createManualPrices() {
        const dbSettings = await getDbSettings();
        
        return [
          {
            id: dbSettings.stripe_smart_monthly_price_id || 'price_smart_monthly',
            unit_amount: 999, // $9.99
            recurring: {
              interval: 'month'
            },
            product: {
              id: dbSettings.stripe_smart_product_id || 'prod_smart',
              name: 'Smart Pantry Monthly',
              description: 'Smart Pantry subscription billed monthly',
              metadata: {
                tier: 'smart'
              }
            }
          },
          {
            id: dbSettings.stripe_smart_yearly_price_id || 'price_smart_yearly',
            unit_amount: 9999, // $99.99
            recurring: {
              interval: 'year'
            },
            product: {
              id: dbSettings.stripe_smart_product_id || 'prod_smart',
              name: 'Smart Pantry Yearly',
              description: 'Smart Pantry subscription billed yearly',
              metadata: {
                tier: 'smart'
              }
            }
          },
          {
            id: dbSettings.stripe_pro_monthly_price_id || 'price_pro_monthly',
            unit_amount: 1999, // $19.99
            recurring: {
              interval: 'month'
            },
            product: {
              id: dbSettings.stripe_pro_product_id || 'prod_pro',
              name: 'Family Pantry Pro Monthly',
              description: 'Family Pantry Pro subscription billed monthly',
              metadata: {
                tier: 'pro'
              }
            }
          },
          {
            id: dbSettings.stripe_pro_yearly_price_id || 'price_pro_yearly',
            unit_amount: 19999, // $199.99
            recurring: {
              interval: 'year'
            },
            product: {
              id: dbSettings.stripe_pro_product_id || 'prod_pro',
              name: 'Family Pantry Pro Yearly',
              description: 'Family Pantry Pro subscription billed yearly',
              metadata: {
                tier: 'pro'
              }
            }
          }
        ];
      }
      
      // Check if Stripe is configured
      if (!stripe) {
        console.log('Stripe service not available. Returning subscription tiers from database settings and schema.');
        
        // Return manually constructed prices with database settings if available
        const manualPrices = await createManualPrices();
        return res.json(manualPrices);
      }

      // If Stripe is configured, fetch real prices
      try {
        // Get settings from database
        const dbSettings = await getDbSettings();
        
        // Get product IDs from database or fallback to environment variables
        const smartProductId = dbSettings.stripe_smart_product_id || process.env.STRIPE_PRODUCT_SMART;
        const proProductId = dbSettings.stripe_pro_product_id || process.env.STRIPE_PRODUCT_PRO;
        
        // Get all active prices
        const { data: prices } = await stripe.prices.list({
          active: true,
          expand: ['data.product'],
          limit: 100,
        });
        
        // Filter prices for our subscription products based on product IDs or metadata
        const subscriptionPrices = prices.filter(price => {
          const product = price.product as Stripe.Product;
          
          // Check if product ID matches one of our product IDs from database/env
          if (smartProductId && product.id === smartProductId) {
            // Set metadata tier to 'smart' if not already set
            if (!product.metadata?.tier) {
              (product.metadata = product.metadata || {}).tier = 'smart';
            }
            return true;
          }
          
          if (proProductId && product.id === proProductId) {
            // Set metadata tier to 'pro' if not already set
            if (!product.metadata?.tier) {
              (product.metadata = product.metadata || {}).tier = 'pro';
            }
            return true;
          }
          
          // Fallback to metadata tier check
          return product.metadata?.tier === 'smart' || product.metadata?.tier === 'pro';
        });
        
        if (subscriptionPrices.length > 0) {
          return res.json(subscriptionPrices);
        }
        
        // If no prices found, fall back to manually constructed prices
        const manualPrices = await createManualPrices();
        return res.json(manualPrices);
      } catch (stripeError: any) {
        console.error('Error fetching prices from Stripe:', stripeError);
        
        // If Stripe API call fails, return manually constructed prices with database settings
        const manualPrices = await createManualPrices();
        return res.json(manualPrices);
      }
    } catch (error: any) {
      console.error('Unexpected error in subscription prices endpoint:', error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/get-or-create-subscription', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ message: 'Price ID is required' });
      }

      let user = req.user;

      if (user.stripeSubscriptionId) {
        const subscription = await stripe!.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['latest_invoice.payment_intent']
        });

        const invoice = subscription.latest_invoice as Stripe.Invoice;
        const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

        if (!paymentIntent?.client_secret) {
          throw new Error('Unable to retrieve payment information');
        }

        res.send({
          subscriptionId: subscription.id,
          clientSecret: paymentIntent.client_secret
        });
        return;
      }

      if (!user.email) {
        return res.status(400).json({ message: 'Email is required for subscription' });
      }

      const customer = await stripe!.customers.create({
        email: user.email,
        name: user.username,
      });

      const subscription = await stripe!.subscriptions.create({
        customer: customer.id,
        items: [{
          price: priceId,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });

      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = invoice.payment_intent as Stripe.PaymentIntent;

      if (!paymentIntent?.client_secret) {
        throw new Error('Unable to create payment intent');
      }

      await db.update(users)
        .set({
          stripeCustomerId: customer.id,
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: 'inactive',
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, user.id));

      res.send({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret
      });
    } catch (error: any) {
      console.error('Subscription error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
      return res.status(503).json({ 
        message: 'Payment service unavailable. Please contact administrator.',
        stripeDisabled: true
      });
    }
    
    // Get webhook secret from database settings if available
    let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    try {
      const client = await pool.connect();
      try {
        // Get settings from the database
        const result = await client.query(`
          SELECT stripe_webhook_secret
          FROM app_settings 
          WHERE id = 1
        `);
        
        const dbSettings = result.rows[0] || {};
        if (dbSettings.stripe_webhook_secret) {
          webhookSecret = dbSettings.stripe_webhook_secret;
        }
      } finally {
        client.release();
      }
    } catch (dbError) {
      console.error('Error fetching Stripe webhook secret from database:', dbError);
    }
    
    if (!webhookSecret) {
      console.error('Missing Stripe webhook secret - not found in environment or database');
      return res.status(500).json({ message: 'Payment webhook misconfigured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe!.webhooks.constructEvent(
        req.body,
        sig as string,
        webhookSecret
      );
    } catch (err: any) {
      console.error('Webhook error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Import the webhook handler dynamically
    const { handleStripeWebhookEvent } = await import('./services/stripe/webhook-handler');
    
    try {
      // Call the webhook handler
      await handleStripeWebhookEvent(event, sendNotification);
      console.log(`Successfully processed webhook event: ${event.type}`);
    } catch (error) {
      console.error(`Error handling webhook event ${event.type}:`, error);
    }

    res.json({ received: true });
  });

  // Food Tracking API Routes
  
  // Locations API
  app.get('/api/locations', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const userLocations = await storage.getLocations(req.user.id);
      res.json(userLocations);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/locations', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const result = insertLocationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid location data", errors: result.error.format() });
      }
      
      const location = await storage.createLocation({
        ...result.data,
        userId: req.user.id
      });
      
      res.status(201).json(location);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/locations/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const locationId = parseInt(req.params.id);
      if (isNaN(locationId)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }
      
      const location = await storage.getLocation(locationId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      // Verify ownership
      if (location.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(location);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/locations/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const locationId = parseInt(req.params.id);
      if (isNaN(locationId)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }
      
      // Check if location exists and belongs to user
      const location = await storage.getLocation(locationId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      if (location.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const result = updateLocationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid location data", errors: result.error.format() });
      }
      
      const updatedLocation = await storage.updateLocation(locationId, result.data);
      res.json(updatedLocation);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/locations/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const locationId = parseInt(req.params.id);
      if (isNaN(locationId)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }
      
      // Check if location exists and belongs to user
      const location = await storage.getLocation(locationId);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }
      
      if (location.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteLocation(locationId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Food Items API
  app.get('/api/food-items', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
      
      const items = await storage.getFoodItems(req.user.id, locationId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });
  
  // Get food item suggestions based on partial name
  app.get('/api/food-items/suggestions', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const userId = req.user.id;
      const name = req.query.name as string;
      
      if (!name || name.length < 2) {
        return res.json([]);
      }
      
      // Get all items
      const allItems = await storage.getFoodItems(userId);
      
      // Filter items with similar names
      const lowercaseName = name.toLowerCase();
      let similarItems = allItems.filter(item => 
        item.name.toLowerCase().includes(lowercaseName)
      );
      
      // Group similar items by name to count occurrences
      const itemCounts: Record<string, { 
        item: typeof allItems[0]; 
        count: number; 
        totalPrice: number; 
        priceHistory: Array<{price: number; date: string}>
      }> = {};
      
      // Count occurrences of each item name
      similarItems.forEach(item => {
        const normalizedName = item.name.toLowerCase();
        if (!itemCounts[normalizedName]) {
          itemCounts[normalizedName] = { 
            item, 
            count: 0,
            totalPrice: 0,
            priceHistory: []
          };
        }
        itemCounts[normalizedName].count++;
        if (item.price) {
          itemCounts[normalizedName].totalPrice += Number(item.price);
          itemCounts[normalizedName].priceHistory.push({
            price: Number(item.price),
            date: item.purchased instanceof Date ? item.purchased.toISOString() : item.purchased
          });
        }
      });
      
      // Convert back to array and sort by count (higher first)
      const suggestions = Object.values(itemCounts)
        .map(itemData => ({
          ...itemData.item,
          occurrences: itemData.count,
          averagePrice: itemData.count > 0 && itemData.totalPrice > 0 ? itemData.totalPrice / itemData.count : null,
          priceHistory: itemData.priceHistory
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10) // Keep only 10 most recent prices
        }))
        .sort((a, b) => (b.occurrences as number) - (a.occurrences as number))
        .slice(0, 5); // Return top 5 suggestions
      
      res.json(suggestions);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/food-items', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const result = insertFoodItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid food item data", errors: result.error.format() });
      }
      
      // Verify location ownership if provided
      if (result.data.locationId) {
        const location = await storage.getLocation(result.data.locationId);
        if (!location || location.userId !== req.user.id) {
          return res.status(403).json({ message: "Invalid location or access denied" });
        }
      }
      
      // Check receipt item limits for free tier users
      if (result.data.receiptId) {
        // Get user's subscription tier
        const user = await db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
        
        if (user.length > 0 && user[0].subscriptionTier === 'free') {
          // Count existing items for this receipt
          const existingItemsCount = await db
            .select({ count: sql`count(*)` })
            .from(foodItems)
            .where(and(
              eq(foodItems.receiptId, result.data.receiptId),
              eq(foodItems.userId, req.user.id)
            ));
            
          const count = Number(existingItemsCount[0]?.count || 0);
          
          // If we've already hit the 50 item limit, don't add more
          if (count >= 50) {
            // Send a notification about the limit being reached
            await sendNotification(
              req.user.id,
              'item_limit_reached',
              `You've reached the 50-item limit for receipt items on your free plan. Upgrade to add more items.`,
              undefined,
              { 
                receiptId: result.data.receiptId,
                limit: 50,
                count: count,
                subscriptionTier: 'free'
              }
            );
            
            return res.status(403).json({ 
              message: "Item limit reached",
              error: 'FREE_TIER_ITEM_LIMIT',
              details: 'Free tier accounts are limited to 50 items per receipt. Upgrade your plan to get unlimited items.',
              limit: 50,
              count: count
            });
          }
        }
      }
      
      const foodItem = await storage.createFoodItem({
        ...result.data,
        userId: req.user.id
      });
      
      res.status(201).json(foodItem);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/food-items/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid food item ID" });
      }
      
      const item = await storage.getFoodItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Food item not found" });
      }
      
      // Verify ownership
      if (item.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(item);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/food-items/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid food item ID" });
      }
      
      // Check if item exists and belongs to user
      const item = await storage.getFoodItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Food item not found" });
      }
      
      if (item.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const result = updateFoodItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid food item data", errors: result.error.format() });
      }
      
      // If location is being changed, verify ownership of the new location
      if (result.data.locationId && result.data.locationId !== item.locationId) {
        const location = await storage.getLocation(result.data.locationId);
        if (!location || location.userId !== req.user.id) {
          return res.status(403).json({ message: "Invalid location or access denied" });
        }
      }
      
      const updatedItem = await storage.updateFoodItem(itemId, result.data);
      res.json(updatedItem);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/food-items/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid food item ID" });
      }
      
      // Check if item exists and belongs to user
      const item = await storage.getFoodItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Food item not found" });
      }
      
      if (item.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteFoodItem(itemId);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Receipt upload endpoint
  // Store endpoints
  app.get('/api/stores', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const storesList = await storage.getStores(req.user.id);
      res.json(storesList);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/stores/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const store = await storage.getStore(parseInt(req.params.id));
      if (!store || store.userId !== req.user.id) {
        return res.status(404).json({ message: "Store not found" });
      }

      res.json(store);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/stores', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const result = insertStoreSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid store data", 
          errors: result.error.format() 
        });
      }

      const newStore = await storage.createStore({
        ...result.data,
        userId: req.user.id
      });

      await sendNotification(
        req.user.id,
        'store_created',
        `New store "${newStore.name}" added to your account.`,
        undefined,  // No actor ID
        { storeId: newStore.id }
      );

      res.status(201).json(newStore);
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/stores/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const store = await storage.getStore(parseInt(req.params.id));
      if (!store || store.userId !== req.user.id) {
        return res.status(404).json({ message: "Store not found" });
      }

      const result = updateStoreSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: "Invalid store data", 
          errors: result.error.format() 
        });
      }

      const updatedStore = await storage.updateStore(store.id, result.data);
      res.json(updatedStore);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/stores/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const store = await storage.getStore(parseInt(req.params.id));
      if (!store || store.userId !== req.user.id) {
        return res.status(404).json({ message: "Store not found" });
      }

      await storage.deleteStore(store.id);
      res.status(200).json({ success: true, message: "Store deleted successfully" });
    } catch (error) {
      next(error);
    }
  });

// Helper function to update receipt scan usage via WebSocket
const updateReceiptScanUsage = async (userId: number, scansUsed: number, scansLimit: number) => {
  try {
    // Send a notification about scan usage
    await sendNotification(userId, 'receipt_scan_usage', `You have used ${scansUsed} out of ${scansLimit} receipt scans.`, undefined, {
      scansUsed,
      scansLimit
    });
    
    // Use the specialized handler from the websockets module 
    // but tell it to skip the database update since we already did that in routes.ts
    await wsUpdateReceiptScanUsage(
      userId,
      scansUsed,
      scansLimit,
      getConnectedClients(), // Get the current connected clients map
      true // Skip database update since we already did that
    );
    
    log(`Updated and broadcast receipt scan usage for user ${userId}: ${scansUsed}/${scansLimit}`);
  } catch (error) {
    console.error('Error updating receipt scan usage:', error);
  }
};

  app.post('/api/receipts/upload', upload.single('receipt'), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Check receipt scan limits based on subscription tier
      const user = req.user;
      
      // If user has a limit (not unlimited) and has reached it, block the upload
      if (user.receiptScansLimit !== null && 
          user.receiptScansLimit !== undefined && 
          user.receiptScansLimit >= 0 && 
          user.receiptScansUsed !== null &&
          user.receiptScansUsed !== undefined &&
          user.receiptScansUsed >= user.receiptScansLimit) {
        
        // Get the next tier name for the upgrade message
        const nextTier = user.subscriptionTier === 'free' ? 'Smart Pantry' : 'Family Pantry Pro';
        
        // Send a notification to the user about reaching their limit
        await sendNotification(
          user.id, 
          'subscription_limit', 
          `You've reached your receipt scan limit of ${user.receiptScansLimit}. Please upgrade your subscription to continue scanning receipts.`,
          undefined,
          {
            limitType: 'receipt_scans',
            currentTier: user.subscriptionTier,
            nextTier: user.subscriptionTier === 'pro' ? null : nextTier,
            scanLimit: user.receiptScansLimit,
            scansUsed: user.receiptScansUsed
          }
        );
        
        return res.status(403).json({ 
          message: `You've reached your receipt scan limit (${user.receiptScansLimit}) for this billing period.`,
          error: 'RECEIPT_LIMIT_REACHED',
          tierInfo: {
            currentTier: user.subscriptionTier,
            scanLimit: user.receiptScansLimit,
            scansUsed: user.receiptScansUsed,
            nextTier: user.subscriptionTier === 'pro' ? null : nextTier
          }
        });
      }

      const receiptUrl = `/uploads/${req.file.filename}`;
      const fullFilePath = path.join(uploadsDir, req.file.filename);
      
      let extractedItems: any[] = [];
      let extractedStore: any = null;
      let receiptDetails: any = {};
      let storeId: number | undefined = undefined;
      let storeData = null;
      let errorMessage: string | null = null;
      
      // Try to process with OpenAI if API key is configured
      if (process.env.OPENAI_API_KEY) {
        try {
          // Dynamically import OpenAI service
          const { 
            processReceiptImage, 
            extractStoreFromReceipt, 
            extractReceiptDetails, 
            convertToStore 
          } = await import('./services/openai');
          
          // Process the receipt image with OpenAI OCR to extract items
          // Pass the subscription tier to limit items for free tier users
          const userTier = typeof user.subscriptionTier === 'string' ? user.subscriptionTier : 'free';
          extractedItems = await processReceiptImage(fullFilePath, userTier);
          
          // Extract store information from the receipt
          extractedStore = await extractStoreFromReceipt(fullFilePath);
          
          // Extract receipt transaction details
          receiptDetails = await extractReceiptDetails(fullFilePath);
          
          // Check if store already exists
          if (extractedStore.name !== "Unknown Store") {
            const existingStore = await storage.findStoreByNameAndLocation(
              extractedStore.name,
              extractedStore.location,
              req.user.id
            );
            
            if (existingStore) {
              // Use existing store
              storeId = existingStore.id;
              storeData = existingStore;
            } else {
              // Create new store
              const storeToCreate = convertToStore(extractedStore, req.user.id);
              const newStore = await storage.createStore(storeToCreate);
              storeId = newStore.id;
              storeData = newStore;
              
              // Send notification about the new store
              await sendNotification(
                req.user.id,
                'store_created',
                `New store "${newStore.name}" detected from your receipt.`,
                undefined, // No actor ID
                { storeId: newStore.id }
              );
            }
          }
        } catch (ocrError: any) {
          console.error("OCR processing error:", ocrError);
          errorMessage = ocrError.message;
        }
      } else {
        errorMessage = "OCR processing is disabled (no OpenAI API key)";
      }

      // Save receipt to database regardless of OCR success
      try {
        // Create receipt data object with basic properties
        const receiptData: any = {
          userId: req.user.id,
          storeId: storeId,
          filePath: receiptUrl,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadDate: new Date()
        };

        // Only add optional fields if they exist
        if (receiptDetails.date) receiptData.receiptDate = new Date(receiptDetails.date);
        if (receiptDetails.receiptNumber) receiptData.receiptNumber = receiptDetails.receiptNumber;
        if (receiptDetails.totalAmount) receiptData.totalAmount = receiptDetails.totalAmount;
        if (receiptDetails.paymentMethod) receiptData.paymentMethod = receiptDetails.paymentMethod;
        
        // Only include language field if it exists in database (for backward compatibility)
        if (receiptDetails.language) {
          // We'll try to add it, but it's okay if it fails
          try {
            receiptData.language = receiptDetails.language;
          } catch (langError) {
            console.warn("Could not set receipt language - field may not exist in database");
          }
        }
        
        // Add extracted data if OCR was successful
        if (!errorMessage) {
          try {
            receiptData.extractedData = {
              store: extractedStore,
              receiptDetails: receiptDetails
            };
          } catch (e) {
            console.warn("Could not set extractedData field - may not exist in database");
          }
        }
        
        // Log what we're about to create
        console.log('Creating receipt with these fields:', Object.keys(receiptData).join(', '));
        
        // Create the receipt with defensive error handling
        const receipt = await storage.createReceipt(receiptData);
        
        // Increment user's receipt scan count only if they have a limit (i.e., not unlimited)
        if (user.receiptScansLimit !== null && 
            user.receiptScansLimit !== undefined && 
            user.receiptScansLimit >= 0) {
          
          // Update the receipt scans used count in the database
          await db.update(users)
            .set({
              receiptScansUsed: sql`"receipt_scans_used" + 1`,
              updatedAt: sql`CURRENT_TIMESTAMP`
            })
            .where(eq(users.id, user.id));
            
          const scansUsed = user.receiptScansUsed !== null && user.receiptScansUsed !== undefined ? user.receiptScansUsed + 1 : 1;
          console.log(`Incremented receipt scans for user ${user.id} (now: ${scansUsed}/${user.receiptScansLimit})`);
          
          // Send WebSocket notification about usage (using our new function)
          const scansLimit = user.receiptScansLimit || 0;
          await updateReceiptScanUsage(user.id, scansUsed, scansLimit);
        }
        
        // Send notification about the new receipt
        const storeName = storeData ? storeData.name : "Unknown Store";
        await sendNotification(
          req.user.id,
          'receipt_created',
          `Receipt from "${storeName}" uploaded successfully.`,
          undefined, // No actor ID
          { receiptId: receipt.id }
        );
        
        // Return response with receipt ID and extracted data
        res.json({ 
          receiptId: receipt.id,
          receiptUrl,
          message: errorMessage 
            ? `Receipt uploaded successfully but OCR processing failed: ${errorMessage}`
            : "Receipt processed successfully with OpenAI OCR.",
          items: extractedItems,
          store: storeData,
          receiptDetails,
          error: errorMessage
        });
      } catch (receiptError) {
        console.error("Error saving receipt:", receiptError);
        
        // Return a more generic success response without receipt ID
        res.json({ 
          receiptUrl,
          message: "Receipt uploaded but there was an error saving some details. Try again or contact support.",
          items: extractedItems,
          store: storeData,
          receiptDetails,
          error: errorMessage ? errorMessage : "Database error when saving receipt"
        });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Receipt API endpoints
  app.get('/api/receipts', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const receipts = await storage.getReceipts(req.user.id);
      res.json(receipts);
    } catch (error) {
      next(error);
    }
  });
  
  app.get('/api/receipts/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const receiptId = parseInt(req.params.id);
      if (isNaN(receiptId)) {
        return res.status(400).json({ message: "Invalid receipt ID" });
      }
      
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      // Verify ownership
      if (receipt.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(receipt);
    } catch (error) {
      next(error);
    }
  });
  
  // Get food items for a specific receipt
  app.get('/api/receipts/:id/items', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const receiptId = parseInt(req.params.id);
      if (isNaN(receiptId)) {
        return res.status(400).json({ message: "Invalid receipt ID" });
      }
      
      // First check if receipt exists and belongs to user
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      // Verify ownership
      if (receipt.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get food items for this receipt
      const foodItems = await storage.getFoodItemsByReceiptId(receiptId);
      console.log(`Fetched ${foodItems.length} items for receipt ${receiptId}:`, foodItems);
      res.json(foodItems);
    } catch (error) {
      next(error);
    }
  });
  
  app.delete('/api/receipts/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const receiptId = parseInt(req.params.id);
      if (isNaN(receiptId)) {
        return res.status(400).json({ message: "Invalid receipt ID" });
      }
      
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      // Verify ownership
      if (receipt.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Delete the receipt
      await storage.deleteReceipt(receiptId);
      
      res.status(200).json({ message: "Receipt deleted successfully" });
    } catch (error) {
      next(error);
    }
  });
  
  app.get('/api/foodItems', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const receiptId = req.query.receiptId ? parseInt(req.query.receiptId as string) : undefined;
      
      if (receiptId) {
        // First verify receipt ownership
        const receipt = await storage.getReceipt(receiptId);
        if (!receipt || receipt.userId !== req.user.id) {
          return res.status(403).json({ message: "Access denied" });
        }
        
        const items = await storage.getFoodItemsByReceiptId(receiptId);
        return res.json(items);
      }
      
      const locationId = req.query.locationId ? parseInt(req.query.locationId as string) : undefined;
      const items = await storage.getFoodItems(req.user.id, locationId);
      res.json(items);
    } catch (error) {
      next(error);
    }
  });

  // Tags API endpoints
  app.get('/api/tags', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      // Execute a more robust query to safely handle column name differences
      try {
        const query = `
          SELECT 
            id, 
            name, 
            color, 
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'is_system')
              THEN is_system
              ELSE issystem
            END as "isSystem",
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'user_id')
              THEN user_id
              ELSE userid
            END as "userId"
          FROM tags 
          WHERE 
            (
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'user_id') AND user_id = $1
              OR 
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'userid') AND userid = $1
            )
            OR 
            (
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'is_system') AND is_system = true
              OR 
              EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'issystem') AND issystem = true
            )
          ORDER BY name ASC
        `;
        
        console.log(`Fetching tags for user ID: ${req.user.id}`);
        const result = await pool.query(query, [req.user.id]);
        
        // Convert boolean values properly for the frontend
        const processedResults = result.rows.map(row => ({
          ...row,
          isSystem: row.isSystem === 't' || row.isSystem === true // Convert PostgreSQL 't' to boolean true
        }));
        
        console.log(`Found ${processedResults.length} tags, with ${processedResults.filter(t => t.isSystem).length} system tags`);
        
        res.json(processedResults);
      } catch (error) {
        console.error('Error with dynamic column query, trying fallback approach:', error);
        
        // Fallback approach - get all tags and manually filter
        try {
          const simplifiedQuery = `
            SELECT * 
            FROM tags
            ORDER BY name ASC
          `;
          
          const result = await pool.query(simplifiedQuery);
          console.log('Fallback query returned rows:', result.rows.length);
          
          // Process the results to ensure consistent property names
          const processedResults = result.rows.map(row => {
            // Convert camelCase names to the frontend expected format
            return {
              id: row.id,
              name: row.name,
              color: row.color,
              // Handle boolean field using both possible column names
              isSystem: row.is_system === 't' || row.is_system === true || 
                        row.issystem === 't' || row.issystem === true,
              // Handle user ID field using both possible column names  
              userId: row.user_id || row.userid
            };
          });
          
          // Filter for the current user or system tags
          const filteredResults = processedResults.filter(tag => 
            tag.userId === req.user.id || tag.isSystem === true
          );
          
          console.log(`Found ${filteredResults.length} tags, with ${filteredResults.filter(t => t.isSystem).length} system tags`);
          
          res.json(filteredResults);
        } catch (finalError) {
          console.error('All tag retrieval attempts failed:', finalError);
          res.status(500).json({ message: 'Failed to retrieve tags' });
        }
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
      next(error);
    }
  });

  app.post('/api/tags', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const { name, color } = req.body;
      
      if (!name || !color) {
        return res.status(400).json({ message: "Name and color are required" });
      }
      
      // Insert new tag
      const [tag] = await db.insert(tags)
        .values({
          name,
          color,
          isSystem: false,
          userId: req.user.id
        })
        .returning();
      
      res.status(201).json(tag);
    } catch (error) {
      console.error('Error creating tag:', error);
      next(error);
    }
  });

  app.patch('/api/tags/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }
      
      // Check if tag exists and belongs to user
      const [tag] = await db.select()
        .from(tags)
        .where(
          and(
            eq(tags.id, tagId),
            eq(tags.userId, req.user.id)
          )
        );
      
      if (!tag) {
        return res.status(404).json({ message: "Tag not found or you don't have permission to edit it" });
      }
      
      // Don't allow editing system tags
      if (tag.isSystem) {
        return res.status(403).json({ message: "System tags cannot be modified" });
      }
      
      const { name, color } = req.body;
      
      // Update tag
      const [updatedTag] = await db.update(tags)
        .set({
          name: name || tag.name,
          color: color || tag.color
        })
        .where(eq(tags.id, tagId))
        .returning();
      
      res.json(updatedTag);
    } catch (error) {
      console.error('Error updating tag:', error);
      next(error);
    }
  });

  app.delete('/api/tags/:id', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }
      
      // Check if tag exists and belongs to user
      const [tag] = await db.select()
        .from(tags)
        .where(
          and(
            eq(tags.id, tagId),
            eq(tags.userId, req.user.id)
          )
        );
      
      if (!tag) {
        return res.status(404).json({ message: "Tag not found or you don't have permission to delete it" });
      }
      
      // Don't allow deleting system tags
      if (tag.isSystem) {
        return res.status(403).json({ message: "System tags cannot be deleted" });
      }
      
      // First remove any associations in the many-to-many table
      await db.delete(foodItemTags)
        .where(eq(foodItemTags.tagId, tagId));
      
      // Then delete the tag
      await db.delete(tags)
        .where(eq(tags.id, tagId));
      
      res.status(200).json({ message: "Tag deleted successfully" });
    } catch (error) {
      console.error('Error deleting tag:', error);
      next(error);
    }
  });

  // Tag-Item relationship endpoints
  app.get('/api/food-items/:itemId/tags', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid food item ID" });
      }
      
      // Check if item exists and belongs to user
      const item = await storage.getFoodItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Food item not found" });
      }
      
      if (item.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // First, check which junction table exists - food_item_tags or food_items_tags
      const tableCheckResult = await pool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename = 'food_item_tags' OR tablename = 'food_items_tags')
      `);
      
      // If neither table exists, return an empty array
      if (tableCheckResult.rows.length === 0) {
        console.log("No junction table found for food items and tags");
        return res.json([]);
      }
      
      // Determine which table to use
      const junctionTable = tableCheckResult.rows[0].tablename;
      console.log(`Using junction table ${junctionTable} for food item tags query`);
      
      try {
        // Check column names in junction table
        const junctionColumnsResult = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = $1
          ORDER BY column_name
        `, [junctionTable]);
        
        console.log(`Junction table columns:`, junctionColumnsResult.rows.map(r => r.column_name));
        
        // Check if the junction table has fooditemid or food_item_id
        const hasItemIdColumn = junctionColumnsResult.rows.some(r => 
          r.column_name === 'fooditemid' || r.column_name === 'food_item_id'
        );
        
        // Check if the junction table has tagid or tag_id
        const hasTagIdColumn = junctionColumnsResult.rows.some(r => 
          r.column_name === 'tagid' || r.column_name === 'tag_id'
        );
        
        if (!hasItemIdColumn || !hasTagIdColumn) {
          console.log("Junction table is missing required columns");
          return res.json([]);
        }
        
        const query = `
          SELECT 
            t.id, 
            t.name, 
            t.color, 
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'is_system')
              THEN t.is_system
              ELSE t.issystem
            END as "isSystem",
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tags' AND column_name = 'user_id')
              THEN t.user_id
              ELSE t.userid
            END as "userId"
          FROM tags t
          JOIN ${junctionTable} j ON t.id = 
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tag_id')
              THEN j.tag_id
              ELSE j.tagid
            END
          WHERE 
            CASE 
              WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'food_item_id')
              THEN j.food_item_id = $2
              ELSE j.fooditemid = $2
            END
        `;
        
        const result = await pool.query(query, [junctionTable, itemId]);
        
        // Convert boolean values properly for the frontend
        const processedResults = result.rows.map(row => ({
          ...row,
          isSystem: row.isSystem === 't' || row.isSystem === true // Convert PostgreSQL 't' to boolean true
        }));
        
        res.json(processedResults);
      } catch (error) {
        console.error('Error with dynamic column query for food item tags:', error);
        
        // Fallback to getting all tags for the food item using a simpler query
        try {
          // Get all tags first
          const allTags = await pool.query(`SELECT * FROM tags`);
          
          // Get the junction records for this food item from the appropriate table
          const junctionRecords = await pool.query(`
            SELECT * FROM ${junctionTable} 
            WHERE 
              ${junctionTable === 'food_item_tags' ? 'food_item_id' : 'fooditemid'} = $1
          `, [itemId]);
          
          // Map tag IDs from junction records 
          const tagIds = junctionRecords.rows.map(r => r.tagid || r.tag_id);
          
          // Filter tags to only include those in the tagIds array
          const filteredTags = allTags.rows.filter(tag => tagIds.includes(tag.id));
          
          // Process tags for frontend format
          const processedResults = filteredTags.map(row => ({
            id: row.id,
            name: row.name,
            color: row.color,
            isSystem: row.is_system === 't' || row.is_system === true || 
                      row.issystem === 't' || row.issystem === true,
            userId: row.user_id || row.userid
          }));
          
          res.json(processedResults);
        } catch (finalError) {
          console.error('All food item tag retrieval attempts failed:', finalError);
          res.status(500).json({ message: 'Failed to retrieve food item tags' });
        }
      }
    } catch (error) {
      console.error('Error fetching food item tags:', error);
      next(error);
    }
  });

  app.post('/api/food-items/:itemId/tags', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid food item ID" });
      }
      
      // Check if item exists and belongs to user
      const item = await storage.getFoodItem(itemId);
      if (!item) {
        return res.status(404).json({ message: "Food item not found" });
      }
      
      if (item.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { tagIds } = req.body;
      if (!tagIds || !Array.isArray(tagIds)) {
        return res.status(400).json({ message: "tagIds array is required" });
      }
      
      // First, check which junction table exists - food_item_tags or food_items_tags
      const tableCheckResult = await pool.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (tablename = 'food_item_tags' OR tablename = 'food_items_tags')
      `);
      
      // If neither table exists, return an error
      if (tableCheckResult.rows.length === 0) {
        console.log("No junction table found for food items and tags");
        return res.status(500).json({ message: "Tag association table not found in database" });
      }
      
      // Determine which table to use
      const junctionTable = tableCheckResult.rows[0].tablename;
      console.log(`Using junction table ${junctionTable} for updating food item tags`);
      
      // Check column names in junction table
      const junctionColumnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY column_name
      `, [junctionTable]);
      
      console.log(`Junction table columns:`, junctionColumnsResult.rows.map((r: any) => r.column_name));
      
      // Identify the food item ID column and tag ID column
      const foodItemIdColumn = junctionColumnsResult.rows.some((r: any) => r.column_name === 'food_item_id') 
        ? 'food_item_id' 
        : 'fooditemid';
        
      const tagIdColumn = junctionColumnsResult.rows.some((r: any) => r.column_name === 'tag_id') 
        ? 'tag_id' 
        : 'tagid';
      
      // Remove existing tags
      await pool.query(`DELETE FROM ${junctionTable} WHERE ${foodItemIdColumn} = $1`, [itemId]);
      
      // Add new tags - if there are any to add
      if (tagIds.length > 0) {
        // Prepare the insert values
        const insertValues = tagIds.map((tagId: number) => `(${itemId}, ${tagId})`).join(', ');
        
        // Execute the direct SQL insert
        await pool.query(`
          INSERT INTO ${junctionTable} (${foodItemIdColumn}, ${tagIdColumn})
          VALUES ${insertValues}
        `);
      }
      
      res.status(200).json({ message: "Tags updated successfully" });
    } catch (error) {
      console.error('Error updating food item tags:', error);
      next(error);
    }
  });

  // Billing API endpoints
  app.get('/api/billing/subscription', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      const user = req.user;

      if (!user.stripeCustomerId || !user.stripeSubscriptionId) {
        return res.json({ 
          subscription: null,
          tier: 'free'
        });
      }

      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['default_payment_method', 'items.data.price.product']
        });

        const subscriptionData = {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          tier: user.subscriptionTier,
          paymentMethod: subscription.default_payment_method,
          items: subscription.items.data.map(item => ({
            id: item.id,
            price: {
              id: item.price.id,
              unitAmount: item.price.unit_amount,
              currency: item.price.currency,
              interval: item.price.recurring?.interval,
              product: {
                name: (item.price.product as any).name,
                description: (item.price.product as any).description
              }
            }
          }))
        };

        res.json({ subscription: subscriptionData });
      } catch (err) {
        console.error('Error retrieving subscription:', err);
        return res.json({ 
          subscription: null,
          tier: user.subscriptionTier || 'free',
          error: 'Could not retrieve subscription details'
        });
      }
    } catch (error: any) {
      console.error('Subscription retrieval error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/billing/invoices', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      const user = req.user;

      if (!user.stripeCustomerId) {
        return res.json({ invoices: [] });
      }

      const invoices = await stripe.invoices.list({
        customer: user.stripeCustomerId,
        limit: 10,
        expand: ['data.subscription']
      });

      const formattedInvoices = invoices.data.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: invoice.status,
        created: new Date(invoice.created * 1000),
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
        pdfUrl: invoice.invoice_pdf,
        hostedUrl: invoice.hosted_invoice_url,
        subscriptionId: invoice.subscription
      }));

      res.json({ invoices: formattedInvoices });
    } catch (error: any) {
      console.error('Invoices retrieval error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.get('/api/billing/payment-methods', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      const user = req.user;

      if (!user.stripeCustomerId) {
        return res.json({ paymentMethods: [] });
      }

      const paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card'
      });

      const formattedPaymentMethods = paymentMethods.data.map(method => ({
        id: method.id,
        type: method.type,
        billingDetails: method.billing_details,
        card: method.card ? {
          brand: method.card.brand,
          last4: method.card.last4,
          expMonth: method.card.exp_month,
          expYear: method.card.exp_year
        } : null
      }));

      res.json({ paymentMethods: formattedPaymentMethods });
    } catch (error: any) {
      console.error('Payment methods retrieval error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/billing/cancel-subscription', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      const user = req.user;

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: 'No active subscription found' });
      }

      // Cancel at period end instead of immediately
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      // Send notification about cancellation
      await sendNotification(
        user.id,
        'subscription_update',
        'Your subscription has been scheduled to cancel at the end of the billing period.',
        undefined,
        { 
          action: 'cancel_scheduled',
          periodEnd: new Date(subscription.current_period_end * 1000)
        }
      );

      res.json({ 
        success: true, 
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      });
    } catch (error: any) {
      console.error('Subscription cancellation error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/billing/resume-subscription', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      const user = req.user;

      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: 'No active subscription found' });
      }

      // Resume subscription by setting cancel_at_period_end to false
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: false
      });

      // Send notification about resumed subscription
      await sendNotification(
        user.id,
        'subscription_update',
        'Your subscription has been resumed and will renew automatically.',
        undefined,
        { action: 'resume' }
      );

      res.json({ 
        success: true, 
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      });
    } catch (error: any) {
      console.error('Subscription resume error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.post('/api/billing/update-payment-method', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      const { paymentMethodId } = req.body;
      if (!paymentMethodId) {
        return res.status(400).json({ message: 'Payment method ID is required' });
      }

      const user = req.user;

      if (!user.stripeCustomerId) {
        return res.status(400).json({ message: 'No customer profile found' });
      }

      // Attach the payment method to the customer
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: user.stripeCustomerId,
      });

      // Set as default payment method
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });

      // If there's an active subscription, update that too
      if (user.stripeSubscriptionId) {
        await stripe.subscriptions.update(user.stripeSubscriptionId, {
          default_payment_method: paymentMethodId,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Payment method update error:', error);
      res.status(400).json({ message: error.message });
    }
  });
  
  // Reset user's Stripe subscription data (for recovery from issues)
  app.post('/api/billing/reset-subscription', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }
      
      // Get the user
      const user = req.user;
      
      // Reset Stripe-related fields in the user record
      const updatedUser = await storage.updateUserSubscription(user.id, {
        stripeSubscriptionId: undefined, // Use undefined instead of null
        subscriptionStatus: 'inactive',
        subscriptionTier: 'free',
        currentBillingPeriodStart: null,
        currentBillingPeriodEnd: null
      });
      
      // Also clear the customer ID if requested
      if (req.body.resetCustomerId) {
        await storage.updateStripeCustomerId(user.id, ''); // Use empty string instead of null
      }
      
      // Log the action
      console.log(`Reset Stripe subscription data for user ${user.id}`);
      
      // Send notification about the reset
      await sendNotification(
        user.id,
        'subscription_updated',
        'Your subscription data has been reset. You can now resubscribe.',
        undefined,
        { status: 'reset' }
      );
      
      res.json({ 
        success: true, 
        message: 'Stripe subscription data reset successfully',
        user: updatedUser 
      });
    } catch (error: any) {
      console.error('Error resetting Stripe subscription data:', error);
      res.status(500).json({ 
        message: 'Failed to reset subscription data', 
        error: error.message 
      });
    }
  });

  // Register billing routes
  registerBillingRoutes(app, sendNotification);
  registerAdminRoutes(app);

  // Create HTTP server for the express app
  const httpServer = createServer(app);
  
  // WebSocket server is now fully implemented in websockets/index.ts
  // Instead of creating and managing WebSockets here, all the functionality has been 
  // modularized and moved to specialized handlers in the websockets directory.
  // The implementation in websockets/index.ts contains improved error handling,
  // connection tracking, and support for multiple device connections per user.

  app.locals.sendNotification = sendNotification;

  return httpServer;
}

export type SendNotificationFn = (userId: number, type: string, message: string, actorId?: number, metadata?: any) => Promise<any>;