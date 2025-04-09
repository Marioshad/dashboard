import path from 'path';
import fs from 'fs/promises';
import { db } from '../db';
import { appLogger as logger } from '../services/logger';

/**
 * Executes raw SQL from .sql migration files in order.
 */
async function runSqlMigrations(migrationsDir: string) {
    const fullPath = path.resolve(migrationsDir);
    const files = (await fs.readdir(fullPath))
        .filter(file => file.endsWith('.sql'))
        .sort(); // Ensures files run in correct order

    for (const file of files) {
        const filePath = path.join(fullPath, file);
        const sql = await fs.readFile(filePath, 'utf8');

        try {
            await db.execute(sql);
            logger.info(`✅ Ran migration: ${file}`);
        } catch (error) {
            logger.error(`❌ Error in migration ${file}:`, error);
            throw error;
        }
    }
}

/**
 * Drops all tables and re-runs all migrations.
 */
async function refreshDatabase() {
    try {
        logger.info('⚠️ Dropping all tables...');
        await db.execute(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema()) LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

        logger.info('✅ Tables dropped. Running .sql migrations...');
        await runSqlMigrations('server/migrations'); // adjust path if needed
        logger.info('✅ All migrations applied!');
    } catch (error) {
        logger.error('❌ Error refreshing database:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

refreshDatabase();
