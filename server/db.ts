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

// Create a PostgreSQL pool with error handling
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
    const url = new URL(process.env.DATABASE_URL || '');
    log(`- Protocol: ${url.protocol}`);
    log(`- Host: ${url.hostname}`);
    log(`- Port: ${url.port || 'default'}`);
    log(`- Username: ${url.username ? '[REDACTED]' : 'not provided'}`);
    log(`- Password: ${url.password ? '[REDACTED]' : 'not provided'}`);
    log(`- Path (database): ${url.pathname ? url.pathname.substring(1) : 'not provided'}`);
  } catch (parseError) {
    log(`Unable to parse DATABASE_URL: ${String(parseError)}`);
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