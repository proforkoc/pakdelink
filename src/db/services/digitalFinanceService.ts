import { db, isPostgresConfigured } from '../index.ts';
import { digitalFinancialTransactions } from '../schema.ts';
import { desc, eq, and, or, ilike } from 'drizzle-orm';
import { memoryStore } from '../memoryStore.ts';

export interface DigitalTransactionPayload {
  type: string; // 'brilink_transfer' | 'brilink_tarik_tunai' | 'topup_ewallet' | 'ppob_pulsa' | 'ppob_token_pln' | 'ppob_tagihan'
  provider: string; // BRI, BCA, DANA, OVO, GOPAY, PLN, etc.
  targetAccount: string;
  customerName?: string;
  operatorName?: string;
  nominal: number;
  adminBankCost: number; // Modal biaya bank/aplikasi
  adminStoreFee: number; // Biaya admin jasa toko
  totalCustomerPaid?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  status?: string;
  notes?: string;
  cashierUid?: string;
}

function extractOperatorFromNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/\[Operator:\s*([^\]]+)\]/i);
  return match?.[1]?.trim() || undefined;
}

export async function createDigitalTransaction(payload: DigitalTransactionPayload) {
  try {
    const totalCustomerPaid =
      payload.totalCustomerPaid !== undefined
        ? payload.totalCustomerPaid
        : payload.nominal + payload.adminStoreFee;
    const profit = payload.adminStoreFee - payload.adminBankCost;
    const cleanOperator = payload.operatorName?.trim() || extractOperatorFromNotes(payload.notes) || undefined;

    let normalizedNotes = payload.notes || null;
    if (cleanOperator && (!normalizedNotes || !/\[Operator:\s*[^\]]+\]/i.test(normalizedNotes))) {
      normalizedNotes = normalizedNotes ? `${normalizedNotes} [Operator: ${cleanOperator}]` : `[Operator: ${cleanOperator}]`;
    }

    // Generate reference number if not provided
    const ref =
      payload.referenceNumber ||
      `${payload.provider.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    if (!isPostgresConfigured()) {
      const newRecord = {
        id: memoryStore.getNextId(),
        type: payload.type,
        provider: payload.provider.toUpperCase(),
        targetAccount: payload.targetAccount,
        customerName: payload.customerName || 'Pelanggan',
        nominal: payload.nominal,
        adminBankCost: payload.adminBankCost,
        adminStoreFee: payload.adminStoreFee,
        totalCustomerPaid,
        profit,
        paymentMethod: payload.paymentMethod || 'cash',
        referenceNumber: ref,
        status: payload.status || 'success',
        cashierUid: payload.cashierUid || null,
        operatorName: cleanOperator || null,
        notes: normalizedNotes,
        createdAt: new Date(),
      };
      memoryStore.digitalTransactions.unshift(newRecord);
      return newRecord;
    }

    try {
      const [record] = await db
        .insert(digitalFinancialTransactions)
        .values({
          type: payload.type,
          provider: payload.provider.toUpperCase(),
          targetAccount: payload.targetAccount,
          customerName: payload.customerName || 'Pelanggan',
          nominal: payload.nominal,
          adminBankCost: payload.adminBankCost,
          adminStoreFee: payload.adminStoreFee,
          totalCustomerPaid,
          profit,
          paymentMethod: payload.paymentMethod || 'cash',
          referenceNumber: ref,
          status: payload.status || 'success',
          cashierUid: payload.cashierUid || null,
          notes: normalizedNotes,
        })
        .returning();

      return {
        ...record,
        operatorName: cleanOperator || extractOperatorFromNotes(record.notes),
      };
    } catch {
      const fallbackRecord = {
        id: memoryStore.getNextId(),
        type: payload.type,
        provider: payload.provider.toUpperCase(),
        targetAccount: payload.targetAccount,
        customerName: payload.customerName || 'Pelanggan',
        nominal: payload.nominal,
        adminBankCost: payload.adminBankCost,
        adminStoreFee: payload.adminStoreFee,
        totalCustomerPaid,
        profit,
        paymentMethod: payload.paymentMethod || 'cash',
        referenceNumber: ref,
        status: payload.status || 'success',
        cashierUid: payload.cashierUid || null,
        operatorName: cleanOperator || null,
        notes: normalizedNotes,
        createdAt: new Date(),
      };
      memoryStore.digitalTransactions.unshift(fallbackRecord);
      return fallbackRecord;
    }
  } catch (error) {
    console.error('Failed to create digital financial transaction:', error);
    throw new Error('Gagal mencatat transaksi keuangan digital / keagenan', { cause: error });
  }
}

export async function getDigitalTransactions(filter?: {
  type?: string;
  provider?: string;
  search?: string;
  limit?: number | null;
}) {
  const effectiveLimit = filter?.limit === null ? null : (filter?.limit ?? 50);

  if (!isPostgresConfigured()) {
    let list = [...memoryStore.digitalTransactions];
    if (filter?.type) {
      list = list.filter((t) => t.type === filter.type);
    }
    if (filter?.provider) {
      list = list.filter((t) => t.provider.toUpperCase() === filter.provider!.toUpperCase());
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (t) =>
          (t.targetAccount || '').toLowerCase().includes(q) ||
          (t.customerName || '').toLowerCase().includes(q) ||
          (t.operatorName || '').toLowerCase().includes(q) ||
          (t.referenceNumber || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => b.id - a.id);
    const sliced = effectiveLimit === null ? list : list.slice(0, effectiveLimit);
    return sliced.map((t) => ({
      ...t,
      operatorName: t.operatorName || extractOperatorFromNotes(t.notes) || undefined,
    }));
  }

  try {
    const conditions = [];

    if (filter?.type) {
      conditions.push(eq(digitalFinancialTransactions.type, filter.type));
    }
    if (filter?.provider) {
      conditions.push(eq(digitalFinancialTransactions.provider, filter.provider.toUpperCase()));
    }
    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(
        or(
          ilike(digitalFinancialTransactions.targetAccount, q),
          ilike(digitalFinancialTransactions.customerName, q),
          ilike(digitalFinancialTransactions.referenceNumber, q),
          ilike(digitalFinancialTransactions.notes, q)
        )
      );
    }

    const baseQuery = db
      .select()
      .from(digitalFinancialTransactions)
      .orderBy(desc(digitalFinancialTransactions.id));

    const filteredQuery = conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    const rows = effectiveLimit === null ? await filteredQuery : await filteredQuery.limit(effectiveLimit);
    return rows.map((row) => ({
      ...row,
      operatorName: extractOperatorFromNotes(row.notes),
    }));
  } catch (error) {
    console.warn('DB query failed in getDigitalTransactions, returning memory list:', error);
    const list = [...memoryStore.digitalTransactions];
    list.sort((a, b) => b.id - a.id);
    const sliced = effectiveLimit === null ? list : list.slice(0, effectiveLimit);
    return sliced.map((t) => ({
      ...t,
      operatorName: t.operatorName || extractOperatorFromNotes(t.notes) || undefined,
    }));
  }
}

export async function getDigitalTransactionById(id: number) {
  if (typeof id !== 'number' || isNaN(id) || !Number.isInteger(id) || id <= 0 || id > 2147483647) {
    return null;
  }

  if (!isPostgresConfigured()) {
    return memoryStore.digitalTransactions.find((t) => t.id === id) || null;
  }

  try {
    const [record] = await db
      .select()
      .from(digitalFinancialTransactions)
      .where(eq(digitalFinancialTransactions.id, id));

    return record || null;
  } catch (error) {
    console.warn('DB query failed in getDigitalTransactionById, returning memory record:', error);
    return memoryStore.digitalTransactions.find((t) => t.id === id) || null;
  }
}

export async function deleteDigitalTransaction(id: number, referenceNumber?: string) {
  if (!isPostgresConfigured()) {
    const idx = memoryStore.digitalTransactions.findIndex(
      (t) => t.id === id || (referenceNumber && t.referenceNumber === referenceNumber)
    );
    if (idx !== -1) {
      const [deleted] = memoryStore.digitalTransactions.splice(idx, 1);
      return deleted;
    }
    return null;
  }

  try {
    const isIdValid = typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= 2147483647;
    let condition;
    if (referenceNumber && isIdValid) {
      condition = or(
        eq(digitalFinancialTransactions.id, id),
        eq(digitalFinancialTransactions.referenceNumber, referenceNumber)
      );
    } else if (referenceNumber) {
      condition = eq(digitalFinancialTransactions.referenceNumber, referenceNumber);
    } else if (isIdValid) {
      condition = eq(digitalFinancialTransactions.id, id);
    } else {
      return null;
    }

    const [deleted] = await db.delete(digitalFinancialTransactions).where(condition).returning();
    return deleted || null;
  } catch (error) {
    console.warn('DB query failed in deleteDigitalTransaction, deleting from memory store:', error);
    const idx = memoryStore.digitalTransactions.findIndex(
      (t) => t.id === id || (referenceNumber && t.referenceNumber === referenceNumber)
    );
    if (idx !== -1) {
      const [deleted] = memoryStore.digitalTransactions.splice(idx, 1);
      return deleted;
    }
    return null;
  }
}

export async function updateDigitalTransactionPayment(params: {
  id?: number;
  referenceNumber?: string;
  paymentMethod?: string;
  status?: string;
  notes?: string | null;
  paidAt?: string;
}) {
  const { id, referenceNumber, paymentMethod, status, notes, paidAt } = params;

  if (!isPostgresConfigured()) {
    const idx = memoryStore.digitalTransactions.findIndex(
      (t) =>
        (id && t.id === id) ||
        (referenceNumber && t.referenceNumber === referenceNumber)
    );
    if (idx !== -1) {
      const updated = {
        ...memoryStore.digitalTransactions[idx],
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(paidAt !== undefined ? { paidAt } : {}),
      };
      memoryStore.digitalTransactions[idx] = updated;
      return updated;
    }
    return null;
  }

  try {
    const isIdValid = typeof id === 'number' && Number.isInteger(id) && id > 0 && id <= 2147483647;
    let condition;
    if (referenceNumber && isIdValid) {
      condition = or(
        eq(digitalFinancialTransactions.id, id),
        eq(digitalFinancialTransactions.referenceNumber, referenceNumber)
      );
    } else if (referenceNumber) {
      condition = eq(digitalFinancialTransactions.referenceNumber, referenceNumber);
    } else if (isIdValid) {
      condition = eq(digitalFinancialTransactions.id, id);
    } else {
      return null;
    }

    const updateValues: Record<string, any> = {};
    if (paymentMethod !== undefined) updateValues.paymentMethod = paymentMethod;
    if (status !== undefined) updateValues.status = status;
    if (notes !== undefined) updateValues.notes = notes;

    const [updated] = await db
      .update(digitalFinancialTransactions)
      .set(updateValues)
      .where(condition)
      .returning();

    if (!updated) return null;
    return {
      ...updated,
      operatorName: extractOperatorFromNotes(updated.notes),
      ...(paidAt !== undefined ? { paidAt } : {}),
    };
  } catch (error) {
    console.warn('DB update failed in updateDigitalTransactionPayment, updating memory store:', error);
    const idx = memoryStore.digitalTransactions.findIndex(
      (t) =>
        (id && t.id === id) ||
        (referenceNumber && t.referenceNumber === referenceNumber)
    );
    if (idx !== -1) {
      const updated = {
        ...memoryStore.digitalTransactions[idx],
        ...(paymentMethod !== undefined ? { paymentMethod } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(paidAt !== undefined ? { paidAt } : {}),
      };
      memoryStore.digitalTransactions[idx] = updated;
      return updated;
    }
    return null;
  }
}

