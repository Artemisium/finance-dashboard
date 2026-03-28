'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Edit2, Check, X, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { loadData, saveData, estimateTax } from '@/lib/store';
import { AppData, IncomeEntry } from '@/lib/types';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}
function generateId() { return Math.random().toString(36).substring(2) + Date.now().toString(36); }

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
  const [annualGross, setAnnualGross] = useState(0);

  useEffect(() => {
    const d = loadData();
    setData(d);
    // Estimate annual gross from income entries
    const currentYear = new Date().getFullYear();
    const yearEntries = d.incomeEntries.filter((e) => new Date(e.date).getFullYear() === currentYear);
    const totalGross = yearEntries.reduce((s, e) => s + e.grossAmount, 0);
    setAnnualGross(totalGross);
  }, []);

  if (!data) return null;

  const { incomeEntries, taxSettings } = data;

  const currentYear = new Date().getFullYear();
  const yearEntries = incomeEntries.filter((e) => new Date(e.date).getFullYear() === currentYear);
  const ytdGross = yearEntries.reduce((s, e) => s + e.grossAmount, 0);
  const ytdNet = yearEntries.reduce((s, e) => s + e.netAmount, 0);
  const ytdWithheld = ytdGross - ytdNet;

  // Tax estimate based on annualized income
  const taxEstimate = estimateTax(
    annualGross || ytdGross * (12 / Math.max(new Date().getMonth() + 1, 1)),
    taxSettings.ytdRrspContributions
  );

  // Monthly income chart
  const monthlyIncome = Array.from({ length: 12 }, (_, i) => {
    const entries = incomeEntries.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === currentYear && d.getMonth() === i;
    });
    return {
      month: format(new Date(currentYear, i, 1), 'MMM'),
      gross: entries.reduce((s, e) => s + e.grossAmount, 0),
      net: entries.reduce((s, e) => s + e.netAmount, 0),
    };
  });

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

  function saveTaxSettings(updates: Partial<typeof taxSettings>) {
    if (!data) return;
    const updated = { ...data, taxSettings: { ...data.taxSettings, ...updates } };
    saveData(updated);
    setData(updated);
  }

  const TAX_BAR_DATA = [
    { name: 'Federal Tax', value: taxEstimate.federal, color: '#7c6af7' },
    { name: 'Provincial (ON)', value: taxEstimate.provincial, color: '#4ecca3' },
    { name: 'CPP', value: taxEstimate.cpp, color: '#f5a623' },
    { name: 'EI', value: taxEstimate.ei, color: '#60a5fa' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Income & Tax</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {currentYear} YTD · {fmt(ytdGross)} gross · {fmt(ytdNet)} net
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_ENTRY); }}
          className="flex items-center gap-2 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Log Income
        </button>
      </div>

      {/* YTD cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'YTD Gross', value: fmt(ytdGross) },
          { label: 'YTD Net', value: fmt(ytdNet) },
          { label: 'YTD Tax Withheld', value: fmt(ytdWithheld) },
          { label: 'Effective Rate (Est.)', value: `${taxEstimate.effectiveRate}%` },
        ].map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">{c.label}</p>
            <p className="text-2xl font-semibold text-text-primary">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Annual income estimator */}
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
          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Annual Gross Income (CAD)</label>
              <input
                type="number"
                value={annualGross || ''}
                onChange={(e) => setAnnualGross(parseFloat(e.target.value) || 0)}
                placeholder="100000"
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
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
                <span className="text-accent-red text-sm font-semibold">{fmt(taxEstimate.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-secondary text-sm">Est. Net Income</span>
                <span className="text-accent-teal text-sm font-semibold">{fmt(taxEstimate.netIncome)}</span>
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

      {/* Monthly income chart */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Monthly Income — {currentYear}</h2>
        {monthlyIncome.some((m) => m.gross > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyIncome} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e38" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8888aa' }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={45} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="gross" name="Gross" fill="#4ecca340" radius={[3, 3, 0, 0]} />
              <Bar dataKey="net" name="Net" fill="#4ecca3" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-text-muted text-sm">No income entries yet</div>
        )}
      </div>

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
          <p className="text-text-muted text-sm text-center py-6">No income entries yet</p>
        )}
      </div>
    </div>
  );
}
