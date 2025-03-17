import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  roleId: integer("role_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at")
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at")
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at")
});

export const rolePermissions = pgTable("role_permissions", {
  roleId: integer("role_id").notNull().references(() => roles.id),
  permissionId: integer("permission_id").notNull().references(() => permissions.id)
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  permissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
}).extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email format"),
  fullName: z.string().min(2, "Full name must be at least 2 characters")
});

export const updateProfileSchema = createInsertSchema(users).pick({
  fullName: true,
  email: true,
  bio: true,
  avatarUrl: true,
}).extend({
  email: z.string().email("Invalid email format"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  avatarUrl: z.string().url("Invalid URL format").optional(),
});

// Role and Permission schemas
export const insertRoleSchema = createInsertSchema(roles).pick({
  name: true,
  description: true,
}).extend({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  permissions: z.array(z.number()).min(1, "Role must have at least one permission"),
});

export const updateRoleSchema = insertRoleSchema;

export const insertPermissionSchema = createInsertSchema(permissions).pick({
  name: true,
  description: true,
}).extend({
  name: z.string().min(2, "Permission name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

export const updatePermissionSchema = insertPermissionSchema;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type UpdatePermission = z.infer<typeof updatePermissionSchema>;
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;