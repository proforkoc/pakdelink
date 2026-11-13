import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { UserRole, AppUser } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  operatorName: string;
  setOperatorName: (name: string) => void;
  currentRole: UserRole;
  switchRole: (role: UserRole) => void;
  // Terminal Lock / Shift Management
  isLocked: boolean;
  activeStaff: AppUser | null;
  unlockTerminal: (staff: AppUser) => void;
  lockTerminal: () => void;
  // Permissions
  canViewCostPrice: boolean;
  canViewAnalytics: boolean;
  canManageInventory: boolean;
  canManageUsers: boolean;
  canManageExpenses: boolean;
  canAccessServiceDesk: boolean;
  canAccessPOS: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  operatorName: 'Kasir Utama',
  setOperatorName: () => {},
  currentRole: 'cashier',
  switchRole: () => {},
  isLocked: true,
  activeStaff: null,
  unlockTerminal: () => {},
  lockTerminal: () => {},
  canViewCostPrice: false,
  canViewAnalytics: false,
  canManageInventory: false,
  canManageUsers: false,
  canManageExpenses: false,
  canAccessServiceDesk: false,
  canAccessPOS: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const isLegacyStoredStaff = (staff: any): boolean => {
    if (!staff) return false;
    const legacyUids = ['owner-default-001', 'owner-gunungsari-google', 'cashier-default-002', 'manager-default-003', 'tech-default-004'];
    const legacyEmails = ['owner@konterpos.id', 'gunungsarientertainer@gmail.com', 'kasir@konterpos.id', 'manager@konterpos.id', 'teknisi@konterpos.id'];
    return legacyUids.includes(String(staff.uid || '').toLowerCase()) || legacyEmails.includes(String(staff.email || '').toLowerCase());
  };

  // Terminal Lockscreen State
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const saved = localStorage.getItem('konter_active_staff');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (isLegacyStoredStaff(parsed)) {
          sessionStorage.removeItem('konter_terminal_unlocked');
          localStorage.removeItem('konter_active_staff');
          localStorage.removeItem('konter_user_role');
          return true;
        }
      } catch {
        // ignore
      }
    }
    return sessionStorage.getItem('konter_terminal_unlocked') !== 'true';
  });

  const [activeStaff, setActiveStaff] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('konter_active_staff');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (isLegacyStoredStaff(parsed)) return null;
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    return (localStorage.getItem('konter_user_role') as UserRole) || 'cashier';
  });

  const [customOperator, setCustomOperator] = useState<string>(() => {
    return localStorage.getItem('konter_operator_name') || 'Bella Heartfire';
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      setLoading(false);

      if (currentUser) {
        try {
          // Sync with PostgreSQL backend
          const res = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: currentUser.uid,
              email: currentUser.email,
              name: currentUser.displayName || 'Roni Jaswoko',
            }),
          });
          const dbUser = await res.json();
          if (dbUser?.role) {
            setCurrentRole(dbUser.role);
            localStorage.setItem('konter_user_role', dbUser.role);
            unlockTerminal(dbUser);
          } else {
            unlockTerminal({
              id: 1,
              uid: currentUser.uid,
              employeeId: '151500',
              email: currentUser.email || '151500',
              name: currentUser.displayName || 'Roni Jaswoko',
              role: 'owner',
            });
          }
        } catch {
          unlockTerminal({
            id: 1,
            uid: currentUser.uid,
            employeeId: '151500',
            email: currentUser.email || '151500',
            name: currentUser.displayName || 'Roni Jaswoko',
            role: 'owner',
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: any) {
      if (err?.code === 'auth/popup-blocked') {
        throw new Error('Popup login Google diblokir browser. Harap izinkan popup atau gunakan tombol Akses Cepat di bawah.');
      }
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        throw new Error('Jendela login Google ditutup sebelum selesai.');
      }
      console.warn('Google Sign-in info:', err?.message || err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      lockTerminal();
    } catch (err: any) {
      console.warn('Sign-out info:', err?.message || err);
    }
  };

  const unlockTerminal = (staff: AppUser) => {
    if (!staff || !staff.role) return;
    const validRoles: UserRole[] = ['owner', 'manager', 'cashier', 'technician'];
    const safeRole: UserRole = validRoles.includes(staff.role) ? staff.role : 'cashier';
    const { pin: _pin, ...staffWithoutPin } = staff;
    const sanitizedStaff: AppUser = { ...staffWithoutPin, role: safeRole };

    setActiveStaff(sanitizedStaff);
    setCurrentRole(safeRole);
    setCustomOperator(sanitizedStaff.name);
    setIsLocked(false);
    sessionStorage.setItem('konter_terminal_unlocked', 'true');
    localStorage.setItem('konter_user_role', safeRole);
    localStorage.setItem('konter_operator_name', sanitizedStaff.name);
    localStorage.setItem('konter_active_staff', JSON.stringify(sanitizedStaff));
  };

  const lockTerminal = () => {
    setIsLocked(true);
    setActiveStaff(null);
    setCurrentRole('cashier');
    sessionStorage.removeItem('konter_terminal_unlocked');
    localStorage.removeItem('konter_active_staff');
    localStorage.removeItem('konter_user_role');
  };

  const setOperatorName = (name: string) => {
    setCustomOperator(name);
    localStorage.setItem('konter_operator_name', name);
  };

  const switchRole = (role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem('konter_user_role', role);

    if (!user) {
      if (role === 'owner') setOperatorName('Roni Jaswoko');
      else if (role === 'manager') setOperatorName('Kepala Toko');
      else if (role === 'cashier') setOperatorName('Bella Heartfire');
      else if (role === 'technician') setOperatorName('Teknisi');
    }
  };

  const operatorName = user?.displayName || user?.email?.split('@')[0] || customOperator;

  // RBAC Permission Gates
  const canViewCostPrice = currentRole === 'owner' || currentRole === 'manager';
  const canViewAnalytics = currentRole === 'owner' || currentRole === 'manager';
  const canManageInventory = currentRole === 'owner' || currentRole === 'manager';
  const canManageUsers = currentRole === 'owner';
  const canManageExpenses = currentRole === 'owner' || currentRole === 'manager';
  const canAccessServiceDesk = currentRole === 'owner' || currentRole === 'manager' || currentRole === 'technician';
  const canAccessPOS = currentRole === 'owner' || currentRole === 'manager' || currentRole === 'cashier';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signOut,
        operatorName,
        setOperatorName,
        currentRole,
        switchRole,
        isLocked,
        activeStaff,
        unlockTerminal,
        lockTerminal,
        canViewCostPrice,
        canViewAnalytics,
        canManageInventory,
        canManageUsers,
        canManageExpenses,
        canAccessServiceDesk,
        canAccessPOS,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
