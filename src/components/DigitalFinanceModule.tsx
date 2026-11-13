import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CreditCard,
  Printer,
  Search,
  ArrowRightLeft,
  Smartphone,
  Zap,
  Send,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Eye,
  Trash2,
  AlertTriangle,
  X,
  FileText,
  Banknote,
  Wallet,
  Edit2,
  Receipt,
  Coins,
  RefreshCw,
  Plus,
  ShieldCheck,
  ArrowRight,
  ArrowDownRight,
  Check,
  Lock,
  HandCoins,
  Bell,
  ChevronDown,
  Users,
  Calendar,
  User,
} from 'lucide-react';
import { DigitalTransaction } from '../types/index.ts';
import {
  getStoredDigitalTransactions,
  saveStoredDigitalTransactions,
  executeUnifiedDelete,
  onTransactionDeleted,
  onDataUpdated,
  notifyDataUpdated,
} from '../utils/transactionSync.ts';
import {
  useBodyScrollLock,
  handleBackdropTouchMove,
  handleBackdropWheel,
  handleModalCardScroll,
} from '../utils/scrollLock.ts';
import {
  FundSourceKey,
  HutangReceiverAccountKey,
  AccountBalances,
  FUND_SOURCES_CONFIG,
  getStoredAccountBalances,
  saveStoredAccountBalances,
  updateAccountBalance,
  adjustBrimo1Balance,
  adjustCashBalance,
  transferBetweenAccountBalances,
  calculateCashToDana2Total,
  calculateAllBalancesTotal,
  processTransactionBalanceDeduction,
  onAccountBalancesUpdated,
  getStoredTagihanNote,
  saveStoredTagihanNote,
  MarginFeeLedgerState,
  getLocalDateKey,
  getStoredMarginFeeLedger,
  saveStoredMarginFeeLedger,
  calculateMarginFeeSummary,
  takeMarginFeeFromCash,
  onMarginFeeLedgerUpdated,
  isHutangTransaction,
  getTransactionHutangAmount,
  settleHutangTransactionBalance,
  isTagihanTransaction,
  settleTagihanTransactionBalance,
} from '../services/accountBalanceService.ts';
import {
  saveDigitalTransactionToCloud,
  subscribeDigitalTransactionsCloud,
  saveAccountBalancesToCloud,
  subscribeAccountBalancesCloud,
  subscribeMarginFeeLedgerCloud,
  mergeDigitalTransactions,
  normalizeDigitalTransaction,
  TitipanAccount,
  getStoredTitipanAccounts,
  saveStoredTitipanAccounts,
  saveTitipanAccountToCloud,
  deleteTitipanAccountFromCloud,
  subscribeTitipanAccountsCloud,
} from '../services/cloudDigitalFinanceService.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface DigitalFinanceModuleProps {
  onPrintReceipt: (tx: DigitalTransaction) => void;
}

export interface ProviderOption {
  value: string;
  label: string;
}

export const BANK_PROVIDERS: ProviderOption[] = [
  { value: 'BRI', label: 'Bank BRI' },
  { value: 'BCA', label: 'Bank BCA' },
  { value: 'MANDIRI', label: 'Bank Mandiri' },
  { value: 'BNI', label: 'Bank BNI' },
  { value: 'BSI', label: 'Bank Syariah Indonesia (BSI)' },
  { value: 'SEABANK', label: 'SeaBank' },
  { value: 'JAGO', label: 'Bank Jago / Neo' },
  { value: 'CIMB', label: 'CIMB Niaga' },
  { value: 'PERMATA', label: 'Bank Permata' },
  { value: 'DANAMON', label: 'Bank Danamon' },
  { value: 'BTN', label: 'Bank BTN' },
  { value: 'BTPN', label: 'BTPN / Jenius' },
  { value: 'BANK_LAIN', label: 'Bank Lainnya (ATM Bersama/Prima)' },
];

export const EWALLET_PROVIDERS: ProviderOption[] = [
  { value: 'DANA', label: 'DANA' },
  { value: 'GOPAY', label: 'GoPay Customer' },
  { value: 'GOPAY_DRIVER', label: 'GoPay Driver' },
  { value: 'OVO', label: 'OVO' },
  { value: 'SHOPEEPAY', label: 'ShopeePay' },
  { value: 'LINKAJA', label: 'LinkAja' },
  { value: 'MAXIM', label: 'Maxim Customer / Driver' },
  { value: 'GRAB_DRIVER', label: 'Grab Driver' },
  { value: 'ASTRAPAY', label: 'AstraPay' },
  { value: 'ISAKU', label: 'i.saku Indomaret' },
];

export const PLN_PROVIDERS: ProviderOption[] = [
  { value: 'PLN', label: 'PLN Token Listrik Prabayar' },
  { value: 'PLN_POSTPAID', label: 'PLN Tagihan Pascabayar' },
  { value: 'PLN_NONTAGLIS', label: 'PLN Non-Taglis' },
];

export const PULSA_PROVIDERS: ProviderOption[] = [
  { value: 'TELKOMSEL', label: 'Telkomsel (SimPATI / As)' },
  { value: 'BYU', label: 'by.U (Telkomsel)' },
  { value: 'INDOSAT', label: 'Indosat Ooredoo (IM3)' },
  { value: 'XL', label: 'XL Axiata' },
  { value: 'AXIS', label: 'Axis' },
  { value: 'TRI', label: 'Tri (3)' },
  { value: 'SMARTFREN', label: 'Smartfren' },
];

export const TAGIHAN_PROVIDERS: ProviderOption[] = [
  { value: 'PLN_TAGIHAN', label: 'PLN Tagihan' },
  { value: 'BPJS', label: 'BPJS Kesehatan' },
  { value: 'PDAM', label: 'PDAM Air' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

export const TARIK_TUNAI_PROVIDERS: ProviderOption[] = [
  { value: 'Brimo 1', label: 'Brimo 1' },
  { value: 'Brimo 2', label: 'Brimo 2' },
  { value: 'Dana 1', label: 'Dana 1' },
  { value: 'Dana 2', label: 'Dana 2' },
  { value: 'Seabank', label: 'Seabank' },
];

export const getAvailableProviders = (type: string): ProviderOption[] => {
  if (type === 'brilink_tarik_tunai' || type.includes('tarik') || type.includes('cashout')) {
    return TARIK_TUNAI_PROVIDERS;
  }
  if (type === 'brilink_transfer' || type.startsWith('brilink')) {
    return BANK_PROVIDERS;
  }
  if (type === 'topup_ewallet' || type.includes('ewallet')) {
    return EWALLET_PROVIDERS;
  }
  if (
    type === 'ppob_tagihan' ||
    type.startsWith('ppob') ||
    type.includes('tagihan') ||
    type.includes('pln') ||
    type.includes('pulsa')
  ) {
    return TAGIHAN_PROVIDERS;
  }
  return BANK_PROVIDERS;
};

export const DigitalFinanceModule: React.FC<DigitalFinanceModuleProps> = ({ onPrintReceipt }) => {
  const { currentRole, operatorName, activeStaff } = useAuth();
  const isOwner = currentRole === 'owner';

  // Transaksi State
  const [transactions, setTransactions] = useState<DigitalTransaction[]>(() => {
    return getStoredDigitalTransactions() || [];
  });
  const [loading, setLoading] = useState(false);

  // Saldo Akun State (Cash, Brimo 1, Brimo 2, Dana 1, Dana 2, Seabank)
  const [balances, setBalances] = useState<AccountBalances>(() => {
    return getStoredAccountBalances();
  });

  // Modal Update Saldo State
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedAccountForUpdate, setSelectedAccountForUpdate] = useState<FundSourceKey | null>(null);
  const [newBalanceInput, setNewBalanceInput] = useState<number>(0);
  const [isBalanceFieldEditable, setIsBalanceFieldEditable] = useState(false);
  const [savingBalance, setSavingBalance] = useState(false);
  const balanceInputRef = React.useRef<HTMLInputElement | null>(null);

  // State Khusus Penyesuaian / Mutasi Modal Brimo 1
  const [brimo1MutationType, setBrimo1MutationType] = useState<
    'mutasi_antar_card' | 'admin_bulanan_bank' | 'bunga_bank'
  >('mutasi_antar_card');
  const [bankMutationNominal, setBankMutationNominal] = useState<number>(0);
  const [bankMutationNote, setBankMutationNote] = useState<string>('');

  // State Pilihan Card Ringkasan pada Tampilan Tablet & Mobile
  type SummaryCardKey =
    | 'cash'
    | 'brimo1'
    | 'brimo2'
    | 'dana1'
    | 'dana2'
    | 'seabank'
    | 'tagihan'
    | 'titipan'
    | 'hutang'
    | 'perputaran'
    | 'margin_fee';
  const [selectedSummaryCard, setSelectedSummaryCard] = useState<SummaryCardKey>('cash');

  // State Transfer Antar Card (Ambil Saldo dari Card Lain)
  const [transferSourceCard, setTransferSourceCard] = useState<FundSourceKey>('brimo2');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferBankCost, setTransferBankCost] = useState<number>(0);
  const [transferAdminFee, setTransferAdminFee] = useState<number>(0);

  // Form State for New Transaction
  const [transType, setTransType] = useState<string>('brilink_transfer');
  const [provider, setProvider] = useState<string>('BRI');
  const [customProviderName, setCustomProviderName] = useState<string>('');
  const customProviderInputRef = React.useRef<HTMLInputElement | null>(null);
  const [fundSource, setFundSource] = useState<FundSourceKey>('brimo1');
  const [targetAccount, setTargetAccount] = useState<string>('');
  const [ewalletSubmitAttempted, setEwalletSubmitAttempted] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [operatorInput, setOperatorInput] = useState<string>('');
  const [nominal, setNominal] = useState<number>(0);
  const [adminBankCost, setAdminBankCost] = useState<number>(0); // modal potong sistem
  const [adminStoreFee, setAdminStoreFee] = useState<number>(0); // tagihan ke konsumen
  const [hasTypedAdminStoreFeeZero, setHasTypedAdminStoreFeeZero] = useState<boolean>(false);
  const [adminFeeType, setAdminFeeType] = useState<'outside' | 'inside'>('outside'); // 'outside' = Potong Luar, 'inside' = Potong Dalam
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmTxModalOpen, setConfirmTxModalOpen] = useState(false);
  const [txPaymentStatus, setTxPaymentStatus] = useState<'lunas' | 'hutang'>('lunas');
  const [hutangModalOpen, setHutangModalOpen] = useState(false);
  const [hutangDetailTarget, setHutangDetailTarget] = useState<DigitalTransaction | null>(null);
  const [hutangConfirmTarget, setHutangConfirmTarget] = useState<DigitalTransaction | null>(null);
  const [hutangReceiverAccount, setHutangReceiverAccount] =
    useState<HutangReceiverAccountKey>('cash');
  const [settlingHutangKey, setSettlingHutangKey] = useState<string | null>(null);

  // Modal Card Tagihan (Daftar Riwayat Tagihan + Tambah Tagihan / Catat Bon dari Sumber Dana)
  const [tagihanListModalOpen, setTagihanListModalOpen] = useState(false);
  const [tagihanModalOpen, setTagihanModalOpen] = useState(false);
  const [tagihanDetailTarget, setTagihanDetailTarget] = useState<DigitalTransaction | null>(null);
  const [tagihanConfirmTarget, setTagihanConfirmTarget] = useState<DigitalTransaction | null>(null);
  const [settlingTagihanKey, setSettlingTagihanKey] = useState<string | null>(null);
  const [tagihanPeruntukanMode, setTagihanPeruntukanMode] = useState<'ketik_tagihan' | 'gaji_karyawan'>('ketik_tagihan');
  const [tagihanCustomNote, setTagihanCustomNote] = useState<string>('');
  const [tagihanNoteInput, setTagihanNoteInput] = useState<string>('');
  const [tagihanAddAmount, setTagihanAddAmount] = useState<number>(0);
  const [tagihanNote, setTagihanNote] = useState<string>(() => getStoredTagihanNote());
  const [tagihanTransferSourceCard, setTagihanTransferSourceCard] = useState<FundSourceKey>('cash');
  const [tagihanBankCost, setTagihanBankCost] = useState<number>(0);
  const [tagihanAdminFee, setTagihanAdminFee] = useState<number>(0);
  const [peruntukanDropdownOpen, setPeruntukanDropdownOpen] = useState(false);
  const tagihanNoteInputRef = React.useRef<HTMLInputElement | null>(null);
  const peruntukanDropdownRef = React.useRef<HTMLDivElement | null>(null);

  // State Reset Harian (00:00) & Pengambilan Margin Fee (Khusus Owner)
  const [todayDateKey, setTodayDateKey] = useState<string>(() => getLocalDateKey());
  const [marginFeeLedger, setMarginFeeLedger] = useState<MarginFeeLedgerState>(() =>
    getStoredMarginFeeLedger()
  );
  const [takeFeeModalOpen, setTakeFeeModalOpen] = useState(false);
  const [takeIncludeToday, setTakeIncludeToday] = useState(true);
  const [takeIncludePrevious, setTakeIncludePrevious] = useState(true);
  const [takeFeeError, setTakeFeeError] = useState<string>('');

  // State Card Titipan & Daftar Penitip
  const [titipanAccounts, setTitipanAccounts] = useState<TitipanAccount[]>(() =>
    getStoredTitipanAccounts()
  );
  const [titipanModalOpen, setTitipanModalOpen] = useState(false);
  const [addPenitipModalOpen, setAddPenitipModalOpen] = useState(false);
  const [newPenitipName, setNewPenitipName] = useState('');
  const [newPenitipNominal, setNewPenitipNominal] = useState<number>(0);

  const [topupPenitipTarget, setTopupPenitipTarget] = useState<TitipanAccount | null>(null);
  const [topupPenitipAmount, setTopupPenitipAmount] = useState<number>(0);

  const [tarikPenitipTarget, setTarikPenitipTarget] = useState<TitipanAccount | null>(null);
  const [tarikJenisTransaksi, setTarikJenisTransaksi] = useState<'Transfer' | 'Tarik Tunai'>('Transfer');
  const [tarikNoRekening, setTarikNoRekening] = useState('');
  const [tarikNominal, setTarikNominal] = useState<number>(0);
  const [tarikAdminFee, setTarikAdminFee] = useState<number>(0);
  const [deletePenitipTarget, setDeletePenitipTarget] = useState<TitipanAccount | null>(null);
  const [savingTitipan, setSavingTitipan] = useState(false);

  // Tutup modal update saldo / ambil fee otomatis jika role bukan Owner
  useEffect(() => {
    if (!isOwner && updateModalOpen) {
      setUpdateModalOpen(false);
      setSelectedAccountForUpdate(null);
    }
    if (!isOwner && takeFeeModalOpen) {
      setTakeFeeModalOpen(false);
    }
  }, [isOwner, updateModalOpen, takeFeeModalOpen]);

  const hasTitipanChildModalOpen =
    addPenitipModalOpen ||
    Boolean(topupPenitipTarget) ||
    Boolean(tarikPenitipTarget) ||
    Boolean(deletePenitipTarget);

  // Lock body scroll whenever any modal in this module is active
  useBodyScrollLock(
    confirmTxModalOpen ||
      hutangModalOpen ||
      Boolean(hutangDetailTarget) ||
      Boolean(hutangConfirmTarget) ||
      (isOwner && updateModalOpen) ||
      tagihanListModalOpen ||
      tagihanModalOpen ||
      Boolean(tagihanDetailTarget) ||
      Boolean(tagihanConfirmTarget) ||
      (isOwner && takeFeeModalOpen) ||
      titipanModalOpen ||
      hasTitipanChildModalOpen
  );

  // Close peruntukan dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        peruntukanDropdownRef.current &&
        !peruntukanDropdownRef.current.contains(e.target as Node)
      ) {
        setPeruntukanDropdownOpen(false);
      }
    };
    if (peruntukanDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [peruntukanDropdownOpen]);

  const formatRupiah = (val: number) => {
    const num = Math.round(Number(val) || 0);
    const abs = Math.abs(num).toLocaleString('id-ID');
    return num < 0 ? `-Rp ${abs}` : `Rp ${abs}`;
  };
  const formatSignedRupiah = (val: number) => {
    const num = Math.round(Number(val) || 0);
    if (num > 0) return `+${formatRupiah(num)}`;
    if (num < 0) return `-${formatRupiah(Math.abs(num))}`;
    return `+${formatRupiah(0)}`;
  };

  // Helper formatting mata uang Rupiah langsung di input field (kosong jika 0 agar bersih & langsung siap ketik, e.g. Rp 5.000.000, Rp 1.000)
  const formatCurrencyInput = (val: number): string => {
    const num = Math.max(0, Math.round(Number(val) || 0));
    if (num === 0) return '';
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  // Helper parsing input Rupiah kembali ke angka integer murni untuk kalkulasi matematis
  const parseCurrencyInput = (text: string): number => {
    const digits = text.replace(/\D/g, '');
    if (!digits) return 0;
    return Math.min(parseInt(digits, 10) || 0, 10000000000);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} • ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  const getServiceBadge = (type: string, notes?: string, provider?: string) => {
    const t = (type || '').toLowerCase();
    const n = (notes || '').toLowerCase();
    const p = (provider || '').toLowerCase();

    if (t.startsWith('titipan') || n.includes('[titipan]')) {
      return {
        label: 'Transaksi Titipan',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
      };
    }

    if (
      t.startsWith('bank_admin') ||
      t.startsWith('bank_bunga') ||
      n.includes('[potongan & bunga bank]')
    ) {
      return {
        label: 'Potongan & Bunga Bank',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    }

    if (
      t.includes('transfer_saldo') ||
      t.includes('pindah_dana') ||
      t.includes('mutasi') ||
      t === 'transfer_card' ||
      n.includes('transfer saldo') ||
      n.includes('pindah dana') ||
      n.includes('ambil saldo') ||
      p.includes('➔')
    ) {
      return {
        label: 'Transfer Antar Card',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    }
    if (t.startsWith('brilink') || t.includes('bank')) {
      return {
        label: 'BRILink / Bank',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    }
    if (t.includes('ewallet')) {
      return {
        label: 'E-Wallet',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (t.startsWith('ppob') || t.includes('pulsa') || t.includes('pln') || t.includes('tagihan')) {
      return {
        label: 'PPOB & Lainnya',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    return {
      label: type.replace(/_/g, ' ').toUpperCase(),
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  };

  // Get human readable label for fund source
  const getFundSourceLabel = (key: string) => {
    switch (key.toLowerCase()) {
      case 'cash':
        return 'Cash';
      case 'brimo1':
        return 'Brimo 1';
      case 'brimo2':
        return 'Brimo 2';
      case 'dana1':
        return 'Dana 1';
      case 'dana2':
        return 'Dana 2';
      case 'seabank':
        return 'Seabank';
      case 'tagihan':
        return 'Tagihan (Manual)';
      default:
        return key;
    }
  };

  const loadTransactions = async () => {
    const localStored = getStoredDigitalTransactions() || [];
    try {
      const res = await fetch('/api/digital-finance?limit=all').catch(() => null);
      if (res && res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const normalizedServer = data.map((item: DigitalTransaction) =>
              normalizeDigitalTransaction(item)
            );
            const merged = mergeDigitalTransactions(localStored, normalizedServer);
            setTransactions(merged);
            saveStoredDigitalTransactions(merged, true);
            return;
          }
        }
      }
      if (localStored.length > 0) {
        setTransactions(mergeDigitalTransactions(localStored));
      }
    } catch (err) {
      console.warn('Mode static/cloud untuk transaksi digital:', err);
      if (localStored.length > 0) {
        setTransactions(mergeDigitalTransactions(localStored));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();

    let isInitialCloudSnapshot = true;
    let sawCloudDocs = false;
    const unsubCloudTx = subscribeDigitalTransactionsCloud((cloudTxs, hasDocs) => {
      if (hasDocs) {
        isInitialCloudSnapshot = false;
        sawCloudDocs = true;
        setTransactions(cloudTxs);
        saveStoredDigitalTransactions(cloudTxs, true);
      } else if (isInitialCloudSnapshot) {
        isInitialCloudSnapshot = false;
        const localStored = getStoredDigitalTransactions() || [];
        if (localStored.length > 0) {
          const normalized = mergeDigitalTransactions(localStored);
          setTransactions(normalized);
          normalized.forEach((tx) => {
            saveDigitalTransactionToCloud(tx).catch(() => {});
          });
        }
      } else if (sawCloudDocs) {
        setTransactions([]);
        saveStoredDigitalTransactions([], true);
      }
    });

    let hasInitializedCloudBalances = false;
    const unsubCloudBalances = subscribeAccountBalancesCloud((cloudBalances, cloudNote, exists) => {
      if (exists && cloudBalances) {
        hasInitializedCloudBalances = true;
        setBalances(cloudBalances);
        saveStoredAccountBalances(cloudBalances, false);
        if (cloudNote !== undefined) {
          setTagihanNote(cloudNote);
          saveStoredTagihanNote(cloudNote, false);
        }
      } else if (!hasInitializedCloudBalances) {
        hasInitializedCloudBalances = true;
        const localBal = getStoredAccountBalances();
        const localNote = getStoredTagihanNote();
        saveAccountBalancesToCloud(localBal, localNote).catch(() => {});
      }
    });

    let hasInitializedCloudLedger = false;
    const unsubCloudLedger = subscribeMarginFeeLedgerCloud((cloudLedger, exists) => {
      if (exists && cloudLedger) {
        hasInitializedCloudLedger = true;
        const nextLedger: MarginFeeLedgerState = {
          baselineDateKey: cloudLedger.baselineDateKey || getLocalDateKey(),
          takenByDate: cloudLedger.takenByDate || {},
          history: cloudLedger.history || [],
        };
        setMarginFeeLedger(nextLedger);
        saveStoredMarginFeeLedger(nextLedger, false);
      } else if (!hasInitializedCloudLedger) {
        hasInitializedCloudLedger = true;
        const cleanLedger: MarginFeeLedgerState = {
          baselineDateKey: getLocalDateKey(),
          takenByDate: {},
          history: [],
        };
        setMarginFeeLedger(cleanLedger);
        saveStoredMarginFeeLedger(cleanLedger, true);
      }
    });

    // Reaktif: Dengarkan event update saldo & catatan pengambilan Margin Fee antar komponen
    const unsubBalances = onAccountBalancesUpdated((newBalances) => {
      setBalances(newBalances);
    });
    const unsubMarginLedger = onMarginFeeLedgerUpdated((updatedLedger) => {
      setMarginFeeLedger(updatedLedger);
    });

    // Reaktif: Dengarkan event penghapusan transaksi
    const unsubscribeDelete = onTransactionDeleted((payload) => {
      if (payload.category === 'digital' || payload.category === ('all' as any)) {
        setTransactions((prev) => {
          const updated = prev.filter((tx) => {
            if (payload.rawId && tx.id === payload.rawId) return false;
            if (payload.invoiceNumber && tx.referenceNumber === payload.invoiceNumber) return false;
            return true;
          });
          saveStoredDigitalTransactions(updated, true);
          return updated;
        });
      }
    });

    const unsubscribeUpdate = onDataUpdated((payload) => {
      if (payload.category === 'digital' || payload.category === 'all') {
        const latestLocal = getStoredDigitalTransactions() || [];
        if (latestLocal.length > 0) {
          setTransactions((prev) => mergeDigitalTransactions(prev, latestLocal));
        }
      }
    });

    let isInitialTitipanSnapshot = true;
    let sawCloudTitipanDocs = false;
    const unsubCloudTitipan = subscribeTitipanAccountsCloud((cloudTitipan, hasDocs) => {
      if (hasDocs) {
        isInitialTitipanSnapshot = false;
        sawCloudTitipanDocs = true;
        setTitipanAccounts(cloudTitipan);
        saveStoredTitipanAccounts(cloudTitipan);
      } else if (isInitialTitipanSnapshot) {
        isInitialTitipanSnapshot = false;
        const localTitipan = getStoredTitipanAccounts();
        if (localTitipan.length > 0) {
          setTitipanAccounts(localTitipan);
          localTitipan.forEach((item) => {
            saveTitipanAccountToCloud(item).catch(() => {});
          });
        }
      } else if (sawCloudTitipanDocs) {
        setTitipanAccounts([]);
        saveStoredTitipanAccounts([]);
      }
    });

    return () => {
      unsubCloudTx();
      unsubCloudBalances();
      unsubCloudLedger();
      unsubCloudTitipan();
      unsubBalances();
      unsubMarginLedger();
      unsubscribeDelete();
      unsubscribeUpdate();
    };
  }, []);

  // Reset otomatis tepat pukul 00:00 (tengah malam waktu lokal) tanpa perlu refresh halaman
  useEffect(() => {
    const syncTodayDate = () => {
      const latestKey = getLocalDateKey();
      if (latestKey && latestKey !== todayDateKey) {
        setTodayDateKey(latestKey);
      }
    };

    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      150
    );
    const msUntilMidnight = Math.max(1000, nextMidnight.getTime() - now.getTime());

    const midnightTimer = window.setTimeout(syncTodayDate, msUntilMidnight);
    const pollTimer = window.setInterval(syncTodayDate, 15000);
    window.addEventListener('focus', syncTodayDate);
    document.addEventListener('visibilitychange', syncTodayDate);

    return () => {
      window.clearTimeout(midnightTimer);
      window.clearInterval(pollTimer);
      window.removeEventListener('focus', syncTodayDate);
      document.removeEventListener('visibilitychange', syncTodayDate);
    };
  }, [todayDateKey]);

  // Deteksi jenis layanan aktif adalah Tarik Tunai
  const isTarikTunai = transType === 'brilink_tarik_tunai' || transType.includes('tarik');

  // Opsi provider yang disaring dinamis sesuai jenis layanan aktif
  const availableProviders = useMemo(() => getAvailableProviders(transType), [transType]);

  // Pastikan provider terpilih selalu valid dengan opsi yang tersedia untuk jenis layanan aktif
  useEffect(() => {
    if (availableProviders.length > 0 && !availableProviders.some((p) => p.value === provider)) {
      setProvider(availableProviders[0].value);
    }
  }, [availableProviders, provider]);

  // Pastikan jika layanan aktif adalah Tarik Tunai, sumber dana hanya boleh 'cash'
  // Dan jika berpindah ke layanan selain Tarik Tunai, reset tipe admin kembali ke 'outside' (Potong Luar)
  useEffect(() => {
    if (isTarikTunai && fundSource !== 'cash') {
      setFundSource('cash');
    }
    if (!isTarikTunai && adminFeeType !== 'outside') {
      setAdminFeeType('outside');
    }
  }, [isTarikTunai, fundSource, adminFeeType]);

  // Preset providers & sumber dana saat mengganti jenis transaksi (auto-select opsi pertama)
  const handleTypeChange = (newType: string) => {
    setTransType(newType);
    setEwalletSubmitAttempted(false);
    setHasTypedAdminStoreFeeZero(false);

    if (newType !== 'brilink_tarik_tunai' && !newType.includes('tarik')) {
      setAdminFeeType('outside');
    }

    // Auto-Select Default Option: Selalu pilih opsi pertama dari kategori yang sesuai
    const available = getAvailableProviders(newType);
    if (available.length > 0) {
      setProvider(available[0].value);
    }
    setCustomProviderName('');

    if (newType === 'brilink_transfer') {
      setFundSource('brimo1');
    } else if (newType === 'brilink_tarik_tunai') {
      setFundSource('cash');
    } else if (newType === 'topup_ewallet') {
      setFundSource('dana1');
    } else if (newType === 'ppob_tagihan' || newType.startsWith('ppob')) {
      setFundSource('brimo1');
    }
  };

  const totalCustomerPaid =
    isTarikTunai && adminFeeType === 'inside'
      ? Math.max(0, (Number(nominal) || 0) - (Number(adminStoreFee) || 0))
      : (Number(nominal) || 0) + (Number(adminStoreFee) || 0);
  const netProfit = (Number(adminStoreFee) || 0) - (Number(adminBankCost) || 0);

  // Estimasi sisa saldo setelah transaksi
  const currentFundBalance =
    fundSource === 'atm_pelanggan'
      ? 0
      : (balances[fundSource as keyof AccountBalances] || 0);
  const totalDeductedFromSource = (Number(nominal) || 0) + (Number(adminBankCost) || 0);
  const estimatedRemainingBalance =
    fundSource === 'atm_pelanggan'
      ? 0
      : isTarikTunai && fundSource === 'cash'
      ? currentFundBalance - totalDeductedFromSource + (Number(adminStoreFee) || 0)
      : currentFundBalance - totalDeductedFromSource;
  const isInsufficientBalance =
    fundSource !== 'atm_pelanggan' && estimatedRemainingBalance < 0;
  const balanceShortfall = isInsufficientBalance ? Math.abs(estimatedRemainingBalance) : 0;

  // Validasi kelengkapan seluruh field wajib + kecukupan saldo sumber dana
  const isProviderValid =
    provider.trim().length > 0 &&
    (provider !== 'LAINNYA' || customProviderName.trim().length > 0);
  const isEwallet = transType === 'topup_ewallet';
  const isEwalletTargetValid = !isEwallet || targetAccount.length === 12;
  const isTargetAccountValid = isTarikTunai || (targetAccount.trim().length > 0 && isEwalletTargetValid);
  const isAdminStoreFeeValid =
    Number.isFinite(Number(adminStoreFee)) &&
    (Number(adminStoreFee) > 0 || (Number(adminStoreFee) === 0 && hasTypedAdminStoreFeeZero));
  const isFormValid =
    transType.trim().length > 0 &&
    Boolean(fundSource) &&
    isProviderValid &&
    operatorInput.trim().length > 0 &&
    isTargetAccountValid &&
    Number(nominal) > 0 &&
    isAdminStoreFeeValid &&
    !isInsufficientBalance;

  // Modal Update Saldo Handlers (Khusus Role Owner)
  const handleOpenUpdateBalance = (key: FundSourceKey) => {
    if (!isOwner) return;
    setSelectedAccountForUpdate(key);
    setNewBalanceInput(balances[key] || 0);

    setIsBalanceFieldEditable(false);
    setBrimo1MutationType('mutasi_antar_card');
    setBankMutationNominal(0);
    setBankMutationNote('');

    // Tentukan sumber dana asal default yang bukan card tujuan
    const availableSources = (FUND_SOURCES_CONFIG.map((cfg) => cfg.key) as FundSourceKey[]).filter(
      (k) => k !== key
    );
    // Pilih sumber dengan saldo tertinggi sebagai default rekomendasi
    const bestDefault = availableSources.reduce((best, curr) => {
      return (balances[curr] || 0) > (balances[best] || 0) ? curr : best;
    }, availableSources[0] || 'brimo2');

    setTransferSourceCard(bestDefault);
    setTransferAmount(0);
    setTransferBankCost(0);
    setTransferAdminFee(0);
    setUpdateModalOpen(true);
  };

  const handleEnableBalanceEdit = () => {
    if (!isOwner) return;
    setIsBalanceFieldEditable(true);
    setTimeout(() => {
      if (balanceInputRef.current) {
        balanceInputRef.current.focus();
        balanceInputRef.current.select();
      }
    }, 50);
  };

  const handleSaveUpdatedBalance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !selectedAccountForUpdate) return;
    setSavingBalance(true);

    try {
      // Nilai newBalanceInput boleh Rp 0 secara fleksibel (untuk Brimo 1 input mewakili Total Saldo rekening)
      const validAmount = Math.max(0, Math.round(Number(newBalanceInput) || 0));
      const updated = updateAccountBalance(selectedAccountForUpdate, validAmount);
      setBalances(updated);
      setUpdateModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui saldo akun');
    } finally {
      setSavingBalance(false);
    }
  };

  const handleSaveBankAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !isOwner ||
      (selectedAccountForUpdate !== 'brimo1' && selectedAccountForUpdate !== 'brimo2')
    ) {
      return;
    }
    if (brimo1MutationType !== 'admin_bulanan_bank' && brimo1MutationType !== 'bunga_bank') return;

    const cleanNominal = Math.max(0, Math.round(Number(bankMutationNominal) || 0));
    if (cleanNominal <= 0) {
      alert('Nominal harus lebih dari Rp 0.');
      return;
    }

    const isBrimo1 = selectedAccountForUpdate === 'brimo1';
    const currentTotalSaldo = Math.max(0, balances[selectedAccountForUpdate] || 0);
    const saldoLabel = isBrimo1 ? 'Total Saldo Brimo 1' : 'Saldo Brimo 2';

    if (brimo1MutationType === 'admin_bulanan_bank' && cleanNominal > currentTotalSaldo) {
      alert(
        `${saldoLabel} tidak mencukupi!\nTersedia: ${formatRupiah(currentTotalSaldo)}\nNominal Potongan: ${formatRupiah(cleanNominal)}`
      );
      return;
    }

    setSavingBalance(true);
    try {
      const isAdminBulanan = brimo1MutationType === 'admin_bulanan_bank';
      const nextTotalSaldo = isAdminBulanan
        ? Math.max(0, currentTotalSaldo - cleanNominal)
        : currentTotalSaldo + cleanNominal;
      const updated = updateAccountBalance(selectedAccountForUpdate, nextTotalSaldo);
      setBalances(updated);

      const cardLabel = isBrimo1 ? 'Brimo 1' : 'Brimo 2';
      const providerLabel = isAdminBulanan ? 'ADMIN BULANAN BANK' : 'BUNGA BANK';
      const actionType = isAdminBulanan ? 'bank_admin_bulanan' : 'bank_bunga_bank';
      const cleanNote = bankMutationNote.trim();
      const refNumber = `BNK-${Date.now().toString().slice(-6)}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`;
      const nowIso = new Date().toISOString();
      const saldoAkhirDisplay = `Sisa Saldo: ${formatRupiah(nextTotalSaldo)}`;
      const nextRealSaldo = nextTotalSaldo - totalTitipanBalance;
      const saldoDetailText = isBrimo1
        ? `Total Saldo Brimo 1: ${formatRupiah(currentTotalSaldo)} ➔ ${formatRupiah(nextTotalSaldo)} (Real Saldo: ${formatRupiah(nextRealSaldo)} | Titipan: ${formatRupiah(totalTitipanBalance)})`
        : `Sisa Saldo: ${formatRupiah(currentTotalSaldo)} ➔ ${formatRupiah(nextTotalSaldo)}`;
      const noteDetail = `[Potongan & Bunga Bank] ${
        isAdminBulanan ? 'Admin Bulanan Bank' : 'Bunga Bank'
      } (${cardLabel}) • ${
        isAdminBulanan ? 'Potongan' : 'Penambahan'
      }: ${formatRupiah(cleanNominal)} • ${saldoDetailText}${
        cleanNote ? ` • Catatan: ${cleanNote}` : ''
      }`;

      const tx = normalizeDigitalTransaction({
        id: Date.now() + Math.floor(Math.random() * 1000),
        type: actionType,
        provider: providerLabel,
        targetAccount: saldoAkhirDisplay,
        customerName:
          cleanNote ||
          (isAdminBulanan ? 'Biaya Admin Bulanan Bank' : 'Penambahan Bunga Bank'),
        nominal: cleanNominal,
        adminBankCost: isAdminBulanan ? cleanNominal : 0,
        adminStoreFee: 0,
        totalCustomerPaid: cleanNominal,
        profit: 0,
        paymentMethod: 'bank_mutation',
        fundSource: cardLabel,
        operatorName: activeStaff?.name || operatorName || 'Owner',
        referenceNumber: refNumber,
        status: 'success',
        notes: noteDetail,
        createdAt: nowIso,
      });

      saveDigitalTransactionToCloud(tx).catch(() => {});
      setTransactions((prev) => {
        const updatedList = mergeDigitalTransactions([tx], prev);
        saveStoredDigitalTransactions(updatedList, true);
        return updatedList;
      });
      notifyDataUpdated('digital');

      setBankMutationNominal(0);
      setBankMutationNote('');
      setUpdateModalOpen(false);
    } catch (err: any) {
      alert(
        err.message ||
          `Gagal menyimpan penyesuaian saldo ${isBrimo1 ? 'Brimo 1' : 'Brimo 2'}`
      );
    } finally {
      setSavingBalance(false);
    }
  };

  const handleOpenTagihanModal = () => {
    setTagihanPeruntukanMode('ketik_tagihan');
    setTagihanCustomNote('');
    setTagihanNoteInput('');
    setTagihanAddAmount(0);
    setTagihanBankCost(0);
    setTagihanAdminFee(0);
    const availableSources = (['cash', 'brimo1', 'brimo2', 'dana1', 'dana2', 'seabank'] as FundSourceKey[]);
    setTagihanTransferSourceCard(availableSources[0]);
    setTagihanModalOpen(true);
    setTimeout(() => {
      if (tagihanNoteInputRef.current) {
        tagihanNoteInputRef.current.focus();
      }
    }, 100);
  };

  const handleSaveTambahTagihan = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveNote = tagihanPeruntukanMode === 'gaji_karyawan'
      ? 'Pembayaran Gaji Karyawan'
      : (tagihanCustomNote || tagihanNoteInput);
    const cleanNote = effectiveNote.trim();
    if (!cleanNote) {
      alert('Silakan isi Keterangan / Peruntukan tagihan terlebih dahulu (*).');
      return;
    }

    if (tagihanAddAmount <= 0) {
      alert('Silakan masukkan nominal tagihan (> Rp 0).');
      return;
    }

    if (tagihanTransferSourceCard === 'tagihan') {
      alert('Sumber dana asal dan tujuan tidak boleh sama.');
      return;
    }

    const sourceBal = balances[tagihanTransferSourceCard] || 0;
    const totalRequired = tagihanAddAmount + tagihanBankCost + tagihanAdminFee;
    if (sourceBal < totalRequired) {
      alert(
        `Saldo ${getFundSourceLabel(tagihanTransferSourceCard)} tidak mencukupi!\nTersedia: ${formatRupiah(sourceBal)}\nDibutuhkan: ${formatRupiah(totalRequired)} (termasuk biaya modal bank & biaya admin).`
      );
      return;
    }

    setSavingBalance(true);
    try {
      const result = transferBetweenAccountBalances({
        sourceKey: tagihanTransferSourceCard,
        targetKey: 'tagihan',
        transferAmount: tagihanAddAmount,
        adminBankCost: tagihanBankCost,
        adminTransferFee: tagihanAdminFee,
      });

      if (!result.success) {
        throw new Error(result.message || 'Gagal memindahkan saldo ke tagihan');
      }

      setBalances(result.balances);
      saveStoredTagihanNote(cleanNote);
      setTagihanNote(cleanNote);

      const sourceLabel = getFundSourceLabel(tagihanTransferSourceCard);
      const targetLabel = 'Card Tagihan';
      const refNumber = `TGH-${Date.now().toString().slice(-6)}`;
      const currentOperator = activeStaff?.name || operatorName || 'Owner';
      const noteDetail = `[Tagihan] ${cleanNote} - Ambil saldo ${formatRupiah(tagihanAddAmount)} dari ${sourceLabel} ke ${targetLabel}. Biaya Modal Bank: ${formatRupiah(tagihanBankCost)}, Biaya Admin: ${formatRupiah(tagihanAdminFee)}`;
      const txPayload = {
        type: 'transfer_saldo_antar_card',
        provider: `${sourceLabel} ➔ ${targetLabel}`,
        targetAccount: targetLabel,
        customerName: cleanNote,
        nominal: tagihanAddAmount,
        adminBankCost: tagihanBankCost + tagihanAdminFee,
        adminStoreFee: 0,
        totalCustomerPaid: totalRequired,
        profit: -(tagihanBankCost + tagihanAdminFee),
        paymentMethod: 'tagihan',
        status: 'tagihan',
        fundSource: sourceLabel,
        operatorName: currentOperator,
        notes: noteDetail,
        referenceNumber: refNumber,
      };

      let rawSaved: any = null;
      try {
        const res = await fetch('/api/digital-finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txPayload),
        });
        if (res.ok) {
          rawSaved = await res.json();
        }
      } catch (logErr) {
        console.warn('Catatan transaksi mutasi internal tagihan gagal dikirim ke server (disimpan ke lokal & cloud):', logErr);
      }

      const savedTx = normalizeDigitalTransaction({
        ...txPayload,
        ...(rawSaved || {}),
        id: rawSaved?.id || Date.now(),
        paymentMethod: 'tagihan',
        status: 'tagihan',
        fundSource: rawSaved?.fundSource || sourceLabel,
        operatorName: rawSaved?.operatorName || currentOperator,
        createdAt: rawSaved?.createdAt || new Date().toISOString(),
      });

      saveDigitalTransactionToCloud(savedTx).catch(() => {});
      setTransactions((prev) => {
        const updated = mergeDigitalTransactions([savedTx], prev);
        saveStoredDigitalTransactions(updated, true);
        return updated;
      });
      notifyDataUpdated('digital');

      setTagihanModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses penambahan tagihan');
    } finally {
      setSavingBalance(false);
    }
  };

  const handleProcessTransferBetweenCards = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !selectedAccountForUpdate) return;
    if (transferSourceCard === selectedAccountForUpdate) {
      alert('Sumber dana asal dan tujuan tidak boleh sama.');
      return;
    }
    if (transferAmount <= 0) {
      alert('Nominal saldo yang diambil harus lebih dari Rp 0.');
      return;
    }

    const sourceBal = balances[transferSourceCard] || 0;
    // Total potongan dari sumber dana mencakup nominal transfer + biaya bank + admin transfer
    const totalRequired = transferAmount + transferBankCost + transferAdminFee;
    if (sourceBal < totalRequired) {
      alert(
        `Saldo ${getFundSourceLabel(transferSourceCard)} tidak mencukupi!\nTersedia: ${formatRupiah(sourceBal)}\nDibutuhkan: ${formatRupiah(totalRequired)} (termasuk biaya transfer bank & admin transfer).`
      );
      return;
    }

    setSavingBalance(true);
    try {
      // 1. Eksekusi transfer saldo antar akun (real-time pemotongan sumber & penambahan target)
      const result = transferBetweenAccountBalances({
        sourceKey: transferSourceCard,
        targetKey: selectedAccountForUpdate,
        transferAmount,
        adminBankCost: transferBankCost,
        adminTransferFee: transferAdminFee,
      });

      if (!result.success) {
        throw new Error(result.message || 'Gagal memindahkan saldo');
      }

      setBalances(result.balances);

      const sourceLabel = getFundSourceLabel(transferSourceCard);
      const targetLabel = getFundSourceLabel(selectedAccountForUpdate);

      // 2. Simpan catatan mutasi internal ke database Cloud Firestore & API backend (jika aktif)
      const refNumber = `TRF-${Date.now().toString().slice(-6)}`;
      const noteDetail = `[Pindah Dana] Ambil saldo ${formatRupiah(transferAmount)} dari ${sourceLabel} ke ${targetLabel}. Biaya Bank: ${formatRupiah(transferBankCost)}, Admin Transfer: ${formatRupiah(transferAdminFee)} (Total potong dari ${sourceLabel}: ${formatRupiah(totalRequired)})`;
      const txPayload = {
        type: 'transfer_saldo_antar_card',
        provider: `${sourceLabel} ➔ ${targetLabel}`,
        targetAccount: targetLabel,
        customerName: 'Mutasi Internal Saldo',
        nominal: transferAmount,
        adminBankCost: transferBankCost + transferAdminFee,
        adminStoreFee: 0,
        totalCustomerPaid: totalRequired,
        profit: -(transferBankCost + transferAdminFee),
        paymentMethod: 'cash',
        status: 'success',
        fundSource: sourceLabel,
        operatorName: activeStaff?.name || operatorName || 'Owner',
        notes: noteDetail,
        referenceNumber: refNumber,
      };

      let rawSaved: any = null;
      try {
        const res = await fetch('/api/digital-finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txPayload),
        });
        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            rawSaved = await res.json();
          }
        }
      } catch (logErr) {
        console.warn('Catatan mutasi internal dikirim ke Cloud Firestore langsung:', logErr);
      }

      const savedTx = normalizeDigitalTransaction({
        ...txPayload,
        ...(rawSaved || {}),
        id: rawSaved?.id || Date.now(),
        fundSource: rawSaved?.fundSource || sourceLabel,
        operatorName: rawSaved?.operatorName || txPayload.operatorName,
        createdAt: rawSaved?.createdAt || new Date().toISOString(),
      });

      await saveDigitalTransactionToCloud(savedTx);
      setTransactions((prev) => {
        const updated = mergeDigitalTransactions([savedTx], prev);
        saveStoredDigitalTransactions(updated, true);
        return updated;
      });
      notifyDataUpdated('digital');

      setUpdateModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal memproses pemindahan saldo');
    } finally {
      setSavingBalance(false);
    }
  };

  const handleResetForm = () => {
    setTargetAccount('');
    setEwalletSubmitAttempted(false);
    setCustomerName('');
    setOperatorInput('');
    setNominal(0);
    setAdminBankCost(0);
    setAdminStoreFee(0);
    setHasTypedAdminStoreFeeZero(false);
    setAdminFeeType('outside');
    setNotes('');
    setCustomProviderName('');
    if (provider === 'LAINNYA' && availableProviders.length > 0) {
      setProvider(availableProviders[0].value);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transType === 'topup_ewallet' && targetAccount.length !== 12) {
      setEwalletSubmitAttempted(true);
      return;
    }
    if (!isFormValid || isInsufficientBalance) {
      return;
    }
    setTxPaymentStatus('lunas');
    setConfirmTxModalOpen(true);
  };

  const handleConfirmSubmitTransaction = async () => {
    if (submitting) return;
    if (transType === 'topup_ewallet' && targetAccount.length !== 12) {
      setEwalletSubmitAttempted(true);
      setConfirmTxModalOpen(false);
      return;
    }
    if (!isFormValid || isInsufficientBalance) {
      setConfirmTxModalOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      const selectedPaymentMethod = txPaymentStatus === 'hutang' ? 'hutang' : 'cash';
      const fundLabel = getFundSourceLabel(fundSource);
      const cleanOperator = operatorInput.trim();
      const feeNote = isTarikTunai && adminFeeType === 'inside' ? '(Admin Potong Dalam)' : '';
      const combinedNotes = [
        notes.trim() ? `[Sumber: ${fundLabel}] ${notes.trim()}` : `[Sumber Dana: ${fundLabel}]`,
        `[Operator: ${cleanOperator}]`,
        feeNote,
      ]
        .filter(Boolean)
        .join(' ');

      const finalProvider =
        provider === 'LAINNYA'
          ? (customProviderName.trim() || 'LAINNYA')
          : provider;

      const finalTargetAccount = targetAccount.trim()
        ? targetAccount.trim()
        : isTarikTunai
        ? fundSource === 'atm_pelanggan'
          ? 'Rekening Nasabah'
          : 'Rekening Internal'
        : '';

      const txPayload = {
        type: transType,
        provider: finalProvider.toUpperCase(),
        targetAccount: finalTargetAccount,
        customerName: customerName.trim() || (isTarikTunai ? 'Tarik Tunai' : 'Pelanggan'),
        operatorName: cleanOperator,
        nominal,
        adminBankCost: adminBankCost || 0,
        adminStoreFee: adminStoreFee || 0,
        totalCustomerPaid,
        profit: (adminStoreFee || 0) - (adminBankCost || 0),
        paymentMethod: selectedPaymentMethod,
        fundSource: fundLabel,
        notes: combinedNotes,
        referenceNumber: `${finalProvider.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-6)}`,
      };

      let rawSaved: Partial<DigitalTransaction> | null = null;
      let validationErrorMsg: string | null = null;
      try {
        const res = await fetch('/api/digital-finance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txPayload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          rawSaved = await res.json();
        } else if (res.status === 400 && contentType.includes('application/json')) {
          const err = await res.json();
          validationErrorMsg = err.error || 'Gagal menyimpan transaksi';
        }
      } catch {
        // Fallback ke Cloud Firestore secara langsung saat mode static/publish
      }
      if (validationErrorMsg) {
        throw new Error(validationErrorMsg);
      }

      const savedTx: DigitalTransaction = normalizeDigitalTransaction({
        ...txPayload,
        ...(rawSaved || {}),
        id: rawSaved?.id || Date.now(),
        paymentMethod: rawSaved?.paymentMethod || selectedPaymentMethod,
        fundSource: fundLabel,
        operatorName: rawSaved?.operatorName || cleanOperator,
        createdAt: rawSaved?.createdAt || new Date().toISOString(),
      });

      // Simpan permanen ke Cloud Firestore agar aman saat app di-publish
      await saveDigitalTransactionToCloud(savedTx);

      // Potong / sesuaikan saldo akun secara otomatis sesuai Sumber Dana, Provider, dan Status Pembayaran
      const updatedBalances = processTransactionBalanceDeduction({
        fundSourceKey: fundSource,
        provider: finalProvider,
        type: transType,
        nominal,
        adminBankCost: adminBankCost || 0,
        adminStoreFee: adminStoreFee || 0,
        totalCustomerPaid,
        paymentMethod: selectedPaymentMethod,
      });
      setBalances(updatedBalances);

      // Update state & localStorage secara reaktif tanpa memicu fetch loop
      setTransactions((prev) => {
        const updated = mergeDigitalTransactions([savedTx], prev);
        saveStoredDigitalTransactions(updated, true);
        return updated;
      });
      notifyDataUpdated('digital');

      // Reset form fields
      setTargetAccount('');
      setCustomerName('');
      setOperatorInput('');
      setNominal(0);
      setAdminBankCost(0);
      setAdminStoreFee(0);
      setHasTypedAdminStoreFeeZero(false);
      setAdminFeeType('outside');
      setNotes('');
      setCustomProviderName('');
      if (provider === 'LAINNYA' && availableProviders.length > 0) {
        setProvider(availableProviders[0].value);
      }
      setTxPaymentStatus('lunas');
      setConfirmTxModalOpen(false);

      // Cetak struk otomatis / siap cetak
      onPrintReceipt(savedTx);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Transaksi Hari Ini (00:00:00 - 23:59:59 waktu lokal, tanpa batas jumlah transaksi, mutasi internal tetap terhitung)
  const todayTransactions = useMemo(
    () =>
      transactions.filter(
        (tx) => Boolean(tx?.createdAt) && getLocalDateKey(tx.createdAt!) === todayDateKey
      ),
    [transactions, todayDateKey]
  );

  // Kalkulasi Card Perputaran Hari Ini (Reset jam 00:00)
  const totalDigitalVolume = useMemo(
    () =>
      todayTransactions.reduce(
        (acc, cur) => acc + (Number(cur.totalCustomerPaid) || Number(cur.nominal) || 0),
        0
      ),
    [todayTransactions]
  );

  // Kalkulasi Card Margin Fee Hari Ini (Opsi 1: sisa belum diambil hari ini, reset jam 00:00) + Opsi B tunggakan sebelumnya
  const marginFeeSummary = useMemo(
    () => calculateMarginFeeSummary(transactions, marginFeeLedger, todayDateKey),
    [transactions, marginFeeLedger, todayDateKey]
  );
  const totalDigitalMargin = marginFeeSummary.todayRemainingFee;
  const previousUnclaimedFee = marginFeeSummary.previousUnclaimedFee;

  // Handlers Ambil Margin Fee (Khusus Role Owner, selalu dipotong dari saldo Cash)
  const handleOpenTakeFeeModal = () => {
    if (!isOwner) return;
    if (marginFeeSummary.totalAvailableToTake <= 0) return;
    setTakeIncludeToday(marginFeeSummary.todayRemainingFee > 0);
    setTakeIncludePrevious(marginFeeSummary.previousUnclaimedFee > 0);
    setTakeFeeError('');
    setTakeFeeModalOpen(true);
  };

  const selectedTakeAmount =
    (takeIncludeToday ? Math.max(0, marginFeeSummary.todayRemainingFee) : 0) +
    (takeIncludePrevious ? marginFeeSummary.previousUnclaimedFee : 0);

  const handleConfirmTakeMarginFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;

    const result = takeMarginFeeFromCash({
      summary: marginFeeSummary,
      includeToday: takeIncludeToday,
      includePrevious: takeIncludePrevious,
      takenBy: activeStaff?.name || operatorName || 'Owner',
    });

    if (!result.success) {
      setTakeFeeError(result.message || 'Gagal memproses pengambilan Margin Fee');
      return;
    }

    setBalances(result.balances);
    setMarginFeeLedger(result.ledger);
    setTakeFeeError('');
    setTakeFeeModalOpen(false);
  };

  // Total Saldo gabungan: Cash + Brimo 1 + Brimo 2 + Dana 1 + Dana 2 + Seabank + Tagihan (Manual)
  const totalCombinedBalance = useMemo(
    () => calculateAllBalancesTotal(balances),
    [balances]
  );

  // Total Saldo Titipan keseluruhan
  const totalTitipanBalance = useMemo(
    () => titipanAccounts.reduce((acc, item) => acc + (Number(item.balance) || 0), 0),
    [titipanAccounts]
  );

  // Daftar transaksi berstatus Hutang (piutang pelanggan) & total akumulasinya
  const hutangTransactions = useMemo(
    () => transactions.filter((tx) => isHutangTransaction(tx)),
    [transactions]
  );
  const totalHutangBalance = useMemo(
    () => hutangTransactions.reduce((acc, tx) => acc + getTransactionHutangAmount(tx), 0),
    [hutangTransactions]
  );

  const handleOpenHutangModal = () => {
    setHutangModalOpen(true);
  };

  const openHutangConfirmModal = (tx: DigitalTransaction) => {
    setHutangReceiverAccount('cash');
    setHutangConfirmTarget(tx);
  };

  const handleBayarHutang = async (
    tx: DigitalTransaction,
    receiverKey: HutangReceiverAccountKey = hutangReceiverAccount
  ) => {
    const txKey = String(tx.referenceNumber || tx.id);
    if (settlingHutangKey) return;
    setSettlingHutangKey(txKey);

    try {
      const settledAt = new Date().toISOString();
      const receiverLabel = getFundSourceLabel(receiverKey);
      const settledPaymentMethod = receiverKey === 'cash' ? 'cash' : 'transfer';
      const cleanedNotes = (tx.notes || '').replace(/\s*\[Pelunasan ke:\s*[^\]]+\]/gi, '').trim();
      const settledNotes = [cleanedNotes, `[Pelunasan ke: ${receiverLabel}]`]
        .filter(Boolean)
        .join(' ');

      const updatedTx: DigitalTransaction = normalizeDigitalTransaction({
        ...tx,
        paymentMethod: settledPaymentMethod,
        status: 'success',
        notes: settledNotes,
        paidAt: settledAt,
      });

      // 1. Kurangi Card Hutang dan masukkan dana pembayaran (Total Bayar) ke rekening penerima pilihan
      const updatedBalances = settleHutangTransactionBalance(tx, receiverKey);
      setBalances(updatedBalances);

      // 2. Perbarui status transaksi pada state lokal, localStorage, dan Cloud Firestore
      saveDigitalTransactionToCloud(updatedTx).catch(() => {});
      setTransactions((prev) => {
        const updatedList = prev.map((item) => {
          const sameRef =
            tx.referenceNumber &&
            item.referenceNumber &&
            item.referenceNumber === tx.referenceNumber;
          const sameId = item.id === tx.id;
          return sameRef || sameId ? updatedTx : item;
        });
        saveStoredDigitalTransactions(updatedList, true);
        return updatedList;
      });
      notifyDataUpdated('digital');

      // 3. Sinkronkan ke API backend agar database konsisten
      fetch(
        `/api/digital-finance/${tx.id}?ref=${encodeURIComponent(tx.referenceNumber || '')}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceNumber: tx.referenceNumber,
            paymentMethod: settledPaymentMethod,
            status: 'success',
            notes: updatedTx.notes,
            paidAt: settledAt,
          }),
        }
      ).catch(() => {});
    } finally {
      setSettlingHutangKey(null);
      setHutangConfirmTarget(null);
      setHutangDetailTarget(null);
    }
  };

  // Daftar transaksi berstatus Tagihan aktif (belum dilunasi)
  const tagihanTransactions = useMemo(
    () => transactions.filter((tx) => isTagihanTransaction(tx)),
    [transactions]
  );

  const handleOpenTagihanListModal = () => {
    setTagihanListModalOpen(true);
  };

  const handleBayarTagihan = async (tx: DigitalTransaction) => {
    const txKey = String(tx.referenceNumber || tx.id);
    if (settlingTagihanKey) return;
    setSettlingTagihanKey(txKey);

    try {
      const settledAt = new Date().toISOString();
      const updatedTx: DigitalTransaction = normalizeDigitalTransaction({
        ...tx,
        paymentMethod: 'cash',
        status: 'success',
        paidAt: settledAt,
      });

      // 1. Kurangi Card Tagihan dan masukkan dana pelunasan ke Card Cash
      const updatedBalances = settleTagihanTransactionBalance(tx);
      setBalances(updatedBalances);
      if ((updatedBalances.tagihan || 0) <= 0) {
        setTagihanNote('');
      }

      // 2. Perbarui status transaksi pada state lokal, localStorage, dan Cloud Firestore
      saveDigitalTransactionToCloud(updatedTx).catch(() => {});
      setTransactions((prev) => {
        const updatedList = prev.map((item) => {
          const sameRef =
            tx.referenceNumber &&
            item.referenceNumber &&
            item.referenceNumber === tx.referenceNumber;
          const sameId = item.id === tx.id;
          return sameRef || sameId ? updatedTx : item;
        });
        saveStoredDigitalTransactions(updatedList, true);
        return updatedList;
      });
      notifyDataUpdated('digital');

      // 3. Sinkronkan ke API backend agar database konsisten
      fetch(
        `/api/digital-finance/${tx.id}?ref=${encodeURIComponent(tx.referenceNumber || '')}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceNumber: tx.referenceNumber,
            paymentMethod: 'cash',
            status: 'success',
            notes: updatedTx.notes,
            paidAt: settledAt,
          }),
        }
      ).catch(() => {});
    } finally {
      setSettlingTagihanKey(null);
      setTagihanConfirmTarget(null);
      setTagihanDetailTarget(null);
    }
  };

  // Helper pencatatan otomatis mutasi Card Titipan ke Riwayat Transaksi & Cloud Firestore
  const recordTitipanTransaction = (params: {
    actionType: 'titipan_masuk' | 'titipan_keluar';
    providerLabel: string;
    penitipName: string;
    targetAccount: string;
    nominalAmount: number;
    adminFee?: number;
    fundSource?: string;
    notes: string;
    createdAt: string;
  }) => {
    const cleanNominal = Math.max(0, Math.round(Number(params.nominalAmount) || 0));
    const cleanAdmin = Math.max(0, Math.round(Number(params.adminFee) || 0));
    const refNumber = `TTP-${Date.now().toString().slice(-6)}-${Math.random()
      .toString(36)
      .slice(2, 5)
      .toUpperCase()}`;

    const tx = normalizeDigitalTransaction({
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: params.actionType,
      provider: params.providerLabel,
      targetAccount: params.targetAccount,
      customerName: params.penitipName,
      nominal: cleanNominal,
      adminBankCost: cleanAdmin,
      adminStoreFee: 0,
      totalCustomerPaid: cleanNominal + cleanAdmin,
      profit: 0,
      paymentMethod: 'titipan',
      fundSource: params.fundSource || 'Brimo 1',
      operatorName: activeStaff?.name || operatorName || 'Kasir',
      referenceNumber: refNumber,
      status: 'success',
      notes: params.notes,
      createdAt: params.createdAt,
    });

    saveDigitalTransactionToCloud(tx).catch(() => {});
    setTransactions((prev) => {
      const updated = mergeDigitalTransactions([tx], prev);
      saveStoredDigitalTransactions(updated, true);
      return updated;
    });
    notifyDataUpdated('digital');
  };

  // Handlers Card Titipan
  const handleOpenTitipanModal = () => {
    setTitipanModalOpen(true);
  };

  const handleOpenAddPenitipModal = () => {
    setNewPenitipName('');
    setNewPenitipNominal(0);
    setAddPenitipModalOpen(true);
  };

  const handleSaveNewPenitip = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newPenitipName.trim();
    if (!cleanName || newPenitipNominal <= 0) return;

    setSavingTitipan(true);
    try {
      const addedAmount = Math.max(0, Math.round(Number(newPenitipNominal) || 0));
      const nowIso = new Date().toISOString();
      const newEntry: TitipanAccount = {
        id: `titipan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        balance: addedAmount,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const updated = [...titipanAccounts, newEntry];
      setTitipanAccounts(updated);
      saveStoredTitipanAccounts(updated);
      saveTitipanAccountToCloud(newEntry).catch(() => {});

      // Sinkronisasi: Tambah saldo Brimo 1 sebesar nominal awal penitip baru
      const updatedBalances = adjustBrimo1Balance(addedAmount);
      setBalances(updatedBalances);

      // Catat ke Riwayat Transaksi
      recordTitipanTransaction({
        actionType: 'titipan_masuk',
        providerLabel: 'TITIPAN BARU',
        penitipName: cleanName,
        targetAccount: 'Saldo Titipan (Masuk)',
        nominalAmount: addedAmount,
        adminFee: 0,
        notes: `[Titipan] Tambah Daftar Penitip Baru: ${cleanName} • Masuk ${formatRupiah(addedAmount)} ke Brimo 1 • Saldo Akhir: ${formatRupiah(addedAmount)}`,
        createdAt: nowIso,
      });

      setAddPenitipModalOpen(false);
    } finally {
      setSavingTitipan(false);
    }
  };

  const handleOpenTopupPenitipModal = (account: TitipanAccount) => {
    setTopupPenitipTarget(account);
    setTopupPenitipAmount(0);
  };

  const handleSaveTopupPenitip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupPenitipTarget || topupPenitipAmount <= 0) return;

    setSavingTitipan(true);
    try {
      const addedAmount = Math.round(Number(topupPenitipAmount) || 0);
      const prevBal = Math.max(0, Math.round(Number(topupPenitipTarget.balance) || 0));
      const nextBal = prevBal + addedAmount;
      const nowIso = new Date().toISOString();
      const updatedAccount: TitipanAccount = {
        ...topupPenitipTarget,
        balance: nextBal,
        updatedAt: nowIso,
      };
      const updatedList = titipanAccounts.map((item) =>
        item.id === updatedAccount.id ? updatedAccount : item
      );
      setTitipanAccounts(updatedList);
      saveStoredTitipanAccounts(updatedList);
      saveTitipanAccountToCloud(updatedAccount).catch(() => {});

      // Sinkronisasi: Tambah saldo Brimo 1 sebesar nominal penambahan saldo penitip
      const updatedBalances = adjustBrimo1Balance(addedAmount);
      setBalances(updatedBalances);

      // Catat ke Riwayat Transaksi
      recordTitipanTransaction({
        actionType: 'titipan_masuk',
        providerLabel: 'TAMBAH SALDO TITIPAN',
        penitipName: topupPenitipTarget.name,
        targetAccount: 'Saldo Titipan (Masuk)',
        nominalAmount: addedAmount,
        adminFee: 0,
        notes: `[Titipan] Tambah Saldo (${topupPenitipTarget.name}) • Masuk ${formatRupiah(addedAmount)} ke Brimo 1 • Saldo: ${formatRupiah(prevBal)} ➔ ${formatRupiah(nextBal)}`,
        createdAt: nowIso,
      });

      setTopupPenitipTarget(null);
      setTopupPenitipAmount(0);
    } finally {
      setSavingTitipan(false);
    }
  };

  const handleOpenTarikPenitipModal = (account: TitipanAccount) => {
    setTarikPenitipTarget(account);
    setTarikJenisTransaksi('Transfer');
    setTarikNoRekening('');
    setTarikNominal(0);
    setTarikAdminFee(0);
  };

  const handleSaveTarikPenitip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarikPenitipTarget || tarikNominal <= 0) return;
    if (tarikJenisTransaksi === 'Transfer' && !tarikNoRekening.trim()) return;

    const cleanNominal = Math.round(Number(tarikNominal) || 0);
    const cleanAdmin = Math.round(Number(tarikAdminFee) || 0);
    const totalDeducted = cleanNominal + cleanAdmin;
    const currentSaldo = Number(tarikPenitipTarget.balance) || 0;
    if (totalDeducted > currentSaldo) return;

    const isTarikTunaiAction = tarikJenisTransaksi === 'Tarik Tunai';
    if (isTarikTunaiAction && cleanNominal > (balances.cash || 0)) {
      alert(
        `Saldo Card Cash tidak mencukupi!\nTersedia di Cash: ${formatRupiah(balances.cash || 0)}\nNominal Tarik Tunai: ${formatRupiah(cleanNominal)}`
      );
      return;
    }

    setSavingTitipan(true);
    try {
      const nowIso = new Date().toISOString();
      const nextBal = Math.max(0, currentSaldo - totalDeducted);
      const updatedAccount: TitipanAccount = {
        ...tarikPenitipTarget,
        balance: nextBal,
        updatedAt: nowIso,
      };
      const updatedList = titipanAccounts.map((item) =>
        item.id === updatedAccount.id ? updatedAccount : item
      );
      setTitipanAccounts(updatedList);
      saveStoredTitipanAccounts(updatedList);
      saveTitipanAccountToCloud(updatedAccount).catch(() => {});

      // Sinkronisasi Saldo:
      // - Tarik Tunai: potong saldo Card Cash sebesar nominal tunai yang diserahkan.
      //   Karena Saldo Titipan berkurang sedangkan Total Saldo Rekening Brimo 1 tetap,
      //   porsi Real Saldo pada Card Brimo 1 otomatis bertambah sebesar saldo yang dipotong.
      // - Transfer: kurangi saldo Brimo 1 sebesar nominal penarikan + biaya admin.
      const updatedBalances = isTarikTunaiAction
        ? adjustCashBalance(-cleanNominal)
        : adjustBrimo1Balance(-totalDeducted);
      setBalances(updatedBalances);

      // Catat ke Riwayat Transaksi
      const cleanRek = tarikNoRekening.trim();
      const targetDisplay =
        tarikJenisTransaksi === 'Transfer'
          ? cleanRek || 'Transfer Rekening'
          : cleanRek
          ? `Tarik Tunai • ${cleanRek}`
          : 'Tarik Tunai';
      const providerDisplay =
        tarikJenisTransaksi === 'Transfer' ? 'PENCAIRAN TRANSFER' : 'PENCAIRAN TUNAI';
      const adminDesc =
        cleanAdmin > 0
          ? isTarikTunaiAction
            ? ` • Biaya Admin: ${formatRupiah(cleanAdmin)} (Total Potong Titipan: ${formatRupiah(totalDeducted)})`
            : ` • Biaya Admin: ${formatRupiah(cleanAdmin)} (Total Potong Brimo 1: ${formatRupiah(totalDeducted)})`
          : '';
      const noteText = isTarikTunaiAction
        ? `[Titipan] Pencairan Tarik Tunai (${tarikPenitipTarget.name})${cleanRek ? ` • Catatan: ${cleanRek}` : ''} • Potong Card Cash: ${formatRupiah(cleanNominal)}${adminDesc} • Real Saldo Brimo 1 +${formatRupiah(totalDeducted)} • Saldo Akhir: ${formatRupiah(nextBal)}`
        : `[Titipan] Pencairan Transfer (${tarikPenitipTarget.name})${cleanRek ? ` • Rek: ${cleanRek}` : ''} • Nominal: ${formatRupiah(cleanNominal)}${adminDesc} • Saldo Akhir: ${formatRupiah(nextBal)}`;

      recordTitipanTransaction({
        actionType: 'titipan_keluar',
        providerLabel: providerDisplay,
        penitipName: tarikPenitipTarget.name,
        targetAccount: targetDisplay,
        nominalAmount: cleanNominal,
        adminFee: cleanAdmin,
        fundSource: isTarikTunaiAction ? 'Cash' : 'Brimo 1',
        notes: noteText,
        createdAt: nowIso,
      });

      setTarikPenitipTarget(null);
      setTarikNoRekening('');
      setTarikNominal(0);
      setTarikAdminFee(0);
    } finally {
      setSavingTitipan(false);
    }
  };

  const handleOpenDeletePenitipModal = (account: TitipanAccount) => {
    setDeletePenitipTarget(account);
  };

  const handleConfirmDeletePenitip = async () => {
    if (!deletePenitipTarget) return;
    setSavingTitipan(true);
    try {
      const targetId = deletePenitipTarget.id;
      const remainingBalance = Math.max(0, Math.round(Number(deletePenitipTarget.balance) || 0));
      const updatedList = titipanAccounts.filter((item) => item.id !== targetId);
      setTitipanAccounts(updatedList);
      saveStoredTitipanAccounts(updatedList);
      deleteTitipanAccountFromCloud(targetId).catch(() => {});

      // Sinkronisasi: Kurangi saldo Brimo 1 sebesar sisa saldo penitip yang dihapus
      if (remainingBalance > 0) {
        const updatedBalances = adjustBrimo1Balance(-remainingBalance);
        setBalances(updatedBalances);
      }

      setDeletePenitipTarget(null);
    } finally {
      setSavingTitipan(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-1.5 sm:gap-2 lg:gap-1.5 lg:flex-1">
      {/* ======================================================== */}
      {/* 1 & 2. AREA RINGKASAN DERETAN 11 CARD SEJAJAR & TOTAL SALDO */}
      {/* ======================================================== */}
      <div className="bg-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200/90 shadow-2xs shrink-0 flex flex-col gap-1.5 sm:gap-2">
        {/* Baris Total Saldo & Status Global */}
        <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-indigo-50/90 via-sky-50/80 to-emerald-50/90 border border-indigo-100/90 px-3 py-1.5 sm:px-4 sm:py-2 lg:py-1.5 rounded-lg shadow-2xs">
          <div className="flex items-center gap-2.5 lg:gap-2 flex-wrap">
            <div className="w-6.5 h-6.5 sm:w-7 sm:h-7 lg:w-5 lg:h-5 rounded-md bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-3 lg:h-3" />
            </div>
            <div className="flex items-center gap-2 lg:gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm lg:text-xs font-bold text-slate-900 leading-tight">
                Total Saldo:
              </span>
              <span className="text-xs sm:text-base lg:text-[13px] font-extrabold text-indigo-700 font-mono tracking-tight leading-tight">
                {formatRupiah(totalCombinedBalance)}
              </span>
              <span className="hidden lg:inline text-[9.5px] text-slate-500 font-medium leading-tight">
                (Cash + Brimo 1 + Brimo 2 + Dana 1 + Dana 2 + Seabank + Tagihan)
              </span>
            </div>
          </div>

          {isOwner && previousUnclaimedFee > 0 && (
            <button
              type="button"
              onClick={handleOpenTakeFeeModal}
              title={`Ada sisa Admin Fee hari sebelumnya sebesar ${formatRupiah(previousUnclaimedFee)} yang belum diambil`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 lg:px-2 lg:py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200/90 active:bg-amber-200 border border-amber-300 text-amber-900 text-[10.5px] sm:text-xs lg:text-[10.5px] font-bold transition cursor-pointer shadow-2xs shrink-0 leading-tight"
            >
              <Bell className="w-3 h-3 text-amber-700 animate-pulse shrink-0" />
              <span className="hidden sm:inline">Fee kemarin belum diambil:</span>
              <span className="sm:hidden">Fee kemarin:</span>
              <span className="font-mono font-extrabold text-amber-950">
                +{formatRupiah(previousUnclaimedFee)}
              </span>
            </button>
          )}
        </div>

        {(() => {
          const summaryCardOptions: Array<{ key: SummaryCardKey; label: string }> = [
            { key: 'cash', label: 'Cash' },
            { key: 'brimo1', label: 'Brimo 1' },
            { key: 'brimo2', label: 'Brimo 2' },
            { key: 'dana1', label: 'Dana 1' },
            { key: 'dana2', label: 'Dana 2' },
            { key: 'seabank', label: 'Seabank' },
            { key: 'tagihan', label: 'Tagihan' },
            { key: 'titipan', label: 'Titipan' },
            { key: 'hutang', label: 'Hutang' },
            { key: 'perputaran', label: 'Perputaran' },
            { key: 'margin_fee', label: 'Admin Fee' },
          ];

          const renderSummaryCard = (cardKey: SummaryCardKey, isSingleView = false) => {
            const boxSizeClass = isSingleView
              ? 'w-full px-3 py-2 min-h-[58px]'
              : 'shrink-0 w-[124px] sm:w-[130px] p-1.5 sm:px-2 sm:py-1.5 h-[52px]';
            const titleTextClass = isSingleView ? 'text-xs' : 'text-[10.5px]';
            const valueTextClass = isSingleView
              ? 'text-sm sm:text-base'
              : 'text-xs sm:text-[13px] tracking-tight sm:tracking-tighter';
            const actionBtnSizeClass = isSingleView ? 'w-6 h-6' : 'w-4 h-4';
            const editIconSizeClass = isSingleView ? 'w-3 h-3' : 'w-2.5 h-2.5';

            if (cardKey === 'cash') {
              return (
                <div className={`${boxSizeClass} rounded-lg bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition`}>
                  <div className={`h-4 flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-slate-600 truncate">Cash</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpdateBalance('cash')}
                        title="Update Saldo Cash"
                        aria-label="Update Saldo Cash"
                        className={`${actionBtnSizeClass} rounded text-slate-400 hover:text-emerald-700 bg-white/80 hover:bg-emerald-50 border border-slate-200/80 hover:border-emerald-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0`}
                      >
                        <Edit2 className={editIconSizeClass} />
                      </button>
                    )}
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-slate-900 ${valueTextClass} font-mono whitespace-nowrap leading-none select-all`} title={formatRupiah(balances.cash)}>
                      {formatRupiah(balances.cash)}
                    </span>
                  </div>
                </div>
              );
            }

            if (cardKey === 'brimo1') {
              return (
                <div className={`${boxSizeClass} rounded-lg bg-blue-50/40 border border-blue-200/80 flex flex-col justify-between shadow-2xs hover:border-blue-300 transition`}>
                  <div className={`h-4 flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-blue-900 truncate">Brimo 1</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpdateBalance('brimo1')}
                        title="Update Saldo Brimo 1"
                        aria-label="Update Saldo Brimo 1"
                        className={`${actionBtnSizeClass} rounded text-blue-400 hover:text-blue-700 bg-white/80 hover:bg-blue-50 border border-blue-200/80 hover:border-blue-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0`}
                      >
                        <Edit2 className={editIconSizeClass} />
                      </button>
                    )}
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-blue-950 ${valueTextClass} font-mono whitespace-nowrap leading-none select-all`} title={formatRupiah(balances.brimo1)}>
                      {formatRupiah(balances.brimo1)}
                    </span>
                  </div>
                </div>
              );
            }

            if (cardKey === 'brimo2') {
              return (
                <div className={`${boxSizeClass} rounded-lg bg-sky-50/40 border border-sky-200/80 flex flex-col justify-between shadow-2xs hover:border-sky-300 transition`}>
                  <div className={`h-4 flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-sky-900 truncate">Brimo 2</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpdateBalance('brimo2')}
                        title="Update Saldo Brimo 2"
                        aria-label="Update Saldo Brimo 2"
                        className={`${actionBtnSizeClass} rounded text-sky-400 hover:text-sky-700 bg-white/80 hover:bg-sky-50 border border-sky-200/80 hover:border-sky-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0`}
                      >
                        <Edit2 className={editIconSizeClass} />
                      </button>
                    )}
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-sky-950 ${valueTextClass} font-mono whitespace-nowrap leading-none select-all`} title={formatRupiah(balances.brimo2)}>
                      {formatRupiah(balances.brimo2)}
                    </span>
                  </div>
                </div>
              );
            }

            if (cardKey === 'dana1') {
              return (
                <div className={`${boxSizeClass} rounded-lg bg-indigo-50/40 border border-indigo-200/80 flex flex-col justify-between shadow-2xs hover:border-indigo-300 transition`}>
                  <div className={`h-4 flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-indigo-900 truncate">Dana 1</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpdateBalance('dana1')}
                        title="Update Saldo Dana 1"
                        aria-label="Update Saldo Dana 1"
                        className={`${actionBtnSizeClass} rounded text-indigo-400 hover:text-indigo-700 bg-white/80 hover:bg-indigo-50 border border-indigo-200/80 hover:border-indigo-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0`}
                      >
                        <Edit2 className={editIconSizeClass} />
                      </button>
                    )}
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-indigo-950 ${valueTextClass} font-mono whitespace-nowrap leading-none select-all`} title={formatRupiah(balances.dana1)}>
                      {formatRupiah(balances.dana1)}
                    </span>
                  </div>
                </div>
              );
            }

            if (cardKey === 'dana2') {
              return (
                <div className={`${boxSizeClass} rounded-lg bg-purple-50/40 border border-purple-200/80 flex flex-col justify-between shadow-2xs hover:border-purple-300 transition`}>
                  <div className={`h-4 flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-purple-900 truncate">Dana 2</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpdateBalance('dana2')}
                        title="Update Saldo Dana 2"
                        aria-label="Update Saldo Dana 2"
                        className={`${actionBtnSizeClass} rounded text-purple-400 hover:text-purple-700 bg-white/80 hover:bg-purple-50 border border-purple-200/80 hover:border-purple-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0`}
                      >
                        <Edit2 className={editIconSizeClass} />
                      </button>
                    )}
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-purple-950 ${valueTextClass} font-mono whitespace-nowrap leading-none select-all`} title={formatRupiah(balances.dana2)}>
                      {formatRupiah(balances.dana2)}
                    </span>
                  </div>
                </div>
              );
            }

            if (cardKey === 'seabank') {
              return (
                <div className={`${boxSizeClass} rounded-lg bg-orange-50/40 border border-orange-200/80 flex flex-col justify-between shadow-2xs hover:border-orange-300 transition`}>
                  <div className={`h-4 flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-orange-950 truncate">Seabank</span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => handleOpenUpdateBalance('seabank')}
                        title="Update Saldo Seabank"
                        aria-label="Update Saldo Seabank"
                        className={`${actionBtnSizeClass} rounded text-orange-400 hover:text-orange-700 bg-white/80 hover:bg-orange-50 border border-orange-200/80 hover:border-orange-300 flex items-center justify-center transition-colors cursor-pointer shadow-2xs shrink-0`}
                      >
                        <Edit2 className={editIconSizeClass} />
                      </button>
                    )}
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-orange-950 ${valueTextClass} font-mono whitespace-nowrap leading-none select-all`} title={formatRupiah(balances.seabank)}>
                      {formatRupiah(balances.seabank)}
                    </span>
                  </div>
                </div>
              );
            }

            if (cardKey === 'tagihan') {
              return (
                <button
                  type="button"
                  onClick={handleOpenTagihanListModal}
                  title="Klik untuk membuka daftar transaksi Tagihan"
                  className={`${boxSizeClass} rounded-lg bg-amber-50/60 border border-amber-200/90 flex flex-col justify-between shadow-2xs hover:border-amber-400 hover:bg-amber-50/90 active:bg-amber-100/70 transition text-left cursor-pointer`}
                >
                  <div className={`h-4 w-full flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-amber-950 font-bold truncate">Tagihan</span>
                    <span className="relative inline-flex items-center justify-center shrink-0">
                      <span className={`${actionBtnSizeClass} rounded text-amber-600 bg-white/90 border border-amber-200/90 flex items-center justify-center shadow-2xs`}>
                        <Receipt className={editIconSizeClass} />
                      </span>
                      {tagihanTransactions.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-600 ring-1 ring-white" />
                      )}
                    </span>
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-amber-950 ${valueTextClass} font-mono whitespace-nowrap leading-none`}>
                      {formatRupiah(balances.tagihan || 0)}
                    </span>
                  </div>
                </button>
              );
            }

            if (cardKey === 'titipan') {
              return (
                <button
                  type="button"
                  onClick={handleOpenTitipanModal}
                  title="Klik untuk membuka daftar saldo titipan"
                  className={`${boxSizeClass} rounded-lg bg-teal-50/50 border border-teal-200/90 flex flex-col justify-between shadow-2xs hover:border-teal-400 hover:bg-teal-50/90 active:bg-teal-100/70 transition text-left cursor-pointer`}
                >
                  <div className={`h-4 w-full flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-teal-950 font-bold truncate">Titipan</span>
                    <span className={`${actionBtnSizeClass} rounded text-teal-600 bg-white/90 border border-teal-200/90 flex items-center justify-center shadow-2xs shrink-0`}>
                      <Users className={editIconSizeClass} />
                    </span>
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-teal-950 ${valueTextClass} font-mono whitespace-nowrap leading-none`}>
                      {formatRupiah(totalTitipanBalance)}
                    </span>
                  </div>
                </button>
              );
            }

            if (cardKey === 'hutang') {
              return (
                <button
                  type="button"
                  onClick={handleOpenHutangModal}
                  title="Klik untuk membuka daftar transaksi berstatus Hutang"
                  className={`${boxSizeClass} rounded-lg bg-rose-50/50 border border-rose-200/80 flex flex-col justify-between shadow-2xs hover:border-rose-400 hover:bg-rose-50/90 active:bg-rose-100/70 transition text-left cursor-pointer`}
                >
                  <div className={`h-4 w-full flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight`}>
                    <span className="text-rose-950 font-bold truncate">Hutang</span>
                    <span className="relative inline-flex items-center justify-center shrink-0">
                      <span className={`${actionBtnSizeClass} rounded text-rose-600 bg-white/90 border border-rose-200/90 flex items-center justify-center shadow-2xs`}>
                        <Receipt className={editIconSizeClass} />
                      </span>
                      {hutangTransactions.length > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-600 ring-1 ring-white" />
                      )}
                    </span>
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-rose-950 ${valueTextClass} font-mono whitespace-nowrap leading-none`}>
                      {formatRupiah(totalHutangBalance)}
                    </span>
                  </div>
                </button>
              );
            }

            if (cardKey === 'perputaran') {
              return (
                <div className={`${boxSizeClass} rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between shadow-2xs hover:border-slate-300 transition`}>
                  <div className={`h-4 flex items-center justify-between ${titleTextClass} text-slate-700 font-semibold leading-tight`}>
                    <span className="truncate">Perputaran</span>
                    <TrendingUp className={`${isSingleView ? 'w-4 h-4' : 'w-3 h-3'} text-indigo-600 shrink-0`} />
                  </div>
                  <div className="w-full flex items-baseline overflow-visible">
                    <span className={`font-extrabold text-slate-900 ${valueTextClass} font-mono whitespace-nowrap leading-none select-all`} title={formatRupiah(totalDigitalVolume)}>
                      {formatRupiah(totalDigitalVolume)}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                className={`${boxSizeClass} rounded-lg border flex flex-col justify-between shadow-2xs transition ${
                  totalDigitalMargin < 0
                    ? 'bg-rose-50 border-rose-200 hover:border-rose-300'
                    : isOwner && previousUnclaimedFee > 0
                    ? 'bg-gradient-to-br from-emerald-50 to-amber-50/80 border-amber-300 hover:border-amber-400'
                    : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                }`}
              >
                <div
                  className={`h-4 flex items-center justify-between gap-1 ${titleTextClass} font-semibold leading-tight ${
                    totalDigitalMargin < 0 ? 'text-rose-800' : 'text-emerald-800'
                  }`}
                >
                  <span className="truncate">Admin Fee</span>
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={handleOpenTakeFeeModal}
                      disabled={marginFeeSummary.totalAvailableToTake <= 0}
                      title={
                        previousUnclaimedFee > 0
                          ? `Ambil Admin Fee — Hari ini: ${formatSignedRupiah(totalDigitalMargin)} | Sisa kemarin belum diambil: +${formatRupiah(previousUnclaimedFee)}`
                          : marginFeeSummary.totalAvailableToTake > 0
                          ? `Ambil Admin Fee (${formatRupiah(totalDigitalMargin)}) dari saldo Cash`
                          : 'Belum ada Admin Fee yang dapat diambil hari ini'
                      }
                      aria-label="Ambil Admin Fee"
                      className={`relative ${actionBtnSizeClass} rounded flex items-center justify-center border shadow-2xs transition-colors shrink-0 ${
                        marginFeeSummary.totalAvailableToTake > 0
                          ? previousUnclaimedFee > 0
                            ? 'text-amber-700 hover:text-amber-900 bg-amber-100/90 hover:bg-amber-200 border-amber-300 cursor-pointer'
                            : 'text-emerald-600 hover:text-emerald-800 bg-white/90 hover:bg-emerald-100 border-emerald-200/90 hover:border-emerald-400 cursor-pointer'
                          : totalDigitalMargin < 0
                          ? 'text-rose-400 bg-white/60 border-rose-200/60 opacity-50 cursor-not-allowed'
                          : 'text-emerald-400 bg-white/60 border-emerald-200/60 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <HandCoins className={editIconSizeClass} />
                      {previousUnclaimedFee > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-white animate-pulse" />
                      )}
                    </button>
                  ) : (
                    <DollarSign
                      className={`${isSingleView ? 'w-4 h-4' : 'w-3 h-3'} shrink-0 ${
                        totalDigitalMargin < 0 ? 'text-rose-600' : 'text-emerald-600'
                      }`}
                    />
                  )}
                </div>
                <div className="w-full flex items-baseline overflow-visible">
                  <span
                    className={`font-extrabold ${valueTextClass} font-mono whitespace-nowrap leading-none select-all ${
                      totalDigitalMargin < 0 ? 'text-rose-700' : 'text-emerald-800'
                    }`}
                    title={
                      isOwner && previousUnclaimedFee > 0
                        ? `Hari ini: ${formatSignedRupiah(totalDigitalMargin)} | Kemarin belum diambil: +${formatRupiah(previousUnclaimedFee)}`
                        : marginFeeSummary.todayTaken > 0
                        ? `Sisa hari ini: ${formatSignedRupiah(totalDigitalMargin)} (Total profit: ${formatSignedRupiah(marginFeeSummary.todayGrossProfit)} - Diambil: ${formatRupiah(marginFeeSummary.todayTaken)})`
                        : formatSignedRupiah(totalDigitalMargin)
                    }
                  >
                    {formatSignedRupiah(totalDigitalMargin)}
                  </span>
                </div>
              </div>
            );
          };

          return (
            <>
              {/* Tampilan Tablet & Mobile (< 1024px): Dropdown "Pilih Card" + 1 Card Terpilih */}
              <div className="lg:hidden flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="mobile-summary-card-select"
                    className="text-[11px] font-bold text-slate-700"
                  >
                    Pilih Card
                  </label>
                  <div className="relative">
                    <select
                      id="mobile-summary-card-select"
                      value={selectedSummaryCard}
                      onChange={(e) => setSelectedSummaryCard(e.target.value as SummaryCardKey)}
                      className="w-full h-9 pl-3 pr-8 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50/80 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white appearance-none cursor-pointer transition"
                    >
                      {summaryCardOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>{renderSummaryCard(selectedSummaryCard, true)}</div>
              </div>

              {/* Tampilan Desktop (>= 1024px): Deretan 11 Card Horizontal Scroll */}
              <div className="hidden lg:flex items-stretch gap-1.5 overflow-x-auto pb-1.5 scroll-smooth">
                {summaryCardOptions.map((opt) => (
                  <React.Fragment key={opt.key}>
                    {renderSummaryCard(opt.key, false)}
                  </React.Fragment>
                ))}
              </div>
            </>
          );
        })()}
      </div>

            {/* ======================================================== */}
      {/* 2. FORM TRANSAKSI BARU (HORIZONTAL FULL-WIDTH LAYOUT)     */}
      {/* ======================================================== */}
      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs p-3 sm:p-4 lg:py-2.5 lg:px-3.5 flex flex-col lg:flex-1">
        {/* Header Terminal */}
        <div className="flex items-center justify-between pb-1.5 lg:pb-1 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-5.5 h-5.5 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <Send className="w-3 h-3 text-indigo-600" />
            </div>
            <h3 className="font-bold text-slate-900 text-xs sm:text-sm">Input Transaksi Baru</h3>
            <span className="text-[9.5px] font-semibold px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 leading-tight">
              Otomatis Potong Saldo
            </span>
          </div>
        </div>

        {/* Balanced 2-Column Responsive Layout Form */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4 lg:gap-4 pt-1.5 lg:pt-1 lg:flex-1">
          {/* KOLOM 1: Pilihan Layanan, Sumber Dana, Provider, Pelanggan, & No Rekening */}
          <div className="flex flex-col gap-1.5 sm:gap-2 lg:gap-1.5 lg:justify-between">
            {/* 1.1 Pilihan Layanan Transaksi */}
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Pilih Layanan Transaksi <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTypeChange('brilink_transfer')}
                  className={`relative py-1.5 sm:py-2 px-2.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-2xs select-none ${
                    transType === 'brilink_transfer'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Transfer Bank</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('brilink_tarik_tunai')}
                  className={`relative py-1.5 sm:py-2 px-2.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-2xs select-none ${
                    transType === 'brilink_tarik_tunai'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Tarik Tunai</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('topup_ewallet')}
                  className={`relative py-1.5 sm:py-2 px-2.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-2xs select-none ${
                    transType === 'topup_ewallet'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Top Up E-Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('ppob_tagihan')}
                  className={`relative py-1.5 sm:py-2 px-2.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-2xs select-none ${
                    transType === 'ppob_tagihan'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">PPOB & Lainnya</span>
                </button>
              </div>
            </div>

            {/* 1.2 Dropdown Sumber Dana Transaksi (info sisa saldo) */}
            <div className="p-2 sm:p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100/90 flex flex-col gap-1 shrink-0">
              <div className="h-5 flex items-center justify-between gap-2 shrink-0">
                <label className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5 leading-none">
                  <Wallet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Sumber Dana Transaksi <span className="text-rose-500">*</span></span>
                </label>
                <span className="text-[10px] font-semibold text-indigo-700 inline-flex items-center leading-none shrink-0">
                  {fundSource === 'atm_pelanggan' ? (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 leading-none">
                      EDC / ATM Milik Nasabah
                    </span>
                  ) : (
                    <span className="leading-none">
                      Saldo: <strong className="font-mono">{formatRupiah(currentFundBalance)}</strong>
                    </span>
                  )}
                </span>
              </div>

              <select
                value={fundSource}
                onChange={(e) => setFundSource(e.target.value as FundSourceKey)}
                className="w-full h-[30px] text-xs py-1 px-2.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer shrink-0"
              >
                {isTarikTunai ? (
                  <option value="cash">Cash — Saldo: {formatRupiah(balances.cash)}</option>
                ) : (
                  <>
                    <option value="brimo1">Brimo 1 — Saldo: {formatRupiah(balances.brimo1)}</option>
                    <option value="brimo2">Brimo 2 — Saldo: {formatRupiah(balances.brimo2)}</option>
                    <option value="dana1">Dana 1 — Saldo: {formatRupiah(balances.dana1)}</option>
                    <option value="dana2">Dana 2 — Saldo: {formatRupiah(balances.dana2)}</option>
                    <option value="seabank">Seabank — Saldo: {formatRupiah(balances.seabank)}</option>
                    <option value="cash">Cash — Saldo: {formatRupiah(balances.cash)}</option>
                    <option value="atm_pelanggan">💳 Kartu ATM Pelanggan</option>
                  </>
                )}
              </select>

              <div className="h-4 flex items-center justify-between text-[10px] leading-none text-slate-600 shrink-0">
                {fundSource !== 'atm_pelanggan' ? (
                  <>
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="truncate">Estimasi Sisa Saldo:</span>
                      {isTarikTunai && fundSource === 'cash' && Number(adminStoreFee) > 0 && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 leading-none shrink-0">
                          +Fee {formatRupiah(Number(adminStoreFee))}
                        </span>
                      )}
                    </span>
                    {isInsufficientBalance ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 border border-red-300 text-red-600 font-extrabold font-mono text-[9.5px] leading-none shrink-0 whitespace-nowrap">
                        Saldo Tidak Cukup - Rp. {balanceShortfall.toLocaleString('id-ID')}
                      </span>
                    ) : (
                      <span className="shrink-0 font-bold font-mono text-indigo-900">
                        {formatRupiah(estimatedRemainingBalance)}
                      </span>
                    )}
                  </>
                ) : (
                  <span aria-hidden="true" className="select-none">&nbsp;</span>
                )}
              </div>
            </div>

            {/* 1.3 Bank Tujuan / Provider */}
            <div>
              <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                {transType === 'topup_ewallet'
                  ? 'Pilihan E-Wallet'
                  : transType === 'ppob_tagihan' || transType.startsWith('ppob')
                  ? 'Layanan PPOB & Lainnya'
                  : 'Bank Tujuan / Provider'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              {provider === 'LAINNYA' ? (
                <div className="relative">
                  <input
                    ref={customProviderInputRef}
                    type="text"
                    required
                    value={customProviderName}
                    onChange={(e) => setCustomProviderName(e.target.value)}
                    placeholder="Ketik nama layanan / provider (misal: Wifi / Biznet / PBB)"
                    className="w-full text-xs py-1.5 pl-2.5 pr-8 rounded-lg border border-indigo-400 bg-white font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setProvider(availableProviders[0]?.value || 'PLN_TAGIHAN');
                      setCustomProviderName('');
                    }}
                    title="Kembali pilih dari daftar layanan"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <select
                  value={provider}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProvider(val);
                    if (val === 'LAINNYA') {
                      setTimeout(() => customProviderInputRef.current?.focus(), 0);
                    } else {
                      setCustomProviderName('');
                    }
                  }}
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                >
                  {availableProviders.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 1.4 Nama Pelanggan (Opsional) & Operator (Wajib) - 2 Kolom Sejajar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 truncate">
                  Nama Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Bpk. Hendra"
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1 truncate">
                  Operator <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={operatorInput}
                  onChange={(e) => setOperatorInput(e.target.value)}
                  placeholder="Nama pelaku transaksi"
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 font-medium placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 1.5 No Rekening / No Kartu ATM (Opsional khusus Tarik Tunai, Wajib untuk layanan lainnya) */}
            <div className="shrink-0">
              <div className="flex items-center justify-between mb-1 leading-tight">
                <label className="text-[11px] font-semibold text-slate-700 truncate">
                  {isTarikTunai ? (
                    'No Kartu / Rekening Tarik Tunai (Opsional)'
                  ) : (
                    <>
                      {transType === 'topup_ewallet'
                        ? 'Nomor Handphone (HP) Tujuan'
                        : transType === 'ppob_tagihan' || transType.startsWith('ppob')
                        ? 'ID Pelanggan / No Meter / No Pelanggan'
                        : 'No Rekening / No Kartu ATM'}{' '}
                      <span className="text-rose-500">*</span>
                    </>
                  )}
                </label>
                {transType === 'topup_ewallet' && (
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded leading-none transition-colors ${
                      targetAccount.length === 12
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : targetAccount.length > 0
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'text-slate-400 bg-slate-100'
                    }`}
                  >
                    {targetAccount.length}/12 digit {targetAccount.length === 12 ? '✓' : ''}
                  </span>
                )}
              </div>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                required={!isTarikTunai}
                value={targetAccount}
                onChange={(e) => {
                  const numericOnly = e.target.value.replace(/\D/g, '');
                  setTargetAccount(numericOnly);
                  if (ewalletSubmitAttempted) {
                    setEwalletSubmitAttempted(false);
                  }
                }}
                placeholder={
                  isTarikTunai
                    ? fundSource === 'atm_pelanggan'
                      ? 'Opsional (Otomatis: Rekening Nasabah)'
                      : 'Opsional (Otomatis: Rekening Internal)'
                    : transType === 'topup_ewallet'
                    ? 'Wajib 12 digit angka, contoh: 081234567890'
                    : transType === 'ppob_tagihan' || transType.startsWith('ppob')
                    ? 'Contoh: 14123456789 / 000123456789'
                    : 'Contoh: 001901002345501 (Rekening Bank)'
                }
                className={`w-full text-xs h-[31px] py-1.5 px-2.5 rounded-lg border font-mono font-medium focus:ring-2 transition-colors ${
                  transType === 'topup_ewallet' && ((targetAccount.length > 0 && targetAccount.length !== 12) || ewalletSubmitAttempted)
                    ? 'border-rose-400 bg-rose-50/20 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-indigo-500/20'
                }`}
              />
              {transType === 'topup_ewallet' && ((targetAccount.length > 0 && targetAccount.length !== 12) || ewalletSubmitAttempted) && (
                <div className="flex items-center gap-1 text-[10.5px] font-semibold text-rose-600 mt-1 leading-tight animate-in fade-in duration-150">
                  <AlertTriangle className="w-3 h-3 shrink-0 text-rose-500" />
                  <span>
                    {targetAccount.length === 0
                      ? 'Nomor HP tujuan E-Wallet wajib diisi persis 12 digit angka.'
                      : targetAccount.length < 12
                      ? `Kurang ${12 - targetAccount.length} digit (Nomor E-Wallet harus persis 12 digit, saat ini ${targetAccount.length} digit).`
                      : `Kelebihan ${targetAccount.length - 12} digit (Nomor E-Wallet harus persis 12 digit, saat ini ${targetAccount.length} digit).`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* KOLOM 2: Nominal, Biaya, Ringkasan Kalkulasi, & Tombol Eksekusi (Kanan) */}
          <div className="flex flex-col gap-1.5 sm:gap-2 lg:gap-1.5 lg:justify-between">
            {/* 2.1 Nominal Transaksi (+ Tombol Preset Nominal Cepat) */}
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <label className="text-[11px] font-bold text-slate-700">
                  Nominal Transaksi <span className="text-rose-500">*</span>
                </label>
                {nominal > 0 && (
                  <button
                    type="button"
                    onClick={() => setNominal(0)}
                    className="text-[10px] text-slate-400 hover:text-rose-600 font-medium cursor-pointer transition-colors"
                  >
                    Reset (Rp 0)
                  </button>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                value={formatCurrencyInput(nominal)}
                onFocus={(e) => e.currentTarget.select()}
                onClick={(e) => {
                  if (nominal > 0) e.currentTarget.select();
                }}
                onChange={(e) => setNominal(parseCurrencyInput(e.target.value))}
                placeholder="Rp 0"
                className="w-full text-sm sm:text-base py-1.5 px-2.5 rounded-lg border border-slate-200 font-bold text-slate-900 font-mono tracking-tight focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal leading-none transition"
              />

              <div className="grid grid-cols-5 gap-1 mt-1 w-full">
                {[
                  { label: '+100rb', value: 100000 },
                  { label: '+500rb', value: 500000 },
                  { label: '+1 Jt', value: 1000000 },
                  { label: '+2 Jt', value: 2000000 },
                  { label: '+5 Jt', value: 5000000 },
                ].map((btn) => (
                  <button
                    key={btn.value}
                    type="button"
                    onClick={() => setNominal((prev) => (Number(prev) || 0) + btn.value)}
                    className="relative w-full py-1 px-0.5 rounded-md text-center text-[9px] sm:text-[9.5px] font-bold tracking-tight whitespace-nowrap cursor-pointer transition-colors duration-150 border shadow-2xs bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 active:bg-indigo-100 active:border-indigo-300 text-slate-700 border-slate-200 flex items-center justify-center overflow-hidden select-none"
                    title={`Tambah ${btn.label}`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2.2 Field Modal Admin Bank & Biaya Admin Toko (Berdampingan) */}
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <div className="h-4 flex items-center mb-0.5 leading-none">
                  <label className="text-[10px] sm:text-[10.5px] font-medium text-slate-600 truncate">
                    Modal Admin Bank (Opsional)
                  </label>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formatCurrencyInput(adminBankCost)}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => {
                    if (adminBankCost > 0) e.currentTarget.select();
                  }}
                  onChange={(e) => setAdminBankCost(parseCurrencyInput(e.target.value))}
                  placeholder="Rp 0"
                  className="w-full text-xs sm:text-[13px] py-1.5 px-2 rounded-lg border border-slate-200 bg-white font-medium font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal leading-none transition"
                />
                <span className="text-[9px] sm:text-[9.5px] text-slate-400 mt-0.5 block truncate">Potongan modal sistem</span>
              </div>

              <div>
                <div className="h-4 flex items-center justify-between gap-1 mb-0.5 leading-none">
                  <label className="text-[10px] sm:text-[10.5px] font-medium text-slate-600 flex items-center gap-0.5 min-w-0">
                    <span className="truncate">Biaya Admin Toko</span>
                    <span className="text-rose-500 shrink-0">*</span>
                  </label>
                  {/* Opsi Pilihan Mini: Potong Luar (Default) vs Potong Dalam — hanya tampil pada layanan Tarik Tunai */}
                  {isTarikTunai && (
                    <div className="inline-flex items-center gap-1.5 text-[9px] select-none shrink-0">
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="adminFeeType"
                          value="outside"
                          checked={adminFeeType === 'outside'}
                          onChange={() => setAdminFeeType('outside')}
                          className="w-2.5 h-2.5 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-indigo-600"
                        />
                        <span className={adminFeeType === 'outside' ? 'font-bold text-indigo-700' : 'text-slate-500 hover:text-slate-700'}>
                          Potong Luar
                        </span>
                      </label>
                      <span className="text-slate-300">|</span>
                      <label className="inline-flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="adminFeeType"
                          value="inside"
                          checked={adminFeeType === 'inside'}
                          onChange={() => setAdminFeeType('inside')}
                          className="w-2.5 h-2.5 text-amber-600 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-600"
                        />
                        <span className={adminFeeType === 'inside' ? 'font-bold text-amber-700' : 'text-slate-500 hover:text-slate-700'}>
                          Potong Dalam
                        </span>
                      </label>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={
                    adminStoreFee === 0 && hasTypedAdminStoreFeeZero
                      ? 'Rp 0'
                      : formatCurrencyInput(adminStoreFee)
                  }
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => {
                    if (adminStoreFee > 0 || hasTypedAdminStoreFeeZero) e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    const parsed = parseCurrencyInput(e.target.value);
                    setAdminStoreFee(parsed);
                    setHasTypedAdminStoreFeeZero(digits.length > 0 && parsed === 0);
                  }}
                  placeholder="Rp 0"
                  className="w-full text-xs sm:text-[13px] py-1.5 px-2 rounded-lg border border-slate-200 bg-white font-bold text-indigo-700 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal leading-none transition"
                />
                <span className="text-[9px] sm:text-[9.5px] text-slate-400 mt-0.5 block truncate">
                  {isTarikTunai && adminFeeType === 'inside'
                    ? 'Dipotong dari nominal yang diterima nasabah'
                    : 'Dibayar konsumen / di luar nominal'}
                </span>
              </div>
            </div>

            {/* 2.3 Panel Ringkasan Kalkulasi (Semua Font Seragam 11px Kiri & Kanan) */}
            <div className="p-2.5 sm:p-3 pb-3 sm:pb-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 flex flex-col justify-between flex-1 min-h-[154px] text-[11px] shadow-2xs">
              <div className="space-y-1">
                {/* Header Ringkasan */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-200/80">
                  <span className="font-bold text-slate-800 text-[11px]">Ringkasan Kalkulasi Transaksi</span>
                  <span className="text-[9.5px] font-bold px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {getServiceBadge(transType).label}
                  </span>
                </div>

                {/* 1 Kolom Vertikal Rata Kanan (Urutan 1 s/d 6, Jarak Rapat 2px, Seragam 11px) */}
                <div className="space-y-0.5 py-0.5 text-[11px]">
                  {/* 1. Sumber Dana */}
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-500 font-medium text-[11px]">Sumber Dana:</span>
                    <span className="font-bold text-slate-800 font-mono text-right truncate ml-1 text-[11px]">
                      {getFundSourceLabel(fundSource)}
                    </span>
                  </div>

                  {/* 2. Nominal Pokok */}
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-500 font-medium text-[11px]">Nominal Pokok:</span>
                    <span className="font-semibold font-mono text-slate-800 text-right text-[11px]">
                      {formatRupiah(nominal)}
                    </span>
                  </div>

                  {/* 3. Modal Bank */}
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="text-slate-500 font-medium text-[11px]">Modal Bank (-):</span>
                    <span className="font-mono text-slate-500 text-right text-[11px]">
                      -{formatRupiah(adminBankCost)}
                    </span>
                  </div>

                  {/* 4. Admin Toko */}
                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-500 font-medium text-[11px]">Admin Toko (+):</span>
                    <span
                      className={`font-bold font-mono text-right text-[11px] ${
                        (Number(adminStoreFee) || 0) > 0 ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      +{formatRupiah(Number(adminStoreFee) || 0)}
                    </span>
                  </div>

                  {/* 5. Total Bayar (Baris Linier Rata Kanan) */}
                  <div className="flex justify-between items-center pt-0.5 border-t border-slate-200/80">
                    <span className="font-bold text-slate-700 uppercase text-[11px] flex items-center gap-1">
                      <span>TOTAL:</span>
                      {isTarikTunai && adminFeeType === 'inside' && (
                        <span className="text-[8.5px] font-semibold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/80 normal-case tracking-normal">
                          (Potong Dalam)
                        </span>
                      )}
                    </span>
                    <span className="font-extrabold text-[11px] font-mono text-indigo-700 tracking-tight text-right leading-none">
                      {formatRupiah(totalCustomerPaid)}
                    </span>
                  </div>

                  {/* 6. Margin Fee / Laba (Baris Linier Rata Kanan) */}
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-600 text-[11px]">Admin Fee:</span>
                    <span
                      className={`font-bold text-[11px] font-mono text-right leading-none ${
                        netProfit > 0
                          ? 'text-emerald-700'
                          : netProfit < 0
                          ? 'text-rose-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {netProfit === 0 ? formatRupiah(0) : formatSignedRupiah(netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2.4 Tombol Aksi: Reset & Proses (Kompak & Rata Kanan, Sejajar Presisi dengan Field No Rekening) */}
            <div className="shrink-0 flex items-center justify-end gap-2 pt-1 pb-0.5">
              <button
                type="button"
                onClick={handleResetForm}
                className="relative h-7 py-1 px-3 rounded-lg border border-slate-200 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 active:bg-rose-100 active:border-rose-300 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors duration-150 cursor-pointer shadow-2xs shrink-0 select-none leading-none"
                title="Reset seluruh isian formulir transaksi"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="whitespace-nowrap">Reset</span>
              </button>

              <button
                type="submit"
                disabled={submitting || !isFormValid || isInsufficientBalance}
                title={
                  isInsufficientBalance
                    ? `Saldo ${getFundSourceLabel(fundSource)} tidak cukup (kurang Rp. ${balanceShortfall.toLocaleString('id-ID')})`
                    : transType === 'topup_ewallet' && targetAccount.length !== 12
                    ? `Nomor HP tujuan E-Wallet harus persis 12 digit (saat ini ${targetAccount.length} digit)`
                    : !isFormValid
                    ? 'Lengkapi seluruh field wajib (*) terlebih dahulu'
                    : 'Proses & Simpan Transaksi'
                }
                className="relative h-7 py-1 px-4 rounded-lg border border-indigo-600 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-slate-300 disabled:border-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors duration-150 cursor-pointer shrink-0 select-none leading-none"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">{submitting ? 'Memproses...' : 'Proses'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

{/* ======================================================== */}
      {/* 3. MODAL UPDATE SALDO AKUN SPESIFIK (CASH S/D SEABANK)    */}
      {/* ======================================================== */}
      {isOwner && updateModalOpen && selectedAccountForUpdate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto animate-in fade-in duration-200"
          style={{ overscrollBehavior: 'contain' }}
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
        >
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full h-auto max-h-[96vh] sm:max-h-[95vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Modal Header (Pinned at top) */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Update Saldo:</span>
                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60 text-xs">
                      {getFundSourceLabel(selectedAccountForUpdate)}
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-500 font-medium">
                    Sesuaikan nominal saldo kas atau pindah dana antar sumber akun agen
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setUpdateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Single View Terpadu Mengalir ke Bawah */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedAccountForUpdate === 'brimo1' || selectedAccountForUpdate === 'brimo2') {
                  if (brimo1MutationType === 'mutasi_antar_card' && transferAmount > 0) {
                    handleProcessTransferBetweenCards(e);
                  } else if (
                    brimo1MutationType === 'admin_bulanan_bank' ||
                    brimo1MutationType === 'bunga_bank'
                  ) {
                    handleSaveBankAdjustment(e);
                  } else {
                    handleSaveUpdatedBalance(e);
                  }
                } else if (transferAmount > 0) {
                  handleProcessTransferBetweenCards(e);
                } else {
                  handleSaveUpdatedBalance(e);
                }
              }}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Scrollable Form Body (Internal Scroll) */}
              <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2">
                {/* ====================================================== */}
                {/* KONTAINER 1: SALDO TERDAFTAR SAAT INI                  */}
                {/* ====================================================== */}
                {selectedAccountForUpdate === 'brimo1' ? (
                  (() => {
                    const currentTotalBrimo1Input = Math.max(0, Math.round(Number(newBalanceInput) || 0));
                    const calculatedRealSaldo = currentTotalBrimo1Input - totalTitipanBalance;
                    const isRealSaldoDeficit = calculatedRealSaldo < 0;

                    return (
                      <>
                        {/* ---------------------------------------------------- */}
                        {/* KHUSUS BRIMO 1 (MODEL 2) — UPDATE TOTAL SALDO        */}
                        {/* REAL SALDO & SALDO TITIPAN TERKALKULASI OTOMATIS     */}
                        {/* ---------------------------------------------------- */}
                        <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                          {/* Field Utama: Total Saldo Rekening Brimo 1 (Terkunci default, aktif saat Update diklik) */}
                          <div className="space-y-1.5 pb-2 border-b border-slate-100">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition ${
                                    isBalanceFieldEditable
                                      ? 'bg-indigo-100 text-indigo-700'
                                      : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
                                  }`}
                                >
                                  {isBalanceFieldEditable ? (
                                    <Edit2 className="w-3 h-3" />
                                  ) : (
                                    <Wallet className="w-3 h-3" />
                                  )}
                                </span>
                                <span>Total Saldo Rekening</span>
                                {!isBalanceFieldEditable && (
                                  <span className="text-[8.5px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                    <Lock className="w-2 h-2" />
                                    <span>Terkunci</span>
                                  </span>
                                )}
                              </label>

                              <button
                                type="button"
                                onClick={handleEnableBalanceEdit}
                                className={`text-[10.5px] font-bold transition cursor-pointer shrink-0 ${
                                  isBalanceFieldEditable
                                    ? 'text-indigo-700 underline underline-offset-2'
                                    : 'text-indigo-600 hover:text-indigo-800'
                                }`}
                                title={
                                  isBalanceFieldEditable
                                    ? 'Field Total Saldo aktif (bisa diketik)'
                                    : 'Klik untuk menyesuaikan Total Saldo Brimo 1'
                                }
                              >
                                Update
                              </button>
                            </div>

                            <input
                              ref={balanceInputRef}
                              type="text"
                              inputMode="numeric"
                              autoComplete="off"
                              readOnly={!isBalanceFieldEditable}
                              disabled={!isBalanceFieldEditable}
                              value={'Rp ' + currentTotalBrimo1Input.toLocaleString('id-ID')}
                              onFocus={(e) => {
                                if (isBalanceFieldEditable) {
                                  e.currentTarget.select();
                                }
                              }}
                              onClick={(e) => {
                                if (isBalanceFieldEditable) {
                                  e.currentTarget.select();
                                }
                              }}
                              onChange={(e) => {
                                if (isBalanceFieldEditable) {
                                  setNewBalanceInput(parseCurrencyInput(e.target.value));
                                }
                              }}
                              placeholder="Rp 0"
                              className={`w-full h-9 text-sm font-extrabold font-mono py-1.5 px-2.5 rounded-lg border transition ${
                                isBalanceFieldEditable
                                  ? 'border-indigo-500 text-indigo-950 bg-white ring-2 ring-indigo-500/20 shadow-xs'
                                  : 'border-slate-200 text-indigo-900 bg-slate-50/90 cursor-not-allowed select-none'
                              }`}
                            />
                          </div>

                          {/* Dua Kotak Informasi Sejajar: Real Saldo (Hasil Hitung) & Saldo Titipan */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {/* Field Kiri: Real Saldo (Otomatis = Total Saldo - Saldo Titipan, bisa minus jika terpakai) */}
                            <div
                              className={`p-2 rounded-lg border space-y-1.5 ${
                                isRealSaldoDeficit
                                  ? 'bg-rose-50/60 border-rose-200/90'
                                  : 'bg-slate-50/70 border-slate-200/90'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <label className="text-[10.5px] font-bold text-slate-800 flex items-center gap-1">
                                  <span
                                    className={`w-3.5 h-3.5 rounded flex items-center justify-center ${
                                      isRealSaldoDeficit
                                        ? 'bg-rose-100 text-rose-600'
                                        : 'bg-emerald-50 text-emerald-600'
                                    }`}
                                  >
                                    <Lock className="w-2 h-2" />
                                  </span>
                                  <span>Real Saldo</span>
                                </label>
                                <span
                                  className={`text-[9.5px] font-bold shrink-0 ${
                                    isRealSaldoDeficit ? 'text-rose-600' : 'text-slate-400 font-semibold'
                                  }`}
                                >
                                  {isRealSaldoDeficit ? 'Titipan Terpakai' : 'Otomatis'}
                                </span>
                              </div>

                              <input
                                type="text"
                                readOnly
                                disabled
                                value={formatRupiah(calculatedRealSaldo)}
                                title="Otomatis dihitung dari Total Saldo dikurangi Saldo Titipan"
                                className={`w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border cursor-not-allowed select-none ${
                                  isRealSaldoDeficit
                                    ? 'border-rose-200 text-rose-700 bg-white/90'
                                    : 'border-slate-200 text-emerald-700 bg-slate-100/85'
                                }`}
                              />
                            </div>

                            {/* Field Kanan: Saldo Titipan (Terkunci Permanen, Sinkron dari Card Titipan) */}
                            <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-200/90 space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <label className="text-[10.5px] font-bold text-slate-700 flex items-center gap-1">
                                  <span className="w-3.5 h-3.5 rounded bg-teal-50 text-teal-600 flex items-center justify-center">
                                    <Lock className="w-2 h-2" />
                                  </span>
                                  <span>Saldo Titipan</span>
                                </label>
                                <span className="text-[10px] font-semibold text-slate-400 shrink-0">
                                  Terkunci
                                </span>
                              </div>

                              <input
                                type="text"
                                readOnly
                                disabled
                                value={formatRupiah(totalTitipanBalance)}
                                title="Terhubung otomatis dengan Card Titipan (tidak dapat diubah manual di sini)"
                                className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-slate-200 text-slate-600 bg-slate-100/85 cursor-not-allowed select-none"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <>
                    {/* ---------------------------------------------------- */}
                    {/* CARD LAINNYA (CASH, BRIMO 2, DANA 1, DANA 2, SEABANK)*/}
                    {/* ---------------------------------------------------- */}
                    <div className="p-2 sm:p-2.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-4 h-4 rounded flex items-center justify-center transition ${
                            isBalanceFieldEditable ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {isBalanceFieldEditable ? <Edit2 className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                          </div>
                          <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                            <span>Saldo Terdaftar Saat Ini</span>
                            {!isBalanceFieldEditable && (
                              <span className="text-[8.5px] font-semibold text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                Terkunci
                              </span>
                            )}
                          </label>
                        </div>

                        {/* Tombol Update & Tombol Set Rp 0 di pojok kanan atas */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={handleEnableBalanceEdit}
                            className={`px-2 py-0.5 rounded-md font-bold text-[9.5px] transition cursor-pointer flex items-center gap-1 border ${
                              isBalanceFieldEditable
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                            }`}
                            title={isBalanceFieldEditable ? 'Field saldo aktif (bisa diketik)' : 'Klik untuk mengaktifkan edit saldo'}
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                            <span>Update</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsBalanceFieldEditable(true);
                              setNewBalanceInput(0);
                            }}
                            className="px-2 py-0.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[9.5px] transition cursor-pointer border border-rose-200"
                          >
                            Set Rp 0
                          </button>
                        </div>
                      </div>

                      {/* Input Editable Langsung (Terkunci sampai tombol Update diklik) */}
                      <div>
                        <input
                          ref={balanceInputRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          readOnly={!isBalanceFieldEditable}
                          value={'Rp ' + Number(newBalanceInput || 0).toLocaleString('id-ID')}
                          onFocus={(e) => {
                            if (isBalanceFieldEditable) {
                              e.currentTarget.select();
                            }
                          }}
                          onClick={(e) => {
                            if (isBalanceFieldEditable) {
                              e.currentTarget.select();
                            } else {
                              handleEnableBalanceEdit();
                            }
                          }}
                          onChange={(e) => {
                            if (isBalanceFieldEditable) {
                              setNewBalanceInput(parseCurrencyInput(e.target.value));
                            }
                          }}
                          placeholder="Rp 0"
                          className={`w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border transition ${
                            isBalanceFieldEditable
                              ? 'border-indigo-500 text-indigo-950 bg-white ring-2 ring-indigo-500/20 shadow-xs'
                              : 'border-slate-200 text-slate-500 bg-slate-100/75 cursor-not-allowed select-none'
                          }`}
                        />
                      </div>
                    </div>

                    {/* TOMBOL CEPAT: SEJAJAR FULL 1 BARIS TANPA TERPOTONG */}
                    <div className="grid grid-cols-5 gap-1 w-full">
                      {[100000, 500000, 1000000, 2000000, 5000000].map((addVal) => (
                        <button
                          key={addVal}
                          type="button"
                          onClick={() => {
                            setIsBalanceFieldEditable(true);
                            setNewBalanceInput((prev) => (Number(prev) || 0) + addVal);
                          }}
                          className="py-1.5 px-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[8.5px] sm:text-[9px] transition cursor-pointer text-center border border-slate-200/80 whitespace-nowrap overflow-hidden"
                        >
                          +{formatRupiah(addVal)}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ====================================================== */}
                {/* KONTAINER 2: PENYESUAIAN / MUTASI                      */}
                {/* ====================================================== */}
                {selectedAccountForUpdate === 'brimo1' || selectedAccountForUpdate === 'brimo2' ? (
                  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/80 border border-slate-200/90 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-amber-100 text-amber-700 flex items-center justify-center">
                          <ArrowRightLeft className="w-2.5 h-2.5" />
                        </div>
                        <label className="text-[11px] font-bold text-slate-800">
                          Penyesuaian/Mutasi
                        </label>
                      </div>
                      <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Opsional
                      </span>
                    </div>

                    {/* Dropdown Jenis Mutasi */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                        Pilih Jenis Mutasi
                      </label>
                      <select
                        value={brimo1MutationType}
                        onChange={(e) => {
                          const val = e.target.value as
                            | 'mutasi_antar_card'
                            | 'admin_bulanan_bank'
                            | 'bunga_bank';
                          setBrimo1MutationType(val);
                          setTransferAmount(0);
                          setTransferBankCost(0);
                          setTransferAdminFee(0);
                          setBankMutationNominal(0);
                          setBankMutationNote('');
                        }}
                        className="w-full h-8 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
                      >
                        <option value="mutasi_antar_card">Mutasi Antar Card</option>
                        <option value="admin_bulanan_bank">Admin Bulanan Bank</option>
                        <option value="bunga_bank">Bunga Bank</option>
                      </select>
                    </div>

                    {/* OPSI 1: MUTASI ANTAR CARD */}
                    {brimo1MutationType === 'mutasi_antar_card' && (
                      <div className="space-y-2 pt-0.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Pilih Sumber Dana Asal (Card yang Diambil Dananya):
                          </label>
                          <select
                            value={transferSourceCard}
                            onChange={(e) => setTransferSourceCard(e.target.value as FundSourceKey)}
                            className="w-full h-8 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
                          >
                            {FUND_SOURCES_CONFIG.filter((cfg) => cfg.key !== selectedAccountForUpdate).map((cfg) => (
                              <option key={cfg.key} value={cfg.key}>
                                {cfg.label} ({cfg.provider}) — Tersedia: {formatRupiah(balances[cfg.key] || 0)}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-between text-[10px] mt-0.5 text-slate-500 font-medium">
                            <span>Saldo Tersedia di Sumber:</span>
                            <span className="font-mono font-bold text-slate-800">
                              {formatRupiah(balances[transferSourceCard] || 0)}
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="text-[10px] font-bold text-slate-700">
                              Nominal Saldo yang Diambil (Rp)
                            </label>
                            {transferAmount > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-indigo-600 font-bold">
                                  Masuk ke {getFundSourceLabel(selectedAccountForUpdate)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setTransferAmount(0)}
                                  className="px-1.5 py-0.2 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[9px] border border-rose-200 cursor-pointer"
                                >
                                  Reset (Rp 0)
                                </button>
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={transferAmount === 0 ? '' : formatCurrencyInput(transferAmount)}
                            onFocus={(e) => e.currentTarget.select()}
                            onClick={(e) => {
                              if (transferAmount > 0) e.currentTarget.select();
                            }}
                            onChange={(e) => setTransferAmount(parseCurrencyInput(e.target.value))}
                            placeholder="Rp 0 (Ketik nominal dana yang dipindahkan)"
                            className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                          <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] font-bold text-slate-800">
                                Biaya Transfer Bank
                              </label>
                              <span className="text-[9px] text-rose-600 font-bold">Dipotong Sumber</span>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={transferBankCost === 0 ? '' : formatCurrencyInput(transferBankCost)}
                              onFocus={(e) => e.currentTarget.select()}
                              onClick={(e) => {
                                if (transferBankCost > 0) e.currentTarget.select();
                              }}
                              onChange={(e) => setTransferBankCost(parseCurrencyInput(e.target.value))}
                              placeholder="Rp 0"
                              className="w-full h-8 text-xs font-bold font-mono py-1 px-2.5 rounded-md border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                            />
                          </div>

                          <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] font-bold text-slate-800">
                                Admin Transfer
                              </label>
                              <span className="text-[9px] text-rose-600 font-bold">Dipotong Sumber</span>
                            </div>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={transferAdminFee === 0 ? '' : formatCurrencyInput(transferAdminFee)}
                              onFocus={(e) => e.currentTarget.select()}
                              onClick={(e) => {
                                if (transferAdminFee > 0) e.currentTarget.select();
                              }}
                              onChange={(e) => setTransferAdminFee(parseCurrencyInput(e.target.value))}
                              placeholder="Rp 0"
                              className="w-full h-8 text-xs font-bold font-mono py-1 px-2.5 rounded-md border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                            />
                          </div>
                        </div>

                        {transferAmount > 0 && (
                          <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-1.5 text-[10.5px]">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400">
                              <span>Simulasi Mutasi:</span>
                              <span className="text-emerald-400">
                                {getFundSourceLabel(transferSourceCard)} ➔ {getFundSourceLabel(selectedAccountForUpdate)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                              <div className="bg-slate-800/80 p-1.5 rounded-md">
                                <span className="text-[9px] text-rose-300 font-bold block">
                                  DIPOTONG DARI {getFundSourceLabel(transferSourceCard).toUpperCase()}:
                                </span>
                                <div className="font-mono text-xs font-bold text-rose-400 mt-0.5">
                                  - {formatRupiah(transferAmount + transferBankCost + transferAdminFee)}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-0.5">
                                  Sisa: {formatRupiah(Math.max(0, (balances[transferSourceCard] || 0) - (transferAmount + transferBankCost + transferAdminFee)))}
                                </div>
                              </div>

                              <div className="bg-slate-800/80 p-1.5 rounded-md">
                                <span className="text-[9px] text-emerald-300 font-bold block">
                                  MASUK KE {getFundSourceLabel(selectedAccountForUpdate).toUpperCase()}:
                                </span>
                                <div className="font-mono text-xs font-bold text-emerald-400 mt-0.5">
                                  + {formatRupiah(transferAmount)}
                                </div>
                                <div className="text-[9px] text-slate-400 mt-0.5">
                                  {selectedAccountForUpdate === 'brimo1'
                                    ? `Total Saldo Baru: ${formatRupiah((balances.brimo1 || 0) + transferAmount)} (Real: ${formatRupiah((balances.brimo1 || 0) + transferAmount - totalTitipanBalance)})`
                                    : `Saldo Baru: ${formatRupiah((balances[selectedAccountForUpdate] || 0) + transferAmount)}`}
                                </div>
                              </div>
                            </div>

                            {(balances[transferSourceCard] || 0) < transferAmount + transferBankCost + transferAdminFee && (
                              <div className="p-1.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] flex items-center gap-1 font-medium">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                <span>
                                  Saldo {getFundSourceLabel(transferSourceCard)} tidak mencukupi (kurang {formatRupiah(transferAmount + transferBankCost + transferAdminFee - (balances[transferSourceCard] || 0))}).
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* OPSI 2: ADMIN BULANAN BANK */}
                    {brimo1MutationType === 'admin_bulanan_bank' && (
                      <div className="space-y-2 pt-0.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Nominal Potongan Bank (Rp)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={bankMutationNominal === 0 ? '' : formatCurrencyInput(bankMutationNominal)}
                            onFocus={(e) => e.currentTarget.select()}
                            onClick={(e) => {
                              if (bankMutationNominal > 0) e.currentTarget.select();
                            }}
                            onChange={(e) => setBankMutationNominal(parseCurrencyInput(e.target.value))}
                            placeholder="Rp 0"
                            className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-rose-300 bg-white text-slate-900 focus:ring-1 focus:ring-rose-500 placeholder:text-slate-400 placeholder:font-normal transition"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Catatan / Keterangan
                          </label>
                          <input
                            type="text"
                            value={bankMutationNote}
                            onChange={(e) => setBankMutationNote(e.target.value)}
                            placeholder="Contoh: Biaya admin bulanan rekening BRI"
                            className="w-full h-8 text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 transition"
                          />
                        </div>

                        {bankMutationNominal > 0 && (() => {
                          const isBrimo1 = selectedAccountForUpdate === 'brimo1';
                          const currentTotal = Math.max(0, balances[selectedAccountForUpdate] || 0);
                          const isOverTotal = bankMutationNominal > currentTotal;
                          const nextTotal = Math.max(0, currentTotal - bankMutationNominal);
                          const nextRealBrimo1 = nextTotal - totalTitipanBalance;
                          return (
                            <div className="p-2 rounded-lg bg-slate-900 text-white space-y-1 text-[10px]">
                              <div className="flex items-center justify-between text-slate-300">
                                <span>{isBrimo1 ? 'Total Saldo Saat Ini:' : 'Saldo Terdaftar Saat Ini:'}</span>
                                <span className="font-mono font-bold">{formatRupiah(currentTotal)}</span>
                              </div>
                              <div className="flex items-center justify-between text-rose-400">
                                <span>Potongan Admin Bank:</span>
                                <span className="font-mono font-bold">- {formatRupiah(bankMutationNominal)}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold text-white">
                                <span>{isBrimo1 ? 'Total Saldo Setelah Potong:' : 'Saldo Setelah Potong:'}</span>
                                <span className="font-mono text-amber-300">{formatRupiah(nextTotal)}</span>
                              </div>
                              {isBrimo1 && (
                                <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                                  <span>Real Saldo Setelah Potong:</span>
                                  <span className={`font-mono font-bold ${nextRealBrimo1 < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {formatRupiah(nextRealBrimo1)}
                                  </span>
                                </div>
                              )}
                              {isOverTotal && (
                                <div className="p-1.5 mt-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center gap-1 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                  <span>
                                    {isBrimo1
                                      ? 'Nominal potongan melebihi Total Saldo Brimo 1 saat ini.'
                                      : 'Nominal potongan melebihi Saldo Brimo 2 saat ini.'}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* OPSI 3: BUNGA BANK */}
                    {brimo1MutationType === 'bunga_bank' && (
                      <div className="space-y-2 pt-0.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Nominal Bunga Bank (Rp)
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            value={bankMutationNominal === 0 ? '' : formatCurrencyInput(bankMutationNominal)}
                            onFocus={(e) => e.currentTarget.select()}
                            onClick={(e) => {
                              if (bankMutationNominal > 0) e.currentTarget.select();
                            }}
                            onChange={(e) => setBankMutationNominal(parseCurrencyInput(e.target.value))}
                            placeholder="Rp 0"
                            className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-emerald-300 bg-white text-slate-900 focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-400 placeholder:font-normal transition"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Catatan / Keterangan
                          </label>
                          <input
                            type="text"
                            value={bankMutationNote}
                            onChange={(e) => setBankMutationNote(e.target.value)}
                            placeholder="Contoh: Bunga tabungan BRI bulan ini"
                            className="w-full h-8 text-xs font-medium py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 transition"
                          />
                        </div>

                        {bankMutationNominal > 0 && (() => {
                          const isBrimo1 = selectedAccountForUpdate === 'brimo1';
                          const currentTotal = Math.max(0, balances[selectedAccountForUpdate] || 0);
                          const nextTotal = currentTotal + bankMutationNominal;
                          const nextRealBrimo1 = nextTotal - totalTitipanBalance;
                          return (
                            <div className="p-2 rounded-lg bg-slate-900 text-white space-y-1 text-[10px]">
                              <div className="flex items-center justify-between text-slate-300">
                                <span>{isBrimo1 ? 'Total Saldo Saat Ini:' : 'Saldo Terdaftar Saat Ini:'}</span>
                                <span className="font-mono font-bold">{formatRupiah(currentTotal)}</span>
                              </div>
                              <div className="flex items-center justify-between text-emerald-400">
                                <span>Penambahan Bunga Bank:</span>
                                <span className="font-mono font-bold">+ {formatRupiah(bankMutationNominal)}</span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-bold text-white">
                                <span>{isBrimo1 ? 'Total Saldo Setelah Ditambah:' : 'Saldo Setelah Ditambah:'}</span>
                                <span className="font-mono text-emerald-300">{formatRupiah(nextTotal)}</span>
                              </div>
                              {isBrimo1 && (
                                <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                                  <span>Real Saldo Setelah Ditambah:</span>
                                  <span className={`font-mono font-bold ${nextRealBrimo1 < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {formatRupiah(nextRealBrimo1)}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2 sm:p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/90 shadow-2xs space-y-2">
                    {/* ---------------------------------------------------- */}
                    {/* BAGIAN 3: AMBIL DARI CARD LAIN / SUMBER DANA ASAL   */}
                    {/* ---------------------------------------------------- */}
                    <div className="flex items-center justify-between border-b border-slate-200/80 pb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-amber-100 text-amber-700 flex items-center justify-center">
                          <ArrowRightLeft className="w-2.5 h-2.5" />
                        </div>
                        <label className="text-[11px] font-bold text-slate-800">
                          Ambil dari Card Lain / Sumber Dana Asal
                        </label>
                      </div>
                      <span className="text-[9px] text-amber-700 font-bold bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                        Opsional / Mutasi
                      </span>
                    </div>

                    {/* Dropdown Sumber Dana Asal */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                        Pilih Sumber Dana Asal (Card yang Diambil Dananya):
                      </label>
                      <select
                        value={transferSourceCard}
                        onChange={(e) => setTransferSourceCard(e.target.value as FundSourceKey)}
                        className="w-full h-8 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
                      >
                        {FUND_SOURCES_CONFIG.filter((cfg) => cfg.key !== selectedAccountForUpdate).map((cfg) => (
                          <option key={cfg.key} value={cfg.key}>
                            {cfg.label} ({cfg.provider}) — Tersedia: {formatRupiah(balances[cfg.key] || 0)}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center justify-between text-[10px] mt-0.5 text-slate-500 font-medium">
                        <span>Saldo Tersedia di Sumber:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {formatRupiah(balances[transferSourceCard] || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Input Nominal Saldo yang Diambil */}
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[10px] font-bold text-slate-700">
                          Nominal Saldo yang Diambil (Rp)
                        </label>
                        {transferAmount > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-indigo-600 font-bold">
                              Masuk ke {getFundSourceLabel(selectedAccountForUpdate)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setTransferAmount(0)}
                              className="px-1.5 py-0.2 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[9px] border border-rose-200 cursor-pointer"
                            >
                              Reset (Rp 0)
                            </button>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={transferAmount === 0 ? '' : formatCurrencyInput(transferAmount)}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => {
                          if (transferAmount > 0) e.currentTarget.select();
                        }}
                        onChange={(e) => setTransferAmount(parseCurrencyInput(e.target.value))}
                        placeholder="Rp 0 (Ketik jika ingin memindahkan dana)"
                        className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                      />

                      {/* Preset Nominal Cepat: Sama persis dengan daftar tombol cepat saldo terdaftar */}
                      <div className="grid grid-cols-5 gap-1 w-full mt-1">
                        {[100000, 500000, 1000000, 2000000, 5000000].map((addVal) => (
                          <button
                            key={addVal}
                            type="button"
                            onClick={() => setTransferAmount((prev) => (Number(prev) || 0) + addVal)}
                            className="py-1.5 px-0.5 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold text-[8.5px] sm:text-[9px] transition cursor-pointer text-center border border-slate-200/80 whitespace-nowrap overflow-hidden"
                          >
                            +{formatRupiah(addVal)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input Field Biaya: Biaya Transfer Bank & Admin Transfer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                      {/* Biaya Transfer Bank */}
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-bold text-slate-800">
                            Biaya Transfer Bank
                          </label>
                          <span className="text-[9px] text-rose-600 font-bold">Dipotong Sumber</span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={transferBankCost === 0 ? '' : formatCurrencyInput(transferBankCost)}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => {
                            if (transferBankCost > 0) e.currentTarget.select();
                          }}
                          onChange={(e) => setTransferBankCost(parseCurrencyInput(e.target.value))}
                          placeholder="Rp 0"
                          className="w-full h-8 text-xs font-bold font-mono py-1 px-2.5 rounded-md border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                        />
                      </div>

                      {/* Admin Transfer (Dipotong dari Sumber) */}
                      <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                        <div className="flex items-center justify-between mb-0.5">
                          <label className="text-[10px] font-bold text-slate-800">
                            Admin Transfer
                          </label>
                          <span className="text-[9px] text-rose-600 font-bold">Dipotong Sumber</span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={transferAdminFee === 0 ? '' : formatCurrencyInput(transferAdminFee)}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => {
                            if (transferAdminFee > 0) e.currentTarget.select();
                          }}
                          onChange={(e) => setTransferAdminFee(parseCurrencyInput(e.target.value))}
                          placeholder="Rp 0"
                          className="w-full h-8 text-xs font-bold font-mono py-1 px-2.5 rounded-md border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Live Simulation Card */}
                    {transferAmount > 0 && (
                      <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-1.5 text-[10.5px]">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400">
                          <span>Simulasi Mutasi:</span>
                          <span className="text-emerald-400">
                            {getFundSourceLabel(transferSourceCard)} ➔ {getFundSourceLabel(selectedAccountForUpdate)}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="bg-slate-800/80 p-1.5 rounded-md">
                            <span className="text-[9px] text-rose-300 font-bold block">
                              DIPOTONG DARI {getFundSourceLabel(transferSourceCard).toUpperCase()}:
                            </span>
                            <div className="font-mono text-xs font-bold text-rose-400 mt-0.5">
                              - {formatRupiah(transferAmount + transferBankCost + transferAdminFee)}
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              Sisa: {formatRupiah(Math.max(0, (balances[transferSourceCard] || 0) - (transferAmount + transferBankCost + transferAdminFee)))}
                            </div>
                          </div>

                          <div className="bg-slate-800/80 p-1.5 rounded-md">
                            <span className="text-[9px] text-emerald-300 font-bold block">
                              MASUK KE {getFundSourceLabel(selectedAccountForUpdate).toUpperCase()}:
                            </span>
                            <div className="font-mono text-xs font-bold text-emerald-400 mt-0.5">
                              + {formatRupiah(transferAmount)}
                            </div>
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              Saldo Baru: {formatRupiah((balances[selectedAccountForUpdate] || 0) + transferAmount)}
                            </div>
                          </div>
                        </div>

                        {(balances[transferSourceCard] || 0) < transferAmount + transferBankCost + transferAdminFee && (
                          <div className="p-1.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                            <span>
                              Saldo {getFundSourceLabel(transferSourceCard)} tidak mencukupi (kurang {formatRupiah(transferAmount + transferBankCost + transferAdminFee - (balances[transferSourceCard] || 0))}).
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fixed Footer Buttons */}
              <div className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2.5 border-t border-slate-100 bg-white flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={() => setUpdateModalOpen(false)}
                  className="py-1.5 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>

                {(selectedAccountForUpdate === 'brimo1' || selectedAccountForUpdate === 'brimo2') &&
                (brimo1MutationType === 'admin_bulanan_bank' || brimo1MutationType === 'bunga_bank') ? (
                  <button
                    type="button"
                    onClick={handleSaveBankAdjustment}
                    disabled={
                      savingBalance ||
                      bankMutationNominal <= 0 ||
                      (brimo1MutationType === 'admin_bulanan_bank' &&
                        bankMutationNominal > Math.max(0, balances[selectedAccountForUpdate] || 0))
                    }
                    className="py-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingBalance ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </>
                    )}
                  </button>
                ) : ((selectedAccountForUpdate !== 'brimo1' && selectedAccountForUpdate !== 'brimo2') ||
                    brimo1MutationType === 'mutasi_antar_card') &&
                  transferAmount > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveUpdatedBalance}
                      disabled={savingBalance}
                      className="py-1.5 sm:py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      Simpan Manual Saja
                    </button>
                    <button
                      type="button"
                      onClick={handleProcessTransferBetweenCards}
                      disabled={
                        savingBalance ||
                        transferAmount <= 0 ||
                        (balances[transferSourceCard] || 0) < transferAmount + transferBankCost + transferAdminFee
                      }
                      className="py-1.5 sm:py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {savingBalance ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Memproses Transfer...</span>
                        </>
                      ) : (
                        <>
                          <ArrowRightLeft className="w-3 h-3" />
                          <span>
                            Ambil {formatRupiah(transferAmount)} dari {getFundSourceLabel(transferSourceCard)}
                          </span>
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button
                    type="submit"
                    disabled={savingBalance}
                    className="py-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {savingBalance ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.1 MODAL ATUR CARD TAGIHAN (SUMBER DANA WAJIB)          */}
      {/* ======================================================== */}
      {tagihanModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && !savingBalance) setTagihanModalOpen(false);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 backdrop-blur-md p-2 sm:p-3 overflow-y-auto animate-in fade-in duration-200"
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Header Modal - Compact */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 border border-amber-200/80 shadow-2xs">
                  <Receipt className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Atur Card Tagihan</span>
                    <span className="text-amber-800 bg-amber-100/90 px-1.5 py-0.2 rounded border border-amber-200 text-[9.5px] font-bold">
                      Mutasi Sumber Dana
                    </span>
                  </h3>
                  <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 font-medium">
                    <span>Saldo Tagihan Saat Ini:</span>
                    <span className="font-mono font-bold text-amber-900 bg-amber-50/80 px-1 py-0.2 rounded border border-amber-200/60">
                      {formatRupiah(balances.tagihan || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTagihanModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveTambahTagihan}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Form Body - Compact & Ringkas Pas 1 Layar */}
              <div className="p-2.5 sm:p-3 space-y-1.5">
                {/* 1. KETERANGAN / PERUNTUKAN (DROPDOWN & INPUT TERPADU DALAM 1 ELEMEN) */}
                <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-slate-800 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>Keterangan / Peruntukan</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>

                    {tagihanPeruntukanMode === 'ketik_tagihan' && tagihanNoteInput && (
                      <button
                        type="button"
                        onClick={() => {
                          setTagihanCustomNote('');
                          setTagihanNoteInput('');
                          tagihanNoteInputRef.current?.focus();
                        }}
                        className="text-[8.5px] text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    )}
                  </div>

                  {/* Satu Baris Elemen Terpadu: Input Teks Langsung + Dropdown Opsi Terintegrasi */}
                  <div ref={peruntukanDropdownRef} className="relative">
                    <div className="flex items-center rounded-md border border-slate-300 bg-white focus-within:ring-1.5 focus-within:ring-amber-500 focus-within:border-amber-500 transition shadow-2xs overflow-hidden h-7">
                      <input
                        ref={tagihanNoteInputRef}
                        type="text"
                        value={tagihanNoteInput}
                        readOnly={tagihanPeruntukanMode === 'gaji_karyawan'}
                        onChange={(e) => {
                          setTagihanCustomNote(e.target.value);
                          setTagihanNoteInput(e.target.value);
                        }}
                        placeholder="Contoh: Pembayaran Sales"
                        className={`w-full h-full text-xs font-semibold px-2 bg-transparent text-slate-800 placeholder:text-slate-400 placeholder:font-normal outline-none ${
                          tagihanPeruntukanMode === 'gaji_karyawan'
                            ? 'cursor-pointer select-none bg-amber-50/50 text-amber-950 font-bold'
                            : ''
                        }`}
                        onClick={() => {
                          if (tagihanPeruntukanMode === 'gaji_karyawan') {
                            setPeruntukanDropdownOpen((prev) => !prev);
                          }
                        }}
                      />

                      {/* Tombol Dropdown Opsi di Sisi Kanan Input */}
                      <div className="shrink-0 pr-1 pl-1 border-l border-slate-200/80 bg-slate-50/80 h-full flex items-center">
                        <button
                          type="button"
                          onClick={() => setPeruntukanDropdownOpen((prev) => !prev)}
                          className="h-5 px-1.5 text-[9.5px] font-bold text-slate-700 hover:text-amber-900 hover:bg-amber-100/70 rounded transition cursor-pointer flex items-center gap-1 select-none whitespace-nowrap"
                          title="Pilih Opsi Keterangan Tagihan"
                        >
                          <span>
                            {tagihanPeruntukanMode === 'gaji_karyawan' ? 'Gaji Karyawan' : 'Ketik Tagihan'}
                          </span>
                          <ChevronDown
                            className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${
                              peruntukanDropdownOpen ? 'rotate-180 text-amber-600' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Pop-up Menu Dropdown Opsi */}
                    {peruntukanDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1 text-xs animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                          Pilih Keterangan Tagihan
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTagihanPeruntukanMode('gaji_karyawan');
                            setTagihanNoteInput('Pembayaran Gaji Karyawan');
                            setPeruntukanDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-amber-50 text-slate-700 hover:text-amber-900 transition cursor-pointer ${
                            tagihanPeruntukanMode === 'gaji_karyawan' ? 'bg-amber-50 text-amber-900 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span>Pembayaran Gaji Karyawan</span>
                          </div>
                          {tagihanPeruntukanMode === 'gaji_karyawan' && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTagihanPeruntukanMode('ketik_tagihan');
                            setTagihanNoteInput(tagihanCustomNote === 'Pembayaran Gaji Karyawan' ? '' : tagihanCustomNote);
                            setPeruntukanDropdownOpen(false);
                            setTimeout(() => {
                              if (tagihanNoteInputRef.current) {
                                tagihanNoteInputRef.current.focus();
                              }
                            }, 50);
                          }}
                          className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-amber-50 text-slate-700 hover:text-amber-900 transition cursor-pointer ${
                            tagihanPeruntukanMode === 'ketik_tagihan' ? 'bg-amber-50 text-amber-900 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span>Ketik Tagihan</span>
                          </div>
                          {tagihanPeruntukanMode === 'ketik_tagihan' && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. NOMINAL TAGIHAN (TENGAH) */}
                <div className="p-2 rounded-xl bg-amber-50/40 border border-amber-200/80 space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-amber-950 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>Nominal Tagihan (Rp)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>

                    {tagihanAddAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setTagihanAddAmount(0)}
                        className="px-1.5 py-0.2 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[8.5px] transition cursor-pointer border border-rose-200"
                      >
                        Reset (Rp 0)
                      </button>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={tagihanAddAmount === 0 ? '' : formatCurrencyInput(tagihanAddAmount)}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => {
                        if (tagihanAddAmount > 0) e.currentTarget.select();
                      }}
                      onChange={(e) => setTagihanAddAmount(parseCurrencyInput(e.target.value))}
                      placeholder="Rp 0"
                      className="w-full h-7.5 text-xs sm:text-sm font-extrabold font-mono py-0.5 px-2 rounded-md border border-amber-300 bg-white text-amber-950 focus:ring-1.5 focus:ring-amber-500 focus:border-amber-500 placeholder:text-slate-400 placeholder:font-normal transition shadow-2xs"
                    />
                  </div>

                  {/* Tombol Cepat Preset Nominal Tagihan */}
                  <div className="grid grid-cols-5 gap-1 w-full">
                    {[50000, 100000, 200000, 500000, 1000000].map((addVal) => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => setTagihanAddAmount((prev) => (Number(prev) || 0) + addVal)}
                        className="relative h-6 py-0 px-0.5 rounded bg-white hover:bg-amber-100 hover:border-amber-300 active:bg-amber-200 active:border-amber-400 text-slate-700 hover:text-amber-900 font-bold text-[8.5px] transition-colors duration-150 cursor-pointer text-center border border-slate-200/90 whitespace-nowrap overflow-hidden shadow-2xs select-none"
                      >
                        +{formatRupiah(addVal).replace('Rp ', '')}
                      </button>
                    ))}
                  </div>

                  {tagihanAddAmount > 0 && (
                    <div className="flex items-center justify-between pt-0.5 border-t border-amber-200/60 text-[9.5px]">
                      <span className="text-slate-600 font-medium">Total Tagihan Menjadi:</span>
                      <span className="font-mono font-bold text-amber-900">
                        {formatRupiah((balances.tagihan || 0) + tagihanAddAmount)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. SUMBER DANA ASAL + BIAYA MODAL BANK & BIAYA ADMIN (BAWAH) */}
                <div className="p-2 rounded-xl bg-slate-50/90 border border-slate-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10.5px] font-bold text-slate-800 flex items-center gap-1">
                      <ArrowRightLeft className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Sumber Dana Asal (Dipotong)</span>
                      <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <span className="text-[8.5px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Potong Saldo
                    </span>
                  </div>

                  <div>
                    <select
                      value={tagihanTransferSourceCard}
                      onChange={(e) => setTagihanTransferSourceCard(e.target.value as FundSourceKey)}
                      className="w-full h-7 text-xs font-semibold py-0.5 px-2 rounded-md border border-slate-300 bg-white text-slate-800 focus:ring-1.5 focus:ring-amber-500 focus:border-amber-500 transition cursor-pointer"
                    >
                      {FUND_SOURCES_CONFIG.filter((cfg) => cfg.key !== 'tagihan').map((cfg) => (
                        <option key={cfg.key} value={cfg.key}>
                          {cfg.label} ({cfg.provider}) — Tersedia: {formatRupiah(balances[cfg.key] || 0)}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-between text-[9.5px] mt-0.5 text-slate-500 font-medium px-0.5">
                      <span>Saldo Tersedia di Sumber:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {formatRupiah(balances[tagihanTransferSourceCard] || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Input: Biaya Modal Bank & Biaya Admin */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[9.5px] font-bold text-slate-700">
                          Biaya Modal Bank
                        </label>
                        <span className="text-[8.5px] text-slate-400 font-medium">Opsional</span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={tagihanBankCost === 0 ? '' : formatCurrencyInput(tagihanBankCost)}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => {
                          if (tagihanBankCost > 0) e.currentTarget.select();
                        }}
                        onChange={(e) => setTagihanBankCost(parseCurrencyInput(e.target.value))}
                        placeholder="Rp 0"
                        className="w-full h-7 text-xs font-bold font-mono py-0.5 px-2 rounded border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 placeholder:font-normal transition"
                      />
                    </div>

                    <div className="p-1.5 rounded-lg bg-white border border-slate-200">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="text-[9.5px] font-bold text-slate-700">
                          Biaya Admin
                        </label>
                        <span className="text-[8.5px] text-slate-400 font-medium">Opsional</span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={tagihanAdminFee === 0 ? '' : formatCurrencyInput(tagihanAdminFee)}
                        onFocus={(e) => e.currentTarget.select()}
                        onClick={(e) => {
                          if (tagihanAdminFee > 0) e.currentTarget.select();
                        }}
                        onChange={(e) => setTagihanAdminFee(parseCurrencyInput(e.target.value))}
                        placeholder="Rp 0"
                        className="w-full h-7 text-xs font-bold font-mono py-0.5 px-2 rounded border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-amber-500 placeholder:text-slate-400 placeholder:font-normal transition"
                      />
                    </div>
                  </div>

                  {/* Ringkasan Simulasi Pemotongan & Tagihan */}
                  {tagihanAddAmount > 0 && (
                    <div className="p-1.5 rounded-lg bg-slate-900 text-white space-y-1 text-[9.5px]">
                      <div className="flex items-center justify-between pb-0.5 border-b border-slate-800 text-[9px] font-semibold text-slate-400">
                        <span>Simulasi Pemotongan:</span>
                        <span className="text-amber-400 font-mono">
                          {getFundSourceLabel(tagihanTransferSourceCard)} ➔ Card Tagihan
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-[9px]">
                        <div className="bg-slate-800/80 p-1 rounded">
                          <span className="text-[8px] text-rose-300 font-bold block">
                            DIPOTONG DARI {getFundSourceLabel(tagihanTransferSourceCard).toUpperCase()}:
                          </span>
                          <div className="font-mono text-[10.5px] font-bold text-rose-400">
                            - {formatRupiah(tagihanAddAmount + tagihanBankCost + tagihanAdminFee)}
                          </div>
                          <div className="text-[8px] text-slate-400">
                            Sisa: {formatRupiah(Math.max(0, (balances[tagihanTransferSourceCard] || 0) - (tagihanAddAmount + tagihanBankCost + tagihanAdminFee)))}
                          </div>
                        </div>

                        <div className="bg-slate-800/80 p-1 rounded">
                          <span className="text-[8px] text-emerald-300 font-bold block">
                            MASUK KE CARD TAGIHAN:
                          </span>
                          <div className="font-mono text-[10.5px] font-bold text-emerald-400">
                            + {formatRupiah(tagihanAddAmount)}
                          </div>
                          <div className="text-[8px] text-slate-400">
                            Total Baru: {formatRupiah((balances.tagihan || 0) + tagihanAddAmount)}
                          </div>
                        </div>
                      </div>

                      {(balances[tagihanTransferSourceCard] || 0) < (tagihanAddAmount + tagihanBankCost + tagihanAdminFee) && (
                        <div className="p-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[9px] flex items-center gap-1 font-medium mt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                          <span>
                            Saldo {getFundSourceLabel(tagihanTransferSourceCard)} tidak cukup (kurang {formatRupiah((tagihanAddAmount + tagihanBankCost + tagihanAdminFee) - (balances[tagihanTransferSourceCard] || 0))}).
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Footer Buttons - Rata Kanan (Batal dan Simpan) */}
              <div className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2 border-t border-slate-100 bg-slate-50/60 flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTagihanModalOpen(false)}
                  className="py-1 px-3.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    savingBalance ||
                    !tagihanNoteInput.trim() ||
                    tagihanAddAmount <= 0 ||
                    (balances[tagihanTransferSourceCard] || 0) < (tagihanAddAmount + tagihanBankCost + tagihanAdminFee)
                  }
                  className="py-1 px-4.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingBalance ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ======================================================== */}
      {/* 3.2 MODAL AMBIL MARGIN FEE CLOSING (KHUSUS ROLE OWNER)   */}
      {/* ======================================================== */}
      {isOwner && takeFeeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTakeFeeModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto animate-in fade-in duration-200"
          style={{ overscrollBehavior: 'contain' }}
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 border border-emerald-200/80 shadow-2xs">
                  <HandCoins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Ambil Admin Fee (Closing)</span>
                    <span className="text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded border border-emerald-200 text-[9.5px] font-bold">
                      Khusus Owner
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Pemisahan profit bersih dari saldo Cash laci kasir
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTakeFeeModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmTakeMarginFee} className="flex flex-col flex-1 min-h-0">
              <div className="p-3 sm:p-3.5 space-y-2.5">
                {/* Notifikasi Tunggakan Fee Kemarin (Opsi B) */}
                {marginFeeSummary.previousUnclaimedFee > 0 && (
                  <label className="block p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 cursor-pointer space-y-1.5 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={takeIncludePrevious}
                          onChange={(e) => {
                            setTakeIncludePrevious(e.target.checked);
                            setTakeFeeError('');
                          }}
                          className="mt-0.5 w-3.5 h-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                        />
                        <div>
                          <div className="text-xs font-bold text-amber-950 flex items-center gap-1">
                            <Bell className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Sisa Fee Hari Sebelumnya (Belum Diambil)</span>
                          </div>
                          <div className="text-[10px] text-amber-800 mt-0.5">
                            {marginFeeSummary.unclaimedPreviousDays
                              .map((d) => `${d.dateKey} (${formatRupiah(d.amount)})`)
                              .join(', ')}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono font-extrabold text-xs text-amber-900 shrink-0">
                        +{formatRupiah(marginFeeSummary.previousUnclaimedFee)}
                      </span>
                    </div>
                  </label>
                )}

                {/* Margin Fee Hari Ini */}
                <label
                  className={`block p-2.5 rounded-xl border space-y-1 shadow-2xs ${
                    marginFeeSummary.todayRemainingFee > 0
                      ? 'bg-emerald-50/70 border-emerald-200 cursor-pointer'
                      : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {marginFeeSummary.previousUnclaimedFee > 0 && (
                        <input
                          type="checkbox"
                          checked={takeIncludeToday}
                          disabled={marginFeeSummary.todayRemainingFee <= 0}
                          onChange={(e) => {
                            setTakeIncludeToday(e.target.checked);
                            setTakeFeeError('');
                          }}
                          className="w-3.5 h-3.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
                        />
                      )}
                      <div>
                        <div className="text-xs font-bold text-emerald-950">
                          Admin Fee Hari Ini ({todayDateKey})
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          {marginFeeSummary.todayTaken > 0
                            ? `Sudah diambil sebelumnya: ${formatRupiah(marginFeeSummary.todayTaken)}`
                            : 'Total akumulasi profit bersih hari ini'}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono font-extrabold text-xs sm:text-sm shrink-0 ${
                        marginFeeSummary.todayRemainingFee < 0 ? 'text-rose-600' : 'text-emerald-800'
                      }`}
                    >
                      {formatSignedRupiah(marginFeeSummary.todayRemainingFee)}
                    </span>
                  </div>
                </label>

                {/* Simulasi Pemotongan Saldo Cash */}
                <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1.5 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400">
                    <span>Sumber Pemotongan Saldo</span>
                    <span className="text-emerald-400 font-bold">Card Cash (Laci Kasir)</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Saldo Cash Saat Ini:</span>
                    <span className="font-mono font-bold text-white">
                      {formatRupiah(balances.cash)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Total Fee Diambil:</span>
                    <span className="font-mono font-extrabold text-rose-400">
                      - {formatRupiah(selectedTakeAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
                    <span className="font-bold text-slate-200">Estimasi Sisa Cash:</span>
                    <span
                      className={`font-mono font-extrabold ${
                        balances.cash >= selectedTakeAmount ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(Math.max(0, balances.cash - selectedTakeAmount))}
                    </span>
                  </div>
                </div>

                {(balances.cash < selectedTakeAmount || takeFeeError) && (
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                    <span>
                      {takeFeeError ||
                        `Saldo Cash tidak mencukupi (kurang ${formatRupiah(selectedTakeAmount - balances.cash)}).`}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer Buttons */}
              <div className="shrink-0 px-3.5 py-2.5 border-t border-slate-100 bg-slate-50/70 flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTakeFeeModalOpen(false)}
                  className="py-1.5 px-3.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={selectedTakeAmount <= 0 || balances.cash < selectedTakeAmount}
                  className="py-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Ambil Fee ({formatRupiah(selectedTakeAmount)})</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3.3 MODAL UTAMA CARD TITIPAN (GAYA VISUAL MODAL BRIMO)    */}
      {/* ======================================================== */}
      {titipanModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (!hasTitipanChildModalOpen && e.target === e.currentTarget) {
                setTitipanModalOpen(false);
              }
            }}
            className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 overflow-y-auto ${
              hasTitipanChildModalOpen
                ? 'bg-transparent backdrop-blur-none pointer-events-none'
                : 'bg-slate-900/50 backdrop-blur-md'
            }`}
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full h-auto max-h-[96vh] sm:max-h-[95vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Saldo Titipan</span>
                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60 text-xs">
                      Daftar Penitip
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-500 font-medium">
                    Kelola saldo titipan pelanggan, penambahan, dan pencairan dana
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTitipanModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                title="Tutup Modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
              {/* Informasi Utama: Total Saldo Titipan Keseluruhan */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10.5px] font-bold text-slate-500 block">
                    Total Saldo Titipan Keseluruhan
                  </span>
                  <span className="font-extrabold text-base sm:text-lg text-indigo-700 font-mono tracking-tight">
                    {formatRupiah(totalTitipanBalance)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-1 rounded-md inline-block">
                    {titipanAccounts.length} Penitip
                  </span>
                </div>
              </div>

              {/* Tombol Aksi Utama: Tambah Daftar Titipan */}
              <button
                type="button"
                onClick={handleOpenAddPenitipModal}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center cursor-pointer"
              >
                <span>Tambah Daftar Titipan</span>
              </button>

              {/* Daftar Penitip */}
              <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 overflow-hidden shadow-2xs">
                <div className="px-2.5 py-1.5 border-b border-slate-200/80 bg-white flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800">Daftar Penitip</span>
                  <span className="text-[9.5px] text-slate-500 font-medium">
                    Aksi: + Tambah | - Tarik | Hapus
                  </span>
                </div>

                {titipanAccounts.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-500">
                    Belum ada data penitip. Klik <strong>Tambah Daftar Titipan</strong> untuk menambahkan.
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] font-bold text-slate-600">
                          <th className="py-1.5 px-2 w-8 text-center">No</th>
                          <th className="py-1.5 px-2">Nama</th>
                          <th className="py-1.5 px-2 text-right">Saldo</th>
                          <th className="py-1.5 px-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {titipanAccounts.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-2 text-center text-[11px] font-semibold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2 font-bold text-slate-800 text-[11.5px] max-w-[110px] truncate" title={item.name}>
                              {item.name}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-extrabold text-slate-900 text-[11.5px] whitespace-nowrap">
                              {formatRupiah(item.balance)}
                            </td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenTopupPenitipModal(item)}
                                  title="Tambah Saldo Penitip"
                                  aria-label={`Tambah saldo ${item.name}`}
                                  className="bg-transparent border-0 p-0.5 text-sm font-extrabold leading-none text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                                >
                                  +
                                </button>
                                <span className="text-slate-300 text-xs select-none" aria-hidden="true">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTarikPenitipModal(item)}
                                  title="Tarik Saldo Penitip"
                                  aria-label={`Tarik saldo ${item.name}`}
                                  className="bg-transparent border-0 p-0.5 text-sm font-extrabold leading-none text-amber-600 hover:text-amber-800 transition-colors cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="text-slate-300 text-xs select-none" aria-hidden="true">|</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenDeletePenitipModal(item)}
                                  title="Hapus Data Penitip"
                                  aria-label={`Hapus ${item.name}`}
                                  className="bg-transparent border-0 p-0.5 text-rose-500 hover:text-rose-700 transition-colors cursor-pointer inline-flex items-center justify-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2.5 border-t border-slate-100 bg-white flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setTitipanModalOpen(false)}
                className="py-1.5 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* 3.4 SUB-MODAL + TAMBAH PENITIP BARU                      */}
      {/* ======================================================== */}
      {addPenitipModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setAddPenitipModalOpen(false);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto"
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full h-auto max-h-[96vh] sm:max-h-[95vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    Tambah Penitip Baru
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAddPenitipModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPenitip} className="flex flex-col flex-1 min-h-0">
              <div className="p-3 sm:p-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Nama <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={newPenitipName}
                      onChange={(e) => setNewPenitipName(e.target.value)}
                      placeholder="Nama penitip"
                      className="w-full h-8 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Nominal <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      value={newPenitipNominal === 0 ? '' : formatCurrencyInput(newPenitipNominal)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setNewPenitipNominal(parseCurrencyInput(e.target.value))}
                      placeholder="Rp 0"
                      className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2.5 border-t border-slate-100 bg-white flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddPenitipModalOpen(false)}
                  className="py-1.5 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingTitipan || !newPenitipName.trim() || newPenitipNominal <= 0}
                  className="py-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* 3.5 SUB-MODAL ACTION [ TAMBAH ] SALDO PENITIP            */}
      {/* ======================================================== */}
      {topupPenitipTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setTopupPenitipTarget(null);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto"
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full h-auto max-h-[96vh] sm:max-h-[95vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Tambah Saldo Penitip:</span>
                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60 text-xs">
                      {topupPenitipTarget.name}
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-500 font-medium">
                    Tambahkan nominal setoran titipan ke saldo penitip
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTopupPenitipTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTopupPenitip} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2.5">
                {/* Informasi Saldo Saat Ini */}
                <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/90 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Saldo Saat Ini:</span>
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {formatRupiah(topupPenitipTarget.balance)}
                  </span>
                </div>

                {/* Input Nominal Tambahan */}
                <div className="p-2.5 rounded-lg bg-white border border-slate-200/90 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-800">
                      Nominal Saldo Ditambah (Rp) <span className="text-rose-500">*</span>
                    </label>
                    {topupPenitipAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => setTopupPenitipAmount(0)}
                        className="px-1.5 py-0.2 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[9px] border border-rose-200 cursor-pointer"
                      >
                        Reset (Rp 0)
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    autoFocus
                    required
                    value={topupPenitipAmount === 0 ? '' : formatCurrencyInput(topupPenitipAmount)}
                    onFocus={(e) => e.currentTarget.select()}
                    onChange={(e) => setTopupPenitipAmount(parseCurrencyInput(e.target.value))}
                    placeholder="Rp 0"
                    className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                  />

                  <div className="grid grid-cols-5 gap-1 w-full pt-0.5">
                    {[100000, 500000, 1000000, 2000000, 5000000].map((addVal) => (
                      <button
                        key={addVal}
                        type="button"
                        onClick={() => setTopupPenitipAmount((prev) => (Number(prev) || 0) + addVal)}
                        className="py-1.5 px-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[8.5px] sm:text-[9px] transition cursor-pointer text-center border border-slate-200/80 whitespace-nowrap overflow-hidden"
                      >
                        +{formatRupiah(addVal)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simulasi Penambahan */}
                <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-1.5 text-[10.5px]">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400">
                    <span>Simulasi Penambahan Saldo</span>
                    <span className="text-emerald-400 font-bold">{topupPenitipTarget.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Saldo Saat Ini:</span>
                    <span className="font-mono font-bold text-white">
                      {formatRupiah(topupPenitipTarget.balance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Penambahan (+):</span>
                    <span className="font-mono font-bold text-emerald-400">
                      + {formatRupiah(topupPenitipAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
                    <span className="font-bold text-slate-200">Total Saldo Baru:</span>
                    <span className="font-mono font-extrabold text-emerald-400">
                      {formatRupiah((Number(topupPenitipTarget.balance) || 0) + (Number(topupPenitipAmount) || 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2.5 border-t border-slate-100 bg-white flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTopupPenitipTarget(null)}
                  className="py-1.5 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingTitipan || topupPenitipAmount <= 0}
                  className="py-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* 3.6 SUB-MODAL ACTION [ TARIK ] SALDO PENITIP             */}
      {/* ======================================================== */}
      {tarikPenitipTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setTarikPenitipTarget(null);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto"
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full h-auto max-h-[96vh] sm:max-h-[95vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5 flex-wrap">
                    <span>Tarik Saldo Penitip:</span>
                    <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60 text-xs">
                      {tarikPenitipTarget.name}
                    </span>
                  </h3>
                  <p className="text-[9.5px] text-slate-500 font-medium">
                    Pencairan atau penarikan dana dari saldo titipan penitip
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTarikPenitipTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTarikPenitip} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-2.5 sm:p-3 space-y-2">
                {/* Saldo Saat Ini */}
                <div className="p-2.5 rounded-lg bg-slate-50/80 border border-slate-200/90 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">Saldo Saat Ini:</span>
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {formatRupiah(tarikPenitipTarget.balance)}
                  </span>
                </div>

                {/* Jenis Penarikan */}
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    Jenis Penarikan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={tarikJenisTransaksi}
                    onChange={(e) => setTarikJenisTransaksi(e.target.value as 'Transfer' | 'Tarik Tunai')}
                    className="w-full h-8 text-xs font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 transition cursor-pointer"
                  >
                    <option value="Transfer">Transfer</option>
                    <option value="Tarik Tunai">Tarik Tunai</option>
                  </select>
                </div>

                {/* No Rekening */}
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                    No Rekening {tarikJenisTransaksi === 'Transfer' ? <span className="text-rose-500">*</span> : '(Opsional)'}
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    required={tarikJenisTransaksi === 'Transfer'}
                    value={tarikNoRekening}
                    onChange={(e) => setTarikNoRekening(e.target.value.replace(/\D/g, ''))}
                    placeholder={
                      tarikJenisTransaksi === 'Transfer'
                        ? 'Contoh: 001901002345501'
                        : 'Opsional nomor rekening / catatan'
                    }
                    className="w-full h-8 text-xs font-mono font-semibold py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                  />
                </div>

                {/* Nominal & Biaya Admin (Opsional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Nominal <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      value={tarikNominal === 0 ? '' : formatCurrencyInput(tarikNominal)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setTarikNominal(parseCurrencyInput(e.target.value))}
                      placeholder="Rp 0"
                      className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Biaya Admin (Opsional)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      value={tarikAdminFee === 0 ? '' : formatCurrencyInput(tarikAdminFee)}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setTarikAdminFee(parseCurrencyInput(e.target.value))}
                      placeholder="Rp 0"
                      className="w-full h-8 text-xs font-bold font-mono py-1.5 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 placeholder:font-normal transition"
                    />
                  </div>
                </div>

                {/* Simulasi Pencairan */}
                <div className="p-2.5 rounded-lg bg-slate-900 text-white space-y-1 text-[10.5px]">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400">
                    <span>Simulasi Penarikan ({tarikJenisTransaksi})</span>
                    <span className="text-indigo-400 font-bold">{tarikPenitipTarget.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Saldo Saat Ini:</span>
                    <span className="font-mono font-bold text-white">
                      {formatRupiah(tarikPenitipTarget.balance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300">Total Dipotong (Nominal + Admin):</span>
                    <span className="font-mono font-bold text-rose-400">
                      - {formatRupiah(tarikNominal + tarikAdminFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
                    <span className="font-bold text-slate-200">Sisa Saldo Penitip:</span>
                    <span
                      className={`font-mono font-extrabold ${
                        tarikPenitipTarget.balance >= tarikNominal + tarikAdminFee
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {formatRupiah(Math.max(0, tarikPenitipTarget.balance - (tarikNominal + tarikAdminFee)))}
                    </span>
                  </div>

                  {tarikJenisTransaksi === 'Tarik Tunai' && (
                    <div className="pt-1.5 mt-1 border-t border-slate-800/90 space-y-1 text-[10.5px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Potong Card Cash (Tersedia {formatRupiah(balances.cash || 0)}):</span>
                        <span className="font-mono font-bold text-rose-400">
                          - {formatRupiah(tarikNominal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Real Saldo Brimo 1 Bertambah:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          + {formatRupiah(tarikNominal + tarikAdminFee)}
                        </span>
                      </div>
                    </div>
                  )}

                  {tarikPenitipTarget.balance < tarikNominal + tarikAdminFee && (
                    <div className="p-1.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] flex items-center gap-1 font-medium mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>
                        Saldo titipan tidak mencukupi (kurang {formatRupiah(tarikNominal + tarikAdminFee - tarikPenitipTarget.balance)}).
                      </span>
                    </div>
                  )}

                  {tarikJenisTransaksi === 'Tarik Tunai' && tarikNominal > (balances.cash || 0) && (
                    <div className="p-1.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] flex items-center gap-1 font-medium mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      <span>
                        Saldo Card Cash tidak mencukupi (kurang {formatRupiah(tarikNominal - (balances.cash || 0))}).
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2.5 border-t border-slate-100 bg-white flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTarikPenitipTarget(null)}
                  className="py-1.5 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    savingTitipan ||
                    tarikNominal <= 0 ||
                    (tarikJenisTransaksi === 'Transfer' && !tarikNoRekening.trim()) ||
                    tarikPenitipTarget.balance < tarikNominal + tarikAdminFee ||
                    (tarikJenisTransaksi === 'Tarik Tunai' && tarikNominal > (balances.cash || 0))
                  }
                  className="py-1.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* 3.7 SUB-MODAL KONFIRMASI HAPUS DATA PENITIP              */}
      {/* ======================================================== */}
      {deletePenitipTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeletePenitipTarget(null);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto"
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
          <div
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-md w-full h-auto max-h-[96vh] sm:max-h-[95vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-3.5 sm:py-2.5 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-slate-900">
                    Hapus Data Penitip
                  </h3>
                  <p className="text-[9.5px] text-slate-500 font-medium">
                    Konfirmasi penghapusan penitip dari daftar saldo titipan
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeletePenitipTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 sm:p-3.5 space-y-2.5">
              <div className="p-2.5 rounded-lg bg-rose-50/70 border border-rose-200/80 text-xs text-slate-700 space-y-1">
                <p>
                  Apakah Anda yakin ingin menghapus data penitip{' '}
                  <strong className="text-slate-900">{deletePenitipTarget.name}</strong>?
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-rose-200/60 text-[11px]">
                  <span className="text-slate-600 font-medium">Saldo tercatat:</span>
                  <span className="font-mono font-extrabold text-rose-700">
                    {formatRupiah(deletePenitipTarget.balance)}
                  </span>
                </div>
              </div>
            </div>

            <div className="shrink-0 px-3 py-2 sm:px-3.5 sm:py-2.5 border-t border-slate-100 bg-white flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setDeletePenitipTarget(null)}
                className="py-1.5 px-3.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingTitipan}
                onClick={handleConfirmDeletePenitip}
                className="py-1.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* MODAL KONFIRMASI TRANSAKSI BARU (TANPA SCROLL / NO SCROLL)*/}
      {/* ======================================================== */}
      {confirmTxModalOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && !submitting) {
                setConfirmTxModalOpen(false);
              }
            }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2.5 sm:p-3 overflow-hidden animate-in fade-in duration-150"
            style={{ overscrollBehavior: 'none' }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                      Konfirmasi Transaksi
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight truncate">
                      Periksa rincian &amp; pilih status pembayaran sebelum proses
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmTxModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0 disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body (Kompak & Bebas Scroll) */}
              <div className="p-2.5 sm:p-3 space-y-2 overflow-hidden">
                {/* 1. Rincian Transaksi */}
                <div className="p-2 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-200/70">
                    <span className="text-[11px] font-bold text-slate-800">Rincian Transaksi</span>
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 leading-none">
                      {getServiceBadge(transType).label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                    <div className="min-w-0">
                      <span className="text-[9.5px] text-slate-500 block leading-tight">Layanan / Provider</span>
                      <span className="font-bold text-slate-900 truncate block leading-snug">
                        {(provider === 'LAINNYA'
                          ? customProviderName.trim() || 'LAINNYA'
                          : provider
                        ).toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[9.5px] text-slate-500 block leading-tight">Sumber Dana</span>
                      <span className="font-bold text-indigo-700 truncate block leading-snug">
                        {fundSource === 'atm_pelanggan'
                          ? 'Kartu ATM Pelanggan'
                          : getFundSourceLabel(fundSource)}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[9.5px] text-slate-500 block leading-tight">
                        {transType === 'topup_ewallet'
                          ? 'No. HP Tujuan'
                          : transType === 'ppob_tagihan' || transType.startsWith('ppob')
                          ? 'ID / No. Pelanggan'
                          : 'Tujuan / No. Rekening'}
                      </span>
                      <span className="font-mono font-bold text-slate-900 truncate block leading-snug">
                        {targetAccount.trim()
                          ? targetAccount.trim()
                          : isTarikTunai
                          ? fundSource === 'atm_pelanggan'
                            ? 'Rekening Nasabah'
                            : 'Rekening Internal'
                          : '-'}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[9.5px] text-slate-500 block leading-tight">Nama Pelanggan</span>
                      <span className="font-semibold text-slate-800 truncate block leading-snug">
                        {customerName.trim() || (isTarikTunai ? 'Tarik Tunai' : 'Pelanggan')}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[9.5px] text-slate-500 block leading-tight">Operator</span>
                      <span className="font-semibold text-slate-800 truncate block leading-snug">
                        {operatorInput.trim() || '-'}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[9.5px] text-slate-500 block leading-tight">Nominal Transaksi</span>
                      <span className="font-mono font-extrabold text-indigo-700 truncate block leading-snug">
                        {formatRupiah(nominal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Ringkasan Kalkulasi */}
                <div className="p-2 rounded-xl bg-white border border-slate-200/90 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="font-bold text-slate-800 text-[11px]">Ringkasan Kalkulasi</span>
                    {isTarikTunai && adminFeeType === 'inside' && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 leading-none">
                        Potong Dalam
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-500 font-medium">Nominal Pokok:</span>
                    <span className="font-semibold font-mono text-slate-800">
                      {formatRupiah(nominal)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-500">
                    <span className="text-slate-500 font-medium">Modal Bank (-):</span>
                    <span className="font-mono text-slate-500">
                      -{formatRupiah(adminBankCost)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-600">
                    <span className="text-slate-500 font-medium">Admin Toko (+):</span>
                    <span
                      className={`font-bold font-mono ${
                        (Number(adminStoreFee) || 0) > 0 ? 'text-emerald-700' : 'text-slate-600'
                      }`}
                    >
                      +{formatRupiah(Number(adminStoreFee) || 0)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 border-t border-slate-200/80">
                    <span className="font-bold text-slate-800 uppercase">Total Bayar:</span>
                    <span className="font-extrabold text-xs font-mono text-indigo-700">
                      {formatRupiah(totalCustomerPaid)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-600">Admin Fee:</span>
                    <span
                      className={`font-bold font-mono ${
                        netProfit > 0
                          ? 'text-emerald-700'
                          : netProfit < 0
                          ? 'text-rose-600'
                          : 'text-slate-700'
                      }`}
                    >
                      {netProfit === 0 ? formatRupiah(0) : formatSignedRupiah(netProfit)}
                    </span>
                  </div>

                  {fundSource !== 'atm_pelanggan' && (
                    <div className="mt-0.5 px-2 py-1 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-600 font-medium truncate mr-2">
                        Estimasi Sisa Saldo ({getFundSourceLabel(fundSource)}):
                      </span>
                      <span className="font-mono font-bold text-indigo-900 shrink-0">
                        {formatRupiah(
                          txPaymentStatus === 'hutang' && isTarikTunai && fundSource === 'cash'
                            ? currentFundBalance - totalDeductedFromSource
                            : estimatedRemainingBalance
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Opsi Status Pembayaran (Lunas / Hutang) */}
                <div
                  className={`p-2 rounded-xl border transition-colors ${
                    txPaymentStatus === 'hutang'
                      ? 'bg-rose-50/70 border-rose-200'
                      : 'bg-emerald-50/50 border-emerald-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[11px] font-bold text-slate-800 block leading-tight">
                        Status Pembayaran
                      </span>
                      <span
                        className={`text-[9.5px] font-medium block leading-tight truncate ${
                          txPaymentStatus === 'hutang' ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {txPaymentStatus === 'hutang'
                          ? `Masuk ke Card Hutang (+${formatRupiah(
                              isTarikTunai || fundSource === 'atm_pelanggan'
                                ? Number(adminStoreFee) || 0
                                : totalCustomerPaid
                            )})`
                          : 'Dibayar lunas & masuk ke Card Cash'}
                      </span>
                    </div>
                    <div className="inline-flex rounded-lg bg-white/90 border border-slate-200 p-0.5 shrink-0 shadow-2xs">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setTxPaymentStatus('lunas')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                          txPaymentStatus === 'lunas'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Lunas
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setTxPaymentStatus('hutang')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                          txPaymentStatus === 'hutang'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Hutang
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-3.5 py-2 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setConfirmTxModalOpen(false)}
                  className="py-1.5 px-4 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmSubmitTransaction}
                  className={`py-1.5 px-4 rounded-lg text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    txPaymentStatus === 'hutang'
                      ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                      : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
                  }`}
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Konfirmasi</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* MODAL DAFTAR TRANSAKSI HUTANG & AKSI BAYAR HUTANG        */}
      {/* ======================================================== */}
      {hutangModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (
                e.target === e.currentTarget &&
                !settlingHutangKey &&
                !hutangConfirmTarget &&
                !hutangDetailTarget
              ) {
                setHutangModalOpen(false);
              }
            }}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto"
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
            <div
              className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-6xl w-full h-auto max-h-[92vh] sm:max-h-[90vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
              onTouchMove={handleModalCardScroll}
              onWheel={handleModalCardScroll}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 shrink-0 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                      Daftar Transaksi Hutang
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight truncate">
                      Klik &ldquo;Bayar&rdquo; untuk melunasi &amp; memasukkan dana ke Card Cash
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(settlingHutangKey)}
                  onClick={() => setHutangModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0 disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div
                className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3"
                style={{ overscrollBehavior: 'contain' }}
              >
                {/* Kontainer Pertama: Total Akumulasi Piutang Hutang */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-rose-50/90 to-amber-50/70 border border-rose-200/80 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-semibold text-rose-800 block leading-tight">
                      Total Akumulasi Piutang Hutang
                    </span>
                    <span className="font-extrabold text-base sm:text-lg text-rose-900 font-mono tracking-tight tabular-nums">
                      {formatRupiah(totalHutangBalance)}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-rose-700 bg-white/90 border border-rose-200 px-2 py-1 rounded-md inline-block shrink-0">
                    {hutangTransactions.length} Hutang
                  </span>
                </div>

                {/* Daftar Transaksi Hutang: Tampilan Responsif Persis Riwayat Transaksi */}
                {hutangTransactions.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 space-y-1">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">
                      Tidak ada transaksi berstatus Hutang
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Seluruh transaksi pelanggan sudah berstatus Lunas.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    {/* Desktop & Tablet Table View (>= 768px) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[1060px] table-fixed text-left text-xs divide-y divide-slate-100">
                        <colgroup>
                          <col className="w-[155px]" />
                          <col className="w-auto" />
                          <col className="w-[165px]" />
                          <col className="w-[125px]" />
                          <col className="w-[120px]" />
                          <col className="w-[115px]" />
                          <col className="w-[110px]" />
                          <col className="w-[130px]" />
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
                          {hutangTransactions.map((tx) => {
                            const rowKey = String(tx.referenceNumber || tx.id);
                            const isSettling = settlingHutangKey === rowKey;
                            const debtAmount = getTransactionHutangAmount(tx);
                            const rawType = (tx.type || '').toLowerCase();
                            const rawNotes = tx.notes || '';
                            const isTarikTunai = rawType.includes('tarik') || rawType.includes('cashout');
                            const isEwallet =
                              !isTarikTunai &&
                              (rawType.includes('ewallet') ||
                                rawType.includes('topup') ||
                                rawType.includes('dana') ||
                                rawType.includes('gopay') ||
                                rawType.includes('ovo') ||
                                rawType.includes('shopee') ||
                                rawType.includes('wallet'));
                            const isPpob =
                              !isTarikTunai &&
                              !isEwallet &&
                              (rawType.includes('ppob') ||
                                rawType.includes('pulsa') ||
                                rawType.includes('pln') ||
                                rawType.includes('bpjs') ||
                                rawType.includes('pdam') ||
                                rawType.includes('tagihan'));

                            const adminStoreFeeNum = Number(tx.adminStoreFee || 0);
                            const adminBankCostNum = Number(tx.adminBankCost || 0);
                            const profitNum =
                              tx.profit != null && !Number.isNaN(Number(tx.profit))
                                ? Number(tx.profit)
                                : adminStoreFeeNum - adminBankCostNum;

                            const customerNameStr = (tx.customerName || '').trim();
                            const hasCustomerName =
                              Boolean(customerNameStr) &&
                              customerNameStr.toLowerCase() !== 'pelanggan agen' &&
                              !customerNameStr.toLowerCase().includes('mutasi internal');

                            const resolvedOperator =
                              tx.operatorName ||
                              (rawNotes.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
                              undefined;

                            const dateText = tx.createdAt
                              ? new Date(tx.createdAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-';

                            return (
                              <tr
                                key={rowKey}
                                className="hover:bg-slate-50/80 transition-colors group"
                              >
                                {/* 1. No. Reff & Waktu */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle">
                                  <div
                                    className="font-mono text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
                                    title={tx.referenceNumber}
                                  >
                                    {tx.referenceNumber}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{dateText}</span>
                                  </div>
                                </td>

                                {/* 2. Layanan & Sumber Dana */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isTarikTunai ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                        <Banknote className="w-2.5 h-2.5" />
                                        Tarik Tunai
                                      </span>
                                    ) : isEwallet ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                        <Wallet className="w-2.5 h-2.5" />
                                        E-Wallet
                                      </span>
                                    ) : isPpob ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                        <Zap className="w-2.5 h-2.5" />
                                        PPOB dan Lainnya
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                                        <ArrowRightLeft className="w-2.5 h-2.5" />
                                        Transfer Bank
                                      </span>
                                    )}

                                    <span
                                      className="text-[9.5px] font-bold text-slate-600 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 max-w-full truncate"
                                      title={tx.provider}
                                    >
                                      {tx.provider}
                                    </span>
                                    {tx.fundSource && (
                                      <span
                                        className="text-[9.5px] font-bold text-indigo-700 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-mono max-w-full truncate"
                                        title={tx.fundSource}
                                      >
                                        {tx.fundSource}
                                      </span>
                                    )}
                                    <span className="text-[9.5px] font-bold text-rose-700 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 shrink-0">
                                      HUTANG
                                    </span>
                                  </div>
                                </td>

                                {/* 3. No. Tujuan & Pelanggan */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle">
                                  <div
                                    className="font-mono text-xs font-bold text-slate-900 truncate"
                                    title={tx.targetAccount}
                                  >
                                    {tx.targetAccount || '-'}
                                  </div>
                                  {hasCustomerName && (
                                    <div
                                      className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"
                                      title={tx.customerName}
                                    >
                                      <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                      <span className="truncate">{tx.customerName}</span>
                                    </div>
                                  )}
                                </td>

                                {/* 4. Nominal Trx */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                                  <div className="font-semibold text-slate-800 truncate">
                                    {formatRupiah(tx.nominal)}
                                  </div>
                                  {adminStoreFeeNum > 0 && (
                                    <div className="text-[10px] text-slate-400 truncate">
                                      Admin: {formatRupiah(adminStoreFeeNum)}
                                    </div>
                                  )}
                                </td>

                                {/* 5. Total Bayar */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                                  <div className="font-extrabold text-rose-700 truncate">
                                    {formatRupiah(debtAmount)}
                                  </div>
                                </td>

                                {/* 6. Margin Fee */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                                  <div className="inline-flex flex-col items-end max-w-full">
                                    <span
                                      className={`font-bold px-1.5 py-0.5 rounded border max-w-full truncate ${
                                        profitNum < 0
                                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                                          : profitNum === 0
                                          ? 'text-slate-600 bg-slate-50 border-slate-200'
                                          : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                      }`}
                                    >
                                      {formatSignedRupiah(profitNum)}
                                    </span>
                                    {adminBankCostNum > 0 && (
                                      <span className="text-[9.5px] text-rose-500 font-medium mt-0.5 truncate max-w-full">
                                        Modal: {formatRupiah(adminBankCostNum)}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 7. Operator */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle whitespace-nowrap">
                                  {resolvedOperator ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 max-w-full"
                                      title={resolvedOperator}
                                    >
                                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate">{resolvedOperator}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  )}
                                </td>

                                {/* 8. Aksi (Detail + Bayar) */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setHutangDetailTarget(tx)}
                                      title="Lihat Rincian Lengkap"
                                      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-200/80 border border-slate-200 transition-colors duration-150 cursor-pointer shadow-2xs"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(settlingHutangKey)}
                                      onClick={() => openHutangConfirmModal(tx)}
                                      className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[11px] shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isSettling ? (
                                        <>
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                          <span>...</span>
                                        </>
                                      ) : (
                                        <span>Bayar</span>
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View (< 768px) — Sama Seperti Tampilan Riwayat Transaksi */}
                    <div className="block md:hidden divide-y divide-slate-100">
                      {hutangTransactions.map((tx) => {
                        const rowKey = String(tx.referenceNumber || tx.id);
                        const isSettling = settlingHutangKey === rowKey;
                        const debtAmount = getTransactionHutangAmount(tx);
                        const rawType = (tx.type || '').toLowerCase();
                        const rawNotes = tx.notes || '';
                        const isTarikTunai = rawType.includes('tarik') || rawType.includes('cashout');
                        const isEwallet =
                          !isTarikTunai &&
                          (rawType.includes('ewallet') ||
                            rawType.includes('topup') ||
                            rawType.includes('dana') ||
                            rawType.includes('gopay') ||
                            rawType.includes('ovo') ||
                            rawType.includes('shopee') ||
                            rawType.includes('wallet'));
                        const isPpob =
                          !isTarikTunai &&
                          !isEwallet &&
                          (rawType.includes('ppob') ||
                            rawType.includes('pulsa') ||
                            rawType.includes('pln') ||
                            rawType.includes('bpjs') ||
                            rawType.includes('pdam') ||
                            rawType.includes('tagihan'));

                        const categoryLabel = isTarikTunai
                          ? 'Tarik Tunai'
                          : isEwallet
                          ? 'Top Up E-Wallet'
                          : isPpob
                          ? 'PPOB dan Lainnya'
                          : 'Transfer Bank';

                        const adminStoreFeeNum = Number(tx.adminStoreFee || 0);
                        const adminBankCostNum = Number(tx.adminBankCost || 0);
                        const profitNum =
                          tx.profit != null && !Number.isNaN(Number(tx.profit))
                            ? Number(tx.profit)
                            : adminStoreFeeNum - adminBankCostNum;

                        const customerNameStr = (tx.customerName || '').trim();
                        const hasCustomerName =
                          Boolean(customerNameStr) &&
                          customerNameStr.toLowerCase() !== 'pelanggan agen' &&
                          !customerNameStr.toLowerCase().includes('mutasi internal');

                        const resolvedOperator =
                          tx.operatorName ||
                          (rawNotes.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
                          undefined;

                        const dateText = tx.createdAt
                          ? new Date(tx.createdAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-';

                        return (
                          <div
                            key={rowKey}
                            className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors"
                          >
                            {/* Top Row: No. Reff + Sumber Dana */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-extrabold text-slate-900 truncate">
                                {tx.referenceNumber}
                              </span>
                              {tx.fundSource ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono shrink-0">
                                  {tx.fundSource}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                                  {categoryLabel}
                                </span>
                              )}
                            </div>

                            {/* Provider • Category + Badge HUTANG */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="font-bold text-slate-800">{tx.provider}</span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="text-slate-600 font-medium">{categoryLabel}</span>
                              <span className="text-[9.5px] font-bold text-rose-700 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 leading-none">
                                HUTANG
                              </span>
                            </div>

                            {/* Rincian Ringkas (Sama Seperti Card Mobile Riwayat Transaksi) */}
                            <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">Tujuan:</span>
                                <span className="font-mono font-bold text-slate-800 truncate">
                                  {tx.targetAccount || '-'}
                                </span>
                              </div>
                              {hasCustomerName && (
                                <div className="flex justify-between gap-2">
                                  <span className="text-slate-500">Pelanggan:</span>
                                  <span className="font-medium text-slate-700 truncate">
                                    {customerNameStr}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">Operator:</span>
                                <span className="font-semibold text-slate-700 truncate">
                                  {resolvedOperator || '-'}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">Nominal:</span>
                                <span className="font-semibold text-slate-800 tabular-nums">
                                  {formatRupiah(tx.nominal)}
                                </span>
                              </div>
                              {adminStoreFeeNum > 0 && (
                                <div className="flex justify-between gap-2 text-[11px] text-slate-500">
                                  <span>Admin Jasa Toko:</span>
                                  <span className="tabular-nums">{formatRupiah(adminStoreFeeNum)}</span>
                                </div>
                              )}
                              <div className="flex justify-between gap-2 pt-1 border-t border-slate-200">
                                <span className="text-slate-700 font-bold">Total Bayar:</span>
                                <span className="font-extrabold text-rose-700 tabular-nums">
                                  {formatRupiah(debtAmount)}
                                </span>
                              </div>
                              <div
                                className={`flex justify-between gap-2 font-bold ${
                                  profitNum < 0 ? 'text-rose-600' : 'text-emerald-700'
                                }`}
                              >
                                <span>Margin Fee:</span>
                                <span className="tabular-nums">{formatSignedRupiah(profitNum)}</span>
                              </div>
                              {adminBankCostNum > 0 && (
                                <div className="flex justify-between gap-2 text-rose-600 text-[11px]">
                                  <span>Modal Bank:</span>
                                  <span className="tabular-nums">{formatRupiah(adminBankCostNum)}</span>
                                </div>
                              )}
                            </div>

                            {/* Footer Card: Timestamp + Tombol Detail & Bayar */}
                            <div className="flex items-center justify-between pt-1 gap-2">
                              <span className="text-[10px] text-slate-400">{dateText}</span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setHutangDetailTarget(tx)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors duration-150 select-none"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Detail</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={Boolean(settlingHutangKey)}
                                  onClick={() => openHutangConfirmModal(tx)}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors duration-150 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed select-none"
                                >
                                  {isSettling ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      <span>Memproses...</span>
                                    </>
                                  ) : (
                                    <span>Bayar</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-3.5 sm:px-4 py-2.5 border-t border-slate-100 bg-white flex justify-end items-center">
                <button
                  type="button"
                  disabled={Boolean(settlingHutangKey)}
                  onClick={() => setHutangModalOpen(false)}
                  className="py-1.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* MODAL DETAIL RINCIAN TRANSAKSI HUTANG                    */}
      {/* ======================================================== */}
      {hutangDetailTarget &&
        typeof document !== 'undefined' &&
        (() => {
          const detailTx = hutangDetailTarget;
          const detailDebtAmount = getTransactionHutangAmount(detailTx);
          const detailBadge = getServiceBadge(detailTx.type, detailTx.notes, detailTx.provider);
          const detailAdminStore = Number(detailTx.adminStoreFee || 0);
          const detailAdminBank = Number(detailTx.adminBankCost || 0);
          const detailProfit =
            detailTx.profit != null && !Number.isNaN(Number(detailTx.profit))
              ? Number(detailTx.profit)
              : detailAdminStore - detailAdminBank;
          const detailOperator =
            detailTx.operatorName ||
            (detailTx.notes?.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
            '-';
          const detailDate = detailTx.createdAt
            ? new Date(detailTx.createdAt).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-';

          return createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setHutangDetailTarget(null);
                }
              }}
              onTouchMove={handleBackdropTouchMove}
              onWheel={handleBackdropWheel}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150"
              style={{ overscrollBehavior: 'contain' }}
            >
              <div
                className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
                style={{ overscrollBehavior: 'contain' }}
                onWheel={handleModalCardScroll}
                onTouchMove={handleModalCardScroll}
              >
                {/* Header Modal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        Rincian Transaksi Hutang
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {detailTx.referenceNumber || '-'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHutangDetailTarget(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
                    aria-label="Tutup Rincian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Metadata Informasi */}
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Waktu Transaksi:</span>
                      <span className="font-semibold text-slate-800 text-right">{detailDate}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Kategori:</span>
                      <span className="font-bold text-indigo-700 text-right">{detailBadge.label}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Layanan & Provider:</span>
                      <span className="font-bold text-slate-900 text-right">
                        {detailTx.provider} &bull; {(detailTx.type || '').replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 items-center">
                      <span className="text-slate-500">Nomor Rekening / Tujuan:</span>
                      <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {detailTx.targetAccount || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Nama Pelanggan:</span>
                      <span className="font-semibold text-slate-800 text-right">
                        {detailTx.customerName || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Operator:</span>
                      <span className="font-semibold text-slate-800 text-right">{detailOperator}</span>
                    </div>
                    {detailTx.fundSource && (
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-slate-500">Sumber Dana:</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          {detailTx.fundSource}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Status Pembayaran:</span>
                      <span className="font-bold px-2 py-0.5 rounded border text-[10.5px] text-rose-700 bg-rose-50 border-rose-200">
                        Hutang (Belum Lunas)
                      </span>
                    </div>
                    {detailTx.notes && (
                      <div className="pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                        <span className="font-semibold text-slate-700 block mb-0.5">Catatan / Reff:</span>
                        <span className="break-words">{detailTx.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Kalkulasi Keuangan Transaksi */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Kalkulasi Keuangan Transaksi</span>
                    </h4>

                    <div className="space-y-1.5 pt-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Nominal Transaksi (Penyaluran):</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatRupiah(detailTx.nominal)}
                        </span>
                      </div>

                      <div className="flex justify-between text-slate-600">
                        <span>Biaya Admin Jasa Toko (ke Konsumen):</span>
                        <span className="font-semibold text-slate-800 tabular-nums">
                          +{formatRupiah(detailAdminStore)}
                        </span>
                      </div>

                      {detailAdminBank > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Beban Admin Bank / Sistem:</span>
                          <span className="tabular-nums">-{formatRupiah(detailAdminBank)}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold">
                        <span className="text-slate-800">Total Tagihan Hutang Pelanggan:</span>
                        <span className="text-base text-rose-700 font-mono tabular-nums">
                          {formatRupiah(detailDebtAmount)}
                        </span>
                      </div>

                      <div
                        className={`p-2 rounded-lg border flex justify-between items-center font-bold ${
                          detailProfit < 0
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                        }`}
                      >
                        <span>Keuntungan Bersih Toko (Margin Fee):</span>
                        <span className="text-sm tabular-nums">{formatSignedRupiah(detailProfit)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setHutangDetailTarget(null)}
                    className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Tutup
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(settlingHutangKey)}
                    onClick={() => {
                      setHutangDetailTarget(null);
                      openHutangConfirmModal(detailTx);
                    }}
                    className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Bayar Hutang</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}

      {/* ======================================================== */}
      {/* POP-UP KONFIRMASI BAYAR HUTANG (RINGKAS / NO SCROLL)     */}
      {/* ======================================================== */}
      {hutangConfirmTarget &&
        typeof document !== 'undefined' &&
        (() => {
          const confirmTx = hutangConfirmTarget;
          const confirmKey = String(confirmTx.referenceNumber || confirmTx.id);
          const isConfirmSettling = settlingHutangKey === confirmKey;
          const confirmDebtAmount = getTransactionHutangAmount(confirmTx);
          const confirmServiceBadge = getServiceBadge(
            confirmTx.type,
            confirmTx.notes,
            confirmTx.provider
          );
          const receiverOptions: { key: HutangReceiverAccountKey; label: string }[] = [
            { key: 'cash', label: 'Cash' },
            { key: 'brimo1', label: 'Brimo 1' },
            { key: 'brimo2', label: 'Brimo 2' },
            { key: 'dana1', label: 'Dana 1' },
            { key: 'dana2', label: 'Dana 2' },
            { key: 'seabank', label: 'Seabank' },
          ];
          const selectedReceiverLabel =
            receiverOptions.find((opt) => opt.key === hutangReceiverAccount)?.label || 'Cash';
          const currentReceiverBalance = Number(balances[hutangReceiverAccount] || 0);
          const projectedReceiverBalance = currentReceiverBalance + confirmDebtAmount;
          const currentHutangBalance = Number(balances.hutang || 0);
          const projectedHutangBalance = Math.max(0, currentHutangBalance - confirmDebtAmount);

          return createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget && !settlingHutangKey) {
                  setHutangConfirmTarget(null);
                }
              }}
              onTouchMove={handleBackdropTouchMove}
              onWheel={handleBackdropWheel}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 backdrop-blur-md p-2.5 sm:p-3 overflow-hidden animate-in fade-in duration-150"
              style={{ overscrollBehavior: 'none' }}
            >
              <div
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
                onTouchMove={handleModalCardScroll}
                onWheel={handleModalCardScroll}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-white shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                        Konfirmasi Bayar Hutang
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight truncate">
                        Periksa rincian transaksi sebelum pelunasan diproses
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(settlingHutangKey)}
                    onClick={() => setHutangConfirmTarget(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0 disabled:opacity-40"
                    aria-label="Tutup Konfirmasi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="p-3 sm:p-3.5 space-y-2.5 overflow-y-auto flex-1 min-h-0">
                  {/* Informasi Transaksi */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-800">
                        Informasi Transaksi
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 leading-none">
                          {confirmServiceBadge.label}
                        </span>
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 leading-none">
                          HUTANG
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-[9.5px] text-slate-500 block leading-tight">
                          No. Referensi
                        </span>
                        <span className="font-mono font-bold text-slate-900 truncate block leading-snug">
                          {confirmTx.referenceNumber || '-'}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="text-[9.5px] text-slate-500 block leading-tight">
                          Nama Pelanggan
                        </span>
                        <span className="font-bold text-slate-900 truncate block leading-snug">
                          {confirmTx.customerName || 'Pelanggan'}
                        </span>
                      </div>

                      <div className="min-w-0 col-span-2">
                        <span className="text-[9.5px] text-slate-500 block leading-tight">
                          Layanan / Tujuan
                        </span>
                        <span className="font-bold text-slate-900 truncate block leading-snug">
                          {confirmTx.provider} &bull;{' '}
                          <span className="font-mono">{confirmTx.targetAccount || '-'}</span>
                        </span>
                      </div>
                    </div>

                    {/* Nominal Total Bayar */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-slate-600 block leading-tight">
                          Nominal Total Bayar
                        </span>
                        {Number(confirmTx.adminStoreFee || 0) > 0 && (
                          <span className="text-[9.5px] text-slate-400 block leading-tight">
                            Nominal {formatRupiah(confirmTx.nominal)} + Admin{' '}
                            {formatRupiah(confirmTx.adminStoreFee)}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-extrabold text-base sm:text-lg text-rose-700 shrink-0">
                        {formatRupiah(confirmDebtAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Dropdown Rekening Penerima Hutang */}
                  <div className="space-y-1">
                    <label
                      htmlFor="hutang-receiver-account-select"
                      className="text-[11px] font-bold text-slate-700 block"
                    >
                      Rekening Penerima Hutang
                    </label>
                    <select
                      id="hutang-receiver-account-select"
                      value={hutangReceiverAccount}
                      disabled={Boolean(settlingHutangKey)}
                      onChange={(e) =>
                        setHutangReceiverAccount(e.target.value as HutangReceiverAccountKey)
                      }
                      className="w-full text-xs py-2 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none cursor-pointer disabled:opacity-50"
                    >
                      {receiverOptions.map((opt) => (
                        <option key={opt.key} value={opt.key}>
                          {opt.label} - Saldo: {formatRupiah(balances[opt.key] || 0)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Simulasi Perubahan Saldo */}
                  <div className="p-2.5 rounded-xl bg-slate-900 text-white space-y-1.5 text-[10.5px]">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400">
                      <span>Simulasi Pelunasan Hutang</span>
                      <span className="text-emerald-400 font-bold">
                        Hutang ➔ {selectedReceiverLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="bg-slate-800/85 p-2 rounded-lg space-y-0.5 min-w-0">
                        <span className="text-[9px] text-emerald-300 font-bold block truncate">
                          SALDO {selectedReceiverLabel.toUpperCase()}
                        </span>
                        <div className="text-[9.5px] text-slate-400 font-mono truncate">
                          Awal: {formatRupiah(currentReceiverBalance)}
                        </div>
                        <div className="font-mono text-[11px] font-bold text-emerald-400 truncate">
                          + {formatRupiah(confirmDebtAmount)}
                        </div>
                        <div className="text-[10px] font-mono font-extrabold text-white pt-0.5 border-t border-slate-700/80 truncate">
                          Akhir: {formatRupiah(projectedReceiverBalance)}
                        </div>
                      </div>

                      <div className="bg-slate-800/85 p-2 rounded-lg space-y-0.5 min-w-0">
                        <span className="text-[9px] text-rose-300 font-bold block truncate">
                          SALDO CARD HUTANG
                        </span>
                        <div className="text-[9.5px] text-slate-400 font-mono truncate">
                          Awal: {formatRupiah(currentHutangBalance)}
                        </div>
                        <div className="font-mono text-[11px] font-bold text-rose-400 truncate">
                          - {formatRupiah(confirmDebtAmount)}
                        </div>
                        <div className="text-[10px] font-mono font-extrabold text-amber-300 pt-0.5 border-t border-slate-700/80 truncate">
                          Sisa: {formatRupiah(projectedHutangBalance)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Keterangan Tujuan Dana Dinamis */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/85 border border-emerald-200/90 flex items-start gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-900 leading-snug font-medium">
                      Dana pelunasan sebesar{' '}
                      <strong className="font-mono font-extrabold">
                        {formatRupiah(confirmDebtAmount)}
                      </strong>{' '}
                      akan otomatis masuk ke saldo <strong>{selectedReceiverLabel}</strong> dan
                      mengurangi saldo <strong>Card Hutang</strong>.
                    </p>
                  </div>
                </div>

                {/* Footer Tombol Aksi */}
                <div className="px-3.5 py-2.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={Boolean(settlingHutangKey)}
                    onClick={() => setHutangConfirmTarget(null)}
                    className="py-1.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(settlingHutangKey)}
                    onClick={() => handleBayarHutang(confirmTx, hutangReceiverAccount)}
                    className="py-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConfirmSettling ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Konfirmasi Bayar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}

      {/* ======================================================== */}
      {/* MODAL DAFTAR TRANSAKSI TAGIHAN & MENU TAMBAH TAGIHAN     */}
      {/* ======================================================== */}
      {tagihanListModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (
                e.target === e.currentTarget &&
                !settlingTagihanKey &&
                !tagihanConfirmTarget &&
                !tagihanDetailTarget &&
                !tagihanModalOpen
              ) {
                setTagihanListModalOpen(false);
              }
            }}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/50 backdrop-blur-md p-2 sm:p-3 overflow-y-auto"
            style={{ overscrollBehavior: 'contain' }}
            onTouchMove={handleBackdropTouchMove}
            onWheel={handleBackdropWheel}
          >
            <div
              className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-6xl w-full h-auto max-h-[92vh] sm:max-h-[90vh] border border-slate-200 flex flex-col my-auto overflow-hidden animate-in zoom-in-95 duration-150"
              onTouchMove={handleModalCardScroll}
              onWheel={handleModalCardScroll}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 shrink-0 bg-white">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-600 flex items-center justify-center shrink-0">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                      Daftar Transaksi Tagihan
                    </h3>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight truncate">
                      Klik &ldquo;Bayar&rdquo; untuk melunasi tagihan &amp; memasukkan dana ke Card Cash
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={Boolean(settlingTagihanKey)}
                    onClick={handleOpenTagihanModal}
                    className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-[11px] sm:text-xs shadow-xs transition cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" />
                    <span>Tambah Tagihan</span>
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(settlingTagihanKey)}
                    onClick={() => setTagihanListModalOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0 disabled:opacity-40"
                    aria-label="Tutup Daftar Tagihan"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div
                className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3"
                style={{ overscrollBehavior: 'contain' }}
              >
                {/* Kontainer Pertama: Total Akumulasi Tagihan */}
                <div className="p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-amber-50/90 to-orange-50/60 border border-amber-200/80 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[10px] font-semibold text-amber-900 block leading-tight">
                      Total Akumulasi Tagihan
                    </span>
                    <span className="font-extrabold text-base sm:text-lg text-amber-950 font-mono tracking-tight tabular-nums">
                      {formatRupiah(balances.tagihan || 0)}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-800 bg-white/90 border border-amber-200 px-2 py-1 rounded-md inline-block shrink-0">
                    {tagihanTransactions.length} Tagihan
                  </span>
                </div>

                {/* Daftar Transaksi Tagihan: Tampilan Responsif Persis Pop-up Hutang & Riwayat Transaksi */}
                {tagihanTransactions.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 space-y-2">
                    <Receipt className="w-7 h-7 text-amber-500 mx-auto" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-700">
                        Belum ada daftar tagihan aktif
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Klik tombol &ldquo;Tambah Tagihan&rdquo; untuk mencatat tagihan baru dari sumber dana.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    {/* Desktop & Tablet Table View (>= 768px) */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[1060px] table-fixed text-left text-xs divide-y divide-slate-100">
                        <colgroup>
                          <col className="w-[155px]" />
                          <col className="w-auto" />
                          <col className="w-[175px]" />
                          <col className="w-[125px]" />
                          <col className="w-[120px]" />
                          <col className="w-[115px]" />
                          <col className="w-[110px]" />
                          <col className="w-[130px]" />
                        </colgroup>
                        <thead className="bg-slate-50/90 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200/80 select-none">
                          <tr>
                            <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                              No. Reff &amp; Waktu
                            </th>
                            <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                              Layanan &amp; Sumber Dana
                            </th>
                            <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                              Tujuan &amp; Peruntukan
                            </th>
                            <th scope="col" className="px-3.5 py-3 text-right whitespace-nowrap">
                              Nominal Tagihan
                            </th>
                            <th scope="col" className="px-3.5 py-3 text-right whitespace-nowrap">
                              Total Bayar
                            </th>
                            <th scope="col" className="px-3.5 py-3 text-right whitespace-nowrap">
                              Biaya / Margin
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
                          {tagihanTransactions.map((tx) => {
                            const rowKey = String(tx.referenceNumber || tx.id);
                            const isSettling = settlingTagihanKey === rowKey;
                            const billAmount = Math.max(0, Number(tx.nominal) || 0);
                            const rawNotes = tx.notes || '';
                            const adminBankCostNum = Number(tx.adminBankCost || 0);
                            const profitNum =
                              tx.profit != null && !Number.isNaN(Number(tx.profit))
                                ? Number(tx.profit)
                                : -adminBankCostNum;

                            const peruntukanStr = (tx.customerName || '').trim() || 'Tagihan';
                            const resolvedOperator =
                              tx.operatorName ||
                              (rawNotes.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
                              undefined;

                            const dateText = tx.createdAt
                              ? new Date(tx.createdAt).toLocaleString('id-ID', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : '-';

                            return (
                              <tr
                                key={rowKey}
                                className="hover:bg-slate-50/80 transition-colors group"
                              >
                                {/* 1. No. Reff & Waktu */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle">
                                  <div
                                    className="font-mono text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate"
                                    title={tx.referenceNumber}
                                  >
                                    {tx.referenceNumber}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                    <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate">{dateText}</span>
                                  </div>
                                </td>

                                {/* 2. Layanan & Sumber Dana */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                      <Receipt className="w-2.5 h-2.5" />
                                      Tagihan
                                    </span>

                                    <span
                                      className="text-[9.5px] font-bold text-slate-600 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 max-w-full truncate"
                                      title={tx.provider}
                                    >
                                      {tx.provider}
                                    </span>
                                    {tx.fundSource && (
                                      <span
                                        className="text-[9.5px] font-bold text-indigo-700 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 font-mono max-w-full truncate"
                                        title={tx.fundSource}
                                      >
                                        {tx.fundSource}
                                      </span>
                                    )}
                                    <span className="text-[9.5px] font-bold text-amber-700 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 shrink-0">
                                      TAGIHAN
                                    </span>
                                  </div>
                                </td>

                                {/* 3. Tujuan & Peruntukan */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle">
                                  <div
                                    className="font-mono text-xs font-bold text-slate-900 truncate"
                                    title={tx.targetAccount}
                                  >
                                    {tx.targetAccount || 'Card Tagihan'}
                                  </div>
                                  <div
                                    className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"
                                    title={peruntukanStr}
                                  >
                                    <FileText className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    <span className="truncate">{peruntukanStr}</span>
                                  </div>
                                </td>

                                {/* 4. Nominal Tagihan */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                                  <div className="font-semibold text-slate-800 truncate">
                                    {formatRupiah(billAmount)}
                                  </div>
                                  {adminBankCostNum > 0 && (
                                    <div className="text-[10px] text-rose-500 truncate">
                                      Biaya: {formatRupiah(adminBankCostNum)}
                                    </div>
                                  )}
                                </td>

                                {/* 5. Total Bayar */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                                  <div className="font-extrabold text-amber-800 truncate">
                                    {formatRupiah(billAmount)}
                                  </div>
                                </td>

                                {/* 6. Biaya / Margin */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap tabular-nums">
                                  {profitNum === 0 ? (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  ) : (
                                    <span
                                      className={`font-bold px-1.5 py-0.5 rounded border max-w-full truncate inline-block ${
                                        profitNum < 0
                                          ? 'text-rose-700 bg-rose-50 border-rose-200'
                                          : 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                      }`}
                                    >
                                      {formatSignedRupiah(profitNum)}
                                    </span>
                                  )}
                                </td>

                                {/* 7. Operator */}
                                <td className="px-3.5 py-3 overflow-hidden align-middle whitespace-nowrap">
                                  {resolvedOperator ? (
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 max-w-full"
                                      title={resolvedOperator}
                                    >
                                      <User className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate">{resolvedOperator}</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">-</span>
                                  )}
                                </td>

                                {/* 8. Aksi (Detail + Bayar) */}
                                <td className="px-3.5 py-3 text-right overflow-hidden align-middle whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setTagihanDetailTarget(tx)}
                                      title="Lihat Rincian Lengkap"
                                      className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-200/80 border border-slate-200 transition-colors duration-150 cursor-pointer shadow-2xs"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(settlingTagihanKey)}
                                      onClick={() => setTagihanConfirmTarget(tx)}
                                      className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-[11px] shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isSettling ? (
                                        <>
                                          <RefreshCw className="w-3 h-3 animate-spin" />
                                          <span>...</span>
                                        </>
                                      ) : (
                                        <span>Bayar</span>
                                      )}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View (< 768px) — Sama Seperti Pop-up Hutang & Riwayat Transaksi */}
                    <div className="block md:hidden divide-y divide-slate-100">
                      {tagihanTransactions.map((tx) => {
                        const rowKey = String(tx.referenceNumber || tx.id);
                        const isSettling = settlingTagihanKey === rowKey;
                        const billAmount = Math.max(0, Number(tx.nominal) || 0);
                        const rawNotes = tx.notes || '';
                        const adminBankCostNum = Number(tx.adminBankCost || 0);
                        const profitNum =
                          tx.profit != null && !Number.isNaN(Number(tx.profit))
                            ? Number(tx.profit)
                            : -adminBankCostNum;

                        const peruntukanStr = (tx.customerName || '').trim() || 'Tagihan';
                        const resolvedOperator =
                          tx.operatorName ||
                          (rawNotes.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
                          undefined;

                        const dateText = tx.createdAt
                          ? new Date(tx.createdAt).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-';

                        return (
                          <div
                            key={rowKey}
                            className="p-3.5 space-y-2.5 hover:bg-slate-50/60 transition-colors"
                          >
                            {/* Top Row: No. Reff + Sumber Dana */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-extrabold text-slate-900 truncate">
                                {tx.referenceNumber}
                              </span>
                              {tx.fundSource ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono shrink-0">
                                  {tx.fundSource}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                  Tagihan
                                </span>
                              )}
                            </div>

                            {/* Provider • Tagihan + Badge TAGIHAN */}
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="font-bold text-slate-800">{tx.provider}</span>
                              <span className="text-slate-400">&bull;</span>
                              <span className="text-slate-600 font-medium">Tagihan</span>
                              <span className="text-[9.5px] font-bold text-amber-800 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 leading-none">
                                TAGIHAN
                              </span>
                            </div>

                            {/* Rincian Ringkas (Sama Seperti Card Mobile Riwayat Transaksi & Hutang) */}
                            <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">Tujuan:</span>
                                <span className="font-mono font-bold text-slate-800 truncate">
                                  {tx.targetAccount || 'Card Tagihan'}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">Peruntukan:</span>
                                <span className="font-semibold text-slate-800 truncate">
                                  {peruntukanStr}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">Operator:</span>
                                <span className="font-semibold text-slate-700 truncate">
                                  {resolvedOperator || '-'}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2">
                                <span className="text-slate-500">Nominal:</span>
                                <span className="font-semibold text-slate-800 tabular-nums">
                                  {formatRupiah(billAmount)}
                                </span>
                              </div>
                              <div className="flex justify-between gap-2 pt-1 border-t border-slate-200">
                                <span className="text-slate-700 font-bold">Total Bayar:</span>
                                <span className="font-extrabold text-amber-800 tabular-nums">
                                  {formatRupiah(billAmount)}
                                </span>
                              </div>
                              {adminBankCostNum > 0 && (
                                <div className="flex justify-between gap-2 text-rose-600 text-[11px]">
                                  <span>Biaya Bank &amp; Admin:</span>
                                  <span className="tabular-nums">{formatRupiah(adminBankCostNum)}</span>
                                </div>
                              )}
                            </div>

                            {/* Footer Card: Timestamp + Tombol Detail & Bayar */}
                            <div className="flex items-center justify-between pt-1 gap-2">
                              <span className="text-[10px] text-slate-400">{dateText}</span>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setTagihanDetailTarget(tx)}
                                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors duration-150 select-none"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Detail</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={Boolean(settlingTagihanKey)}
                                  onClick={() => setTagihanConfirmTarget(tx)}
                                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors duration-150 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed select-none"
                                >
                                  {isSettling ? (
                                    <>
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      <span>Memproses...</span>
                                    </>
                                  ) : (
                                    <span>Bayar</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="shrink-0 px-3.5 sm:px-4 py-2.5 border-t border-slate-100 bg-white flex justify-end items-center">
                <button
                  type="button"
                  disabled={Boolean(settlingTagihanKey)}
                  onClick={() => setTagihanListModalOpen(false)}
                  className="py-1.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ======================================================== */}
      {/* MODAL DETAIL RINCIAN TRANSAKSI TAGIHAN                   */}
      {/* ======================================================== */}
      {tagihanDetailTarget &&
        typeof document !== 'undefined' &&
        (() => {
          const detailTx = tagihanDetailTarget;
          const detailBillAmount = Math.max(0, Number(detailTx.nominal) || 0);
          const detailAdminBank = Number(detailTx.adminBankCost || 0);
          const detailProfit =
            detailTx.profit != null && !Number.isNaN(Number(detailTx.profit))
              ? Number(detailTx.profit)
              : -detailAdminBank;
          const detailOperator =
            detailTx.operatorName ||
            (detailTx.notes?.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim()) ||
            '-';
          const detailDate = detailTx.createdAt
            ? new Date(detailTx.createdAt).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '-';

          return createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setTagihanDetailTarget(null);
                }
              }}
              onTouchMove={handleBackdropTouchMove}
              onWheel={handleBackdropWheel}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150"
              style={{ overscrollBehavior: 'contain' }}
            >
              <div
                className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
                style={{ overscrollBehavior: 'contain' }}
                onWheel={handleModalCardScroll}
                onTouchMove={handleModalCardScroll}
              >
                {/* Header Modal */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        Rincian Transaksi Tagihan
                      </h3>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {detailTx.referenceNumber || '-'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTagihanDetailTarget(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0"
                    aria-label="Tutup Rincian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Metadata Informasi */}
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Waktu Dicatat:</span>
                      <span className="font-semibold text-slate-800 text-right">{detailDate}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Kategori:</span>
                      <span className="font-bold text-amber-800 text-right">Card Tagihan</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Alur Mutasi:</span>
                      <span className="font-bold text-slate-900 text-right">{detailTx.provider}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Peruntukan / Keterangan:</span>
                      <span className="font-semibold text-slate-900 text-right">
                        {detailTx.customerName || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Operator:</span>
                      <span className="font-semibold text-slate-800 text-right">{detailOperator}</span>
                    </div>
                    {detailTx.fundSource && (
                      <div className="flex justify-between gap-2 items-center">
                        <span className="text-slate-500">Sumber Dana Asal:</span>
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                          {detailTx.fundSource}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Status Tagihan:</span>
                      <span className="font-bold px-2 py-0.5 rounded border text-[10.5px] text-amber-800 bg-amber-50 border-amber-200">
                        Tagihan (Belum Lunas)
                      </span>
                    </div>
                    {detailTx.notes && (
                      <div className="pt-2 border-t border-slate-200 text-slate-600 text-[11px]">
                        <span className="font-semibold text-slate-700 block mb-0.5">Catatan / Reff:</span>
                        <span className="break-words">{detailTx.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Kalkulasi Keuangan Tagihan */}
                  <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                      <span>Kalkulasi Tagihan</span>
                    </h4>

                    <div className="space-y-1.5 pt-1 text-xs">
                      <div className="flex justify-between text-slate-600">
                        <span>Nominal Tagihan:</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatRupiah(detailBillAmount)}
                        </span>
                      </div>

                      {detailAdminBank > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Biaya Modal Bank &amp; Admin:</span>
                          <span className="tabular-nums">-{formatRupiah(detailAdminBank)}</span>
                        </div>
                      )}

                      <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline font-bold">
                        <span className="text-slate-800">Total Tagihan Dilunasi ke Cash:</span>
                        <span className="text-base text-amber-800 font-mono tabular-nums">
                          {formatRupiah(detailBillAmount)}
                        </span>
                      </div>

                      {detailProfit !== 0 && (
                        <div
                          className={`p-2 rounded-lg border flex justify-between items-center font-bold ${
                            detailProfit < 0
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-emerald-50 border-emerald-100 text-emerald-800'
                          }`}
                        >
                          <span>Dampak Biaya Mutasi:</span>
                          <span className="text-sm tabular-nums">{formatSignedRupiah(detailProfit)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setTagihanDetailTarget(null)}
                    className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Tutup
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(settlingTagihanKey)}
                    onClick={() => {
                      setTagihanDetailTarget(null);
                      setTagihanConfirmTarget(detailTx);
                    }}
                    className="px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Bayar Tagihan</span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}

      {/* ======================================================== */}
      {/* POP-UP KONFIRMASI BAYAR TAGIHAN (RINGKAS / NO SCROLL)    */}
      {/* ======================================================== */}
      {tagihanConfirmTarget &&
        typeof document !== 'undefined' &&
        (() => {
          const confirmTx = tagihanConfirmTarget;
          const confirmKey = String(confirmTx.referenceNumber || confirmTx.id);
          const isConfirmSettling = settlingTagihanKey === confirmKey;
          const confirmBillAmount = Math.max(0, Number(confirmTx.nominal) || 0);

          return createPortal(
            <div
              role="dialog"
              aria-modal="true"
              onClick={(e) => {
                if (e.target === e.currentTarget && !settlingTagihanKey) {
                  setTagihanConfirmTarget(null);
                }
              }}
              onTouchMove={handleBackdropTouchMove}
              onWheel={handleBackdropWheel}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/55 backdrop-blur-md p-2.5 sm:p-3 overflow-hidden animate-in fade-in duration-150"
              style={{ overscrollBehavior: 'none' }}
            >
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-white">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                        Konfirmasi Bayar Tagihan
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium leading-tight truncate">
                        Periksa rincian tagihan sebelum pelunasan diproses
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(settlingTagihanKey)}
                    onClick={() => setTagihanConfirmTarget(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer shrink-0 disabled:opacity-40"
                    aria-label="Tutup Konfirmasi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Body (Ringkas & Tanpa Scroll) */}
                <div className="p-3 sm:p-3.5 space-y-2.5 overflow-hidden">
                  {/* Informasi Tagihan */}
                  <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200/70">
                      <span className="text-[11px] font-bold text-slate-800">
                        Informasi Tagihan
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 leading-none">
                          TAGIHAN
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <div className="min-w-0">
                        <span className="text-[9.5px] text-slate-500 block leading-tight">
                          No. Referensi
                        </span>
                        <span className="font-mono font-bold text-slate-900 truncate block leading-snug">
                          {confirmTx.referenceNumber || '-'}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="text-[9.5px] text-slate-500 block leading-tight">
                          Peruntukan / Keterangan
                        </span>
                        <span className="font-bold text-slate-900 truncate block leading-snug">
                          {confirmTx.customerName || 'Tagihan'}
                        </span>
                      </div>

                      <div className="min-w-0 col-span-2">
                        <span className="text-[9.5px] text-slate-500 block leading-tight">
                          Sumber Dana &amp; Tujuan
                        </span>
                        <span className="font-bold text-slate-900 truncate block leading-snug">
                          {confirmTx.provider}
                        </span>
                      </div>
                    </div>

                    {/* Nominal Total Bayar */}
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-slate-600 block leading-tight">
                          Nominal Pelunasan Tagihan
                        </span>
                      </div>
                      <span className="font-mono font-extrabold text-base sm:text-lg text-amber-800 shrink-0 tabular-nums">
                        {formatRupiah(confirmBillAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Keterangan Tujuan Dana */}
                  <div className="p-2.5 rounded-xl bg-emerald-50/85 border border-emerald-200/90 flex items-start gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-900 leading-snug font-medium">
                      Dana pelunasan sebesar{' '}
                      <strong className="font-mono font-extrabold">
                        {formatRupiah(confirmBillAmount)}
                      </strong>{' '}
                      akan otomatis masuk ke saldo <strong>Card Cash</strong> dan mengurangi saldo{' '}
                      <strong>Card Tagihan</strong>.
                    </p>
                  </div>
                </div>

                {/* Footer Tombol Aksi */}
                <div className="px-3.5 py-2.5 border-t border-slate-100 bg-white flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={Boolean(settlingTagihanKey)}
                    onClick={() => setTagihanConfirmTarget(null)}
                    className="py-1.5 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(settlingTagihanKey)}
                    onClick={() => handleBayarTagihan(confirmTx)}
                    className="py-1.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isConfirmSettling ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Konfirmasi Bayar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          );
        })()}
    </div>
  );
};
