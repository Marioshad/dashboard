import { pgTable, text, serial, integer, boolean, timestamp, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// A list of supported currencies
export const SUPPORTED_CURRENCIES = [
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  { code: "AUD", symbol: "$", name: "Australian Dollar" },
  { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  { code: "MXN", symbol: "$", name: "Mexican Peso" },
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

// Add new table for global settings
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  require2FA: boolean("require_2fa").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // e.g., 'follow', 'mention', etc.
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  actorId: integer("actor_id").references(() => users.id), // User who triggered the notification
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  roleId: integer("role_id"),
  currency: text("currency").default("USD"), // Default currency is USD
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  emailNotifications: boolean("email_notifications").default(true),
  webNotifications: boolean("web_notifications").default(true),
  mentionNotifications: boolean("mention_notifications").default(true),
  followNotifications: boolean("follow_notifications").default(true),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("inactive"),
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

// Food Vault Models
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'home', 'office', etc.
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(), // g, kg, pieces, etc.
  locationId: integer("location_id").notNull().references(() => locations.id),
  expiryDate: date("expiry_date").notNull(),
  price: integer("price"), // in cents
  purchased: timestamp("purchased").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, {
    fields: [users.roleId],
    references: [roles.id],
  }),
  notifications: many(notifications),
  actedNotifications: many(notifications, { relationName: "actor" }),
  locations: many(locations),
  foodItems: many(foodItems),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  users: many(users),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const appSettingsRelations = relations(appSettings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [appSettings.updatedBy],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: "actor",
  }),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  user: one(users, {
    fields: [locations.userId],
    references: [users.id],
  }),
  foodItems: many(foodItems),
}));

export const foodItemsRelations = relations(foodItems, ({ one }) => ({
  location: one(locations, {
    fields: [foodItems.locationId],
    references: [locations.id],
  }),
  user: one(users, {
    fields: [foodItems.userId],
    references: [users.id],
  }),
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

// Update the profile schema to include notification settings and currency
export const updateProfileSchema = createInsertSchema(users).pick({
  fullName: true,
  email: true,
  bio: true,
  avatarUrl: true,
  currency: true,
  emailNotifications: true,
  webNotifications: true,
  mentionNotifications: true,
  followNotifications: true,
}).extend({
  email: z.string().email("Invalid email format"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  avatarUrl: z.string().url("Invalid URL format").optional(),
  currency: z.enum([...SUPPORTED_CURRENCIES.map(c => c.code)] as [string, ...string[]]).optional(),
  emailNotifications: z.boolean().optional(),
  webNotifications: z.boolean().optional(),
  mentionNotifications: z.boolean().optional(),
  followNotifications: z.boolean().optional(),
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

// Food schemas
export const insertLocationSchema = createInsertSchema(locations).pick({
  name: true,
  type: true,
}).extend({
  name: z.string().min(2, "Location name must be at least 2 characters"),
  type: z.string().min(2, "Location type must be at least 2 characters"),
});

export const updateLocationSchema = insertLocationSchema;

export const insertFoodItemSchema = createInsertSchema(foodItems).pick({
  name: true,
  quantity: true,
  unit: true,
  locationId: true,
  expiryDate: true,
  price: true,
}).extend({
  name: z.string().min(2, "Food name must be at least 2 characters"),
  quantity: z.number().positive("Quantity must be a positive number"),
  unit: z.string().min(1, "Unit is required"),
  locationId: z.number().min(1, "Location is required"),
  expiryDate: z.date().or(z.string()),
  price: z.number().optional(),
});

export const updateFoodItemSchema = insertFoodItemSchema;

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type UpdatePermission = z.infer<typeof updatePermissionSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type UpdateLocation = z.infer<typeof updateLocationSchema>;
export type InsertFoodItem = z.infer<typeof insertFoodItemSchema>;
export type UpdateFoodItem = z.infer<typeof updateFoodItemSchema>;
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type FoodItem = typeof foodItems.$inferSelect;