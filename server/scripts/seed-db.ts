// server/scripts/seed-db.ts
import { runSeeders } from '../seeders';
import { appLogger as logger } from '../services/logger';

async function seedDatabase() {
    try {
        logger.info('🌱 Running seeders...');

        const result = await runSeeders({
            superadmin: {
                username: 'superadmin',
                password: 'changeme123',
                email: 'superadmin@foodvault.local',
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
