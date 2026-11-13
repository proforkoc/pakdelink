import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { AppUser } from '../types/index.ts';

export const USERS_COLLECTION = 'users';

function isPermissionDeniedError(err: unknown): boolean {
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return code.includes('permission-denied') || msg.includes('missing or insufficient permissions');
}

const LEGACY_MOCK_UIDS = new Set([
  'owner-default-001',
  'owner-gunungsari-google',
  'cashier-default-002',
  'manager-default-003',
  'tech-default-004',
]);

const LEGACY_MOCK_EMAILS = new Set([
  'owner@konterpos.id',
  'gunungsarientertainer@gmail.com',
  'kasir@konterpos.id',
  'manager@konterpos.id',
  'teknisi@konterpos.id',
]);

export const BUILTIN_FALLBACK_USERS: AppUser[] = [
  {
    id: 1,
    uid: 'emp-151500',
    employeeId: '151500',
    email: '151500',
    name: 'Roni Jaswoko',
    role: 'owner',
    pin: '8888',
  },
  {
    id: 2,
    uid: 'emp-151501',
    employeeId: '151501',
    email: '151501',
    name: 'Bella Heartfire',
    role: 'cashier',
    pin: '9999',
  },
];

function isLegacyMockRecord(data: { uid?: string; email?: string; employeeId?: string }): boolean {
  const uid = String(data.uid || '').trim().toLowerCase();
  const email = String(data.email || '').trim().toLowerCase();
  return LEGACY_MOCK_UIDS.has(uid) || LEGACY_MOCK_EMAILS.has(email);
}

/**
 * Sinkronisasi data pengguna ke Cloud Firestore
 */
export async function syncUserToFirestore(user: AppUser): Promise<void> {
  try {
    const empId = String(user.employeeId || user.email || '').trim();
    const userDocRef = doc(db, USERS_COLLECTION, String(user.id));
    await setDoc(
      userDocRef,
      {
        id: user.id,
        uid: user.uid,
        employeeId: empId,
        email: empId,
        name: user.name,
        role: user.role,
        pin: user.pin || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.WRITE, `${USERS_COLLECTION}/${user.id}`);
    }
    console.warn('Firestore sync user warning (offline/cached):', err);
  }
}

/**
 * Bersihkan akun mock lama dari Cloud Firestore & sinkronkan daftar akun terbaru
 */
export async function resetLegacyFirestoreUsers(activeUsers: AppUser[]): Promise<void> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);

    const activeIds = new Set(activeUsers.map((u) => String(u.id)));
    const deletions: Promise<void>[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (isLegacyMockRecord(data) && !activeIds.has(docSnap.id)) {
        deletions.push(deleteDoc(doc(db, USERS_COLLECTION, docSnap.id)));
      } else if (isLegacyMockRecord(data) && activeIds.has(docSnap.id)) {
        // Will be overwritten below by activeUsers
      }
    });

    await Promise.all(deletions);
    await Promise.all(activeUsers.map((u) => syncUserToFirestore(u)));
  } catch (err) {
    console.warn('Firestore legacy user cleanup warning:', err);
  }
}

/**
 * Hapus pengguna dari Cloud Firestore
 */
export async function deleteUserFromFirestore(userId: number): Promise<void> {
  try {
    const userDocRef = doc(db, USERS_COLLECTION, String(userId));
    await deleteDoc(userDocRef);
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      handleFirestoreError(err, OperationType.DELETE, `${USERS_COLLECTION}/${userId}`);
    }
    console.warn('Firestore delete user warning:', err);
  }
}

/**
 * Berlangganan perubahan real-time koleksi pengguna di Cloud Firestore
 */
export function subscribeCloudUsers(
  onUpdate: (cloudUsers: AppUser[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const usersRef = collection(db, USERS_COLLECTION);
  return onSnapshot(
    usersRef,
    (snapshot) => {
      const list: AppUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (isLegacyMockRecord(data)) return;
        const empId = String(data.employeeId || data.email || '').trim();
        list.push({
          id: Number(data.id || d.id),
          uid: data.uid || '',
          employeeId: empId,
          email: empId,
          name: data.name || '',
          role: data.role || 'cashier',
          pin: data.pin ? String(data.pin).trim() : '',
          createdAt: data.createdAt || data.updatedAt,
        });
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore user subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Verifikasi login menggunakan ID Karyawan dan Password melalui Cloud Firestore
 * sebagai fallback hybrid jika backend PostgreSQL tidak dapat diakses.
 */
export async function authenticateWithFirestore(
  identifier: string,
  secret: string
): Promise<{ success: boolean; user?: AppUser; message?: string }> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanSecret = secret.trim();

  if (!cleanId || !cleanSecret) {
    return { success: false, message: 'ID Karyawan dan password wajib diisi.' };
  }

  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(usersRef);

    if (!snap.empty) {
      const cloudUsers: AppUser[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (isLegacyMockRecord(data)) return;
        const empId = String(data.employeeId || data.email || '').trim();
        cloudUsers.push({
          id: Number(data.id || docSnap.id),
          uid: data.uid || '',
          employeeId: empId,
          email: empId,
          name: data.name || '',
          role: data.role || 'cashier',
          pin: data.pin ? String(data.pin).trim() : '',
          createdAt: data.createdAt || data.updatedAt,
        });
      });

      if (cloudUsers.length > 0) {
        const matchedUser = cloudUsers.find(
          (u) => String(u.employeeId || u.email || '').trim().toLowerCase() === cleanId
        );
        if (!matchedUser) {
          return { success: false, message: 'ID Karyawan atau password salah' };
        }

        const expectedPassword = String(matchedUser.pin || '').trim();
        if (expectedPassword.length > 0 && cleanSecret === expectedPassword) {
          return { success: true, user: matchedUser };
        }

        return { success: false, message: 'ID Karyawan atau password salah' };
      }
    }
  } catch (error: any) {
    console.warn('Firestore fetch user warning:', error);
  }

  // Fallback jika koleksi Firestore kosong / hanya berisi data lama / offline:
  // cocokkan ketat berdasarkan ID Karyawan & Password terdaftar.
  const matchedDefault = BUILTIN_FALLBACK_USERS.find(
    (u) => String(u.employeeId || u.email || '').trim().toLowerCase() === cleanId
  );
  if (matchedDefault && matchedDefault.pin && cleanSecret === matchedDefault.pin) {
    return { success: true, user: matchedDefault };
  }

  return { success: false, message: 'ID Karyawan atau password salah' };
}
