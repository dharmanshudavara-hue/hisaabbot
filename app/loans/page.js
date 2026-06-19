'use client';

import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { WalletIcon, ArrowUpIcon, ArrowDownIcon, CheckCircleIcon, ClockIcon, ChevronRightIcon } from '../components/Icons';
import { getOpenLoans, getSettledLoans, getAllTransactions, settleLoan } from '../../lib/db';
import { speak } from '../../lib/speech';
import { getSetting } from '../../lib/db';

export default function LoansPage() {
  const [activeTab, setActiveTab] = useState('open');
  const [openLoans, setOpenLoans] = useState([]);
  const [settledLoansData, setSettledLoansData] = useState([]);
  const [language, setLanguage] = useState('hindi');
  const [totals, setTotals] = useState({ lent: 0, borrowed: 0 });
  const [settlingId, setSettlingId] = useState(null);

  useEffect(() => {
    loadData();
    getSetting('language').then(l => { if (l) setLanguage(l); }).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const open = await getOpenLoans();
      const settled = await getSettledLoans();
      setOpenLoans(open);
      setSettledLoansData(settled);

      const lentTotal = open.filter(t => t.type === 'lent').reduce((s, t) => s + t.amount, 0);
      const borrowedTotal = open.filter(t => t.type === 'borrowed').reduce((s, t) => s + t.amount, 0);
      setTotals({ lent: lentTotal, borrowed: borrowedTotal });
    } catch (err) {
      console.error('Error loading loans:', err);
    }
  };

  const handleSettle = async (id, personName, amount) => {
    setSettlingId(id);
    try {
      await settleLoan(id);
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      
      const msg = language === 'hindi'
        ? `${personName} ka ₹${amount} settled ho gaya`
        : language === 'gujarati'
        ? `${personName} na ₹${amount} settled thai gaya`
        : `₹${amount} from ${personName} settled`;
      
      await speak(msg, language);
      await loadData();
    } catch (err) {
      console.error('Error settling loan:', err);
    }
    setSettlingId(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const now = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getDueTag = (dueDate) => {
    const days = getDaysUntilDue(dueDate);
    if (days === null) return null;
    if (days < 0) return <span className="tag tag-red">Overdue</span>;
    if (days <= 3) return <span className="tag tag-amber">{days}d left</span>;
    return <span className="tag tag-blue">{days}d left</span>;
  };

  const currentList = activeTab === 'open' ? openLoans : settledLoansData;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title" id="loans-title">
          {language === 'hindi' ? 'उधार खाता' : language === 'gujarati' ? 'ઉધાર ખાતું' : 'Loan Book'}
        </h1>
      </div>

      <div className="page-content">
        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="icon-wrap green">
              <ArrowUpIcon size={20} />
            </div>
            <div className="value green">₹{totals.lent.toLocaleString('en-IN')}</div>
            <div className="label">
              {language === 'hindi' ? 'वसूलना है' : language === 'gujarati' ? 'લેવાના' : 'To Receive'}
            </div>
          </div>
          <div className="summary-card">
            <div className="icon-wrap red">
              <ArrowDownIcon size={20} />
            </div>
            <div className="value red">₹{totals.borrowed.toLocaleString('en-IN')}</div>
            <div className="label">
              {language === 'hindi' ? 'देना है' : language === 'gujarati' ? 'આપવાના' : 'To Pay'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tab-bar">
          <button
            className={`tab-item ${activeTab === 'open' ? 'active' : ''}`}
            onClick={() => setActiveTab('open')}
            id="tab-open"
          >
            <ClockIcon size={18} />
            {language === 'hindi' ? 'चालू' : language === 'gujarati' ? 'ચાલુ' : 'Open'}
          </button>
          <button
            className={`tab-item ${activeTab === 'settled' ? 'active' : ''}`}
            onClick={() => setActiveTab('settled')}
            id="tab-settled"
          >
            <CheckCircleIcon size={18} />
            {language === 'hindi' ? 'चुकता' : language === 'gujarati' ? 'પૂર્ણ' : 'Settled'}
          </button>
        </div>

        {/* Loan List */}
        <div className="stacked-list">
          {currentList.length === 0 ? (
            <div className="empty-state">
              <WalletIcon size={64} />
              <div className="title">
                {activeTab === 'open'
                  ? (language === 'hindi' ? 'कोई उधार नहीं' : 'No open loans')
                  : (language === 'hindi' ? 'कोई चुकता नहीं' : 'No settled loans')}
              </div>
              <div className="desc">
                {language === 'hindi' ? 'माइक दबाकर उधार रिकॉर्ड करें' : 'Use voice to record loans'}
              </div>
            </div>
          ) : (
            currentList.map((loan) => (
              <div key={loan.id} className="loan-card" id={`loan-${loan.id}`}>
                <div className={`loan-avatar ${loan.type}`}>
                  {loan.person_name ? loan.person_name.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="loan-info">
                  <div className="loan-name">{loan.person_name || 'Unknown'}</div>
                  {loan.raw_transcript && (
                    <div style={{ fontSize: '0.813rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px', marginBottom: '4px' }}>
                      "{loan.raw_transcript.length > 50 ? loan.raw_transcript.slice(0, 50) + '...' : loan.raw_transcript}"
                    </div>
                  )}
                  <div className="loan-date">
                    {formatDate(loan.created_at)}
                    {loan.due_date && ` • Due ${formatDate(loan.due_date)}`}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`tag ${loan.type === 'lent' ? 'tag-green' : 'tag-red'}`}>
                      {loan.type === 'lent'
                        ? (language === 'hindi' ? 'दिया' : 'Lent')
                        : (language === 'hindi' ? 'लिया' : 'Borrowed')}
                    </span>
                    {activeTab === 'open' && getDueTag(loan.due_date)}
                    {activeTab === 'settled' && (
                      <span className="tag tag-green">
                        <CheckCircleIcon size={12} /> Settled
                      </span>
                    )}
                  </div>
                </div>
                <div className="loan-amount">
                  <div className={`amount ${loan.type}`}>
                    ₹{loan.amount.toLocaleString('en-IN')}
                  </div>
                  {activeTab === 'open' && (
                    <button
                      className="btn btn-ghost"
                      style={{
                        fontSize: '0.688rem',
                        padding: '6px 10px',
                        minHeight: 'auto',
                        minWidth: 'auto',
                        marginTop: 6,
                        color: 'var(--green-400)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: 'var(--radius-full)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSettle(loan.id, loan.person_name, loan.amount);
                      }}
                      disabled={settlingId === loan.id}
                      id={`settle-${loan.id}`}
                    >
                      {settlingId === loan.id ? '...' : (language === 'hindi' ? 'चुकता' : 'Settle')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
