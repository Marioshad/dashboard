// Railway migration script
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
  ssl: { rejectUnauthorized: false } // Required for Railway
});

async function runMigration() {
  // Get all migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure migrations run in order (001, 002, etc.)

  console.log('Running database migrations...');
  console.log(`Found ${migrationFiles.length} migration files: ${migrationFiles.join(', ')}`);

  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Execute each migration in order
    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(migrationSQL);
    }
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('All migrations completed successfully');
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    // Close the connection
    await pool.end();
  }
}

runMigration();