import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  User,
  KeyRound,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Store,
  Layers,
  CreditCard,
  Loader2,
  Receipt,
} from 'lucide-react';
import { AppUser } from '../types/index.ts';
import { authenticateWithFirestore } from '../services/cloudUserService.ts';

interface LockScreenProps {
  onUnlockSuccess: (user: AppUser) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({ onUnlockSuccess }) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [verifying, setVerifying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const performLogin = async (idToUse: string, passToUse: string) => {
    if (!idToUse.trim()) {
      setErrorMsg('Masukkan ID Karyawan');
      return;
    }
    if (!passToUse.trim()) {
      setErrorMsg('Masukkan password');
      return;
    }

    setVerifying(true);
    setErrorMsg('');

    try {
      // 1. Coba request login ke backend PostgreSQL API
      let res: Response | null = null;
      let primaryNetworkError: any = null;

      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: idToUse.trim(),
            identifier: idToUse.trim(),
            password: passToUse.trim(),
          }),
        });
      } catch (err: any) {
        primaryNetworkError = err;
      }

      // Jika backend merespon HTTP
      if (res) {
        const text = await res.text();
        let result: any = null;
        try {
          result = JSON.parse(text);
        } catch {
          throw new Error(`Server API merespons format tidak valid (${res.status})`);
        }

        // Login sukses via backend PostgreSQL
        if (res.ok && result?.success && result?.user) {
          onUnlockSuccess(result.user);
          return;
        }

        // Kredensial tidak valid (status 400 atau 401)
        if (res.status === 400 || res.status === 401) {
          setErrorMsg(result?.error || 'ID Karyawan atau password salah');
          return;
        }

        if (!res.ok) {
          throw new Error(result?.error || `Server API error (${res.status})`);
        }
      } else if (primaryNetworkError) {
        throw primaryNetworkError;
      }
    } catch (primaryErr: any) {
      console.warn('Backend login gagal, beralih ke Cloud Firestore fallback:', primaryErr);

      // 2. Fallback Arsitektur Hybrid: Autentikasi tervalidasi via Cloud Firestore
      try {
        const fsResult = await authenticateWithFirestore(idToUse, passToUse);
        if (fsResult.success && fsResult.user) {
          onUnlockSuccess(fsResult.user);
          return;
        }
        setErrorMsg(fsResult.message || 'ID Karyawan atau password salah');
        return;
      } catch (fsErr: any) {
        console.warn('Cloud Firestore fallback juga gagal:', fsErr);

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setErrorMsg('Perangkat Anda sedang offline. Mohon periksa koneksi internet.');
          return;
        }

        setErrorMsg(primaryErr?.message || 'Gagal memverifikasi login dengan server. Cek koneksi Anda.');
        return;
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await performLogin(identifier, password);
  };

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full overflow-hidden flex flex-col md:flex-row bg-[#f8fafc] text-slate-900 select-none">
      {/* SISI KIRI: BRANDING & DESKRIPSI
          - Desktop (>= 1024px, lg): 7/12 (~58%) split screen fit 100dvh tanpa scrollbar
          - Tablet (768px - 1023px, md): 5/12 (~41%) proporsi kompak dengan font & padding disesuaikan agar fit 100dvh tanpa scrollbar
          - Mobile (< 768px): Sembunyi (hidden), digantikan header ringkas di dalam card login */}
      <div className="hidden md:flex w-full md:w-5/12 lg:w-7/12 h-full bg-gradient-to-br from-indigo-50/80 via-slate-50 to-sky-50/50 p-4 md:p-5 lg:p-10 xl:p-12 flex-col justify-between border-r border-slate-200/90 relative overflow-hidden">
        {/* Soft subtle ambient background lightings */}
        <div className="absolute -top-24 -left-24 w-88 h-88 bg-indigo-200/35 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-88 h-88 bg-sky-200/30 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Store Brand & Live Clock */}
        <div className="relative z-10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 lg:gap-3.5 min-w-0">
              <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25 border border-indigo-400/30 shrink-0">
                <Smartphone className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base lg:text-xl font-black tracking-tight text-slate-900 leading-tight truncate">
                  Agen BRI Pakde Link
                </h1>
                <p className="text-[11px] lg:text-xs text-slate-600 font-medium line-clamp-1">
                  Sistem Transaksi Agen BRILink, Top Up E-Wallet &amp; Pembayaran Digital
                </p>
              </div>
            </div>

            {/* Realtime Digital Clock */}
            <div className="text-right shrink-0">
              <div className="font-mono text-xs lg:text-sm font-bold text-slate-800 tracking-wider bg-white/90 px-2.5 lg:px-3 py-1 rounded-xl border border-slate-200 shadow-xs inline-block">
                {currentTime.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
              <div className="text-[10px] lg:text-[11px] text-slate-500 mt-0.5 font-medium hidden lg:block">
                {currentTime.toLocaleDateString('id-ID', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          </div>

          {/* Description & Value Proposition */}
          <div className="mt-3 md:mt-4 lg:mt-7 max-w-xl">
            <h2 className="text-lg md:text-xl lg:text-2xl xl:text-3xl font-extrabold text-slate-900 leading-snug tracking-tight">
              Aplikasi Agen BRILink, E-Wallet & Keuangan Digital
            </h2>
            <p className="mt-1.5 lg:mt-2 text-xs lg:text-sm text-slate-600 leading-relaxed font-normal line-clamp-2 lg:line-clamp-none">
              Kelola transaksi transfer bank, tarik tunai, top-up e-wallet, pembayaran tagihan PPOB,
              serta pembukuan laba rugi agen dan cetak struk thermal otomatis.
            </p>
          </div>
        </div>

        {/* Middle: Feature Highlights (4 Pillar Cards) */}
        <div className="grid grid-cols-2 gap-2 md:gap-2.5 lg:gap-3.5 my-2 lg:my-4 relative z-10">
          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-indigo-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center shrink-0">
                <CreditCard className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                Transfer & Tarik Tunai
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              Agen BRILink, BCA, Mandiri, BNI, dan semua bank dengan fee otomatis.
            </p>
          </div>

          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-violet-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-violet-100/80 text-violet-600 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                Top Up E-Wallet
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              Isi saldo DANA, OVO, GoPay, ShopeePay & LinkAja secara instan.
            </p>
          </div>

          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center shrink-0">
                <Store className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                PPOB & Tagihan
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              Token PLN, pulsa, paket data, BPJS, PDAM & cicilan bulanan.
            </p>
          </div>

          <div className="p-2.5 lg:p-3.5 rounded-2xl bg-white/90 border border-slate-200/90 shadow-xs hover:border-amber-300 hover:shadow-md transition-colors duration-200 group">
            <div className="flex items-center gap-1.5 lg:gap-2 mb-1">
              <div className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center shrink-0">
                <Receipt className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
              </div>
              <h3 className="font-bold text-[11px] lg:text-xs text-slate-800">
                Laporan Keuangan
              </h3>
            </div>
            <p className="text-[10px] lg:text-[11px] text-slate-500 leading-normal line-clamp-2">
              Rekap omset, fee admin, beban toko, dan laporan laba rugi otomatis.
            </p>
          </div>
        </div>

        {/* Bottom Footer Copyright & App Version */}
        <div className="pt-2 lg:pt-3 border-t border-slate-200/90 flex items-center justify-between gap-2 text-[10px] lg:text-[11px] text-slate-500 relative z-10 font-medium">
          <span className="truncate">Copyright © 2026 Pakde Link. All rights reserved.</span>
          <span className="font-mono text-slate-400 text-[9px] lg:text-[10px] bg-slate-200/60 px-1.5 lg:px-2 py-0.5 rounded shrink-0">v2.5 Digital</span>
        </div>
      </div>

      {/* SISI KANAN / UTAMA: FORM LOGIN
          - Mobile (< 768px): Flex-col full 1 layar (h-full justify-between) -> Header di atas, Card Login di tengah (my-auto), Footer Copyright di bawah
          - Tablet & Desktop (>= 768px): Centered vertikal & horizontal di kolom kanan */}
      <div className="w-full md:w-7/12 lg:w-5/12 h-full flex-1 bg-slate-50/70 md:bg-white flex flex-col justify-between md:justify-center items-center px-4 py-3 sm:px-6 sm:py-5 md:p-8 lg:p-12 relative overflow-hidden">
        {/* Soft background ambient light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-80 lg:w-96 h-72 sm:h-80 lg:h-96 bg-indigo-100/40 md:bg-indigo-50/50 rounded-full blur-3xl pointer-events-none" />

        {/* 1. MOBILE HEADER (Paling Atas pada layar < 768px) */}
        <header className="md:hidden w-full max-w-[380px] sm:max-w-md flex items-center justify-between gap-2 pb-2 border-b border-slate-200/80 relative z-10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-xs border border-indigo-400/30 shrink-0">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-black text-sm text-slate-900 tracking-tight block truncate leading-tight">
                Agen BRI Pakde Link
              </span>
              <p className="text-[10px] text-slate-500 font-medium truncate leading-tight">
                Sistem Transaksi Agen BRILink, Top Up E-Wallet &amp; Pembayaran Digital
              </p>
            </div>
          </div>
          <span className="font-mono text-[11px] font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs shrink-0">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </header>

        {/* 2. MENU LOGIN DI TENGAH (Centered Vertikal & Horizontal) */}
        <div className="w-full max-w-[380px] sm:max-w-md my-auto bg-white md:bg-transparent rounded-2xl md:rounded-none border border-slate-200/90 md:border-0 shadow-sm md:shadow-none p-4 sm:p-6 md:p-0 relative z-10">
          {/* Form Header */}
          <div className="mb-3 sm:mb-4 lg:mb-5">
            <h2 className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              Masuk ke Sistem
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-1 leading-relaxed font-normal">
              Silakan masukkan ID Karyawan dan password Anda.
            </p>
          </div>

          {/* Standard Login Form with touch-friendly inputs */}
          <form onSubmit={handleLoginSubmit} className="space-y-2.5 sm:space-y-4">
            {/* Input 1: ID Karyawan */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1 sm:mb-1.5">
                ID Karyawan
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Masukkan ID..."
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 h-10 sm:h-11 md:h-12 rounded-xl bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 text-sm font-medium transition duration-150"
                />
              </div>
            </div>

            {/* Input 2: Password */}
            <div>
              <div className="flex justify-between items-center mb-1 sm:mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="Masukkan Password..."
                  required
                  className="w-full pl-10 pr-12 h-10 sm:h-11 md:h-12 rounded-xl bg-slate-50/70 hover:bg-slate-50 focus:bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 text-sm font-medium tracking-wider transition duration-150"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div
                role="alert"
                className="p-2.5 sm:p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Tombol Masuk Utama (Touch friendly) */}
            <button
              type="submit"
              disabled={verifying || !identifier.trim() || !password.trim()}
              className="w-full h-11 sm:h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:shadow-indigo-500/20 transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed mt-1"
            >
              {verifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* 3. MOBILE FOOTER (Paling Bawah pada layar < 768px) */}
        <footer className="md:hidden w-full max-w-[380px] sm:max-w-md pt-2 border-t border-slate-200/80 text-center text-[10.5px] sm:text-[11px] text-slate-500 font-medium relative z-10 shrink-0">
          <span>Copyright © 2026 Pakde Link. All rights reserved.</span>
        </footer>
      </div>
    </div>
  );
};
