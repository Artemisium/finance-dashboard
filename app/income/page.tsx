'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Edit2, Check, X, Info, DollarSign, TrendingUp, Search, ArrowUpDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  Legend,
} from 'recharts';
import {
  loadData, saveData, estimateTax,
  getExpectedMonthlyGross, detectSalaryDeposits,
} from '@/lib/store';
import { AppData, IncomeEntry, SalarySettings } from '@/lib/types';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}
function fmt2(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n);
}
function generateId() { return Math.random().toString(36).substring(2) + Date.now().toString(36); }

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DEFAULT_ENTRY: Omit<IncomeEntry, 'id'> = {
  date: format(new Date(), 'yyyy-MM-dd'),
  grossAmount: 0,
  netAmount: 0,
  type: 'salary',
  notes: '',
};

export default function IncomePage() {
  const [data, setData] = useState<AppData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<IncomeEntry, 'id'>>(DEFAULT_ENTRY);
  const [activeTab, setActiveTab] = useState<'salary' | 'tax' | 'deposits' | 'history'>('salary');

  useEffect(() => {
    setData(loadData());
  }, []);

  if (!data) return null;

  const { incomeEntries, taxSettings, salarySettings, transactions } = data;
  const currentYear = new Date().getFullYear();

  // ─── Salary-derived calculations ────────────────────────────────────────────
  const annualTotal = salarySettings.annualSalary + salarySettings.annualBonus;
  const taxEst = estimateTax(annualTotal, taxSettings.ytdRrspContributions);
  const monthlyGross = salarySettings.annualSalary / 12;
  const monthlyNetEst = taxEst.netIncome / 12;
  // Monthly expected vs actual from deposits
  const detectedDeposits = useMemo(() => detectSalaryDeposits(transactions), [transactions]);

  const monthlyComparison = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const expectedGross = getExpectedMonthlyGross(salarySettings, i);
      // Calculate expected net for this month
      const monthTax = estimateTax(salarySettings.annualSalary + salarySettings.annualBonus, taxSettings.ytdRrspContributions);
      const expectedNet = expectedGross - (monthTax.total / 12) - (salarySettings.bonusMonth === i && salarySettings.annualBonus > 0
        ? (salarySettings.annualBonus * monthTax.effectiveRate / 100) : 0);

      // Actual deposits for this month
      const monthDeposits = detectedDeposits.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === currentYear && d.getMonth() === i;
      });
      const actualDeposited = monthDeposits.reduce((s, t) => s + t.amount, 0);

      // Manual income entries for this month
      const monthEntries = incomeEntries.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === currentYear && d.getMonth() === i;
      });
      const manualGross = monthEntries.reduce((s, e) => s + e.grossAmount, 0);
      const manualNet = monthEntries.reduce((s, e) => s + e.netAmount, 0);

      return {
        month: MONTH_NAMES[i],
        monthIdx: i,
        expectedGross: Math.round(expectedGross),
        expectedNet: Math.round(expectedGross - (monthTax.total / 12)),
        actualDeposited: Math.round(actualDeposited),
        manualGross: Math.round(manualGross),
        manualNet: Math.round(manualNet),
        depositCount: monthDeposits.length,
        variance: Math.round(actualDeposited - (expectedGross - (monthTax.total / 12))),
      };
    });
  }, [salarySettings, taxSettings, detectedDeposits, incomeEntries, currentYear]);

  // YTD totals
  const currentMonth = new Date().getMonth();
  const ytdExpectedGross = monthlyComparison.slice(0, currentMonth + 1).reduce((s, m) => s + m.expectedGross, 0);
  const ytdExpectedNet = monthlyComparison.slice(0, currentMonth + 1).reduce((s, m) => s + m.expectedNet, 0);
  const ytdActualDeposited = monthlyComparison.slice(0, currentMonth + 1).reduce((s, m) => s + m.actualDeposited, 0);
  const yearEntries = incomeEntries.filter((e) => new Date(e.date).getFullYear() === currentYear);
  const ytdManualGross = yearEntries.reduce((s, e) => s + e.grossAmount, 0);
  const ytdManualNet = yearEntries.reduce((s, e) => s + e.netAmount, 0);

  function saveSalarySettings(updates: Partial<SalarySettings>) {
    if (!data) return;
    const updated = { ...data, salarySettings: { ...data.salarySettings, ...updates } };
    saveData(updated);
    setData(updated);
  }

  function saveTaxSettings(updates: Partial<typeof taxSettings>) {
    if (!data) return;
    const updated = { ...data, taxSettings: { ...data.taxSettings, ...updates } };
    saveData(updated);
    setData(updated);
  }

  function saveEntry() {
    if (!form.grossAmount || !data) return;
    const updated = { ...data };
    if (editId) {
      updated.incomeEntries = data.incomeEntries.map((e) =>
        e.id === editId ? { ...form, id: editId } : e
      );
    } else {
      updated.incomeEntries = [...data.incomeEntries, { ...form, id: generateId() }];
    }
    saveData(updated);
    setData(updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_ENTRY);
  }

  function removeEntry(id: string) {
    if (!data) return;
    const updated = { ...data, incomeEntries: data.incomeEntries.filter((e) => e.id !== id) };
    saveData(updated);
    setData(updated);
  }

  const TAX_BAR_DATA = [
    { name: 'Federal Tax', value: taxEst.federal, color: '#7c6af7' },
    { name: 'Provincial (ON)', value: taxEst.provincial, color: '#4ecca3' },
    { name: 'CPP', value: taxEst.cpp, color: '#f5a623' },
    { name: 'EI', value: taxEst.ei, color: '#60a5fa' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Income & Tax</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {currentYear} · {salarySettings.annualSalary > 0 ? `${fmt(salarySettings.annualSalary)} salary` : 'No salary configured'}
            {salarySettings.annualBonus > 0 && ` + ${fmt(salarySettings.annualBonus)} bonus`}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_ENTRY); }}
          className="flex items-center gap-2 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Log Income
        </button>
      </div>

      {/* YTD Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Annual Gross', value: fmt(annualTotal), sub: `${fmt(monthlyGross)}/mo` },
          { label: 'Est. Annual Net', value: fmt(taxEst.netIncome), sub: `${fmt(monthlyNetEst)}/mo` },
          { label: 'Est. Annual Tax', value: fmt(taxEst.total), sub: `${taxEst.effectiveRate}% effective` },
          { label: 'YTD Deposited', value: fmt(ytdActualDeposited), sub: `${detectedDeposits.filter((d) => new Date(d.date).getFullYear() === currentYear).length} deposits found` },
        ].map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">{c.label}</p>
            <p className="text-2xl font-semibold text-text-primary">{c.value}</p>
            <p className="text-text-muted text-xs mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-bg-secondary rounded-lg p-1">
        {([
          { key: 'salary', label: 'Salary Setup', icon: DollarSign },
          { key: 'tax', label: 'Tax Breakdown', icon: TrendingUp },
          { key: 'deposits', label: 'Deposit Detection', icon: Search },
          { key: 'history', label: 'Manual Entries', icon: ArrowUpDown },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-bg-card text-accent-teal shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Tab: Salary Setup ──────────────────────────────────────────────────── */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Salary & Bonus Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-text-secondary text-xs mb-1.5 block">Annual Salary (CAD)</label>
                <input
                  type="number"
                  value={salarySettings.annualSalary || ''}
                  onChange={(e) => saveSalarySettings({ annualSalary: parseFloat(e.target.value) || 0 })}
                  placeholder="100000"
                  className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                />
              </div>
              <div>
                <label className="text-text-secondary text-xs mb-1.5 block">Annual Bonus (CAD)</label>
                <input
                  type="number"
                  value={salarySettings.annualBonus || ''}
                  onChange={(e) => saveSalarySettings({ annualBonus: parseFloat(e.target.value) || 0 })}
                  placeholder="10000"
                  className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                />
              </div>
              <div>
                <label className="text-text-secondary text-xs mb-1.5 block">Bonus Month</label>
                <select
                  value={salarySettings.bonusMonth}
                  onChange={(e) => saveSalarySettings({ bonusMonth: parseInt(e.target.value) })}
                  className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                >
                  {MONTH_FULL.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-text-secondary text-xs mb-1.5 block">Pay Frequency</label>
                <select
                  value={salarySettings.payFrequency}
                  onChange={(e) => saveSalarySettings({ payFrequency: e.target.value as SalarySettings['payFrequency'] })}
                  className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                >
                  <option value="biweekly">Bi-weekly (26 pay periods)</option>
                  <option value="semimonthly">Semi-monthly (24 pay periods)</option>
                  <option value="monthly">Monthly (12 pay periods)</option>
                </select>
              </div>
              <div>
                <label className="text-text-secondary text-xs mb-1.5 block">Employer</label>
                <input
                  value={salarySettings.employer || ''}
                  onChange={(e) => saveSalarySettings({ employer: e.target.value })}
                  placeholder="Company name"
                  className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                />
              </div>
            </div>
          </div>

          {/* Monthly Gross Income Breakdown */}
          {salarySettings.annualSalary > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
                Expected Monthly Gross — {currentYear}
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyComparison} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e38" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8888aa' }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={50} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmt(v), name]}
                    contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="expectedGross" name="Expected Gross" fill="#4ecca340" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expectedNet" name="Expected Net" fill="#4ecca3" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              {/* Monthly table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-text-muted text-xs font-medium py-2 pr-4">Month</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 px-4">Expected Gross</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 px-4">Est. Tax</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 px-4">Expected Net</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 pl-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyComparison.map((m) => (
                      <tr key={m.month} className="border-b border-border/50 hover:bg-bg-hover/30">
                        <td className="text-text-primary py-2 pr-4">{MONTH_FULL[m.monthIdx]}</td>
                        <td className="text-right text-text-primary py-2 px-4">{fmt(m.expectedGross)}</td>
                        <td className="text-right text-accent-red/70 py-2 px-4">{fmt(m.expectedGross - m.expectedNet)}</td>
                        <td className="text-right text-accent-teal py-2 px-4">{fmt(m.expectedNet)}</td>
                        <td className="text-right text-text-muted text-xs py-2 pl-4">
                          {salarySettings.bonusMonth === m.monthIdx && salarySettings.annualBonus > 0 && (
                            <span className="bg-accent-teal/10 text-accent-teal px-2 py-0.5 rounded-full">Bonus month</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="text-text-primary py-2 pr-4">Total</td>
                      <td className="text-right text-text-primary py-2 px-4">{fmt(annualTotal)}</td>
                      <td className="text-right text-accent-red py-2 px-4">{fmt(taxEst.total)}</td>
                      <td className="text-right text-accent-teal py-2 px-4">{fmt(taxEst.netIncome)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Tax Breakdown ─────────────────────────────────────────────────── */}
      {activeTab === 'tax' && (
        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Tax Estimator</h2>
              <div className="group relative">
                <Info className="w-3.5 h-3.5 text-text-muted cursor-help" />
                <div className="hidden group-hover:block absolute left-6 top-0 z-10 bg-bg-card border border-border rounded-lg p-3 w-64 text-xs text-text-secondary shadow-xl">
                  Simplified estimate for Ontario residents. Does not account for all deductions and credits. For accurate tax filing, consult a professional.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tax inputs */}
              <div className="space-y-4">
                <div className="bg-bg-hover/50 rounded-lg p-3">
                  <p className="text-text-muted text-xs mb-1">Annual Gross (from Salary Setup)</p>
                  <p className="text-text-primary text-lg font-semibold">{fmt(annualTotal)}</p>
                </div>
                <div>
                  <label className="text-text-secondary text-xs mb-1.5 block">RRSP Contributions (YTD)</label>
                  <input
                    type="number"
                    value={taxSettings.ytdRrspContributions || ''}
                    onChange={(e) => saveTaxSettings({ ytdRrspContributions: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  />
                  <p className="text-text-muted text-xs mt-1">Room available: {fmt(taxSettings.rrspContributionRoom)}</p>
                </div>
                <div>
                  <label className="text-text-secondary text-xs mb-1.5 block">TFSA Contributions (YTD)</label>
                  <input
                    type="number"
                    value={taxSettings.ytdTfsaContributions || ''}
                    onChange={(e) => saveTaxSettings({ ytdTfsaContributions: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  />
                  <p className="text-text-muted text-xs mt-1">Room available: {fmt(taxSettings.tfsaContributionRoom)} ({currentYear})</p>
                </div>
              </div>

              {/* Tax breakdown */}
              <div>
                <div className="space-y-2.5 mb-4">
                  {TAX_BAR_DATA.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-text-secondary text-sm">{item.name}</span>
                      </div>
                      <span className="text-text-primary text-sm font-medium">{fmt(item.value)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <span className="text-text-primary text-sm font-semibold">Total Tax</span>
                    <span className="text-accent-red text-sm font-semibold">{fmt(taxEst.total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary text-sm">Est. Net Income</span>
                    <span className="text-accent-teal text-sm font-semibold">{fmt(taxEst.netIncome)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary text-sm">Monthly Take-Home</span>
                    <span className="text-accent-teal text-sm font-semibold">{fmt(monthlyNetEst)}</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={TAX_BAR_DATA} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#8888aa' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#8888aa' }} width={95} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                      {TAX_BAR_DATA.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Monthly Gross vs Net comparison chart */}
          {salarySettings.annualSalary > 0 && (
            <div className="card p-5">
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
                Monthly: Gross vs Expected Net vs Actual Deposits
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyComparison} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e38" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8888aa' }} />
                  <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={50} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmt(v), name]}
                    contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8888aa' }} />
                  <Bar dataKey="expectedGross" name="Expected Gross" fill="#4ecca330" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expectedNet" name="Expected Net" fill="#4ecca3" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="actualDeposited" name="Actual Deposits" fill="#7c6af7" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Deposit Detection ─────────────────────────────────────────────── */}
      {activeTab === 'deposits' && (
        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">
              Detected Salary & Bonus Deposits
            </h2>
            <p className="text-text-muted text-xs mb-4">
              Analyzing debit card / chequing account deposits for salary and bonus payments.
              Found {detectedDeposits.filter((d) => new Date(d.date).getFullYear() === currentYear).length} potential deposits in {currentYear}.
            </p>

            {/* Comparison table: expected vs actual by month */}
            {salarySettings.annualSalary > 0 && (
              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-text-muted text-xs font-medium py-2 pr-4">Month</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 px-3">Expected Net</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 px-3">Actual Deposits</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 px-3">Variance</th>
                      <th className="text-right text-text-muted text-xs font-medium py-2 pl-3"># Deposits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyComparison.filter((m) => m.monthIdx <= currentMonth).map((m) => (
                      <tr key={m.month} className="border-b border-border/50 hover:bg-bg-hover/30">
                        <td className="text-text-primary py-2 pr-4">{MONTH_FULL[m.monthIdx]}</td>
                        <td className="text-right text-text-secondary py-2 px-3">{fmt(m.expectedNet)}</td>
                        <td className="text-right text-text-primary py-2 px-3">
                          {m.actualDeposited > 0 ? fmt(m.actualDeposited) : <span className="text-text-muted">—</span>}
                        </td>
                        <td className={`text-right py-2 px-3 font-medium ${
                          m.variance > 0 ? 'text-accent-teal' : m.variance < 0 ? 'text-accent-red' : 'text-text-muted'
                        }`}>
                          {m.actualDeposited > 0 ? (m.variance > 0 ? '+' : '') + fmt(m.variance) : '—'}
                        </td>
                        <td className="text-right text-text-muted py-2 pl-3">{m.depositCount || '—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border font-semibold">
                      <td className="text-text-primary py-2 pr-4">YTD Total</td>
                      <td className="text-right text-text-secondary py-2 px-3">{fmt(ytdExpectedNet)}</td>
                      <td className="text-right text-text-primary py-2 px-3">{fmt(ytdActualDeposited)}</td>
                      <td className={`text-right py-2 px-3 ${
                        ytdActualDeposited - ytdExpectedNet > 0 ? 'text-accent-teal' : 'text-accent-red'
                      }`}>
                        {(ytdActualDeposited - ytdExpectedNet > 0 ? '+' : '') + fmt(ytdActualDeposited - ytdExpectedNet)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Individual detected deposits */}
          <div className="card p-5">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">All Detected Deposits</h2>
            {detectedDeposits.length > 0 ? (
              <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
                {detectedDeposits.filter((d) => new Date(d.date).getFullYear() === currentYear).map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2.5 hover:bg-bg-hover/30 px-2 -mx-2 rounded">
                    <div>
                      <p className="text-text-primary text-sm">{t.description}</p>
                      <p className="text-text-muted text-xs">
                        {format(new Date(t.date), 'MMM d, yyyy')} · {t.account} · {t.source}
                      </p>
                    </div>
                    <span className="text-accent-teal text-sm font-semibold">{fmt2(t.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-8">
                No salary/bonus deposits detected. Import your chequing account statements to detect deposits automatically.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab: Manual Entries ─────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Add/Edit form */}
          {showForm && (
            <div className="card p-5">
              <h2 className="text-sm font-medium text-text-primary mb-4">{editId ? 'Edit' : 'Log'} Income Entry</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-text-secondary text-xs mb-1.5 block">Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-xs mb-1.5 block">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as IncomeEntry['type'] })}
                    className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  >
                    <option value="salary">Salary / Paycheque</option>
                    <option value="bonus">Bonus</option>
                    <option value="freelance">Freelance / Contract</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-text-secondary text-xs mb-1.5 block">Gross Amount (CAD)</label>
                  <input
                    type="number"
                    value={form.grossAmount || ''}
                    onChange={(e) => setForm({ ...form, grossAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="5000"
                    className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  />
                </div>
                <div>
                  <label className="text-text-secondary text-xs mb-1.5 block">Net Amount (after tax)</label>
                  <input
                    type="number"
                    value={form.netAmount || ''}
                    onChange={(e) => setForm({ ...form, netAmount: parseFloat(e.target.value) || 0 })}
                    placeholder="3800"
                    className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-text-secondary text-xs mb-1.5 block">Notes (optional)</label>
                  <input
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Pay period, employer..."
                    className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={saveEntry}
                  disabled={!form.grossAmount}
                  className="flex items-center gap-2 bg-accent-teal text-bg-primary text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Check className="w-4 h-4" /> Save
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditId(null); }}
                  className="flex items-center gap-2 text-text-secondary text-sm px-4 py-2 rounded-lg hover:bg-bg-hover transition-colors"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Income history */}
          <div className="card p-5">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Income History</h2>
            {incomeEntries.length > 0 ? (
              <div className="divide-y divide-border">
                {[...incomeEntries].sort((a, b) => b.date.localeCompare(a.date)).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-text-primary text-sm font-medium capitalize">{entry.type}</p>
                      <p className="text-text-muted text-xs">{format(new Date(entry.date), 'MMMM d, yyyy')}{entry.notes && ` · ${entry.notes}`}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-accent-teal text-sm font-semibold">{fmt(entry.grossAmount)} gross</p>
                        <p className="text-text-muted text-xs">{fmt(entry.netAmount)} net</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditId(entry.id); setForm({ date: entry.date, grossAmount: entry.grossAmount, netAmount: entry.netAmount, type: entry.type, notes: entry.notes }); setShowForm(true); }}
                          className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeEntry(entry.id)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-sm text-center py-6">No manual income entries yet. Use "Log Income" to add entries, or set up your salary in the Salary Setup tab.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
