import dotenv from 'dotenv';
import { runSeeders } from './seeders';
import { appLogger as logger } from './services/logger';
import { testDatabaseConnection } from './db';
import { Command } from 'commander';

// Load environment variables
dotenv.config();

const program = new Command();

program
    .name('run-seeders')
    .description('Run seeders to populate the database with initial data')
    .option('--superadmin-username <username>', 'Username for the superadmin')
    .option('--superadmin-password <password>', 'Password for the superadmin')
    .option('--superadmin-email <email>', 'Email for the superadmin')
    .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    logger.info('Testing database connection...');
    await testDatabaseConnection();

    const superadminOptions =
        options.superadminUsername && options.superadminPassword && options.superadminEmail
            ? {
              username: options.superadminUsername,
              password: options.superadminPassword,
              email: options.superadminEmail,
            }
            : process.env.SUPERADMIN_USERNAME &&
            process.env.SUPERADMIN_PASSWORD &&
            process.env.SUPERADMIN_EMAIL
                ? {
                  username: process.env.SUPERADMIN_USERNAME,
                  password: process.env.SUPERADMIN_PASSWORD,
                  email: process.env.SUPERADMIN_EMAIL,
                }
                : undefined;

    const result = await runSeeders({ superadmin: superadminOptions });

    if (result.success) {
      logger.info('Seeders execution completed successfully!');
      process.exit(0);
    } else {
      logger.error('Seeders execution failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Error running seeders:', error);
    process.exit(1);
  }
}

main();
