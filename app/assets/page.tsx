'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { loadData, saveData } from '@/lib/store';
import { AppData, Account } from '@/lib/types';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}
function generateId() { return Math.random().toString(36).substring(2) + Date.now().toString(36); }

const ACCOUNT_COLORS: Record<string, string> = {
  chequing: '#4ecca3',
  savings: '#60a5fa',
  investment: '#7c6af7',
  rrsp: '#f5a623',
  tfsa: '#34d399',
  fhsa: '#a78bfa',
  credit: '#ef4444',
  other: '#8888aa',
};

const DEFAULT_FORM = { name: '', type: 'chequing' as Account['type'], balance: 0, source: 'scotiabank' as Account['source'] };

export default function AssetsPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => { setData(loadData()); }, []);
  if (!data) return null;

  const { accounts, transactions } = data;

  const assets = accounts.filter((a) => a.balance >= 0);
  const liabilities = accounts.filter((a) => a.balance < 0);
  const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = liabilities.reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Pie data by account type
  const pieData = Object.entries(
    assets.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + a.balance;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Wealthsimple transactions for portfolio
  const wsTransactions = transactions.filter((t) => t.source === 'wealthsimple');
  const wealthsimpleAccounts = accounts.filter((a) => a.source === 'wealthsimple');

  function saveAccount() {
    if (!form.name || !data) return;
    const updated = { ...data };
    if (editId) {
      updated.accounts = data.accounts.map((a) =>
        a.id === editId ? { ...form, id: editId, lastUpdated: new Date().toISOString() } : a
      );
    } else {
      updated.accounts = [
        ...data.accounts,
        { ...form, id: generateId(), lastUpdated: new Date().toISOString() },
      ];
    }
    saveData(updated);
    setData(updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  }

  function removeAccount(id: string) {
    if (!data) return;
    const updated = { ...data, accounts: data.accounts.filter((a) => a.id !== id) };
    saveData(updated);
    setData(updated);
  }

  function startEdit(a: Account) {
    setEditId(a.id);
    setForm({ name: a.name, type: a.type, balance: a.balance, source: a.source });
    setShowForm(true);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Assets & Portfolio</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Net worth: <span className={netWorth >= 0 ? 'text-accent-teal' : 'text-accent-red'}>{fmt(netWorth)}</span>
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_FORM); }}
          className="flex items-center gap-2 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </div>

      {/* Net worth cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">Total Assets</p>
          <p className="text-2xl font-semibold text-accent-teal">{fmt(totalAssets)}</p>
          <p className="text-text-muted text-xs mt-1">{assets.length} accounts</p>
        </div>
        <div className="card p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">Total Liabilities</p>
          <p className="text-2xl font-semibold text-accent-red">{fmt(totalLiabilities)}</p>
          <p className="text-text-muted text-xs mt-1">{liabilities.length} accounts</p>
        </div>
        <div className="card p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">Net Worth</p>
          <p className={`text-2xl font-semibold ${netWorth >= 0 ? 'text-text-primary' : 'text-accent-red'}`}>{fmt(netWorth)}</p>
          <p className="text-text-muted text-xs mt-1">assets minus liabilities</p>
        </div>
      </div>

      {/* Asset allocation pie + account list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Allocation pie */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">Asset Allocation</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={ACCOUNT_COLORS[entry.name] || '#8888aa'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACCOUNT_COLORS[d.name] || '#8888aa' }} />
                    <span className="text-text-muted text-xs capitalize">{d.name}</span>
                    <span className="text-text-primary text-xs ml-auto">{totalAssets > 0 ? ((d.value / totalAssets) * 100).toFixed(0) : 0}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">No accounts yet</div>
          )}
        </div>

        {/* Account balances */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">All Accounts</h2>
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACCOUNT_COLORS[acc.type] || '#8888aa' }} />
                    <div className="min-w-0">
                      <p className="text-text-primary text-sm truncate">{acc.name}</p>
                      <p className="text-text-muted text-xs capitalize">{acc.source} · {acc.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <span className={`text-sm font-semibold ${acc.balance >= 0 ? 'text-text-primary' : 'text-accent-red'}`}>
                      {fmt(acc.balance)}
                    </span>
                    <button onClick={() => startEdit(acc)} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => removeAccount(acc.id)} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-6">Add accounts to track your net worth</p>
          )}
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-primary mb-4">{editId ? 'Edit' : 'Add'} Account</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Account Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Scotia Chequing, TFSA..."
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Source</label>
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as Account['source'] })}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              >
                <option value="scotiabank">Scotiabank</option>
                <option value="amex">American Express</option>
                <option value="wealthsimple">Wealthsimple</option>
                <option value="manual">Manual</option>
              </select>
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Account Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as Account['type'] })}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              >
                <option value="chequing">Chequing</option>
                <option value="savings">Savings</option>
                <option value="credit">Credit Card</option>
                <option value="investment">Investment (Non-Reg)</option>
                <option value="rrsp">RRSP</option>
                <option value="tfsa">TFSA</option>
                <option value="fhsa">FHSA</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">
                Current Balance (CAD) {form.type === 'credit' ? '— enter negative for amount owed' : ''}
              </label>
              <input
                type="number"
                value={form.balance || ''}
                onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
                placeholder={form.type === 'credit' ? '-1500' : '10000'}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={saveAccount}
              disabled={!form.name}
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

      {/* Wealthsimple transactions */}
      {wsTransactions.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            Wealthsimple Activity ({wsTransactions.length} transactions)
          </h2>
          <div className="divide-y divide-border max-h-80 overflow-auto">
            {wsTransactions.slice(0, 30).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-text-primary text-sm">{tx.description}</p>
                  <p className="text-text-muted text-xs">{format(new Date(tx.date), 'MMM d, yyyy')} · {tx.account}</p>
                </div>
                <span className={`text-sm font-medium ${tx.amount >= 0 ? 'text-accent-teal' : 'text-text-secondary'}`}>
                  {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
