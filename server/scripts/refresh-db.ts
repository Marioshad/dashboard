// scripts/refresh-db.ts
import { db } from '../db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { appLogger as logger } from '../services/logger';

/**
 * Drops all tables and re-runs all migrations
 */
async function refreshDatabase() {
    try {
        logger.info('⚠️ Dropping all tables...');
        await db.execute(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        -- Drop all tables in the public schema
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

        logger.info('✅ Tables dropped. Re-running migrations...');
        await migrate(db, { migrationsFolder: 'drizzle' }); // adjust to your folder
        logger.info('✅ Migrations re-applied!');
    } catch (error) {
        logger.error('❌ Error refreshing database:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

refreshDatabase();
