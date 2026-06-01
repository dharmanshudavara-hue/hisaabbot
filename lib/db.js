/**
 * IndexedDB helper for offline storage
 * All transactions are stored locally first, then synced to Supabase
 * DB_VERSION 2: Added dedicated 'users' store with hashed PINs
 */

import { supabase } from './supabase';
import { hashPin, hashRecoveryKey, generateUserId } from './auth';

const DB_NAME = 'hisaabbot';
const DB_VERSION = 2;
const STORE_NAME = 'transactions';
const SETTINGS_STORE = 'settings';
const USERS_STORE = 'users';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // V1 stores
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

      // V2: Create dedicated users store
      if (!db.objectStoreNames.contains(USERS_STORE)) {
        const usersStore = db.createObjectStore(USERS_STORE, { keyPath: 'userId' });
        usersStore.createIndex('username', 'username', { unique: false });
        usersStore.createIndex('role', 'role', { unique: false });
      }
    };

    request.onsuccess = async () => {
      const db = request.result;
      // After opening, run migration if needed
      try {
        await migrateV1Users(db);
      } catch (e) {
        console.warn('User migration check:', e);
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Migrate v1 users (plain-text PINs in settings store) to v2 users store (hashed PINs)
 */
async function migrateV1Users(db) {
  // Check if there are old-format users in the settings store
  const oldUsers = await new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readonly');
    const store = tx.objectStore(SETTINGS_STORE);
    const req = store.get('users');
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => resolve(null);
  });

  if (!oldUsers || !Array.isArray(oldUsers) || oldUsers.length === 0) return;

  // Check if users store already has data (migration already done)
  const existingCount = await new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(0);
  });

  if (existingCount > 0) return; // Already migrated

  // Migrate each user
  const migratedUsers = [];
  for (let i = 0; i < oldUsers.length; i++) {
    const old = oldUsers[i];
    const userId = `HB-${String(i + 1).padStart(3, '0')}`;
    const pinHash = await hashPin(old.pin);
    migratedUsers.push({
      userId,
      username: old.username,
      pinHash,
      recoveryKeyHash: null, // Old users won't have recovery keys
      role: old.role || 'primary',
      createdAt: new Date().toISOString(),
    });
  }

  // Write migrated users to the new store
  await new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    migratedUsers.forEach(u => store.put(u));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Remove old users from settings
  await new Promise((resolve, reject) => {
    const tx = db.transaction(SETTINGS_STORE, 'readwrite');
    const store = tx.objectStore(SETTINGS_STORE);
    store.delete('users');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  console.log(`Migrated ${migratedUsers.length} users from v1 → v2`);
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
 * User Auth Helpers (V2 — dedicated users store with hashed PINs)
 */

/**
 * Get all users from the users store
 */
export async function getUsers() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a single user by userId
 */
export async function getUserById(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readonly');
    const store = tx.objectStore(USERS_STORE);
    const request = store.get(userId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add a new user with hashed PIN and recovery key
 * @param {string} username
 * @param {string} pinHash - Already hashed PIN
 * @param {string} role - 'primary' or 'caretaker'
 * @param {string|null} recoveryKeyHash - Already hashed recovery key
 * @returns {Promise<Object>} The created user object
 */
export async function addUser(username, pinHash, role, recoveryKeyHash = null) {
  const existingUsers = await getUsers();

  // Check for duplicate username
  if (existingUsers.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already exists');
  }

  const userId = generateUserId(existingUsers);

  const user = {
    userId,
    username,
    pinHash,
    recoveryKeyHash,
    role,
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const request = store.add(user);
    request.onsuccess = () => resolve(user);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a user's PIN hash
 */
export async function updateUserPin(userId, newPinHash) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const getReq = store.get(userId);

    getReq.onsuccess = () => {
      const user = getReq.result;
      if (!user) {
        reject(new Error('User not found'));
        return;
      }
      user.pinHash = newPinHash;
      const putReq = store.put(user);
      putReq.onsuccess = () => resolve(user);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Update a user's recovery key hash
 */
export async function updateUserRecoveryKey(userId, newRecoveryKeyHash) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const getReq = store.get(userId);

    getReq.onsuccess = () => {
      const user = getReq.result;
      if (!user) {
        reject(new Error('User not found'));
        return;
      }
      user.recoveryKeyHash = newRecoveryKeyHash;
      const putReq = store.put(user);
      putReq.onsuccess = () => resolve(user);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Delete a user by userId
 */
export async function deleteUser(userId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(USERS_STORE, 'readwrite');
    const store = tx.objectStore(USERS_STORE);
    const request = store.delete(userId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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

/**
 * Sync with Supabase
 */
export async function syncWithSupabase() {
  if (!supabase) throw new Error('Supabase not configured in .env.local');

  const all = await getAllTransactions();
  const unsynced = all.filter(t => !t.synced);

  // Note: Pulling from Supabase could be added here to support multi-device sync
  // For now, we just push local changes to the cloud

  if (unsynced.length === 0) return { pushed: 0, pulled: 0 };

  // Prepare payload (remove local-only flags if necessary, though we just upload them)
  const payload = unsynced.map(t => {
    const { synced, ...rest } = t;
    return rest;
  });

  const { error } = await supabase
    .from('transactions')
    .upsert(payload, { onConflict: 'id' });

  if (error) throw error;

  // Mark locally as synced
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    unsynced.forEach(t => {
      t.synced = true;
      store.put(t);
    });

    tx.oncomplete = () => resolve({ pushed: unsynced.length, pulled: 0 });
    tx.onerror = () => reject(tx.error);
  });
}
