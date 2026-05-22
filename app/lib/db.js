/**
 * IndexedDB helper for offline storage
 * All transactions are stored locally first, then synced to Supabase
 */

const DB_NAME = 'hisaabbot';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
const SETTINGS_STORE = 'settings';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Generate a simple UUID
function generateId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  ) + '-' + Date.now().toString(36);
}

/**
 * Add a new transaction
 */
export async function addTransaction(data) {
  const db = await openDB();
  const transaction = {
    id: generateId(),
    type: data.type, // 'lent', 'borrowed', 'expense'
    person_name: data.person_name || null,
    amount: Number(data.amount) || 0,
    due_date: data.due_date || null,
    interest_rate: data.interest_rate || null,
    category: data.category || null,
    status: 'open',
    settled_at: null,
    raw_transcript: data.raw_transcript || '',
    confidence: data.confidence || 0,
    created_at: new Date().toISOString(),
    synced: false,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(transaction);
    request.onsuccess = () => resolve(transaction);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all transactions
 */
export async function getAllTransactions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get transactions by type
 */
export async function getTransactionsByType(type) {
  const all = await getAllTransactions();
  return all.filter((t) => t.type === type);
}

/**
 * Get open loans (lent or borrowed, not settled)
 */
export async function getOpenLoans() {
  const all = await getAllTransactions();
  return all.filter(
    (t) => (t.type === 'lent' || t.type === 'borrowed') && t.status === 'open'
  );
}

/**
 * Get settled loans
 */
export async function getSettledLoans() {
  const all = await getAllTransactions();
  return all.filter(
    (t) => (t.type === 'lent' || t.type === 'borrowed') && t.status === 'settled'
  );
}

/**
 * Mark a loan as settled/repaid
 */
export async function settleLoan(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (!record) {
        reject(new Error('Transaction not found'));
        return;
      }
      record.status = 'settled';
      record.settled_at = new Date().toISOString();
      record.synced = false;
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve(record);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get today's expenses
 */
export async function getTodayExpenses() {
  const all = await getAllTransactions();
  const today = new Date().toISOString().split('T')[0];
  return all.filter(
    (t) => t.type === 'expense' && t.created_at.startsWith(today)
  );
}

/**
 * Get expenses for a date range
 */
export async function getExpensesByRange(startDate, endDate) {
  const all = await getAllTransactions();
  return all.filter((t) => {
    if (t.type !== 'expense') return false;
    const date = t.created_at.split('T')[0];
    return date >= startDate && date <= endDate;
  });
}

/**
 * Get monthly summary
 */
export async function getMonthlySummary(year, month) {
  const all = await getAllTransactions();
  const prefix = `${year}-${String(month).padStart(2, '0')}`;

  const monthData = all.filter((t) => t.created_at.startsWith(prefix));

  const totalLent = monthData
    .filter((t) => t.type === 'lent')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBorrowed = monthData
    .filter((t) => t.type === 'borrowed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = monthData
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const expensesByCategory = {};
  monthData
    .filter((t) => t.type === 'expense')
    .forEach((t) => {
      const cat = t.category || 'other';
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
    });

  return {
    totalLent,
    totalBorrowed,
    totalExpenses,
    expensesByCategory,
    transactionCount: monthData.length,
  };
}

/**
 * Get upcoming due dates (next 7 days)
 */
export async function getUpcomingDues() {
  const loans = await getOpenLoans();
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return loans
    .filter((t) => {
      if (!t.due_date) return false;
      const due = new Date(t.due_date);
      return due <= weekFromNow;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
}

/**
 * Get overdue loans
 */
export async function getOverdueLoans() {
  const loans = await getOpenLoans();
  const today = new Date().toISOString().split('T')[0];

  return loans.filter((t) => t.due_date && t.due_date < today);
}

/**
 * Settings helpers
 */
export async function getSetting(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function setSetting(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    const request = store.put({ key, value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
