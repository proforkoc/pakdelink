import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Printer,
  Search,
  Trash2,
  AlertTriangle,
  X,
  ShieldAlert,
  CreditCard,
  Layers,
  Eye,
  RefreshCw,
  FileText,
  Smartphone,
  Calendar,
  Check,
  TrendingUp,
  Receipt,
  User,
  Phone,
  ShieldCheck,
  ArrowRightLeft,
  Banknote,
  Zap,
  Wallet,
  QrCode,
  ChevronDown,
  Filter,
  Users,
} from 'lucide-react';
import { Sale, DigitalTransaction, ServiceSoftwareOrder } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  executeUnifiedDelete,
  getStoredDigitalTransactions,
  saveStoredDigitalTransactions,
  getStoredSales,
  getStoredServiceOrders,
  onTransactionDeleted,
  onDataUpdated,
} from '../utils/transactionSync.ts';
import {
  subscribeDigitalTransactionsCloud,
  mergeDigitalTransactions,
  normalizeDigitalTransaction,
} from '../services/cloudDigitalFinanceService.ts';
import {
  useBodyScrollLock,
  handleBackdropTouchMove,
  handleBackdropWheel,
  handleModalCardScroll,
} from '../utils/scrollLock.ts';
import { isHutangTransaction } from '../services/accountBalanceService.ts';

export type DigitalCategoryFilter =
  | 'all'
  | 'transfer'
  | 'tarik_tunai'
  | 'ewallet'
  | 'ppob'
  | 'transfer_card'
  | 'tagihan'
  | 'titipan'
  | 'bank_mutation'
  | 'hutang';

export interface UnifiedTransactionItem {
  id: string;
  rawId: number;
  digitalCategory: 'transfer' | 'tarik_tunai' | 'ewallet' | 'ppob' | 'transfer_card' | 'tagihan' | 'titipan' | 'bank_mutation' | 'other';
  categoryLabel: string;
  invoiceNumber: string;
  timestamp: number;
  dateFormatted: string;
  customerName: string;
  targetAccount: string;
  provider: string;
  serviceType: string;
  summary: string;
  paymentMethod: string;
  nominal: number;
  adminStoreFee: number;
  adminBankCost: number;
  totalAmount: number;
  profit: number;
  statusText: string;
  isHutang: boolean;
  statusVariant: 'emerald' | 'blue' | 'amber' | 'purple' | 'slate';
  fundSource?: string;
  operatorName?: string;
  notes?: string;
  rawDigital?: DigitalTransaction;
  rawSale?: Sale;
  rawService?: ServiceSoftwareOrder;
}

interface SalesHistoryModuleProps {
  onReprintSale?: (sale: Sale) => void;
  onReprintDigital?: (tx: DigitalTransaction) => void;
  onReprintService?: (order: ServiceSoftwareOrder) => void;
}

export const SalesHistoryModule: React.FC<SalesHistoryModuleProps> = ({
  onReprintDigital,
  onReprintSale,
  onReprintService,
}) => {
  const { currentRole } = useAuth();
  const isOwner = currentRole === 'owner';

  // State Filter & Search
  const [activeCategory, setActiveCategory] = useState<DigitalCategoryFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Digital Transactions List
  const [digitalList, setDigitalList] = useState<DigitalTransaction[]>(() => {
    return getStoredDigitalTransactions() || [];
  });
  const [salesList, setSalesList] = useState<Sale[]>(() => {
    return getStoredSales() || [];
  });
  const [serviceList, setServiceList] = useState<ServiceSoftwareOrder[]>(() => {
    return getStoredServiceOrders() || [];
  });

  // Modal State
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<UnifiedTransactionItem | null>(null);

  // Delete Modal State (Owner Only)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<UnifiedTransactionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Body Scroll Lock for active modal
  useBodyScrollLock(detailModalOpen || deleteModalOpen);

  const formatRupiah = (val: number) => {
    const num = Math.round(Number(val) || 0);
    const abs = Math.abs(num).toLocaleString('id-ID');
    return num < 0 ? `-Rp ${abs}` : `Rp ${abs}`;
  };
  const formatSignedRupiah = (val: number) => {
    const num = Math.round(Number(val) || 0);
    if (num > 0) return `+${formatRupiah(num)}`;
    if (num < 0) return `-${formatRupiah(Math.abs(num))}`;
    return formatRupiah(0);
  };

  // Load Transactions from Server and fallback to localStorage
  const loadAllTransactions = async () => {
    try {
      const [digiRes, salesRes, srvRes] = await Promise.all([
        fetch('/api/digital-finance?limit=all').catch(() => null),
        fetch('/api/sales?limit=50').catch(() => null),
        fetch('/api/services?limit=50').catch(() => null),
      ]);

      const storedDigital = getStoredDigitalTransactions() || [];
      if (digiRes && digiRes.ok) {
        const digiData = await digiRes.json();
        if (Array.isArray(digiData) && digiData.length > 0) {
          const normalizedServer = digiData.map((d: DigitalTransaction) =>
            normalizeDigitalTransaction(d)
          );
          const merged = mergeDigitalTransactions(storedDigital, normalizedServer);
          setDigitalList(merged);
          saveStoredDigitalTransactions(merged, true);
        } else if (storedDigital.length > 0) {
          setDigitalList(mergeDigitalTransactions(storedDigital));
        }
      } else {
        setDigitalList(mergeDigitalTransactions(storedDigital));
      }

      if (salesRes && salesRes.ok) {
        const salesData = await salesRes.json();
        if (Array.isArray(salesData)) setSalesList(salesData);
      }
      if (srvRes && srvRes.ok) {
        const srvData = await srvRes.json();
        if (Array.isArray(srvData)) setServiceList(srvData);
      }
    } catch (err) {
      console.error('Failed to load transaction history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllTransactions();

    const unsubCloudTx = subscribeDigitalTransactionsCloud((cloudTxs, hasDocs) => {
      if (hasDocs) {
        setDigitalList(cloudTxs);
        saveStoredDigitalTransactions(cloudTxs, true);
      }
    });

    const unsubDelete = onTransactionDeleted((payload) => {
      if (payload.category === 'digital' || payload.category === ('all' as any)) {
        setDigitalList((prev) =>
          prev.filter((d) => d.id !== payload.rawId && d.referenceNumber !== payload.invoiceNumber)
        );
      }
    });

    const unsubUpdate = onDataUpdated((payload) => {
      if (payload.category === 'digital') {
        const latestLocal = getStoredDigitalTransactions() || [];
        if (latestLocal.length > 0) {
          setDigitalList((prev) => mergeDigitalTransactions(prev, latestLocal));
        }
      } else {
        loadAllTransactions();
      }
    });

    return () => {
      unsubCloudTx();
      unsubDelete();
      unsubUpdate();
    };
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadAllTransactions();
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCategory = e.target.value as DigitalCategoryFilter;
    const currentScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    setActiveCategory(nextCategory);
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        if (Math.abs(window.scrollY - currentScrollY) > 2) {
          window.scrollTo({ top: currentScrollY, behavior: 'instant' as ScrollBehavior });
        }
      });
    }
  };

  // Convert raw records into categorized items
  const unifiedTransactions = useMemo<UnifiedTransactionItem[]>(() => {
    const list: UnifiedTransactionItem[] = [];

    // 1. Digital Finance Transactions (Transfer Bank, Tarik Tunai, E-Wallet, PPOB, Transfer Antar Card, Tagihan)
    digitalList.forEach((d, idx) => {
      const date = new Date(d.createdAt);
      const rawType = (d.type || '').toLowerCase();
      const notes = (d.notes || '');
      const provider = (d.provider || '');
      const targetAcc = (d.targetAccount || '').toLowerCase();

      let digitalCategory: 'transfer' | 'tarik_tunai' | 'ewallet' | 'ppob' | 'transfer_card' | 'tagihan' | 'titipan' | 'bank_mutation' = 'transfer';
      let categoryLabel = 'Transfer Bank';
      let statusVariant: 'emerald' | 'blue' | 'amber' | 'purple' | 'slate' = 'blue';

      const isTitipan =
        rawType.startsWith('titipan') ||
        notes.includes('[Titipan]') ||
        (d.paymentMethod || '').toLowerCase() === 'titipan';

      const isBankMutation =
        !isTitipan && (
          rawType === 'bank_admin_bulanan' ||
          rawType === 'bank_bunga_bank' ||
          rawType.includes('admin_bulanan_bank') ||
          rawType.includes('bunga_bank') ||
          notes.includes('[Potongan & Bunga Bank]') ||
          (d.paymentMethod || '').toLowerCase() === 'bank_mutation'
        );

      const isCardTagihan =
        !isTitipan &&
        !isBankMutation && (
          notes.includes('[Tagihan]') ||
          targetAcc === 'card tagihan' ||
          (targetAcc.includes('tagihan') && (rawType.includes('transfer_saldo') || rawType === 'tagihan')) ||
          rawType === 'card_tagihan' ||
          rawType === 'tagihan'
        );

      const isTransferCard =
        !isTitipan &&
        !isBankMutation &&
        !isCardTagihan && (
          rawType.includes('transfer_saldo') ||
          rawType.includes('pindah_dana') ||
          rawType === 'transfer_card' ||
          rawType.includes('antar_card') ||
          notes.includes('[Pindah Dana]') ||
          notes.includes('mutasi internal') ||
          provider.includes('➔') ||
          provider.includes('->')
        );

      if (isTitipan) {
        digitalCategory = 'titipan';
        categoryLabel = 'Transaksi Titipan';
        statusVariant = rawType.includes('keluar') ? 'amber' : 'emerald';
      } else if (isBankMutation) {
        digitalCategory = 'bank_mutation';
        categoryLabel = 'Potongan & Bunga Bank';
        statusVariant = rawType.includes('bunga') ? 'emerald' : 'amber';
      } else if (isCardTagihan) {
        digitalCategory = 'tagihan';
        categoryLabel = 'Tagihan';
        statusVariant = 'amber';
      } else if (isTransferCard) {
        digitalCategory = 'transfer_card';
        categoryLabel = 'Transfer Antar Card';
        statusVariant = 'purple';
      } else if (rawType.includes('tarik') || rawType.includes('cashout')) {
        digitalCategory = 'tarik_tunai';
        categoryLabel = 'Tarik Tunai';
        statusVariant = 'emerald';
      } else if (
        rawType.includes('ewallet') ||
        rawType.includes('topup') ||
        rawType.includes('dana') ||
        rawType.includes('gopay') ||
        rawType.includes('ovo') ||
        rawType.includes('shopee') ||
        rawType.includes('wallet')
      ) {
        digitalCategory = 'ewallet';
        categoryLabel = 'Top Up E-Wallet';
        statusVariant = 'purple';
      } else if (
        rawType.includes('ppob') ||
        rawType.includes('pulsa') ||
        rawType.includes('pln') ||
        rawType.includes('bpjs') ||
        rawType.includes('pdam')
      ) {
        digitalCategory = 'ppob';
        categoryLabel = 'PPOB dan Lainnya';
        statusVariant = 'amber';
      } else {
        digitalCategory = 'transfer';
        categoryLabel = 'Transfer Bank';
        statusVariant = 'blue';
      }

      const totalPaid = Number(d.totalCustomerPaid || (Number(d.nominal || 0) + Number(d.adminStoreFee || 0)));
      const adminStoreFeeNum = Number(d.adminStoreFee || 0);
      const adminBankCostNum = Number(d.adminBankCost || 0);
      const rawProfit =
        d.profit != null && !Number.isNaN(Number(d.profit))
          ? Number(d.profit)
          : adminStoreFeeNum - adminBankCostNum;
      const profit =
        (isCardTagihan || isTransferCard) && rawProfit === 0 && adminStoreFeeNum === 0 && adminBankCostNum > 0
          ? -adminBankCostNum
          : rawProfit;

      const resolvedOperator =
        d.operatorName ||
        (d.notes?.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
        undefined;

      const uniqueItemKey = d.referenceNumber
        ? `digital-${d.referenceNumber}-${d.id ?? idx}-${idx}`
        : `digital-${d.id ?? 'tx'}-${idx}`;

      list.push({
        id: uniqueItemKey,
        rawId: d.id,
        digitalCategory,
        categoryLabel,
        invoiceNumber: d.referenceNumber,
        timestamp: date.getTime() || 0,
        dateFormatted: date.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        customerName: (d.customerName || '').trim(),
        targetAccount: d.targetAccount || '-',
        provider: d.provider || 'Bank/Provider',
        serviceType: d.type.replace(/_/g, ' ').toUpperCase(),
        summary: `${d.provider} • ${d.type.replace(/_/g, ' ').toUpperCase()} (${d.targetAccount})`,
        paymentMethod: d.paymentMethod ? d.paymentMethod.toUpperCase() : 'TUNAI',
        nominal: Number(d.nominal || 0),
        adminStoreFee: Number(d.adminStoreFee || 0),
        adminBankCost: Number(d.adminBankCost || 0),
        totalAmount: totalPaid,
        profit: profit,
        isHutang: isHutangTransaction(d),
        statusText: isHutangTransaction(d) ? 'Hutang' : d.status === 'success' ? 'Lunas' : d.status || 'Lunas',
        statusVariant,
        fundSource: d.fundSource || (d.notes?.match(/\[Sumber(?:\s*Dana)?:\s*([^\]]+)\]/i)?.[1]?.trim()) || undefined,
        operatorName: resolvedOperator,
        notes: d.notes,
        rawDigital: {
          ...d,
          fundSource: d.fundSource || (d.notes?.match(/\[Sumber(?:\s*Dana)?:\s*([^\]]+)\]/i)?.[1]?.trim()) || undefined,
          operatorName: resolvedOperator,
        },
      });
    });

    // Urutan Kronologis: Transaksi TERBARU berada di posisi paling atas
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [digitalList]);

  // Counts for Category Badges
  const counts = useMemo(() => {
    let transfer = 0;
    let tarik_tunai = 0;
    let ewallet = 0;
    let ppob = 0;
    let transfer_card = 0;
    let tagihan = 0;
    let titipan = 0;
    let bank_mutation = 0;
    let hutang = 0;

    unifiedTransactions.forEach((tx) => {
      if (tx.digitalCategory === 'transfer') transfer++;
      else if (tx.digitalCategory === 'tarik_tunai') tarik_tunai++;
      else if (tx.digitalCategory === 'ewallet') ewallet++;
      else if (tx.digitalCategory === 'ppob') ppob++;
      else if (tx.digitalCategory === 'transfer_card') transfer_card++;
      else if (tx.digitalCategory === 'tagihan') tagihan++;
      else if (tx.digitalCategory === 'titipan') titipan++;
      else if (tx.digitalCategory === 'bank_mutation') bank_mutation++;

      if (tx.isHutang) hutang++;
    });

    return {
      all: unifiedTransactions.length,
      transfer,
      tarik_tunai,
      ewallet,
      ppob,
      transfer_card,
      tagihan,
      titipan,
      bank_mutation,
      hutang,
    };
  }, [unifiedTransactions]);

  // Filtered list based on category & search query
  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unifiedTransactions.filter((item) => {
      // Category / Status filter
      if (activeCategory === 'hutang') {
        if (!item.isHutang) return false;
      } else if (activeCategory !== 'all' && item.digitalCategory !== activeCategory) {
        return false;
      }

      // Search filter
      if (!q) return true;
      return (
        item.invoiceNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.operatorName || '').toLowerCase().includes(q) ||
        item.targetAccount.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        (item.notes || '').toLowerCase().includes(q) ||
        item.paymentMethod.toLowerCase().includes(q) ||
        item.statusText.toLowerCase().includes(q)
      );
    });
  }, [unifiedTransactions, activeCategory, search]);

  // Quick KPI calculation (pada tab 'all', mutasi internal & titipan tidak ikut menggandakan volume/omset pelanggan,
  // namun biaya admin bank dari mutasi internal tetap diperhitungkan pada Margin Fee / Profit)
  const summaryKPI = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const isInternalTab =
      activeCategory === 'transfer_card' ||
      activeCategory === 'tagihan' ||
      activeCategory === 'titipan' ||
      activeCategory === 'bank_mutation';
    const kpiSource = isInternalTab
      ? filteredTransactions
      : filteredTransactions.filter(
          (tx) =>
            tx.digitalCategory !== 'transfer_card' &&
            tx.digitalCategory !== 'tagihan' &&
            tx.digitalCategory !== 'titipan' &&
            tx.digitalCategory !== 'bank_mutation'
        );
    const totalVolume = kpiSource.reduce((acc, curr) => acc + curr.nominal, 0);
    const totalTurnover = kpiSource.reduce((acc, curr) => acc + curr.totalAmount, 0);
    const totalProfit = filteredTransactions.reduce((acc, curr) => acc + curr.profit, 0);
    return { totalTransactions, totalVolume, totalTurnover, totalProfit };
  }, [filteredTransactions, activeCategory]);

  // Open Detail Modal
  const handleOpenDetail = (item: UnifiedTransactionItem) => {
    setSelectedTransaction(item);
    setDetailModalOpen(true);
  };

  // Direct Print Action
  const handleDirectPrint = (item: UnifiedTransactionItem) => {
    if (item.rawDigital && onReprintDigital) {
      onReprintDigital(item.rawDigital);
    } else {
      // Fallback synthetic digital transaction for thermal print
      const syntheticDigital: DigitalTransaction = {
        id: item.rawId,
        type: item.serviceType.toLowerCase().replace(/\s+/g, '_'),
        provider: item.provider,
        targetAccount: item.targetAccount,
        customerName: item.customerName,
        nominal: item.nominal,
        adminBankCost: item.adminBankCost,
        adminStoreFee: item.adminStoreFee,
        totalCustomerPaid: item.totalAmount,
        profit: item.profit,
        paymentMethod: item.paymentMethod,
        operatorName: item.operatorName,
        referenceNumber: item.invoiceNumber,
        status: 'success',
        notes: item.notes,
        createdAt: new Date(item.timestamp).toISOString(),
      };
      if (onReprintDigital) {
        onReprintDigital(syntheticDigital);
      }
    }
  };

  // Open Delete Confirmation Modal (Owner Only)
  const handleOpenDelete = (item: UnifiedTransactionItem) => {
    if (!isOwner) return;
    setTransactionToDelete(item);
    setDeleteModalOpen(true);
  };

  // Confirm Delete Operation (Owner Only)
  const handleConfirmDelete = async () => {
    if (!isOwner || !transactionToDelete) return;
    setDeleting(true);

    try {
      const invoice = transactionToDelete.invoiceNumber;
      const targetRawId = transactionToDelete.rawId;

      const resolvedDigitalItem: DigitalTransaction = {
        ...(transactionToDelete.rawDigital || {}),
        id: targetRawId,
        type: transactionToDelete.rawDigital?.type || transactionToDelete.serviceType.toLowerCase().replace(/\s+/g, '_'),
        provider: transactionToDelete.provider,
        targetAccount: transactionToDelete.targetAccount,
        nominal: transactionToDelete.nominal,
        adminBankCost: transactionToDelete.adminBankCost,
        adminStoreFee: transactionToDelete.adminStoreFee,
        totalCustomerPaid: transactionToDelete.totalAmount,
        profit: transactionToDelete.profit,
        paymentMethod: (transactionToDelete.paymentMethod || 'cash').toLowerCase(),
        fundSource: transactionToDelete.fundSource || transactionToDelete.rawDigital?.fundSource,
        referenceNumber: invoice,
        status: 'success',
        notes: transactionToDelete.notes,
        createdAt: new Date(transactionToDelete.timestamp).toISOString(),
      };

      await executeUnifiedDelete({
        category: 'digital',
        rawId: targetRawId,
        invoiceNumber: invoice,
        digitalItem: resolvedDigitalItem,
      });

      setDigitalList((prev) =>
        prev.filter((d) => d.id !== targetRawId && d.referenceNumber !== invoice)
      );

      setDeleteModalOpen(false);
      setTransactionToDelete(null);

      loadAllTransactions();
    } catch (err: any) {
      console.error('Delete transaction failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6 w-full">
      {/* Header Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                  Riwayat Transaksi & Struk Agen
                </h1>
                <span className="hidden lg:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Agen BRILink, E-Wallet & PPOB
                </span>
                {isOwner && (
                  <span className="hidden lg:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-purple-600" />
                    Owner: Hak Hapus Aktif
                  </span>
                )}
              </div>
              <p className="hidden lg:block text-xs text-slate-500 mt-0.5">
                Arsip lengkap mutasi transaksi transfer bank, tarik tunai, top-up e-wallet, dan loket PPOB dengan fitur cetak ulang struk thermal 58mm/80mm.
              </p>
            </div>
          </div>

          {/* Action & Refresh */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              title="Perbarui Riwayat Data"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Cards Focused on Digital Agency */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 pt-1">
          {/* 1. Total Transaksi */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-slate-800 min-h-[76px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span className="truncate">Transaksi Terfilter</span>
              <Receipt className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-slate-900 tabular-nums leading-tight mt-1">
              {summaryKPI.totalTransactions}{' '}
              <span className="text-xs font-medium text-slate-500">Struk</span>
            </div>
          </div>

          {/* 2. Volume Transaksi */}
          <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100 text-slate-800 min-h-[76px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-sky-700">
              <span className="truncate">Volume Nominal Uang</span>
              <TrendingUp className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-sky-900 truncate tabular-nums leading-tight mt-1">
              {formatRupiah(summaryKPI.totalVolume)}
            </div>
          </div>

          {/* 3. Total Tagihan Konsumen */}
          <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-slate-800 min-h-[76px] flex flex-col justify-between">
            <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-700">
              <span className="truncate">Total Uang Diterima</span>
              <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            </div>
            <div className="text-base sm:text-lg font-extrabold text-indigo-900 truncate tabular-nums leading-tight mt-1">
              {formatRupiah(summaryKPI.totalTurnover)}
            </div>
          </div>

          {/* 4. Total Keuntungan Fee Admin Toko */}
          <div
            className={`p-3 rounded-xl border text-slate-800 min-h-[76px] flex flex-col justify-between ${
              summaryKPI.totalProfit < 0
                ? 'bg-rose-50/70 border-rose-100'
                : 'bg-emerald-50/60 border-emerald-100'
            }`}
          >
            <div
              className={`flex items-center justify-between text-[11px] font-semibold ${
                summaryKPI.totalProfit < 0 ? 'text-rose-700' : 'text-emerald-700'
              }`}
            >
              <span className="truncate">Fee Admin Toko (Profit)</span>
              <Check
                className={`w-3.5 h-3.5 shrink-0 ${
                  summaryKPI.totalProfit < 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              />
            </div>
            <div
              className={`text-base sm:text-lg font-extrabold truncate tabular-nums leading-tight mt-1 ${
                summaryKPI.totalProfit < 0 ? 'text-rose-700' : 'text-emerald-800'
              }`}
            >
              {formatSignedRupiah(summaryKPI.totalProfit)}
            </div>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          {/* Dropdown Filter Kategori Transaksi (Lebar terkunci agar tidak bergeser saat pilihan berubah) */}
          <div className="relative w-full lg:w-[272px] shrink-0 inline-flex items-center h-[38px] bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500/20 rounded-xl shadow-2xs transition-colors duration-150">
            <div className="absolute left-3 pointer-events-none flex items-center text-indigo-600">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <select
              value={activeCategory}
              onChange={handleCategoryChange}
              aria-label="Filter kategori transaksi"
              className="w-full h-full pl-8.5 pr-8 py-2 bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer appearance-none border-none ring-0 truncate"
            >
              <option value="all">Semua Transaksi ({counts.all})</option>
              <option value="transfer">Transfer Bank ({counts.transfer})</option>
              <option value="tarik_tunai">Tarik Tunai ({counts.tarik_tunai})</option>
              <option value="ewallet">Top Up E-Wallet ({counts.ewallet})</option>
              <option value="ppob">PPOB dan Lainnya ({counts.ppob})</option>
              <option value="transfer_card">Transfer Antar Card ({counts.transfer_card})</option>
              <option value="tagihan">Tagihan ({counts.tagihan})</option>
              <option value="titipan">Transaksi Titipan ({counts.titipan})</option>
              <option value="bank_mutation">Potongan & Bunga Bank ({counts.bank_mutation})</option>
              <option value="hutang">Hutang ({counts.hutang})</option>
            </select>
            <div className="absolute right-2.5 pointer-events-none flex items-center text-slate-400">
              <ChevronDown className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-64 xl:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari No Reff, nama, rekening/no HP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-[38px] pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white text-slate-800 font-medium placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Unified Transaction List / Table */}
      <div
        className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden min-h-[520px] sm:min-h-[560px] flex flex-col"
        style={{ overflowAnchor: 'none' }}
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
            <p className="text-xs font-semibold">Memuat riwayat transaksi agen...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4 text-slate-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Tidak ada bukti transaksi ditemukan</p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {search
                ? `Tidak ditemukan transaksi dengan kata kunci "${search}".`
                : 'Belum ada transaksi pada filter ini. Transaksi yang dicatat di Agen Digital akan otomatis tersimpan di sini.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop & Tablet Table View (>= 768px) */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full min-w-[1140px] table-fixed text-left text-xs divide-y divide-slate-100">
                <colgroup>
                  <col className="w-[160px]" />
                  <col className="w-auto" />
                  <col className="w-[170px]" />
                  <col className="w-[130px]" />
                  <col className="w-[125px]" />
                  <col className="w-[125px]" />
                  <col className="w-[115px]" />
                  <col className="w-[115px]" />
                </colgroup>
                <thead className="bg-slate-50/90 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200/80 select-none">
                  <tr>
                    <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                      No. Reff & Waktu
                    </th>
                    <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                      Layanan & Sumber Dana
                    </th>
                    <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                      No. Tujuan & Pelanggan
                    </th>
                    <th scope="col" className="px-3.5 py-3 text-right whitespace-nowrap">
                      Nominal Trx
                    </th>
                    <th scope="col" className="px-3.5 py-3 text-right whitespace-nowrap">
                      Total Bayar
                    </th>
                    <th scope="col" className="px-3.5 py-3 text-right whitespace-nowrap">
                      Margin Fee
                    </th>
                    <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                      Operator
                    </th>
                    <th scope="col" className="px-3.5 py-3 text-right whitespace-nowrap">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredTransactions.map((item) => {
                    const isInternalMutasi =
                      item.digitalCategory === 'transfer_card' ||
                      item.digitalCategory === 'tagihan' ||
                      item.digitalCategory === 'titipan' ||
                      item.digitalCategory === 'bank_mutation';
                    const hasCustomerName =
                      Boolean(item.customerName) &&
                      item.customerName.toLowerCase() !== 'pelanggan agen' &&
                      !item.customerName.toLowerCase().includes('mutasi internal');

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* 1. No. Reff & Waktu */}
                        <td className="px-3.5 py-3 overflow-hidden align-middle">
                          <div
                            className="font-mono text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
                            title={item.invoiceNumber}
                          >
                            {item.invoiceNumber}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{item.dateFormatted}</span>
                          </div>
                        </td>

                        {/* 2. Layanan & Sumber Dana */}
                        <td className="px-3.5 py-3 overflow-hidden align-middle">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.digitalCategory === 'transfer' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                Transfer Bank
                              </span>
                            )}
                            {item.digitalCategory === 'tarik_tunai' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                <Banknote className="w-2.5 h-2.5" />
                                Tarik Tunai
                              </span>
                            )}
                            {item.digitalCategory === 'ewallet' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                <Wallet className="w-2.5 h-2.5" />
                                E-Wallet
                              </span>
                            )}
                            {item.digitalCategory === 'ppob' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                <Zap className="w-2.5 h-2.5" />
                                PPOB dan Lainnya
                              </span>
                            )}
                            {item.digitalCategory === 'transfer_card' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 shrink-0">
                                <RefreshCw className="w-2.5 h-2.5" />
                                Transfer Antar Card
                              </span>
                            )}
                            {item.digitalCategory === 'tagihan' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                <Receipt className="w-2.5 h-2.5" />
                                Tagihan
                              </span>
                            )}
                            {item.digitalCategory === 'titipan' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                                <Users className="w-2.5 h-2.5" />
                                Transaksi Titipan
                              </span>
                            )}
                            {item.digitalCategory === 'bank_mutation' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                <CreditCard className="w-2.5 h-2.5" />
                                Potongan & Bunga Bank
                              </span>
                            )}

                            <span
                              className="text-[9.5px] font-bold text-slate-600 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 max-w-full truncate"
                              title={item.provider}
                            >
                              {item.provider}
                            </span>
                            {item.fundSource && (
                              <span
                                className="text-[9.5px] font-bold text-indigo-700 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-mono max-w-full truncate"
                                title={item.fundSource}
                              >
                                {item.fundSource}
                              </span>
                            )}
                            {item.isHutang && (
                              <span className="text-[9.5px] font-bold text-rose-700 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 shrink-0">
                                HUTANG
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. No. Tujuan & Pelanggan */}
                        <td className="px-3.5 py-3 overflow-hidden align-middle">
                          <div className="font-mono text-xs font-bold text-slate-900 truncate" title={item.targetAccount}>
                            {item.targetAccount}
                          </div>
                          {hasCustomerName && (
                            <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5" title={item.customerName}>
                              <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span className="truncate">{item.customerName}</span>
                            </div>
                          )}
                        </td>

                        {/* 4. Nominal Trx */}
                        <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                          <div
                            className={`font-semibold truncate ${
                              item.digitalCategory === 'bank_mutation'
                                ? item.serviceType.includes('BUNGA')
                                  ? 'text-emerald-700'
                                  : 'text-rose-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {item.digitalCategory === 'bank_mutation'
                              ? `${item.serviceType.includes('BUNGA') ? '+' : '-'}${formatRupiah(item.nominal)}`
                              : formatRupiah(item.nominal)}
                          </div>
                          {item.adminStoreFee > 0 && (
                            <div className="text-[10px] text-slate-400 truncate">
                              Admin: {formatRupiah(item.adminStoreFee)}
                            </div>
                          )}
                          {item.digitalCategory === 'titipan' && item.adminBankCost > 0 && (
                            <div className="text-[10px] text-rose-500 truncate">
                              Admin: {formatRupiah(item.adminBankCost)}
                            </div>
                          )}
                        </td>

                        {/* 5. Total Bayar */}
                        <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                          {isInternalMutasi ? (
                            <span className="text-slate-400 text-[11px]">-</span>
                          ) : (
                            <div className="font-extrabold text-slate-900 truncate">
                              {formatRupiah(item.totalAmount)}
                            </div>
                          )}
                        </td>

                        {/* 6. Margin Fee */}
                        <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                          {isInternalMutasi && item.profit === 0 ? (
                            <span className="text-slate-400 text-[11px]">-</span>
                          ) : (
                            <div className="inline-flex flex-col items-end max-w-full">
                              <span
                                className={`font-bold px-1.5 py-0.5 rounded border max-w-full truncate ${
                                  item.profit < 0
                                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                                    : item.profit === 0
                                    ? 'text-slate-600 bg-slate-50 border-slate-200'
                                    : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                }`}
                              >
                                {formatSignedRupiah(item.profit)}
                              </span>
                              {!isInternalMutasi && item.adminBankCost > 0 && (
                                <span className="text-[9.5px] text-rose-500 font-medium mt-0.5 truncate max-w-full">
                                  Modal: {formatRupiah(item.adminBankCost)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 7. Operator */}
                        <td className="px-3.5 py-3 overflow-hidden align-middle whitespace-nowrap">
                          {item.operatorName ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 max-w-full"
                              title={item.operatorName}
                            >
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{item.operatorName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                        </td>

                        {/* 8. Aksi (Cetak, Detail, Hapus) */}
                        <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleDirectPrint(item)}
                              title="Cetak Ulang Struk Thermal"
                              className="p-1.5 rounded-lg text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 border border-indigo-200/80 transition-colors duration-150 cursor-pointer shadow-2xs"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenDetail(item)}
                              title="Lihat Rincian Lengkap"
                              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-200/80 border border-slate-200 transition-colors duration-150 cursor-pointer shadow-2xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleOpenDelete(item)}
                                title="Hapus Bukti Transaksi (Khusus Owner)"
                                className="p-1.5 rounded-lg text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 transition-colors duration-150 cursor-pointer shadow-2xs"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100 flex-1">
              {filteredTransactions.map((item) => {
                const isInternalMutasi =
                  item.digitalCategory === 'transfer_card' ||
                  item.digitalCategory === 'tagihan' ||
                  item.digitalCategory === 'titipan' ||
                  item.digitalCategory === 'bank_mutation';
                const hasCustomerName =
                  Boolean(item.customerName) &&
                  item.customerName.toLowerCase() !== 'pelanggan agen' &&
                  !item.customerName.toLowerCase().includes('mutasi internal');

                return (
                  <div key={item.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-extrabold text-slate-900">
                        {item.invoiceNumber}
                      </span>
                      {item.fundSource ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                          {item.fundSource}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {item.categoryLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      <span className="font-bold text-slate-800">{item.provider}</span>
                      <span className="text-slate-400">&bull;</span>
                      <span className="text-slate-600 font-medium">{item.categoryLabel}</span>
                      {item.isHutang && (
                        <span className="text-[9.5px] font-bold text-rose-700 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 leading-none">
                          HUTANG
                        </span>
                      )}
                    </div>

                    <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Tujuan:</span>
                        <span className="font-mono font-bold text-slate-800">{item.targetAccount}</span>
                      </div>
                      {hasCustomerName && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">
                            {item.digitalCategory === 'titipan'
                              ? 'Penitip:'
                              : item.digitalCategory === 'bank_mutation'
                              ? 'Keterangan:'
                              : 'Pelanggan:'}
                          </span>
                          <span className="font-medium text-slate-700">{item.customerName}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500">Operator:</span>
                        <span className="font-semibold text-slate-700">{item.operatorName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nominal:</span>
                        <span
                          className={`font-semibold ${
                            item.digitalCategory === 'bank_mutation'
                              ? item.serviceType.includes('BUNGA')
                                ? 'text-emerald-700'
                                : 'text-rose-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {item.digitalCategory === 'bank_mutation'
                            ? `${item.serviceType.includes('BUNGA') ? '+' : '-'}${formatRupiah(item.nominal)}`
                            : formatRupiah(item.nominal)}
                        </span>
                      </div>
                      {item.digitalCategory === 'titipan' && item.adminBankCost > 0 && (
                        <div className="flex justify-between text-rose-600 text-[11px]">
                          <span>Biaya Admin:</span>
                          <span>{formatRupiah(item.adminBankCost)}</span>
                        </div>
                      )}
                      {!isInternalMutasi && (
                        <div className="flex justify-between pt-1 border-t border-slate-200">
                          <span className="text-slate-700 font-bold">Total Bayar:</span>
                          <span className="font-extrabold text-slate-900">{formatRupiah(item.totalAmount)}</span>
                        </div>
                      )}
                      {(!isInternalMutasi || item.profit !== 0) && (
                        <div
                          className={`flex justify-between font-bold ${
                            item.profit < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          <span>Margin Fee:</span>
                          <span>{formatSignedRupiah(item.profit)}</span>
                        </div>
                      )}
                      {!isInternalMutasi && item.adminBankCost > 0 && (
                        <div className="flex justify-between text-rose-600 text-[11px]">
                          <span>Modal Bank:</span>
                          <span>{formatRupiah(item.adminBankCost)}</span>
                        </div>
                      )}
                    </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">{item.dateFormatted}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDirectPrint(item)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors duration-150 select-none"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Cetak</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDetail(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors duration-150 select-none"
                      >
                        Detail
                      </button>

                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleOpenDelete(item)}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 border border-rose-200 cursor-pointer transition-colors duration-150 select-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal Detail Transaksi Agen */}
      {detailModalOpen && selectedTransaction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200 no-print"
          style={{ overscrollBehavior: 'contain' }}
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200 overflow-y-auto max-h-[90vh]"
            style={{ overscrollBehavior: 'contain' }}
            onWheel={handleModalCardScroll}
            onTouchMove={handleModalCardScroll}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Rincian Transaksi Keagenan
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {selectedTransaction.invoiceNumber}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Rincian */}
            <div className="space-y-3 text-xs">
              {/* Metadata Informasi */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Waktu Transaksi:</span>
                  <span className="font-semibold text-slate-800">{selectedTransaction.dateFormatted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kategori:</span>
                  <span className="font-bold text-indigo-700">{selectedTransaction.categoryLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Layanan & Provider:</span>
                  <span className="font-bold text-slate-900">{selectedTransaction.provider} • {selectedTransaction.serviceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {selectedTransaction.digitalCategory === 'bank_mutation'
                      ? 'Sisa Saldo Akhir:'
                      : 'Nomor Rekening / Tujuan:'}
                  </span>
                  <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {selectedTransaction.targetAccount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">
                    {selectedTransaction.digitalCategory === 'titipan'
                      ? 'Nama Penitip:'
                      : selectedTransaction.digitalCategory === 'bank_mutation'
                      ? 'Keterangan:'
                      : 'Nama Pelanggan:'}
                  </span>
                  <span className="font-semibold text-slate-800">{selectedTransaction.customerName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operator:</span>
                  <span className="font-semibold text-slate-800">{selectedTransaction.operatorName || '-'}</span>
                </div>
                {selectedTransaction.fundSource && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sumber Dana:</span>
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                      {selectedTransaction.fundSource}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status Pembayaran:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded border text-[10.5px] ${
                      selectedTransaction.isHutang
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    {selectedTransaction.isHutang ? 'Hutang (Belum Lunas)' : 'Lunas'}
                  </span>
                </div>
                {selectedTransaction.notes && (
                  <div className="pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                    <span className="font-semibold text-slate-700 block mb-0.5">Catatan / Reff:</span>
                    <span>{selectedTransaction.notes}</span>
                  </div>
                )}
              </div>

              {/* Rincian Finansial Nominal & Admin */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Kalkulasi Keuangan Transaksi</span>
                </h4>

                <div className="space-y-1.5 pt-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Nominal Transaksi (Penyaluran):</span>
                    <span className="font-bold text-slate-900">{formatRupiah(selectedTransaction.nominal)}</span>
                  </div>

                  {selectedTransaction.digitalCategory !== 'titipan' &&
                    selectedTransaction.digitalCategory !== 'bank_mutation' && (
                      <div className="flex justify-between text-slate-600">
                        <span>Biaya Admin Jasa Toko (ke Konsumen):</span>
                        <span className="font-semibold text-slate-800">+{formatRupiah(selectedTransaction.adminStoreFee)}</span>
                      </div>
                    )}

                  {selectedTransaction.adminBankCost > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>
                        {selectedTransaction.digitalCategory === 'titipan'
                          ? 'Biaya Admin Penarikan / Transfer:'
                          : selectedTransaction.digitalCategory === 'bank_mutation'
                          ? 'Potongan Admin Bulanan Bank:'
                          : 'Beban Admin Bank / Sistem:'}
                      </span>
                      <span>
                        {selectedTransaction.digitalCategory === 'titipan'
                          ? formatRupiah(selectedTransaction.adminBankCost)
                          : `-${formatRupiah(selectedTransaction.adminBankCost)}`}
                      </span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold">
                    <span className="text-slate-800">
                      {selectedTransaction.digitalCategory === 'titipan' ||
                      selectedTransaction.digitalCategory === 'bank_mutation'
                        ? 'Total Potong / Mutasi Saldo:'
                        : 'Total Uang Diterima dari Konsumen:'}
                    </span>
                    <span className="text-base text-slate-900">
                      {selectedTransaction.digitalCategory === 'transfer_card' ||
                      selectedTransaction.digitalCategory === 'tagihan'
                        ? '-'
                        : formatRupiah(selectedTransaction.totalAmount)}
                    </span>
                  </div>

                  <div
                    className={`p-2 rounded-lg border flex justify-between items-center font-bold ${
                      selectedTransaction.profit < 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                    }`}
                  >
                    <span>Keuntungan Bersih Toko (Margin Fee):</span>
                    <span className="text-sm">{formatSignedRupiah(selectedTransaction.profit)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => {
                  setDetailModalOpen(false);
                  handleDirectPrint(selectedTransaction);
                }}
                className="px-4 py-2 min-h-[40px] rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Struk Thermal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Faktur / Struk (KHUSUS ROLE OWNER) */}
      {deleteModalOpen && transactionToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-200 no-print"
          style={{ overscrollBehavior: 'contain' }}
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200"
            style={{ overscrollBehavior: 'contain' }}
            onWheel={handleModalCardScroll}
            onTouchMove={handleModalCardScroll}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Hapus Bukti Transaksi?
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {transactionToDelete.invoiceNumber}
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-rose-50/70 p-3.5 rounded-xl border border-rose-200/80 space-y-2">
              <p className="font-semibold text-rose-900">
                Peringatan Otoritas Pemilik Toko (Owner):
              </p>
              <p>
                Bukti transaksi keagenan <strong className="text-slate-900">{transactionToDelete.invoiceNumber}</strong> ({transactionToDelete.provider} - {transactionToDelete.targetAccount}) senilai <strong className="text-slate-900">{formatRupiah(transactionToDelete.totalAmount)}</strong> akan dihapus permanen dari sistem dan cloud database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Permanen</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
