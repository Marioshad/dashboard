// Helper script to run migrations in Node environment
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the database URL from the environment
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create a new PostgreSQL client
const pool = new Pool({
  connectionString: dbUrl,
  ssl: dbUrl.includes('localhost') ? false : { rejectUnauthorized: false } // Only use SSL for non-local connections
});

async function runMigration() {
  console.log('Starting migration process...');
  console.log('Database URL:', dbUrl.split('@')[1]); // Log only the domain part of the URL for security
  
  // Get all migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure migrations run in order (001, 002, etc.)

  console.log(`Found ${migrationFiles.length} migration files: ${migrationFiles.join(', ')}`);

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Execute each migration in order
    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await pool.query(migrationSQL);
        console.log(`Successfully applied ${file}`);
      } catch (error) {
        console.error(`Error executing ${file}:`, error.message);
        throw error; // Re-throw to trigger rollback
      }
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('All migrations completed successfully');
  } catch (error) {
    // Rollback in case of error
    console.error('Migration failed:', error.message);
    try {
      await pool.query('ROLLBACK');
      console.log('Transaction rolled back');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError.message);
    }
    process.exit(1);
  } finally {
    // Close the connection
    await pool.end();
    console.log('Database connection closed');
  }
}

runMigration();