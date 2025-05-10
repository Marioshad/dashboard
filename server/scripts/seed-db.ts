import { runSeeders } from '../seeders';
import { appLogger as logger } from '../services/logger';
import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

async function seedDatabase() {
    try {
        logger.info('🌱 Running seeders...');

        const { SUPERADMIN_USERNAME, SUPERADMIN_PASSWORD, SUPERADMIN_EMAIL } = process.env;

        if (!SUPERADMIN_USERNAME || !SUPERADMIN_PASSWORD || !SUPERADMIN_EMAIL) {
            throw new Error('Missing SUPERADMIN credentials in .env');
        }

        const result = await runSeeders({
            superadmin: {
                username: SUPERADMIN_USERNAME,
                password: SUPERADMIN_PASSWORD,
                email: SUPERADMIN_EMAIL,
            },
        });

        if (!result.success) {
            throw result.error || new Error('Unknown seeder error');
        }

        logger.info('✅ Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
