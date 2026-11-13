import { db, isPostgresConfigured } from '../index.ts';
import { products, productSerials, categories } from '../schema.ts';
import { eq, and, ilike, or, desc } from 'drizzle-orm';
import { memoryStore, MemoryProduct, MemoryProductSerial } from '../memoryStore.ts';

export interface ProductFilter {
  categoryId?: number;
  search?: string;
  lowStockOnly?: boolean;
}

export const MAX_PG_INT = 2147483647;

export function isValidPgIntegerId(id: unknown): id is number {
  if (typeof id !== 'number' || isNaN(id) || !Number.isInteger(id)) {
    return false;
  }
  return id > 0 && id <= MAX_PG_INT;
}

export async function getProducts(filter?: ProductFilter) {
  if (!isPostgresConfigured()) {
    let list = [...memoryStore.products];
    if (filter?.categoryId) {
      list = list.filter((p) => p.categoryId === filter.categoryId);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.code || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.model || '').toLowerCase().includes(q)
      );
    }
    if (filter?.lowStockOnly) {
      list = list.filter((p) => p.stock <= p.minStockAlert);
    }
    return list.map((p) => {
      const cat = memoryStore.categories.find((c) => c.id === p.categoryId);
      return {
        ...p,
        categoryName: cat?.name || null,
        categoryCode: cat?.code || null,
      };
    });
  }

  try {
    const conditions = [];

    if (filter?.categoryId) {
      conditions.push(eq(products.categoryId, filter.categoryId));
    }

    if (filter?.search) {
      const q = `%${filter.search}%`;
      conditions.push(
        or(
          ilike(products.name, q),
          ilike(products.code, q),
          ilike(products.brand, q),
          ilike(products.model, q)
        )
      );
    }

    const query = db
      .select({
        id: products.id,
        categoryId: products.categoryId,
        categoryName: categories.name,
        categoryCode: categories.code,
        code: products.code,
        name: products.name,
        brand: products.brand,
        model: products.model,
        variant: products.variant,
        costPrice: products.costPrice,
        sellingPrice: products.sellingPrice,
        stock: products.stock,
        minStockAlert: products.minStockAlert,
        isImeiTracked: products.isImeiTracked,
        unit: products.unit,
        createdAt: products.createdAt,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .orderBy(desc(products.id));

    let result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    if (filter?.lowStockOnly) {
      result = result.filter(p => p.stock <= p.minStockAlert);
    }

    return result;
  } catch (error) {
    console.warn('DB query failed in getProducts, using memory store:', error);
    return [...memoryStore.products];
  }
}

export async function getProductById(id: number) {
  if (!isValidPgIntegerId(id)) {
    return null;
  }
  if (!isPostgresConfigured()) {
    return memoryStore.products.find((p) => p.id === id) || null;
  }

  try {
    const list = await db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);

    return list[0] || null;
  } catch (error) {
    console.warn('DB query failed in getProductById, using memory store:', error);
    return memoryStore.products.find((p) => p.id === id) || null;
  }
}

export async function getAvailableSerials(productId: number) {
  if (!isValidPgIntegerId(productId)) {
    return [];
  }
  if (!isPostgresConfigured()) {
    return memoryStore.productSerials.filter(
      (s) => s.productId === productId && s.status === 'available'
    );
  }

  try {
    return await db
      .select()
      .from(productSerials)
      .where(
        and(
          eq(productSerials.productId, productId),
          eq(productSerials.status, 'available')
        )
      );
  } catch (error) {
    console.warn('DB query failed in getAvailableSerials, using memory store:', error);
    return memoryStore.productSerials.filter(
      (s) => s.productId === productId && s.status === 'available'
    );
  }
}

export async function getAllSerialsForProduct(productId: number) {
  if (!isValidPgIntegerId(productId)) {
    return [];
  }
  if (!isPostgresConfigured()) {
    return memoryStore.productSerials.filter((s) => s.productId === productId);
  }

  try {
    return await db
      .select()
      .from(productSerials)
      .where(eq(productSerials.productId, productId))
      .orderBy(desc(productSerials.id));
  } catch (error) {
    console.warn('DB query failed in getAllSerialsForProduct, using memory store:', error);
    return memoryStore.productSerials.filter((s) => s.productId === productId);
  }
}

export async function createProduct(data: {
  categoryId: number;
  code: string;
  name: string;
  brand?: string;
  model?: string;
  variant?: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockAlert?: number;
  isImeiTracked?: boolean;
  unit?: string;
  initialImeis?: Array<{
    imei1: string;
    imei2?: string;
    serialNumber?: string;
    color?: string;
    ramStorage?: string;
    purchasePrice?: number;
    notes?: string;
  }>;
}) {
  const stockCount = data.isImeiTracked && data.initialImeis ? data.initialImeis.length : data.stock;

  if (!isPostgresConfigured()) {
    const newProd: MemoryProduct = {
      id: memoryStore.getNextId(),
      categoryId: data.categoryId,
      code: data.code,
      name: data.name,
      brand: data.brand || null,
      model: data.model || null,
      variant: data.variant || null,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      stock: stockCount,
      minStockAlert: data.minStockAlert ?? 3,
      isImeiTracked: Boolean(data.isImeiTracked),
      unit: data.unit || 'pcs',
      createdAt: new Date(),
    };
    memoryStore.products.unshift(newProd);

    if (data.isImeiTracked && data.initialImeis) {
      for (const imei of data.initialImeis) {
        if (imei.imei1) {
          memoryStore.productSerials.push({
            id: memoryStore.getNextId(),
            productId: newProd.id,
            imei1: imei.imei1,
            imei2: imei.imei2 || null,
            serialNumber: imei.serialNumber || null,
            color: imei.color || null,
            ramStorage: imei.ramStorage || null,
            purchasePrice: imei.purchasePrice ?? data.costPrice,
            status: 'available',
            notes: imei.notes || null,
            createdAt: new Date(),
          });
        }
      }
    }

    return newProd;
  }

  try {
    return await db.transaction(async (tx) => {
      const [newProduct] = await tx
        .insert(products)
        .values({
          categoryId: data.categoryId,
          code: data.code,
          name: data.name,
          brand: data.brand || null,
          model: data.model || null,
          variant: data.variant || null,
          costPrice: data.costPrice,
          sellingPrice: data.sellingPrice,
          stock: stockCount,
          minStockAlert: data.minStockAlert ?? 3,
          isImeiTracked: Boolean(data.isImeiTracked),
          unit: data.unit || 'pcs',
        })
        .returning();

      if (data.isImeiTracked && data.initialImeis && data.initialImeis.length > 0) {
        for (const imei of data.initialImeis) {
          if (imei.imei1) {
            await tx.insert(productSerials).values({
              productId: newProduct.id,
              imei1: imei.imei1,
              imei2: imei.imei2 || null,
              serialNumber: imei.serialNumber || null,
              color: imei.color || null,
              ramStorage: imei.ramStorage || null,
              purchasePrice: imei.purchasePrice ?? data.costPrice,
              status: 'available',
              notes: imei.notes || null,
            });
          }
        }
      }

      return newProduct;
    });
  } catch (error) {
    console.warn('DB insert failed in createProduct, saving to memory store:', error);
    const newProd: MemoryProduct = {
      id: memoryStore.getNextId(),
      categoryId: data.categoryId,
      code: data.code,
      name: data.name,
      brand: data.brand || null,
      model: data.model || null,
      variant: data.variant || null,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      stock: stockCount,
      minStockAlert: data.minStockAlert ?? 3,
      isImeiTracked: Boolean(data.isImeiTracked),
      unit: data.unit || 'pcs',
      createdAt: new Date(),
    };
    memoryStore.products.unshift(newProd);
    return newProd;
  }
}

export async function addImeiToProduct(productId: number, data: {
  imei1: string;
  imei2?: string;
  serialNumber?: string;
  color?: string;
  ramStorage?: string;
  purchasePrice?: number;
  notes?: string;
}) {
  if (!isValidPgIntegerId(productId)) {
    throw new Error('ID produk tidak valid untuk PostgreSQL');
  }

  if (!isPostgresConfigured()) {
    const prod = memoryStore.products.find((p) => p.id === productId);
    if (!prod) throw new Error('Produk tidak ditemukan');

    const newSerial: MemoryProductSerial = {
      id: memoryStore.getNextId(),
      productId,
      imei1: data.imei1,
      imei2: data.imei2 || null,
      serialNumber: data.serialNumber || null,
      color: data.color || null,
      ramStorage: data.ramStorage || null,
      purchasePrice: data.purchasePrice ?? prod.costPrice,
      status: 'available',
      notes: data.notes || null,
      createdAt: new Date(),
    };
    memoryStore.productSerials.push(newSerial);
    prod.stock += 1;
    return newSerial;
  }

  try {
    return await db.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(eq(products.id, productId));
      if (!product) throw new Error('Produk tidak ditemukan');

      const [newSerial] = await tx
        .insert(productSerials)
        .values({
          productId,
          imei1: data.imei1,
          imei2: data.imei2 || null,
          serialNumber: data.serialNumber || null,
          color: data.color || null,
          ramStorage: data.ramStorage || null,
          purchasePrice: data.purchasePrice ?? product.costPrice,
          status: 'available',
          notes: data.notes || null,
        })
        .returning();

      await tx
        .update(products)
        .set({ stock: product.stock + 1 })
        .where(eq(products.id, productId));

      return newSerial;
    });
  } catch (error) {
    console.error('Failed to add IMEI to product in DB, saving to memory:', error);
    const prod = memoryStore.products.find((p) => p.id === productId);
    const newSerial: MemoryProductSerial = {
      id: memoryStore.getNextId(),
      productId,
      imei1: data.imei1,
      imei2: data.imei2 || null,
      serialNumber: data.serialNumber || null,
      color: data.color || null,
      ramStorage: data.ramStorage || null,
      purchasePrice: data.purchasePrice ?? 0,
      status: 'available',
      notes: data.notes || null,
      createdAt: new Date(),
    };
    memoryStore.productSerials.push(newSerial);
    if (prod) prod.stock += 1;
    return newSerial;
  }
}

export async function updateProduct(id: number, data: Partial<{
  categoryId: number;
  code: string;
  name: string;
  brand: string;
  model: string;
  variant: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockAlert: number;
  isImeiTracked: boolean;
  unit: string;
}>) {
  if (!isValidPgIntegerId(id)) {
    return null;
  }

  if (!isPostgresConfigured()) {
    const prod = memoryStore.products.find((p) => p.id === id);
    if (prod) {
      Object.assign(prod, data);
    }
    return prod || null;
  }

  try {
    const [updated] = await db
      .update(products)
      .set(data)
      .where(eq(products.id, id))
      .returning();
    return updated;
  } catch (error) {
    console.warn('DB update failed in updateProduct, updating memory:', error);
    const prod = memoryStore.products.find((p) => p.id === id);
    if (prod) Object.assign(prod, data);
    return prod || null;
  }
}

export async function deleteProduct(id: number) {
  if (!isValidPgIntegerId(id)) {
    return false;
  }

  if (!isPostgresConfigured()) {
    const idx = memoryStore.products.findIndex((p) => p.id === id);
    if (idx !== -1) {
      memoryStore.products.splice(idx, 1);
      memoryStore.productSerials = memoryStore.productSerials.filter((s) => s.productId !== id);
    }
    return true;
  }

  try {
    await db.delete(products).where(eq(products.id, id));
    return true;
  } catch (error) {
    console.warn('DB delete failed in deleteProduct, removing from memory:', error);
    const idx = memoryStore.products.findIndex((p) => p.id === id);
    if (idx !== -1) {
      memoryStore.products.splice(idx, 1);
    }
    return true;
  }
}
