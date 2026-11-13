import { db, isPostgresConfigured } from '../index.ts';
import { categories } from '../schema.ts';
import { asc } from 'drizzle-orm';
import { memoryStore } from '../memoryStore.ts';

export async function getAllCategories() {
  if (!isPostgresConfigured()) {
    return memoryStore.categories;
  }

  try {
    return await db.select().from(categories).orderBy(asc(categories.id));
  } catch (error) {
    console.warn('DB not reachable in getAllCategories, using memory categories:', error);
    return memoryStore.categories;
  }
}
