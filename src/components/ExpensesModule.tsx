import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Trash2, Calendar, DollarSign, Tag, AlertTriangle } from 'lucide-react';
import { StoreExpense } from '../types/index.ts';
import {
  getStoredExpenses,
  saveStoredExpenses,
  removeStoredExpense,
  notifyDataUpdated,
} from '../utils/transactionSync.ts';
import {
  getStoredAccountBalances,
  onAccountBalancesUpdated,
  AccountBalances,
  FundSourceKey,
  getFundSourceLabel,
  processExpenseBalanceDeduction,
  processExpenseBalanceRefund,
} from '../services/accountBalanceService.ts';
import {
  saveExpenseToCloud,
  deleteExpenseFromCloud,
  subscribeExpensesCloud,
  normalizeStoreExpense,
} from '../services/cloudDigitalFinanceService.ts';

const EXPENSE_PAYMENT_SOURCES: { key: FundSourceKey; label: string }[] = [
  { key: 'cash', label: 'Cash' },
  { key: 'brimo1', label: 'Brimo 1' },
  { key: 'brimo2', label: 'Brimo 2' },
  { key: 'dana1', label: 'Dana 1' },
  { key: 'dana2', label: 'Dana 2' },
  { key: 'seabank', label: 'Seabank' },
];

export const ExpensesModule: React.FC = () => {
  const [expenses, setExpenses] = useState<StoreExpense[]>(() => getStoredExpenses());
  const [balances, setBalances] = useState<AccountBalances>(() => getStoredAccountBalances());
  const [loading, setLoading] = useState(true);

  // Form State
  const [category, setCategory] = useState('listrik_air');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [paidBy, setPaidBy] = useState<string>('cash');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const formatRupiah = (val: number) => 'Rp ' + Number(val || 0).toLocaleString('id-ID');

  const formatCurrencyInput = (val: number): string => {
    const num = Math.max(0, Math.round(Number(val) || 0));
    if (num === 0) return '';
    return 'Rp ' + num.toLocaleString('id-ID');
  };

  const parseCurrencyInput = (text: string): number => {
    const digits = text.replace(/\D/g, '');
    if (!digits) return 0;
    return Math.min(parseInt(digits, 10) || 0, 10000000000);
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses').catch(() => null);
      if (res && res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const normalized = data.map(normalizeStoreExpense);
            setExpenses(normalized);
            saveStoredExpenses(normalized);
            return;
          }
        }
      }
      setExpenses(getStoredExpenses());
    } catch (err) {
      console.warn('Mode static/cloud untuk pengeluaran:', err);
      setExpenses(getStoredExpenses());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();

    let isInitialCloudSnapshot = true;
    let sawCloudDocs = false;
    const unsubCloudExpenses = subscribeExpensesCloud((cloudExpenses, hasDocs) => {
      if (hasDocs) {
        isInitialCloudSnapshot = false;
        sawCloudDocs = true;
        setExpenses(cloudExpenses);
        saveStoredExpenses(cloudExpenses);
        setLoading(false);
      } else if (isInitialCloudSnapshot) {
        isInitialCloudSnapshot = false;
        const localStored = getStoredExpenses() || [];
        if (localStored.length > 0) {
          const normalized = localStored.map(normalizeStoreExpense);
          setExpenses(normalized);
          normalized.forEach((exp) => {
            saveExpenseToCloud(exp).catch(() => {});
          });
        }
      } else if (sawCloudDocs) {
        setExpenses([]);
        saveStoredExpenses([]);
      }
    });

    const unsubBalances = onAccountBalancesUpdated((latestBalances) => {
      setBalances(latestBalances);
    });
    return () => {
      unsubCloudExpenses();
      unsubBalances();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || amount <= 0) {
      alert('Keterangan pengeluaran dan jumlah biaya wajib diisi');
      return;
    }

    const availableBal = balances[paidBy as keyof AccountBalances] || 0;
    if (amount > availableBal) {
      alert(
        `Saldo ${getFundSourceLabel(paidBy as FundSourceKey)} tidak mencukupi!\nTersedia: ${formatRupiah(availableBal)}\nDibutuhkan: ${formatRupiah(amount)}`
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Potong saldo otomatis dari sumber dana yang dipilih
      const deductionResult = processExpenseBalanceDeduction(paidBy, amount);
      if (!deductionResult.success) {
        alert(deductionResult.message || 'Gagal memotong saldo pengeluaran');
        setSubmitting(false);
        return;
      }
      setBalances(deductionResult.balances);

      const payload = {
        category,
        title: title.trim(),
        amount,
        expenseDate,
        paidBy,
        notes: notes.trim() || undefined,
      };

      let rawSaved: any = null;
      try {
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          rawSaved = await res.json();
        }
      } catch {
        // Mode offline / static
      }

      const savedExpense: StoreExpense = normalizeStoreExpense({
        id: rawSaved?.id || Date.now(),
        category: payload.category,
        title: payload.title,
        amount: payload.amount,
        expenseDate: payload.expenseDate,
        paidBy: payload.paidBy,
        notes: payload.notes,
        createdAt: rawSaved?.createdAt || new Date().toISOString(),
      });

      await saveExpenseToCloud(savedExpense);

      const currentStored = getStoredExpenses().filter((item) => item.id !== savedExpense.id);
      const nextList = [savedExpense, ...currentStored];
      saveStoredExpenses(nextList);
      setExpenses(nextList);

      setTitle('');
      setAmount(0);
      setNotes('');
      notifyDataUpdated('all');
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengeluaran');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const toDelete = expenses.find((e) => e.id === id);
    if (!toDelete) return;
    const srcName = getFundSourceLabel(toDelete.paidBy as FundSourceKey);
    if (!confirm(`Hapus pencatatan pengeluaran "${toDelete.title}"? Saldo ${srcName} sebesar ${formatRupiah(toDelete.amount)} akan dikembalikan.`)) {
      return;
    }
    try {
      await fetch(`/api/expenses/${id}`, { method: 'DELETE' }).catch(() => null);
      await deleteExpenseFromCloud(id);
      removeStoredExpense(id);
      if (toDelete.amount > 0) {
        const refundedBalances = processExpenseBalanceRefund(toDelete.paidBy, toDelete.amount);
        setBalances(refundedBalances);
      }
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      notifyDataUpdated('all');
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  const totalExpenses = expenses.reduce((acc, cur) => acc + cur.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">Pencatatan Rekap Beban & Pengeluaran Toko</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mencatat pengeluaran sewa ruko, token listrik, tagihan internet, ATK kertas thermal, kredit server tool, dan konsumsi.
          </p>
        </div>

        <div className="px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-right">
          <div className="text-[10px] text-rose-600 font-medium">Total Beban Operasional</div>
          <div className="font-bold text-rose-800 text-sm">-{formatRupiah(totalExpenses)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100">
              Input Pengeluaran Kas Toko
            </h3>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Kategori Pengeluaran
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  <option value="listrik_air">Listrik & Air Toko</option>
                  <option value="koneksi_internet">Internet WiFi & Pulsa Operasional</option>
                  <option value="atk_nota_kertas">ATK, Kertas Roll Kasir Thermal</option>
                  <option value="kredit_tool_server">Kredit Server Software Tool (UnlockTool, dll.)</option>
                  <option value="sewa_tempat">Sewa Ruko / Tempat Usaha</option>
                  <option value="gaji_karyawan">Gaji Karyawan / Komisi</option>
                  <option value="operasional_harian">Konsumsi & Operasional Harian</option>
                  <option value="lainnya">Pengeluaran Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Keterangan / Judul Pengeluaran
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Beli kertas thermal 58mm 10 roll..."
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nominal Biaya (Rp)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    value={amount === 0 ? '' : formatCurrencyInput(amount)}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => {
                      if (amount > 0) e.currentTarget.select();
                    }}
                    onChange={(e) => setAmount(parseCurrencyInput(e.target.value))}
                    placeholder="Rp. 0"
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-bold font-mono text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Tanggal Pengeluaran
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Sumber Dana Pembayaran
                  </label>
                  <span className="text-[10px] font-mono font-bold text-slate-500">
                    Sisa: {formatRupiah(balances[paidBy as keyof AccountBalances] || 0)}
                  </span>
                </div>
                <select
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                >
                  {EXPENSE_PAYMENT_SOURCES.map((src) => {
                    const currentBal = balances[src.key as keyof AccountBalances] || 0;
                    return (
                      <option key={src.key} value={src.key}>
                        {src.label} — Saldo: {formatRupiah(currentBal)}
                      </option>
                    );
                  })}
                </select>
                {amount > (balances[paidBy as keyof AccountBalances] || 0) && (
                  <p className="text-[10.5px] text-rose-600 font-semibold mt-1 flex items-center gap-1 animate-in fade-in duration-150">
                    <AlertTriangle className="w-3 h-3 shrink-0 text-rose-500" />
                    <span>
                      Saldo {getFundSourceLabel(paidBy as FundSourceKey)} tidak mencukupi (kurang{' '}
                      {formatRupiah(amount - (balances[paidBy as keyof AccountBalances] || 0))}).
                    </span>
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Nomor nota toko, supplier..."
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Pengeluaran</span>
              </button>
            </form>
          </div>
        </div>

        {/* Expenses List Table (7 cols) */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm">Riwayat Rekap Kas Keluar</h3>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table
                className="w-full text-left text-xs table-fixed"
                style={{ tableLayout: 'fixed', width: '100%' }}
              >
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th style={{ width: '16%' }} className="px-2.5 py-2.5">Tanggal</th>
                    <th style={{ width: '18%' }} className="px-2 py-2.5">Kategori</th>
                    <th style={{ width: '30%' }} className="px-2 py-2.5">Keterangan</th>
                    <th style={{ width: '14%' }} className="px-2 py-2.5">Sumber Dana</th>
                    <th style={{ width: '14%' }} className="px-2 py-2.5">Jumlah Biaya</th>
                    <th style={{ width: '8%' }} className="px-2.5 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Memuat data pengeluaran...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        Belum ada catatan pengeluaran
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-2.5 py-2 font-medium text-slate-700 truncate">{exp.expenseDate}</td>
                        <td className="px-2 py-2 overflow-hidden">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold uppercase text-slate-700 truncate inline-block max-w-full">
                            {exp.category.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-2 py-2 overflow-hidden">
                          <div className="font-semibold text-slate-900 truncate" title={exp.title}>{exp.title}</div>
                          {exp.notes && (
                            <div className="text-[10px] text-slate-400 truncate" title={exp.notes}>{exp.notes}</div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[11px] font-semibold text-slate-700 truncate" title={getFundSourceLabel(exp.paidBy as FundSourceKey)}>
                          {getFundSourceLabel(exp.paidBy as FundSourceKey)}
                        </td>
                        <td className="px-2 py-2 font-bold text-rose-600 whitespace-nowrap">
                          -{formatRupiah(exp.amount)}
                        </td>
                        <td className="px-2.5 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDelete(exp.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
