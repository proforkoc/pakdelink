import { db, isPostgresConfigured } from '../index.ts';
import { storeExpenses } from '../schema.ts';
import { desc, eq, and, gte, lte } from 'drizzle-orm';
import { memoryStore, MemoryExpense } from '../memoryStore.ts';

export interface CreateExpensePayload {
  category: string;
  title: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  paidBy?: string;
  notes?: string;
}

export async function createExpense(payload: CreateExpensePayload) {
  if (!isPostgresConfigured()) {
    const newExp: MemoryExpense = {
      id: memoryStore.getNextId(),
      category: payload.category,
      title: payload.title,
      amount: payload.amount,
      expenseDate: payload.expenseDate,
      paidBy: payload.paidBy || 'cash',
      notes: payload.notes || null,
      createdAt: new Date(),
    };
    memoryStore.expenses.unshift(newExp);
    return newExp;
  }

  try {
    const [expense] = await db
      .insert(storeExpenses)
      .values({
        category: payload.category,
        title: payload.title,
        amount: payload.amount,
        expenseDate: payload.expenseDate,
        paidBy: payload.paidBy || 'cash',
        notes: payload.notes || null,
      })
      .returning();

    return expense;
  } catch (error) {
    console.warn('DB insert failed in createExpense, saving to memory store:', error);
    const newExp: MemoryExpense = {
      id: memoryStore.getNextId(),
      category: payload.category,
      title: payload.title,
      amount: payload.amount,
      expenseDate: payload.expenseDate,
      paidBy: payload.paidBy || 'cash',
      notes: payload.notes || null,
      createdAt: new Date(),
    };
    memoryStore.expenses.unshift(newExp);
    return newExp;
  }
}

export async function getExpenses(filter?: {
  startDate?: string;
  endDate?: string;
  category?: string;
}) {
  if (!isPostgresConfigured()) {
    let list = [...memoryStore.expenses];
    if (filter?.category && filter.category !== 'all') {
      list = list.filter((e) => e.category === filter.category);
    }
    if (filter?.startDate) {
      list = list.filter((e) => e.expenseDate >= filter.startDate!);
    }
    if (filter?.endDate) {
      list = list.filter((e) => e.expenseDate <= filter.endDate!);
    }
    return list;
  }

  try {
    const conditions = [];

    if (filter?.category && filter.category !== 'all') {
      conditions.push(eq(storeExpenses.category, filter.category));
    }
    if (filter?.startDate) {
      conditions.push(gte(storeExpenses.expenseDate, filter.startDate));
    }
    if (filter?.endDate) {
      conditions.push(lte(storeExpenses.expenseDate, filter.endDate));
    }

    const query = db
      .select()
      .from(storeExpenses)
      .orderBy(desc(storeExpenses.expenseDate), desc(storeExpenses.id));

    return conditions.length > 0 ? await query.where(and(...conditions)) : await query;
  } catch (error) {
    console.warn('DB query failed in getExpenses, returning memory expenses:', error);
    return [...memoryStore.expenses];
  }
}

export async function deleteExpense(id: number) {
  if (!isPostgresConfigured()) {
    const idx = memoryStore.expenses.findIndex((e) => e.id === id);
    if (idx !== -1) memoryStore.expenses.splice(idx, 1);
    return true;
  }

  try {
    await db.delete(storeExpenses).where(eq(storeExpenses.id, id));
    return true;
  } catch (error) {
    console.warn('DB delete failed in deleteExpense, removing from memory store:', error);
    const idx = memoryStore.expenses.findIndex((e) => e.id === id);
    if (idx !== -1) memoryStore.expenses.splice(idx, 1);
    return true;
  }
}
