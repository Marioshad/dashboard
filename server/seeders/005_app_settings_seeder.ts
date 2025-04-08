// server/seeders/app-settings-seeder.ts

import { db } from '../db';
import { appSettings } from '@shared/schema.ts';
import { eq } from 'drizzle-orm';

/**
 * Seeds default application settings into the appSettings table if not already set.
 */
export async function seedAppSettings() {
  const existing = await db.select().from(appSettings).limit(1);

  if (existing.length === 0) {
    await db.insert(appSettings).values({
      require2FA: false,
    });
    console.log('✅ Seeded app settings (require_2fa = false)');
  } else {
    console.log('ℹ️ App settings already exist, skipping seeding');
  }

  return { success: true };
}
