import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

// Create a PostgreSQL connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? {
    rejectUnauthorized: false
  } : undefined
});

// Test the database connection
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Create a Drizzle instance
export const db = drizzle(pool, { schema });

// Function to test database connection and ensure tables exist
export async function testConnection() {
  let retries = 10; // Increased retries for production
  const retryDelay = 5000; // 5 seconds between retries

  while (retries) {
    try {
      const client = await pool.connect();

      // Test basic connectivity
      const result = await client.query('SELECT NOW()');
      console.log('Database connection successful:', result.rows[0].now);

      // Create tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS session (
          sid varchar NOT NULL COLLATE "default",
          sess json NOT NULL,
          expire timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        );
      `);
      console.log('Database tables verified');

      client.release();
      return true;
    } catch (err) {
      console.error('Database connection attempt failed:', err);
      retries -= 1;
      if (!retries) {
        throw err;
      }
      console.log(`Retrying connection in ${retryDelay/1000} seconds... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  return false;
}