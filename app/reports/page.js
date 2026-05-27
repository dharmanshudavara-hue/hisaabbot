'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import BottomNav from '../components/BottomNav';
import {
  ChartIcon, ArrowUpIcon, ArrowDownIcon, RupeeIcon,
  CalendarIcon, ChevronRightIcon, FoodIcon, TransportIcon,
  MedicineIcon, HouseIcon, BriefcaseIcon, PackageIcon
} from '../components/Icons';
import { getMonthlySummary, getAllTransactions, getSetting } from '../../lib/db';

const CATEGORY_META = {
  food: { icon: FoodIcon, label: { hindi: 'खाना', gujarati: 'ખોરાક', english: 'Food' }, colorClass: 'food' },
  transport: { icon: TransportIcon, label: { hindi: 'यात्रा', gujarati: 'મુસાફરી', english: 'Transport' }, colorClass: 'transport' },
  medicine: { icon: MedicineIcon, label: { hindi: 'दवाई', gujarati: 'દવા', english: 'Medicine' }, colorClass: 'medicine' },
  house: { icon: HouseIcon, label: { hindi: 'घर', gujarati: 'ઘર', english: 'House' }, colorClass: 'house' },
  business: { icon: BriefcaseIcon, label: { hindi: 'व्यापार', gujarati: 'ધંધો', english: 'Business' }, colorClass: 'business' },
  other: { icon: PackageIcon, label: { hindi: 'अन्य', gujarati: 'અન્ય', english: 'Other' }, colorClass: 'other' },
};

const MONTH_NAMES = {
  hindi: ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'],
  gujarati: ['જાન્યુઆરી','ફેબ્રુઆરી','માર્ચ','એપ્રિલ','મે','જૂન','જુલાઈ','ઓગસ્ટ','સપ્ટેમ્બર','ઓક્ટોબર','નવેમ્બર','ડિસેમ્બર'],
  english: ['January','February','March','April','May','June','July','August','September','October','November','December'],
};

export default function ReportsPage() {
  const [language, setLanguage] = useState('hindi');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSetting('language').then(l => { if (l) setLanguage(l); }).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const monthSummary = await getMonthlySummary(year, month);
      setSummary(monthSummary);

      const all = await getAllTransactions();
      const prefix = `${year}-${String(month).padStart(2, '0')}`;
      const monthTransactions = all
        .filter(t => t.created_at.startsWith(prefix))
        .slice(0, 10);
      setRecentTransactions(monthTransactions);
    } catch (err) {
      console.error('Error loading reports:', err);
    }
    setLoading(false);
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const isCurrentMonth = year === new Date().getFullYear() && month === new Date().getMonth() + 1;
  const monthName = (MONTH_NAMES[language] || MONTH_NAMES.english)[month - 1];

  const maxCategoryAmount = summary
    ? Math.max(...Object.values(summary.expensesByCategory || {}), 1)
    : 1;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title" id="reports-title">
            {language === 'hindi' ? 'रिपोर्ट' : language === 'gujarati' ? 'રિપોર્ટ' : 'Reports'}
          </h1>
          <p style={{ fontSize: '0.813rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {language === 'hindi' ? 'मासिक सारांश' : language === 'gujarati' ? 'માસિક સારાંશ' : 'Monthly summary'}
          </p>
        </div>
        <Link href="/expenses" className="btn btn-ghost" style={{
          fontSize: '0.75rem', padding: '8px 14px', minHeight: 'auto', minWidth: 'auto',
          border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-full)'
        }} id="view-expenses-link">
          {language === 'hindi' ? 'खर्चे' : language === 'gujarati' ? 'ખર્ચ' : 'Expenses'}
          <ChevronRightIcon size={14} />
        </Link>
      </div>

      <div className="page-content">
        {/* Month Selector */}
        <div className="month-selector" id="month-selector">
          <button className="btn btn-icon btn-ghost" onClick={prevMonth} aria-label="Previous month"
                  style={{ minHeight: 40, minWidth: 40 }}>
            <ChevronRightIcon size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{monthName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{year}</div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={nextMonth} aria-label="Next month"
                  style={{ minHeight: 40, minWidth: 40, opacity: isCurrentMonth ? 0.3 : 1 }}
                  disabled={isCurrentMonth}>
            <ChevronRightIcon size={20} />
          </button>
        </div>

        {loading ? (
          <div>
            <div className="summary-grid" style={{ marginTop: 20 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ height: 100 }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="summary-grid" style={{ marginTop: 20 }}>
              <div className="summary-card">
                <div className="icon-wrap green"><ArrowUpIcon size={20} /></div>
                <div className="value green">₹{(summary?.totalLent || 0).toLocaleString('en-IN')}</div>
                <div className="label">
                  {language === 'hindi' ? 'उधार दिया' : language === 'gujarati' ? 'ઉધાર આપ્યું' : 'Lent'}
                </div>
              </div>
              <div className="summary-card">
                <div className="icon-wrap red"><ArrowDownIcon size={20} /></div>
                <div className="value red">₹{(summary?.totalBorrowed || 0).toLocaleString('en-IN')}</div>
                <div className="label">
                  {language === 'hindi' ? 'उधार लिया' : language === 'gujarati' ? 'ઉધાર લીધું' : 'Borrowed'}
                </div>
              </div>
              <div className="summary-card">
                <div className="icon-wrap amber"><RupeeIcon size={20} /></div>
                <div className="value amber">₹{(summary?.totalExpenses || 0).toLocaleString('en-IN')}</div>
                <div className="label">
                  {language === 'hindi' ? 'खर्चा' : language === 'gujarati' ? 'ખર્ચ' : 'Expenses'}
                </div>
              </div>
              <div className="summary-card">
                <div className="icon-wrap blue"><ChartIcon size={20} /></div>
                <div className="value" style={{ color: 'var(--blue-400)' }}>{summary?.transactionCount || 0}</div>
                <div className="label">
                  {language === 'hindi' ? 'लेनदेन' : language === 'gujarati' ? 'વ્યવહાર' : 'Transactions'}
                </div>
              </div>
            </div>

            {/* Expense Breakdown by Category */}
            {summary?.totalExpenses > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="section-header">
                  <div className="section-title">
                    <RupeeIcon size={18} />
                    {language === 'hindi' ? 'खर्चे का ब्यौरा' : language === 'gujarati' ? 'ખર્ચ વિગત' : 'Expense Breakdown'}
                  </div>
                </div>
                <div className="stacked-list">
                  {Object.entries(summary.expensesByCategory || {})
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amount]) => {
                      const meta = CATEGORY_META[cat] || CATEGORY_META.other;
                      const Icon = meta.icon;
                      const pct = Math.round((amount / summary.totalExpenses) * 100);
                      const barWidth = Math.round((amount / maxCategoryAmount) * 100);
                      return (
                        <div key={cat} className="expense-item" id={`cat-${cat}`}>
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
                            <div style={{ fontSize: '1rem', fontWeight: 700 }}>
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

            {/* Recent Transactions */}
            {recentTransactions.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div className="section-header">
                  <div className="section-title">
                    <CalendarIcon size={18} />
                    {language === 'hindi' ? 'हाल के लेनदेन' : language === 'gujarati' ? 'તાજેતરના વ્યવહાર' : 'Recent Transactions'}
                  </div>
                </div>
                <div className="stacked-list">
                  {recentTransactions.map(t => (
                    <div key={t.id} className="card" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 'var(--radius-full)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.875rem', fontWeight: 700, flexShrink: 0,
                          background: t.type === 'lent' ? 'rgba(16,185,129,0.15)' :
                                     t.type === 'borrowed' ? 'rgba(239,68,68,0.15)' :
                                     'rgba(245,158,11,0.15)',
                          color: t.type === 'lent' ? 'var(--green-400)' :
                                t.type === 'borrowed' ? 'var(--red-400)' :
                                'var(--amber-400)',
                        }}>
                          {t.type === 'lent' ? '↑' : t.type === 'borrowed' ? '↓' : '₹'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.person_name || (t.category ? (CATEGORY_META[t.category]?.label[language] || t.category) : (language === 'hindi' ? 'खर्चा' : 'Expense'))}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                            {formatDate(t.created_at)}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '1rem', fontWeight: 700, flexShrink: 0,
                          color: t.type === 'lent' ? 'var(--green-400)' :
                                t.type === 'borrowed' ? 'var(--red-400)' :
                                'var(--amber-400)',
                        }}>
                          {t.type === 'lent' ? '+' : '-'}₹{t.amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {summary?.transactionCount === 0 && (
              <div className="empty-state" style={{ marginTop: 20 }}>
                <ChartIcon size={64} />
                <div className="title">
                  {language === 'hindi' ? 'कोई डेटा नहीं' : language === 'gujarati' ? 'કોઈ ડેટા નથી' : 'No Data'}
                </div>
                <div className="desc">
                  {language === 'hindi' ? 'इस महीने कोई लेनदेन नहीं। माइक से रिकॉर्ड करें।' :
                   language === 'gujarati' ? 'આ મહિને કોઈ વ્યવહાર નથી. માઇક થી રેકોર્ડ કરો.' :
                   'No transactions this month. Use voice to record.'}
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
