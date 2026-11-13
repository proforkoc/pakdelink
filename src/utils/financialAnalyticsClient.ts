import { FinancialSummary } from '../types/index.ts';
import {
  getStoredSales,
  getStoredDigitalTransactions,
  getStoredServiceOrders,
  getStoredExpenses,
} from './transactionSync.ts';

const INDONESIAN_MONTH_NAMES = [
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

export interface ClientAnalyticsFilter {
  periodType: 'monthly' | 'daily' | 'yearly' | 'all';
  selectedMonth: number; // 1-12
  selectedYear: number;
  selectedDate: string; // YYYY-MM-DD
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

export function computeClientFinancialSummary(filter: ClientAnalyticsFilter): FinancialSummary {
  const now = new Date();
  const todayStr = extractDateStr(now) || now.toISOString().slice(0, 10);
  const currentYear = now.getFullYear();

  let startFilter: string | null = null;
  let endFilter: string | null = null;
  let periodLabel = '';
  let activeMonth: number | undefined = undefined;
  let activeYear: number | undefined = undefined;

  const { periodType, selectedMonth, selectedYear, selectedDate } = filter;

  if (periodType === 'daily') {
    const targetDate = selectedDate || todayStr;
    startFilter = targetDate;
    endFilter = targetDate;
    periodLabel = targetDate === todayStr ? `Hari Ini (${targetDate})` : `Harian (${targetDate})`;
    activeYear = parseInt(targetDate.slice(0, 4), 10);
    activeMonth = parseInt(targetDate.slice(5, 7), 10);
  } else if (periodType === 'monthly') {
    activeYear = selectedYear || currentYear;
    activeMonth = selectedMonth || now.getMonth() + 1;
    const mPad = String(activeMonth).padStart(2, '0');
    startFilter = `${activeYear}-${mPad}-01`;
    const lastDay = new Date(activeYear, activeMonth, 0).getDate();
    endFilter = `${activeYear}-${mPad}-${String(lastDay).padStart(2, '0')}`;
    periodLabel = `${INDONESIAN_MONTH_NAMES[activeMonth - 1] || 'Bulan'} ${activeYear}`;
  } else if (periodType === 'yearly') {
    activeYear = selectedYear || currentYear;
    startFilter = `${activeYear}-01-01`;
    endFilter = `${activeYear}-12-31`;
    periodLabel = `Tahun ${activeYear}`;
  } else {
    // all
    startFilter = null;
    endFilter = null;
    periodLabel = 'Semua Periode';
  }

  // 1. Ambil data transaksi dari localStorage / in-memory
  const allSales = getStoredSales();
  const allDigi = getStoredDigitalTransactions();
  const allServices = getStoredServiceOrders();
  const allExpenses = getStoredExpenses();

  // Filter Sales berdasarkan tanggal
  const filteredSales = allSales.filter((s) => matchesPeriod(s.createdAt, startFilter, endFilter));

  let salesOmset = 0;
  let salesTotalCost = 0;
  let salesTotalProfit = 0;

  let marginHp = 0;
  let omsetHp = 0;
  let marginAksesoris = 0;
  let omsetAksesoris = 0;

  const paymentMethodBreakdown = {
    cash: { count: 0, total: 0 },
    qris: { count: 0, total: 0 },
    transfer: { count: 0, total: 0 },
  };

  for (const s of filteredSales) {
    const grand = Number(s.grandTotal || 0);
    const cost = Number(s.totalCost || 0);
    let profit = Number(s.totalProfit || 0);

    salesOmset += grand;
    salesTotalCost += cost;

    // Rekap metode pembayaran
    const method = (s.paymentMethod || 'cash').toLowerCase();
    if (method.includes('qris')) {
      paymentMethodBreakdown.qris.count += 1;
      paymentMethodBreakdown.qris.total += grand;
    } else if (method.includes('transfer')) {
      paymentMethodBreakdown.transfer.count += 1;
      paymentMethodBreakdown.transfer.total += grand;
    } else {
      paymentMethodBreakdown.cash.count += 1;
      paymentMethodBreakdown.cash.total += grand;
    }

    // Breakdown item (HP vs Aksesoris)
    if (Array.isArray(s.items) && s.items.length > 0) {
      let saleItemProfitSum = 0;
      for (const item of s.items) {
        const itemQty = Number(item.quantity || 1);
        const itemSell = Number(item.sellingPrice || 0);
        const itemCost = Number(item.costPrice || 0);
        const itemSub = Number(item.subtotal || itemSell * itemQty);
        const itemProf = item.profit != null && item.profit > 0 ? Number(item.profit) : Math.max(0, itemSub - (itemCost * itemQty));
        saleItemProfitSum += itemProf;

        const cat = (item.productCategory || '').toLowerCase();
        if (cat.includes('smartphone') || cat.includes('hp') || item.imeiOrSerial) {
          marginHp += itemProf;
          omsetHp += itemSub;
        } else {
          marginAksesoris += itemProf;
          omsetAksesoris += itemSub;
        }
      }

      if (profit <= 0) {
        profit = saleItemProfitSum;
      }
    } else {
      // Jika tidak ada rincian item, masukkan ke aksesoris secara default
      marginAksesoris += profit;
      omsetAksesoris += grand;
    }

    salesTotalProfit += profit;
  }

  // 2. Agen Digital Keuangan (Transfer Bank, Tarik Tunai, E-Wallet, PPOB)
  const filteredDigi = allDigi.filter(
    (d) => d.status === 'success' && matchesPeriod(d.createdAt, startFilter, endFilter)
  );

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
    const t = (d.type || '').toLowerCase();
    const notes = (d.notes || '').toLowerCase();
    const prov = (d.provider || '').toLowerCase();
    const cust = (d.customerName || '').toLowerCase();
    const method = (d.paymentMethod || 'cash').toLowerCase();

    if (
      t.startsWith('titipan') ||
      notes.includes('[titipan]') ||
      method === 'titipan' ||
      t.startsWith('bank_admin') ||
      t.startsWith('bank_bunga') ||
      notes.includes('[potongan & bunga bank]') ||
      method === 'bank_mutation'
    ) {
      continue;
    }

    const nominal = Number(d.nominal || 0);
    const storeFee = Number(d.adminStoreFee || 0);
    const paid = Number(d.totalCustomerPaid || (nominal + storeFee));
    const prof = Number(d.profit != null ? d.profit : storeFee);

    // Akumulasi SEMUA transaksi card ke total perputaran uang (omset bruto):
    omsetDigi += (paid > 0 ? paid : nominal + storeFee);

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

    // Deteksi apakah ini transaksi Transfer Antar Card (TF Card / Mutasi Internal)
    const isTransferCard =
      t.includes('transfer_saldo') ||
      t.includes('pindah_dana') ||
      t.includes('mutasi') ||
      t === 'transfer_card' ||
      t === 'tf_card' ||
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
      (t.includes('transfer_saldo') && (notes.includes('tagihan') || prov.includes('tagihan') || (d.targetAccount || '').toLowerCase().includes('tagihan')));

    if (isTransferCard && !isTagihan) {
      // Rekap TF Card (Transfer Antar Card)
      profitTfCard += prof;
      volumeTfCard += nominal;
      countTfCard += 1;
    } else if (isTagihan) {
      // Rekap Card Tagihan (mutasi internal card tagihan manual)
      profitTagihan += prof;
      volumeTagihan += nominal;
      countTagihan += 1;
    } else if (t.includes('tarik') || t.includes('cashout')) {
      // Rekap Tarik Tunai
      profitTarikTunai += prof;
      volumeTarikTunai += nominal;
      countTarikTunai += 1;
    } else if (t.includes('ewallet') || t.includes('dana') || t.includes('gopay') || t.includes('ovo') || t.includes('shopeepay') || t.includes('linkaja')) {
      // Rekap E-Wallet
      profitEwallet += prof;
      volumeEwallet += nominal;
      countEwallet += 1;
    } else if (
      t.includes('ppob') ||
      t.includes('pulsa') ||
      t.includes('pln') ||
      t.includes('token') ||
      t.includes('bpjs') ||
      t.includes('pdam') ||
      t.includes('tagihan') ||
      t.includes('paket') ||
      t.includes('data') ||
      t.includes('game') ||
      t.includes('voucher') ||
      t.includes('lainnya')
    ) {
      // Rekap PPOB & Layanan Digital Lainnya (termasuk tagihan listrik, BPJS, PDAM pelanggan)
      profitPpobPulsa += prof;
      volumePpobPulsa += nominal;
      countPpobPulsa += 1;
    } else {
      // Murni Transfer Antar Bank & BRILink ke rekening eksternal
      profitBrilinkBank += prof;
      volumeBrilinkBank += nominal;
      countBrilinkBank += 1;
    }
  }

  // 3. Service Software (Legacy fallback)
  const filteredServices = allServices.filter((s) => matchesPeriod(s.receivedAt, startFilter, endFilter));
  const finishedServices = filteredServices.filter((s) => s.status === 'completed' || s.status === 'picked_up');

  const serviceOmset = finishedServices.reduce((acc, cur) => acc + Number(cur.finalCost || 0), 0);
  const serviceToolCost = finishedServices.reduce((acc, cur) => acc + Number(cur.toolCost || 0), 0);
  const serviceNetMargin = Math.max(0, serviceOmset - serviceToolCost);

  // 4. Beban Operasional Toko
  const filteredExpenses = allExpenses.filter((e) => matchesPeriod(e.expenseDate, startFilter, endFilter));
  const totalExpenses = filteredExpenses.reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
  const expensesByCategory: Record<string, number> = {};
  for (const exp of filteredExpenses) {
    const cat = exp.category || 'Operasional Lainnya';
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + Number(exp.amount || 0);
  }

  // 5. Total Agregasi & KPI Utama (Mencakup SELURUH divisi: Transfer Bank, Tarik Tunai, E-Wallet, PPOB, TF Card, hingga Tagihan)
  const digiTotalProfit =
    profitBrilinkBank +
    profitTarikTunai +
    profitEwallet +
    profitPpobPulsa +
    profitTfCard +
    profitTagihan;

  const totalGrossOmset = salesOmset + omsetDigi + serviceOmset;
  const totalGrossProfit = salesTotalProfit + digiTotalProfit + serviceNetMargin;
  const netProfit = totalGrossProfit - totalExpenses;

  // 6. Kumpulan Tahun yang Tersedia
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
    period: periodType,
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
      lowStockCount: 0,
      activeServiceCount: allServices.filter((s) => s.status === 'received' || s.status === 'in_progress').length,
    },
  };
}
