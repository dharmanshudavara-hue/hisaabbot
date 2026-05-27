'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import {
  SettingsIcon, GlobeIcon, ShieldIcon, InfoIcon,
  DownloadIcon, XCircleIcon, ChevronRightIcon, CloudIcon,
  UsersIcon, LockIcon
} from '../components/Icons';
import { getSetting, setSetting, getAllTransactions, syncWithSupabase } from '../../lib/db';

export default function SettingsPage() {
  const [language, setLanguage] = useState('hindi');
  const [transactionCount, setTransactionCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCaretakerPin, setShowCaretakerPin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [clearing, setClearing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    getSetting('language').then(l => { if (l) setLanguage(l); }).catch(() => {});
    getAllTransactions().then(t => setTransactionCount(t.length)).catch(() => {});
  }, []);

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
      // Clear IndexedDB
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name === 'hisaabbot') {
          indexedDB.deleteDatabase(db.name);
        }
      }
      setTransactionCount(0);
      setShowClearConfirm(false);
      showToast(
        language === 'hindi' ? 'सारा डेटा मिटा दिया गया' :
        language === 'gujarati' ? 'બધો ડેટા કાઢી નાખ્યો' :
        'All data cleared'
      );
    } catch (err) {
      console.error('Clear data error:', err);
      showToast('Error clearing data');
    }
    setClearing(false);
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
        language === 'hindi' ? 'सिंक विफल: कृपया .env.local जांचें' :
        language === 'gujarati' ? 'સિંક નિષ્ફળ: કૃપા કરીને .env.local તપાસો' :
        'Sync failed: check .env.local keys'
      );
    }
    setSyncing(false);
  };

  const handlePinSubmit = () => {
    if (pinInput === '1234') {
      window.location.href = '/caretaker';
    } else {
      showToast('Incorrect PIN');
      setPinInput('');
    }
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
        <Link href="/" className="btn btn-ghost" style={{
          fontSize: '0.75rem', padding: '8px 14px', minHeight: 'auto', minWidth: 'auto',
          border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-full)'
        }}>
          {language === 'hindi' ? 'होम' : 'Home'}
        </Link>
      </div>

      <div className="page-content">
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

          <div className="settings-item" onClick={() => setShowCaretakerPin(true)} id="caretaker-mode" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <UsersIcon size={22} style={{ color: 'var(--amber-400)' }} />
            <div className="info">
              <div className="title">
                {language === 'hindi' ? 'केयरटेकर मोड' :
                 language === 'gujarati' ? 'કેરટેકર મોડ' :
                 'Caretaker Mode'}
              </div>
              <div className="desc">
                {language === 'hindi' ? 'सभी लेनदेन की विस्तृत समीक्षा करें' :
                 language === 'gujarati' ? 'બધા વ્યવહારની વિગતવાર સમીક્ષા કરો' :
                 'Detailed review of all transactions'}
              </div>
            </div>
            <LockIcon size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          </div>

          <div
            className="settings-item"
            onClick={() => setShowClearConfirm(true)}
            id="clear-data"
            style={{ borderLeft: '3px solid transparent' }}
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
              <div className="desc">v1.0.0 — Voice Finance Assistant</div>
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

      {/* Caretaker PIN Modal */}
      {showCaretakerPin && (
        <div className="overlay" onClick={() => setShowCaretakerPin(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <LockIcon size={48} style={{ color: 'var(--amber-400)', marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8 }}>
                {language === 'hindi' ? 'केयरटेकर पिन दर्ज करें' :
                 language === 'gujarati' ? 'કેરટેકર પિન દાખલ કરો' :
                 'Enter Caretaker PIN'}
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {language === 'hindi' ? 'डिफ़ॉल्ट पिन: 1234' :
                 language === 'gujarati' ? 'ડિફૉલ્ટ પિન: 1234' :
                 'Default PIN: 1234'}
              </p>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="****"
                style={{
                  marginTop: 16, width: '100%', padding: '12px', fontSize: '1.5rem',
                  textAlign: 'center', letterSpacing: '0.5em',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-primary)'
                }}
                maxLength={4}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowCaretakerPin(false)}
              >
                {language === 'hindi' ? 'रद्द करें' : language === 'gujarati' ? 'રદ કરો' : 'Cancel'}
              </button>
              <button
                className="btn"
                style={{
                  flex: 1, background: 'var(--green-500)', color: 'white',
                }}
                onClick={handlePinSubmit}
              >
                {language === 'hindi' ? 'प्रवेश करें' : language === 'gujarati' ? 'પ્રવેશ કરો' : 'Enter'}
              </button>
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
