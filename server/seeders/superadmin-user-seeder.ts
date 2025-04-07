import { db } from '../db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { appLogger as logger } from '../services/logger';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { storage } from '../storage';

const scryptAsync = promisify(scrypt);

/**
 * Generate a secure password hash using scrypt
 * @param password The plain text password to hash
 * @returns A hashed password string with salt
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

/**
 * Seeds the database with a Superadmin user
 * @param username Username for the superadmin
 * @param password Password for the superadmin
 * @param email Email for the superadmin
 */
export async function seedSuperadminUser(
  username: string,
  password: string,
  email: string
) {
  try {
    logger.info('Starting superadmin user seeder...');
    
    // Get the Superadmin role ID
    const superadminRole = await storage.getRoleByName('Superadmin');
    
    if (!superadminRole) {
      throw new Error('Superadmin role not found. Please run the admin-roles-seeder first.');
    }
    
    // Check if the user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    if (existingUser.length > 0) {
      logger.info(`Superadmin user ${username} already exists. Updating role...`);
      
      // Update the existing user to have the Superadmin role
      const [updatedUser] = await db
        .update(users)
        .set({
          roleId: superadminRole.id,
          updatedAt: sql`CURRENT_TIMESTAMP`,
          // Ensure email is verified
          emailVerified: true
        })
        .where(eq(users.username, username))
        .returning();
      
      logger.info(`User ${username} updated with Superadmin role (ID: ${superadminRole.id})`);
      return {
        userId: updatedUser.id,
        success: true,
        message: 'Existing user updated with Superadmin role'
      };
    } else {
      // Create a new superadmin user
      logger.info(`Creating new Superadmin user: ${username}`);
      
      const hashedPassword = await hashPassword(password);
      
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          roleId: superadminRole.id,
          fullName: 'System Administrator',
          currency: 'USD',
          emailVerified: true,
          subscriptionTier: 'family_pro_tier',
          subscriptionStatus: 'active',
          // Set unlimited usage limits for superadmin
          receiptScansLimit: 999999,
          maxItems: 999999,
          maxSharedUsers: 999999,
          createdAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .returning();
      
      logger.info(`Created new Superadmin user with ID: ${newUser.id}`);
      return {
        userId: newUser.id,
        success: true,
        message: 'New Superadmin user created successfully'
      };
    }
  } catch (error) {
    logger.error('Error in superadmin user seeder:', error);
    return {
      success: false,
      error
    };
  }
}