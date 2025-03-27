import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { log } from './vite';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Helper function to test the database connection
export async function testDatabaseConnection() {
  try {
    log('Testing database connection with basic query...');
    const result = await pool.query('SELECT NOW() as now');
    log(`Database connection successful, server time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    log(`Database connection error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}