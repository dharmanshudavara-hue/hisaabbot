/**
 * Authentication utilities for HisaabBot
 * PIN hashing, validation, user ID generation, and recovery key management
 */

/**
 * Hash a PIN using SHA-256 via Web Crypto API
 * @param {string} pin - The 4-digit PIN to hash
 * @returns {Promise<string>} - Hex-encoded hash
 */
export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a PIN against a stored hash
 * @param {string} inputPin - The PIN entered by the user
 * @param {string} storedHash - The stored hash to compare against
 * @returns {Promise<boolean>}
 */
export async function verifyPin(inputPin, storedHash) {
  const inputHash = await hashPin(inputPin);
  return inputHash === storedHash;
}

/**
 * Validate a 4-digit numeric PIN
 * @param {string} pin
 * @returns {{ valid: boolean, error?: string }}
 */
export function validatePin(pin) {
  if (!pin) return { valid: false, error: 'PIN is required' };
  if (pin.length !== 4) return { valid: false, error: 'PIN must be exactly 4 digits' };
  if (!/^\d{4}$/.test(pin)) return { valid: false, error: 'PIN must contain only numbers' };
  return { valid: true };
}

/**
 * Validate a username
 * @param {string} name
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUsername(name) {
  if (!name) return { valid: false, error: 'Name is required' };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { valid: false, error: 'Name must be at least 2 characters' };
  if (trimmed.length > 30) return { valid: false, error: 'Name must be under 30 characters' };
  return { valid: true };
}

/**
 * Generate a sequential User ID like HB-001
 * @param {Array} existingUsers - Array of existing user objects
 * @returns {string}
 */
export function generateUserId(existingUsers = []) {
  const maxNum = existingUsers.reduce((max, u) => {
    const match = u.userId?.match(/^HB-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      return num > max ? num : max;
    }
    return max;
  }, 0);
  const nextNum = maxNum + 1;
  return `HB-${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generate an 8-digit recovery key (4-4 format: e.g., "4729-8351")
 * @returns {string}
 */
export function generateRecoveryKey() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  const digits = Array.from(arr).map(b => b % 10).join('');
  return digits.slice(0, 4) + '-' + digits.slice(4, 8);
}

/**
 * Normalize a recovery key for comparison (strip dashes/spaces)
 * @param {string} key
 * @returns {string}
 */
export function normalizeRecoveryKey(key) {
  return (key || '').replace(/[\s-]/g, '');
}

/**
 * Hash a recovery key for storage
 * @param {string} key - The recovery key (may contain dash)
 * @returns {Promise<string>}
 */
export async function hashRecoveryKey(key) {
  const normalized = normalizeRecoveryKey(key);
  return hashPin(normalized); // Reuse the same SHA-256 hashing
}

/**
 * Verify a recovery key against stored hash
 * @param {string} inputKey
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyRecoveryKey(inputKey, storedHash) {
  const normalized = normalizeRecoveryKey(inputKey);
  const inputHash = await hashPin(normalized);
  return inputHash === storedHash;
}
