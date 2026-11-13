import { db, isPostgresConfigured } from '../index.ts';
import { sales, saleItems, products, productSerials } from '../schema.ts';
import { eq, desc, or } from 'drizzle-orm';
import { memoryStore, MemorySale, MemorySaleItem } from '../memoryStore.ts';

export interface CheckoutCartItem {
  productId?: any;
  productName: string;
  productCategory: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  isImeiTracked?: boolean;
  selectedSerialId?: any;
  imeiOrSerial?: string;
}

export interface CheckoutPayload {
  customerName?: string;
  customerPhone?: string;
  items: CheckoutCartItem[];
  discount?: number;
  paymentMethod: string; // 'cash' | 'qris' | 'transfer'
  amountPaid: number;
  cashierUid?: string;
  notes?: string;
}

export async function processCheckout(payload: CheckoutPayload) {
  let subtotal = 0;
  let totalCost = 0;

  for (const item of payload.items) {
    subtotal += item.sellingPrice * item.quantity;
    totalCost += item.costPrice * item.quantity;
  }

  const discount = payload.discount ?? 0;
  const grandTotal = Math.max(0, subtotal - discount);
  const totalProfit = grandTotal - totalCost;
  const amountPaid = payload.amountPaid;
  const changeAmount = Math.max(0, amountPaid - grandTotal);

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

  if (!isPostgresConfigured()) {
    const saleId = memoryStore.getNextId();
    const insertedItems: MemorySaleItem[] = [];

    for (const item of payload.items) {
      const itemSubtotal = item.sellingPrice * item.quantity;
      const itemProfit = (item.sellingPrice - item.costPrice) * item.quantity;
      const sItem: MemorySaleItem = {
        id: memoryStore.getNextId(),
        saleId,
        productId: item.productId || null,
        productName: item.productName,
        productCategory: item.productCategory,
        quantity: item.quantity,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        subtotal: itemSubtotal,
        profit: itemProfit,
        imeiOrSerial: item.imeiOrSerial || null,
        productSerialId: item.selectedSerialId || null,
      };
      insertedItems.push(sItem);
      memoryStore.saleItems.push(sItem);

      if (item.productId) {
        const prod = memoryStore.products.find((p) => p.id === item.productId);
        if (prod) prod.stock = Math.max(0, prod.stock - item.quantity);
      }
    }

    const newSale: MemorySale = {
      id: saleId,
      invoiceNumber,
      customerName: payload.customerName || 'Pelanggan Umum',
      customerPhone: payload.customerPhone || null,
      subtotal,
      discount,
      grandTotal,
      totalCost,
      totalProfit,
      paymentMethod: payload.paymentMethod || 'cash',
      amountPaid,
      changeAmount,
      cashierUid: payload.cashierUid || null,
      status: 'completed',
      notes: payload.notes || null,
      createdAt: new Date(),
      items: insertedItems,
    };
    memoryStore.sales.unshift(newSale);
    return newSale;
  }

  try {
    return await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(sales)
        .values({
          invoiceNumber,
          customerName: payload.customerName || 'Pelanggan Umum',
          customerPhone: payload.customerPhone || null,
          subtotal,
          discount,
          grandTotal,
          totalCost,
          totalProfit,
          paymentMethod: payload.paymentMethod || 'cash',
          amountPaid,
          changeAmount,
          cashierUid: payload.cashierUid || null,
          status: 'completed',
          notes: payload.notes || null,
        })
        .returning();

      const insertedItems = [];

      for (const item of payload.items) {
        const itemSubtotal = item.sellingPrice * item.quantity;
        const itemProfit = (item.sellingPrice - item.costPrice) * item.quantity;

        const rawProdId = Number(item.productId);
        const validProductId =
          !isNaN(rawProdId) && Number.isInteger(rawProdId) && rawProdId > 0 && rawProdId <= 2147483647
            ? rawProdId
            : null;

        const rawSerialId = Number(item.selectedSerialId);
        const validSerialId =
          !isNaN(rawSerialId) && Number.isInteger(rawSerialId) && rawSerialId > 0 && rawSerialId <= 2147483647
            ? rawSerialId
            : null;

        const [saleItem] = await tx
          .insert(saleItems)
          .values({
            saleId: sale.id,
            productId: validProductId,
            productName: item.productName,
            productCategory: item.productCategory,
            quantity: item.quantity,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            subtotal: itemSubtotal,
            profit: itemProfit,
            imeiOrSerial: item.imeiOrSerial || null,
            productSerialId: validSerialId,
          })
          .returning();

        insertedItems.push(saleItem);

        if (validProductId) {
          const [prod] = await tx
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, validProductId));

          if (prod) {
            const newStock = Math.max(0, prod.stock - item.quantity);
            await tx
              .update(products)
              .set({ stock: newStock })
              .where(eq(products.id, validProductId));
          }
        }

        if (validSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: 'sold',
              saleId: sale.id,
              soldAt: new Date(),
            })
            .where(eq(productSerials.id, validSerialId));
        }
      }

      return {
        ...sale,
        items: insertedItems,
      };
    });
  } catch (error) {
    console.warn('POS Checkout DB transaction failed, fallback to memory store:', error);
    const saleId = memoryStore.getNextId();
    const insertedItems: MemorySaleItem[] = [];

    for (const item of payload.items) {
      const itemSubtotal = item.sellingPrice * item.quantity;
      const itemProfit = (item.sellingPrice - item.costPrice) * item.quantity;
      const sItem: MemorySaleItem = {
        id: memoryStore.getNextId(),
        saleId,
        productId: item.productId || null,
        productName: item.productName,
        productCategory: item.productCategory,
        quantity: item.quantity,
        costPrice: item.costPrice,
        sellingPrice: item.sellingPrice,
        subtotal: itemSubtotal,
        profit: itemProfit,
        imeiOrSerial: item.imeiOrSerial || null,
        productSerialId: item.selectedSerialId || null,
      };
      insertedItems.push(sItem);
      memoryStore.saleItems.push(sItem);
    }

    const newSale: MemorySale = {
      id: saleId,
      invoiceNumber,
      customerName: payload.customerName || 'Pelanggan Umum',
      customerPhone: payload.customerPhone || null,
      subtotal,
      discount,
      grandTotal,
      totalCost,
      totalProfit,
      paymentMethod: payload.paymentMethod || 'cash',
      amountPaid,
      changeAmount,
      cashierUid: payload.cashierUid || null,
      status: 'completed',
      notes: payload.notes || null,
      createdAt: new Date(),
      items: insertedItems,
    };
    memoryStore.sales.unshift(newSale);
    return newSale;
  }
}

export async function getSalesHistory(limit = 50) {
  if (!isPostgresConfigured()) {
    return [...memoryStore.sales].slice(0, limit);
  }

  try {
    const list = await db
      .select()
      .from(sales)
      .orderBy(desc(sales.id))
      .limit(limit);

    return list;
  } catch (error) {
    console.warn('DB query failed in getSalesHistory, returning memory sales:', error);
    return [...memoryStore.sales].slice(0, limit);
  }
}

export async function getSaleWithItems(saleId: number) {
  if (typeof saleId !== 'number' || isNaN(saleId) || !Number.isInteger(saleId) || saleId <= 0 || saleId > 2147483647) {
    return null;
  }

  if (!isPostgresConfigured()) {
    const sale = memoryStore.sales.find((s) => s.id === saleId);
    if (!sale) return null;
    const items = memoryStore.saleItems.filter((i) => i.saleId === saleId);
    return {
      ...sale,
      items,
    };
  }

  try {
    const [sale] = await db
      .select()
      .from(sales)
      .where(eq(sales.id, saleId));

    if (!sale) return null;

    const items = await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId));

    return {
      ...sale,
      items,
    };
  } catch (error) {
    console.warn('DB query failed in getSaleWithItems, using memory store:', error);
    const sale = memoryStore.sales.find((s) => s.id === saleId);
    if (!sale) return null;
    const items = memoryStore.saleItems.filter((i) => i.saleId === saleId);
    return {
      ...sale,
      items,
    };
  }
}

export async function deleteSale(saleId: number, invoiceNumber?: string) {
  if (!isPostgresConfigured()) {
    const idx = memoryStore.sales.findIndex(
      (s) => s.id === saleId || (invoiceNumber && s.invoiceNumber === invoiceNumber)
    );
    if (idx !== -1) {
      const [deleted] = memoryStore.sales.splice(idx, 1);
      memoryStore.saleItems = memoryStore.saleItems.filter((i) => i.saleId !== deleted.id);
      return { success: true, restoredItems: [] };
    }
    return { success: true, restoredItems: [] };
  }

  try {
    return await db.transaction(async (tx) => {
      const isValidSaleId = typeof saleId === 'number' && Number.isInteger(saleId) && saleId > 0 && saleId <= 2147483647;
      let targetSaleId: number | null = isValidSaleId ? saleId : null;
      if (invoiceNumber) {
        const queryConditions = [eq(sales.invoiceNumber, invoiceNumber)];
        if (targetSaleId !== null) {
          queryConditions.push(eq(sales.id, targetSaleId));
        }
        const [found] = await tx
          .select({ id: sales.id })
          .from(sales)
          .where(or(...queryConditions));
        if (found) targetSaleId = found.id;
      }

      if (!targetSaleId) {
        return { success: true, restoredItems: [] };
      }

      const items = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, targetSaleId));

      for (const item of items) {
        let prodId = item.productId;
        if (!prodId && item.productName) {
          const [byName] = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.name, item.productName))
            .limit(1);
          if (byName) prodId = byName.id;
        }

        if (prodId) {
          const [prod] = await tx
            .select({ stock: products.stock })
            .from(products)
            .where(eq(products.id, prodId));

          if (prod) {
            await tx
              .update(products)
              .set({ stock: prod.stock + item.quantity })
              .where(eq(products.id, prodId));
          }
        }

        if (item.productSerialId) {
          await tx
            .update(productSerials)
            .set({
              status: 'available',
              saleId: null,
              soldAt: null,
            })
            .where(eq(productSerials.id, item.productSerialId));
        }
      }

      await tx.delete(saleItems).where(eq(saleItems.saleId, targetSaleId));
      await tx.delete(sales).where(eq(sales.id, targetSaleId));

      return {
        success: true,
        restoredItems: items.map((i) => i.productName),
      };
    });
  } catch (error) {
    console.warn('DB deleteSale failed, removing from memory store:', error);
    const idx = memoryStore.sales.findIndex(
      (s) => s.id === saleId || (invoiceNumber && s.invoiceNumber === invoiceNumber)
    );
    if (idx !== -1) {
      const [deleted] = memoryStore.sales.splice(idx, 1);
      memoryStore.saleItems = memoryStore.saleItems.filter((i) => i.saleId !== deleted.id);
    }
    return { success: true, restoredItems: [] };
  }
}
