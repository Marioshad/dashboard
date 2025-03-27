// Script to run database migrations safely in production
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get the database URL from the environment
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Create a new PostgreSQL client
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false } // Required for some PostgreSQL providers like Railway
});

async function runMigration() {
  // Read the migration file
  const migrationPath = path.join(__dirname, 'migrations', '001_initial.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running database migration...');

  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('Migration completed successfully');
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