import React, { useState, useRef, useEffect } from 'react';
import {
  CreditCard,
  BarChart3,
  History,
  Receipt,
  LogOut,
  User,
  Users,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserRole } from '../types/index.ts';
import {
  useBodyScrollLock,
  handleBackdropTouchMove,
  handleBackdropWheel,
  handleModalCardScroll,
} from '../utils/scrollLock.ts';

export type ActiveTab =
  | 'digital_finance'
  | 'sales_history'
  | 'expenses'
  | 'analytics'
  | 'users';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const {
    operatorName,
    currentRole,
    activeStaff,
    lockTerminal,
  } = useAuth();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [profileDropdownOpen]);

  // Fixed Body Scroll Lock for mobile drawer
  useBodyScrollLock(mobileDrawerOpen);

  const getCleanRoleName = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'Owner';
      case 'manager':
        return 'Kepala Toko';
      case 'cashier':
        return 'Kasir';
      case 'technician':
        return 'Teknisi';
      default:
        return role;
    }
  };

  const rawName = activeStaff?.name || operatorName || 'Kasir';
  const cleanName = rawName.replace(/\s*\(.*?\)\s*/g, '').trim() || 'Kasir';
  const roleName = getCleanRoleName(currentRole);

  // Menu Navigasi Fokus Agen Digital & Finansial
  const allNavItems = [
    {
      id: 'digital_finance' as ActiveTab,
      label: 'Agen Digital & E-Wallet',
      category: 'transaksi',
      icon: CreditCard,
      visible: true,
      description: 'Transfer BRILink, top-up e-wallet, tarik tunai & PPOB',
    },
    {
      id: 'sales_history' as ActiveTab,
      label: 'Riwayat Transaksi',
      category: 'transaksi',
      icon: History,
      visible: true,
      description: 'Arsip bukti transfer, mutasi digital & cetak ulang struk',
    },
    {
      id: 'expenses' as ActiveTab,
      label: 'Beban Toko',
      category: 'manajemen',
      icon: Receipt,
      visible: currentRole === 'owner' || currentRole === 'manager',
      description: 'Biaya operasional toko, admin bank & kas keluar',
    },
    {
      id: 'analytics' as ActiveTab,
      label: 'Laporan Keuangan',
      category: 'manajemen',
      icon: BarChart3,
      visible: currentRole === 'owner' || currentRole === 'manager',
      description: 'Analitik omset, fee admin & laba bersih (P&L)',
    },
    {
      id: 'users' as ActiveTab,
      label: 'Kelola Pengguna',
      category: 'manajemen',
      icon: Users,
      visible: currentRole === 'owner',
      description: 'Manajemen akun staf & hak akses role',
    },
  ];

  const visibleNavItems = allNavItems.filter((item) => item.visible);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      <header
        className="sticky-header-navbar w-full max-w-full text-slate-800 border-b border-slate-200/90"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          backgroundColor: '#ffffff',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Top Header Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 bg-white">
          {/* Left: Hamburger Button (Garis 3) + Brand + Indikator Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-slate-700 hover:text-indigo-600 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200/90 shadow-2xs transition-colors cursor-pointer shrink-0"
              aria-label="Buka Menu Navigasi"
              title="Buka Menu Navigasi (Garis 3)"
            >
              <Menu className="w-5 h-5 text-indigo-600" />
            </button>

            {/* Logo & Judul Toko */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/20 text-white shrink-0">
                <CreditCard className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
              </div>

              <div className="min-w-0">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 leading-tight block truncate">
                  Agen BRI Pakde Link
                </span>
                <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium leading-tight truncate">
                  Sistem Transaksi Agen BRILink, Top Up E-Wallet &amp; Pembayaran Digital
                </p>
              </div>
            </div>
          </div>

          {/* Right side: User Profile Dropdown */}
          <div
            className="relative inline-block shrink-0"
            ref={profileDropdownRef}
            style={{ position: 'relative', display: 'inline-block' }}
          >
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center justify-center sm:justify-between gap-1.5 sm:gap-2 w-9 h-9 sm:w-auto sm:min-w-[140px] sm:max-w-[200px] p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200/80 border border-slate-200/90 shadow-2xs transition-colors duration-150 cursor-pointer select-none text-left shrink-0"
              aria-expanded={profileDropdownOpen}
              aria-haspopup="true"
              aria-label="Menu Profil Pengguna"
            >
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <div className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 hidden sm:block">
                  <span className="text-xs font-bold text-slate-800 block truncate leading-tight">
                    {cleanName}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-150 hidden sm:block ${
                  profileDropdownOpen ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu Profil */}
            {profileDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  boxSizing: 'border-box',
                }}
                className="absolute top-full right-0 mt-[6px] w-max min-w-[150px] max-w-[calc(100vw-16px)] sm:min-w-full bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden box-border animate-in fade-in-50 zoom-in-95 duration-100"
              >
                <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {cleanName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium truncate">
                    {roleName}
                  </div>
                </div>

                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      lockTerminal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span className="truncate">Keluar</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Drawer (Garis 3) - Universal untuk Desktop, Tablet & Mobile */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex overscroll-none select-none">
          <div
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200 cursor-pointer touch-none"
            onClick={(e) => {
              e.stopPropagation();
              setMobileDrawerOpen(false);
            }}
            onWheel={handleBackdropWheel}
            onTouchMove={handleBackdropTouchMove}
            aria-label="Tutup Menu"
          />

          <div
            data-drawer-panel="true"
            className="relative w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 border-r border-slate-200"
            style={{
              height: '100vh',
              maxHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Drawer Header */}
            <div className="py-2.5 px-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-xs text-slate-900 leading-tight truncate">
                    Agen BRI Pakde Link
                  </h3>
                  <p className="text-[9px] text-slate-500 font-medium leading-tight truncate">
                    Sistem Transaksi Agen BRILink, Top Up E-Wallet &amp; Pembayaran Digital
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Tutup Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Daftar Menu Vertikal */}
            <div className="flex-1 py-3 px-3 flex flex-col justify-start space-y-3 overflow-y-auto">
              <div>
                <div className="px-1.5 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Menu Transaksi
                </div>
                <div className="space-y-1.5">
                  {visibleNavItems
                    .filter((item) => item.category === 'transaksi')
                    .map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          className={`w-full flex items-center justify-between py-2 px-3 rounded-xl text-left transition-colors cursor-pointer border ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/20 active:bg-indigo-700'
                              : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-indigo-50 text-indigo-600'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div
                                className={`font-bold text-xs truncate leading-tight ${
                                  isActive ? 'text-white' : 'text-slate-800'
                                }`}
                              >
                                {item.label}
                              </div>
                              <div
                                className={`text-[10px] truncate leading-tight ${
                                  isActive ? 'text-indigo-100' : 'text-slate-400'
                                }`}
                              >
                                {item.description}
                              </div>
                            </div>
                          </div>
                          <ChevronRight
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-indigo-200' : 'text-slate-400'
                            }`}
                          />
                        </button>
                      );
                    })}
                </div>
              </div>

              {visibleNavItems.some((item) => item.category === 'manajemen') && (
                <div>
                  <div className="px-1.5 pt-1 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Menu Manajemen & Laporan
                  </div>
                  <div className="space-y-1.5">
                    {visibleNavItems
                      .filter((item) => item.category === 'manajemen')
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectTab(item.id)}
                            className={`w-full flex items-center justify-between py-2 px-3 rounded-xl text-left transition-colors cursor-pointer border ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs shadow-indigo-600/20 active:bg-indigo-700'
                                : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-indigo-50 text-indigo-600'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <div
                                  className={`font-bold text-xs truncate leading-tight ${
                                    isActive ? 'text-white' : 'text-slate-800'
                                  }`}
                                >
                                  {item.label}
                                </div>
                                <div
                                  className={`text-[10px] truncate leading-tight ${
                                    isActive ? 'text-indigo-100' : 'text-slate-400'
                                  }`}
                                >
                                  {item.description}
                                </div>
                              </div>
                            </div>
                            <ChevronRight
                              className={`w-4 h-4 shrink-0 ${
                                isActive ? 'text-indigo-200' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status */}
            <div className="py-2.5 px-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-medium shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Agen BRI Pakde Link &bull; Sistem Transaksi Digital</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
