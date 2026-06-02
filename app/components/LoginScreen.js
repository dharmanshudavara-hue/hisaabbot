'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getUsers, addUser, updateUserPin, updateUserRecoveryKey, fetchUserFromCloud } from '../../lib/db';
import {
  hashPin, verifyPin, validatePin, validateUsername,
  generateRecoveryKey, hashRecoveryKey, verifyRecoveryKey
} from '../../lib/auth';
import { LockIcon, UserIcon, ShieldIcon } from './Icons';

// ─── PIN Pad Component ──────────────────────────────────────────────────────
function PinPad({ value, onChange, onComplete, length = 4, error, shake }) {
  const handleDigit = useCallback((digit) => {
    if (value.length < length) {
      const next = value + digit;
      onChange(next);
      if (next.length === length) {
        setTimeout(() => onComplete?.(next), 150);
      }
    }
  }, [value, length, onChange, onComplete]);

  const handleBackspace = useCallback(() => {
    onChange(value.slice(0, -1));
  }, [value, onChange]);

  return (
    <div className="pin-pad-wrapper">
      {/* Dot indicators */}
      <div className={`pin-dots ${shake ? 'pin-shake' : ''}`}>
        {Array.from({ length }).map((_, i) => (
          <div key={i} className={`pin-dot ${i < value.length ? 'filled' : ''} ${error ? 'error' : ''}`} />
        ))}
      </div>

      {error && (
        <p className="pin-error-text">{error}</p>
      )}

      {/* Numeric keypad */}
      <div className="pin-keypad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, 'back'].map((key, i) => {
          if (key === null) return <div key={i} className="pin-key empty" />;
          if (key === 'back') {
            return (
              <button key={i} className="pin-key pin-key-action" onClick={handleBackspace} aria-label="Backspace">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              </button>
            );
          }
          return (
            <button key={i} className="pin-key" onClick={() => handleDigit(String(key))}>
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recovery Key Display ────────────────────────────────────────────────────
function RecoveryKeyDisplay({ recoveryKey, onContinue }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = recoveryKey;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="setup-step fade-in">
      <div className="recovery-icon-wrapper">
        <ShieldIcon size={48} style={{ color: 'var(--amber-400)' }} />
      </div>
      <h2 className="setup-title">Your Recovery Key</h2>
      <p className="setup-desc">
        Write this down somewhere safe. You'll need it if you forget your PIN.
        <strong style={{ color: 'var(--red-400)', display: 'block', marginTop: 8 }}>
          This key is shown only once!
        </strong>
      </p>

      <div className="recovery-key-card">
        <span className="recovery-key-text">{recoveryKey}</span>
        <button className="recovery-key-copy" onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <button className="btn btn-primary login-btn" onClick={onContinue} style={{ marginTop: 24 }}>
        I've Saved It — Continue
      </button>
    </div>
  );
}

// ─── Main LoginScreen ────────────────────────────────────────────────────────
export default function LoginScreen({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Setup wizard state
  const [setupMode, setSetupMode] = useState(false);
  const [setupStep, setSetupStep] = useState(1); // 1=name, 2=create PIN, 3=confirm PIN, 4=show recovery key
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [createdUserId, setCreatedUserId] = useState('');
  const [createdUser, setCreatedUser] = useState(null);
  const [setupRole, setSetupRole] = useState('primary'); // Used when adding caretaker from settings redirects here

  // Login state
  const [selectedUser, setSelectedUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinShake, setPinShake] = useState(false);
  const [failCount, setFailCount] = useState(0);

  // Recovery state
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryStep, setRecoveryStep] = useState(1); // 1=enter key, 2=new PIN, 3=confirm PIN
  const [recoveryNewPin, setRecoveryNewPin] = useState('');
  const [recoveryConfirmPin, setRecoveryConfirmPin] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  // Cloud login state
  const [cloudLoginMode, setCloudLoginMode] = useState(false);
  const [cloudUserId, setCloudUserId] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');

  // General
  const [error, setError] = useState('');
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  useEffect(() => {
    const storedLockout = localStorage.getItem('lockoutUntil');
    if (storedLockout) {
      if (Date.now() < parseInt(storedLockout, 10)) {
        setLockoutUntil(parseInt(storedLockout, 10));
      } else {
        localStorage.removeItem('lockoutUntil');
      }
    }
    loadUsers();
  }, []);

  // Update lockout timer every second
  useEffect(() => {
    if (!lockoutUntil) return;
    const interval = setInterval(() => {
      const remaining = lockoutUntil - Date.now();
      if (remaining <= 0) {
        setLockoutUntil(null);
        setLockoutTimeLeft(0);
        localStorage.removeItem('lockoutUntil');
        setFailCount(0);
        setPinError('');
      } else {
        setLockoutTimeLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const loadUsers = async () => {
    try {
      const dbUsers = await getUsers();
      setUsers(dbUsers);
      if (dbUsers.length === 0) {
        setSetupMode(true);
      }
    } catch (err) {
      console.error('Error loading users:', err);
    }
    setLoading(false);
  };

  // ─── Setup Handlers ──────────────────────────────────────────────────
  const handleSetupNameNext = () => {
    const validation = validateUsername(newUsername);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    setError('');
    setSetupStep(2);
  };

  const handleSetupPinCreated = (pin) => {
    setNewPin(pin);
    setError('');
    setSetupStep(3);
  };

  const handleSetupPinConfirmed = async (pin) => {
    if (pin !== newPin) {
      setError('PINs do not match. Try again.');
      setConfirmPin('');
      setPinShake(true);
      setTimeout(() => setPinShake(false), 500);
      return;
    }

    setError('');
    setConfirmPin(pin);

    // Generate recovery key
    const key = generateRecoveryKey();
    setRecoveryKey(key);

    try {
      const pinH = await hashPin(newPin);
      const recoveryH = await hashRecoveryKey(key);
      const user = await addUser(newUsername.trim(), pinH, 'primary', recoveryH);
      setCreatedUser(user);
      setCreatedUserId(user.userId);
      setSetupStep(4); // Show recovery key
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetupComplete = () => {
    const user = createdUser || {
      userId: createdUserId,
      username: newUsername.trim(),
      role: 'primary'
    };

    sessionStorage.setItem('currentUser', JSON.stringify({
      userId: user.userId,
      username: user.username,
      role: user.role
    }));
    onLogin({ userId: user.userId, username: user.username, role: user.role });
  };

  // ─── Login Handler ────────────────────────────────────────────────────
  const handlePinSubmit = async (pin) => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      setPinError(`Account locked. Try again in ${lockoutTimeLeft}s.`);
      setPinShake(true);
      setTimeout(() => setPinShake(false), 500);
      return;
    }

    const isValid = await verifyPin(pin, selectedUser.pinHash);
    if (isValid) {
      setFailCount(0);
      localStorage.removeItem('lockoutUntil');
      sessionStorage.setItem('currentUser', JSON.stringify({
        userId: selectedUser.userId,
        username: selectedUser.username,
        role: selectedUser.role
      }));
      onLogin({
        userId: selectedUser.userId,
        username: selectedUser.username,
        role: selectedUser.role
      });
    } else {
      const newFailCount = failCount + 1;
      setFailCount(newFailCount);
      
      if (newFailCount >= 5) {
        const lockoutTime = Date.now() + 5 * 60 * 1000; // 5 mins
        localStorage.setItem('lockoutUntil', lockoutTime);
        setLockoutUntil(lockoutTime);
        setPinError(`Account locked for 5 minutes.`);
      } else {
        setPinError(`Incorrect PIN. ${5 - newFailCount} attempts left.`);
      }
      
      setPinShake(true);
      setPinInput('');
      setTimeout(() => {
        setPinShake(false);
        if (newFailCount < 5) setPinError('');
      }, 1500);
    }
  };

  // ─── Recovery Handlers ────────────────────────────────────────────────
  const handleRecoveryKeySubmit = async () => {
    if (!selectedUser.recoveryKeyHash) {
      setRecoveryError('No recovery key was set for this account.');
      return;
    }

    const normalized = recoveryInput.replace(/[\s-]/g, '');
    if (normalized.length !== 8) {
      setRecoveryError('Recovery key must be 8 digits');
      return;
    }

    const isValid = await verifyRecoveryKey(recoveryInput, selectedUser.recoveryKeyHash);
    if (isValid) {
      setRecoveryError('');
      setRecoveryStep(2);
    } else {
      setRecoveryError('Invalid recovery key');
    }
  };

  const handleRecoveryNewPin = (pin) => {
    setRecoveryNewPin(pin);
    setRecoveryError('');
    setRecoveryStep(3);
  };

  const handleRecoveryConfirmPin = async (pin) => {
    if (pin !== recoveryNewPin) {
      setRecoveryError('PINs do not match');
      setRecoveryConfirmPin('');
      setPinShake(true);
      setTimeout(() => setPinShake(false), 500);
      return;
    }

    try {
      const newPinHash = await hashPin(recoveryNewPin);
      await updateUserPin(selectedUser.userId, newPinHash);

      // Generate new recovery key
      const newKey = generateRecoveryKey();
      const newKeyHash = await hashRecoveryKey(newKey);
      await updateUserRecoveryKey(selectedUser.userId, newKeyHash);

      // Show the new recovery key, then log them in
      setRecoveryKey(newKey);
      setRecoveryStep(4);

      // Update the local user reference
      setSelectedUser(prev => ({ ...prev, pinHash: newPinHash, recoveryKeyHash: newKeyHash }));
    } catch (err) {
      setRecoveryError(err.message);
    }
  };

  const handleRecoveryComplete = () => {
    sessionStorage.setItem('currentUser', JSON.stringify({
      userId: selectedUser.userId,
      username: selectedUser.username,
      role: selectedUser.role
    }));
    onLogin({
      userId: selectedUser.userId,
      username: selectedUser.username,
      role: selectedUser.role
    });
  };

  const resetRecovery = () => {
    setRecoveryMode(false);
    setRecoveryStep(1);
    setRecoveryInput('');
    setRecoveryNewPin('');
    setRecoveryConfirmPin('');
    setRecoveryError('');
  };

  // ─── Cloud Login Handler ──────────────────────────────────────────────
  const handleCloudLogin = async () => {
    const trimmed = cloudUserId.trim().toUpperCase();
    if (!trimmed) {
      setCloudError('Please enter your User ID (e.g. HB-001)');
      return;
    }
    // Auto-format: if user typed "HB001" without dash, fix it
    let formatted = trimmed;
    if (/^HB\d{3,}$/.test(formatted)) {
      formatted = 'HB-' + formatted.slice(2);
    }

    setCloudLoading(true);
    setCloudError('');
    try {
      const user = await fetchUserFromCloud(formatted);
      // User fetched and saved to local IndexedDB. Now select them for PIN entry.
      setSelectedUser(user);
      setCloudLoginMode(false);
      setCloudUserId('');
      // Refresh local users list
      const dbUsers = await getUsers();
      setUsers(dbUsers);
      setSetupMode(false);
    } catch (err) {
      console.error('Cloud login error:', err);
      setCloudError('User ID not found. Please check and try again.');
    }
    setCloudLoading(false);
  };

  const resetCloudLogin = () => {
    setCloudLoginMode(false);
    setCloudUserId('');
    setCloudError('');
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="login-page">
        <div className="login-loader">
          <div className="login-loader-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Background decorations */}
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <div className="login-container">
        {/* Logo */}
        <div className="login-logo fade-in">
          <div className="login-logo-icon">
            <ShieldIcon size={40} style={{ color: 'var(--green-400)' }} />
          </div>
          <h1 className="login-app-name">HisaabBot</h1>
          <p className="login-app-tagline">Secure Voice Finance</p>
        </div>

        {/* ─── Setup Wizard ──────────────────────────────────────── */}
        {setupMode ? (
          <div className="login-card fade-in">
            {/* Step indicators */}
            <div className="setup-steps">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className={`setup-step-dot ${setupStep >= s ? 'active' : ''} ${setupStep === s ? 'current' : ''}`} />
              ))}
            </div>

            {setupStep === 1 && (
              <div className="setup-step fade-in">
                <h2 className="setup-title">Welcome!</h2>
                <p className="setup-desc">
                  Let's set up your account. Your data syncs securely to the cloud.
                </p>
                <div className="input-group">
                  <label className="input-label">Your Name</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={e => { setNewUsername(e.target.value); setError(''); }}
                    placeholder="e.g. Rahul"
                    className="input-field"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSetupNameNext()}
                  />
                </div>
                {error && <p className="pin-error-text">{error}</p>}
                <button className="btn btn-primary login-btn" onClick={handleSetupNameNext}>
                  Create New Account
                </button>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0 6px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>or</span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
                </div>
                <button className="btn btn-secondary login-btn" style={{ marginTop: 6 }} onClick={() => { setSetupMode(false); setCloudLoginMode(true); }}>
                  Already have an account? Log in
                </button>
              </div>
            )}

            {setupStep === 2 && (
              <div className="setup-step fade-in">
                <h2 className="setup-title">Create Your PIN</h2>
                <p className="setup-desc">Choose a 4-digit PIN to secure your account</p>
                <PinPad
                  value={newPin}
                  onChange={setNewPin}
                  onComplete={handleSetupPinCreated}
                  error={error}
                  shake={pinShake}
                />
              </div>
            )}

            {setupStep === 3 && (
              <div className="setup-step fade-in">
                <h2 className="setup-title">Confirm Your PIN</h2>
                <p className="setup-desc">Enter the same PIN again to confirm</p>
                <PinPad
                  value={confirmPin}
                  onChange={setConfirmPin}
                  onComplete={handleSetupPinConfirmed}
                  error={error}
                  shake={pinShake}
                />
              </div>
            )}

            {setupStep === 4 && (
              <RecoveryKeyDisplay
                recoveryKey={recoveryKey}
                onContinue={handleSetupComplete}
              />
            )}
          </div>

        /* ─── Recovery Mode ─────────────────────────────────────── */
        ) : recoveryMode && selectedUser ? (
          <div className="login-card fade-in">
            {recoveryStep === 1 && (
              <div className="setup-step fade-in">
                <h2 className="setup-title">Reset PIN</h2>
                <p className="setup-desc">
                  Enter the 8-digit recovery key for <strong>{selectedUser.username}</strong>
                </p>
                <div className="input-group">
                  <input
                    type="text"
                    value={recoveryInput}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9-]/g, '');
                      setRecoveryInput(raw.slice(0, 9));
                      setRecoveryError('');
                    }}
                    placeholder="XXXX-XXXX"
                    className="input-field"
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.15em' }}
                    autoFocus
                  />
                </div>
                {recoveryError && <p className="pin-error-text">{recoveryError}</p>}
                <div className="btn-row">
                  <button className="btn btn-secondary login-btn" onClick={resetRecovery}>Back</button>
                  <button className="btn btn-primary login-btn" onClick={handleRecoveryKeySubmit}>Verify</button>
                </div>
              </div>
            )}

            {recoveryStep === 2 && (
              <div className="setup-step fade-in">
                <h2 className="setup-title">New PIN</h2>
                <p className="setup-desc">Create a new 4-digit PIN</p>
                <PinPad
                  value={recoveryNewPin}
                  onChange={setRecoveryNewPin}
                  onComplete={handleRecoveryNewPin}
                  error={recoveryError}
                  shake={pinShake}
                />
              </div>
            )}

            {recoveryStep === 3 && (
              <div className="setup-step fade-in">
                <h2 className="setup-title">Confirm New PIN</h2>
                <p className="setup-desc">Enter the new PIN again</p>
                <PinPad
                  value={recoveryConfirmPin}
                  onChange={setRecoveryConfirmPin}
                  onComplete={handleRecoveryConfirmPin}
                  error={recoveryError}
                  shake={pinShake}
                />
              </div>
            )}

            {recoveryStep === 4 && (
              <RecoveryKeyDisplay
                recoveryKey={recoveryKey}
                onContinue={handleRecoveryComplete}
              />
            )}
          </div>

        /* ─── Login: PIN Entry ──────────────────────────────────── */
        ) : selectedUser ? (
          <div className="login-card fade-in">
            <div className="login-user-info">
              <div className={`login-avatar ${selectedUser.role === 'primary' ? 'primary' : 'caretaker'}`}>
                {selectedUser.username.charAt(0).toUpperCase()}
              </div>
              <h2 className="login-user-name">{selectedUser.username}</h2>
              <div className="login-user-meta">
                <span className={`login-role-badge ${selectedUser.role}`}>{selectedUser.role}</span>
                <span className="login-user-id">{selectedUser.userId}</span>
              </div>
            </div>

            <p className="setup-desc" style={{ marginTop: 16, marginBottom: 0 }}>
              {lockoutUntil ? `Locked out for ${Math.floor(lockoutTimeLeft / 60)}:${(lockoutTimeLeft % 60).toString().padStart(2, '0')} mins` : "Enter your 4-digit PIN"}
            </p>

            <PinPad
              value={pinInput}
              onChange={(v) => { if (!lockoutUntil) { setPinInput(v); setPinError(''); } }}
              onComplete={handlePinSubmit}
              error={pinError}
              shake={pinShake}
            />

            <div className="login-actions">
              <button className="btn-link" onClick={() => { setSelectedUser(null); setPinInput(''); setPinError(''); setFailCount(0); }}>
                Switch User
              </button>
              {selectedUser.recoveryKeyHash && (
                <button className="btn-link btn-link-warn" onClick={() => { setRecoveryMode(true); setPinInput(''); setPinError(''); }}>
                  Forgot PIN?
                </button>
              )}
            </div>
          </div>

        /* ─── Cloud Login: User ID Entry ──────────────────────────── */
        ) : cloudLoginMode ? (
          <div className="login-card fade-in">
            <div className="setup-step fade-in">
              <div className="recovery-icon-wrapper">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--blue-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
                  <path d="M21 14H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1z" />
                  <circle cx="7" cy="7" r="1" fill="var(--blue-400)" />
                  <circle cx="7" cy="19" r="1" fill="var(--blue-400)" />
                </svg>
              </div>
              <h2 className="setup-title">Log in from Cloud</h2>
              <p className="setup-desc">
                Enter your User ID to log in to your existing account from this device.
              </p>
              <div className="input-group">
                <label className="input-label">User ID</label>
                <input
                  type="text"
                  value={cloudUserId}
                  onChange={e => { setCloudUserId(e.target.value.toUpperCase()); setCloudError(''); }}
                  placeholder="e.g. HB-001"
                  className="input-field"
                  style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '0.1em', fontFamily: 'monospace' }}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCloudLogin()}
                />
              </div>
              {cloudError && <p className="pin-error-text">{cloudError}</p>}
              <button
                className="btn btn-primary login-btn"
                onClick={handleCloudLogin}
                disabled={cloudLoading}
                style={{ marginTop: 8 }}
              >
                {cloudLoading ? 'Searching...' : 'Find My Account'}
              </button>
              <button className="btn-link" style={{ marginTop: 12 }} onClick={() => {
                resetCloudLogin();
                if (users.length === 0) setSetupMode(true);
              }}>
                ← Back
              </button>
            </div>
          </div>

        /* ─── Login: User Selection ─────────────────────────────── */
        ) : (
          <div className="login-users-list fade-in">
            <h2 className="login-select-title">Who's logging in?</h2>
            {users.map(u => (
              <button
                key={u.userId}
                className="login-user-card"
                onClick={() => { setSelectedUser(u); setPinInput(''); setPinError(''); }}
              >
                <div className={`login-avatar-sm ${u.role === 'primary' ? 'primary' : 'caretaker'}`}>
                  {u.username.charAt(0).toUpperCase()}
                </div>
                <div className="login-user-card-info">
                  <div className="login-user-card-name">{u.username}</div>
                  <div className="login-user-card-meta">
                    <span className={`login-role-badge sm ${u.role}`}>{u.role}</span>
                    <span className="login-user-card-id">{u.userId}</span>
                  </div>
                </div>
                <LockIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            ))}

            {/* Cloud login button at the bottom of user list */}
            <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 8px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>
            <button className="btn-link" style={{ fontSize: '0.875rem' }} onClick={() => setCloudLoginMode(true)}>
              Log in with a different User ID
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
