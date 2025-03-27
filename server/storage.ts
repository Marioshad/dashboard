import { 
  users, locations, foodItems, 
  type User, type InsertUser, type UpdateProfile,
  type Location, type InsertLocation, type UpdateLocation,
  type FoodItem, type InsertFoodItem, type UpdateFoodItem 
} from "@shared/schema";
import { db, pool } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { eq, sql, and, isNull } from "drizzle-orm";

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
  
  // Food item methods
  createFoodItem(item: InsertFoodItem & { userId: number }): Promise<FoodItem>;
  getFoodItems(userId: number, locationId?: number): Promise<FoodItem[]>;
  getFoodItem(id: number): Promise<FoodItem | undefined>;
  updateFoodItem(id: number, item: UpdateFoodItem): Promise<FoodItem>;
  deleteFoodItem(id: number): Promise<void>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    try {
      this.sessionStore = new PostgresSessionStore({
        pool,
        createTableIfMissing: true,
        tableName: 'session', // explicitly set table name
        pruneSessionInterval: 60 * 15, // Clean up expired sessions every 15 minutes
      });
      console.log('Session store initialized successfully');
    } catch (error) {
      console.error('Error initializing session store:', error);
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
      const [user] = await db
        .update(users)
        .set({
          ...profile,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(users.id, userId))
        .returning();
      return user;
    } catch (error) {
      console.error('Error updating user profile:', error);
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

  // Food item methods
  async createFoodItem(item: InsertFoodItem & { userId: number }): Promise<FoodItem> {
    try {
      const [result] = await db
        .insert(foodItems)
        .values({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          locationId: item.locationId,
          expiryDate: item.expiryDate,
          price: item.price,
          userId: item.userId,
          purchased: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
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
      // Create an update object with only defined fields
      const updateObj: Record<string, any> = {};
      
      if (item.name !== undefined) updateObj.name = item.name;
      if (item.quantity !== undefined) updateObj.quantity = item.quantity;
      if (item.unit !== undefined) updateObj.unit = item.unit;
      if (item.locationId !== undefined) updateObj.locationId = item.locationId;
      if (item.expiryDate !== undefined) updateObj.expiryDate = item.expiryDate;
      if (item.price !== undefined) updateObj.price = item.price;
      
      // Always update the timestamp
      updateObj.updatedAt = new Date();

      const [result] = await db
        .update(foodItems)
        .set(updateObj)
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
}

export const storage = new DatabaseStorage();