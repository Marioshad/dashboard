import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { updateProfileSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from 'express';
import { db } from "./db";
import { roles, permissions, rolePermissions, users, appSettings, notifications } from "@shared/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { WebSocketServer, WebSocket } from 'ws';
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
});

// Helper function to send notification
async function sendNotification(clients: Map<number, WebSocket>, userId: number, type: string, message: string, actorId?: number) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        type,
        message,
        actorId
      })
      .returning();

    const ws = clients.get(userId);
    if (ws?.readyState === WebSocket.OPEN) {
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

  // Avatar upload endpoint
  app.post('/api/profile/avatar', upload.single('avatar'), async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const avatarUrl = `/uploads/${req.file.filename}`;
      const updatedUser = await storage.updateProfile(req.user.id, { avatarUrl });
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });

  // Serve uploaded files
  app.use('/uploads', express.static(uploadsDir));

  // Profile update endpoint
  app.patch('/api/profile', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const result = updateProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid profile data" });
      }

      const updatedUser = await storage.updateProfile(req.user.id, result.data);
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  });

  // Roles endpoints
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

      // Transform the response to match the expected format
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

      // Start a transaction
      const [role] = await db.insert(roles)
        .values(roleData)
        .returning();

      // Add permissions
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

      // Update role
      const [role] = await db.update(roles)
        .set({ ...roleData, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(roles.id, parseInt(req.params.id)))
        .returning();

      // Update permissions
      if (permissionIds) {
        // Remove existing permissions
        await db.delete(rolePermissions)
          .where(eq(rolePermissions.roleId, role.id));

        // Add new permissions
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

      // Soft delete
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

  // Permissions endpoints
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

      // Soft delete
      await db.update(permissions)
        .set({ deletedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(permissions.id, parseInt(req.params.id)));

      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Add this route inside registerRoutes function
  app.get('/api/users', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      // Check if user is admin or superadmin
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

  // Admin Settings endpoints
  app.get('/api/settings/admin', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      // Check if user is admin or superadmin
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

      // Check if user is admin or superadmin
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

  // User 2FA endpoints
  app.post('/api/user/2fa', async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const [settings] = await db.select().from(appSettings).limit(1);
      const userRole = await db.query.roles.findFirst({
        where: eq(roles.id, req.user.roleId as number),
      });

      // Only allow enabling 2FA if it's required by admin or user is admin/superadmin
      if (!req.body.enabled && settings?.require2FA && !['Superadmin', 'Admin'].includes(userRole?.name)) {
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

  // Notifications endpoints
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


  // Stripe subscription endpoint
  app.post('/api/get-or-create-subscription', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      let user = req.user;

      // If user already has a subscription, return it
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

        res.send({
          subscriptionId: subscription.id,
          clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
        });
        return;
      }

      if (!user.email) {
        return res.status(400).json({ message: 'Email is required for subscription' });
      }

      // Create a new customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
      });

      // Create a subscription
      const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{
          price: process.env.STRIPE_PRICE_ID,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user with Stripe info
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
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
      });
    } catch (error: any) {
      console.error('Subscription error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Stripe webhook endpoint
  app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );
    } catch (err: any) {
      console.error('Webhook error:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle subscription events
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        // Update user subscription status
        await db.update(users)
          .set({
            subscriptionStatus: subscription.status,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(users.stripeSubscriptionId, subscription.id));

        // If subscription is active, assign Premium role
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

  // WebSocket setup
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map<number, WebSocket>();

  const httpServer = createServer(app);

  // Handle WebSocket upgrade
  httpServer.on('upgrade', (request, socket, head) => {
    if (!request.url?.startsWith('/ws-notifications')) {
      socket.destroy();
      return;
    }

    // Add session handling to WebSocket upgrade
    const expressRequest = request as any;
    app(expressRequest, {} as any, async () => {
      if (!expressRequest.user?.id) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        const userId = expressRequest.user.id;
        clients.set(userId, ws);

        ws.on('close', () => {
          clients.delete(userId);
        });

        wss.emit('connection', ws, request);
      });
    });
  });

  // Expose the sendNotification function through the app locals
  app.locals.sendNotification = (userId: number, type: string, message: string, actorId?: number) =>
    sendNotification(clients, userId, type, message, actorId);

  return httpServer;
}

export type SendNotificationFn = (userId: number, type: string, message: string, actorId?: number) => Promise<any>;