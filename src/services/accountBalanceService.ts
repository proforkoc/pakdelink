// Service manajemen saldo akun dan sumber dana agen terpadu
import {
  saveAccountBalancesToCloud,
  saveMarginFeeLedgerToCloud,
} from './cloudDigitalFinanceService.ts';

export type InternalFundKey = 'cash' | 'brimo1' | 'brimo2' | 'dana1' | 'dana2' | 'seabank' | 'tagihan';
export type HutangReceiverAccountKey = 'cash' | 'brimo1' | 'brimo2' | 'dana1' | 'dana2' | 'seabank';
export type FundSourceKey = InternalFundKey | 'atm_pelanggan';

export interface AccountBalances {
  cash: number;
  brimo1: number;
  brimo2: number;
  dana1: number;
  dana2: number;
  seabank: number;
  tagihan?: number;
  hutang?: number;
  [key: string]: number | undefined;
}

export interface FundSourceMeta {
  key: FundSourceKey;
  label: string;
  provider: string;
  color: string;
  badgeBg: string;
  iconName: string;
}

export const FUND_SOURCES_CONFIG: FundSourceMeta[] = [
  {
    key: 'cash',
    label: 'Cash',
    provider: 'Uang Fisik Kasir',
    color: 'emerald',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    iconName: 'Banknote',
  },
  {
    key: 'brimo1',
    label: 'Brimo 1',
    provider: 'Bank BRI Rek. 1',
    color: 'blue',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    iconName: 'CreditCard',
  },
  {
    key: 'brimo2',
    label: 'Brimo 2',
    provider: 'Bank BRI Rek. 2',
    color: 'sky',
    badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
    iconName: 'CreditCard',
  },
  {
    key: 'dana1',
    label: 'Dana 1',
    provider: 'Akun DANA Utama',
    color: 'indigo',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    iconName: 'Wallet',
  },
  {
    key: 'dana2',
    label: 'Dana 2',
    provider: 'Akun DANA Cadangan',
    color: 'purple',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    iconName: 'Wallet',
  },
  {
    key: 'seabank',
    label: 'Seabank',
    provider: 'PT Bank Seabank',
    color: 'orange',
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
    iconName: 'ArrowRightLeft',
  },
  {
    key: 'tagihan',
    label: 'Tagihan',
    provider: 'Card Input Manual',
    color: 'amber',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    iconName: 'Receipt',
  },
];

const STORAGE_KEY_BALANCES = 'konter_digital_account_balances_v1';
const EVENT_BALANCES_UPDATED = 'konter_account_balances_updated';

// Default initial balances (tersimpan aman di localStorage)
export const DEFAULT_BALANCES: AccountBalances = {
  cash: 3500000,
  brimo1: 8500000,
  brimo2: 4000000,
  dana1: 2500000,
  dana2: 1500000,
  seabank: 2000000,
  tagihan: 0,
  hutang: 0,
};

const STORAGE_KEY_TAGIHAN_NOTE = 'konter_digital_tagihan_note_v1';

export function getStoredTagihanNote(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(STORAGE_KEY_TAGIHAN_NOTE) || '';
  } catch {
    return '';
  }
}

export function saveStoredTagihanNote(note: string, syncCloud: boolean = true): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_TAGIHAN_NOTE, note);
    if (syncCloud) {
      saveAccountBalancesToCloud(getStoredAccountBalances(), note).catch(() => {});
    }
  } catch {}
}

/**
 * Mengambil data saldo seluruh akun dari LocalStorage
 */
export function getStoredAccountBalances(): AccountBalances {
  if (typeof window === 'undefined') return { ...DEFAULT_BALANCES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BALANCES);
    if (!raw) {
      // Jangan timpa Cloud Firestore dengan DEFAULT_BALANCES saat browser baru pertama kali dibuka;
      // biarkan subscription Cloud Firestore memuat saldo riil dari database terlebih dahulu.
      return { ...DEFAULT_BALANCES };
    }
    const parsed = JSON.parse(raw);
    return {
      cash: typeof parsed.cash === 'number' ? parsed.cash : DEFAULT_BALANCES.cash,
      brimo1: typeof parsed.brimo1 === 'number' ? parsed.brimo1 : DEFAULT_BALANCES.brimo1,
      brimo2: typeof parsed.brimo2 === 'number' ? parsed.brimo2 : DEFAULT_BALANCES.brimo2,
      dana1: typeof parsed.dana1 === 'number' ? parsed.dana1 : DEFAULT_BALANCES.dana1,
      dana2: typeof parsed.dana2 === 'number' ? parsed.dana2 : DEFAULT_BALANCES.dana2,
      seabank: typeof parsed.seabank === 'number' ? parsed.seabank : DEFAULT_BALANCES.seabank,
      tagihan: typeof parsed.tagihan === 'number' ? parsed.tagihan : (DEFAULT_BALANCES.tagihan ?? 0),
      hutang: typeof parsed.hutang === 'number' ? parsed.hutang : (DEFAULT_BALANCES.hutang ?? 0),
    };
  } catch (err) {
    console.warn('Gagal membaca saldo akun dari localStorage:', err);
    return { ...DEFAULT_BALANCES };
  }
}

/**
 * Menyimpan data saldo ke LocalStorage dan broadcast event reaktif
 */
export function saveStoredAccountBalances(
  balances: AccountBalances,
  syncCloud: boolean = true
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_BALANCES, JSON.stringify(balances));
    notifyBalancesUpdated(balances);
    if (syncCloud) {
      saveAccountBalancesToCloud(balances).catch(() => {});
    }
  } catch (err) {
    console.warn('Gagal menyimpan saldo akun ke localStorage:', err);
  }
}

/**
 * Update saldo akun spesifik secara manual (via tombol modal Update)
 */
export function updateAccountBalance(key: FundSourceKey, newAmount: number): AccountBalances {
  const current = getStoredAccountBalances();
  const updated: AccountBalances = {
    ...current,
    [key]: Math.max(0, Math.round(Number(newAmount) || 0)),
  };
  saveStoredAccountBalances(updated);
  return updated;
}

/**
 * Menambah atau mengurangi saldo Brimo 1 secara langsung (misalnya sinkronisasi Card Titipan)
 */
export function adjustBrimo1Balance(deltaAmount: number): AccountBalances {
  const current = getStoredAccountBalances();
  const delta = Math.round(Number(deltaAmount) || 0);
  const updated: AccountBalances = {
    ...current,
    brimo1: Math.max(0, (Number(current.brimo1) || 0) + delta),
  };
  saveStoredAccountBalances(updated);
  return updated;
}

/**
 * Menambah atau mengurangi saldo Cash secara langsung (misalnya pencairan Tarik Tunai Card Titipan)
 */
export function adjustCashBalance(deltaAmount: number): AccountBalances {
  const current = getStoredAccountBalances();
  const delta = Math.round(Number(deltaAmount) || 0);
  const updated: AccountBalances = {
    ...current,
    cash: Math.max(0, (Number(current.cash) || 0) + delta),
  };
  saveStoredAccountBalances(updated);
  return updated;
}

/**
 * Transfer saldo antar sumber dana (Ambil saldo dari card lain)
 * Mengurangi saldo akun sumber (termasuk biaya transfer bank jika ada) dan menambah saldo akun tujuan secara real-time
 */
export function transferBetweenAccountBalances(params: {
  sourceKey: FundSourceKey;
  targetKey: FundSourceKey;
  transferAmount: number;
  adminBankCost?: number;
  adminTransferFee?: number;
  adminStoreFee?: number;
}): { success: boolean; balances: AccountBalances; message?: string } {
  const {
    sourceKey,
    targetKey,
    transferAmount,
    adminBankCost = 0,
    adminTransferFee = 0,
    adminStoreFee = 0,
  } = params;

  if (sourceKey === targetKey) {
    return {
      success: false,
      balances: getStoredAccountBalances(),
      message: 'Sumber dana asal dan tujuan tidak boleh sama.',
    };
  }

  const current = getStoredAccountBalances();
  const sourceBalance = current[sourceKey] ?? 0;
  const numTransfer = Math.max(0, Math.round(Number(transferAmount) || 0));
  const numBankCost = Math.max(0, Math.round(Number(adminBankCost) || 0));
  // Biaya Admin Transfer ikut dipotong dari sumber dana asal
  const numAdminTransfer = Math.max(0, Math.round(Number(adminTransferFee || adminStoreFee) || 0));
  const totalDeductionFromSource = numTransfer + numBankCost + numAdminTransfer;

  if (numTransfer <= 0) {
    return {
      success: false,
      balances: current,
      message: 'Nominal transfer saldo harus lebih dari Rp 0.',
    };
  }

  if (sourceBalance < totalDeductionFromSource) {
    return {
      success: false,
      balances: current,
      message: `Saldo pada ${getFundSourceLabel(sourceKey)} tidak mencukupi (Tersedia: Rp ${sourceBalance.toLocaleString('id-ID')}, Dibutuhkan: Rp ${totalDeductionFromSource.toLocaleString('id-ID')}).`,
    };
  }

  const updated: AccountBalances = {
    ...current,
    [sourceKey]: Math.max(0, sourceBalance - totalDeductionFromSource),
    [targetKey]: (current[targetKey] ?? 0) + numTransfer,
  };

  saveStoredAccountBalances(updated);
  return { success: true, balances: updated };
}


/**
 * Hitung Total Saldo yang dihitung dari Cash sampai dengan Dana 2:
 * (Cash + Brimo 1 + Brimo 2 + Dana 1 + Dana 2)
 */
export function calculateCashToDana2Total(balances: AccountBalances): number {
  return (
    Number(balances.cash || 0) +
    Number(balances.brimo1 || 0) +
    Number(balances.brimo2 || 0) +
    Number(balances.dana1 || 0) +
    Number(balances.dana2 || 0)
  );
}

/**
 * Hitung Total Keseluruhan Seluruh Saldo Akun (termasuk Seabank dan Card Tagihan Manual):
 */
export function calculateAllBalancesTotal(balances: AccountBalances): number {
  return (
    calculateCashToDana2Total(balances) +
    Number(balances.seabank || 0) +
    Number(balances.tagihan || 0)
  );
}

/**
 * Deteksi apakah transaksi digital berstatus Hutang (belum dibayar ke Card Cash)
 */
export function isHutangTransaction(tx?: {
  paymentMethod?: string;
  status?: string;
} | null): boolean {
  if (!tx) return false;
  const pm = (tx.paymentMethod || '').trim().toLowerCase();
  const st = (tx.status || '').trim().toLowerCase();
  return pm === 'hutang' || st === 'hutang';
}

/**
 * Hitung nominal piutang pelanggan yang masuk ke Card Hutang & akan masuk ke Card Cash saat dilunasi
 */
export function getTransactionHutangAmount(tx?: {
  type?: string;
  fundSource?: string;
  notes?: string;
  nominal?: number;
  adminStoreFee?: number;
  totalCustomerPaid?: number;
} | null): number {
  if (!tx) return 0;
  const t = (tx.type || '').toLowerCase();
  const isTarikTunai = t.includes('tarik') || t.includes('cashout');
  const sourceKey = parseFundSourceKey(tx.fundSource, tx.notes, tx.type);
  const numNominal = Math.max(0, Number(tx.nominal) || 0);
  const numStoreFee = Math.max(0, Number(tx.adminStoreFee) || 0);

  if (isTarikTunai || sourceKey === 'atm_pelanggan') {
    return numStoreFee;
  }

  return Math.max(
    0,
    Number(tx.totalCustomerPaid) || (numNominal + numStoreFee)
  );
}

/**
 * Potong / sesuaikan saldo akun secara otomatis saat transaksi baru berhasil dibuat
 */
export function processTransactionBalanceDeduction(params: {
  fundSourceKey: FundSourceKey;
  provider?: string;
  type: string;
  nominal: number;
  adminBankCost: number;
  adminStoreFee?: number;
  totalCustomerPaid: number;
  paymentMethod: string;
}): AccountBalances {
  const { fundSourceKey, provider, type, nominal, adminBankCost = 0, adminStoreFee = 0, totalCustomerPaid, paymentMethod } = params;
  const current = getStoredAccountBalances();
  const updated = { ...current };

  const isTarikTunai = type.includes('tarik') || type.includes('cashout');
  const pmLower = (paymentMethod || 'cash').trim().toLowerCase();
  const isHutang = pmLower === 'hutang';
  const hutangAmount = getTransactionHutangAmount({
    type,
    fundSource: fundSourceKey,
    nominal,
    adminStoreFee,
    totalCustomerPaid,
  });

  // Khusus Sumber Dana "Kartu ATM Pelanggan":
  // Modal utama transaksi ditarik dari kartu ATM milik nasabah (mesin EDC).
  // Saldo card internal agen (Cash, Brimo, DANA, Seabank) AMAN & TIDAK TERPOTONG SAMA SEKALI.
  if (fundSourceKey === 'atm_pelanggan') {
    // Jika Tarik Tunai melalui ATM / transfer nasabah ke card tujuan agen (Brimo 1/2, Dana 1/2, Seabank),
    // saldo pada card tujuan yang dipilih bertambah sejumlah nominal transaksi.
    if (isTarikTunai && provider) {
      const targetKey: FundSourceKey = parseFundSourceKey(provider);
      if (targetKey && targetKey !== 'atm_pelanggan' && targetKey !== 'cash') {
        updated[targetKey] = (updated[targetKey] || 0) + nominal;
      }
    }
    if (isHutang) {
      if (hutangAmount > 0) {
        updated.hutang = (updated.hutang || 0) + hutangAmount;
      }
    } else if (pmLower === 'cash' && (adminStoreFee || 0) > 0) {
      // Jika biaya admin toko dibayarkan tunai oleh konsumen ke kasir,
      // uang kas fisik kasir bertambah sebesar biaya admin (penambah margin keuntungan/laba toko)
      updated.cash = (updated.cash || 0) + Number(adminStoreFee || 0);
    }
    saveStoredAccountBalances(updated);
    return updated;
  }

  const numBankCost = Math.max(0, Number(adminBankCost) || 0);
  const totalDeductedFromSource = nominal + numBankCost;

  if (isTarikTunai) {
    // Tarik Tunai (Mutasi Saldo Otomatis Dua Arah):
    // 1. Saldo sumber dana (Cash fisik kasir atau card internal agen) terpotong akumulasi: nominal transaksi + biaya modal bank
    const sourceKey: FundSourceKey = fundSourceKey || 'cash';
    updated[sourceKey] = Math.max(0, (updated[sourceKey] || 0) - totalDeductedFromSource);

    // 2. Saldo di card bank tujuan yang dipilih (Brimo 1, Brimo 2, Dana 1, Dana 2, Seabank) otomatis bertambah sejumlah nominal transaksi
    const targetKey: FundSourceKey = parseFundSourceKey(provider);
    if (targetKey && targetKey !== sourceKey) {
      updated[targetKey] = (updated[targetKey] || 0) + nominal;
    }

    // 3. LOGIKA BIAYA ADMIN TOKO TARIK TUNAI:
    // Jika Lunas: masuk & menambah saldo Cash. Jika Hutang: masuk ke Card Hutang.
    const storeFee = Math.max(0, Number(adminStoreFee) || 0);
    if (storeFee > 0) {
      if (isHutang) {
        updated.hutang = (updated.hutang || 0) + storeFee;
      } else if (sourceKey === 'cash' || pmLower === 'cash') {
        updated.cash = (updated.cash || 0) + storeFee;
      }
    }
  } else {
    // Transfer Bank, Top Up E-Wallet, Pulsa, Listrik PLN, PPOB:
    // Saldo pada kartu sumber internal agen (Brimo 1, Brimo 2, Dana 1, Dana 2, Seabank, Cash)
    // otomatis terpotong akumulasi sebesar nominal transaksi + biaya modal bank
    updated[fundSourceKey] = Math.max(0, (updated[fundSourceKey] || 0) - totalDeductedFromSource);

    if (isHutang) {
      // Status Hutang: Nominal dan Fee tidak masuk ke Card Cash, tetapi dicatat ke Card Hutang
      updated.hutang = (updated.hutang || 0) + hutangAmount;
    } else if (pmLower === 'cash') {
      // Jika konsumen membayar Lunas dengan Tunai (Cash fisik):
      // Uang kas tunai di laci kasir bertambah sebesar total yang dibayarkan konsumen
      updated.cash = (updated.cash || 0) + totalCustomerPaid;
    }
  }

  saveStoredAccountBalances(updated);
  return updated;
}

/**
 * Lunasi transaksi berstatus Hutang:
 * Mengurangi saldo pada Card Hutang dan memasukkan dana pembayaran pelanggan (nominal + fee)
 * ke rekening penerima pilihan (Cash, Brimo 1, Brimo 2, Dana 1, Dana 2, atau Seabank)
 */
export function settleHutangTransactionBalance(
  tx: {
    type?: string;
    fundSource?: string;
    notes?: string;
    nominal?: number;
    adminStoreFee?: number;
    totalCustomerPaid?: number;
  },
  receiverAccountKey: HutangReceiverAccountKey = 'cash'
): AccountBalances {
  const current = getStoredAccountBalances();
  const updated: AccountBalances = { ...current };
  const settleAmount = getTransactionHutangAmount(tx);
  const validTargets: HutangReceiverAccountKey[] = [
    'cash',
    'brimo1',
    'brimo2',
    'dana1',
    'dana2',
    'seabank',
  ];
  const targetKey: HutangReceiverAccountKey = validTargets.includes(receiverAccountKey)
    ? receiverAccountKey
    : 'cash';

  if (settleAmount > 0) {
    updated.hutang = Math.max(0, (updated.hutang || 0) - settleAmount);
    updated[targetKey] = (updated[targetKey] || 0) + settleAmount;
  }

  saveStoredAccountBalances(updated);
  return updated;
}

/**
 * Deteksi apakah transaksi digital merupakan catatan Card Tagihan yang masih aktif (belum dilunasi)
 */
export function isTagihanTransaction(tx?: {
  paymentMethod?: string;
  status?: string;
  targetAccount?: string;
  provider?: string;
  notes?: string;
} | null): boolean {
  if (!tx) return false;
  const pm = (tx.paymentMethod || '').trim().toLowerCase();
  const st = (tx.status || '').trim().toLowerCase();
  return pm === 'tagihan' || st === 'tagihan';
}

/**
 * Lunasi catatan Card Tagihan:
 * Mengurangi saldo pada Card Tagihan dan memasukkan dana pelunasan ke Card Cash
 */
export function settleTagihanTransactionBalance(tx: {
  nominal?: number;
}): AccountBalances {
  const current = getStoredAccountBalances();
  const updated: AccountBalances = { ...current };
  const settleAmount = Math.max(0, Math.round(Number(tx?.nominal) || 0));

  if (settleAmount > 0) {
    updated.tagihan = Math.max(0, (updated.tagihan || 0) - settleAmount);
    updated.cash = (updated.cash || 0) + settleAmount;
  }

  saveStoredAccountBalances(updated);
  if ((updated.tagihan || 0) <= 0) {
    saveStoredTagihanNote('');
  }
  return updated;
}

/**
 * Mendapatkan label tampilan resmi dari kunci Sumber Dana
 */
export function getFundSourceLabel(key: FundSourceKey): string {
  if (key === 'atm_pelanggan') return 'Kartu ATM Pelanggan';
  if (key === 'tagihan') return 'Tagihan';
  const found = FUND_SOURCES_CONFIG.find((f) => f.key === key);
  return found ? found.label : 'Brimo 1';
}

/**
 * Parsing cerdas untuk mendeteksi FundSourceKey dari label, catatan transaksi (notes), atau tipe transaksi
 */
export function parseFundSourceKey(
  fundSource?: string,
  notes?: string,
  type?: string
): FundSourceKey {
  const candidate = (fundSource || '').trim().toLowerCase();

  if (
    candidate.includes('atm') ||
    candidate.includes('pelanggan') ||
    candidate.includes('nasabah') ||
    candidate.includes('kartu atm')
  ) {
    return 'atm_pelanggan';
  }
  if (candidate.includes('cash') || candidate.includes('tunai') || candidate === 'fisik') return 'cash';
  if (
    candidate.includes('brimo2') ||
    candidate.includes('brimo 2') ||
    candidate.includes('bri 2') ||
    candidate.includes('bri cad')
  ) {
    return 'brimo2';
  }
  if (
    candidate.includes('brimo1') ||
    candidate.includes('brimo 1') ||
    candidate.includes('bri 1') ||
    candidate.includes('bri utama') ||
    candidate === 'brimo' ||
    candidate === 'bri' ||
    candidate === 'bank bri'
  ) {
    return 'brimo1';
  }
  if (candidate.includes('dana2') || candidate.includes('dana 2')) return 'dana2';
  if (candidate.includes('dana1') || candidate.includes('dana 1') || candidate === 'dana') return 'dana1';
  if (candidate.includes('seabank') || candidate.includes('sea bank') || candidate === 'sea') return 'seabank';
  if (candidate.includes('tagihan') || candidate.includes('bon') || candidate.includes('piutang')) return 'tagihan';

  // Coba ekstrak dari notes jika tersimpan di catatan transaksi: [Sumber: ...] atau [Sumber Dana: ...]
  if (notes) {
    const match = notes.match(/\[Sumber(?:\s*Dana)?:\s*([^\]]+)\]/i);
    if (match && match[1]) {
      const fromNote = match[1].trim().toLowerCase();
      if (
        fromNote.includes('atm') ||
        fromNote.includes('pelanggan') ||
        fromNote.includes('nasabah') ||
        fromNote.includes('kartu atm')
      ) {
        return 'atm_pelanggan';
      }
      if (fromNote.includes('cash') || fromNote.includes('tunai') || fromNote === 'fisik') return 'cash';
      if (fromNote.includes('brimo 2') || fromNote.includes('brimo2') || fromNote.includes('bri 2')) {
        return 'brimo2';
      }
      if (fromNote.includes('brimo') || fromNote.includes('bri')) {
        return 'brimo1';
      }
      if (fromNote.includes('dana 2') || fromNote.includes('dana2')) return 'dana2';
      if (fromNote.includes('dana')) return 'dana1';
      if (fromNote.includes('seabank') || fromNote.includes('sea bank') || fromNote === 'sea') return 'seabank';
      if (fromNote.includes('tagihan') || fromNote.includes('bon')) return 'tagihan';
    }
  }

  // Fallback berdasarkan jenis transaksi
  const t = (type || '').toLowerCase();
  if (t.includes('tarik') || t.includes('cashout')) return 'cash';
  if (t.includes('dana') || t.includes('ewallet') || t.includes('topup')) return 'dana1';
  return 'brimo1';
}

/**
 * Kembalikan saldo akun secara otomatis saat transaksi keagenan dihapus (Refund / Reversal)
 * Berlaku universal untuk seluruh jenis transaksi: Transfer Bank, Tarik Tunai, Top Up E-Wallet, dan PPOB & Lainnya.
 */
export function rollbackTransactionBalance(params: {
  fundSourceKey?: FundSourceKey | string;
  provider?: string;
  targetAccount?: string;
  adminBankCost?: number;
  adminStoreFee?: number;
  notes?: string;
  type: string;
  nominal: number;
  totalCustomerPaid?: number;
  paymentMethod?: string;
}): AccountBalances {
  const {
    fundSourceKey,
    provider,
    targetAccount,
    adminBankCost,
    adminStoreFee,
    notes,
    type,
    nominal,
    totalCustomerPaid,
    paymentMethod,
  } = params;

  const current = getStoredAccountBalances();
  const updated = { ...current };

  const numNominal = Math.max(0, Number(nominal) || 0);
  const numBankCost = Math.max(0, Number(adminBankCost) || 0);
  const numStoreFee = adminStoreFee !== undefined
    ? Math.max(0, Number(adminStoreFee) || 0)
    : (Number(totalCustomerPaid || 0) > numNominal ? Number(totalCustomerPaid) - numNominal : 0);
  const numTotalPaid = Math.max(
    numNominal + numStoreFee,
    Number(totalCustomerPaid) || (numNominal + numStoreFee)
  );

  const t = (type || '').toLowerCase();
  const n = (notes || '').toLowerCase();
  const p = (provider || '').toLowerCase();

  // 0. Transaksi Titipan tidak memotong/menambah Cash secara otomatis saat log riwayat dihapus
  if (t.startsWith('titipan') || n.includes('[titipan]')) {
    return updated;
  }

  // 0b. Mutasi Potongan Admin Bulanan Bank & Bunga Bank (hanya mengembalikan saldo Brimo 1 / Brimo 2 terkait, tanpa mengubah Cash)
  if (
    t === 'bank_admin_bulanan' ||
    t === 'bank_bunga_bank' ||
    n.includes('[potongan & bunga bank]')
  ) {
    const targetCardKey: FundSourceKey =
      (fundSourceKey || '').toLowerCase().includes('brimo 2') ||
      (fundSourceKey || '').toLowerCase() === 'brimo2' ||
      n.includes('(brimo 2)')
        ? 'brimo2'
        : 'brimo1';

    if (t === 'bank_bunga_bank' || p.includes('bunga bank')) {
      updated[targetCardKey] = Math.max(0, (updated[targetCardKey] || 0) - numNominal);
    } else {
      updated[targetCardKey] = (updated[targetCardKey] || 0) + numNominal;
    }
    saveStoredAccountBalances(updated);
    notifyBalancesUpdated(updated);
    return updated;
  }

  // 1. Deteksi cerdas transaksi Transfer Antar Card (Mutasi Internal Saldo / Ambil Saldo)
  const isTransferAntarCard =
    t.includes('transfer_saldo') ||
    t.includes('pindah_dana') ||
    t.includes('mutasi') ||
    t === 'transfer_card' ||
    t.includes('antar_card') ||
    n.includes('transfer saldo') ||
    n.includes('pindah dana') ||
    n.includes('ambil saldo') ||
    p.includes('➔') ||
    p.includes('->');

  if (isTransferAntarCard) {
    // Parsing Akun Sumber Asal (Yang dananya dipotong saat transaksi dibuat)
    let sourceKey: FundSourceKey = 'cash';
    if (p.includes('➔') || p.includes('->')) {
      const parts = p.split(/➔|->/);
      if (parts[0]) sourceKey = parseFundSourceKey(parts[0]);
    } else if (fundSourceKey) {
      sourceKey = parseFundSourceKey(fundSourceKey, notes, type);
    } else {
      sourceKey = parseFundSourceKey(undefined, notes, type);
    }

    // Parsing Akun Tujuan (Yang dananya ditambah saat transaksi dibuat)
    let destinationKey: FundSourceKey = 'brimo1';
    if (p.includes('➔') || p.includes('->')) {
      const parts = p.split(/➔|->/);
      if (parts[1]) destinationKey = parseFundSourceKey(parts[1]);
    } else if (targetAccount) {
      destinationKey = parseFundSourceKey(targetAccount);
    } else {
      const toMatch = n.match(/ke\s+([a-zA-Z0-9\s]+?)(?:\.|\s|$)/i);
      if (toMatch && toMatch[1]) {
        destinationKey = parseFundSourceKey(toMatch[1]);
      } else {
        destinationKey = 'brimo2';
      }
    }

    // a) Tarik kembali nominal saldo dari akun tujuan:
    updated[destinationKey] = Math.max(0, (updated[destinationKey] || 0) - numNominal);
    if (destinationKey === 'tagihan' && (updated.tagihan || 0) <= 0) {
      saveStoredTagihanNote('');
    }

    // b) Kembalikan SELURUH DANA yang terpotong (Nominal + Biaya Admin Transfer & Bank) ke akun sumber asal:
    const totalDeductedFromSource = Math.max(numTotalPaid, numNominal + numBankCost + numStoreFee);
    updated[sourceKey] = (updated[sourceKey] || 0) + totalDeductedFromSource;

    saveStoredAccountBalances(updated);
    notifyBalancesUpdated(updated);
    return updated;
  }

  // 2. Deteksi Transaksi Tarik Tunai Reversal
  const isTarikTunai = t.includes('tarik') || t.includes('cashout');
  const pmLower = (paymentMethod || 'cash').trim().toLowerCase();
  const isHutang = pmLower === 'hutang';
  const hutangAmount = getTransactionHutangAmount({
    type,
    fundSource: fundSourceKey,
    notes,
    nominal: numNominal,
    adminStoreFee: numStoreFee,
    totalCustomerPaid: numTotalPaid,
  });

  const settledReceiverMatch = (notes || '').match(/\[Pelunasan ke:\s*([^\]]+)\]/i);
  const settledReceiverKey: HutangReceiverAccountKey | null = settledReceiverMatch?.[1]
    ? (parseFundSourceKey(settledReceiverMatch[1]) as HutangReceiverAccountKey)
    : null;

  if (isTarikTunai) {
    // Sumber fisik kasir / card pengeluaran:
    const sourceKey: FundSourceKey = parseFundSourceKey(fundSourceKey, notes, type) || 'cash';
    // Rekening penampung agen yang menerima transfer uang dari nasabah:
    const targetKey: FundSourceKey = parseFundSourceKey(provider);

    // Kasus Tarik Tunai dari Mesin EDC / Kartu ATM Pelanggan:
    if (sourceKey === 'atm_pelanggan') {
      if (isHutang && numStoreFee > 0) {
        updated.hutang = Math.max(0, (updated.hutang || 0) - numStoreFee);
      } else if (settledReceiverKey && numStoreFee > 0) {
        updated[settledReceiverKey] = Math.max(0, (updated[settledReceiverKey] || 0) - numStoreFee);
      } else if (pmLower === 'cash' && numStoreFee > 0) {
        updated.cash = Math.max(0, (updated.cash || 0) - numStoreFee);
      }
      if (targetKey && targetKey !== 'atm_pelanggan' && targetKey !== 'cash') {
        updated[targetKey] = Math.max(0, (updated[targetKey] || 0) - numNominal);
      }
      saveStoredAccountBalances(updated);
      notifyBalancesUpdated(updated);
      return updated;
    }

    // Tarik Tunai Reguler:
    // a. Kembalikan uang tunai kasir / modal sumber dana asal yang sebelumnya dikeluarkan:
    const totalRestoredToSource = numNominal + numBankCost;
    updated[sourceKey] = (updated[sourceKey] || 0) + totalRestoredToSource;

    // b. Tarik kembali nominal saldo dari rekening agen yang sebelumnya menerima transferan nasabah:
    if (targetKey && targetKey !== sourceKey && targetKey !== 'atm_pelanggan') {
      updated[targetKey] = Math.max(0, (updated[targetKey] || 0) - numNominal);
    }

    // c. Batalkan porsi Biaya Admin Toko (Margin Fee) dari Hutang atau Rekening Penerima:
    if (numStoreFee > 0) {
      if (isHutang) {
        updated.hutang = Math.max(0, (updated.hutang || 0) - numStoreFee);
      } else if (settledReceiverKey) {
        updated[settledReceiverKey] = Math.max(0, (updated[settledReceiverKey] || 0) - numStoreFee);
      } else if (sourceKey === 'cash' || pmLower === 'cash') {
        updated.cash = Math.max(0, (updated.cash || 0) - numStoreFee);
      }
    }

    saveStoredAccountBalances(updated);
    notifyBalancesUpdated(updated);
    return updated;
  }

  // 3. Kasus Universal: Transfer Bank, Top Up E-Wallet, Pulsa, Token Listrik PLN, PPOB & Lainnya
  const sourceKey: FundSourceKey = parseFundSourceKey(fundSourceKey, notes, type);

  // A. Transaksi dengan Kartu ATM Pelanggan (EDC):
  if (sourceKey === 'atm_pelanggan') {
    if (isHutang && numStoreFee > 0) {
      updated.hutang = Math.max(0, (updated.hutang || 0) - numStoreFee);
    } else if (settledReceiverKey && numStoreFee > 0) {
      updated[settledReceiverKey] = Math.max(0, (updated[settledReceiverKey] || 0) - numStoreFee);
    } else if (pmLower === 'cash' && numStoreFee > 0) {
      updated.cash = Math.max(0, (updated.cash || 0) - numStoreFee);
    }
    saveStoredAccountBalances(updated);
    notifyBalancesUpdated(updated);
    return updated;
  }

  // B. Transaksi dengan Sumber Dana Internal Agen (Brimo 1, Brimo 2, Dana 1, Dana 2, Seabank, Tagihan, atau Cash):
  const totalRestoredToSource = numNominal + numBankCost;

  if (sourceKey !== 'cash') {
    // 1. Kembalikan modal akun sumber agen yang terpotong secara utuh:
    updated[sourceKey] = (updated[sourceKey] || 0) + totalRestoredToSource;

    // 2. Batalkan hutang pelanggan atau dana pelunasan yang masuk ke rekening penerima:
    if (isHutang) {
      updated.hutang = Math.max(0, (updated.hutang || 0) - hutangAmount);
    } else if (settledReceiverKey) {
      updated[settledReceiverKey] = Math.max(0, (updated[settledReceiverKey] || 0) - numTotalPaid);
    } else if (pmLower === 'cash') {
      updated.cash = Math.max(0, (updated.cash || 0) - numTotalPaid);
    }
  } else {
    if (isHutang) {
      // Cash hanya keluar modal bank+nominal dan tidak pernah menerima totalCustomerPaid
      updated.cash = (updated.cash || 0) + totalRestoredToSource;
      updated.hutang = Math.max(0, (updated.hutang || 0) - hutangAmount);
    } else if (settledReceiverKey && settledReceiverKey !== 'cash') {
      updated.cash = (updated.cash || 0) + totalRestoredToSource;
      updated[settledReceiverKey] = Math.max(0, (updated[settledReceiverKey] || 0) - numTotalPaid);
    } else {
      // Jika sumber dananya adalah Cash fisik kasir itu sendiri dan Lunas ke Cash:
      updated.cash = Math.max(0, (updated.cash || 0) + totalRestoredToSource - numTotalPaid);
    }
  }

  saveStoredAccountBalances(updated);
  notifyBalancesUpdated(updated);
  return updated;
}

/**
 * Notifikasi event perubahan saldo ke window global
 */
export function notifyBalancesUpdated(balances: AccountBalances): void {
  if (typeof window !== 'undefined') {
    const event = new CustomEvent(EVENT_BALANCES_UPDATED, { detail: balances });
    window.dispatchEvent(event);
  }
}

/**
 * Dengarkan perubahan saldo secara reaktif
 */
export function onAccountBalancesUpdated(
  callback: (balances: AccountBalances) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent<AccountBalances>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };

  window.addEventListener(EVENT_BALANCES_UPDATED, handler);
  return () => window.removeEventListener(EVENT_BALANCES_UPDATED, handler);
}

// ==========================================
// MANAJEMEN CLOSING & PENGAMBILAN MARGIN FEE
// ==========================================

const STORAGE_KEY_MARGIN_FEE_LEDGER = 'konter_digital_margin_fee_ledger_v1';
const EVENT_MARGIN_FEE_UPDATED = 'konter_margin_fee_ledger_updated';

export interface MarginFeeWithdrawalRecord {
  id: string;
  dateKey: string;
  takenAt: string;
  amount: number;
  todayPortion: number;
  previousPortion: number;
  takenBy: string;
  cashBefore: number;
  cashAfter: number;
}

export interface MarginFeeLedgerState {
  baselineDateKey: string;
  takenByDate: Record<string, number>;
  history: MarginFeeWithdrawalRecord[];
}

export interface UnclaimedMarginDay {
  dateKey: string;
  amount: number;
}

export interface MarginFeeSummary {
  todayDateKey: string;
  baselineDateKey: string;
  todayGrossProfit: number;
  todayTaken: number;
  todayRemainingFee: number;
  previousUnclaimedFee: number;
  unclaimedPreviousDays: UnclaimedMarginDay[];
  totalAvailableToTake: number;
}

export function getLocalDateKey(input: Date | string = new Date()): string {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getStoredMarginFeeLedger(): MarginFeeLedgerState {
  const todayKey = getLocalDateKey();
  if (typeof window === 'undefined') {
    return { baselineDateKey: todayKey, takenByDate: {}, history: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MARGIN_FEE_LEDGER);
    if (!raw) {
      const initial: MarginFeeLedgerState = {
        baselineDateKey: todayKey,
        takenByDate: {},
        history: [],
      };
      localStorage.setItem(STORAGE_KEY_MARGIN_FEE_LEDGER, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    return {
      baselineDateKey:
        typeof parsed?.baselineDateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.baselineDateKey)
          ? parsed.baselineDateKey
          : todayKey,
      takenByDate:
        parsed?.takenByDate && typeof parsed.takenByDate === 'object' ? parsed.takenByDate : {},
      history: Array.isArray(parsed?.history) ? parsed.history : [],
    };
  } catch {
    return { baselineDateKey: todayKey, takenByDate: {}, history: [] };
  }
}

export function saveStoredMarginFeeLedger(
  ledger: MarginFeeLedgerState,
  syncCloud: boolean = true
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_MARGIN_FEE_LEDGER, JSON.stringify(ledger));
    window.dispatchEvent(new CustomEvent(EVENT_MARGIN_FEE_UPDATED, { detail: ledger }));
    if (syncCloud) {
      saveMarginFeeLedgerToCloud(ledger).catch(() => {});
    }
  } catch (err) {
    console.warn('Gagal menyimpan catatan pengambilan margin fee:', err);
  }
}

export function onMarginFeeLedgerUpdated(
  callback: (ledger: MarginFeeLedgerState) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const custom = e as CustomEvent<MarginFeeLedgerState>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };
  window.addEventListener(EVENT_MARGIN_FEE_UPDATED, handler);
  return () => window.removeEventListener(EVENT_MARGIN_FEE_UPDATED, handler);
}

export function calculateMarginFeeSummary(
  transactions: Array<{
    createdAt?: string;
    paidAt?: string;
    profit?: number;
    adminStoreFee?: number;
    adminBankCost?: number;
    paymentMethod?: string;
    status?: string;
  }>,
  ledger: MarginFeeLedgerState,
  todayDateKey: string = getLocalDateKey()
): MarginFeeSummary {
  const profitByDate: Record<string, number> = {};

  for (const tx of transactions) {
    if (!tx?.createdAt) continue;
    if (isHutangTransaction(tx)) continue;
    const key = getLocalDateKey(tx.paidAt || tx.createdAt);
    if (!key) continue;
    const txProfit =
      tx.profit != null && !Number.isNaN(Number(tx.profit))
        ? Number(tx.profit)
        : (Number(tx.adminStoreFee) || 0) - (Number(tx.adminBankCost) || 0);
    profitByDate[key] = (profitByDate[key] || 0) + txProfit;
  }

  const todayGrossProfit = Math.round(profitByDate[todayDateKey] || 0);
  const todayTaken = Math.max(0, Math.round(ledger.takenByDate[todayDateKey] || 0));
  const todayRemainingFee = todayGrossProfit - todayTaken;
  const todayTakeable = Math.max(0, todayRemainingFee);

  const unclaimedPreviousDays: UnclaimedMarginDay[] = [];
  let previousUnclaimedFee = 0;

  const sortedPrevDates = Object.keys(profitByDate)
    .filter((d) => d >= ledger.baselineDateKey && d < todayDateKey)
    .sort();

  for (const d of sortedPrevDates) {
    const gross = Math.max(0, Math.round(profitByDate[d] || 0));
    const taken = Math.max(0, Math.round(ledger.takenByDate[d] || 0));
    const remaining = Math.max(0, gross - taken);
    if (remaining > 0) {
      unclaimedPreviousDays.push({ dateKey: d, amount: remaining });
      previousUnclaimedFee += remaining;
    }
  }

  return {
    todayDateKey,
    baselineDateKey: ledger.baselineDateKey,
    todayGrossProfit,
    todayTaken,
    todayRemainingFee,
    previousUnclaimedFee,
    unclaimedPreviousDays,
    totalAvailableToTake: todayTakeable + previousUnclaimedFee,
  };
}

export function takeMarginFeeFromCash(params: {
  summary: MarginFeeSummary;
  includeToday: boolean;
  includePrevious: boolean;
  takenBy: string;
}): {
  success: boolean;
  message?: string;
  balances: AccountBalances;
  ledger: MarginFeeLedgerState;
  record?: MarginFeeWithdrawalRecord;
} {
  const { summary, includeToday, includePrevious, takenBy } = params;
  const currentBalances = getStoredAccountBalances();
  const currentLedger = getStoredMarginFeeLedger();

  const todayPortion = includeToday ? Math.max(0, summary.todayRemainingFee) : 0;
  const previousPortion = includePrevious ? Math.max(0, summary.previousUnclaimedFee) : 0;
  const totalAmount = todayPortion + previousPortion;

  if (totalAmount <= 0) {
    return {
      success: false,
      message: 'Tidak ada nominal Margin Fee yang tersedia untuk diambil.',
      balances: currentBalances,
      ledger: currentLedger,
    };
  }

  const cashBefore = Number(currentBalances.cash || 0);
  if (cashBefore < totalAmount) {
    return {
      success: false,
      message: `Saldo Cash tidak mencukupi untuk mengambil Margin Fee. Tersedia: Rp ${cashBefore.toLocaleString('id-ID')}, Dibutuhkan: Rp ${totalAmount.toLocaleString('id-ID')}.`,
      balances: currentBalances,
      ledger: currentLedger,
    };
  }

  const cashAfter = cashBefore - totalAmount;
  const updatedBalances: AccountBalances = {
    ...currentBalances,
    cash: cashAfter,
  };

  const nextTakenByDate: Record<string, number> = { ...currentLedger.takenByDate };
  if (todayPortion > 0) {
    nextTakenByDate[summary.todayDateKey] =
      Math.max(0, Math.round(nextTakenByDate[summary.todayDateKey] || 0)) + todayPortion;
  }
  if (previousPortion > 0) {
    for (const dayItem of summary.unclaimedPreviousDays) {
      nextTakenByDate[dayItem.dateKey] =
        Math.max(0, Math.round(nextTakenByDate[dayItem.dateKey] || 0)) + dayItem.amount;
    }
  }

  const record: MarginFeeWithdrawalRecord = {
    id: `FEE-${Date.now()}`,
    dateKey: summary.todayDateKey,
    takenAt: new Date().toISOString(),
    amount: totalAmount,
    todayPortion,
    previousPortion,
    takenBy: takenBy || 'Owner',
    cashBefore,
    cashAfter,
  };

  const updatedLedger: MarginFeeLedgerState = {
    ...currentLedger,
    takenByDate: nextTakenByDate,
    history: [record, ...(currentLedger.history || [])].slice(0, 100),
  };

  saveStoredAccountBalances(updatedBalances);
  saveStoredMarginFeeLedger(updatedLedger);

  return {
    success: true,
    balances: updatedBalances,
    ledger: updatedLedger,
    record,
  };
}

/**
 * Sesuaikan catatan takenByDate saat transaksi dihapus agar tidak menyisakan
 * potongan fiktif yang menelan Margin Fee transaksi berikutnya.
 */
export function reconcileMarginFeeLedgerAfterDelete(
  dateKey: string,
  remainingTransactions: Array<{
    createdAt?: string;
    paidAt?: string;
    profit?: number;
    paymentMethod?: string;
    status?: string;
  }>
): void {
  if (!dateKey) return;
  const currentLedger = getStoredMarginFeeLedger();
  const prevTaken = Math.max(0, Math.round(currentLedger.takenByDate[dateKey] || 0));
  if (prevTaken <= 0) return;

  let remainingGross = 0;
  let remainingCountOnDate = 0;
  for (const tx of remainingTransactions) {
    if (!tx?.createdAt) continue;
    if (isHutangTransaction(tx)) continue;
    if (getLocalDateKey(tx.paidAt || tx.createdAt) !== dateKey) continue;
    remainingCountOnDate += 1;
    remainingGross += Number(tx.profit) || 0;
  }

  const safeCap = remainingCountOnDate === 0 ? 0 : Math.max(0, Math.round(remainingGross));
  if (prevTaken <= safeCap) return;

  const nextTakenByDate: Record<string, number> = { ...currentLedger.takenByDate };
  if (safeCap <= 0) {
    delete nextTakenByDate[dateKey];
  } else {
    nextTakenByDate[dateKey] = safeCap;
  }

  const updatedLedger: MarginFeeLedgerState = {
    ...currentLedger,
    takenByDate: nextTakenByDate,
    history:
      safeCap <= 0
        ? (currentLedger.history || []).filter((h) => h.dateKey !== dateKey)
        : currentLedger.history || [],
  };

  saveStoredMarginFeeLedger(updatedLedger, true);
}

/**
 * Potong saldo card sumber dana saat pengeluaran kas toko dicatat
 */
export function processExpenseBalanceDeduction(
  paidByKey: string,
  amount: number
): { success: boolean; balances: AccountBalances; message?: string } {
  const current = getStoredAccountBalances();
  const rawKey = (paidByKey || 'cash').trim().toLowerCase();
  const validKey: FundSourceKey =
    rawKey === 'cash' || rawKey.includes('tunai')
      ? 'cash'
      : rawKey === 'brimo1' || rawKey.includes('brimo 1')
      ? 'brimo1'
      : rawKey === 'brimo2' || rawKey.includes('brimo 2')
      ? 'brimo2'
      : rawKey === 'dana1' || rawKey.includes('dana 1')
      ? 'dana1'
      : rawKey === 'dana2' || rawKey.includes('dana 2')
      ? 'dana2'
      : rawKey === 'seabank'
      ? 'seabank'
      : 'cash';

  const numAmount = Math.max(0, Math.round(Number(amount) || 0));
  const currentBal = current[validKey] || 0;

  if (numAmount > currentBal) {
    return {
      success: false,
      balances: current,
      message: `Saldo ${getFundSourceLabel(validKey)} tidak mencukupi (Tersedia: Rp ${currentBal.toLocaleString('id-ID')}, Dibutuhkan: Rp ${numAmount.toLocaleString('id-ID')}).`,
    };
  }

  const updated: AccountBalances = {
    ...current,
    [validKey]: Math.max(0, currentBal - numAmount),
  };

  saveStoredAccountBalances(updated);
  return {
    success: true,
    balances: updated,
  };
}

/**
 * Kembalikan saldo card sumber dana saat pengeluaran kas toko dihapus
 */
export function processExpenseBalanceRefund(
  paidByKey: string,
  amount: number
): AccountBalances {
  const current = getStoredAccountBalances();
  const rawKey = (paidByKey || 'cash').trim().toLowerCase();
  const validKey: FundSourceKey =
    rawKey === 'cash' || rawKey.includes('tunai')
      ? 'cash'
      : rawKey === 'brimo1' || rawKey.includes('brimo 1')
      ? 'brimo1'
      : rawKey === 'brimo2' || rawKey.includes('brimo 2')
      ? 'brimo2'
      : rawKey === 'dana1' || rawKey.includes('dana 1')
      ? 'dana1'
      : rawKey === 'dana2' || rawKey.includes('dana 2')
      ? 'dana2'
      : rawKey === 'seabank'
      ? 'seabank'
      : 'cash';

  const numAmount = Math.max(0, Math.round(Number(amount) || 0));
  const updated: AccountBalances = {
    ...current,
    [validKey]: (current[validKey] || 0) + numAmount,
  };

  saveStoredAccountBalances(updated);
  return updated;
}

