import { seedRolesPermissionsAndSuperadminUser } from './001_roles-seeder.ts';
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

    // Seed roles, permissions, and optionally the superadmin user
    const rolesResult = await seedRolesPermissionsAndSuperadminUser(options.superadmin);
    if (!rolesResult.success) {
      throw new Error('Roles & superadmin seeder failed');
    }

    logger.info('All seeders completed successfully!');
    return { success: true };
  } catch (error) {
    logger.error('Error running seeders:', error);
    return { success: false, error };
  }
}
