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
import { roles, permissions, rolePermissions, users, appSettings, notifications } from "@shared/schema";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import Stripe from "stripe";
import { WebSocketServer } from 'ws';
import { sendVerificationEmail } from './services/email';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

interface MulterRequest extends Request {
  file: Express.Multer.File;
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
const clients = new Map<number, WebSocket>();

async function sendNotification(userId: number, type: string, message: string, actorId?: number) {
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

  app.post('/api/profile/avatar', upload.single('avatar'), async (req: MulterRequest, res, next) => {
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

  app.use('/uploads', express.static(uploadsDir));

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
      const prices = await stripe.prices.list({
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

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ message: 'Price ID is required' });
      }

      let user = req.user;

      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
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

      const customer = await stripe.customers.create({
        email: user.email,
        name: user.username,
      });

      const subscription = await stripe.subscriptions.create({
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

  app.get('/api/verify-email', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Invalid verification token' });
      }

      const [user] = await db.select()
        .from(users)
        .where(
          and(
            eq(users.verificationToken, token),
            isNull(users.deletedAt)
          )
        )
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: 'Invalid or expired verification token' });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: 'Email already verified' });
      }

      const now = new Date();
      if (user.verificationTokenExpiry && user.verificationTokenExpiry < now) {
        return res.status(400).json({ message: 'Verification token has expired' });
      }

      // Update user as verified
      await db.update(users)
        .set({
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));

      // Send welcome notification
      await sendNotification(user.id, 'welcome', 'Welcome! Your email has been verified.');

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Error verifying email:', error);
      res.status(500).json({ message: 'Error verifying email' });
    }
  });

  // Add verification status check endpoint
  app.get('/api/verification-status', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const [user] = await db.select({
        emailVerified: users.emailVerified,
        verificationTokenExpiry: users.verificationTokenExpiry,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const response = {
        verified: user.emailVerified,
        pending: !user.emailVerified && user.verificationTokenExpiry > new Date(),
        email: user.email,
      };

      res.json(response);
    } catch (error) {
      console.error('Error checking verification status:', error);
      res.status(500).json({ message: 'Error checking verification status' });
    }
  });

  // Add resend verification email endpoint
  app.post('/api/resend-verification', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.sendStatus(401);
      }

      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, req.user.id))
        .limit(1);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: 'Email already verified' });
      }

      await sendVerificationEmail(user.id, user.email, user.username);
      res.json({ message: 'Verification email sent successfully' });
    } catch (error) {
      console.error('Error resending verification email:', error);
      res.status(500).json({ message: 'Error sending verification email' });
    }
  });

  // Middleware to check email verification
  function requireEmailVerification(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({
        message: 'Email verification required',
        verificationPending: true
      });
    }

    next();
  }

  // Add verification check to protected routes
  app.use('/api/protected/*', requireEmailVerification);

  const httpServer = createServer(app);

  const wss = new WebSocketServer({
    server: httpServer,
    path: '/api/ws'  // Changed from '/ws' to '/api/ws'
  });

  wss.on('connection', (ws, request) => {
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

          wss.handleUpgrade(request, socket, head, (ws) => {
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

export type SendNotificationFn = (userId: number, type: string, message: string, actorId?: number) => Promise<any>;