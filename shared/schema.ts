import { pgTable, text, serial, integer, boolean, timestamp, date, decimal, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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

// Subscription tier definitions
export const SUBSCRIPTION_TIERS = [
  { 
    id: "free", 
    name: "Basic Pantry",
    price: { monthly: 0, yearly: 0 },
    icon: "⬆️",
    maxItems: 50,
    receiptScansPerMonth: 3,
    maxSharedUsers: 1,
    description: "Free plan for casual users and small households",
    features: [
      "Track up to 50 items",
      "Receipt scanning up to 3 times per month",
      "Expiration reminders (email or in-app)",
      "Manual grocery input",
      "Simple shopping list",
      "Basic analytics: estimated savings / waste",
      "1 shared user/device",
      "Limited categories"
    ]
  },
  {
    id: "smart",
    name: "Smart Pantry",
    price: { monthly: 4.99, yearly: 49 },
    icon: "💡",
    maxItems: -1, // unlimited
    receiptScansPerMonth: 20,
    maxSharedUsers: 3,
    description: "For organized households looking to save money",
    features: [
      "Unlimited items",
      "Receipt scanning up to 20 times per month",
      "Smart reminders (customizable thresholds)",
      "Auto-sorting food categories",
      "AI-powered suggestions: 'Use These Soon' recipes",
      "Smart shopping list based on inventory + history",
      "Household sharing (up to 3 users)",
      "Export pantry data (PDF/CSV)",
      "Gamification: track waste reduction over time"
    ]
  },
  {
    id: "pro", 
    name: "Family Pantry Pro",
    price: { monthly: 9.99, yearly: 99 },
    icon: "🧑‍🍳",
    maxItems: -1, // unlimited
    receiptScansPerMonth: -1, // unlimited
    maxSharedUsers: 6,
    description: "For families, meal planners, and power users",
    features: [
      "Everything in Smart Pantry",
      "Share with up to 6 users/devices",
      "Meal planning calendar",
      "Barcode scanner or voice entry",
      "Pantry sync & cloud backup",
      "Pantry zones (fridge, freezer, garage, etc.)",
      "Advanced analytics (food waste %, savings by category)",
      "Priority email/chat support"
    ]
  }
] as const;

export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number]['code'];

// Add new table for global settings
export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  require2FA: boolean("require_2fa").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
  // Stripe settings
  stripeSmartProductId: text("stripe_smart_product_id"),
  stripeProProductId: text("stripe_pro_product_id"),
  stripeSmartMonthlyPriceId: text("stripe_smart_monthly_price_id"),
  stripeSmartYearlyPriceId: text("stripe_smart_yearly_price_id"),
  stripeProMonthlyPriceId: text("stripe_pro_monthly_price_id"),
  stripeProYearlyPriceId: text("stripe_pro_yearly_price_id"),
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
  subscriptionTier: text("subscription_tier").default("free"), // free, smart, pro tiers
  receiptScansUsed: integer("receipt_scans_used").default(0), // Used in current billing period
  receiptScansLimit: integer("receipt_scans_limit").default(3), // Based on subscription tier
  maxItems: integer("max_items").default(50), // Based on subscription tier (50, -1=unlimited, -1=unlimited)
  maxSharedUsers: integer("max_shared_users").default(1), // Based on subscription tier (1, 3, 6)
  currentBillingPeriodStart: timestamp("current_billing_period_start"), // For tracking receipt scan resets
  currentBillingPeriodEnd: timestamp("current_billing_period_end"), // For tracking receipt scan resets
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

// Stores table for tracking where food was purchased from
export const stores = pgTable("stores", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  phone: text("phone"),
  fax: text("fax"),
  vatNumber: text("vat_number"),
  taxId: text("tax_id"),
  // Temporarily commenting out parser columns until migration is fixed
  // parserType: text("parser_type"), // For store-specific parsing rules (LIDL, ALPHAMEGA, etc.)
  // parserConfig: jsonb("parser_config"), // JSON configuration for the parser
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Create a unique index on store name and location for a specific user
    // This will help identify duplicate stores during receipt scanning
    storeNameLocationUserIdx: uniqueIndex("store_name_location_user_idx").on(
      table.name, 
      table.location, 
      table.userId
    ),
  }
});

// Receipts table for storing uploaded receipts
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  storeId: integer("storeId").references(() => stores.id),
  filePath: text("filePath").notNull(),
  fileName: text("fileName").notNull(),
  fileSize: integer("fileSize").notNull(),
  mimeType: text("mimeType").notNull(),
  uploadDate: timestamp("uploadDate").defaultNow().notNull(),
  extractedData: jsonb("extractedData"),
  totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }),
  receiptDate: timestamp("receiptDate"),
  receiptNumber: text("receiptNumber"),
  language: text("language"), // Receipt language detected
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Tags table for categorizing food items
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").default("#3B82F6"),
  isSystem: boolean("is_system").default(false),
  userId: integer("user_id").references(() => users.id), // null for system tags
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Food item to tags many-to-many join table
export const foodItemTags = pgTable("food_item_tags", {
  foodItemId: integer("food_item_id").notNull().references(() => foodItems.id, { onDelete: 'cascade' }),
  tagId: integer("tag_id").notNull().references(() => tags.id),
}, (table) => {
  return {
    pk: uniqueIndex("food_item_tag_pk").on(table.foodItemId, table.tagId),
  }
});

// Subscription tiers table for storing tier definitions
export const subscriptionTiers = pgTable("subscription_tiers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull(), // free, smart, pro
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }).notNull(),
  maxItems: integer("max_items").notNull(),
  receiptScansPerMonth: integer("receipt_scans_per_month").notNull(),
  maxSharedUsers: integer("max_shared_users").notNull(),
  description: text("description").notNull(),
  features: jsonb("features").notNull(), // Storing features as JSON
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdYearly: text("stripe_price_id_yearly"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for shared pantry users (premium feature)
export const sharedPantryUsers = pgTable("shared_pantry_users", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  sharedWithId: integer("shared_with_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    ownerSharedIdx: uniqueIndex("owner_shared_idx").on(table.ownerId, table.sharedWithId),
  }
});

export const foodItems = pgTable("food_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name"), // Normalized name for item grouping
  originalName: text("original_name"), // Original name from receipt
  category: text("category"), // Category identified during normalization
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit").notNull(), // g, kg, pieces, etc.
  locationId: integer("location_id").notNull().references(() => locations.id),
  storeId: integer("store_id").references(() => stores.id), // Where the item was purchased
  receiptId: integer("receiptId").references(() => receipts.id), // Add relation to receipts
  expiryDate: date("expiry_date").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }), // direct price value
  pricePerUnit: decimal("price_per_unit", { precision: 10, scale: 2 }), // direct price per unit
  isWeightBased: boolean("is_weight_based").default(false), // Flag to identify weight-based items vs. piece-based
  normalizationConfidence: decimal("normalization_confidence", { precision: 5, scale: 4 }), // Confidence score for normalization
  lineNumbers: integer("line_numbers").array(), // Line numbers from the receipt
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
  stores: many(stores),
  receipts: many(receipts),
  sharedPantries: many(sharedPantryUsers, { relationName: "owner" }),
  sharedWithPantries: many(sharedPantryUsers, { relationName: "sharedWith" }),
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

export const storesRelations = relations(stores, ({ one, many }) => ({
  user: one(users, {
    fields: [stores.userId],
    references: [users.id],
  }),
  foodItems: many(foodItems),
  receipts: many(receipts),
}));

export const receiptsRelations = relations(receipts, ({ one, many }) => ({
  user: one(users, {
    fields: [receipts.userId],
    references: [users.id],
  }),
  store: one(stores, {
    fields: [receipts.storeId],
    references: [stores.id],
  }),
  foodItems: many(foodItems),
}));

export const foodItemsRelations = relations(foodItems, ({ one, many }) => ({
  location: one(locations, {
    fields: [foodItems.locationId],
    references: [locations.id],
  }),
  store: one(stores, {
    fields: [foodItems.storeId],
    references: [stores.id],
  }),
  receipt: one(receipts, {
    fields: [foodItems.receiptId],
    references: [receipts.id],
  }),
  user: one(users, {
    fields: [foodItems.userId],
    references: [users.id],
  }),
  tags: many(foodItemTags, { relationName: "foodItemToTags" }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  foodItems: many(foodItemTags, { relationName: "tagToFoodItems" }),
  products: many(products),
}));

export const foodItemTagsRelations = relations(foodItemTags, ({ one }) => ({
  foodItem: one(foodItems, {
    fields: [foodItemTags.foodItemId],
    references: [foodItems.id],
    relationName: "foodItemToTags",
  }),
  tag: one(tags, {
    fields: [foodItemTags.tagId],
    references: [tags.id],
    relationName: "tagToFoodItems",
  }),
}));

// Subscription tier relations
export const subscriptionTiersRelations = relations(subscriptionTiers, ({ many }) => ({
  users: many(users),
}));

// Shared pantry user relations
export const sharedPantryUsersRelations = relations(sharedPantryUsers, ({ one }) => ({
  owner: one(users, {
    fields: [sharedPantryUsers.ownerId],
    references: [users.id],
    relationName: "owner",
  }),
  sharedWith: one(users, {
    fields: [sharedPantryUsers.sharedWithId],
    references: [users.id],
    relationName: "sharedWith",
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

// Store schemas
export const insertStoreSchema = createInsertSchema(stores).pick({
  name: true,
  location: true,
  phone: true,
  fax: true,
  vatNumber: true,
  taxId: true,
}).extend({
  name: z.string()
    .min(1, "Store name is required")
    .min(2, "Store name must be at least 2 characters")
    .max(100, "Store name cannot exceed 100 characters"),
  location: z.string()
    .min(1, "Store location is required")
    .min(2, "Store location must be at least 2 characters")
    .max(200, "Location cannot exceed 200 characters"),
  phone: z.string()
    .max(30, "Phone number cannot exceed 30 characters")
    .regex(/^[0-9+\-\s()]*$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  fax: z.string()
    .max(30, "Fax number cannot exceed 30 characters")
    .regex(/^[0-9+\-\s()]*$/, "Invalid fax number format")
    .optional()
    .or(z.literal("")),
  vatNumber: z.string()
    .max(50, "VAT number cannot exceed 50 characters")
    .optional()
    .or(z.literal("")),
  taxId: z.string()
    .max(50, "Tax ID cannot exceed 50 characters")
    .optional()
    .or(z.literal("")),
});

export const updateStoreSchema = insertStoreSchema;

// Add storeId to the food item schema
export const insertFoodItemSchema = createInsertSchema(foodItems).pick({
  name: true,
  normalizedName: true,
  originalName: true,
  category: true,
  quantity: true,
  unit: true,
  locationId: true,
  storeId: true,
  receiptId: true,
  expiryDate: true,
  price: true,
  pricePerUnit: true,
  isWeightBased: true,
  normalizationConfidence: true,
  lineNumbers: true,
}).extend({
  name: z.string().min(2, "Food name must be at least 2 characters"),
  normalizedName: z.string().optional(), // Normalized name is optional
  originalName: z.string().optional(), // Original name is optional
  category: z.string().optional(), // Category is optional
  quantity: z.string().or(z.number()).pipe(z.coerce.number().positive("Quantity must be a positive number")),
  unit: z.string().min(1, "Unit is required"),
  locationId: z.number().min(1, "Location is required"),
  storeId: z.number().optional(), // Store is optional
  receiptId: z.number().optional(), // Receipt is optional
  expiryDate: z.date().or(z.string()),
  price: z.number().optional(),
  pricePerUnit: z.number().optional(), // Price per unit is optional
  isWeightBased: z.boolean().optional().default(false), // Weight-based flag is optional
  normalizationConfidence: z.number().optional(), // Normalization confidence is optional
  lineNumbers: z.array(z.number()).optional(), // Line numbers from receipt are optional
});

export const updateFoodItemSchema = insertFoodItemSchema;

// Receipt schema
export const insertReceiptSchema = createInsertSchema(receipts).pick({
  storeId: true,
  filePath: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  totalAmount: true,
  receiptNumber: true,
  language: true,
}).extend({
  storeId: z.number().optional(),
  filePath: z.string().min(1, "File path is required"),
  fileName: z.string().min(1, "File name is required"),
  fileSize: z.number().int().positive("File size must be a positive integer"),
  mimeType: z.string().min(1, "MIME type is required"),
  totalAmount: z.number().optional(),
  receiptNumber: z.string().optional(),
  language: z.string().optional(),
});

export const updateReceiptSchema = insertReceiptSchema;

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type UpdateRole = z.infer<typeof updateRoleSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type UpdatePermission = z.infer<typeof updatePermissionSchema>;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type UpdateLocation = z.infer<typeof updateLocationSchema>;
export type InsertStore = z.infer<typeof insertStoreSchema>;
export type UpdateStore = z.infer<typeof updateStoreSchema>;
export type InsertFoodItem = z.infer<typeof insertFoodItemSchema>;
export type UpdateFoodItem = z.infer<typeof updateFoodItemSchema>;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type UpdateReceipt = z.infer<typeof updateReceiptSchema>;
export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type FoodItem = typeof foodItems.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type FoodItemTag = typeof foodItemTags.$inferSelect;
// Base Receipt type from the table
export type BaseReceipt = typeof receipts.$inferSelect;

// Products table for normalization reference
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  canonicalName: text("canonical_name").notNull(),
  categoryId: integer("category_id").references(() => tags.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    canonicalNameIdx: uniqueIndex("canonical_name_idx").on(table.canonicalName),
  }
});

// Product aliases for name variations
export const productAliases = pgTable("product_aliases", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: 'cascade' }).notNull(),
  alias: text("alias").notNull(),
  language: text("language").default("en"),
  storeId: integer("store_id").references(() => stores.id),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).default("1.0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    aliasProductStoreIdx: uniqueIndex("alias_product_store_idx").on(
      table.productId, 
      table.alias, 
      table.language, 
      sql`COALESCE(${table.storeId}, 0)`
    ),
  }
});

// Relations for products
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(tags, {
    fields: [products.categoryId],
    references: [tags.id],
  }),
  aliases: many(productAliases),
}));

// Relations for product aliases
export const productAliasesRelations = relations(productAliases, ({ one }) => ({
  product: one(products, {
    fields: [productAliases.productId],
    references: [products.id],
  }),
  store: one(stores, {
    fields: [productAliases.storeId],
    references: [stores.id],
  }),
}));

// Extended Receipt type with related data
export type Receipt = BaseReceipt & {
  store?: Store;
  paymentMethod?: string;
};

// Product types
export type Product = typeof products.$inferSelect;
export type ProductAlias = typeof productAliases.$inferSelect;

// Subscription types
export type SubscriptionTier = typeof subscriptionTiers.$inferSelect;
export type SharedPantryUser = typeof sharedPantryUsers.$inferSelect;