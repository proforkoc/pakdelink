import { db, isPostgresConfigured } from '../index.ts';
import { sales, saleItems, digitalFinancialTransactions, serviceSoftwareOrders, storeExpenses, products } from '../schema.ts';
import { eq } from 'drizzle-orm';
import { memoryStore } from '../memoryStore.ts';

export const INDONESIAN_MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export interface AnalyticsPeriodOptions {
  period?: 'today' | 'this_week' | 'this_month' | 'this_year' | 'monthly' | 'yearly' | 'custom' | 'all';
  month?: number;
  year?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
}

function extractDateStr(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
      return val.slice(0, 10);
    }
    const dmyMatch = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      const y = dmyMatch[3];
      return `${y}-${m}-${d}`;
    }
  }
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function matchesPeriod(dateVal: any, start: string | null, end: string | null): boolean {
  if (!start && !end) return true;
  if (!dateVal) return false;

  const dStr = extractDateStr(dateVal);
  if (!dStr) return false;

  // Single-day matching (Harian)
  if (start && end && start === end) {
    if (dStr === start) return true;
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const isoStr = d.toISOString().slice(0, 10);
      if (isoStr === start) return true;
    }
    return false;
  }

  if (start && dStr < start) return false;
  if (end && dStr > end) return false;
  return true;
}

export async function getFinancialSummary(
  periodOption: string = 'this_month',
  options: AnalyticsPeriodOptions = {}
) {
  try {
    const now = new Date();
    const todayStr = extractDateStr(now) || now.toISOString().slice(0, 10);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    let startFilter: string | null = null;
    let endFilter: string | null = null;
    let periodLabel = '';
    let activeMonth: number | undefined = undefined;
    let activeYear: number | undefined = undefined;

    // Tentukan parameter periode
    const normalizedPeriod = (periodOption || options.period || 'this_month').toLowerCase();

    if (
      normalizedPeriod === 'daily' ||
      normalizedPeriod === 'today' ||
      (options.date && normalizedPeriod !== 'monthly' && normalizedPeriod !== 'yearly' && normalizedPeriod !== 'all')
    ) {
      const targetDate = options.date ? (extractDateStr(options.date) || options.date) : todayStr;
      startFilter = targetDate;
      endFilter = targetDate;
      periodLabel = targetDate === todayStr ? `Hari Ini (${targetDate})` : `Harian (${targetDate})`;
      activeYear = parseInt(targetDate.slice(0, 4), 10);
      activeMonth = parseInt(targetDate.slice(5, 7), 10);
    } else if (normalizedPeriod === 'monthly' || normalizedPeriod === 'this_month' || (options.month && options.year)) {
      activeYear = options.year ? Number(options.year) : currentYear;
      activeMonth = options.month ? Number(options.month) : (normalizedPeriod === 'this_month' ? currentMonth : currentMonth);

      const mPad = String(activeMonth).padStart(2, '0');
      startFilter = `${activeYear}-${mPad}-01`;
      const lastDay = new Date(activeYear, activeMonth, 0).getDate();
      endFilter = `${activeYear}-${mPad}-${String(lastDay).padStart(2, '0')}`;
      periodLabel = `${INDONESIAN_MONTH_NAMES[activeMonth - 1] || 'Bulan'} ${activeYear}`;
    } else if (normalizedPeriod === 'yearly' || normalizedPeriod === 'this_year') {
      activeYear = options.year ? Number(options.year) : currentYear;
      startFilter = `${activeYear}-01-01`;
      endFilter = `${activeYear}-12-31`;
      periodLabel = `Tahun ${activeYear}`;
    } else if (normalizedPeriod === 'custom' || (options.startDate && options.endDate)) {
      startFilter = options.startDate || null;
      endFilter = options.endDate || null;
      periodLabel = `${startFilter || ''} s/d ${endFilter || ''}`;
    } else if (normalizedPeriod === 'all') {
      startFilter = null;
      endFilter = null;
      periodLabel = 'Semua Periode';
    } else {
      // Fallback: Bulan Berjalan
      activeYear = currentYear;
      activeMonth = currentMonth;
      const mPad = String(activeMonth).padStart(2, '0');
      startFilter = `${activeYear}-${mPad}-01`;
      const lastDay = new Date(activeYear, activeMonth, 0).getDate();
      endFilter = `${activeYear}-${mPad}-${String(lastDay).padStart(2, '0')}`;
      periodLabel = `${INDONESIAN_MONTH_NAMES[activeMonth - 1]} ${activeYear}`;
    }

    let allSales: any[] = [];
    let allItems: any[] = [];
    let allDigi: any[] = [];
    let allServices: any[] = [];
    let allExpenses: any[] = [];
    let allProds: any[] = [];

    if (!isPostgresConfigured()) {
      allSales = memoryStore.sales.filter((s) => s.status === 'completed');
      allItems = memoryStore.saleItems;
      allDigi = memoryStore.digitalTransactions.filter((d) => d.status === 'success');
      allServices = memoryStore.serviceOrders;
      allExpenses = memoryStore.expenses;
      allProds = memoryStore.products;
    } else {
      try {
        allSales = await db.select().from(sales).where(eq(sales.status, 'completed'));
        allItems = await db.select().from(saleItems);
        allDigi = await db.select().from(digitalFinancialTransactions).where(eq(digitalFinancialTransactions.status, 'success'));
        allServices = await db.select().from(serviceSoftwareOrders);
        allExpenses = await db.select().from(storeExpenses);
        allProds = await db.select().from(products);
      } catch (dbErr) {
        console.warn('DB query in analyticsService failed, using memory store:', dbErr);
        allSales = memoryStore.sales.filter((s) => s.status === 'completed');
        allItems = memoryStore.saleItems;
        allDigi = memoryStore.digitalTransactions.filter((d) => d.status === 'success');
        allServices = memoryStore.serviceOrders;
        allExpenses = memoryStore.expenses;
        allProds = memoryStore.products;
      }
    }

    // 1. Sales query (Header POS)
    const filteredSales = allSales.filter(s => matchesPeriod(s.createdAt, startFilter, endFilter));

    const salesOmset = filteredSales.reduce((acc, cur) => acc + cur.grandTotal, 0);
    const salesTotalCost = filteredSales.reduce((acc, cur) => acc + cur.totalCost, 0);
    const salesTotalProfit = filteredSales.reduce((acc, cur) => acc + cur.totalProfit, 0);

    // Rekapitulasi Metode Pembayaran (Cash, QRIS, Transfer)
    const paymentMethodBreakdown = {
      cash: { count: 0, total: 0 },
      qris: { count: 0, total: 0 },
      transfer: { count: 0, total: 0 },
    };

    for (const s of filteredSales) {
      const method = (s.paymentMethod || 'cash').toLowerCase();
      if (method.includes('qris')) {
        paymentMethodBreakdown.qris.count += 1;
        paymentMethodBreakdown.qris.total += Number(s.grandTotal || 0);
      } else if (method.includes('transfer')) {
        paymentMethodBreakdown.transfer.count += 1;
        paymentMethodBreakdown.transfer.total += Number(s.grandTotal || 0);
      } else {
        paymentMethodBreakdown.cash.count += 1;
        paymentMethodBreakdown.cash.total += Number(s.grandTotal || 0);
      }
    }

    // 2. Sale Items for breakdown between HP vs Aksesoris vs others
    const filteredSaleIds = new Set(filteredSales.map(s => s.id));
    const matchedItems = allItems.filter(item => item.saleId && filteredSaleIds.has(item.saleId));

    let marginHp = 0;
    let omsetHp = 0;
    let marginAksesoris = 0;
    let omsetAksesoris = 0;

    for (const item of matchedItems) {
      const cat = (item.productCategory || '').toLowerCase();
      if (cat.includes('smartphone') || cat.includes('hp') || item.imeiOrSerial) {
        marginHp += item.profit;
        omsetHp += item.subtotal;
      } else {
        marginAksesoris += item.profit;
        omsetAksesoris += item.subtotal;
      }
    }

    // 3. Digital Financial Transactions (BRILink, Transfer Bank, E-Wallet, PPOB)
    const filteredDigi = allDigi.filter(d => matchesPeriod(d.createdAt, startFilter, endFilter));

    let omsetDigi = 0;
    let profitBrilinkBank = 0;
    let volumeBrilinkBank = 0;
    let countBrilinkBank = 0;
    let profitTarikTunai = 0;
    let volumeTarikTunai = 0;
    let countTarikTunai = 0;
    let profitEwallet = 0;
    let volumeEwallet = 0;
    let countEwallet = 0;
    let profitPpobPulsa = 0;
    let volumePpobPulsa = 0;
    let countPpobPulsa = 0;

    let profitTfCard = 0;
    let volumeTfCard = 0;
    let countTfCard = 0;
    let profitTagihan = 0;
    let volumeTagihan = 0;
    let countTagihan = 0;

    for (const d of filteredDigi) {
      const type = (d.type || '').toLowerCase();
      const notes = (d.notes || '').toLowerCase();
      const prov = (d.provider || '').toLowerCase();
      const cust = (d.customerName || '').toLowerCase();
      const nominal = Number(d.nominal || 0);
      const storeFee = Number(d.adminStoreFee || 0);
      const paid = Number(d.totalCustomerPaid || (nominal + storeFee));
      const prof = Number(d.profit != null ? d.profit : storeFee);

      // Akumulasi SEMUA transaksi card ke total perputaran uang (omset bruto):
      omsetDigi += (paid > 0 ? paid : nominal + storeFee);
      const method = (d.paymentMethod || 'cash').toLowerCase();

      // Track payment method
      if (method.includes('qris')) {
        paymentMethodBreakdown.qris.count += 1;
        paymentMethodBreakdown.qris.total += (paid > 0 ? paid : nominal + storeFee);
      } else if (method.includes('transfer')) {
        paymentMethodBreakdown.transfer.count += 1;
        paymentMethodBreakdown.transfer.total += (paid > 0 ? paid : nominal + storeFee);
      } else {
        paymentMethodBreakdown.cash.count += 1;
        paymentMethodBreakdown.cash.total += (paid > 0 ? paid : nominal + storeFee);
      }

      // Deteksi mutasi internal transfer antar card (TF Card)
      const isTransferCard =
        type.includes('transfer_saldo') ||
        type.includes('pindah_dana') ||
        type.includes('mutasi') ||
        type === 'transfer_card' ||
        type === 'tf_card' ||
        notes.includes('transfer saldo') ||
        notes.includes('pindah dana') ||
        notes.includes('ambil saldo') ||
        notes.includes('tf card') ||
        notes.includes('antar card') ||
        prov.includes('➔') ||
        prov.includes('->') ||
        cust.includes('mutasi internal') ||
        cust.includes('transfer antar card');

      // Card Tagihan HANYA untuk mutasi / pencatatan manual internal card tagihan agen!
      const isTagihan =
        (d.targetAccount || '').toLowerCase().includes('card tagihan') ||
        (d.fundSource || '').toLowerCase().includes('tagihan') ||
        cust.includes('mutasi internal tagihan') ||
        notes.includes('pindah dana tagihan') ||
        prov.includes('➔ card tagihan') ||
        (type.includes('transfer_saldo') && (notes.includes('tagihan') || prov.includes('tagihan') || (d.targetAccount || '').toLowerCase().includes('tagihan')));

      if (isTransferCard && !isTagihan) {
        // TF Card (Transfer Antar Card)
        profitTfCard += prof;
        volumeTfCard += nominal;
        countTfCard += 1;
      } else if (isTagihan) {
        // Card Tagihan (mutasi internal card tagihan manual)
        profitTagihan += prof;
        volumeTagihan += nominal;
        countTagihan += 1;
      } else if (type.includes('tarik') || type.includes('cashout')) {
        profitTarikTunai += prof;
        volumeTarikTunai += nominal;
        countTarikTunai += 1;
      } else if (type.includes('ewallet') || type.includes('topup') || type.includes('wallet')) {
        profitEwallet += prof;
        volumeEwallet += nominal;
        countEwallet += 1;
      } else if (
        type.includes('ppob') ||
        type.includes('pulsa') ||
        type.includes('pln') ||
        type.includes('token') ||
        type.includes('bpjs') ||
        type.includes('pdam') ||
        type.includes('tagihan') ||
        type.includes('paket') ||
        type.includes('data') ||
        type.includes('game') ||
        type.includes('voucher') ||
        type.includes('lainnya')
      ) {
        // Rekap PPOB & Layanan Digital Lainnya (termasuk tagihan listrik, BPJS, PDAM pelanggan)
        profitPpobPulsa += prof;
        volumePpobPulsa += nominal;
        countPpobPulsa += 1;
      } else {
        // Murni Transfer Antar Bank & BRILink
        profitBrilinkBank += prof;
        volumeBrilinkBank += nominal;
        countBrilinkBank += 1;
      }
    }

    // 4. Software Service Orders (Legacy support)
    const filteredServices = allServices.filter(s => matchesPeriod(s.receivedAt, startFilter, endFilter));

    const finishedServices = filteredServices.filter(s => s.status === 'completed' || s.status === 'picked_up');
    const serviceOmset = finishedServices.reduce((acc, cur) => acc + cur.finalCost, 0);
    const serviceToolCost = finishedServices.reduce((acc, cur) => acc + cur.toolCost, 0);
    const serviceNetMargin = serviceOmset - serviceToolCost;

    // 5. Store Expenses
    const filteredExpenses = allExpenses.filter(e => matchesPeriod(e.expenseDate, startFilter, endFilter));

    const totalExpenses = filteredExpenses.reduce((acc, cur) => acc + cur.amount, 0);

    // Group expenses by category
    const expensesByCategory: Record<string, number> = {};
    for (const exp of filteredExpenses) {
      expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount;
    }

    // 6. Aggregate Totals (Mencakup seluruh pendapatan & fee semua divisi card)
    const digiTotalProfit =
      profitBrilinkBank +
      profitTarikTunai +
      profitEwallet +
      profitPpobPulsa +
      profitTfCard +
      profitTagihan;

    const totalGrossOmset = omsetDigi + salesOmset + serviceOmset;
    const totalGrossProfit = digiTotalProfit + salesTotalProfit + serviceNetMargin;
    const netProfit = totalGrossProfit - totalExpenses;

    // 7. Low stock products alert count
    const lowStockCount = allProds.filter(p => p.stock <= p.minStockAlert).length;
    const activeServiceCount = allServices.filter(s => s.status === 'received' || s.status === 'in_progress').length;

    // 8. Available Years (Kumpulan tahun yang tersedia dari data riwayat)
    const yearSet = new Set<number>();
    yearSet.add(currentYear);
    yearSet.add(currentYear - 1);
    yearSet.add(currentYear + 1);

    for (const s of allSales) {
      const d = extractDateStr(s.createdAt);
      if (d) yearSet.add(parseInt(d.slice(0, 4), 10));
    }
    for (const exp of allExpenses) {
      if (exp.expenseDate) yearSet.add(parseInt(exp.expenseDate.slice(0, 4), 10));
    }
    for (const dig of allDigi) {
      const d = extractDateStr(dig.createdAt);
      if (d) yearSet.add(parseInt(d.slice(0, 4), 10));
    }
    for (const srv of allServices) {
      const d = extractDateStr(srv.receivedAt);
      if (d) yearSet.add(parseInt(d.slice(0, 4), 10));
    }

    const availableYears = Array.from(yearSet).sort((a, b) => b - a);

    return {
      period: periodOption,
      selectedPeriodInfo: {
        label: periodLabel,
        startDate: startFilter,
        endDate: endFilter,
        month: activeMonth,
        year: activeYear,
      },
      availableYears,
      totalGrossOmset,
      totalGrossProfit,
      totalExpenses,
      netProfit,
      digitalBreakdown: {
        transferBank: { count: countBrilinkBank, volume: volumeBrilinkBank, profit: profitBrilinkBank },
        tarikTunai: { count: countTarikTunai, volume: volumeTarikTunai, profit: profitTarikTunai },
        ewallet: { count: countEwallet, volume: volumeEwallet, profit: profitEwallet },
        ppob: { count: countPpobPulsa, volume: volumePpobPulsa, profit: profitPpobPulsa },
      },
      summary: {
        salesOmset,
        salesTotalCost,
        salesTotalProfit,
        omsetDigi,
        digiTotalProfit,
        serviceOmset,
        serviceToolCost,
        serviceNetMargin,
      },
      pillarBreakdown: {
        hp: {
          omset: omsetHp,
          profit: marginHp,
        },
        aksesoris: {
          omset: omsetAksesoris,
          profit: marginAksesoris,
        },
        brilinkBank: {
          profit: profitBrilinkBank,
          volume: volumeBrilinkBank,
          count: countBrilinkBank,
        },
        tarikTunai: {
          profit: profitTarikTunai,
          volume: volumeTarikTunai,
          count: countTarikTunai,
        },
        ewallet: {
          profit: profitEwallet,
          volume: volumeEwallet,
          count: countEwallet,
        },
        ppobPulsa: {
          profit: profitPpobPulsa,
          volume: volumePpobPulsa,
          count: countPpobPulsa,
        },
        serviceSoftware: {
          omset: serviceOmset,
          toolCost: serviceToolCost,
          profit: serviceNetMargin,
        },
      },
      expensesByCategory,
      paymentMethodBreakdown,
      indicators: {
        transactionCount: filteredSales.length + filteredDigi.length + finishedServices.length,
        salesCount: filteredSales.length,
        digitalCount: filteredDigi.length,
        serviceCount: finishedServices.length,
        lowStockCount,
        activeServiceCount,
      },
    };
  } catch (error) {
    console.error('Failed to get financial summary:', error);
    throw new Error('Gagal mengagregasi ringkasan laba/rugi', { cause: error });
  }
}
