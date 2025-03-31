import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { updateProfileSchema } from "@shared/schema";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import express from 'express';
import { db } from "./db";
import { format } from "date-fns";
import { 
  roles, permissions, rolePermissions, users, appSettings, notifications,
  locations, foodItems, stores, tags, foodItemTags, insertLocationSchema, updateLocationSchema,
  insertFoodItemSchema, updateFoodItemSchema, insertStoreSchema, updateStoreSchema
} from "@shared/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import Stripe from "stripe";
import { WebSocketServer, WebSocket as WsWebSocket } from 'ws';

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

// Store WebSocket clients
const clients = new Map<number, WsWebSocket>();

async function sendNotification(userId: number, type: string, message: string, actorId?: number, metadata?: any) {
  try {
    // Create a notification object with the metadata included in the message
    const notificationData = {
      userId,
      type,
      message,
      actorId
    };
    
    // If metadata is provided, convert it to JSON string and attach to message
    if (metadata) {
      notificationData.message = `${message}|${JSON.stringify(metadata)}`;
    }
    
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();

    const ws = clients.get(userId);
    // WsWebSocket.OPEN is 1 (same constant as browser WebSocket.OPEN)
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'notification',
        data: notification
      }));
    }

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

      await db
        .update(notifications)
        .set({ read: true })
        .where(
          and(
            eq(notifications.userId, req.user.id),
            eq(notifications.read, false)
          )
        );

      res.sendStatus(200);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/subscription/prices', async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ 
          message: 'Payment service unavailable. Please contact administrator.',
          stripeDisabled: true
        });
      }

      if (!process.env.STRIPE_PRICE_ID) {
        return res.status(503).json({ 
          message: 'Payment service misconfigured. Missing price configuration.',
          stripeDisabled: true 
        });
      }

      const prices = await stripe!.prices.list({
        product: process.env.STRIPE_PRICE_ID,
        active: true,
        expand: ['data.product'],
      });

      res.json(prices.data);
    } catch (error: any) {
      console.error('Error fetching prices:', error);
      res.status(400).json({ message: error.message });
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
    
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('Missing Stripe webhook secret');
      return res.status(500).json({ message: 'Payment webhook misconfigured' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe!.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error('Webhook error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        await db.update(users)
          .set({
            subscriptionStatus: subscription.status,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(users.stripeSubscriptionId, subscription.id));

        if (subscription.status === 'active') {
          const premiumRole = await db.query.roles.findFirst({
            where: eq(roles.name, 'Premium'),
          });

          if (premiumRole) {
            const [user] = await db.select()
              .from(users)
              .where(eq(users.stripeSubscriptionId, subscription.id));

            if (user) {
              await db.update(users)
                .set({
                  roleId: premiumRole.id,
                  updatedAt: sql`CURRENT_TIMESTAMP`,
                })
                .where(eq(users.id, user.id));
            }
          }
        }
        break;
      }
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

  app.post('/api/receipts/upload', upload.single('receipt'), async (req: MulterRequest, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
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
          extractedItems = await processReceiptImage(fullFilePath);
          
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
          receiptData.extractedData = {
            store: extractedStore,
            receiptDetails: receiptDetails
          };
        }
        
        // Create the receipt
        const receipt = await storage.createReceipt(receiptData);
        
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
      
      // Check which column name is used in the database (is_system or issystem)
      const columnCheckResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tags' 
        AND (column_name = 'is_system' OR column_name = 'issystem')
      `);
      
      // If neither column exists, return an empty array
      if (columnCheckResult.rows.length === 0) {
        console.log("Tags table is missing the system column");
        return res.json([]);
      }
      
      // Determine which column name to use
      const systemColumnName = columnCheckResult.rows[0].column_name;
      console.log(`Using ${systemColumnName} as the system tag column for query`);
      
      // Use the appropriate column name in the query
      let result;
      if (systemColumnName === 'is_system') {
        result = await db.execute(sql`
          SELECT id, name, color, is_system as "isSystem", userid as "userId"
          FROM tags 
          WHERE userid = ${req.user.id} OR is_system = true
          ORDER BY name ASC
        `);
      } else {
        result = await db.execute(sql`
          SELECT id, name, color, issystem as "isSystem", userid as "userId"
          FROM tags 
          WHERE userid = ${req.user.id} OR issystem = true
          ORDER BY name ASC
        `);
      }
      
      res.json(result.rows);
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
      
      // Check which column name is used in the database
      const columnCheckResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'tags' 
        AND (column_name = 'is_system' OR column_name = 'issystem')
      `);
      
      // If neither column exists, return an empty array
      if (columnCheckResult.rows.length === 0) {
        console.log("Tags table is missing the system column");
        return res.json([]);
      }
      
      // Determine which column name to use
      const systemColumnName = columnCheckResult.rows[0].column_name;
      
      // Use appropriate column in query
      let result;
      if (systemColumnName === 'is_system') {
        result = await db.execute(sql`
          SELECT t.id, t.name, t.color, t.is_system as "isSystem", t.userid as "userId"
          FROM tags t
          JOIN food_item_tags fit ON t.id = fit.tag_id
          WHERE fit.food_item_id = ${itemId}
        `);
      } else {
        result = await db.execute(sql`
          SELECT t.id, t.name, t.color, t.issystem as "isSystem", t.userid as "userId"
          FROM tags t
          JOIN food_item_tags fit ON t.id = fit.tag_id
          WHERE fit.food_item_id = ${itemId}
        `);
      }
      
      res.json(result.rows);
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
      
      // Remove existing tags
      await db.delete(foodItemTags)
        .where(eq(foodItemTags.foodItemId, itemId));
      
      // Add new tags
      if (tagIds.length > 0) {
        await db.insert(foodItemTags)
          .values(
            tagIds.map(tagId => ({
              foodItemId: itemId,
              tagId: tagId
            }))
          );
      }
      
      res.status(200).json({ message: "Tags updated successfully" });
    } catch (error) {
      console.error('Error updating food item tags:', error);
      next(error);
    }
  });

  const httpServer = createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/ws'
  });

  wss.on('connection', (ws: WsWebSocket, request) => {
    const userId = (request as any).userId;
    console.log('WebSocket connected for user:', userId);

    clients.set(userId, ws);

    ws.on('close', () => {
      console.log('WebSocket closed for user:', userId);
      clients.delete(userId);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error for user:', userId, error);
      clients.delete(userId);
    });

    ws.send(JSON.stringify({ type: 'connected' }));
  });

  wss.on('upgrade', (request, socket, head) => {
    if (request.url?.startsWith('/api/ws')) {
      const sessionParser = app._router.stack
        .find((layer: any) => layer.name === 'session')?.handle;

      if (!sessionParser) {
        console.error('Session middleware not found');
        socket.destroy();
        return;
      }

      // Parse session before WebSocket upgrade
      sessionParser(request, {} as any, async () => {
        const session = (request as any).session;
        console.log('WebSocket upgrade request session:', session);

        if (!session?.passport?.user) {
          console.error('WebSocket: User not authenticated');
          socket.destroy();
          return;
        }

        try {
          (request as any).userId = session.passport.user;
          console.log('WebSocket upgrade authenticated for user:', session.passport.user);

          wss.handleUpgrade(request, socket, head, (ws: WsWebSocket) => {
            wss.emit('connection', ws, request);
          });
        } catch (error) {
          console.error('Error during WebSocket upgrade:', error);
          socket.destroy();
        }
      });
    }
  });

  app.locals.sendNotification = sendNotification;

  return httpServer;
}

export type SendNotificationFn = (userId: number, type: string, message: string, actorId?: number, metadata?: any) => Promise<any>;