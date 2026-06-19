'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import {
  SettingsIcon, GlobeIcon, ShieldIcon, InfoIcon,
  DownloadIcon, XCircleIcon, ChevronRightIcon, CloudIcon,
  UsersIcon, LockIcon, ArrowRightIcon, UserIcon
} from '../components/Icons';
import { getSetting, setSetting, getAllTransactions, syncWithSupabase, addUser, getUsers, deleteUser, updateUserPin, updateUserRecoveryKey } from '../../lib/db';
import { hashPin, generateRecoveryKey, hashRecoveryKey } from '../../lib/auth';

export default function SettingsPage() {
  const [language, setLanguage] = useState('hindi');
  const [transactionCount, setTransactionCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // Add Caretaker State
  const [showAddCaretaker, setShowAddCaretaker] = useState(false);
  const [caretakerUsername, setCaretakerUsername] = useState('');
  const [caretakerPin, setCaretakerPin] = useState('');
  const [caretakerRecoveryKey, setCaretakerRecoveryKey] = useState('');
  
  // Caretaker List State
  const [caretakers, setCaretakers] = useState([]);
  
  // Change PIN State
  const [showChangePin, setShowChangePin] = useState(false);
  const [changePinStep, setChangePinStep] = useState(1); // 1 = new pin, 2 = confirm pin
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [newRecoveryKey, setNewRecoveryKey] = useState('');

  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    getSetting('language').then(l => { if (l) setLanguage(l); }).catch(() => {});
    getAllTransactions().then(t => setTransactionCount(t.length)).catch(() => {});
    
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    
    loadCaretakers();
  }, []);

  const loadCaretakers = async () => {
    try {
      const users = await getUsers();
      setCaretakers(users.filter(u => u.role === 'caretaker'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleLanguageChange = async (lang) => {
    setLanguage(lang);
    await setSetting('language', lang);
    showToast(
      lang === 'hindi' ? 'भाषा बदल गई' :
      lang === 'gujarati' ? 'ભાષા બદલાઈ ગઈ' :
      'Language changed'
    );
  };

  const handleClearData = async () => {
    setClearing(true);
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name === 'hisaabbot') {
          indexedDB.deleteDatabase(db.name);
        }
      }
      setTransactionCount(0);
      setShowClearConfirm(false);
      sessionStorage.removeItem('currentUser');
      window.location.href = '/';
    } catch (err) {
      console.error('Clear data error:', err);
      showToast('Error clearing data');
      setClearing(false);
    }
  };

  const handleExportData = async () => {
    try {
      const transactions = await getAllTransactions();
      const data = JSON.stringify(transactions, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hisaabbot-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(
        language === 'hindi' ? 'डेटा डाउनलोड हो गया' :
        language === 'gujarati' ? 'ડેટા ડાઉનલોડ થઈ ગયો' :
        'Data exported successfully'
      );
    } catch (err) {
      console.error('Export error:', err);
      showToast('Export failed');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncWithSupabase();
      showToast(
        language === 'hindi' ? `सिंक सफल: ${result.pushed} अपडेट किए गए` :
        language === 'gujarati' ? `સિંક સફળ: ${result.pushed} અપડેટ કર્યા` :
        `Sync successful: ${result.pushed} pushed`
      );
    } catch (err) {
      console.error('Sync error:', err);
      showToast(
        language === 'hindi' ? `सिंक विफल: ${err.message}` :
        language === 'gujarati' ? `સિંક નિષ્ફળ: ${err.message}` :
        `Sync failed: ${err.message}`
      );
    }
    setSyncing(false);
  };

  const handleAddCaretaker = async () => {
    if (!caretakerUsername || caretakerUsername.length < 3) {
      showToast('Username must be at least 3 chars');
      return;
    }
    if (!caretakerPin || caretakerPin.length !== 4) {
      showToast('PIN must be 4 digits');
      return;
    }
    try {
      const pinH = await hashPin(caretakerPin);
      const recKey = generateRecoveryKey();
      const recKeyHash = await hashRecoveryKey(recKey);
      
      await addUser(caretakerUsername, pinH, 'caretaker', recKeyHash);
      setCaretakerRecoveryKey(recKey);
      loadCaretakers();
      // Show success state with recovery key
    } catch (err) {
      showToast(err.message);
    }
  };

  const closeAddCaretaker = () => {
    setShowAddCaretaker(false);
    setCaretakerUsername('');
    setCaretakerPin('');
    setCaretakerRecoveryKey('');
  };

  const handleRemoveCaretaker = async (userId) => {
    if (confirm('Are you sure you want to remove this caretaker?')) {
      try {
        await deleteUser(userId);
        showToast('Caretaker removed');
        loadCaretakers();
      } catch (err) {
        showToast('Error removing caretaker');
      }
    }
  };

  const handleChangePinNext = () => {
    if (newPin.length !== 4) {
      setPinError('PIN must be 4 digits');
      return;
    }
    setPinError('');
    setChangePinStep(2);
  };

  const handleChangePinSubmit = async () => {
    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }
    
    try {
      const pinH = await hashPin(newPin);
      await updateUserPin(currentUser.userId, pinH);
      
      // Also generate a new recovery key for security
      const recKey = generateRecoveryKey();
      const recKeyHash = await hashRecoveryKey(recKey);
      await updateUserRecoveryKey(currentUser.userId, recKeyHash);
      
      setNewRecoveryKey(recKey);
      setChangePinStep(3); // Show recovery key
    } catch (err) {
      setPinError('Failed to update PIN');
    }
  };

  const closeChangePin = () => {
    setShowChangePin(false);
    setChangePinStep(1);
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setNewRecoveryKey('');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    window.location.href = '/';
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const languages = [
    { key: 'hindi', label: 'हिंदी', desc: 'Hindi' },
    { key: 'gujarati', label: 'ગુજરાતી', desc: 'Gujarati' },
    { key: 'english', label: 'English', desc: 'English' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="settings-title">
            {language === 'hindi' ? 'सेटिंग्स' : language === 'gujarati' ? 'સેટિંગ્સ' : 'Settings'}
          </h1>
          <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {language === 'hindi' ? 'ऐप सेटिंग्स प्रबंधित करें' :
             language === 'gujarati' ? 'એપ સેટિંગ્સ મેનેજ કરો' :
             'Manage app settings'}
          </p>
        </div>
        <button onClick={handleLogout} className="btn btn-ghost" style={{
          fontSize: '0.75rem', padding: '8px 14px', minHeight: 'auto', minWidth: 'auto',
          border: '1px solid var(--red-400)', color: 'var(--red-400)', borderRadius: 'var(--radius-full)'
        }}>
          Logout
        </button>
      </div>

      <div className="page-content">
        
        {/* Account Info Section */}
        {currentUser && (
          <div className="settings-group">
            <div className="settings-group-title">Account</div>
            
            <div className="settings-item" style={{ cursor: 'default' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: currentUser.role === 'primary' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <UserIcon size={20} style={{ color: currentUser.role === 'primary' ? 'var(--green-400)' : 'var(--amber-400)' }} />
              </div>
              <div className="info">
                <div className="title">{currentUser.username}</div>
                <div className="desc" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ textTransform: 'capitalize' }}>{currentUser.role}</span>
                  <span>•</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{currentUser.userId}</span>
                </div>
              </div>
            </div>
            
            <div className="settings-item" onClick={() => setShowChangePin(true)} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <LockIcon size={22} style={{ color: 'var(--blue-400)' }} />
              <div className="info">
                <div className="title">Change PIN</div>
                <div className="desc">Update your secure login PIN</div>
              </div>
              <ChevronRightIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          </div>
        )}

        {/* Language Section */}
        <div className="settings-group">
          <div className="settings-group-title">
            {language === 'hindi' ? 'भाषा' : language === 'gujarati' ? 'ભાષા' : 'Language'}
          </div>
          {languages.map(lang => (
            <div
              key={lang.key}
              className={`settings-item ${language === lang.key ? 'settings-item-active' : ''}`}
              onClick={() => handleLanguageChange(lang.key)}
              id={`lang-setting-${lang.key}`}
              style={{
                borderLeft: language === lang.key ? '3px solid var(--green-500)' : '3px solid transparent',
              }}
            >
              <GlobeIcon size={22} style={{
                color: language === lang.key ? 'var(--green-400)' : 'var(--text-tertiary)'
              }} />
              <div className="info">
                <div className="title">{lang.label}</div>
                <div className="desc">{lang.desc}</div>
              </div>
              {language === lang.key && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--green-500)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* User Management Section (Only visible to Primary User) */}
        {currentUser?.role === 'primary' && (
          <div className="settings-group">
            <div className="settings-group-title">Family & Caretakers</div>
            
            <Link href="/caretaker" className="settings-item" style={{ textDecoration: 'none' }}>
              <UsersIcon size={22} style={{ color: 'var(--blue-400)' }} />
              <div className="info">
                <div className="title">View Caretaker Dashboard</div>
                <div className="desc">Review all transactions and export PDFs</div>
              </div>
              <ChevronRightIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </Link>

            <div className="settings-item" onClick={() => setShowAddCaretaker(true)} style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
              <div className="info">
                <div className="title">Add Caretaker Account</div>
                <div className="desc">Create a secure login for a family member</div>
              </div>
            </div>
            
            {caretakers.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {caretakers.map(ct => (
                  <div key={ct.userId} className="settings-item" style={{ cursor: 'default' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-400)', fontWeight: 'bold' }}>
                      {ct.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="info">
                      <div className="title">{ct.username}</div>
                      <div className="desc">{ct.userId}</div>
                    </div>
                    <button onClick={() => handleRemoveCaretaker(ct.userId)} className="btn btn-ghost" style={{ padding: '4px 8px', minHeight: 'auto', minWidth: 'auto', color: 'var(--red-400)' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Data Section */}
        <div className="settings-group">
          <div className="settings-group-title">
            {language === 'hindi' ? 'डेटा' : language === 'gujarati' ? 'ડેટા' : 'Data'}
          </div>

          <div className="settings-item" onClick={handleSync} id="sync-data">
            <CloudIcon size={22} style={{ color: 'var(--blue-400)' }} />
            <div className="info">
              <div className="title">
                {language === 'hindi' ? 'क्लाउड में सिंक करें' :
                 language === 'gujarati' ? 'ક્લાઉડમાં સિંક કરો' :
                 'Sync to Cloud'}
              </div>
              <div className="desc">
                {language === 'hindi' ? 'सुपाबेस पर अपना डेटा बैकअप करें' :
                 language === 'gujarati' ? 'સુપાબેસ પર તમારો ડેટા બેકઅપ કરો' :
                 'Backup your data to Supabase'}
              </div>
            </div>
            {syncing ? (
              <div className="loader" style={{ width: 18, height: 18, border: '2px solid var(--border-medium)', borderTopColor: 'var(--blue-400)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            ) : (
              <ChevronRightIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            )}
          </div>

          <div className="settings-item" onClick={handleExportData} id="export-data" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <DownloadIcon size={22} />
            <div className="info">
              <div className="title">
                {language === 'hindi' ? 'डेटा निर्यात करें' :
                 language === 'gujarati' ? 'ડેટા એક્સપોર્ટ કરો' :
                 'Export Data'}
              </div>
              <div className="desc">
                {language === 'hindi' ? `${transactionCount} लेनदेन JSON में डाउनलोड करें` :
                 language === 'gujarati' ? `${transactionCount} વ્યવહાર JSON માં ડાઉનલોડ કરો` :
                 `Download ${transactionCount} transactions as JSON`}
              </div>
            </div>
            <ChevronRightIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>

          <div
            className="settings-item"
            onClick={() => setShowClearConfirm(true)}
            id="clear-data"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            <XCircleIcon size={22} style={{ color: 'var(--red-400)' }} />
            <div className="info">
              <div className="title" style={{ color: 'var(--red-400)' }}>
                {language === 'hindi' ? 'सारा डेटा मिटाएं' :
                 language === 'gujarati' ? 'બધો ડેટા કાઢી નાખો' :
                 'Clear All Data'}
              </div>
              <div className="desc">
                {language === 'hindi' ? 'सभी लेनदेन और सेटिंग्स हटाएं' :
                 language === 'gujarati' ? 'બધા વ્યવહાર અને સેટિંગ્સ દૂર કરો' :
                 'Remove all transactions and settings'}
              </div>
            </div>
            <ChevronRightIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>
        </div>

        {/* About Section */}
        <div className="settings-group">
          <div className="settings-group-title">
            {language === 'hindi' ? 'जानकारी' : language === 'gujarati' ? 'માહિતી' : 'About'}
          </div>

          <div className="settings-item" style={{ cursor: 'default' }}>
            <InfoIcon size={22} />
            <div className="info">
              <div className="title">HisaabBot</div>
              <div className="desc">v1.1.0 — Secure Voice Finance</div>
            </div>
          </div>

          <div className="settings-item" style={{ cursor: 'default' }}>
            <ShieldIcon size={22} />
            <div className="info">
              <div className="title">
                {language === 'hindi' ? 'गोपनीयता' :
                 language === 'gujarati' ? 'ગોપનીયતા' :
                 'Privacy'}
              </div>
              <div className="desc">
                {language === 'hindi' ? 'आपका डेटा आपके फोन में सुरक्षित रहता है' :
                 language === 'gujarati' ? 'તમારો ડેટા તમારા ફોનમાં સુરક્ષિત રહે છે' :
                 'Your data stays secure on your device'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Data Confirmation Modal */}
      {showClearConfirm && (
        <div className="overlay" onClick={() => setShowClearConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <XCircleIcon size={48} style={{ color: 'var(--red-400)', marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8 }}>
                {language === 'hindi' ? 'क्या आप सुनिश्चित हैं?' :
                 language === 'gujarati' ? 'શું તમે ખાતરી છો?' :
                 'Are you sure?'}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {language === 'hindi' ? 'सारा डेटा स्थायी रूप से मिट जाएगा। यह वापस नहीं आ सकता।' :
                 language === 'gujarati' ? 'બધો ડેટા કાયમ માટે દૂર થઈ જશે. તે પાછો આવી શકતો નથી.' :
                 'All data will be permanently deleted. This cannot be undone.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowClearConfirm(false)}
              >
                {language === 'hindi' ? 'रद्द करें' : language === 'gujarati' ? 'રદ કરો' : 'Cancel'}
              </button>
              <button
                className="btn"
                style={{
                  flex: 1, background: 'var(--red-500)', color: 'white',
                  boxShadow: '0 0 20px var(--red-glow)'
                }}
                onClick={handleClearData}
                disabled={clearing}
              >
                {clearing ? '...'
                  : (language === 'hindi' ? 'हां, मिटाएं' : language === 'gujarati' ? 'હા, કાઢી નાખો' : 'Yes, Clear')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePin && (
        <div className="overlay" onClick={closeChangePin}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <LockIcon size={48} style={{ color: 'var(--blue-400)', marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8 }}>
                Change PIN
              </h3>
              
              {changePinStep === 1 && (
                <>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Enter a new 4-digit PIN for your account.
                  </p>
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => { setNewPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setPinError(''); }}
                    placeholder="****"
                    style={{
                      width: '100%', padding: '16px', fontSize: '2rem',
                      textAlign: 'center', letterSpacing: '0.5em',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: 16
                    }}
                    autoFocus
                  />
                  {pinError && <p style={{ color: 'var(--red-400)', fontSize: '0.875rem', marginBottom: 16 }}>{pinError}</p>}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={closeChangePin}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleChangePinNext}>Next</button>
                  </div>
                </>
              )}
              
              {changePinStep === 2 && (
                <>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Confirm your new 4-digit PIN.
                  </p>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => { setConfirmPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); setPinError(''); }}
                    placeholder="****"
                    style={{
                      width: '100%', padding: '16px', fontSize: '2rem',
                      textAlign: 'center', letterSpacing: '0.5em',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: 16
                    }}
                    autoFocus
                  />
                  {pinError && <p style={{ color: 'var(--red-400)', fontSize: '0.875rem', marginBottom: 16 }}>{pinError}</p>}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setChangePinStep(1)}>Back</button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleChangePinSubmit}>Confirm</button>
                  </div>
                </>
              )}
              
              {changePinStep === 3 && (
                <>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    PIN updated! Since your PIN changed, here is your <strong>new Recovery Key</strong>. Please save it.
                  </p>
                  <div style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--amber-400)', padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--amber-400)', fontFamily: 'monospace' }}>
                      {newRecoveryKey}
                    </span>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={closeChangePin}>Done</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Caretaker Modal */}
      {showAddCaretaker && (
        <div className="overlay" onClick={caretakerRecoveryKey ? undefined : closeAddCaretaker}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <UsersIcon size={48} style={{ color: 'var(--amber-400)', marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8 }}>
                Add Caretaker
              </h3>
              
              {!caretakerRecoveryKey ? (
                <>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    Create an account for a family member. They will only have access to the Caretaker Dashboard.
                  </p>
                  
                  <div style={{ marginTop: 20, textAlign: 'left' }}>
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>Username</label>
                    <input
                      type="text"
                      value={caretakerUsername}
                      onChange={(e) => setCaretakerUsername(e.target.value)}
                      placeholder="e.g. Son"
                      style={{
                        width: '100%', padding: '12px', fontSize: '1rem',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: 16
                      }}
                    />
                    
                    <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>4-Digit PIN</label>
                    <input
                      type="password"
                      value={caretakerPin}
                      onChange={(e) => setCaretakerPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                      placeholder="****"
                      style={{
                        width: '100%', padding: '12px', fontSize: '1.5rem',
                        textAlign: 'center', letterSpacing: '0.5em',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                        borderRadius: 'var(--radius-md)', color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={closeAddCaretaker}>Cancel</button>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddCaretaker}>Create</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Caretaker created! Please give them this <strong>Recovery Key</strong> in case they forget their PIN.
                  </p>
                  <div style={{ background: 'var(--bg-secondary)', border: '2px dashed var(--amber-400)', padding: 16, borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.15em', color: 'var(--amber-400)', fontFamily: 'monospace' }}>
                      {caretakerRecoveryKey}
                    </span>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={closeAddCaretaker}>Done</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast success">{toast}</div>
      )}

      <BottomNav />
    </div>
  );
}

