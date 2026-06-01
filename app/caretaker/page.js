'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAllTransactions } from '../../lib/db';
import { ChevronRightIcon, DownloadIcon, UserIcon } from '../components/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CaretakerPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
    const storedUser = sessionStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const all = await getAllTransactions();
      // Sort by newest first
      const sorted = all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setTransactions(sorted);
    } catch (err) {
      console.error('Error loading data:', err);
    }
    setLoading(false);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('HisaabBot - Complete Transaction History', 14, 15);
    
    const tableColumn = ['Date', 'Type', 'Person/Category', 'Amount (Rs)', 'Summary'];
    const tableRows = [];

    const filteredTransactions = transactions.filter(t => filterType === 'all' || t.type === filterType);

    filteredTransactions.forEach(t => {
      const date = new Date(t.created_at).toLocaleDateString();
      const type = t.type.charAt(0).toUpperCase() + t.type.slice(1);
      const personCat = t.person_name || t.category || '-';
      const amount = t.amount.toString();
      const summary = t.summary || '-';
      
      tableRows.push([date, type, personCat, amount, summary]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 25,
    });

    doc.save(`hisaabbot-history-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredTransactions = transactions.filter(t => filterType === 'all' || t.type === filterType);

  const totalLent = filteredTransactions.filter(t => t.type === 'lent').reduce((sum, t) => sum + t.amount, 0);
  const totalBorrowed = filteredTransactions.filter(t => t.type === 'borrowed').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="page" style={{ paddingBottom: 20 }}>
      <div className="page-header" style={{ paddingBottom: 16 }}>
        <div>
          <h1 className="page-title">Caretaker Dashboard</h1>
          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: '0.813rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{currentUser.username}</span>
              <span style={{ fontSize: '0.688rem', padding: '2px 6px', background: 'rgba(245,158,11,0.15)', color: 'var(--amber-400)', borderRadius: 12, fontFamily: 'monospace' }}>
                {currentUser.userId}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { sessionStorage.removeItem('currentUser'); window.location.href = '/'; }} className="btn btn-ghost" style={{
            fontSize: '0.75rem', padding: '8px 14px', minHeight: 'auto', minWidth: 'auto',
            border: '1px solid var(--red-400)', color: 'var(--red-400)', borderRadius: 'var(--radius-full)'
          }}>
            Logout
          </button>
        </div>
      </div>

      <div className="page-content" style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button 
            className={`btn ${filterType === 'all' ? '' : 'btn-secondary'}`} 
            style={{ flex: 1, padding: '8px 0', minHeight: 'auto', fontSize: '0.875rem' }}
            onClick={() => setFilterType('all')}
          >All</button>
          <button 
            className={`btn ${filterType === 'lent' ? '' : 'btn-secondary'}`} 
            style={{ flex: 1, padding: '8px 0', minHeight: 'auto', fontSize: '0.875rem' }}
            onClick={() => setFilterType('lent')}
          >Lent</button>
          <button 
            className={`btn ${filterType === 'borrowed' ? '' : 'btn-secondary'}`} 
            style={{ flex: 1, padding: '8px 0', minHeight: 'auto', fontSize: '0.875rem' }}
            onClick={() => setFilterType('borrowed')}
          >Borrowed</button>
          <button 
            className={`btn ${filterType === 'expense' ? '' : 'btn-secondary'}`} 
            style={{ flex: 1, padding: '8px 0', minHeight: 'auto', fontSize: '0.875rem' }}
            onClick={() => setFilterType('expense')}
          >Expense</button>
        </div>

        <div className="summary-grid" style={{ marginBottom: 20 }}>
          <div className="summary-card" style={{ padding: '12px' }}>
            <div className="label">Total Lent</div>
            <div className="value green" style={{ fontSize: '1.25rem' }}>₹{totalLent.toLocaleString('en-IN')}</div>
          </div>
          <div className="summary-card" style={{ padding: '12px' }}>
            <div className="label">Total Borrowed</div>
            <div className="value red" style={{ fontSize: '1.25rem' }}>₹{totalBorrowed.toLocaleString('en-IN')}</div>
          </div>
          <div className="summary-card" style={{ padding: '12px' }}>
            <div className="label">Total Expense</div>
            <div className="value amber" style={{ fontSize: '1.25rem' }}>₹{totalExpense.toLocaleString('en-IN')}</div>
          </div>
          <div className="summary-card" style={{ padding: '12px', background: 'var(--blue-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={exportPDF}>
            <DownloadIcon size={20} style={{ marginRight: 6 }} />
            <span style={{ fontWeight: 'bold' }}>Export PDF</span>
          </div>
        </div>

        <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>Loading data...</div>
          ) : filteredTransactions.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>No transactions found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-medium)' }}>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Details</th>
                    <th style={{ padding: '12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px' }}>{new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                          background: t.type === 'lent' ? 'rgba(16,185,129,0.1)' : t.type === 'borrowed' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                          color: t.type === 'lent' ? 'var(--green-400)' : t.type === 'borrowed' ? 'var(--red-400)' : 'var(--amber-400)'
                        }}>
                          {t.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{t.person_name || t.category || '-'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t.summary}</div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, 
                          color: t.type === 'lent' ? 'var(--green-400)' : t.type === 'borrowed' ? 'var(--red-400)' : 'var(--amber-400)'
                      }}>
                        ₹{t.amount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
