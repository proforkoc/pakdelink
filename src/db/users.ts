import { db, isPostgresConfigured } from './index.ts';
import { users } from './schema.ts';
import { eq, desc, inArray } from 'drizzle-orm';
import { memoryStore, MemoryUser } from './memoryStore.ts';

export const DEFAULT_STAFF_USERS = [
  {
    uid: 'emp-151500',
    email: '151500',
    name: 'Roni Jaswoko',
    role: 'owner',
    pin: '8888',
  },
  {
    uid: 'emp-151501',
    email: '151501',
    name: 'Bella Heartfire',
    role: 'cashier',
    pin: '9999',
  },
];

const LEGACY_MOCK_UIDS = [
  'owner-default-001',
  'owner-gunungsari-google',
  'cashier-default-002',
  'manager-default-003',
  'tech-default-004',
];

const LEGACY_MOCK_EMAILS = [
  'owner@konterpos.id',
  'gunungsarientertainer@gmail.com',
  'kasir@konterpos.id',
  'manager@konterpos.id',
  'teknisi@konterpos.id',
];

function mapUserRecord<T extends { uid: string; email: string; employeeId?: string }>(u: T): T & { employeeId: string } {
  return {
    ...u,
    employeeId: u.employeeId || u.email,
  };
}

let legacyCleaned = false;

export async function ensureDefaultUsers() {
  if (!isPostgresConfigured()) {
    return memoryStore.users.map(mapUserRecord);
  }
  try {
    if (!legacyCleaned) {
      await db.delete(users).where(inArray(users.uid, LEGACY_MOCK_UIDS)).catch(() => {});
      await db.delete(users).where(inArray(users.email, LEGACY_MOCK_EMAILS)).catch(() => {});
      const existingOwner = await db.select().from(users).where(eq(users.uid, 'emp-151500'));
      if (existingOwner.length > 0 && existingOwner[0].pin === '888') {
        await db.update(users).set({ pin: '8888' }).where(eq(users.uid, 'emp-151500'));
      }
      legacyCleaned = true;
    }

    const existing = await db.select().from(users);
    const hasDefaultOwner = existing.some((u) => u.uid === 'emp-151500' || u.email === '151500');
    const hasDefaultKasir = existing.some((u) => u.uid === 'emp-151501' || u.email === '151501');
    if (existing.length === 0 || (!hasDefaultOwner && !hasDefaultKasir)) {
      for (const u of DEFAULT_STAFF_USERS) {
        await db.insert(users).values(u).onConflictDoNothing();
      }
      const seeded = await db.select().from(users);
      return seeded.map(mapUserRecord);
    }
    return existing.map(mapUserRecord);
  } catch (err) {
    console.warn('Could not auto-seed users in PostgreSQL:', err);
    return memoryStore.users.map(mapUserRecord);
  }
}

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!isPostgresConfigured()) {
    const existing = memoryStore.users.find(
      (u) => u.uid === uid || u.employeeId.toLowerCase() === cleanEmail || u.email.toLowerCase() === cleanEmail
    );
    if (existing) {
      if (name && !existing.name) existing.name = name;
      return mapUserRecord(existing);
    }
    const hasOwner = memoryStore.users.some((u) => u.role === 'owner');
    const assignedRole = memoryStore.users.length === 0 || !hasOwner ? 'owner' : 'cashier';
    const newUser: MemoryUser = {
      id: memoryStore.getNextId(),
      uid,
      employeeId: email,
      email,
      name: name || 'Karyawan',
      role: assignedRole,
      pin: assignedRole === 'owner' ? '8888' : '9999',
      createdAt: new Date(),
    };
    memoryStore.users.push(newUser);
    return mapUserRecord(newUser);
  }

  try {
    let existing = await ensureDefaultUsers();
    const matchedExisting = existing.find(
      (u) => u.uid === uid || u.email.toLowerCase() === cleanEmail
    );
    if (matchedExisting) {
      return mapUserRecord(matchedExisting);
    }

    const hasOwner = existing.some((u) => u.role === 'owner');
    const assignedRole = existing.length === 0 || !hasOwner ? 'owner' : 'cashier';

    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        name: name || 'Karyawan',
        role: assignedRole,
        pin: assignedRole === 'owner' ? '8888' : '9999',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
        },
      })
      .returning();

    return mapUserRecord(result[0]);
  } catch {
    return mapUserRecord(memoryStore.users[0]);
  }
}

export async function getAllUsers() {
  if (!isPostgresConfigured()) {
    return memoryStore.users.map(mapUserRecord);
  }
  try {
    if (!legacyCleaned) {
      await ensureDefaultUsers();
    }
    let list = await db.select().from(users).orderBy(desc(users.id));
    if (list.length === 0) {
      list = await ensureDefaultUsers();
    }
    return list.map(mapUserRecord);
  } catch (error) {
    console.warn('DB not reachable in getAllUsers, using memoryStore:', error);
    return memoryStore.users.map(mapUserRecord);
  }
}

export async function createUser(data: {
  employeeId?: string;
  email: string;
  name: string;
  role: string;
  pin?: string;
}) {
  const cleanEmployeeId = String(data.employeeId || data.email || '').trim();
  const cleanName = String(data.name || '').trim();
  const cleanPin = String(data.pin || '').trim();
  const syntheticUid = `emp-${cleanEmployeeId}-${Date.now()}`;

  if (!cleanEmployeeId || !cleanName || !cleanPin) {
    throw new Error('ID Karyawan, Nama Karyawan, dan Password wajib diisi');
  }

  if (!isPostgresConfigured()) {
    const duplicate = memoryStore.users.find(
      (u) => u.employeeId.toLowerCase() === cleanEmployeeId.toLowerCase() || u.email.toLowerCase() === cleanEmployeeId.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`ID Karyawan "${cleanEmployeeId}" sudah terdaftar`);
    }

    const newUser: MemoryUser = {
      id: memoryStore.getNextId(),
      uid: syntheticUid,
      employeeId: cleanEmployeeId,
      email: cleanEmployeeId,
      name: cleanName,
      role: data.role || 'cashier',
      pin: cleanPin,
      createdAt: new Date(),
    };
    memoryStore.users.push(newUser);
    return mapUserRecord(newUser);
  }

  try {
    const existingList = await getAllUsers();
    const duplicate = existingList.find(
      (u) => u.employeeId.toLowerCase() === cleanEmployeeId.toLowerCase() || u.email.toLowerCase() === cleanEmployeeId.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`ID Karyawan "${cleanEmployeeId}" sudah terdaftar`);
    }

    const [created] = await db
      .insert(users)
      .values({
        uid: syntheticUid,
        email: cleanEmployeeId,
        name: cleanName,
        role: data.role || 'cashier',
        pin: cleanPin,
      })
      .returning();

    return mapUserRecord(created);
  } catch (error: any) {
    if (error?.message?.includes('sudah terdaftar')) {
      throw error;
    }
    console.error('Failed to create user in DB, saving to memory store:', error);
    const newUser: MemoryUser = {
      id: memoryStore.getNextId(),
      uid: syntheticUid,
      employeeId: cleanEmployeeId,
      email: cleanEmployeeId,
      name: cleanName,
      role: data.role || 'cashier',
      pin: cleanPin,
      createdAt: new Date(),
    };
    memoryStore.users.push(newUser);
    return mapUserRecord(newUser);
  }
}

export async function verifyUserPin(userId: number, pin: string) {
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) {
    return { success: false, message: 'ID Karyawan atau password salah' };
  }

  if (!isPostgresConfigured()) {
    const user = memoryStore.users.find((u) => u.id === userId);
    if (!user) return { success: false, message: 'Pengguna tidak ditemukan' };
    if (Boolean(user.pin) && String(user.pin).trim() === cleanPin) {
      return { success: true, user: mapUserRecord(user) };
    }
    return { success: false, message: 'ID Karyawan atau password salah' };
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return { success: false, message: 'Pengguna tidak ditemukan' };
    if (Boolean(user.pin) && String(user.pin).trim() === cleanPin) {
      return { success: true, user: mapUserRecord(user) };
    }
    return { success: false, message: 'ID Karyawan atau password salah' };
  } catch (error) {
    console.warn('DB error in verifyUserPin, checking memory store:', error);
    const user = memoryStore.users.find((u) => u.id === userId);
    if (user && Boolean(user.pin) && String(user.pin).trim() === cleanPin) {
      return { success: true, user: mapUserRecord(user) };
    }
    return { success: false, message: 'ID Karyawan atau password salah' };
  }
}

export async function updateUserPin(userId: number, pin: string) {
  const cleanPin = String(pin || '').trim();
  if (!isPostgresConfigured()) {
    const user = memoryStore.users.find((u) => u.id === userId);
    if (user) user.pin = cleanPin;
    return user ? mapUserRecord(user) : null;
  }

  try {
    const [updated] = await db
      .update(users)
      .set({ pin: cleanPin })
      .where(eq(users.id, userId))
      .returning();
    return updated ? mapUserRecord(updated) : null;
  } catch (error) {
    console.warn('Failed to update password in DB, updating memory store:', error);
    const user = memoryStore.users.find((u) => u.id === userId);
    if (user) user.pin = cleanPin;
    return user ? mapUserRecord(user) : null;
  }
}

export async function updateUserRole(id: number, role: string) {
  if (!isPostgresConfigured()) {
    const user = memoryStore.users.find((u) => u.id === id);
    if (user) user.role = role;
    return user ? mapUserRecord(user) : null;
  }

  try {
    const [updated] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
      .returning();
    return updated ? mapUserRecord(updated) : null;
  } catch (error) {
    console.warn('Failed to update user role in DB, updating memory store:', error);
    const user = memoryStore.users.find((u) => u.id === id);
    if (user) user.role = role;
    return user ? mapUserRecord(user) : null;
  }
}

export async function authenticateUser(identifier: string, secret: string) {
  const cleanId = String(identifier || '').trim().toLowerCase();
  const cleanSecret = String(secret || '').trim();

  if (!cleanId || !cleanSecret) {
    return { success: false, message: 'ID Karyawan dan password wajib diisi' };
  }

  let all: any[] = [];
  if (!isPostgresConfigured()) {
    all = memoryStore.users;
  } else {
    try {
      all = await ensureDefaultUsers();
    } catch {
      all = memoryStore.users;
    }
  }

  // Strictly match by Employee ID (ID Karyawan)
  const matched = all.find((u) => {
    const empId = String(u.employeeId || u.email || '').trim().toLowerCase();
    return empId === cleanId;
  });

  if (!matched) {
    return { success: false, message: 'ID Karyawan atau password salah' };
  }

  const expectedPassword = String(matched.pin || '').trim();
  const isPasswordValid = expectedPassword.length > 0 && cleanSecret === expectedPassword;

  if (isPasswordValid) {
    return { success: true, user: mapUserRecord(matched) };
  }

  return {
    success: false,
    message: 'ID Karyawan atau password salah',
  };
}

export async function updateUser(
  id: number,
  data: { employeeId?: string; email?: string; name?: string; role?: string; pin?: string }
) {
  const nextEmployeeId = data.employeeId?.trim() || data.email?.trim();

  if (!isPostgresConfigured()) {
    const user = memoryStore.users.find((u) => u.id === id);
    if (user) {
      if (nextEmployeeId) {
        user.employeeId = nextEmployeeId;
        user.email = nextEmployeeId;
      }
      if (data.name) user.name = data.name.trim();
      if (data.role) user.role = data.role.trim();
      if (data.pin) user.pin = data.pin.trim();
    }
    return user ? mapUserRecord(user) : null;
  }

  try {
    const updateData: Record<string, any> = {};
    if (nextEmployeeId) {
      updateData.email = nextEmployeeId;
    }
    if (data.name !== undefined && data.name.trim() !== '') {
      updateData.name = data.name.trim();
    }
    if (data.role !== undefined && data.role.trim() !== '') {
      updateData.role = data.role.trim();
    }
    if (data.pin !== undefined && data.pin.trim() !== '') {
      updateData.pin = data.pin.trim();
    }

    if (Object.keys(updateData).length === 0) {
      const [current] = await db.select().from(users).where(eq(users.id, id));
      return current ? mapUserRecord(current) : null;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return updated ? mapUserRecord(updated) : null;
  } catch (error) {
    console.warn('Failed to update user in DB, updating memory store:', error);
    const user = memoryStore.users.find((u) => u.id === id);
    if (user) {
      if (nextEmployeeId) {
        user.employeeId = nextEmployeeId;
        user.email = nextEmployeeId;
      }
      if (data.name) user.name = data.name.trim();
      if (data.role) user.role = data.role.trim();
      if (data.pin) user.pin = data.pin.trim();
    }
    return user ? mapUserRecord(user) : null;
  }
}

export async function deleteUser(id: number) {
  if (!isPostgresConfigured()) {
    const idx = memoryStore.users.findIndex((u) => u.id === id);
    if (idx !== -1) {
      if (memoryStore.users[idx].role === 'owner') {
        throw new Error('Akun Pemilik Utama (Owner) tidak dapat dihapus');
      }
      memoryStore.users.splice(idx, 1);
    }
    return true;
  }

  try {
    const [existing] = await db.select().from(users).where(eq(users.id, id));
    if (!existing) {
      throw new Error('Pengguna tidak ditemukan');
    }
    if (existing.role === 'owner') {
      throw new Error('Akun Pemilik Utama (Owner) tidak dapat dihapus');
    }
    await db.delete(users).where(eq(users.id, id));
    return true;
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}
