import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldCheck,
  Plus,
  Trash2,
  KeyRound,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  User,
  RefreshCw,
  X,
  Pencil,
  AlertTriangle,
  ShieldAlert,
  Save,
  Check,
} from 'lucide-react';
import { AppUser, UserRole } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  syncUserToFirestore,
  deleteUserFromFirestore,
  resetLegacyFirestoreUsers,
  subscribeCloudUsers,
  BUILTIN_FALLBACK_USERS,
} from '../services/cloudUserService.ts';
import {
  useBodyScrollLock,
  handleBackdropTouchMove,
  handleBackdropWheel,
  handleModalCardScroll,
} from '../utils/scrollLock.ts';

export const UserManagementModule: React.FC = () => {
  const { currentRole, switchRole } = useAuth();
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State: Add Staff
  const [name, setName] = useState('');
  const [email, setEmail] = useState(''); // Menyimpan ID Karyawan
  const [role, setRole] = useState<UserRole>('cashier');
  const [pin, setPin] = useState(''); // Menyimpan Password
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Modal: Change Staff Password Quick Modal
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [selectedStaffForPin, setSelectedStaffForPin] = useState<AppUser | null>(null);
  const [newPin, setNewPin] = useState('');
  const [updatingPin, setUpdatingPin] = useState(false);

  // Modal: Edit Full User Data
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<AppUser | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('cashier');
  const [editPin, setEditPin] = useState('');
  const [showEditPin, setShowEditPin] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal: Confirm Delete User
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<AppUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Lock body scroll whenever any modal in this module is active
  useBodyScrollLock(pinModalOpen || editModalOpen || deleteModalOpen);

  // Toggle show/hide password in table
  const [showPins, setShowPins] = useState<Record<number, boolean>>({});

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users').catch(() => null);
      if (res && res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          if (list.length > 0) {
            setUsersList(list);
            resetLegacyFirestoreUsers(list).catch(() => {});
            return;
          }
        }
      }
    } catch (err) {
      console.warn('Mode static/cloud untuk daftar pengguna:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let seededFallback = false;
    const unsubCloud = subscribeCloudUsers((cloudUsers) => {
      if (cloudUsers.length > 0) {
        const sorted = [...cloudUsers].sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
        setUsersList(sorted);
        setLoading(false);
      } else if (!seededFallback) {
        seededFallback = true;
        // Jika koleksi Firestore masih kosong, coba ambil dari /api/users lalu seed default jika perlu
        fetch('/api/users')
          .then(async (res) => {
            const contentType = res.headers.get('content-type') || '';
            if (res.ok && contentType.includes('application/json')) {
              const data = await res.json();
              if (Array.isArray(data) && data.length > 0) {
                setUsersList(data);
                resetLegacyFirestoreUsers(data).catch(() => {});
                setLoading(false);
                return;
              }
            }
            setUsersList(BUILTIN_FALLBACK_USERS);
            resetLegacyFirestoreUsers(BUILTIN_FALLBACK_USERS).catch(() => {});
            setLoading(false);
          })
          .catch(() => {
            setUsersList(BUILTIN_FALLBACK_USERS);
            resetLegacyFirestoreUsers(BUILTIN_FALLBACK_USERS).catch(() => {});
            setLoading(false);
          });
      }
    });

    return () => unsubCloud();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      showToast('ID Karyawan dan Nama Karyawan wajib diisi');
      return;
    }
    if (pin.trim().length < 3) {
      showToast('Password minimal 3 karakter');
      return;
    }

    const cleanEmpId = email.trim();
    const cleanPassword = pin.trim();
    const duplicate = usersList.find(
      (u) => String(u.employeeId || u.email || '').trim().toLowerCase() === cleanEmpId.toLowerCase()
    );
    if (duplicate) {
      showToast(`ID Karyawan "${cleanEmpId}" sudah terdaftar`);
      return;
    }

    setSubmitting(true);
    try {
      let apiUser: AppUser | null = null;
      let validationError: string | null = null;

      try {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeId: cleanEmpId,
            email: cleanEmpId,
            name: name.trim(),
            role,
            password: cleanPassword,
            pin: cleanPassword,
          }),
        });

        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          apiUser = await res.json();
        } else if ((res.status === 400 || res.status === 409) && contentType.includes('application/json')) {
          const err = await res.json();
          validationError = err.error || 'Gagal menambahkan karyawan';
        }
      } catch {
        // Fallback ke Cloud Firestore secara langsung saat mode static/publish
      }

      if (validationError) {
        throw new Error(validationError);
      }

      const createdUser: AppUser = apiUser || {
        id: Date.now(),
        uid: `emp-${cleanEmpId}`,
        employeeId: cleanEmpId,
        email: cleanEmpId,
        name: name.trim(),
        role,
        pin: cleanPassword,
        createdAt: new Date().toISOString(),
      };

      // Sinkronkan ke Cloud Firestore
      await syncUserToFirestore(createdUser);

      setUsersList((prev) => {
        const filtered = prev.filter((u) => u.id !== createdUser.id);
        return [...filtered, createdUser];
      });
      setName('');
      setEmail('');
      setPin('');
      showToast('Berhasil menambahkan akun karyawan baru!');
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan');
    } finally {
      setSubmitting(false);
    }
  };

  // Buka Modal Edit Pengguna
  const handleOpenEditModal = (usr: AppUser) => {
    setSelectedUserForEdit(usr);
    setEditEmployeeId(usr.employeeId || usr.email || '');
    setEditName(usr.name);
    setEditRole(usr.role);
    setEditPin(''); // Kosong secara default agar jika tidak diisi tetap mempertahankan password lama
    setShowEditPin(false);
    setEditModalOpen(true);
  };

  // Simpan Perubahan Edit Pengguna
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    if (!editEmployeeId.trim() || !editName.trim()) {
      showToast('ID Karyawan dan Nama Karyawan tidak boleh kosong');
      return;
    }

    if (editPin.trim() !== '' && editPin.trim().length < 3) {
      showToast('Password baru harus minimal 3 karakter');
      return;
    }

    const cleanEmpId = editEmployeeId.trim();
    const duplicate = usersList.find(
      (u) =>
        u.id !== selectedUserForEdit.id &&
        String(u.employeeId || u.email || '').trim().toLowerCase() === cleanEmpId.toLowerCase()
    );
    if (duplicate) {
      showToast(`ID Karyawan "${cleanEmpId}" sudah digunakan karyawan lain`);
      return;
    }

    setSavingEdit(true);
    try {
      const payload: {
        employeeId: string;
        email: string;
        name: string;
        role: UserRole;
        pin?: string;
        password?: string;
      } = {
        employeeId: cleanEmpId,
        email: cleanEmpId,
        name: editName.trim(),
        role: editRole,
      };

      if (editPin.trim() !== '') {
        payload.pin = editPin.trim();
        payload.password = editPin.trim();
      }

      let apiUpdated: AppUser | null = null;
      let validationError: string | null = null;

      try {
        const res = await fetch(`/api/users/${selectedUserForEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          apiUpdated = await res.json();
        } else if ((res.status === 400 || res.status === 409) && contentType.includes('application/json')) {
          const err = await res.json();
          validationError = err.error || 'Gagal memperbarui data karyawan';
        }
      } catch {
        // Fallback ke Cloud Firestore secara langsung saat mode static/publish
      }

      if (validationError) {
        throw new Error(validationError);
      }

      const updatedUser: AppUser = apiUpdated || {
        ...selectedUserForEdit,
        employeeId: cleanEmpId,
        email: cleanEmpId,
        name: editName.trim(),
        role: editRole,
        pin: editPin.trim() !== '' ? editPin.trim() : selectedUserForEdit.pin,
      };

      // Sinkronkan ke Cloud Firestore secara real-time
      await syncUserToFirestore(updatedUser);

      // Perbarui state lokal
      setUsersList((prev) =>
        prev.map((u) => (u.id === selectedUserForEdit.id ? updatedUser : u))
      );

      setEditModalOpen(false);
      setSelectedUserForEdit(null);
      showToast(`Data karyawan "${updatedUser.name}" berhasil diperbarui!`);
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan perubahan karyawan');
    } finally {
      setSavingEdit(false);
    }
  };

  // Buka Modal Konfirmasi Hapus
  const handleOpenDeleteModal = (usr: AppUser) => {
    setSelectedUserForDelete(usr);
    setDeleteModalOpen(true);
  };

  // Konfirmasi Eksekusi Hapus
  const handleConfirmDeleteUser = async () => {
    if (!selectedUserForDelete) return;

    // Validasi pengaman: Akun Owner tidak boleh dihapus
    if (selectedUserForDelete.role === 'owner') {
      showToast('Akun Pemilik Utama (Owner) dilindungi dan tidak dapat dihapus');
      return;
    }

    setDeletingUser(true);
    try {
      let validationError: string | null = null;
      try {
        const res = await fetch(`/api/users/${selectedUserForDelete.id}`, {
          method: 'DELETE',
        });
        const contentType = res.headers.get('content-type') || '';
        if ((res.status === 400 || res.status === 403) && contentType.includes('application/json')) {
          const err = await res.json();
          validationError = err.error || 'Gagal menghapus pengguna';
        }
      } catch {
        // Fallback ke Cloud Firestore secara langsung saat mode static/publish
      }

      if (validationError) {
        throw new Error(validationError);
      }

      // Hapus dari Cloud Firestore
      await deleteUserFromFirestore(selectedUserForDelete.id);

      // Perbarui state lokal
      setUsersList((prev) => prev.filter((u) => u.id !== selectedUserForDelete.id));
      setDeleteModalOpen(false);
      showToast(`Akun staf "${selectedUserForDelete.name}" berhasil dihapus dari sistem`);
      setSelectedUserForDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus pengguna');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleOpenPinModal = (usr: AppUser) => {
    setSelectedStaffForPin(usr);
    setNewPin(usr.pin || '');
    setPinModalOpen(true);
  };

  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForPin) return;
    if (newPin.trim().length < 3) {
      showToast('Password harus minimal 3 karakter');
      return;
    }

    setUpdatingPin(true);
    try {
      const cleanPwd = newPin.trim();
      let validationError: string | null = null;
      try {
        const res = await fetch(`/api/users/${selectedStaffForPin.id}/pin`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: cleanPwd, pin: cleanPwd }),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 400 && contentType.includes('application/json')) {
          const err = await res.json();
          validationError = err.error || 'Gagal mengubah password';
        }
      } catch {
        // Fallback ke Cloud Firestore secara langsung saat mode static/publish
      }

      if (validationError) {
        throw new Error(validationError);
      }

      const updatedUser: AppUser = {
        ...selectedStaffForPin,
        pin: cleanPwd,
      };

      // Sinkronkan ke Cloud Firestore
      await syncUserToFirestore(updatedUser);

      setUsersList((prev) =>
        prev.map((u) => (u.id === selectedStaffForPin.id ? updatedUser : u))
      );
      setPinModalOpen(false);
      showToast(`Password ${selectedStaffForPin.name} berhasil diperbarui!`);
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui password');
    } finally {
      setUpdatingPin(false);
    }
  };

  const toggleShowPin = (id: number) => {
    setShowPins((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const roleInfo: Record<
    UserRole,
    { label: string; badge: string; color: string; desc: string }
  > = {
    owner: {
      label: 'Owner / Pemilik',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      color: 'text-purple-600',
      desc: 'Akses penuh ke semua modul, laporan laba bersih, manajemen user, dan kontrol saldo.',
    },
    manager: {
      label: 'Kepala Toko / Manager',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      color: 'text-blue-600',
      desc: 'Akses beban pengeluaran, ringkasan kas, laporan keuangan, dan transaksi agen digital.',
    },
    cashier: {
      label: 'Kasir / Frontliner',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      color: 'text-emerald-600',
      desc: 'Transaksi agen BRILink, top-up e-wallet, tarik tunai, PPOB, riwayat & cetak struk.',
    },
    technician: {
      label: 'Teknisi Software HP',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      color: 'text-amber-600',
      desc: 'Akses terbatas untuk layanan teknis dan operasional shift.',
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-1 sm:pt-1.5 pb-6 sm:pb-8 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-white text-slate-800 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold border border-slate-200 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-lg">
              Manajemen Pengguna & Pembagian Role (RBAC)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Atur hak akses staf toko (Owner, Kepala Toko, Kasir, dan Teknisi) untuk melindungi privasi laba margin HPP dan keamanan operasional terminal POS.
          </p>
        </div>

        {/* Live Simulator Role Switcher */}
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 border border-slate-200 text-xs">
          <span className="text-slate-500 font-medium">Mode Simulasi:</span>
          <select
            value={currentRole}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="font-bold text-xs bg-white py-1 px-2.5 rounded-lg border border-slate-300 text-indigo-700 focus:outline-none"
          >
            <option value="owner">👑 Owner (Akses Penuh)</option>
            <option value="manager">👔 Kepala Toko</option>
            <option value="cashier">🛒 Kasir (HPP Tersembunyi)</option>
            <option value="technician">🔧 Teknisi Software</option>
          </select>
        </div>
      </div>

      {/* Role Cards Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(roleInfo) as UserRole[]).map((r) => {
          const info = roleInfo[r];
          const isCurrent = currentRole === r;
          return (
            <div
              key={r}
              className={`p-4 rounded-2xl border transition relative ${
                isCurrent
                  ? 'bg-indigo-50/50 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${info.badge}`}>
                  {info.label}
                </span>
                {isCurrent && (
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">{info.desc}</p>
              <button
                onClick={() => switchRole(r)}
                className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              >
                Uji Coba Shift Sebagai Ini
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Tambah Staff Baru (4 cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-sm pb-2 border-b border-slate-100 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>Tambah Akun Staff / Karyawan</span>
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ID Karyawan
                </label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Contoh: 151500"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nama Karyawan
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Roni Jaswoko"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pilih Role / Jabatan
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 bg-white font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                >
                  <option value="cashier">Kasir / Frontliner</option>
                  <option value="technician">Teknisi Software HP</option>
                  <option value="manager">Kepala Toko / Manager</option>
                  <option value="owner">Owner (Super Admin)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Password
                </label>
                <input
                  type="text"
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Contoh: 8888 atau 9999"
                  className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 font-mono tracking-wider text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Password digunakan karyawan bersama ID Karyawan saat login.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 space-y-1">
                <div className="font-semibold text-slate-700">Catatan Keamanan:</div>
                <div>• Kasir hanya dapat mengakses modul transaksi &amp; riwayat.</div>
                <div>• Hanya Owner yang dapat mengelola pengguna &amp; edit saldo akun.</div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Akun Karyawan</span>
              </button>
            </form>
          </div>
        </div>

        {/* Tabel & Daftar Pengguna (8 cols) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Daftar Staf & Hak Akses Aktif ({usersList.length})
                </h3>
              </div>
              <button
                onClick={loadUsers}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Segarkan daftar"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Mobile View: Stacked Card Layout */}
            <div className="md:hidden space-y-3">
              {loading ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Memuat data pengguna...
                </div>
              ) : usersList.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Belum ada karyawan terdaftar
                </div>
              ) : (
                usersList.map((usr) => (
                  <div
                    key={usr.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {usr.name.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{usr.name}</div>
                          <div className="text-xs text-slate-500 font-mono font-medium">
                            ID: {usr.employeeId || usr.email}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          roleInfo[usr.role]?.badge || 'bg-slate-100'
                        }`}
                      >
                        {roleInfo[usr.role]?.label || usr.role}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">Password:</span>
                        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
                          {showPins[usr.id] ? usr.pin : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleShowPin(usr.id)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                          title={showPins[usr.id] ? 'Sembunyikan Password' : 'Lihat Password'}
                        >
                          {showPins[usr.id] ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {usr.role === 'owner' ? (
                        <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200 font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Pemilik
                        </span>
                      ) : null}
                    </div>

                    {/* Tombol Aksi Mobile */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleOpenEditModal(usr)}
                        className="py-1.5 px-3 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Data</span>
                      </button>

                      <button
                        onClick={() => handleOpenDeleteModal(usr)}
                        disabled={usr.role === 'owner'}
                        className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                          usr.role === 'owner'
                            ? 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                        }`}
                        title={usr.role === 'owner' ? 'Akun Pemilik Utama dilindungi' : 'Hapus Karyawan'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View: Clean Table Layout */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">ID Karyawan</th>
                    <th className="px-3 py-3">Nama Karyawan</th>
                    <th className="px-3 py-3">Role Akses</th>
                    <th className="px-3 py-3">Password</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        Memuat data pengguna...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        Belum ada karyawan terdaftar
                      </td>
                    </tr>
                  ) : (
                    usersList.map((usr) => (
                      <tr key={usr.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {usr.employeeId || usr.email}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-slate-900">{usr.name}</div>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              roleInfo[usr.role]?.badge || 'bg-slate-100'
                            }`}
                          >
                            {roleInfo[usr.role]?.label || usr.role}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="text-slate-800 font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              {showPins[usr.id] ? usr.pin : '••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleShowPin(usr.id)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                              title={showPins[usr.id] ? 'Sembunyikan Password' : 'Lihat Password'}
                            >
                              {showPins[usr.id] ? (
                                <EyeOff className="w-3.5 h-3.5" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenPinModal(usr)}
                              className="text-indigo-600 hover:text-indigo-800 p-0.5 cursor-pointer ml-0.5"
                              title="Ganti Cepat Password"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            {/* Tombol Edit Pengguna */}
                            <button
                              onClick={() => handleOpenEditModal(usr)}
                              title="Edit Data & Ganti Password"
                              className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Tombol Hapus Pengguna */}
                            {usr.role === 'owner' ? (
                              <button
                                disabled
                                title="Akun Pemilik Utama dilindungi dan tidak dapat dihapus"
                                className="p-1.5 rounded-lg text-slate-300 cursor-not-allowed opacity-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenDeleteModal(usr)}
                                title="Hapus Karyawan"
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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

      {/* Modal Edit Pengguna (Nama, Role, PIN Baru) */}
      {editModalOpen && selectedUserForEdit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', overscrollBehavior: 'contain' }}
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] sm:max-h-[88vh] border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden my-auto"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {/* Header (Pinned) */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">
                    Edit Data & Hak Akses Pengguna
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ID Karyawan: {selectedUserForEdit.employeeId || selectedUserForEdit.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="flex flex-col flex-1 min-h-0">
              {/* Scrollable Form Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* ID Karyawan */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ID Karyawan
                  </label>
                  <input
                    type="text"
                    required
                    value={editEmployeeId}
                    onChange={(e) => setEditEmployeeId(e.target.value)}
                    placeholder="Contoh: 151500"
                    className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-200 font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Nama Karyawan */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nama Karyawan
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Contoh: Roni Jaswoko"
                    className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Role / Hak Akses */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Role / Tingkat Akses
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full text-xs py-2.5 px-3 rounded-xl border border-slate-200 bg-white font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="owner">👑 Owner / Pemilik (Akses Penuh)</option>
                    <option value="manager">👔 Kepala Toko / Manager</option>
                    <option value="cashier">🛒 Kasir / Frontliner</option>
                    <option value="technician">🔧 Teknisi Software HP</option>
                  </select>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {roleInfo[editRole]?.desc}
                  </span>
                </div>

                {/* Ganti Password Baru */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Password Baru
                    </label>
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      Opsional
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showEditPin ? 'text' : 'password'}
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value)}
                      placeholder="Kosongkan jika tetap password lama"
                      className="w-full text-xs py-2.5 pl-3 pr-10 rounded-xl border border-slate-200 font-mono tracking-wider focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPin(!showEditPin)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title={showEditPin ? 'Sembunyikan Password' : 'Tampilkan Password'}
                    >
                      {showEditPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                    💡 <em>Kosongkan jika tidak ingin mengubah password saat ini.</em> Jika diisi, minimal 3 karakter.
                  </p>
                </div>
              </div>

              {/* Action Buttons (Pinned at bottom) */}
              <div className="shrink-0 p-4 sm:p-5 pt-3 border-t border-slate-100 bg-white flex justify-end items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Pengguna */}
      {deleteModalOpen && selectedUserForDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', overscrollBehavior: 'contain' }}
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full max-h-[90vh] sm:max-h-[88vh] overflow-y-auto p-6 border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200 my-auto"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            {selectedUserForDelete.role === 'owner' ? (
              // Tampilan Akun Owner Terlindungi
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 border border-purple-200 text-purple-700 mx-auto flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Akun Pemilik Utama Dilindungi
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Akun <strong>{selectedUserForDelete.name}</strong> memiliki hak akses sebagai <strong>Owner</strong>. Demi keamanan dan integritas sistem, akun Owner tidak dapat dihapus.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            ) : (
              // Tampilan Konfirmasi Hapus Staf Reguler
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Hapus Akun Karyawan?
                    </h3>
                    <p className="text-xs text-slate-500">
                      Konfirmasi penghapusan akses karyawan toko
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">ID Karyawan:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {selectedUserForDelete.employeeId || selectedUserForDelete.email}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama Karyawan:</span>
                    <span className="font-semibold text-slate-800">{selectedUserForDelete.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Role:</span>
                    <span className="font-semibold text-indigo-700 capitalize">
                      {roleInfo[selectedUserForDelete.role]?.label || selectedUserForDelete.role}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-rose-600 leading-relaxed">
                  ⚠️ Tindakan ini permanen. Akun karyawan ini tidak akan dapat login ke sistem lagi.
                </p>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(false)}
                    disabled={deletingUser}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteUser}
                    disabled={deletingUser}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition disabled:opacity-50"
                  >
                    {deletingUser ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Menghapus...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Karyawan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Ubah Password Cepat */}
      {pinModalOpen && selectedStaffForPin && (
        <div 
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
          style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', overscrollBehavior: 'contain' }}
          onTouchMove={handleBackdropTouchMove}
          onWheel={handleBackdropWheel}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full max-h-[90vh] sm:max-h-[88vh] overflow-y-auto p-5 border border-slate-200 text-slate-900 animate-in zoom-in-95 duration-200 my-auto"
            onTouchMove={handleModalCardScroll}
            onWheel={handleModalCardScroll}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-800">
                  Ubah Password Karyawan
                </h3>
              </div>
              <button
                onClick={() => setPinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 my-3">
              Ubah password login untuk <strong>{selectedStaffForPin.name}</strong> (ID: <span className="font-mono">{selectedStaffForPin.employeeId || selectedStaffForPin.email}</span>).
            </p>

            <form onSubmit={handleSaveNewPin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Password Baru
                </label>
                <input
                  type="text"
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="Masukkan password baru"
                  className="w-full text-center text-lg font-mono font-bold tracking-widest py-2 px-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPinModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updatingPin}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer disabled:opacity-50"
                >
                  {updatingPin ? 'Menyimpan...' : 'Simpan Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
