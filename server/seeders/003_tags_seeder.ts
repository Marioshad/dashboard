// server/seeders/tags-seeder.ts

import { db } from '../db';
import { tags } from '@shared/schema.ts'; // adjust this import path as needed
import { eq, and } from 'drizzle-orm';

/**
 * Seeds system-level tags into the tags table if they don't already exist.
 */
export async function seedTags() {
  const defaultTags = [
    { name: 'Vegetables', color: '#4CAF50', is_system: true },
    { name: 'Fruits', color: '#FF9800', is_system: true },
    { name: 'Dairy', color: '#2196F3', is_system: true },
    { name: 'Meat', color: '#F44336', is_system: true },
    { name: 'Seafood', color: '#03A9F4', is_system: true },
    { name: 'Bakery', color: '#FFC107', is_system: true },
    { name: 'Canned Goods', color: '#607D8B', is_system: true },
    { name: 'Frozen Foods', color: '#9C27B0', is_system: true },
    { name: 'Beverages', color: '#795548', is_system: true },
    { name: 'Snacks', color: '#E91E63', is_system: true },
    { name: 'Cleaning', color: '#009688', is_system: true },
    { name: 'Personal Care', color: '#673AB7', is_system: true },
    { name: 'Organic', color: '#8BC34A', is_system: true },
    { name: 'Gluten-Free', color: '#CDDC39', is_system: true },
  ];

  for (const tag of defaultTags) {
    const existing = await db
        .select()
        .from(tags)
        .where(and(eq(tags.name, tag.name), eq(tags.is_system, true)));

    if (existing.length === 0) {
      await db.insert(tags).values(tag);
      console.log(`✅ Seeded tag: ${tag.name}`);
    } else {
      console.log(`ℹ️ Tag already exists: ${tag.name}`);
    }
  }

  return { success: true };
}
