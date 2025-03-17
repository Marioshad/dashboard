import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { QueryResult } from 'pg';
import { InferModel } from 'drizzle-orm';
import { permissions, roles, rolePermissions } from '@shared/schema';
import path from 'path';
import fs from 'fs';

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
      console.log('Database connection successful:', (await client.query('SELECT NOW()')).rows[0].now);

      // Execute initial migration
      const migrationPath = path.join(process.cwd(), 'server', 'migrations', '001_initial.sql');
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      await client.query(migrationSQL);
      console.log('Database tables verified');

      await seedRolesAndPermissions();

      client.release();
      return true;
    } catch (err) {
      console.error('Database connection/migration attempt failed:', err);
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