import { seedAdminRoles } from './admin-roles-seeder';
import { seedSuperadminUser } from './superadmin-user-seeder';
import { appLogger as logger } from '../services/logger';

/**
 * Runs all seeders in the correct order
 * @param options Configuration options for the seeders
 */
export async function runSeeders(options: {
  superadmin?: {
    username: string;
    password: string;
    email: string;
  };
}) {
  try {
    logger.info('Starting database seeders...');
    
    // 1. Seed roles and permissions first
    const rolesResult = await seedAdminRoles();
    if (!rolesResult.success) {
      throw new Error('Admin roles seeder failed');
    }
    
    // 2. Seed superadmin user if credentials provided
    if (options.superadmin) {
      const { username, password, email } = options.superadmin;
      const superadminResult = await seedSuperadminUser(username, password, email);
      if (!superadminResult.success) {
        throw new Error('Superadmin user seeder failed');
      }
    }
    
    logger.info('All seeders completed successfully!');
    return { success: true };
  } catch (error) {
    logger.error('Error running seeders:', error);
    return { success: false, error };
  }
}