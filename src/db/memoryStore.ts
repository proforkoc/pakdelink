// In-memory data store for development and environments without active Cloud SQL / PostgreSQL.
// Provides persistent-in-process state for all POS, Digital Keuangan, Service, and User operations.

export interface MemoryCategory {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  icon?: string | null;
  createdAt: Date;
}

export interface MemoryProduct {
  id: number;
  categoryId: number | null;
  code: string;
  name: string;
  brand: string | null;
  model: string | null;
  variant: string | null;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockAlert: number;
  isImeiTracked: boolean;
  unit: string;
  createdAt: Date;
}

export interface MemoryProductSerial {
  id: number;
  productId: number;
  imei1: string;
  imei2?: string | null;
  serialNumber?: string | null;
  color?: string | null;
  ramStorage?: string | null;
  status: string;
  purchasePrice: number;
  saleId?: number | null;
  notes?: string | null;
  createdAt: Date;
  soldAt?: Date | null;
}

export interface MemoryDigitalTransaction {
  id: number;
  type: string;
  provider: string;
  targetAccount: string;
  customerName: string;
  nominal: number;
  adminBankCost: number;
  adminStoreFee: number;
  totalCustomerPaid: number;
  profit: number;
  paymentMethod: string;
  referenceNumber: string;
  status: string;
  cashierUid: string | null;
  operatorName?: string | null;
  notes: string | null;
  createdAt: Date;
}

export interface MemoryServiceOrder {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deviceModel: string;
  deviceImei?: string | null;
  deviceColor?: string | null;
  issueType: string;
  issueDetails?: string | null;
  toolsUsed?: string | null;
  toolCost: number;
  estimatedCost: number;
  finalCost: number;
  downPayment: number;
  balanceDue: number;
  status: string;
  technicianUid?: string | null;
  technicianNotes?: string | null;
  receivedAt: Date;
  completedAt?: Date | null;
  pickedUpAt?: Date | null;
}

export interface MemoryExpense {
  id: number;
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  paidBy?: string | null;
  notes?: string | null;
  createdAt: Date;
}

export interface MemorySaleItem {
  id: number;
  saleId: number;
  productId?: number | null;
  productName: string;
  productCategory: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  subtotal: number;
  profit: number;
  imeiOrSerial?: string | null;
  productSerialId?: number | null;
}

export interface MemorySale {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string | null;
  subtotal: number;
  discount: number;
  grandTotal: number;
  totalCost: number;
  totalProfit: number;
  paymentMethod: string;
  amountPaid: number;
  changeAmount: number;
  cashierUid?: string | null;
  status: string;
  notes?: string | null;
  createdAt: Date;
  items?: MemorySaleItem[];
}

export interface MemoryUser {
  id: number;
  uid: string;
  employeeId: string;
  email: string;
  name: string;
  role: string;
  pin: string;
  createdAt: Date;
}

class MemoryStore {
  public categories: MemoryCategory[] = [
    { id: 1, name: 'Transfer & Tarik Tunai Bank', code: 'bank', description: 'Transaksi Agen BRILink & Semua Bank', icon: 'credit-card', createdAt: new Date() },
    { id: 2, name: 'Top Up E-Wallet', code: 'ewallet', description: 'DANA, OVO, GoPay, ShopeePay, LinkAja', icon: 'wallet', createdAt: new Date() },
    { id: 3, name: 'Pulsa & Paket Data', code: 'pulsa', description: 'Pulsa & Kuota All Operator', icon: 'smartphone', createdAt: new Date() },
    { id: 4, name: 'Token PLN & Listrik', code: 'pln', description: 'Token Listrik Prabayar & Tagihan PLN', icon: 'zap', createdAt: new Date() },
    { id: 5, name: 'Tagihan PPOB & Lainnya', code: 'ppob', description: 'BPJS, PDAM, Cicilan Finance', icon: 'file-text', createdAt: new Date() },
    { id: 6, name: 'Aksesoris & Gadget', code: 'aksesoris', description: 'Charger, Kabel, Casing, Tempered Glass', icon: 'headphones', createdAt: new Date() },
  ];

  public products: MemoryProduct[] = [];
  public productSerials: MemoryProductSerial[] = [];
  public digitalTransactions: MemoryDigitalTransaction[] = [];
  public serviceOrders: MemoryServiceOrder[] = [];
  public expenses: MemoryExpense[] = [];
  public sales: MemorySale[] = [];
  public saleItems: MemorySaleItem[] = [];

  public users: MemoryUser[] = [
    {
      id: 1,
      uid: 'emp-151500',
      employeeId: '151500',
      email: '151500',
      name: 'Roni Jaswoko',
      role: 'owner',
      pin: '8888',
      createdAt: new Date(),
    },
    {
      id: 2,
      uid: 'emp-151501',
      employeeId: '151501',
      email: '151501',
      name: 'Bella Heartfire',
      role: 'cashier',
      pin: '9999',
      createdAt: new Date(),
    },
  ];

  private nextId = Math.max(10000, Math.floor(Date.now() / 1000));

  public getNextId(): number {
    this.nextId = Math.max(this.nextId + 1, Math.floor(Date.now() / 1000));
    return this.nextId;
  }
}

// Global caching across HMR / module re-imports
declare global {
  var _konterMemoryStore: MemoryStore | undefined;
}

if (!global._konterMemoryStore) {
  global._konterMemoryStore = new MemoryStore();
}

export const memoryStore = global._konterMemoryStore;
