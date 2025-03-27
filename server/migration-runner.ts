import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { log } from './vite';

// Get the current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

/**
 * Run database migrations automatically
 * @returns Promise<boolean> True if migrations were successful
 */
export async function runMigrations(): Promise<boolean> {
  // Get the database URL from the environment
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    log('Error: DATABASE_URL environment variable is required for migrations', 'migration');
    return false;
  }

  // Create a new PostgreSQL client with appropriate SSL settings
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false } // Only use SSL for non-local
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