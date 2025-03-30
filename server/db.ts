import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { log } from './vite';

const { Pool } = pg;

// Try to construct a database URL from individual parameters if DATABASE_URL is not provided
let connectionString: string;

if (process.env.DATABASE_URL) {
  // Use the database connection string directly if available
  connectionString = process.env.DATABASE_URL;
  log('Using DATABASE_URL for database connection');
} else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
  // Build connection string from individual parameters
  const host = process.env.PGHOST;
  const port = process.env.PGPORT || '5432';
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD || '';
  const database = process.env.PGDATABASE;
  
  connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
  log('Constructed DATABASE_URL from individual PG* environment variables');
} else {
  throw new Error(
    "Either DATABASE_URL or PGHOST, PGUSER, and PGDATABASE must be set. Did you forget to provision a database?",
  );
}

// Log database connection attempt (in a secure way)
try {
  const dbUrl = new URL(connectionString);
  log('Database connection info:');
  log(`- Protocol: ${dbUrl.protocol}`);
  log(`- Host: ${dbUrl.hostname}`);
  log(`- Port: ${dbUrl.port || 'default'}`);
  log(`- Username: ${dbUrl.username ? '[REDACTED]' : 'not provided'}`);
  log(`- Password: ${dbUrl.password ? '[REDACTED]' : 'not provided'}`);
  log(`- Path (database): ${dbUrl.pathname ? dbUrl.pathname.substring(1) : 'not provided'}`);
} catch (error) {
  log(`Failed to parse database connection string: ${error instanceof Error ? error.message : String(error)}`);
  log('Using database connection string without parsing ability');
}

// Create a PostgreSQL pool with error handling
export const pool = new Pool({ 
  connectionString,
  // Set a reasonable timeout (10s)
  connectionTimeoutMillis: 10000,
  // Add SSL configuration for Railway deployment
  ssl: process.env.RAILWAY_ENVIRONMENT ? {
    rejectUnauthorized: false // Required for Railway deployment
  } : undefined
});

// Add specific PostgreSQL error event handling for better error messages
pool.on('error', (err) => {
  log(`PostgreSQL pool error: ${err.message}`);
  if (err.stack) {
    log(`Error stack trace: ${err.stack}`);
  }
  
  // Log specific PostgreSQL error properties
  // Cast error to unknown first, then to Record to satisfy TypeScript
  const pgError = err as unknown as Record<string, unknown>;
  if ('code' in err) log(`PostgreSQL error code: ${pgError.code}`);
  if ('detail' in err) log(`PostgreSQL error detail: ${pgError.detail}`);
  if ('hint' in err) log(`PostgreSQL error hint: ${pgError.hint}`);
  if ('position' in err) log(`PostgreSQL error position: ${pgError.position}`);
  if ('where' in err) log(`PostgreSQL error location: ${pgError.where}`);
  
  // Log connection details (redacted)
  log('Database connection string components:');
  try {
    const url = new URL(connectionString);
    log(`- Protocol: ${url.protocol}`);
    log(`- Host: ${url.hostname}`);
    log(`- Port: ${url.port || 'default'}`);
    log(`- Username: ${url.username ? '[REDACTED]' : 'not provided'}`);
    log(`- Password: ${url.password ? '[REDACTED]' : 'not provided'}`);
    log(`- Path (database): ${url.pathname ? url.pathname.substring(1) : 'not provided'}`);
  } catch (parseError) {
    log(`Unable to parse database connection string: ${String(parseError)}`);
  }
});

export const db = drizzle({ client: pool, schema });

// Helper function to test the database connection
export async function testDatabaseConnection() {
  try {
    log('Testing database connection with basic query...');
    const result = await pool.query('SELECT NOW() as now');
    log(`Database connection successful, server time: ${result.rows[0].now}`);
    return true;
  } catch (error) {
    // More comprehensive error logging
    if (error instanceof Error) {
      log(`Database connection error: ${error.name} - ${error.message}`);
      if (error.stack) {
        log(`Error stack trace: ${error.stack}`);
      }
    } else if (typeof error === 'object' && error !== null) {
      try {
        // Try to stringify the error object for more details
        log(`Database connection error details: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`);
      } catch (jsonError) {
        // Fallback if JSON stringify fails
        log(`Database connection error: Unable to stringify error object - ${Object.prototype.toString.call(error)}`);
        
        // Safely log properties without TypeScript errors
        try {
          Object.entries(error as Record<string, unknown>).forEach(([key, value]) => {
            log(`Error property ${key}: ${String(value)}`);
          });
        } catch (propError) {
          log(`Error accessing error properties: ${String(propError)}`);
        }
      }
    } else {
      log(`Database connection error: ${String(error)}`);
    }
    return false;
  }
}