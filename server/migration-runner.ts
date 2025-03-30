import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './vite';

// Get the current directory for ES modules
// Use explicit type annotation for __dirname to avoid implicit 'any' errors
let __dirname: string = '';
try {
  // For ES modules environment
  const __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  // For CommonJS environment
  const pathname = new URL(import.meta.url).pathname;
  __dirname = path.dirname(pathname);
}

const { Pool } = pg;

/**
 * Run database migrations automatically
 * @returns Promise<boolean> True if migrations were successful
 */
export async function runMigrations(): Promise<boolean> {
  // Get database connection information
  let connectionString: string;
  
  if (process.env.DATABASE_URL) {
    connectionString = process.env.DATABASE_URL;
    log('Using DATABASE_URL for migrations', 'migration');
  } else if (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE) {
    // Build connection string from individual parameters
    const host = process.env.PGHOST;
    const port = process.env.PGPORT || '5432';
    const user = process.env.PGUSER;
    const password = process.env.PGPASSWORD || '';
    const database = process.env.PGDATABASE;
    
    connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
    log('Constructed DATABASE_URL from individual PG* variables for migrations', 'migration');
  } else {
    log('Error: Either DATABASE_URL or PGHOST, PGUSER, and PGDATABASE must be set for migrations', 'migration');
    return false;
  }

  // Create a new PostgreSQL client with appropriate SSL settings
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false } // Only use SSL for non-local
  });

  // Get all migration files
  let migrationsDir = path.join(__dirname, 'migrations');
  
  // In production, migrations might be in a different location
  if (process.env.NODE_ENV === 'production') {
    // Check if we're in dist folder structure
    const distMigrationsPath = path.join(__dirname, 'migrations');
    if (fs.existsSync(distMigrationsPath)) {
      migrationsDir = distMigrationsPath;
      log(`Using production migrations path: ${migrationsDir}`, 'migration');
    } else {
      // Try parent directory as fallback (for Railway deployment)
      const parentMigrationsPath = path.join(__dirname, '..', 'server', 'migrations');
      if (fs.existsSync(parentMigrationsPath)) {
        migrationsDir = parentMigrationsPath;
        log(`Using parent migrations path: ${migrationsDir}`, 'migration');
      } else {
        log(`Warning: Couldn't find migrations directory in production. Checked: ${distMigrationsPath} and ${parentMigrationsPath}`, 'migration');
      }
    }
  }
  
  log(`Using migrations directory: ${migrationsDir}`, 'migration');
  
  if (!fs.existsSync(migrationsDir)) {
    log(`Error: Migrations directory does not exist: ${migrationsDir}`, 'migration');
    return false;
  }
  
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure migrations run in order (001, 002, etc.)

  log('Running database migrations...', 'migration');
  log(`Found ${migrationFiles.length} migration files: ${migrationFiles.join(', ')}`, 'migration');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    log('Database connection successful for migrations', 'migration');
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Execute each migration in order
    for (const file of migrationFiles) {
      log(`Applying migration: ${file}`, 'migration');
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await pool.query(migrationSQL);
        log(`Successfully applied ${file}`, 'migration');
      } catch (error: any) {
        log(`Error executing ${file}: ${error.message}`, 'migration');
        
        // Add more detailed error reporting
        if (error.position) {
          const errorPos = parseInt(error.position);
          const startPos = Math.max(0, errorPos - 100);
          const endPos = Math.min(migrationSQL.length, errorPos + 100);
          const errorContext = migrationSQL.substring(startPos, endPos);
          
          log(`Error position: ${error.position}`, 'migration');
          log(`SQL context near error:`, 'migration');
          log(`...${errorContext}...`, 'migration');
          
          // Try to identify the specific line where the error occurred
          const lines = migrationSQL.substring(0, errorPos).split('\n');
          const lineNum = lines.length;
          const colNum = lines[lines.length - 1].length + 1;
          log(`Error at approximately line ${lineNum}, column ${colNum}`, 'migration');
        }
        
        throw error; // Re-throw to trigger rollback
      }
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    log('All migrations completed successfully', 'migration');
    return true;
  } catch (error: any) {
    // Rollback in case of error
    log(`Migration failed: ${error.message}`, 'migration');
    try {
      await pool.query('ROLLBACK');
      log('Transaction rolled back', 'migration');
    } catch (rollbackError: any) {
      log(`Error during rollback: ${rollbackError.message}`, 'migration');
    }
    return false;
  } finally {
    // Close the connection
    await pool.end();
    log('Database connection closed after migrations', 'migration');
  }
}