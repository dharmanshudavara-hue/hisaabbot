'use client';

import { useState, useEffect } from 'react';
import BottomNav from '../components/BottomNav';
import { BellIcon, ClockIcon, ArrowUpIcon, ArrowDownIcon } from '../components/Icons';
import { getUpcomingDues, getOverdueLoans, getSetting } from '../../lib/db';

export default function AlertsPage() {
  const [language, setLanguage] = useState('hindi');
  const [overdue, setOverdue] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    getSetting('language').then(l => { if (l) setLanguage(l); }).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const overdueLoans = await getOverdueLoans();
      const upcomingDues = await getUpcomingDues();
      // Separate overdue from truly upcoming
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const upcomingOnly = upcomingDues.filter(t => t.due_date >= todayStr);
      setOverdue(overdueLoans);
      setUpcoming(upcomingOnly);
    } catch (err) {
      console.error('Error loading alerts:', err);
    }
    setLoading(false);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getDaysText = (dueDate) => {
    const days = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) {
      const abs = Math.abs(days);
      return language === 'hindi' ? `${abs} दिन पहले` :
             language === 'gujarati' ? `${abs} દિવસ પહેલા` :
             `${abs}d overdue`;
    }
    if (days === 0) return language === 'hindi' ? 'आज' : language === 'gujarati' ? 'આજે' : 'Today';
    if (days === 1) return language === 'hindi' ? 'कल' : language === 'gujarati' ? 'આવતીકાલ' : 'Tomorrow';
    return language === 'hindi' ? `${days} दिन बाकी` :
           language === 'gujarati' ? `${days} દિવસ બાકી` :
           `${days}d left`;
  };

  const hasAlerts = overdue.length > 0 || upcoming.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="alerts-title">
            {language === 'hindi' ? 'अलर्ट' : language === 'gujarati' ? 'ચેતવણી' : 'Alerts'}
          </h1>
          <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {language === 'hindi' ? 'बकाया और आने वाली तारीखें' :
             language === 'gujarati' ? 'બાકી અને આવનારી તારીખો' :
             'Overdue & upcoming dues'}
          </p>
        </div>
        {hasAlerts && (
          <div className="alert-badge">
            <span className="tag tag-amber" style={{ fontSize: '0.875rem', padding: '6px 14px' }}>
              {overdue.length + upcoming.length}
            </span>
          </div>
        )}
      </div>

      <div className="page-content">
        {loading ? (
          <div className="stacked-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 80, marginBottom: 10 }} />
            ))}
          </div>
        ) : !hasAlerts ? (
          <div className="empty-state">
            <BellIcon size={64} />
            <div className="title">
              {language === 'hindi' ? 'कोई अलर्ट नहीं' :
               language === 'gujarati' ? 'કોઈ ચેતવણી નથી' :
               'No Alerts'}
            </div>
            <div className="desc">
              {language === 'hindi' ? 'सब कुछ ठीक है! कोई बकाया या आने वाली तारीख नहीं।' :
               language === 'gujarati' ? 'બધું બરાબર છે! કોઈ બાકી નથી.' :
               'All clear! No pending or upcoming dues.'}
            </div>
          </div>
        ) : (
          <>
            {/* Overdue Section */}
            {overdue.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div className="section-header">
                  <div className="section-title">
                    <ClockIcon size={18} style={{ color: 'var(--red-400)' }} />
                    <span style={{ color: 'var(--red-400)' }}>
                      {language === 'hindi' ? 'बकाया' : language === 'gujarati' ? 'બાકી' : 'Overdue'}
                    </span>
                  </div>
                  <span className="tag tag-red">{overdue.length}</span>
                </div>
                <div className="stacked-list">
                  {overdue.map(loan => (
                    <div key={loan.id} className="alert-item" id={`alert-${loan.id}`}
                         style={{ borderLeft: '3px solid var(--red-500)' }}>
                      <div className="alert-dot urgent" />
                      <div className="alert-content">
                        <div className="title">{loan.person_name || 'Unknown'}</div>
                        <div className="subtitle">
                          {loan.type === 'lent'
                            ? (language === 'hindi' ? 'वसूलना है' : language === 'gujarati' ? 'લેવાના' : 'To receive')
                            : (language === 'hindi' ? 'देना है' : language === 'gujarati' ? 'આપવાના' : 'To pay')
                          } • {getDaysText(loan.due_date)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{
                          fontSize: '1.125rem', fontWeight: 700,
                          color: loan.type === 'lent' ? 'var(--green-400)' : 'var(--red-400)'
                        }}>
                          ₹{loan.amount.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.688rem', color: 'var(--text-tertiary)' }}>
                          {formatDate(loan.due_date)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Section */}
            {upcoming.length > 0 && (
              <div>
                <div className="section-header">
                  <div className="section-title">
                    <BellIcon size={18} style={{ color: 'var(--amber-400)' }} />
                    <span>
                      {language === 'hindi' ? 'जल्द आने वाले' : language === 'gujarati' ? 'આવનારા' : 'Upcoming'}
                    </span>
                  </div>
                  <span className="tag tag-amber">{upcoming.length}</span>
                </div>
                <div className="stacked-list">
                  {upcoming.map(loan => {
                    const days = Math.ceil((new Date(loan.due_date) - new Date()) / (1000 * 60 * 60 * 24));
                    const isUrgent = days <= 3;
                    return (
                      <div key={loan.id} className="alert-item" id={`alert-${loan.id}`}
                           style={{ borderLeft: `3px solid ${isUrgent ? 'var(--amber-500)' : 'var(--blue-500)'}` }}>
                        <div className={`alert-dot ${isUrgent ? 'warning' : 'info'}`} />
                        <div className="alert-content">
                          <div className="title">{loan.person_name || 'Unknown'}</div>
                          <div className="subtitle">
                            {loan.type === 'lent'
                              ? (language === 'hindi' ? 'वसूलना है' : language === 'gujarati' ? 'લેવાના' : 'To receive')
                              : (language === 'hindi' ? 'देना है' : language === 'gujarati' ? 'આપવાના' : 'To pay')
                            } • {getDaysText(loan.due_date)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{
                            fontSize: '1.125rem', fontWeight: 700,
                            color: loan.type === 'lent' ? 'var(--green-400)' : 'var(--red-400)'
                          }}>
                            ₹{loan.amount.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.688rem', color: 'var(--text-tertiary)' }}>
                            {formatDate(loan.due_date)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
