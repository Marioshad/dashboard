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
import { roles, permissions, rolePermissions } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

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

  // Add these routes inside the registerRoutes function, before return httpServer
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

  const httpServer = createServer(app);
  return httpServer;
}