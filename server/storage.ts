import { 
  users, locations, foodItems, stores, receipts,
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
  createUser(user: InsertUser): Promise<User>;
  updateProfile(userId: number, profile: UpdateProfile): Promise<User>;
  
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
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0];
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
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

  // Location methods
  async createLocation(location: InsertLocation & { userId: number }): Promise<Location> {
    try {
      const [result] = await db
        .insert(locations)
        .values({
          ...location,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
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
        .values({
          ...store,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
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
      
      const [result] = await db
        .insert(foodItems)
        .values({
          name: item.name,
          quantity: String(item.quantity), // Convert number to string for decimal column
          unit: item.unit,
          locationId: item.locationId,
          expiryDate: expiryDateString,
          price: item.price,
          userId: item.userId,
          purchased: sql`${dateNow}::timestamp`,
          createdAt: sql`${dateNow}::timestamp`,
          updatedAt: sql`${dateNow}::timestamp`,
          // Include additional fields for receipt items
          receiptId: item.receiptId || null,
          storeId: item.storeId || null,
          pricePerUnit: item.pricePerUnit || null,
          isWeightBased: item.isWeightBased || false,
        })
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
  async createReceipt(receipt: InsertReceipt & { userId: number, uploadDate?: Date, receiptDate?: Date, paymentMethod?: string, extractedData?: any }): Promise<Receipt> {
    try {
      // Column names must match exactly what's in the database (camelCase)
      const values: any = {
        userId: receipt.userId,
        filePath: receipt.filePath,
        fileName: receipt.fileName,
        fileSize: receipt.fileSize,
        mimeType: receipt.mimeType
      };
      
      if (receipt.storeId) values.storeId = receipt.storeId;
      if (receipt.totalAmount) values.totalAmount = String(receipt.totalAmount);
      if (receipt.receiptNumber) values.receiptNumber = receipt.receiptNumber;
      if (receipt.uploadDate) values.uploadDate = receipt.uploadDate;
      if (receipt.receiptDate) values.receiptDate = receipt.receiptDate;
      if (receipt.paymentMethod) values.paymentMethod = receipt.paymentMethod;
      if (receipt.extractedData) values.extractedData = receipt.extractedData;
      
      if (!values.uploadDate) {
        values.uploadDate = new Date();
      }
      
      // For debugging
      console.log('Creating receipt with values:', Object.keys(values));
      
      const [result] = await db
        .insert(receipts)
        .values(values)
        .returning();
      
      return result;
    } catch (error) {
      console.error('Error creating receipt:', error);
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
      const values: any = {};
      
      if (receipt.filePath) values.filePath = receipt.filePath;
      if (receipt.fileName) values.fileName = receipt.fileName;
      if (receipt.fileSize) values.fileSize = receipt.fileSize;
      if (receipt.mimeType) values.mimeType = receipt.mimeType;
      if (receipt.storeId) values.storeId = receipt.storeId;
      if (receipt.totalAmount !== undefined) values.totalAmount = String(receipt.totalAmount);
      if (receipt.receiptNumber) values.receiptNumber = receipt.receiptNumber;
      
      const [result] = await db
        .update(receipts)
        .set({
          ...values,
          updatedAt: new Date()
        })
        .where(eq(receipts.id, id))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Error updating receipt:', error);
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
}

export const storage = new DatabaseStorage();