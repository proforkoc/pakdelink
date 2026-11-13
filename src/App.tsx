import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar, ActiveTab } from './components/Navbar.tsx';
import { LockScreen } from './components/LockScreen.tsx';
import { DigitalFinanceModule } from './components/DigitalFinanceModule.tsx';
import { AnalyticsModule } from './components/AnalyticsModule.tsx';
import { SalesHistoryModule } from './components/SalesHistoryModule.tsx';
import { ExpensesModule } from './components/ExpensesModule.tsx';
import { UserManagementModule } from './components/UserManagementModule.tsx';
import { ThermalReceipt, ReceiptType } from './components/ThermalReceipt.tsx';
import { Sale, DigitalTransaction, ServiceSoftwareOrder, AppUser } from './types/index.ts';
import { useBodyScrollLock, initGlobalModalScrollLock } from './utils/scrollLock.ts';

function AppContent() {
  const { isLocked, unlockTerminal, currentRole } = useAuth();

  const getInitialTab = (): ActiveTab => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as ActiveTab;
      const validTabs: ActiveTab[] = [
        'digital_finance',
        'sales_history',
        'expenses',
        'analytics',
        'users',
      ];
      if (validTabs.includes(hash)) return hash;
    }
    return 'digital_finance';
  };

  const [activeTab, setActiveTabState] = useState<ActiveTab>(getInitialTab);

  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  };

  // Dengarkan perubahan hash browser (Back / Forward button)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as ActiveTab;
      const validTabs: ActiveTab[] = [
        'digital_finance',
        'sales_history',
        'expenses',
        'analytics',
        'users',
      ];
      if (validTabs.includes(hash)) {
        setActiveTabState(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    initGlobalModalScrollLock();
  }, []);

  // Receipt Modal State & Strict Body Scroll Lock
  const [receiptOpen, setReceiptOpen] = useState(false);
  useBodyScrollLock(receiptOpen);
  const [receiptType, setReceiptType] = useState<ReceiptType>('digital');
  const [saleReceiptData, setSaleReceiptData] = useState<Sale | null>(null);
  const [digitalReceiptData, setDigitalReceiptData] = useState<DigitalTransaction | null>(null);
  const [serviceReceiptData, setServiceReceiptData] = useState<ServiceSoftwareOrder | null>(null);

  // Role Access Guard: Kasir hanya boleh mengakses transaksi & riwayat
  useEffect(() => {
    if (currentRole === 'cashier') {
      const allowedCashierTabs: ActiveTab[] = [
        'digital_finance',
        'sales_history',
      ];
      if (!allowedCashierTabs.includes(activeTab)) {
        setActiveTab('digital_finance');
      }
    }
  }, [currentRole, activeTab]);

  const handlePrintDigital = (tx: DigitalTransaction) => {
    setDigitalReceiptData(tx);
    setReceiptType('digital');
    setReceiptOpen(true);
  };

  const handleReprintSale = (sale: Sale) => {
    setSaleReceiptData(sale);
    setReceiptType('sale');
    setReceiptOpen(true);
  };

  const handlePrintService = (order: ServiceSoftwareOrder) => {
    setServiceReceiptData(order);
    setReceiptType('service');
    setReceiptOpen(true);
  };

  const handleUnlockTerminal = (staff: AppUser) => {
    unlockTerminal(staff);
    // Saat login berhasil, default buka modul Agen Digital
    setActiveTab('digital_finance');
  };

  // If Terminal is Locked & Awaiting Staff Login
  if (isLocked) {
    return <LockScreen onUnlockSuccess={handleUnlockTerminal} />;
  }

  const isDigitalTab = activeTab === 'digital_finance';

  return (
    <div className="bg-[#f8fafc] flex flex-col text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900 w-full max-w-full min-h-screen">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Main Container */}
      <main className={`flex-1 w-full max-w-full ${
        isDigitalTab
          ? 'pt-1.5 sm:pt-2 lg:pt-1.5 pb-2 sm:pb-3 lg:pb-2.5 lg:flex lg:flex-col'
          : 'pt-2 sm:pt-2.5 lg:pt-3 pb-16 lg:pb-12 min-h-[calc(100vh-65px)] lg:min-h-[calc(100vh-125px)]'
      }`}>
        <div key={activeTab} className={`w-full max-w-full ${
          isDigitalTab ? 'lg:flex-1 lg:flex lg:flex-col' : 'tab-transition'
        }`}>
          {activeTab === 'digital_finance' && (
            <DigitalFinanceModule onPrintReceipt={handlePrintDigital} />
          )}

          {activeTab === 'sales_history' && (
            <SalesHistoryModule
              onReprintSale={handleReprintSale}
              onReprintDigital={handlePrintDigital}
              onReprintService={handlePrintService}
            />
          )}

          {activeTab === 'expenses' && <ExpensesModule />}

          {activeTab === 'analytics' && <AnalyticsModule />}

          {activeTab === 'users' && <UserManagementModule />}
        </div>
      </main>

      {/* Footer - Ditampilkan di mobile/tablet dan disembunyikan di desktop saat di tab Agen Digital */}
      {!isDigitalTab ? (
        <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-500 no-print">
          <p>
            Agen BRI Pakde Link &bull; Sistem Transaksi Agen BRILink, Top Up E-Wallet &amp; Pembayaran Digital
          </p>
        </footer>
      ) : (
        <footer className="bg-white border-t border-slate-200 py-2.5 text-center text-[11px] text-slate-500 no-print block lg:hidden">
          <p>
            Agen BRI Pakde Link &bull; Sistem Transaksi Agen BRILink, Top Up E-Wallet &amp; Pembayaran Digital
          </p>
        </footer>
      )}

      {/* Thermal Receipt Modal (58mm / 80mm) */}
      {receiptOpen && (
        <ThermalReceipt
          type={receiptType}
          saleData={saleReceiptData}
          digitalData={digitalReceiptData}
          serviceData={serviceReceiptData}
          onClose={() => setReceiptOpen(false)}
          storeName="Agen BRI Pakde Link"
          storeAddress="Jl Raya Pasar Gunungsari, Ulubelu"
          storePhone="WA: 082281185001"
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
