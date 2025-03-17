import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { QueryResult } from 'pg';
import { InferModel } from 'drizzle-orm';
import { permissions, roles, rolePermissions } from '@shared/schema';

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
async function testConnection() {
  let retries = 10;
  const retryDelay = 5000;

  while (retries) {
    try {
      const client = await pool.connect();

      const result = await client.query('SELECT NOW()');
      console.log('Database connection successful:', result.rows[0].now);

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
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          deleted_at TIMESTAMP WITH TIME ZONE
        );

        CREATE TABLE IF NOT EXISTS roles (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          deleted_at TIMESTAMP WITH TIME ZONE
        );

        CREATE TABLE IF NOT EXISTS permissions (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          deleted_at TIMESTAMP WITH TIME ZONE
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
            ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

            ALTER TABLE roles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
            ALTER TABLE permissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
          EXCEPTION WHEN others THEN
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

      await seedRolesAndPermissions();

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


async function seedRolesAndPermissions() {
  try {
    // Create initial permissions
    const defaultPermissions = [
      { name: 'manage_users', description: 'Create, update, and delete users' },
      { name: 'view_roles', description: 'View roles and their permissions' },
      { name: 'manage_roles', description: 'Create, update, and delete roles' },
      { name: 'manage_permissions', description: 'Assign and remove permissions from roles' },
      { name: 'view_dashboard', description: 'View the main dashboard' },
      { name: 'manage_profile', description: 'Update own profile information' }
    ];

    // Insert permissions
    const insertedPermissions = await db.insert(permissions)
      .values(defaultPermissions)
      .onConflictDoNothing()
      .returning();

    console.log('Seeded permissions:', insertedPermissions.length);

    // Create default roles
    const defaultRoles = [
      { name: 'Superadmin', description: 'Full system access' },
      { name: 'Admin', description: 'Administrative access with some restrictions' },
      { name: 'User', description: 'Basic user access' }
    ];

    // Insert roles
    const insertedRoles = await db.insert(roles)
      .values(defaultRoles)
      .onConflictDoNothing()
      .returning();

    console.log('Seeded roles:', insertedRoles.length);

    // Map permissions to roles
    if (insertedRoles.length > 0 && insertedPermissions.length > 0) {
      const superadminRole = insertedRoles.find(r => r.name === 'Superadmin');
      const adminRole = insertedRoles.find(r => r.name === 'Admin');
      const userRole = insertedRoles.find(r => r.name === 'User');

      // Prepare role-permission mappings
      const rolePermissionMappings = [];

      // Superadmin gets all permissions
      if (superadminRole) {
        insertedPermissions.forEach(permission => {
          rolePermissionMappings.push({
            roleId: superadminRole.id,
            permissionId: permission.id
          });
        });
      }

      // Admin gets all except manage_permissions
      if (adminRole) {
        insertedPermissions
          .filter(p => p.name !== 'manage_permissions')
          .forEach(permission => {
            rolePermissionMappings.push({
              roleId: adminRole.id,
              permissionId: permission.id
            });
          });
      }

      // User gets basic permissions
      if (userRole) {
        insertedPermissions
          .filter(p => ['view_dashboard', 'manage_profile'].includes(p.name))
          .forEach(permission => {
            rolePermissionMappings.push({
              roleId: userRole.id,
              permissionId: permission.id
            });
          });
      }

      // Insert role-permission mappings
      await db.insert(rolePermissions)
        .values(rolePermissionMappings)
        .onConflictDoNothing();

      console.log('Seeded role-permission mappings:', rolePermissionMappings.length);
    }

  } catch (error) {
    console.error('Error seeding roles and permissions:', error);
    throw error;
  }
}
export {testConnection};