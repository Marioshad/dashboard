// server/seeders/locations-seeder.ts

import { db } from '../db';
import { locations, users } from '@shared/schema.ts'; // adjust this import path as needed
import { eq } from 'drizzle-orm';

/**
 * Seeds a default "Home" location for each user if they don't already have one.
 */
export async function seedLocations() {
  // Fetch all users
  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    const existing = await db
        .select()
        .from(locations)
        .where(eq(locations.user_id, user.id));

    if (existing.length === 0) {
      await db.insert(locations).values({
        name: 'Home',
        type: 'home',
        user_id: user.id,
      });
      console.log(`✅ Seeded default location for user ID ${user.id}`);
    } else {
      console.log(`ℹ️ User ID ${user.id} already has a location`);
    }
  }

  return { success: true };
}
