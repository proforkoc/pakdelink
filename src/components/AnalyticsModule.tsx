import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  TrendingUp,
  DollarSign,
  CreditCard,
  Receipt,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Banknote,
  RefreshCw,
  CheckCircle2,
  ArrowRightLeft,
  Wallet,
  Zap,
  Eye,
  Search,
  X,
  Copy,
  Check,
  FileText,
  Clock,
  User,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { FinancialSummary, DigitalTransaction, StoreExpense } from '../types/index.ts';
import {
  onDataUpdated,
  onTransactionDeleted,
  getStoredDigitalTransactions,
  saveStoredDigitalTransactions,
  getStoredExpenses,
  saveStoredExpenses,
} from '../utils/transactionSync.ts';
import {
  getStoredAccountBalances,
  saveStoredAccountBalances,
  getStoredTagihanNote,
  saveStoredTagihanNote,
  onAccountBalancesUpdated,
} from '../services/accountBalanceService.ts';
import {
  subscribeDigitalTransactionsCloud,
  subscribeAccountBalancesCloud,
  subscribeExpensesCloud,
  mergeDigitalTransactions,
  normalizeDigitalTransaction,
} from '../services/cloudDigitalFinanceService.ts';
import { computeClientFinancialSummary } from '../utils/financialAnalyticsClient.ts';
import {
  useBodyScrollLock,
  handleBackdropTouchMove,
  handleBackdropWheel,
  handleModalCardScroll,
} from '../utils/scrollLock.ts';
import { FinancialTrendChart } from './FinancialTrendChart.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { exportFinancialReport } from '../utils/financialReportExporter.ts';

export type DigitalDivisionKey = 'transfer_bank' | 'tarik_tunai' | 'ewallet' | 'ppob';

export const DIVISION_CONFIG: Record<
  DigitalDivisionKey,
  {
    title: string;
    shortTitle: string;
    subtitle: string;
    badge: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeClass: string;
    buttonClass: string;
    cardBorder: string;
    hoverBg: string;
  }
> = {
  transfer_bank: {
    title: 'Transfer Antar Bank & BRILink',
    shortTitle: 'Transfer Bank',
    subtitle: 'Sesama & antar bank seluruh Indonesia (BRI, BCA, Mandiri, BNI, dll)',
    badge: 'Transfer Bank',
    icon: ArrowRightLeft,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    buttonClass: 'bg-blue-100/80 hover:bg-blue-200 active:bg-blue-300 text-blue-800 border border-blue-200/80',
    cardBorder: 'border-blue-200 hover:border-blue-400',
    hoverBg: 'hover:bg-blue-50/40',
  },
  tarik_tunai: {
    title: 'Tarik Tunai Agen',
    shortTitle: 'Tarik Tunai',
    subtitle: 'Pencairan uang tunai di konter & QRIS Tarik Tunai',
    badge: 'Tarik Tunai',
    icon: Banknote,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    buttonClass: 'bg-emerald-100/80 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-800 border border-emerald-200/80',
    cardBorder: 'border-emerald-200 hover:border-emerald-400',
    hoverBg: 'hover:bg-emerald-50/40',
  },
  ewallet: {
    title: 'Top Up E-Wallet',
    shortTitle: 'Top Up E-Wallet',
    subtitle: 'DANA, OVO, GoPay, ShopeePay, LinkAja, Maxim & AstraPay',
    badge: 'Top Up E-Wallet',
    icon: Wallet,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    buttonClass: 'bg-purple-100/80 hover:bg-purple-200 active:bg-purple-300 text-purple-800 border border-purple-200/80',
    cardBorder: 'border-purple-200 hover:border-purple-400',
    hoverBg: 'hover:bg-purple-50/40',
  },
  ppob: {
    title: 'PPOB',
    shortTitle: 'PPOB',
    subtitle: 'Pulsa, paket data, token PLN, tagihan BPJS, PDAM & transaksi digital lainnya',
    badge: 'PPOB',
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    buttonClass: 'bg-amber-100/80 hover:bg-amber-200 active:bg-amber-300 text-amber-800 border border-amber-200/80',
    cardBorder: 'border-amber-200 hover:border-amber-400',
    hoverBg: 'hover:bg-amber-50/40',
  },
};

function extractDateStrHelper(val: any): string | null {
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

function matchesPeriodHelper(dateVal: any, start: string | null, end: string | null): boolean {
  if (!start && !end) return true;
  if (!dateVal) return false;

  const dStr = extractDateStrHelper(dateVal);
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

// Helper deteksi mutasi / transaksi Transfer Antar Card (TF Card)
export function isTransferCardTransaction(tx: {
  type?: string;
  notes?: string;
  provider?: string;
  customerName?: string;
  targetAccount?: string;
}): boolean {
  const typeStr = (tx.type || '').toLowerCase();
  const notesStr = (tx.notes || '').toLowerCase();
  const providerStr = (tx.provider || '').toLowerCase();
  const customerStr = (tx.customerName || '').toLowerCase();

  return (
    typeStr.includes('transfer_saldo') ||
    typeStr.includes('pindah_dana') ||
    typeStr.includes('mutasi') ||
    typeStr === 'transfer_card' ||
    typeStr === 'tf_card' ||
    notesStr.includes('transfer saldo') ||
    notesStr.includes('pindah dana') ||
    notesStr.includes('ambil saldo') ||
    notesStr.includes('tf card') ||
    notesStr.includes('antar card') ||
    providerStr.includes('➔') ||
    providerStr.includes('->') ||
    customerStr.includes('mutasi internal') ||
    customerStr.includes('transfer antar card')
  );
}

// Helper deteksi transaksi khusus Card Tagihan internal input manual
export function isTagihanTransaction(tx: {
  type?: string;
  notes?: string;
  provider?: string;
  customerName?: string;
  targetAccount?: string;
  fundSource?: string;
}): boolean {
  const prov = (tx.provider || '').toLowerCase();
  const target = (tx.targetAccount || '').toLowerCase();
  const cust = (tx.customerName || '').toLowerCase();
  const notes = (tx.notes || '').toLowerCase();
  const type = (tx.type || '').toLowerCase();
  const fundSource = (tx.fundSource || '').toLowerCase();

  return (
    target.includes('card tagihan') ||
    fundSource.includes('tagihan') ||
    cust.includes('mutasi internal tagihan') ||
    notes.includes('pindah dana tagihan') ||
    prov.includes('➔ card tagihan') ||
    (type.includes('transfer_saldo') && (notes.includes('tagihan') || prov.includes('tagihan') || target.includes('tagihan')))
  );
}

function matchesDivisionHelper(tx: DigitalTransaction, divKey: DigitalDivisionKey): boolean {
  const type = (tx.type || '').toLowerCase();
  const provider = (tx.provider || '').toLowerCase();

  // 1. MUTLAK: Transaksi Transfer Antar Card (TF Card), Card Tagihan internal, Transaksi Titipan, dan Potongan/Bunga Bank dipisahkan bersih dari semua divisi layanan utama!
  if (
    isTransferCardTransaction(tx) ||
    isTagihanTransaction(tx) ||
    type.startsWith('titipan') ||
    (tx.notes || '').toLowerCase().includes('[titipan]') ||
    type.startsWith('bank_admin') ||
    type.startsWith('bank_bunga') ||
    (tx.notes || '').toLowerCase().includes('[potongan & bunga bank]')
  ) {
    return false;
  }

  if (divKey === 'tarik_tunai') {
    return type.includes('tarik') || type.includes('cashout');
  }

  if (divKey === 'ewallet') {
    const isEwalletType = type.includes('ewallet') || type.includes('topup') || type.includes('wallet');
    const isEwalletProvider = [
      'dana',
      'gopay',
      'ovo',
      'shopeepay',
      'linkaja',
      'maxim',
      'grab',
      'astrapay',
      'isaku',
    ].some((p) => provider.includes(p));
    return (isEwalletType || isEwalletProvider) && !type.includes('tarik');
  }

  if (divKey === 'ppob') {
    // Semua transaksi PPOB dan Lainnya: Pulsa, paket data, token PLN, tagihan listrik/air/BPJS pelanggan, voucher, game, dan layanan non-transfer/non-tarik/non-ewallet lainnya
    const isTarik = type.includes('tarik') || type.includes('cashout');
    const isEwallet =
      type.includes('ewallet') ||
      type.includes('topup') ||
      ['dana', 'gopay', 'ovo', 'shopeepay', 'linkaja', 'maxim', 'grab', 'astrapay', 'isaku'].some((p) => provider.includes(p));
    const isTransferBank =
      type.includes('transfer') ||
      ['bri', 'bca', 'mandiri', 'bni', 'bsi', 'cimb', 'permata', 'seabank', 'jago', 'bjb'].some((p) => provider.includes(p));

    if (
      type.includes('ppob') ||
      type.includes('pulsa') ||
      type.includes('pln') ||
      type.includes('token') ||
      type.includes('bpjs') ||
      type.includes('pdam') ||
      type.includes('paket') ||
      type.includes('data') ||
      type.includes('game') ||
      type.includes('voucher') ||
      type.includes('tagihan') ||
      type.includes('lainnya')
    ) {
      return true;
    }

    return !isTarik && !isEwallet && !isTransferBank;
  }

  if (divKey === 'transfer_bank') {
    const isTarik = type.includes('tarik') || type.includes('cashout');
    const isEwallet =
      type.includes('ewallet') ||
      type.includes('topup') ||
      ['dana', 'gopay', 'ovo', 'shopeepay', 'linkaja', 'maxim', 'grab', 'astrapay', 'isaku'].some((p) => provider.includes(p));
    const isPpob =
      type.includes('ppob') ||
      type.includes('pulsa') ||
      type.includes('pln') ||
      type.includes('token') ||
      type.includes('bpjs') ||
      type.includes('pdam') ||
      type.includes('paket') ||
      type.includes('data') ||
      type.includes('game') ||
      type.includes('voucher');

    return !isTarik && !isEwallet && !isPpob;
  }

  return true;
}

const INDONESIAN_MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
];

export const AnalyticsModule: React.FC = () => {
  const { activeStaff, operatorName, currentRole } = useAuth();

  const getLocalDateStr = (d: Date = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const todayDateStr = getLocalDateStr(now);

  // Filter States: Default diatur ke 'daily' (Harian) sesuai preferensi pengguna
  const [periodType, setPeriodType] = useState<'monthly' | 'daily' | 'yearly' | 'all'>('daily');
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [availableYears, setAvailableYears] = useState<number[]>([
    currentYear + 1,
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
  ]);

  const [data, setData] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Division Detail Drill-down Modal State
  const [selectedDivisionModal, setSelectedDivisionModal] = useState<DigitalDivisionKey | null>(null);
  const [divisionSearchQuery, setDivisionSearchQuery] = useState('');
  const [allDigitalTransactions, setAllDigitalTransactions] = useState<DigitalTransaction[]>([]);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  // Operational Detail Drill-down Modal State (TF Card, Card Tagihan, Beban Toko)
  const [selectedOperationalModal, setSelectedOperationalModal] = useState<'tf_card' | 'tagihan' | 'beban_toko' | null>(null);
  const [operationalSearchQuery, setOperationalSearchQuery] = useState('');
  const [allExpensesList, setAllExpensesList] = useState<StoreExpense[]>(() => getStoredExpenses());

  // Download Report Modal State (PDF / CSV Formal Statement)
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [downloadStartDate, setDownloadStartDate] = useState<string>(todayDateStr);
  const [downloadEndDate, setDownloadEndDate] = useState<string>(todayDateStr);
  const [downloadFormat, setDownloadFormat] = useState<'pdf' | 'csv'>('pdf');

  useBodyScrollLock(
    selectedDivisionModal !== null ||
      selectedOperationalModal !== null ||
      isDownloadModalOpen
  );

  const copyToClipboard = (text: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedRef(text);
      setTimeout(() => setCopiedRef(null), 2000);
    }
  };

  const formatRupiah = (val: number) => {
    const num = Math.round(Number(val) || 0);
    const abs = Math.abs(num).toLocaleString('id-ID');
    return num < 0 ? `-Rp ${abs}` : `Rp ${abs}`;
  };

  const loadDigitalTransactions = async () => {
    const stored = getStoredDigitalTransactions();
    try {
      const res = await fetch('/api/digital-finance?limit=all');
      if (res.ok) {
        const serverData = await res.json();
        if (Array.isArray(serverData) && serverData.length > 0) {
          const normalizedServer = serverData.map((d: DigitalTransaction) =>
            normalizeDigitalTransaction(d)
          );
          const merged = mergeDigitalTransactions(stored, normalizedServer);
          setAllDigitalTransactions(merged);
          saveStoredDigitalTransactions(merged, true);
          return;
        }
      }
    } catch {
      // fallback
    }
    setAllDigitalTransactions(mergeDigitalTransactions(stored));
  };

  const loadExpensesData = async () => {
    try {
      const res = await fetch('/api/expenses').catch(() => null);
      if (res && res.ok) {
        const serverExpenses = await res.json();
        if (Array.isArray(serverExpenses)) {
          const stored = getStoredExpenses();
          const map = new Map<number, StoreExpense>();
          for (const item of [...stored, ...serverExpenses]) {
            map.set(item.id, item);
          }
          setAllExpensesList(Array.from(map.values()));
          return;
        }
      }
    } catch {
      // fallback
    }
    setAllExpensesList(getStoredExpenses());
  };

  const loadSummary = async () => {
    setLoading(true);
    try {
      let serverSummary: FinancialSummary | null = null;
      try {
        let url = `/api/analytics/summary?period=${periodType}`;
        if (periodType === 'monthly') {
          url += `&month=${selectedMonth}&year=${selectedYear}`;
        } else if (periodType === 'yearly') {
          url += `&year=${selectedYear}`;
        } else if (periodType === 'daily') {
          url += `&date=${selectedDate}`;
        }

        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          if (json && typeof json.totalGrossOmset === 'number') {
            serverSummary = json;
          }
        }
      } catch {
        // Fallback ke penghitungan client-side
      }

      // Hitung agregasi data di sisi client dari localStorage / transaksi digital
      const clientSummary = computeClientFinancialSummary({
        periodType,
        selectedMonth,
        selectedYear,
        selectedDate,
      });

      const finalSummary =
        serverSummary && serverSummary.indicators.transactionCount >= clientSummary.indicators.transactionCount
          ? serverSummary
          : clientSummary;

      setData(finalSummary);

      if (finalSummary.availableYears && Array.isArray(finalSummary.availableYears)) {
        const yearsList = finalSummary.availableYears;
        setAvailableYears((prev) => {
          const merged = Array.from(new Set([...prev, ...yearsList])).sort((a, b) => b - a);
          return merged;
        });
      }
    } catch (err) {
      console.error('Failed to load financial summary:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadSummary();
    loadDigitalTransactions();
    loadExpensesData();

    const unsubCloudTx = subscribeDigitalTransactionsCloud((cloudTxs, hasDocs) => {
      if (hasDocs) {
        setAllDigitalTransactions(cloudTxs);
        saveStoredDigitalTransactions(cloudTxs, true);
        loadSummary();
      }
    });

    const unsubCloudBalances = subscribeAccountBalancesCloud((cloudBalances, cloudNote, exists) => {
      if (exists && cloudBalances) {
        saveStoredAccountBalances(cloudBalances, false);
        if (cloudNote !== undefined) {
          saveStoredTagihanNote(cloudNote, false);
        }
      }
    });

    const unsubCloudExpenses = subscribeExpensesCloud((cloudExpenses, hasDocs) => {
      if (hasDocs) {
        saveStoredExpenses(cloudExpenses);
        setAllExpensesList(cloudExpenses);
        loadSummary();
      }
    });

    const unsubUpdate = onDataUpdated(() => {
      loadSummary();
      loadDigitalTransactions();
      loadExpensesData();
    });
    const unsubDelete = onTransactionDeleted(() => {
      loadSummary();
      loadDigitalTransactions();
      loadExpensesData();
    });
    const unsubBalances = onAccountBalancesUpdated(() => {
      loadSummary();
      loadDigitalTransactions();
      loadExpensesData();
    });

    return () => {
      unsubCloudTx();
      unsubCloudBalances();
      unsubCloudExpenses();
      unsubUpdate();
      unsubDelete();
      unsubBalances();
    };
  }, [periodType, selectedMonth, selectedYear, selectedDate]);

  // Label text for active period
  const getActivePeriodLabel = () => {
    if (periodType === 'monthly') {
      const monthObj = INDONESIAN_MONTHS.find((m) => m.value === selectedMonth);
      return `${monthObj ? monthObj.label : 'Bulan'} ${selectedYear}`;
    }
    if (periodType === 'yearly') {
      return `Tahun ${selectedYear}`;
    }
    if (periodType === 'daily') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
        const [y, m, d] = selectedDate.split('-');
        const monthObj = INDONESIAN_MONTHS.find((im) => im.value === parseInt(m, 10));
        return `${parseInt(d, 10)} ${monthObj ? monthObj.label : m} ${y}`;
      }
      return `Tanggal ${selectedDate}`;
    }
    return 'Semua Periode Riwayat';
  };

  const activePeriodLabel = getActivePeriodLabel();

  const handleOpenDownloadModal = () => {
    const range = getActivePeriodRange();
    if (range.start && range.end) {
      setDownloadStartDate(range.start);
      setDownloadEndDate(range.end);
    } else {
      // Untuk mode "Semua", ambil tanggal transaksi paling awal hingga hari ini
      let earliest = todayDateStr;
      for (const tx of allDigitalTransactions) {
        if (!tx.createdAt) continue;
        const d = new Date(tx.createdAt);
        if (!isNaN(d.getTime())) {
          const ymd = getLocalDateStr(d);
          if (ymd < earliest) earliest = ymd;
        }
      }
      setDownloadStartDate(earliest);
      setDownloadEndDate(todayDateStr);
    }
    setIsDownloadModalOpen(true);
  };

  const matchedDownloadTxCount = React.useMemo(() => {
    if (!downloadStartDate || !downloadEndDate) return 0;
    const start = downloadStartDate <= downloadEndDate ? downloadStartDate : downloadEndDate;
    const end = downloadStartDate <= downloadEndDate ? downloadEndDate : downloadStartDate;
    return allDigitalTransactions.filter((tx) => matchesPeriodHelper(tx.createdAt, start, end)).length;
  }, [allDigitalTransactions, downloadStartDate, downloadEndDate]);

  const handleConfirmDownloadReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadStartDate || !downloadEndDate) return;

    const roleLabelMap: Record<string, string> = {
      owner: 'Owner',
      manager: 'Kepala Toko',
      cashier: 'Kasir',
      technician: 'Teknisi',
    };

    const recipientName = activeStaff?.name || operatorName || 'Pemilik / Kasir';
    const recipientRoleLabel = roleLabelMap[currentRole] || 'Kasir';

    exportFinancialReport({
      format: downloadFormat,
      startDate: downloadStartDate,
      endDate: downloadEndDate,
      transactions: allDigitalTransactions,
      balances: getStoredAccountBalances(),
      recipientName,
      recipientRoleLabel,
      storeName: 'Agen BRI Pakde Link',
      storeAddress: 'Jl Raya Pasar Gunungsari, Ulubelu',
      storePhone: 'WA: 082281185001',
    });

    setIsDownloadModalOpen(false);
  };

  // Get active period range [start, end]
  const getActivePeriodRange = (): { start: string | null; end: string | null } => {
    if (periodType === 'daily') {
      return { start: selectedDate, end: selectedDate };
    }
    if (periodType === 'monthly') {
      const m = String(selectedMonth).padStart(2, '0');
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      return {
        start: `${selectedYear}-${m}-01`,
        end: `${selectedYear}-${m}-${String(lastDay).padStart(2, '0')}`,
      };
    }
    if (periodType === 'yearly') {
      return {
        start: `${selectedYear}-01-01`,
        end: `${selectedYear}-12-31`,
      };
    }
    return { start: null, end: null };
  };

  // Helper to format date & time for Indonesian locale
  const formatIndoDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';
    } catch {
      return dateStr;
    }
  };

  // Transaksi murni Transfer Bank pada periode aktif (ke rekening tujuan umum/eksternal, tanpa campur TF Card)
  const periodPureTransferBankTransactions = React.useMemo(() => {
    const range = getActivePeriodRange();
    return allDigitalTransactions.filter(
      (tx) => matchesPeriodHelper(tx.createdAt, range.start, range.end) && matchesDivisionHelper(tx, 'transfer_bank')
    );
  }, [allDigitalTransactions, periodType, selectedMonth, selectedYear, selectedDate]);

  const pureTransferBankVolume = React.useMemo(() => {
    return periodPureTransferBankTransactions.reduce((acc, cur) => acc + (Number(cur.nominal) || 0), 0);
  }, [periodPureTransferBankTransactions]);

  const pureTransferBankProfit = React.useMemo(() => {
    return periodPureTransferBankTransactions.reduce((acc, cur) => acc + (Number(cur.profit) || 0), 0);
  }, [periodPureTransferBankTransactions]);

  // Data riwayat transaksi PPOB & Lainnya pada periode aktif (Semua transaksi PPOB dan Lainnya, bukan Card Tagihan)
  const periodPpobTransactions = React.useMemo(() => {
    const range = getActivePeriodRange();
    return allDigitalTransactions.filter(
      (tx) => matchesPeriodHelper(tx.createdAt, range.start, range.end) && matchesDivisionHelper(tx, 'ppob')
    );
  }, [allDigitalTransactions, periodType, selectedMonth, selectedYear, selectedDate]);

  const ppobRealVolume = React.useMemo(() => {
    return periodPpobTransactions.reduce((acc, cur) => acc + (Number(cur.nominal) || 0), 0);
  }, [periodPpobTransactions]);

  const ppobRealProfit = React.useMemo(() => {
    return periodPpobTransactions.reduce(
      (acc, cur) => acc + (cur.profit != null ? Number(cur.profit) : (Number(cur.adminStoreFee) || 0)),
      0
    );
  }, [periodPpobTransactions]);

  // Digital breakdown helpers (sinkron 100% murni dengan data riwayat transfer bank & PPOB)
  const tfBreakdown = allDigitalTransactions.length > 0 ? {
    volume: pureTransferBankVolume,
    count: periodPureTransferBankTransactions.length,
    profit: pureTransferBankProfit,
  } : (data?.digitalBreakdown?.transferBank || {
    volume: data?.pillarBreakdown.brilinkBank?.volume || 0,
    count: data?.pillarBreakdown.brilinkBank?.count || 0,
    profit: data?.pillarBreakdown.brilinkBank?.profit || 0,
  });
  const ttBreakdown = data?.digitalBreakdown?.tarikTunai || {
    volume: data?.pillarBreakdown.tarikTunai?.volume || 0,
    count: data?.pillarBreakdown.tarikTunai?.count || 0,
    profit: data?.pillarBreakdown.tarikTunai?.profit || 0,
  };
  const ewBreakdown = data?.digitalBreakdown?.ewallet || {
    volume: data?.pillarBreakdown.ewallet?.volume || 0,
    count: data?.pillarBreakdown.ewallet?.count || 0,
    profit: data?.pillarBreakdown.ewallet?.profit || 0,
  };
  const ppBreakdown = allDigitalTransactions.length > 0 ? {
    volume: ppobRealVolume,
    count: periodPpobTransactions.length,
    profit: ppobRealProfit,
  } : (data?.digitalBreakdown?.ppob || {
    volume: data?.pillarBreakdown.ppobPulsa?.volume || 0,
    count: data?.pillarBreakdown.ppobPulsa?.count || 0,
    profit: data?.pillarBreakdown.ppobPulsa?.profit || 0,
  });

  // Filtered transactions for the selected division modal
  const getDivisionTransactions = (divKey: DigitalDivisionKey | null) => {
    if (!divKey) return [];
    const range = getActivePeriodRange();
    return allDigitalTransactions.filter((tx) => {
      // 1. Matches period
      if (!matchesPeriodHelper(tx.createdAt, range.start, range.end)) {
        return false;
      }
      // 2. Matches division
      if (!matchesDivisionHelper(tx, divKey)) {
        return false;
      }
      // 3. Search query filter
      if (divisionSearchQuery.trim()) {
        const q = divisionSearchQuery.trim().toLowerCase();
        const ref = (tx.referenceNumber || '').toLowerCase();
        const prov = (tx.provider || '').toLowerCase();
        const target = (tx.targetAccount || '').toLowerCase();
        const cust = (tx.customerName || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        const idStr = String(tx.id || '');
        if (!ref.includes(q) && !prov.includes(q) && !target.includes(q) && !cust.includes(q) && !notes.includes(q) && !idStr.includes(q)) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  };

  const handleExportDivisionCSV = (divKey: DigitalDivisionKey, items: DigitalTransaction[]) => {
    const cfg = DIVISION_CONFIG[divKey];
    let csv = `RIWAYAT TRANSAKSI DIVISI: ${cfg.title.toUpperCase()}\n`;
    csv += `Periode: ${activePeriodLabel.toUpperCase()}\n`;
    csv += `Tanggal Export: ${new Date().toLocaleString('id-ID')}\n`;
    csv += `Total Transaksi: ${items.length}\n\n`;

    csv += `ID,Tanggal & Waktu,No. Reff / SN,Layanan / Divisi,Provider / Bank,Nomor / Rekening Tujuan,Nama Pelanggan,Nominal Transaksi (Volume),Biaya Bank/Modal,Fee Admin Toko,Laba Bersih,Metode Bayar,Sumber Dana,Status,Catatan\n`;
    for (const tx of items) {
      const cleanNotes = (tx.notes || '').replace(/[\r\n,]+/g, ' ');
      csv += `${tx.id},"${tx.createdAt || ''}","${tx.referenceNumber || ''}","${tx.type}","${tx.provider}","${tx.targetAccount}","${tx.customerName || '-'}","${tx.nominal}","${tx.adminBankCost || 0}","${tx.adminStoreFee || 0}","${tx.profit || 0}","${tx.paymentMethod || 'cash'}","${tx.fundSource || '-'}","${tx.status || 'success'}","${cleanNotes}"\n`;
    }

    const safeFilename = `${cfg.title.replace(/[\s\/\\]+/g, '_')}_${activePeriodLabel.replace(/[\s\(\)\/]+/g, '_')}_${Date.now()}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Riwayat_${safeFilename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Active division modal items & stats
  const activeDivisionItems = selectedDivisionModal ? getDivisionTransactions(selectedDivisionModal) : [];
  const divisionTotalVolume = activeDivisionItems.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
  const divisionTotalFee = activeDivisionItems.reduce((acc, curr) => acc + (Number(curr.adminStoreFee) || 0), 0);
  const divisionTotalProfit = activeDivisionItems.reduce((acc, curr) => acc + (Number(curr.profit) || 0), 0);

  // Helper identifikasi transaksi Transfer Antar Card (TF Card)
  const isTransferCardTransactionHelper = (tx: DigitalTransaction): boolean => {
    return isTransferCardTransaction(tx);
  };

  // Helper identifikasi transaksi Card Tagihan
  const isTagihanTransactionHelper = (tx: DigitalTransaction): boolean => {
    return isTagihanTransaction(tx);
  };

  // 1. Data TF Card pada periode aktif (mutasi internal antar card di luar tagihan murni)
  const periodTfCardTransactions = React.useMemo(() => {
    const range = getActivePeriodRange();
    return allDigitalTransactions
      .filter((tx) => {
        if (!matchesPeriodHelper(tx.createdAt, range.start, range.end)) return false;
        return isTransferCardTransactionHelper(tx) && !isTagihanTransactionHelper(tx);
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [allDigitalTransactions, periodType, selectedMonth, selectedYear, selectedDate]);

  const tfCardVolume = React.useMemo(() => {
    return periodTfCardTransactions.reduce((acc, cur) => acc + (Number(cur.nominal) || 0), 0);
  }, [periodTfCardTransactions]);

  const tfCardBankCost = React.useMemo(() => {
    return periodTfCardTransactions.reduce((acc, cur) => acc + (Number(cur.adminBankCost) || 0), 0);
  }, [periodTfCardTransactions]);

  // 2. Data Card Tagihan pada periode aktif
  const periodTagihanTransactions = React.useMemo(() => {
    const range = getActivePeriodRange();
    return allDigitalTransactions
      .filter((tx) => {
        if (!matchesPeriodHelper(tx.createdAt, range.start, range.end)) return false;
        return isTagihanTransactionHelper(tx);
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [allDigitalTransactions, periodType, selectedMonth, selectedYear, selectedDate]);

  const tagihanVolume = React.useMemo(() => {
    return periodTagihanTransactions.reduce((acc, cur) => acc + (Number(cur.nominal) || 0), 0);
  }, [periodTagihanTransactions]);

  const currentTagihanBalance = React.useMemo(() => {
    try {
      return getStoredAccountBalances().tagihan || 0;
    } catch {
      return 0;
    }
  }, [data]);

  const currentTagihanNote = React.useMemo(() => {
    try {
      return getStoredTagihanNote() || '';
    } catch {
      return '';
    }
  }, [data]);

  // 3. Data Beban Toko pada periode aktif
  const periodExpenses = React.useMemo(() => {
    const range = getActivePeriodRange();
    return allExpensesList
      .filter((e) => matchesPeriodHelper(e.expenseDate, range.start, range.end))
      .sort((a, b) => new Date(b.expenseDate || 0).getTime() - new Date(a.expenseDate || 0).getTime());
  }, [allExpensesList, periodType, selectedMonth, selectedYear, selectedDate]);

  const periodExpensesTotal = React.useMemo(() => {
    return periodExpenses.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
  }, [periodExpenses]);

  // Agregasi seluruh transaksi digital (Transfer Bank, Tarik Tunai, E-Wallet, PPOB, TF Card, Tagihan) pada periode aktif
  const periodAllDigitalTransactions = React.useMemo(() => {
    const range = getActivePeriodRange();
    return allDigitalTransactions.filter((tx) =>
      matchesPeriodHelper(tx.createdAt, range.start, range.end)
    );
  }, [allDigitalTransactions, periodType, selectedMonth, selectedYear, selectedDate]);

  const liveDigitalMetrics = React.useMemo(() => {
    let volume = 0;
    let feeProfit = 0;
    for (const tx of periodAllDigitalTransactions) {
      const vol = Number(tx.totalCustomerPaid) || ((Number(tx.nominal) || 0) + (Number(tx.adminStoreFee) || 0));
      volume += vol;
      const adminFee = Number(tx.adminStoreFee) || 0;
      const bankCost = Number(tx.adminBankCost) || 0;
      const profit =
        tx.profit != null && !Number.isNaN(Number(tx.profit))
          ? Number(tx.profit)
          : adminFee - bankCost;
      feeProfit += profit;
    }
    return { volume, feeProfit, count: periodAllDigitalTransactions.length };
  }, [periodAllDigitalTransactions]);

  // Metrik Header Utama yang Mengagregasi Seluruh Transaksi & Card Real-Time
  // Prioritaskan data live (Firestore/Client) saat transaksi digital tersedia agar potongan biaya admin antar card tidak tertutup oleh cache server yang belum terpotong.
  const hasLiveDigitalSource = allDigitalTransactions.length > 0;

  const headerTotalGrossOmset = React.useMemo(() => {
    const serverVal = data?.totalGrossOmset || 0;
    const salesVol = data?.summary?.salesOmset || 0;
    const servVol = data?.summary?.serviceOmset || 0;
    const liveVal = salesVol + servVol + liveDigitalMetrics.volume;
    return hasLiveDigitalSource ? liveVal : serverVal;
  }, [data, liveDigitalMetrics.volume, hasLiveDigitalSource]);

  const headerTotalGrossProfit = React.useMemo(() => {
    const serverVal = data?.totalGrossProfit || 0;
    const salesProfit = data?.summary?.salesTotalProfit || 0;
    const servMargin = data?.summary?.serviceNetMargin || 0;
    const liveVal = salesProfit + servMargin + liveDigitalMetrics.feeProfit;
    return hasLiveDigitalSource ? liveVal : serverVal;
  }, [data, liveDigitalMetrics.feeProfit, hasLiveDigitalSource]);

  const headerTotalExpenses = React.useMemo(() => {
    const serverVal = data?.totalExpenses || 0;
    return Math.max(serverVal, periodExpensesTotal);
  }, [data?.totalExpenses, periodExpensesTotal]);

  const headerNetProfit = React.useMemo(() => {
    return headerTotalGrossProfit - headerTotalExpenses;
  }, [headerTotalGrossProfit, headerTotalExpenses]);

  const headerDigitalTransactionsCount = React.useMemo(() => {
    return hasLiveDigitalSource ? liveDigitalMetrics.count : (data?.indicators?.digitalCount || 0);
  }, [data?.indicators?.digitalCount, liveDigitalMetrics.count, hasLiveDigitalSource]);

  const headerTotalTransactions = React.useMemo(() => {
    const nonDigitalCount = (data?.indicators?.salesCount || 0) + (data?.indicators?.serviceCount || 0);
    return nonDigitalCount + headerDigitalTransactionsCount;
  }, [data?.indicators, headerDigitalTransactionsCount]);

  // Items terfilter untuk modal operasional yang aktif
  const activeOperationalFilteredItems = React.useMemo(() => {
    const q = operationalSearchQuery.trim().toLowerCase();
    if (selectedOperationalModal === 'tf_card') {
      if (!q) return periodTfCardTransactions;
      return periodTfCardTransactions.filter((tx) => {
        const ref = (tx.referenceNumber || '').toLowerCase();
        const prov = (tx.provider || '').toLowerCase();
        const target = (tx.targetAccount || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        const idStr = String(tx.id || '');
        const nomStr = String(tx.nominal || '');
        return ref.includes(q) || prov.includes(q) || target.includes(q) || notes.includes(q) || idStr.includes(q) || nomStr.includes(q);
      });
    }
    if (selectedOperationalModal === 'tagihan') {
      if (!q) return periodTagihanTransactions;
      return periodTagihanTransactions.filter((tx) => {
        const ref = (tx.referenceNumber || '').toLowerCase();
        const prov = (tx.provider || '').toLowerCase();
        const target = (tx.targetAccount || '').toLowerCase();
        const cust = (tx.customerName || '').toLowerCase();
        const notes = (tx.notes || '').toLowerCase();
        const idStr = String(tx.id || '');
        const nomStr = String(tx.nominal || '');
        return ref.includes(q) || prov.includes(q) || target.includes(q) || cust.includes(q) || notes.includes(q) || idStr.includes(q) || nomStr.includes(q);
      });
    }
    if (selectedOperationalModal === 'beban_toko') {
      if (!q) return periodExpenses;
      return periodExpenses.filter((e) => {
        const title = (e.title || '').toLowerCase();
        const cat = (e.category || '').toLowerCase();
        const notes = (e.notes || '').toLowerCase();
        const paidBy = (e.paidBy || '').toLowerCase();
        const amtStr = String(e.amount || '');
        return title.includes(q) || cat.includes(q) || notes.includes(q) || paidBy.includes(q) || amtStr.includes(q);
      });
    }
    return [];
  }, [selectedOperationalModal, operationalSearchQuery, periodTfCardTransactions, periodTagihanTransactions, periodExpenses]);

  const handleExportOperationalCSV = (type: 'tf_card' | 'tagihan' | 'beban_toko') => {
    if (type === 'tf_card') {
      let csv = `LAPORAN MUTASI TRANSFER ANTAR CARD (TF CARD)\n`;
      csv += `Periode: ${activePeriodLabel}\nTanggal Cetak: ${new Date().toLocaleString('id-ID')}\n`;
      csv += `Total Transaksi: ${periodTfCardTransactions.length}\nTotal Volume: ${tfCardVolume}\n\n`;
      csv += `ID,Tanggal & Waktu,No. Referensi,Rute Mutasi,Akun Tujuan,Nominal Dipindah,Biaya Modal Bank,Catatan\n`;
      periodTfCardTransactions.forEach((tx) => {
        csv += `${tx.id},"${tx.createdAt || ''}","${tx.referenceNumber || ''}","${tx.provider}","${tx.targetAccount}","${tx.nominal}","${tx.adminBankCost || 0}","${(tx.notes || '').replace(/[\r\n,]+/g, ' ')}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_TF_Card_${activePeriodLabel.replace(/[\s\/\\]+/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (type === 'tagihan') {
      let csv = `LAPORAN TRANSAKSI & CATATAN CARD TAGIHAN\n`;
      csv += `Periode: ${activePeriodLabel}\nTanggal Cetak: ${new Date().toLocaleString('id-ID')}\n`;
      csv += `Saldo Aktif Card Tagihan: ${currentTagihanBalance}\n`;
      csv += `Memo Catatan: ${(currentTagihanNote || '-').replace(/[\r\n,]+/g, ' ')}\n\n`;
      csv += `ID,Tanggal & Waktu,No. Referensi,Layanan / Provider,Akun Tujuan,Nominal,Biaya Bank,Catatan\n`;
      periodTagihanTransactions.forEach((tx) => {
        csv += `${tx.id},"${tx.createdAt || ''}","${tx.referenceNumber || ''}","${tx.provider}","${tx.targetAccount}","${tx.nominal}","${tx.adminBankCost || 0}","${(tx.notes || '').replace(/[\r\n,]+/g, ' ')}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_Card_Tagihan_${activePeriodLabel.replace(/[\s\/\\]+/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (type === 'beban_toko') {
      let csv = `LAPORAN BEBAN OPERASIONAL TOKO\n`;
      csv += `Periode: ${activePeriodLabel}\nTanggal Cetak: ${new Date().toLocaleString('id-ID')}\n`;
      csv += `Total Beban: ${data?.totalExpenses || periodExpensesTotal}\n\n`;
      csv += `ID,Tanggal,Kategori,Judul / Keterangan,Nominal Biaya,Sumber Pembayaran,Catatan\n`;
      periodExpenses.forEach((exp) => {
        csv += `${exp.id},"${exp.expenseDate}","${exp.category}","${exp.title.replace(/[\r\n,]+/g, ' ')}","${exp.amount}","${exp.paidBy || 'cash'}","${(exp.notes || '').replace(/[\r\n,]+/g, ' ')}"\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Laporan_Beban_Toko_${activePeriodLabel.replace(/[\s\/\\]+/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Header & Controls Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Title & Cloud Sync Indicator */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-900 text-lg">
                Laporan Keuangan & Laba Rugi Agen BRILink, E-Wallet & PPOB
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Rekapitulasi perputaran dana transaksi transfer bank, tarik tunai, top-up e-wallet, beban operasional, dan arus kas penerimaan kasir.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Cloud Database Terhubung
            </span>
            <button
              onClick={() => {
                setRefreshing(true);
                loadSummary();
              }}
              title="Segarkan data dari database cloud"
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <button
              onClick={handleOpenDownloadModal}
              disabled={!data || loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Laporan</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar: Tab Type & Dropdown Bulan / Tahun */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Main Period Type Switcher: Harian | Bulanan | Tahunan | Semua */}
          <div className="flex items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold shrink-0">
            <button
              onClick={() => setPeriodType('daily')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                periodType === 'daily'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setPeriodType('monthly')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                periodType === 'monthly'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setPeriodType('yearly')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                periodType === 'yearly'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tahunan
            </button>
            <button
              onClick={() => setPeriodType('all')}
              className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                periodType === 'all'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
          </div>

          {/* Granular Period Selector (Month / Year / Date) - Rata Kanan */}
          <div className="flex flex-wrap items-center justify-end gap-2 w-full lg:w-auto lg:ml-auto">
            {periodType === 'monthly' && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="text-xs text-slate-500 font-medium">Bulan:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {INDONESIAN_MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-slate-500 font-medium">Tahun:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {periodType === 'yearly' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Pilih Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodType === 'daily' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Tanggal:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                />
              </div>
            )}

            {periodType === 'all' && (
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium">
                Menampilkan seluruh data riwayat transaksi
              </span>
            )}
          </div>
        </div>

        {/* Active Filter Summary Bar */}
        <div className="pt-2 flex flex-wrap items-center justify-between text-xs bg-slate-50/80 -mx-5 -mb-5 px-5 py-2.5 rounded-b-2xl border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Periode Laporan Aktif:</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold">
              {activePeriodLabel}
            </span>
            {data?.selectedPeriodInfo?.startDate && data?.selectedPeriodInfo?.endDate && (
              <span className="text-slate-400 hidden sm:inline">
                {data.selectedPeriodInfo.startDate === data.selectedPeriodInfo.endDate
                  ? `(${data.selectedPeriodInfo.startDate} • 00:00:00 s/d 23:59:59)`
                  : `(${data.selectedPeriodInfo.startDate} s/d ${data.selectedPeriodInfo.endDate})`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 text-slate-600 font-medium mt-1 sm:mt-0">
            <span>
              Total Transaksi Sukses: <strong className="text-slate-900">{headerTotalTransactions}</strong>
            </span>
            <span className="text-slate-300">&bull;</span>
            <span>
              Mutasi Keagenan: <strong className="text-slate-900">{headerDigitalTransactionsCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm space-y-2">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-medium text-slate-600">Mengagregasi laporan keuangan dari database cloud...</p>
          <p className="text-xs text-slate-400">Menghitung omset perputaran dana, fee admin toko, beban, dan net profit untuk periode {activePeriodLabel}</p>
        </div>
      ) : !data ? (
        <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
          Data laporan keuangan tidak tersedia untuk periode ini.
        </div>
      ) : (
        <>
          {/* Top 4 KPI Metrics Focused on Digital Agency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Perputaran Uang (Omset Bruto) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Perputaran Uang Masuk</span>
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900">
                {formatRupiah(headerTotalGrossOmset)}
              </div>
              <div className="text-[11px] text-slate-400">
                Total perputaran uang konsumen pada periode {activePeriodLabel}
              </div>
            </div>

            {/* 2. Total Laba Kotor (Fee Admin Toko) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Total Fee Admin Toko</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div
                className={`text-2xl font-extrabold ${
                  headerTotalGrossProfit < 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {headerTotalGrossProfit > 0
                  ? `+${formatRupiah(headerTotalGrossProfit)}`
                  : headerTotalGrossProfit < 0
                  ? `-${formatRupiah(Math.abs(headerTotalGrossProfit))}`
                  : formatRupiah(0)}
              </div>
              <div className="text-[11px] text-slate-400">
                Akumulasi seluruh margin & fee admin (Transfer Bank, Tarik Tunai, E-Wallet, PPOB, TF Card, Tagihan)
              </div>
            </div>

            {/* 3. Beban Operasional Toko */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Beban Operasional Toko</span>
                <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                  <ArrowDownRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-extrabold text-rose-600">
                -{formatRupiah(headerTotalExpenses)}
              </div>
              <div className="text-[11px] text-slate-400">
                Listrik, kuota wifi/data, sewa outlet, kertas thermal
              </div>
            </div>

            {/* 4. Laba Bersih Toko (Net Profit) */}
            <div className="bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/70 border-2 border-emerald-200/90 p-5 rounded-2xl shadow-xs space-y-2 text-slate-900 relative overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                <span>LABA BERSIH (NET PROFIT)</span>
                <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div
                className={`text-2xl font-black ${
                  headerNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {formatRupiah(headerNetProfit)}
              </div>
              <div className="text-[11px] text-emerald-800/80 font-medium">
                {headerTotalGrossProfit > 0
                  ? `Efisiensi Bersih: ${Math.round((headerNetProfit / headerTotalGrossProfit) * 100)}% dari fee kotor`
                  : 'Siap cetak laporan'}
              </div>
            </div>
          </div>

          {/* Breakdown 4 Pilar Keuangan Digital Keagenan */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Breakdown Margin Keuntungan per Divisi Layanan Digital
                  </h3>
                  <p className="text-xs text-slate-500">
                    Rincian perputaran dana dan fee admin toko dari 4 divisi utama keagenan
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500">
                Periode: <strong>{activePeriodLabel}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Pilar 1: Transfer Antar Bank & BRILink */}
              <div
                onClick={() => {
                  setSelectedDivisionModal('transfer_bank');
                  setDivisionSearchQuery('');
                }}
                className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-2.5 hover:shadow-md hover:border-blue-400 hover:bg-blue-50/60 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-100 text-blue-700 group-hover:scale-105 transition-transform">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Transfer Bank & BRILink</h4>
                        <span className="text-[10px] text-slate-500">Sesama & antar bank</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-blue-700 px-2 py-0.5 rounded-full bg-blue-100">
                      {tfBreakdown.count} Trx
                    </span>
                  </div>
                  <div className="pt-2 border-t border-blue-200/70 space-y-1 text-xs mt-2.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Volume Transfer:</span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(tfBreakdown.volume)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold pt-1 border-t border-blue-200/50">
                      <span>Fee Admin Toko:</span>
                      <span className="text-emerald-700">
                        +{formatRupiah(tfBreakdown.profit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Detail Riwayat */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDivisionModal('transfer_bank');
                    setDivisionSearchQuery('');
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-lg bg-blue-100/90 hover:bg-blue-200 active:bg-blue-300 text-blue-800 border border-blue-200/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat ({tfBreakdown.count})</span>
                </button>
              </div>

              {/* Pilar 2: Tarik Tunai Agen */}
              <div
                onClick={() => {
                  setSelectedDivisionModal('tarik_tunai');
                  setDivisionSearchQuery('');
                }}
                className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2.5 hover:shadow-md hover:border-emerald-400 hover:bg-emerald-50/60 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700 group-hover:scale-105 transition-transform">
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Tarik Tunai Agen</h4>
                        <span className="text-[10px] text-slate-500">Pencairan tunai / QRIS</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 px-2 py-0.5 rounded-full bg-emerald-100">
                      {ttBreakdown.count} Trx
                    </span>
                  </div>
                  <div className="pt-2 border-t border-emerald-200/70 space-y-1 text-xs mt-2.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Volume Ditarik:</span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(ttBreakdown.volume)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold pt-1 border-t border-emerald-200/50">
                      <span>Fee Admin Toko:</span>
                      <span className="text-emerald-700">
                        +{formatRupiah(ttBreakdown.profit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Detail Riwayat */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDivisionModal('tarik_tunai');
                    setDivisionSearchQuery('');
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-lg bg-emerald-100/90 hover:bg-emerald-200 active:bg-emerald-300 text-emerald-800 border border-emerald-200/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat ({ttBreakdown.count})</span>
                </button>
              </div>

              {/* Pilar 3: Top Up E-Wallet */}
              <div
                onClick={() => {
                  setSelectedDivisionModal('ewallet');
                  setDivisionSearchQuery('');
                }}
                className="p-4 rounded-xl border border-purple-200 bg-purple-50/30 space-y-2.5 hover:shadow-md hover:border-purple-400 hover:bg-purple-50/60 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-100 text-purple-700 group-hover:scale-105 transition-transform">
                        <Wallet className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Top Up E-Wallet</h4>
                        <span className="text-[10px] text-slate-500">DANA, OVO, GoPay, Shopee</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-700 px-2 py-0.5 rounded-full bg-purple-100">
                      {ewBreakdown.count} Trx
                    </span>
                  </div>
                  <div className="pt-2 border-t border-purple-200/70 space-y-1 text-xs mt-2.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Volume Top Up:</span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(ewBreakdown.volume)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold pt-1 border-t border-purple-200/50">
                      <span>Fee Selisih Jasa:</span>
                      <span className="text-emerald-700">
                        +{formatRupiah(ewBreakdown.profit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Detail Riwayat */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDivisionModal('ewallet');
                    setDivisionSearchQuery('');
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-lg bg-purple-100/90 hover:bg-purple-200 active:bg-purple-300 text-purple-800 border border-purple-200/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat ({ewBreakdown.count})</span>
                </button>
              </div>

              {/* Pilar 4: PPOB & Tagihan Listrik PLN */}
              <div
                onClick={() => {
                  setSelectedDivisionModal('ppob');
                  setDivisionSearchQuery('');
                }}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2.5 hover:shadow-md hover:border-amber-400 hover:bg-amber-50/60 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">PPOB</h4>
                        <span className="text-[10px] text-slate-500">Pulsa, PLN, BPJS, PDAM & lainnya</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-700 px-2 py-0.5 rounded-full bg-amber-100">
                      {ppBreakdown.count} Trx
                    </span>
                  </div>
                  <div className="pt-2 border-t border-amber-200/70 space-y-1 text-xs mt-2.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Volume Transaksi:</span>
                      <span className="font-semibold text-slate-800">
                        {formatRupiah(ppBreakdown.volume)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold pt-1 border-t border-amber-200/50">
                      <span>Fee Admin Toko:</span>
                      <span className="text-emerald-700">
                        +{formatRupiah(ppBreakdown.profit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Detail Riwayat */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDivisionModal('ppob');
                    setDivisionSearchQuery('');
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-lg bg-amber-100/90 hover:bg-amber-200 active:bg-amber-300 text-amber-800 border border-amber-200/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat ({ppBreakdown.count})</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rincian Beban Operasional Toko */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Rekapitulasi Beban Operasional Toko (Total: {formatRupiah(headerTotalExpenses)})
                </h3>
                <p className="text-xs text-slate-500">
                  Pengeluaran rutin seperti listrik, kuota wifi/modem, sewa outlet, kertas struk thermal, serta mutasi operasional
                </p>
              </div>
              <span className="text-xs text-slate-500">
                Periode: <strong>{activePeriodLabel}</strong>
              </span>
            </div>

            {/* 3 Card Rekapitulasi Rincian Beban Operasional Toko */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
              {/* Card 1: Transfer Antar Card */}
              <div
                onClick={() => {
                  setSelectedOperationalModal('tf_card');
                  setOperationalSearchQuery('');
                }}
                className="p-4 rounded-xl border border-sky-200 bg-sky-50/30 space-y-2.5 hover:shadow-md hover:border-sky-400 hover:bg-sky-50/60 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-sky-100 text-sky-700 group-hover:scale-105 transition-transform">
                        <ArrowRightLeft className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Transfer Antar Card</h4>
                        <span className="text-[10px] text-slate-500">Mutasi internal card (TF Card)</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-sky-700 px-2 py-0.5 rounded-full bg-sky-100">
                      {periodTfCardTransactions.length} Trx
                    </span>
                  </div>
                  <div className="pt-2 border-t border-sky-200/70 space-y-1 text-xs mt-2.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Pindah Dana:</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {formatRupiah(tfCardVolume)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold pt-1 border-t border-sky-200/50">
                      <span>Biaya Modal Bank:</span>
                      <span className="text-rose-600 font-mono">
                        {tfCardBankCost > 0 ? `-${formatRupiah(tfCardBankCost)}` : 'Rp 0'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Detail Riwayat */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOperationalModal('tf_card');
                    setOperationalSearchQuery('');
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-lg bg-sky-100/90 hover:bg-sky-200 active:bg-sky-300 text-sky-800 border border-sky-200/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat ({periodTfCardTransactions.length})</span>
                </button>
              </div>

              {/* Card 2: Card Tagihan */}
              <div
                onClick={() => {
                  setSelectedOperationalModal('tagihan');
                  setOperationalSearchQuery('');
                }}
                className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2.5 hover:shadow-md hover:border-amber-400 hover:bg-amber-50/60 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-amber-100 text-amber-700 group-hover:scale-105 transition-transform">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Card Tagihan</h4>
                        <span className="text-[10px] text-slate-500">Catatan & mutasi tabungan tagihan</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber-700 px-2 py-0.5 rounded-full bg-amber-100">
                      {periodTagihanTransactions.length} Trx
                    </span>
                  </div>
                  <div className="pt-2 border-t border-amber-200/70 space-y-1 text-xs mt-2.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Saldo Card Tagihan:</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {formatRupiah(currentTagihanBalance)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-bold pt-1 border-t border-amber-200/50">
                      <span>Volume Trx Periode:</span>
                      <span className="text-amber-700 font-mono">
                        {formatRupiah(tagihanVolume)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Detail Riwayat */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOperationalModal('tagihan');
                    setOperationalSearchQuery('');
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-lg bg-amber-100/90 hover:bg-amber-200 active:bg-amber-300 text-amber-800 border border-amber-200/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat ({periodTagihanTransactions.length})</span>
                </button>
              </div>

              {/* Card 3: Beban Toko */}
              <div
                onClick={() => {
                  setSelectedOperationalModal('beban_toko');
                  setOperationalSearchQuery('');
                }}
                className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2.5 hover:shadow-md hover:border-rose-400 hover:bg-rose-50/60 transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-rose-100 text-rose-700 group-hover:scale-105 transition-transform">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Beban Toko</h4>
                        <span className="text-[10px] text-slate-500">Operasional outlet & perlengkapan</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-rose-700 px-2 py-0.5 rounded-full bg-rose-100">
                      {periodExpenses.length} Item
                    </span>
                  </div>
                  <div className="pt-2 border-t border-rose-200/70 space-y-1 text-xs mt-2.5">
                    <div className="flex justify-between text-slate-500">
                      <span>Total Biaya Operasional:</span>
                      <span className="font-bold text-rose-700 font-mono">
                        {formatRupiah(data.totalExpenses || periodExpensesTotal)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-700 font-semibold pt-1 border-t border-rose-200/50">
                      <span>Rincian Kategori:</span>
                      <span className="text-slate-600">
                        {Object.keys(data.expensesByCategory).length} Kategori
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tombol Aksi Detail Riwayat */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedOperationalModal('beban_toko');
                    setOperationalSearchQuery('');
                  }}
                  className="mt-2 w-full py-1.5 px-3 rounded-lg bg-rose-100/90 hover:bg-rose-200 active:bg-rose-300 text-rose-800 border border-rose-200/80 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Lihat Riwayat ({periodExpenses.length})</span>
                </button>
              </div>
            </div>

            {/* Rincian per Kategori Beban Toko */}
            <div className="pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 mb-2.5">
                Rincian per Kategori Beban Operasional:
              </h4>
              {Object.keys(data.expensesByCategory).length === 0 ? (
                <p className="text-xs text-slate-400 py-2">Belum ada pengeluaran operasional yang dicatat pada periode ini</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(data.expensesByCategory).map(([cat, amt]) => (
                    <div key={cat} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[11px] font-semibold text-slate-600 uppercase">
                        {cat.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm font-bold text-rose-700 mt-1 font-mono">{formatRupiah(amt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Diagram Garis (Line Chart) Tren Keuangan & Performa Transaksi */}
          <FinancialTrendChart
            allDigitalTransactions={allDigitalTransactions}
            allExpensesList={allExpensesList}
            periodType={periodType}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            selectedDate={selectedDate}
            formatRupiah={formatRupiah}
          />
        </>
      )}

      {/* Modal Drill-Down Riwayat Transaksi per Divisi Layanan Digital */}
      {selectedDivisionModal && (() => {
        const cfg = DIVISION_CONFIG[selectedDivisionModal];
        const DivIcon = cfg.icon;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
            onClick={() => {
              setSelectedDivisionModal(null);
              setDivisionSearchQuery('');
            }}
          >
            <div
              className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
              onScroll={handleModalCardScroll}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4 bg-slate-50/60 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 sm:p-3 rounded-2xl ${cfg.bgColor} ${cfg.color} ring-1 ring-inset ${cfg.borderColor}`}>
                    <DivIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Riwayat Transaksi: {cfg.title}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {activeDivisionItems.length} Transaksi
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Periode: <strong className="text-slate-700">{activePeriodLabel}</strong> • Sinkron Cloud Database
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedDivisionModal(null);
                    setDivisionSearchQuery('');
                  }}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Summary Metric Ribbon inside modal */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-slate-50/90 border-b border-slate-100 shrink-0 text-xs">
                <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Transaksi
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                    {activeDivisionItems.length} <span className="text-xs font-normal text-slate-400">trx</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Volume / Omset
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-blue-700 mt-0.5">
                    {formatRupiah(divisionTotalVolume)}
                  </div>
                </div>

                <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total Admin Toko
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-amber-700 mt-0.5">
                    {formatRupiah(divisionTotalFee)}
                  </div>
                </div>

                <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                  <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Margin Laba Bersih
                  </div>
                  <div className="text-sm sm:text-base font-extrabold text-emerald-700 mt-0.5">
                    {formatRupiah(divisionTotalProfit)}
                  </div>
                </div>
              </div>

              {/* Search & Export Toolbar */}
              <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={divisionSearchQuery}
                    onChange={(e) => setDivisionSearchQuery(e.target.value)}
                    placeholder="Cari no. reff / SN, tujuan, provider, nama pelanggan..."
                    className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                  {divisionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDivisionSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportDivisionCSV(selectedDivisionModal, activeDivisionItems)}
                    disabled={activeDivisionItems.length === 0}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Export data divisi ini ke format CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download CSV</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Transaction List */}
              <div
                className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-6"
                onScroll={handleModalCardScroll}
              >
                {activeDivisionItems.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">
                        {divisionSearchQuery ? 'Tidak Ada Transaksi yang Cocok' : 'Belum Ada Transaksi Tercatat'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        {divisionSearchQuery
                          ? `Tidak ditemukan transaksi dengan kata kunci "${divisionSearchQuery}". Coba kata kunci lain.`
                          : `Belum ada riwayat transaksi ${cfg.title} pada periode ${activePeriodLabel}.`}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop View: Table */}
                    <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200">
                            <th className="py-3 px-3.5 font-bold">Waktu & Tanggal</th>
                            <th className="py-3 px-3.5 font-bold">No. Reff / SN</th>
                            <th className="py-3 px-3.5 font-bold">Layanan & Provider</th>
                            <th className="py-3 px-3.5 font-bold">Tujuan / Pelanggan</th>
                            <th className="py-3 px-3.5 font-bold text-right">Nominal Transaksi</th>
                            <th className="py-3 px-3.5 font-bold text-right">Fee Toko</th>
                            <th className="py-3 px-3.5 font-bold text-right">Laba Bersih</th>
                            <th className="py-3 px-3.5 font-bold text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeDivisionItems.map((tx, idx) => (
                            <tr key={`${tx.referenceNumber || 'tx'}-${tx.id || idx}-${idx}`} className="hover:bg-slate-50/60 transition">
                              <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                                <div className="font-medium text-slate-800">{formatIndoDateTime(tx.createdAt)}</div>
                                <div className="text-[10px] text-slate-400 capitalize">
                                  {tx.paymentMethod === 'hutang'
                                    ? 'Hutang (Piutang)'
                                    : tx.paymentMethod === 'qris'
                                    ? 'QRIS Toko'
                                    : tx.paymentMethod === 'transfer'
                                    ? 'Transfer Bank'
                                    : 'Tunai / Cash'}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700">
                                  <span>{tx.referenceNumber || `#${tx.id}`}</span>
                                  {tx.referenceNumber && (
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(tx.referenceNumber)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition cursor-pointer"
                                      title="Salin No. Reff"
                                    >
                                      {copiedRef === tx.referenceNumber ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  )}
                                </div>
                                {copiedRef === tx.referenceNumber && (
                                  <span className="text-[9px] text-emerald-600 font-medium">Tersalin!</span>
                                )}
                              </td>

                              <td className="py-3 px-3.5 text-slate-700">
                                <div className="font-bold text-slate-900">{tx.provider || '-'}</div>
                                <div className="text-[10px] text-slate-500 uppercase">
                                  {tx.type ? tx.type.replace(/_/g, ' ') : '-'}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-slate-700">
                                <div className="font-mono font-medium text-slate-900">{tx.targetAccount || '-'}</div>
                                {tx.customerName && (
                                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>{tx.customerName}</span>
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                                {formatRupiah(tx.nominal)}
                              </td>

                              <td className="py-3 px-3.5 text-right font-semibold text-amber-700 whitespace-nowrap">
                                +{formatRupiah(tx.adminStoreFee)}
                              </td>

                              <td className="py-3 px-3.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                                +{formatRupiah(tx.profit)}
                              </td>

                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Berhasil</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="md:hidden space-y-3">
                      {activeDivisionItems.map((tx, idx) => (
                        <div
                          key={`${tx.referenceNumber || 'tx'}-${tx.id || idx}-${idx}`}
                          className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 text-sm">{tx.provider}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-medium uppercase">
                                  {tx.type ? tx.type.replace(/_/g, ' ') : '-'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {formatIndoDateTime(tx.createdAt)}
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>Berhasil</span>
                            </span>
                          </div>

                          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">Tujuan / No. HP:</span>
                              <span className="font-mono font-bold text-slate-800">{tx.targetAccount || '-'}</span>
                            </div>
                            {tx.customerName && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500 text-[11px]">Pelanggan:</span>
                                <span className="font-medium text-slate-700">{tx.customerName}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500 text-[11px]">No. Reff / SN:</span>
                              <div className="flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700">
                                <span>{tx.referenceNumber || `#${tx.id}`}</span>
                                {tx.referenceNumber && (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(tx.referenceNumber)}
                                    className="p-0.5 text-slate-400 hover:text-indigo-600 rounded"
                                    title="Salin No. Reff"
                                  >
                                    {copiedRef === tx.referenceNumber ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 text-center">
                            <div>
                              <div className="text-[10px] text-slate-500">Nominal</div>
                              <div className="text-xs font-bold text-slate-900 mt-0.5">
                                {formatRupiah(tx.nominal)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500">Fee Toko</div>
                              <div className="text-xs font-bold text-amber-700 mt-0.5">
                                +{formatRupiah(tx.adminStoreFee)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500">Laba Bersih</div>
                              <div className="text-xs font-bold text-emerald-700 mt-0.5">
                                +{formatRupiah(tx.profit)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-500">
                  Menampilkan <strong>{activeDivisionItems.length}</strong> transaksi dari total riwayat
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDivisionModal(null);
                    setDivisionSearchQuery('');
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Drill-Down Riwayat Operasional (TF Card, Card Tagihan, Beban Toko) */}
      {selectedOperationalModal && (() => {
        const type = selectedOperationalModal;
        const isTfCard = type === 'tf_card';
        const isTagihan = type === 'tagihan';
        const isBebanToko = type === 'beban_toko';

        let modalTitle = '';
        let modalSubtitle = '';
        let ModalIcon = ArrowRightLeft;
        let themeColor = {
          badge: 'bg-sky-100 text-sky-800 border-sky-200',
          headerIcon: 'bg-sky-100 text-sky-700',
        };

        if (isTfCard) {
          modalTitle = 'Riwayat Transfer Antar Card (TF Card)';
          modalSubtitle = 'Mutasi saldo internal dan pergeseran likuiditas antar card';
          ModalIcon = ArrowRightLeft;
          themeColor = {
            badge: 'bg-sky-100 text-sky-800 border-sky-200',
            headerIcon: 'bg-sky-100 text-sky-700',
          };
        } else if (isTagihan) {
          modalTitle = 'Riwayat & Catatan Card Tagihan';
          modalSubtitle = 'Pencatatan akumulasi saldo dana cadangan tagihan dan mutasi transaksi tagihan';
          ModalIcon = Receipt;
          themeColor = {
            badge: 'bg-amber-100 text-amber-800 border-amber-200',
            headerIcon: 'bg-amber-100 text-amber-700',
          };
        } else {
          modalTitle = 'Riwayat Beban Operasional Toko';
          modalSubtitle = 'Pencatatan pengeluaran rutin operasional outlet, listrik, sewa, dan perlengkapan';
          ModalIcon = DollarSign;
          themeColor = {
            badge: 'bg-rose-100 text-rose-800 border-rose-200',
            headerIcon: 'bg-rose-100 text-rose-700',
          };
        }

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
            onClick={() => {
              setSelectedOperationalModal(null);
              setOperationalSearchQuery('');
            }}
          >
            <div
              className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
              onScroll={handleModalCardScroll}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/30 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 sm:p-3 rounded-2xl ${themeColor.headerIcon} shadow-xs`}>
                    <ModalIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                        {modalTitle}
                      </h3>
                      <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full border ${themeColor.badge}`}>
                        Periode: {activePeriodLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {modalSubtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportOperationalCSV(type)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
                    title="Export Riwayat ke CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Download CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOperationalModal(null);
                      setOperationalSearchQuery('');
                    }}
                    className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    aria-label="Tutup Modal"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Memo Card Tagihan Banner if active */}
              {isTagihan && currentTagihanNote && (
                <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <FileText className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-900">Catatan Memo Card Tagihan:</span>
                    <p className="text-amber-800 leading-relaxed whitespace-pre-wrap">{currentTagihanNote}</p>
                  </div>
                </div>
              )}

              {/* Summary Stats Strip */}
              <div className="px-4 sm:px-6 pt-3 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
                {isTfCard && (
                  <>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[11px] text-slate-500 font-medium">Total Mutasi TF Card</div>
                      <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                        {periodTfCardTransactions.length} <span className="text-xs font-semibold text-slate-500">Trx</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-200/80">
                      <div className="text-[11px] text-sky-700 font-medium">Total Pindah Dana</div>
                      <div className="text-base sm:text-lg font-bold text-sky-900 mt-0.5 font-mono">
                        {formatRupiah(tfCardVolume)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80 col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-rose-700 font-medium">Biaya Admin Bank / Modal</div>
                      <div className="text-base sm:text-lg font-bold text-rose-800 mt-0.5 font-mono">
                        {formatRupiah(tfCardBankCost)}
                      </div>
                    </div>
                  </>
                )}

                {isTagihan && (
                  <>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                      <div className="text-[11px] text-amber-800 font-medium">Saldo Aktif Card Tagihan</div>
                      <div className="text-base sm:text-lg font-bold text-amber-950 mt-0.5 font-mono">
                        {formatRupiah(currentTagihanBalance)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[11px] text-slate-500 font-medium">Jumlah Transaksi Periode</div>
                      <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                        {periodTagihanTransactions.length} <span className="text-xs font-semibold text-slate-500">Trx</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-200/80 col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-amber-700 font-medium">Volume Transaksi Periode</div>
                      <div className="text-base sm:text-lg font-bold text-amber-900 mt-0.5 font-mono">
                        {formatRupiah(tagihanVolume)}
                      </div>
                    </div>
                  </>
                )}

                {isBebanToko && (
                  <>
                    <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80">
                      <div className="text-[11px] text-rose-800 font-medium">Total Beban Operasional</div>
                      <div className="text-base sm:text-lg font-bold text-rose-950 mt-0.5 font-mono">
                        {formatRupiah(data?.totalExpenses || periodExpensesTotal)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="text-[11px] text-slate-500 font-medium">Jumlah Item Beban</div>
                      <div className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                        {periodExpenses.length} <span className="text-xs font-semibold text-slate-500">Item</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 col-span-2 sm:col-span-1">
                      <div className="text-[11px] text-slate-500 font-medium">Kategori Pengeluaran</div>
                      <div className="text-base sm:text-lg font-bold text-slate-800 mt-0.5">
                        {Object.keys(data?.expensesByCategory || {}).length} <span className="text-xs font-semibold text-slate-500">Kategori</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Search Bar */}
              <div className="px-4 sm:px-6 py-2.5 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={operationalSearchQuery}
                    onChange={(e) => setOperationalSearchQuery(e.target.value)}
                    placeholder={
                      isTfCard
                        ? 'Cari no. reff, rute card (Brimo, Seabank, dll), nominal, catatan...'
                        : isTagihan
                        ? 'Cari transaksi tagihan, tujuan, nominal, catatan...'
                        : 'Cari judul beban toko, kategori, nominal, metode bayar...'
                    }
                    className="w-full pl-9 pr-9 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-50/50 focus:bg-white transition"
                  />
                  {operationalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOperationalSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Body / Table / Card List */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-3 min-h-[220px]">
                {activeOperationalFilteredItems.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <ModalIcon className="w-8 h-8 mx-auto text-slate-300 stroke-1" />
                    <p className="text-xs font-medium">
                      {operationalSearchQuery
                        ? 'Tidak ada data yang cocok dengan kata kunci pencarian.'
                        : 'Tidak ada data riwayat pada periode ini.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200/90 shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          {isTfCard && (
                            <tr>
                              <th className="py-2.5 px-3">Tanggal & Waktu</th>
                              <th className="py-2.5 px-3">No. Reff / SN</th>
                              <th className="py-2.5 px-3">Rute Transfer Card</th>
                              <th className="py-2.5 px-3">Akun / Rek Tujuan</th>
                              <th className="py-2.5 px-3 text-right">Nominal Pindah</th>
                              <th className="py-2.5 px-3 text-right">Biaya Modal Bank</th>
                              <th className="py-2.5 px-3">Catatan</th>
                            </tr>
                          )}
                          {isTagihan && (
                            <tr>
                              <th className="py-2.5 px-3">Tanggal & Waktu</th>
                              <th className="py-2.5 px-3">No. Reff</th>
                              <th className="py-2.5 px-3">Layanan / Provider</th>
                              <th className="py-2.5 px-3">Tujuan / Pelanggan</th>
                              <th className="py-2.5 px-3 text-right">Nominal Tagihan</th>
                              <th className="py-2.5 px-3 text-right">Biaya Bank</th>
                              <th className="py-2.5 px-3">Catatan</th>
                            </tr>
                          )}
                          {isBebanToko && (
                            <tr>
                              <th className="py-2.5 px-3">Tanggal</th>
                              <th className="py-2.5 px-3">Kategori</th>
                              <th className="py-2.5 px-3">Judul Pengeluaran</th>
                              <th className="py-2.5 px-3">Sumber Bayar</th>
                              <th className="py-2.5 px-3 text-right">Nominal Biaya</th>
                              <th className="py-2.5 px-3">Catatan</th>
                            </tr>
                          )}
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {isTfCard &&
                            (activeOperationalFilteredItems as DigitalTransaction[]).map((tx, idx) => (
                              <tr key={`${tx.referenceNumber || 'tf'}-${tx.id || idx}-${idx}`} className="hover:bg-slate-50/70 transition">
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                  {formatIndoDateTime(tx.createdAt)}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                                    <span>{tx.referenceNumber || `#${tx.id}`}</span>
                                    {tx.referenceNumber && (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(tx.referenceNumber)}
                                        className="p-0.5 text-slate-400 hover:text-indigo-600 rounded"
                                        title="Salin No. Reff"
                                      >
                                        {copiedRef === tx.referenceNumber ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {tx.provider}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-slate-600">
                                  {tx.targetAccount || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  {formatRupiah(tx.nominal)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-semibold">
                                  {tx.adminBankCost > 0 ? `-${formatRupiah(tx.adminBankCost)}` : 'Rp 0'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate" title={tx.notes}>
                                  {tx.notes || '-'}
                                </td>
                              </tr>
                            ))}

                          {isTagihan &&
                            (activeOperationalFilteredItems as DigitalTransaction[]).map((tx, idx) => (
                              <tr key={`${tx.referenceNumber || 'tagihan'}-${tx.id || idx}-${idx}`} className="hover:bg-slate-50/70 transition">
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                  {formatIndoDateTime(tx.createdAt)}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1 font-mono text-[11px] text-slate-700">
                                    <span>{tx.referenceNumber || `#${tx.id}`}</span>
                                    {tx.referenceNumber && (
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(tx.referenceNumber)}
                                        className="p-0.5 text-slate-400 hover:text-indigo-600 rounded"
                                        title="Salin No. Reff"
                                      >
                                        {copiedRef === tx.referenceNumber ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {tx.provider}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  <div>{tx.targetAccount || '-'}</div>
                                  {tx.customerName && <div className="text-[10px] text-slate-400">{tx.customerName}</div>}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                  {formatRupiah(tx.nominal)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                  {formatRupiah(tx.adminBankCost || 0)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate" title={tx.notes}>
                                  {tx.notes || '-'}
                                </td>
                              </tr>
                            ))}

                          {isBebanToko &&
                            (activeOperationalFilteredItems as StoreExpense[]).map((exp) => (
                              <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                                  {exp.expenseDate}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                                    {exp.category.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {exp.title}
                                </td>
                                <td className="py-2.5 px-3 uppercase text-slate-600 font-medium">
                                  {exp.paidBy || 'cash'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                                  {formatRupiah(exp.amount)}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate" title={exp.notes}>
                                  {exp.notes || '-'}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card List View */}
                    <div className="md:hidden space-y-2.5">
                      {isTfCard &&
                        (activeOperationalFilteredItems as DigitalTransaction[]).map((tx, idx) => (
                          <div key={`${tx.referenceNumber || 'tf'}-${tx.id || idx}-${idx}`} className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs">{tx.provider}</span>
                              <span className="text-[10px] text-slate-500">{formatIndoDateTime(tx.createdAt)}</span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-slate-500">Tujuan:</span>
                              <span className="font-mono font-bold text-slate-800">{tx.targetAccount || '-'}</span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-slate-500">Nominal:</span>
                              <span className="font-mono font-bold text-sky-800">{formatRupiah(tx.nominal)}</span>
                            </div>
                            {tx.adminBankCost > 0 && (
                              <div className="text-xs flex justify-between">
                                <span className="text-slate-500">Biaya Modal Bank:</span>
                                <span className="font-mono font-bold text-rose-600">-{formatRupiah(tx.adminBankCost)}</span>
                              </div>
                            )}
                            {tx.referenceNumber && (
                              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
                                <span className="text-slate-400">No. Reff:</span>
                                <div className="flex items-center gap-1 font-mono text-slate-700">
                                  <span>{tx.referenceNumber}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(tx.referenceNumber)}
                                    className="p-0.5 text-slate-400"
                                  >
                                    {copiedRef === tx.referenceNumber ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                      {isTagihan &&
                        (activeOperationalFilteredItems as DigitalTransaction[]).map((tx, idx) => (
                          <div key={`${tx.referenceNumber || 'tagihan'}-${tx.id || idx}-${idx}`} className="p-3 rounded-xl border border-amber-200/70 bg-amber-50/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs">{tx.provider}</span>
                              <span className="text-[10px] text-slate-500">{formatIndoDateTime(tx.createdAt)}</span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-slate-500">Tujuan / Pelanggan:</span>
                              <span className="font-medium text-slate-800">{tx.targetAccount || tx.customerName || '-'}</span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-slate-500">Nominal:</span>
                              <span className="font-mono font-bold text-amber-900">{formatRupiah(tx.nominal)}</span>
                            </div>
                            {tx.notes && (
                              <div className="text-[11px] text-slate-500 italic pt-1 border-t border-amber-200/40">
                                {tx.notes}
                              </div>
                            )}
                          </div>
                        ))}

                      {isBebanToko &&
                        (activeOperationalFilteredItems as StoreExpense[]).map((exp) => (
                          <div key={exp.id} className="p-3 rounded-xl border border-rose-200/70 bg-rose-50/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900 text-xs">{exp.title}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 uppercase font-semibold">
                                {exp.category.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-slate-500">Tanggal:</span>
                              <span className="text-slate-700">{exp.expenseDate}</span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-slate-500">Sumber Bayar:</span>
                              <span className="text-slate-700 uppercase">{exp.paidBy || 'cash'}</span>
                            </div>
                            <div className="text-xs flex justify-between">
                              <span className="text-slate-500">Nominal:</span>
                              <span className="font-mono font-bold text-rose-700">{formatRupiah(exp.amount)}</span>
                            </div>
                            {exp.notes && (
                              <div className="text-[11px] text-slate-500 italic pt-1 border-t border-rose-200/40">
                                {exp.notes}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-500">
                  Menampilkan <strong>{activeOperationalFilteredItems.length}</strong> data item
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportOperationalCSV(type)}
                    className="sm:hidden px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-semibold"
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOperationalModal(null);
                      setOperationalSearchQuery('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Modal Pop-up Unduh Laporan Keuangan Resmi (PDF / CSV) */}
      {isDownloadModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
          onClick={() => setIsDownloadModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <FileText className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Unduh Laporan Transaksi Finansial</h3>
                  <p className="text-[11px] text-slate-500">Pilih rentang tanggal dan format dokumen resmi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/70 transition cursor-pointer"
                aria-label="Tutup modal unduh laporan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDownloadReport} className="p-5 space-y-4">
              {/* Pilih Tanggal (Date Picker Rentang) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Pilih Tanggal (Rentang Transaksi)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">Dari Tanggal</span>
                    <input
                      type="date"
                      value={downloadStartDate}
                      onChange={(e) => setDownloadStartDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition cursor-pointer"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-500 mb-1">Sampai Tanggal</span>
                    <input
                      type="date"
                      value={downloadEndDate}
                      onChange={(e) => setDownloadEndDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] px-1 pt-0.5 text-slate-500">
                  <span>Data ditemukan pada rentang ini:</span>
                  <span className="font-bold text-emerald-700">{matchedDownloadTxCount} Transaksi</span>
                </div>
              </div>

              {/* Unduh Sebagai (Dropdown PDF / CSV) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Unduh Sebagai
                </label>
                <select
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value as 'pdf' | 'csv')}
                  className="w-full px-3 py-2.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="pdf">PDF — Format Laporan Finansial Resmi (.pdf)</option>
                  <option value="csv">CSV — Data Tabel Spreadsheet (.csv)</option>
                </select>
              </div>

              {/* Info Ringkas Format Dokumen */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-[11px] text-indigo-900 space-y-1">
                <div className="font-bold">Struktur Dokumen Laporan:</div>
                <ul className="list-disc list-inside space-y-0.5 text-indigo-800/90">
                  <li>Header resmi <strong>Agen BRI Pakde Link</strong> &amp; nomor halaman</li>
                  <li>Detail laporan (Kepada Yth, Tanggal Laporan, Periode)</li>
                  <li>Rekap saldo akun (Cash, Brimo 1, Brimo 2, Dana 1/2, Seabank, Tagihan)</li>
                  <li>Tabel riwayat: No. Reff &amp; Waktu, Layanan &amp; Sumber Dana, No. Tujuan &amp; Pelanggan, Nominal Trx, Total Bayar, Margin Fee &amp; Operator</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Konfirmasi Unduh ({downloadFormat.toUpperCase()})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
