'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import {
  RupeeIcon, FoodIcon, TransportIcon, MedicineIcon,
  HouseIcon, BriefcaseIcon, PackageIcon, CalendarIcon,
  ChevronRightIcon, ClockIcon, ChartIcon
} from '../components/Icons';
import { getTodayExpenses, getExpensesByRange, getAllTransactions, getSetting } from '../../lib/db';

const CATEGORY_META = {
  food: { icon: FoodIcon, label: { hindi: 'खाना', gujarati: 'ખોરાક', english: 'Food' }, colorClass: 'food' },
  transport: { icon: TransportIcon, label: { hindi: 'यात्रा', gujarati: 'મુસાફરી', english: 'Transport' }, colorClass: 'transport' },
  medicine: { icon: MedicineIcon, label: { hindi: 'दवाई', gujarati: 'દવા', english: 'Medicine' }, colorClass: 'medicine' },
  house: { icon: HouseIcon, label: { hindi: 'घर', gujarati: 'ઘર', english: 'House' }, colorClass: 'house' },
  business: { icon: BriefcaseIcon, label: { hindi: 'व्यापार', gujarati: 'ધંધો', english: 'Business' }, colorClass: 'business' },
  other: { icon: PackageIcon, label: { hindi: 'अन्य', gujarati: 'અન્ય', english: 'Other' }, colorClass: 'other' },
};

export default function ExpensesPage() {
  const [language, setLanguage] = useState('hindi');
  const [period, setPeriod] = useState('today'); // today, week, month
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetting('language').then(l => { if (l) setLanguage(l); }).catch(() => {});
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [period]);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      let data;
      const now = new Date();

      if (period === 'today') {
        data = await getTodayExpenses();
      } else if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        data = await getExpensesByRange(
          weekAgo.toISOString().split('T')[0],
          now.toISOString().split('T')[0]
        );
      } else {
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        data = await getExpensesByRange(monthStart, now.toISOString().split('T')[0]);
      }

      setExpenses(data || []);
    } catch (err) {
      console.error('Error loading expenses:', err);
    }
    setLoading(false);
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const categoryTotals = {};
  expenses.forEach(e => {
    const cat = e.category || 'other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + e.amount;
  });

  const sortedCategories = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
  const maxCat = Math.max(...Object.values(categoryTotals), 1);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (period === 'today') {
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const periodLabels = {
    today: { hindi: 'आज', gujarati: 'આજે', english: 'Today' },
    week: { hindi: 'इस हफ्ते', gujarati: 'આ અઠવાડિયે', english: 'This Week' },
    month: { hindi: 'इस महीने', gujarati: 'આ મહિને', english: 'This Month' },
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="expenses-title">
            {language === 'hindi' ? 'खर्चे' : language === 'gujarati' ? 'ખર્ચ' : 'Expenses'}
          </h1>
          <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {periodLabels[period][language] || periodLabels[period].english}
          </p>
        </div>
        <Link href="/reports" className="btn btn-ghost" style={{
          fontSize: '0.75rem', padding: '8px 14px', minHeight: 'auto', minWidth: 'auto',
          border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-full)'
        }}>
          {language === 'hindi' ? 'रिपोर्ट' : 'Reports'}
          <ChevronRightIcon size={14} />
        </Link>
      </div>

      <div className="page-content">
        {/* Period Tabs */}
        <div className="tab-bar" id="period-tabs">
          {['today', 'week', 'month'].map(p => (
            <button
              key={p}
              className={`tab-item ${period === p ? 'active' : ''}`}
              onClick={() => setPeriod(p)}
              id={`tab-${p}`}
            >
              {p === 'today' && <ClockIcon size={16} />}
              {p === 'week' && <CalendarIcon size={16} />}
              {p === 'month' && <ChartIcon size={16} />}
              {periodLabels[p][language] || periodLabels[p].english}
            </button>
          ))}
        </div>

        {/* Total Card */}
        <div className="card-glass" style={{
          textAlign: 'center', padding: '24px 20px', marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.05))'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {language === 'hindi' ? 'कुल खर्चा' : language === 'gujarati' ? 'કુલ ખર્ચ' : 'Total Spent'}
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: -1.5, color: 'var(--amber-400)' }}>
            ₹{totalAmount.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
            {expenses.length} {language === 'hindi' ? 'लेनदेन' : language === 'gujarati' ? 'વ્યવહાર' : 'transactions'}
          </div>
        </div>

        {loading ? (
          <div className="stacked-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 72, marginBottom: 10 }} />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            <RupeeIcon size={64} />
            <div className="title">
              {language === 'hindi' ? 'कोई खर्चा नहीं' :
               language === 'gujarati' ? 'કોઈ ખર્ચ નથી' :
               'No Expenses'}
            </div>
            <div className="desc">
              {language === 'hindi' ? 'माइक दबाकर खर्चा रिकॉर्ड करें' :
               language === 'gujarati' ? 'માઇક દબાવીને ખર્ચ રેકોર્ડ કરો' :
               'Use voice to record expenses'}
            </div>
          </div>
        ) : (
          <>
            {/* Category Breakdown */}
            {sortedCategories.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div className="section-header">
                  <div className="section-title">
                    <RupeeIcon size={18} />
                    {language === 'hindi' ? 'श्रेणी अनुसार' : language === 'gujarati' ? 'શ્રેણી પ્રમાણે' : 'By Category'}
                  </div>
                </div>
                <div className="stacked-list">
                  {sortedCategories.map(([cat, amount]) => {
                    const meta = CATEGORY_META[cat] || CATEGORY_META.other;
                    const Icon = meta.icon;
                    const pct = totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0;
                    const barWidth = Math.round((amount / maxCat) * 100);
                    return (
                      <div key={cat} className="expense-item">
                        <div className={`expense-icon ${meta.colorClass}`}>
                          <Icon size={22} />
                        </div>
                        <div className="expense-info" style={{ flex: 1 }}>
                          <div className="title">{meta.label[language] || meta.label.english}</div>
                          <div style={{ marginTop: 6 }}>
                            <div className="progress-bar-track">
                              <div className={`progress-bar-fill ${meta.colorClass}`}
                                   style={{ width: `${barWidth}%` }} />
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--amber-400)' }}>
                            ₹{amount.toLocaleString('en-IN')}
                          </div>
                          <div style={{ fontSize: '0.688rem', color: 'var(--text-tertiary)' }}>{pct}%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Individual Expenses */}
            <div>
              <div className="section-header">
                <div className="section-title">
                  <CalendarIcon size={18} />
                  {language === 'hindi' ? 'सभी खर्चे' : language === 'gujarati' ? 'બધા ખર્ચ' : 'All Expenses'}
                </div>
              </div>
              <div className="stacked-list">
                {expenses.map(e => {
                  const meta = CATEGORY_META[e.category] || CATEGORY_META.other;
                  const Icon = meta.icon;
                  return (
                    <div key={e.id} className="expense-item" id={`expense-${e.id}`}>
                      <div className={`expense-icon ${meta.colorClass}`}>
                        <Icon size={22} />
                      </div>
                      <div className="expense-info">
                        <div className="title">{meta.label[language] || meta.label.english}</div>
                        <div className="subtitle">
                          {e.raw_transcript
                            ? (e.raw_transcript.length > 40 ? e.raw_transcript.slice(0, 40) + '...' : e.raw_transcript)
                            : formatTime(e.created_at)
                          }
                        </div>
                      </div>
                      <div className="expense-amount">
                        ₹{e.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

