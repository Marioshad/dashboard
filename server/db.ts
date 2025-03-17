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
          password TEXT NOT NULL,
          full_name TEXT,
          email TEXT,
          bio TEXT,
          avatar_url TEXT,
          role_id INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS roles (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS permissions (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
          role_id INTEGER NOT NULL REFERENCES roles(id),
          permission_id INTEGER NOT NULL REFERENCES permissions(id),
          PRIMARY KEY (role_id, permission_id)
        );

        CREATE TABLE IF NOT EXISTS session (
          sid varchar NOT NULL COLLATE "default",
          sess json NOT NULL,
          expire timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        );

        -- Add new columns if they don't exist
        DO $$ 
        BEGIN 
          BEGIN
            ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;
          EXCEPTION WHEN others THEN
            -- Log any errors but don't fail
            RAISE NOTICE 'Error adding columns: %', SQLERRM;
          END;
        END $$;

        -- Create foreign key constraint if it doesn't exist
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'users_role_id_fkey'
          ) THEN
            ALTER TABLE users
            ADD CONSTRAINT users_role_id_fkey
            FOREIGN KEY (role_id)
            REFERENCES roles(id);
          END IF;
        EXCEPTION WHEN others THEN
          RAISE NOTICE 'Error adding foreign key: %', SQLERRM;
        END $$;
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