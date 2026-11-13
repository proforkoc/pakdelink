import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Baca environment variables Vite/Production (import.meta.env) dengan fallback ke firebase-applet-config.json
const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : ({} as Record<string, string | undefined>);

export const resolvedFirebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId || '',
  appId: env.VITE_FIREBASE_APP_ID || firebaseConfig.appId || '',
  firestoreDatabaseId:
    env.VITE_FIRESTORE_DATABASE_ID ||
    firebaseConfig.firestoreDatabaseId ||
    '(default)',
};

// Inisialisasi Firebase App
export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(resolvedFirebaseConfig);

export const auth: Auth = getAuth(app);
export const googleAuthProvider: GoogleAuthProvider = new GoogleAuthProvider();

// Inisialisasi Firestore Cloud Database dengan database ID yang sesuai dan fallback aman
let firestoreDb: Firestore;
try {
  const dbId =
    resolvedFirebaseConfig.firestoreDatabaseId &&
    resolvedFirebaseConfig.firestoreDatabaseId !== '(default)'
      ? resolvedFirebaseConfig.firestoreDatabaseId
      : undefined;

  // Gunakan initializeFirestore dengan experimentalForceLongPolling agar koneksi di lingkungan sandbox/iframe
  // tidak mengalami timeout 10 detik akibat hambatan WebChannel streaming proxy
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      experimentalAutoDetectLongPolling: true,
    },
    dbId
  );
} catch {
  const dbId = resolvedFirebaseConfig.firestoreDatabaseId;
  firestoreDb =
    dbId && dbId !== '(default)'
      ? getFirestore(app, dbId)
      : getFirestore(app);
}

export const db: Firestore = firestoreDb;

if (typeof window !== 'undefined') {
  (async () => {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error('Please check your Firebase configuration.');
      }
    }
  })();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
