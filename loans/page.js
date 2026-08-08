'use client';

import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { WalletIcon, ArrowUpIcon, ArrowDownIcon, CheckCircleIcon, ClockIcon, ChevronRightIcon, TrashIcon } from '../components/Icons';
import { getOpenLoans, getSettledLoans, getAllTransactions, settleLoan, deleteTransaction, calculateInterest } from '../../lib/db';
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

      const lentTotal = open.filter(t => t.type === 'lent').reduce((s, t) => {
        const { totalWithInterest } = calculateInterest(t.amount, t.interest_rate, t.created_at);
        return s + totalWithInterest;
      }, 0);
      const borrowedTotal = open.filter(t => t.type === 'borrowed').reduce((s, t) => {
        const { totalWithInterest } = calculateInterest(t.amount, t.interest_rate, t.created_at);
        return s + totalWithInterest;
      }, 0);
      setTotals({ lent: lentTotal, borrowed: borrowedTotal });
    } catch (err) {
      console.error('Error loading loans:', err);
    }
  };

  const handleSettle = async (id, personName, amount, interest) => {
    setSettlingId(id);
    try {
      await settleLoan(id);
      if (navigator.vibrate) navigator.vibrate([50, 100, 50]);
      
      const totalAmount = amount + (interest || 0);
      
      const msg = language === 'hindi'
        ? `${personName} ka ₹${totalAmount} settled ho gaya`
        : language === 'gujarati'
        ? `${personName} na ₹${totalAmount} settled thai gaya`
        : `₹${totalAmount} from ${personName} settled`;
      
      await speak(msg, language);
      await loadData();
    } catch (err) {
      console.error('Error settling loan:', err);
    }
    setSettlingId(null);
  };

  const handleDelete = async (id, personName, amount) => {
    if (!window.confirm(language === 'hindi' ? 'क्या आप वाकई इसे हटाना चाहते हैं?' : language === 'gujarati' ? 'શું તમે ખરેખર આને કાઢી નાખવા માંગો છો?' : 'Are you sure you want to delete this?')) return;
    try {
      await deleteTransaction(id);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      
      const msg = language === 'hindi'
        ? `${personName} ka ₹${amount} delete ho gaya`
        : language === 'gujarati'
        ? `${personName} na ₹${amount} delete thai gaya`
        : `₹${amount} from ${personName} deleted`;
      
      await speak(msg, language);
      await loadData();
    } catch (err) {
      console.error('Error deleting loan:', err);
    }
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
              <ArrowDownIcon size={20} />
            </div>
            <div className="value green">₹{totals.lent.toLocaleString('en-IN')}</div>
            <div className="label">
              {language === 'hindi' ? 'वसूलना है' : language === 'gujarati' ? 'લેવાના' : 'To Receive'}
            </div>
          </div>
          <div className="summary-card">
            <div className="icon-wrap red">
              <ArrowUpIcon size={20} />
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
            currentList.map((loan) => {
              // Calculate interest if loan is open, otherwise interest is frozen or wasn't tracked historically.
              // For v1, if it's settled, we just show original amount, or we could calculate up to settled_at.
              const calculationDate = activeTab === 'settled' && loan.settled_at ? loan.settled_at : undefined;
              let calcData = { interest: 0, totalWithInterest: loan.amount, monthsElapsed: 0 };
              
              if (loan.interest_rate) {
                // If it's settled, use settled_at instead of now to calculate interest
                // Need to slightly modify calculateInterest logic for settled loans if we want accurate history,
                // but since calculateInterest takes 'now' by default, we can just pass the start date.
                // Actually, let's just use the current time for simplicity unless it's settled.
                // We'll calculate it inline if it's settled.
                if (activeTab === 'settled' && loan.settled_at) {
                    const diffMs = new Date(loan.settled_at) - new Date(loan.created_at);
                    const months = diffMs / (1000 * 60 * 60 * 24 * 30.44);
                    if(months > 0) {
                        const i = Math.round(loan.amount * (loan.interest_rate / 100) * months);
                        calcData = { interest: i, totalWithInterest: loan.amount + i, monthsElapsed: Math.round(months * 10) / 10 };
                    }
                } else {
                    calcData = calculateInterest(loan.amount, loan.interest_rate, loan.created_at);
                }
              }

              const { interest, totalWithInterest } = calcData;

              return (
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
                    {loan.interest_rate && (
                      <span className="interest-badge">
                         {loan.interest_rate}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="loan-amount">
                  <div className={`amount ${loan.type}`}>
                    ₹{totalWithInterest.toLocaleString('en-IN')}
                  </div>
                  {interest > 0 && (
                    <div className="interest-detail" style={{ justifyContent: 'flex-end', marginTop: 2 }}>
                       +₹{interest.toLocaleString('en-IN')} int.
                    </div>
                  )}
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
                        handleSettle(loan.id, loan.person_name, loan.amount, interest);
                      }}
                      disabled={settlingId === loan.id}
                      id={`settle-${loan.id}`}
                    >
                      {settlingId === loan.id ? '...' : (language === 'hindi' ? 'चुकता' : 'Settle')}
                    </button>
                  )}
                  <button
                    className="btn btn-ghost"
                    style={{
                      fontSize: '0.688rem',
                      padding: '6px',
                      minHeight: 'auto',
                      minWidth: 'auto',
                      marginTop: 6,
                      color: 'var(--red-400)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 'var(--radius-full)',
                      marginLeft: 6,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(loan.id, loan.person_name, loan.amount);
                    }}
                    title={language === 'hindi' ? 'हटाएं' : 'Delete'}
                    aria-label="Delete"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            )})
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

