import * as schema from "@shared/schema";
import { 
  users, locations, foodItems, stores, receipts, roles,
  type User, type InsertUser, type UpdateProfile,
  type Location, type InsertLocation, type UpdateLocation,
  type Store, type InsertStore, type UpdateStore,
  type FoodItem, type InsertFoodItem, type UpdateFoodItem,
  type Receipt, type InsertReceipt, type UpdateReceipt
} from "@shared/schema";
import { db, pool } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq, sql, and, isNull } from "drizzle-orm";
import { Pool } from 'pg';

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateProfile(userId: number, profile: UpdateProfile): Promise<User>;
  updateUserSubscription(userId: number, subscription: {
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionTier?: string;
    currentBillingPeriodStart?: Date | null;
    currentBillingPeriodEnd?: Date | null;
  }): Promise<User>;
  updateUserLimits(userId: number, limits: {
    receiptScansLimit?: number;
    maxItems?: number;
    maxSharedUsers?: number;
  }): Promise<User>;
  updateStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User>;
  updateUserVerification(userId: number, verificationData: {
    emailVerified?: boolean;
    verificationToken?: string | null;
    verificationTokenExpiresAt?: Date | null;
  }): Promise<User>;
  getRoleByName(roleName: string): Promise<{ id: number; name: string } | undefined>;
  updateUserRole(userId: number, roleId: number): Promise<User>;
  
  // Location methods
  createLocation(location: InsertLocation & { userId: number }): Promise<Location>;
  getLocations(userId: number): Promise<Location[]>;
  getLocation(id: number): Promise<Location | undefined>;
  updateLocation(id: number, location: UpdateLocation): Promise<Location>;
  deleteLocation(id: number): Promise<void>;
  
  // Store methods
  createStore(store: InsertStore & { userId: number }): Promise<Store>;
  getStores(userId: number): Promise<Store[]>;
  findStoreByNameAndLocation(name: string, location: string, userId: number): Promise<Store | undefined>;
  getStore(id: number): Promise<Store | undefined>;
  updateStore(id: number, store: UpdateStore): Promise<Store>;
  deleteStore(id: number): Promise<void>;
  
  // Food item methods
  createFoodItem(item: InsertFoodItem & { userId: number }): Promise<FoodItem>;
  getFoodItems(userId: number, locationId?: number): Promise<FoodItem[]>;
  getFoodItem(id: number): Promise<FoodItem | undefined>;
  updateFoodItem(id: number, item: UpdateFoodItem): Promise<FoodItem>;
  deleteFoodItem(id: number): Promise<void>;
  
  // Receipt methods
  createReceipt(receipt: InsertReceipt & { userId: number }): Promise<Receipt>;
  getReceipts(userId: number): Promise<Receipt[]>;
  getReceipt(id: number): Promise<Receipt | undefined>;
  updateReceipt(id: number, receipt: UpdateReceipt): Promise<Receipt>;
  deleteReceipt(id: number): Promise<void>;
  getFoodItemsByReceiptId(receiptId: number): Promise<FoodItem[]>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    try {
      this.sessionStore = new PostgresSessionStore({
        pool: pool as unknown as Pool,
        createTableIfMissing: true,
        tableName: 'session', // explicitly set table name
        pruneSessionInterval: 60 * 15, // Clean up expired sessions every 15 minutes
      });
      console.log('Session store initialized successfully');
    } catch (error) {
      console.error('Error initializing session store:');
      
      if (error instanceof Error) {
        console.error(`- Error name: ${error.name}`);
        console.error(`- Error message: ${error.message}`);
        if (error.stack) {
          console.error(`- Stack trace: ${error.stack}`);
        }
      } else if (typeof error === 'object' && error !== null) {
        try {
          console.error(`- Details: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
        } catch (jsonError) {
          console.error(`- Unable to stringify error object - ${Object.prototype.toString.call(error)}`);
          try {
            Object.entries(error as Record<string, unknown>).forEach(([key, value]) => {
              console.error(`- Property ${key}: ${String(value)}`);
            });
          } catch (propError) {
            console.error(`- Error accessing error properties: ${String(propError)}`);
          }
        }
      } else {
        console.error(`- ${String(error)}`);
      }
      
      // Fallback - in-memory session store, only for recovery
      console.warn('Using fallback in-memory session store - users will need to log in again');
      const MemoryStore = require('memorystore')(session);
      this.sessionStore = new MemoryStore({
        checkPeriod: 60 * 60 * 1000 // prune expired entries every hour
      });
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      // Explicitly select columns to avoid issues with schema mismatches
      const result = await db.select({
        id: users.id,
        username: users.username,
        password: users.password,
        fullName: users.fullName,
        email: users.email,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        roleId: users.roleId,
        currency: users.currency,
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
        emailNotifications: users.emailNotifications,
        webNotifications: users.webNotifications,
        mentionNotifications: users.mentionNotifications,
        followNotifications: users.followNotifications,
        verificationToken: users.verificationToken,
        verificationTokenExpiry: users.verificationTokenExpiry,
        verificationTokenExpiresAt: users.verificationTokenExpiresAt,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionTier: users.subscriptionTier,
        receiptScansUsed: users.receiptScansUsed,
        receiptScansLimit: users.receiptScansLimit,
        maxItems: users.maxItems,
        maxSharedUsers: users.maxSharedUsers,
        currentBillingPeriodStart: users.currentBillingPeriodStart,
        currentBillingPeriodEnd: users.currentBillingPeriodEnd,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
      
      // If email_verified column exists, get it separately to avoid errors
      const user = result[0];
      if (user) {
        try {
          const emailVerifiedResult = await db.execute(
            sql`SELECT email_verified FROM users WHERE id = ${id}`
          );
          if (emailVerifiedResult.rows && emailVerifiedResult.rows.length > 0) {
            (user as any).emailVerified = emailVerifiedResult.rows[0].email_verified;
          } else {
            (user as any).emailVerified = false;
          }
        } catch (err) {
          console.warn('email_verified column not available:', err);
          (user as any).emailVerified = false;
        }
      }
      
      return user;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      // Explicitly select columns to avoid issues with schema mismatches
      const result = await db.select({
        id: users.id,
        username: users.username,
        password: users.password,
        fullName: users.fullName,
        email: users.email,
        bio: users.bio,
        avatarUrl: users.avatarUrl,
        roleId: users.roleId,
        currency: users.currency,
        twoFactorEnabled: users.twoFactorEnabled,
        twoFactorSecret: users.twoFactorSecret,
        emailNotifications: users.emailNotifications,
        webNotifications: users.webNotifications,
        mentionNotifications: users.mentionNotifications,
        followNotifications: users.followNotifications,
        verificationToken: users.verificationToken,
        verificationTokenExpiry: users.verificationTokenExpiry,
        verificationTokenExpiresAt: users.verificationTokenExpiresAt,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
        subscriptionStatus: users.subscriptionStatus,
        subscriptionTier: users.subscriptionTier,
        receiptScansUsed: users.receiptScansUsed,
        receiptScansLimit: users.receiptScansLimit,
        maxItems: users.maxItems,
        maxSharedUsers: users.maxSharedUsers,
        currentBillingPeriodStart: users.currentBillingPeriodStart,
        currentBillingPeriodEnd: users.currentBillingPeriodEnd,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
      
      // If email_verified column exists, get it separately to avoid errors
      const user = result[0];
      if (user) {
        try {
          const emailVerifiedResult = await db.execute(
            sql`SELECT email_verified FROM users WHERE id = ${user.id}`
          );
          if (emailVerifiedResult.rows && emailVerifiedResult.rows.length > 0) {
            (user as any).emailVerified = emailVerifiedResult.rows[0].email_verified;
          } else {
            (user as any).emailVerified = false;
          }
        } catch (err) {
          console.warn('email_verified column not available:', err);
          (user as any).emailVerified = false;
        }
      }
      
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // First, ensure we don't try to insert email_verified if it doesn't exist
      const columnsResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      
      const existingColumns = columnsResult.rows.map((row: any) => row.column_name);
      const insertValues = { ...insertUser };
      
      // Check if the column exists and set default emailVerified
      const hasEmailVerifiedColumn = existingColumns.includes('email_verified');
      
      // Insert the user with the filtered values
      const [user] = await db.insert(users).values([insertUser]).returning();
      
      // If email_verified column exists, set it to false for new users
      if (hasEmailVerifiedColumn) {
        try {
          await db.execute(sql`
            UPDATE users SET email_verified = FALSE 
            WHERE id = ${user.id} AND email_verified IS NULL
          `);
        } catch (err) {
          console.warn('Unable to set email_verified for new user:', err);
        }
      }
      
      // Add emailVerified property to returned user
      (user as any).emailVerified = false;
      
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateProfile(userId: number, profile: UpdateProfile): Promise<User> {
    try {
      console.log('STORAGE: updateProfile called with userId:', userId);
      console.log('STORAGE: profile data:', JSON.stringify(profile));
      
      console.log('STORAGE: executing update query...');
      const [user] = await db
        .update(users)
        .set({
          ...profile,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, userId))
        .returning();
      
      console.log('STORAGE: update successful, returned user:', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('STORAGE: Error updating user profile:', error);
      if (error instanceof Error) {
        console.error('STORAGE: Error message:', error.message);
        console.error('STORAGE: Error stack:', error.stack);
      }
      throw error;
    }
  }
  
  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.stripeCustomerId, stripeCustomerId))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting user by Stripe customer ID:', error);
      throw error;
    }
  }
  
  async updateUserSubscription(userId: number, subscription: {
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionTier?: string;
    currentBillingPeriodStart?: Date | null;
    currentBillingPeriodEnd?: Date | null;
  }): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set({
          ...subscription,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, userId))
        .returning();
      return user;
    } catch (error) {
      console.error('Error updating user subscription:', error);
      throw error;
    }
  }
  
  async updateUserLimits(userId: number, limits: {
    receiptScansLimit?: number;
    maxItems?: number;
    maxSharedUsers?: number;
  }): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set({
          ...limits,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, userId))
        .returning();
      return user;
    } catch (error) {
      console.error('Error updating user limits:', error);
      throw error;
    }
  }
  
  async updateStripeCustomerId(userId: number, stripeCustomerId: string): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set({
          stripeCustomerId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, userId))
        .returning();
      return user;
    } catch (error) {
      console.error('Error updating Stripe customer ID:', error);
      throw error;
    }
  }

  // Location methods
  async createLocation(location: InsertLocation & { userId: number }): Promise<Location> {
    try {
      const [result] = await db
        .insert(locations)
        .values([{
          ...location,
          createdAt: new Date(),
          updatedAt: new Date(),
        }])
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating location:', error);
      throw error;
    }
  }

  async getLocations(userId: number): Promise<Location[]> {
    try {
      return await db
        .select()
        .from(locations)
        .where(eq(locations.userId, userId));
    } catch (error) {
      console.error('Error getting locations:', error);
      throw error;
    }
  }

  async getLocation(id: number): Promise<Location | undefined> {
    try {
      const result = await db
        .select()
        .from(locations)
        .where(eq(locations.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  async updateLocation(id: number, location: UpdateLocation): Promise<Location> {
    try {
      const [result] = await db
        .update(locations)
        .set({
          ...location,
          updatedAt: new Date(),
        })
        .where(eq(locations.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    }
  }

  async deleteLocation(id: number): Promise<void> {
    try {
      await db
        .delete(locations)
        .where(eq(locations.id, id));
    } catch (error) {
      console.error('Error deleting location:', error);
      throw error;
    }
  }

  // Store methods
  async createStore(store: InsertStore & { userId: number }): Promise<Store> {
    try {
      const [result] = await db
        .insert(stores)
        .values([{
          ...store,
          createdAt: new Date(),
          updatedAt: new Date(),
        }])
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating store:', error);
      throw error;
    }
  }

  async getStores(userId: number): Promise<Store[]> {
    try {
      return await db
        .select()
        .from(stores)
        .where(eq(stores.userId, userId));
    } catch (error) {
      console.error('Error getting stores:', error);
      throw error;
    }
  }

  async findStoreByNameAndLocation(name: string, location: string, userId: number): Promise<Store | undefined> {
    try {
      const result = await db
        .select()
        .from(stores)
        .where(
          and(
            eq(stores.name, name),
            eq(stores.location, location),
            eq(stores.userId, userId)
          )
        )
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error finding store by name and location:', error);
      throw error;
    }
  }

  async getStore(id: number): Promise<Store | undefined> {
    try {
      const result = await db
        .select()
        .from(stores)
        .where(eq(stores.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting store:', error);
      throw error;
    }
  }

  async updateStore(id: number, store: UpdateStore): Promise<Store> {
    try {
      const [result] = await db
        .update(stores)
        .set({
          ...store,
          updatedAt: new Date(),
        })
        .where(eq(stores.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating store:', error);
      throw error;
    }
  }

  async deleteStore(id: number): Promise<void> {
    try {
      await db
        .delete(stores)
        .where(eq(stores.id, id));
    } catch (error) {
      console.error('Error deleting store:', error);
      throw error;
    }
  }

  // Food item methods
  async createFoodItem(item: InsertFoodItem & { userId: number }): Promise<FoodItem> {
    try {
      // Convert expiryDate to string format for PostgreSQL date column
      const expiryDateString = item.expiryDate instanceof Date 
        ? item.expiryDate.toISOString().split('T')[0] // Convert to YYYY-MM-DD format
        : item.expiryDate;
      
      // Force types to SQL to avoid TypeScript errors
      const dateNow = new Date().toISOString();
      
      console.log('Creating food item with data:', {
        ...item,
        expiryDate: expiryDateString,
        purchased: dateNow,
      });
      
      // Prepare the values as separate variables
      const name = item.name;
      const quantity = String(item.quantity); // Convert number to string for decimal column
      const unit = item.unit;
      const locationId = item.locationId;
      const expiryDate = expiryDateString;
      const price = item.price;
      const userId = item.userId;
      const purchased = sql`${dateNow}::timestamp`;
      const createdAt = sql`${dateNow}::timestamp`;
      const updatedAt = sql`${dateNow}::timestamp`;
      const receiptId = item.receiptId || null;
      const storeId = item.storeId || null;
      const pricePerUnit = item.pricePerUnit || null;
      const isWeightBased = item.isWeightBased || false;
      const normalizedName = item.normalizedName || null;
      const originalName = item.originalName || null;
      const category = item.category || null;
      const normalizationConfidence = item.normalizationConfidence || null;
      
      // Create a base values object
      const valuesObj: any = {
        name,
        quantity,
        unit,
        locationId,
        expiryDate,
        price,
        userId,
        purchased,
        createdAt,
        updatedAt,
        receiptId,
        storeId,
        pricePerUnit,
        isWeightBased,
        normalizedName,
        originalName,
        category,
        normalizationConfidence,
      };
      
      // Conditionally add lineNumbers if present
      if (item.lineNumbers && Array.isArray(item.lineNumbers)) {
        valuesObj.lineNumbers = item.lineNumbers;
      }
      
      // Wrap in array for drizzle's .values() method which expects an array
      const [result] = await db
        .insert(foodItems)
        .values([valuesObj])
        .returning();
      return result;
    } catch (error) {
      console.error('Error creating food item:', error);
      throw error;
    }
  }

  async getFoodItems(userId: number, locationId?: number): Promise<FoodItem[]> {
    try {
      const query = locationId 
        ? and(eq(foodItems.userId, userId), eq(foodItems.locationId, locationId))
        : eq(foodItems.userId, userId);

      return await db
        .select()
        .from(foodItems)
        .where(query)
        .orderBy(foodItems.expiryDate);
    } catch (error) {
      console.error('Error getting food items:', error);
      throw error;
    }
  }

  async getFoodItem(id: number): Promise<FoodItem | undefined> {
    try {
      const result = await db
        .select()
        .from(foodItems)
        .where(eq(foodItems.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting food item:', error);
      throw error;
    }
  }

  async updateFoodItem(id: number, item: UpdateFoodItem): Promise<FoodItem> {
    try {
      // Build the update object with correct types
      const updates: Record<string, any> = {};
      
      if (item.name !== undefined) updates.name = item.name;
      if (item.quantity !== undefined) updates.quantity = String(item.quantity);
      if (item.unit !== undefined) updates.unit = item.unit;
      if (item.locationId !== undefined) updates.locationId = item.locationId;
      if (item.price !== undefined) updates.price = item.price;
      
      // Handle expiryDate specially
      if (item.expiryDate !== undefined) {
        const expiryDateValue = item.expiryDate instanceof Date
          ? item.expiryDate.toISOString().split('T')[0]
          : item.expiryDate;
        updates.expiryDate = expiryDateValue;
      }
      
      // Set updatedAt using SQL
      updates.updatedAt = sql`CURRENT_TIMESTAMP`;
      
      // Apply the updates and return the result
      const [result] = await db
        .update(foodItems)
        .set(updates)
        .where(eq(foodItems.id, id))
        .returning();
      return result;
    } catch (error) {
      console.error('Error updating food item:', error);
      throw error;
    }
  }

  async deleteFoodItem(id: number): Promise<void> {
    try {
      await db
        .delete(foodItems)
        .where(eq(foodItems.id, id));
    } catch (error) {
      console.error('Error deleting food item:', error);
      throw error;
    }
  }

  // Receipt methods
  async createReceipt(receipt: InsertReceipt & { userId: number, uploadDate?: Date, receiptDate?: Date, paymentMethod?: string, extractedData?: any, language?: string }): Promise<Receipt> {
    try {
      // Check which columns actually exist in the database
      const columnsResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'receipts'
      `);
      
      const existingColumns = columnsResult.rows.map((row: any) => row.column_name);
      console.log('Available receipt columns:', existingColumns);
      
      // Build values object based on existing columns only
      const values: any = {};
      
      // Add values only if the column exists
      if (existingColumns.includes('userid') || existingColumns.includes('userId')) {
        values.userId = receipt.userId;
      }
      
      if (existingColumns.includes('filepath') || existingColumns.includes('filePath')) {
        values.filePath = receipt.filePath;
      }
      
      if (existingColumns.includes('filename') || existingColumns.includes('fileName')) {
        values.fileName = receipt.fileName;
      }
      
      if (existingColumns.includes('filesize') || existingColumns.includes('fileSize')) {
        values.fileSize = receipt.fileSize;
      }
      
      if (existingColumns.includes('mimetype') || existingColumns.includes('mimeType')) {
        values.mimeType = receipt.mimeType;
      }
      
      if ((existingColumns.includes('storeid') || existingColumns.includes('storeId')) && receipt.storeId) {
        values.storeId = receipt.storeId;
      }
      
      if ((existingColumns.includes('totalamount') || existingColumns.includes('totalAmount')) && receipt.totalAmount) {
        values.totalAmount = String(receipt.totalAmount);
      }
      
      if ((existingColumns.includes('receiptnumber') || existingColumns.includes('receiptNumber')) && receipt.receiptNumber) {
        values.receiptNumber = receipt.receiptNumber;
      }
      
      if ((existingColumns.includes('uploaddate') || existingColumns.includes('uploadDate'))) {
        values.uploadDate = receipt.uploadDate || new Date();
      }
      
      if ((existingColumns.includes('receiptdate') || existingColumns.includes('receiptDate')) && receipt.receiptDate) {
        values.receiptDate = receipt.receiptDate;
      }
      
      if ((existingColumns.includes('paymentmethod') || existingColumns.includes('paymentMethod')) && receipt.paymentMethod) {
        values.paymentMethod = receipt.paymentMethod;
      }
      
      if ((existingColumns.includes('extracteddata') || existingColumns.includes('extractedData')) && receipt.extractedData) {
        values.extractedData = receipt.extractedData;
      }
      
      if (existingColumns.includes('language') && receipt.language) {
        values.language = receipt.language;
      }
      
      // Add timestamps if they exist
      if (existingColumns.includes('createdat') || existingColumns.includes('createdAt')) {
        values.createdAt = new Date();
      }
      
      if (existingColumns.includes('updatedat') || existingColumns.includes('updatedAt')) {
        values.updatedAt = new Date();
      }
      
      // For debugging
      console.log('Creating receipt with values:', Object.keys(values));
      
      // Insert with only the fields that exist in the database
      const [result] = await db
        .insert(receipts)
        .values([values])
        .returning();
      
      return result;
    } catch (error: any) {
      console.error('Error creating receipt:', error);
      // Create a minimal receipt object to avoid breaking the UI
      const errorStr = typeof error === 'object' && error !== null ? error.toString() : String(error);
      if (!errorStr.includes('duplicate key')) {
        const fallbackReceipt: any = {
          id: Date.now(), // Use timestamp as fallback ID
          userId: receipt.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        // Copy any values that were in the original receipt
        if (receipt.filePath) fallbackReceipt.filePath = receipt.filePath;
        if (receipt.fileName) fallbackReceipt.fileName = receipt.fileName;
        
        console.warn('Using fallback receipt object due to database error');
        return fallbackReceipt;
      }
      throw error;
    }
  }

  async getReceipts(userId: number): Promise<Receipt[]> {
    try {
      // First get the receipts
      const receiptList = await db
        .select()
        .from(receipts)
        .where(eq(receipts.userId, userId))
        .orderBy(sql`receipts."uploadDate" DESC`);
      
      // For each receipt with a storeId, fetch the associated store
      const receiptsWithStores = await Promise.all(
        receiptList.map(async (receipt) => {
          if (receipt.storeId) {
            const [storeData] = await db
              .select()
              .from(stores)
              .where(eq(stores.id, receipt.storeId));
              
            // Return receipt with store information
            return {
              ...receipt,
              store: storeData
            };
          }
          return receipt;
        })
      );
      
      return receiptsWithStores;
    } catch (error) {
      console.error('Error getting receipts:', error);
      throw error;
    }
  }

  async getReceipt(id: number): Promise<Receipt | undefined> {
    try {
      // Get the receipt
      const [receipt] = await db
        .select()
        .from(receipts)
        .where(eq(receipts.id, id))
        .limit(1);
      
      if (!receipt) return undefined;
      
      // If receipt has a storeId, fetch the associated store
      if (receipt.storeId) {
        const [storeData] = await db
          .select()
          .from(stores)
          .where(eq(stores.id, receipt.storeId));
          
        if (storeData) {
          // Return receipt with store information
          return {
            ...receipt,
            store: storeData
          };
        }
      }
      
      return receipt;
    } catch (error) {
      console.error('Error getting receipt:', error);
      throw error;
    }
  }

  async updateReceipt(id: number, receipt: UpdateReceipt): Promise<Receipt> {
    try {
      // Check which columns actually exist in the database
      const columnsResult = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'receipts'
      `);
      
      const existingColumns = columnsResult.rows.map((row: any) => row.column_name);
      console.log('Available receipt columns for update:', existingColumns);
      
      // Build values object based on existing columns only
      const values: any = {};
      
      // Only add fields that exist in the database and were provided
      if ((existingColumns.includes('filepath') || existingColumns.includes('filePath')) && receipt.filePath) {
        values.filePath = receipt.filePath;
      }
      
      if ((existingColumns.includes('filename') || existingColumns.includes('fileName')) && receipt.fileName) {
        values.fileName = receipt.fileName;
      }
      
      if ((existingColumns.includes('filesize') || existingColumns.includes('fileSize')) && receipt.fileSize) {
        values.fileSize = receipt.fileSize;
      }
      
      if ((existingColumns.includes('mimetype') || existingColumns.includes('mimeType')) && receipt.mimeType) {
        values.mimeType = receipt.mimeType;
      }
      
      if ((existingColumns.includes('storeid') || existingColumns.includes('storeId')) && receipt.storeId) {
        values.storeId = receipt.storeId;
      }
      
      if ((existingColumns.includes('totalamount') || existingColumns.includes('totalAmount')) && receipt.totalAmount !== undefined) {
        values.totalAmount = String(receipt.totalAmount);
      }
      
      if ((existingColumns.includes('receiptnumber') || existingColumns.includes('receiptNumber')) && receipt.receiptNumber) {
        values.receiptNumber = receipt.receiptNumber;
      }
      
      if (existingColumns.includes('language') && receipt.language) {
        values.language = receipt.language;
      }
      
      // Add updatedAt if it exists
      if (existingColumns.includes('updatedat') || existingColumns.includes('updatedAt')) {
        values.updatedAt = new Date();
      }
      
      // Only update if there are valid fields to update
      if (Object.keys(values).length === 0) {
        console.warn('No valid fields to update for receipt:', id);
        // Fetch and return the existing receipt instead
        const existingReceipt = await this.getReceipt(id);
        if (!existingReceipt) {
          throw new Error('Receipt not found');
        }
        return existingReceipt;
      }
      
      // Update with only the fields that exist in the database
      const [result] = await db
        .update(receipts)
        .set(values)
        .where(eq(receipts.id, id))
        .returning();
      
      return result;
    } catch (error: any) {
      console.error('Error updating receipt:', error);
      // Try to fetch the existing receipt instead to avoid breaking the UI
      try {
        const existingReceipt = await this.getReceipt(id);
        if (existingReceipt) {
          console.warn('Returning existing receipt after update error');
          return existingReceipt;
        }
      } catch (fetchError) {
        console.error('Could not fetch existing receipt after update error:', fetchError);
      }
      throw error;
    }
  }

  async deleteReceipt(id: number): Promise<void> {
    try {
      await db
        .delete(receipts)
        .where(eq(receipts.id, id));
    } catch (error) {
      console.error('Error deleting receipt:', error);
      throw error;
    }
  }

  async getFoodItemsByReceiptId(receiptId: number): Promise<FoodItem[]> {
    try {
      const result = await db
        .select()
        .from(foodItems)
        .where(eq(foodItems.receiptId, receiptId))
        .orderBy(foodItems.name);
      
      return result;
    } catch (error) {
      console.error('Error getting food items by receipt ID:', error);
      throw error;
    }
  }

  /**
   * Update user email verification status and token
   */
  async updateUserVerification(userId: number, verificationData: {
    emailVerified?: boolean;
    verificationToken?: string | null;
    verificationTokenExpiresAt?: Date | null;
  }): Promise<User> {
    try {
      // Fix the field names to match the database schema
      const dataToUpdate: any = {
        updatedAt: sql`CURRENT_TIMESTAMP`,
      };
      
      // Map the fields to the actual database column names
      if (verificationData.emailVerified !== undefined) {
        dataToUpdate.email_verified = verificationData.emailVerified;
      }
      
      if (verificationData.verificationToken !== undefined) {
        dataToUpdate.verification_token = verificationData.verificationToken;
      }
      
      if (verificationData.verificationTokenExpiresAt !== undefined) {
        dataToUpdate.verification_token_expires_at = verificationData.verificationTokenExpiresAt;
      }
      
      console.log('Updating user verification with data:', dataToUpdate);
      
      // Use a raw SQL query to update the user
      const [user] = await db
        .update(users)
        .set(dataToUpdate)
        .where(eq(users.id, userId))
        .returning();
      
      return user;
    } catch (error) {
      console.error('Error updating user verification:', error);
      throw error;
    }
  }

  /**
   * Get a role by name
   */
  async getRoleByName(roleName: string): Promise<{ id: number; name: string } | undefined> {
    try {
      // Use the directly imported roles reference
      const [role] = await db
        .select({
          id: roles.id,
          name: roles.name
        })
        .from(roles)
        .where(eq(roles.name, roleName));
      return role;
    } catch (error) {
      console.error('Error getting role by name:', error);
      throw error;
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: number, roleId: number): Promise<User> {
    try {
      const [user] = await db
        .update(users)
        .set({
          roleId,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, userId))
        .returning();
      return user;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();