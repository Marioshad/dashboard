import { db } from '../db';
import { roles, permissions, rolePermissions } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { appLogger as logger } from '../services/logger';

/**
 * Seeds the database with Superadmin and Admin roles and their permissions
 */
export async function seedAdminRoles() {
  try {
    logger.info('Starting admin roles seeder...');
    
    // First check if the roles already exist
    const existingSuperadmin = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.name, 'Superadmin'),
        isNull(roles.deletedAt)
      ))
      .limit(1);
    
    const existingAdmin = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.name, 'Admin'),
        isNull(roles.deletedAt)
      ))
      .limit(1);
    
    // Get all permissions to assign to roles
    const allPermissions = await db.select().from(permissions);
    const permissionIds = allPermissions.map(p => p.id);
    
    // Create or update the Superadmin role
    let superadminRoleId = existingSuperadmin.length > 0 ? existingSuperadmin[0].id : null;
    if (!superadminRoleId) {
      logger.info('Creating Superadmin role...');
      const [superadminRole] = await db
        .insert(roles)
        .values({
          name: 'Superadmin',
          description: 'Full system access with all permissions',
          createdAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .returning();
      superadminRoleId = superadminRole.id;
    } else {
      logger.info(`Superadmin role already exists with ID: ${superadminRoleId}`);
    }
    
    // Create or update the Admin role
    let adminRoleId = existingAdmin.length > 0 ? existingAdmin[0].id : null;
    if (!adminRoleId) {
      logger.info('Creating Admin role...');
      const [adminRole] = await db
        .insert(roles)
        .values({
          name: 'Admin',
          description: 'Administrative access with some restrictions',
          createdAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .returning();
      adminRoleId = adminRole.id;
    } else {
      logger.info(`Admin role already exists with ID: ${adminRoleId}`);
    }
    
    // Clear existing permissions for these roles to prevent duplicates
    if (superadminRoleId) {
      logger.info(`Removing existing permissions for Superadmin role (ID: ${superadminRoleId})...`);
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, superadminRoleId));
    }
    
    if (adminRoleId) {
      logger.info(`Removing existing permissions for Admin role (ID: ${adminRoleId})...`);
      await db
        .delete(rolePermissions)
        .where(eq(rolePermissions.roleId, adminRoleId));
    }
    
    // Assign all permissions to Superadmin
    if (superadminRoleId) {
      logger.info(`Assigning all permissions to Superadmin role (ID: ${superadminRoleId})...`);
      await Promise.all(permissionIds.map(async (permissionId) => {
        await db
          .insert(rolePermissions)
          .values({
            roleId: superadminRoleId!,
            permissionId
          })
          .onConflictDoNothing();
      }));
    }
    
    // Assign specific permissions to Admin
    // Admins shouldn't be able to manage roles and permissions
    if (adminRoleId) {
      logger.info(`Assigning permissions to Admin role (ID: ${adminRoleId})...`);
      
      // Define permissions that admin should NOT have
      const restrictedPermissions = ['manage_roles', 'manage_permissions'];
      const restrictedPermissionIds = allPermissions
        .filter(p => restrictedPermissions.includes(p.name))
        .map(p => p.id);
      
      // Assign all permissions except the restricted ones
      const adminPermissionIds = permissionIds.filter(id => !restrictedPermissionIds.includes(id));
      
      await Promise.all(adminPermissionIds.map(async (permissionId) => {
        await db
          .insert(rolePermissions)
          .values({
            roleId: adminRoleId!,
            permissionId
          })
          .onConflictDoNothing();
      }));
    }
    
    logger.info('Admin roles seeder completed successfully!');
    return {
      superadminRoleId,
      adminRoleId,
      success: true
    };
  } catch (error) {
    logger.error('Error in admin roles seeder:', error);
    return {
      success: false,
      error
    };
  }
}