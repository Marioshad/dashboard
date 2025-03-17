import { users, type User, type InsertUser } from "@shared/schema";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import session from "express-session";
import connectPg from "connect-pg-simple";
import ws from "ws";

const PostgresSessionStore = connectPg(session);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Configure WebSocket for Neon's serverless driver
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  webSocketConstructor: ws 
});
const db = drizzle(pool);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(({ id: id_ }) => id_ === id).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(({ username: username_ }) => username_ === username).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }
}

export const storage = new DatabaseStorage();