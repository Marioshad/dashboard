// Railway migration script (CommonJS version)
const pg = require('pg');
const fs = require('fs');
const path = require('path');

const { Pool } = pg;

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
  // Check multiple possible migration locations
  let migrationsDir;
  const possiblePaths = [
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '..', 'dist', 'migrations'),
    '/app/dist/migrations',
    '/app/server/migrations'
  ];
  
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath) && fs.readdirSync(possiblePath).some(file => file.endsWith('.sql'))) {
      migrationsDir = possiblePath;
      console.log(`Using migrations directory: ${migrationsDir}`);
      break;
    }
  }
  
  if (!migrationsDir) {
    console.error('Could not find migrations directory. Checked paths:');
    possiblePaths.forEach(p => console.error(`- ${p}`));
    process.exit(1);
  }
  
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure migrations run in order (001, 002, etc.)

  console.log('Running database migrations...');
  console.log(`Found ${migrationFiles.length} migration files: ${migrationFiles.join(', ')}`);
  console.log('Database URL:', dbUrl.split('@')[1]); // Log only the domain part of the URL for security

  try {
    // Test connection first
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

// Run the migration
runMigration();