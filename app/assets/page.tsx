'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Edit2, Check, X, Landmark, TrendingUp, CreditCard, Wallet, Bitcoin, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
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
  stock: '#818cf8',
  crypto: '#f59e0b',
  rrsp: '#f5a623',
  tfsa: '#34d399',
  fhsa: '#a78bfa',
  credit: '#94a3b8',
  loan: '#ef4444',
  loc: '#fb923c',
  other: '#8888aa',
};

const ACCOUNT_LABELS: Record<string, string> = {
  chequing: 'Chequing',
  savings: 'Savings',
  investment: 'Investment (Non-Reg)',
  stock: 'Stocks / Brokerage',
  crypto: 'Crypto',
  rrsp: 'RRSP',
  tfsa: 'TFSA',
  fhsa: 'FHSA',
  credit: 'Credit Card',
  loan: 'Loan',
  loc: 'Line of Credit',
  other: 'Other',
};

const DEBT_TYPES: Account['type'][] = ['loan', 'loc'];
const INVESTMENT_TYPES: Account['type'][] = ['investment', 'stock', 'crypto', 'rrsp', 'tfsa', 'fhsa'];

const DEFAULT_FORM = { name: '', type: 'chequing' as Account['type'], balance: 0, source: 'manual' as Account['source'] };

export default function AssetsPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => { setData(loadData()); }, []);
  if (!data) return null;

  const { accounts } = data;

  // Group accounts
  const bankAccounts = accounts.filter((a) => ['chequing', 'savings'].includes(a.type));
  const investments = accounts.filter((a) => INVESTMENT_TYPES.includes(a.type));
  const debts = accounts.filter((a) => DEBT_TYPES.includes(a.type));
  const otherAccounts = accounts.filter((a) => !['chequing', 'savings', ...INVESTMENT_TYPES, ...DEBT_TYPES, 'credit'].includes(a.type));
  const allAssets = accounts.filter((a) => !DEBT_TYPES.includes(a.type) && a.type !== 'credit');

  const totalAssets = allAssets.reduce((s, a) => s + a.balance, 0);
  const totalInvestments = investments.reduce((s, a) => s + a.balance, 0);
  const totalDebt = debts.reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalDebt;

  // Pie data for asset allocation
  const pieData = Object.entries(
    allAssets.reduce((acc, a) => {
      const label = ACCOUNT_LABELS[a.type] || a.type;
      acc[label] = (acc[label] || 0) + a.balance;
      return acc;
    }, {} as Record<string, number>)
  ).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  function persist(updated: AppData) {
    saveData(updated);
    setData(updated);
  }

  function saveAccount() {
    if (!form.name || !data) return;
    const isDebt = DEBT_TYPES.includes(form.type);
    const balance = isDebt ? -Math.abs(form.balance) : Math.abs(form.balance);
    const entry = { ...form, balance };
    const updated = { ...data };
    if (editId) {
      updated.accounts = data.accounts.map((a) =>
        a.id === editId ? { ...entry, id: editId, lastUpdated: new Date().toISOString() } : a
      );
    } else {
      updated.accounts = [
        ...data.accounts,
        { ...entry, id: generateId(), lastUpdated: new Date().toISOString() },
      ];
    }
    persist(updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  }

  function removeAccount(id: string) {
    if (!data) return;
    persist({ ...data, accounts: data.accounts.filter((a) => a.id !== id) });
  }

  function startEdit(a: Account) {
    setEditId(a.id);
    setForm({ name: a.name, type: a.type, balance: Math.abs(a.balance), source: a.source });
    setShowForm(true);
  }

  function openAddForm(type: Account['type']) {
    setEditId(null);
    setForm({ ...DEFAULT_FORM, type });
    setShowForm(true);
  }

  function AccountRow({ acc }: { acc: Account }) {
    const color = ACCOUNT_COLORS[acc.type] || '#8888aa';
    const isDebt = DEBT_TYPES.includes(acc.type);
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <p className="text-text-primary text-sm truncate">{acc.name}</p>
            <p className="text-text-muted text-xs capitalize">{ACCOUNT_LABELS[acc.type] || acc.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <span className={`text-sm font-semibold ${isDebt ? 'text-accent-red' : 'text-text-primary'}`}>
            {isDebt ? `-${fmt(Math.abs(acc.balance))}` : fmt(acc.balance)}
          </span>
          <button onClick={() => startEdit(acc)} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => removeAccount(acc.id)} className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Assets & Net Worth</h1>
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

      {/* Net worth summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">Total Assets</p>
          <p className="text-2xl font-semibold text-accent-teal">{fmt(totalAssets)}</p>
        </div>
        <div className="card p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">Investments</p>
          <p className="text-2xl font-semibold text-[#7c6af7]">{fmt(totalInvestments)}</p>
        </div>
        <div className="card p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">Total Debt</p>
          <p className="text-2xl font-semibold text-accent-red">{fmt(totalDebt)}</p>
        </div>
        <div className="card p-5">
          <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">Net Worth</p>
          <p className={`text-2xl font-semibold ${netWorth >= 0 ? 'text-text-primary' : 'text-accent-red'}`}>{fmt(netWorth)}</p>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Asset Allocation Pie */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">Asset Allocation</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {pieData.map((entry) => {
                      const typeKey = Object.entries(ACCOUNT_LABELS).find(([, v]) => v === entry.name)?.[0] || 'other';
                      return <Cell key={entry.name} fill={ACCOUNT_COLORS[typeKey] || '#8888aa'} />;
                    })}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {pieData.map((d) => {
                  const typeKey = Object.entries(ACCOUNT_LABELS).find(([, v]) => v === d.name)?.[0] || 'other';
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ACCOUNT_COLORS[typeKey] || '#8888aa' }} />
                      <span className="text-text-muted text-xs">{d.name}</span>
                      <span className="text-text-primary text-xs ml-auto">{totalAssets > 0 ? ((d.value / totalAssets) * 100).toFixed(0) : 0}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">Add accounts to see allocation</div>
          )}
        </div>

        {/* Bank Accounts */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-text-muted" />
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Bank Accounts</h2>
            </div>
            <button onClick={() => openAddForm('chequing')} className="text-accent-teal text-xs hover:underline">+ Add</button>
          </div>
          {bankAccounts.length > 0 ? (
            <div>{bankAccounts.map((a) => <AccountRow key={a.id} acc={a} />)}</div>
          ) : (
            <p className="text-text-muted text-xs text-center py-4">No bank accounts added</p>
          )}
        </div>
      </div>

      {/* Investments section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
              Investments & Savings — {fmt(totalInvestments)}
            </h2>
          </div>
        </div>

        {/* Quick-add buttons for investment types */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { type: 'tfsa' as const, label: 'TFSA', icon: '🛡️' },
            { type: 'rrsp' as const, label: 'RRSP', icon: '🏦' },
            { type: 'fhsa' as const, label: 'FHSA', icon: '🏠' },
            { type: 'stock' as const, label: 'Stocks', icon: '📈' },
            { type: 'crypto' as const, label: 'Crypto', icon: '₿' },
            { type: 'investment' as const, label: 'Other Investment', icon: '💰' },
          ].map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => openAddForm(type)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
            >
              <span>{icon}</span> Add {label}
            </button>
          ))}
        </div>

        {investments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {/* Registered accounts */}
            {investments.filter((a) => ['rrsp', 'tfsa', 'fhsa'].includes(a.type)).length > 0 && (
              <div>
                <p className="text-text-muted text-xs font-medium mb-2 uppercase tracking-wider">Registered</p>
                {investments.filter((a) => ['rrsp', 'tfsa', 'fhsa'].includes(a.type)).map((a) => <AccountRow key={a.id} acc={a} />)}
              </div>
            )}
            {/* Non-registered / stocks / crypto */}
            {investments.filter((a) => ['investment', 'stock', 'crypto'].includes(a.type)).length > 0 && (
              <div>
                <p className="text-text-muted text-xs font-medium mb-2 uppercase tracking-wider">Non-Registered</p>
                {investments.filter((a) => ['investment', 'stock', 'crypto'].includes(a.type)).map((a) => <AccountRow key={a.id} acc={a} />)}
              </div>
            )}
          </div>
        ) : (
          <p className="text-text-muted text-xs text-center py-4">No investment accounts added yet. Use the buttons above to get started.</p>
        )}
      </div>

      {/* Debts section */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
              Debts & Liabilities — <span className="text-accent-red">{fmt(totalDebt)}</span>
            </h2>
          </div>
          <div className="flex gap-2">
            <button onClick={() => openAddForm('loc')} className="text-accent-teal text-xs hover:underline">+ Line of Credit</button>
            <button onClick={() => openAddForm('loan')} className="text-accent-teal text-xs hover:underline">+ Loan</button>
          </div>
        </div>
        {debts.length > 0 ? (
          <div>{debts.map((a) => <AccountRow key={a.id} acc={a} />)}</div>
        ) : (
          <p className="text-text-muted text-xs text-center py-4">No debts tracked — add your LOC, car loan, or other liabilities</p>
        )}
      </div>

      {/* Other assets */}
      {otherAccounts.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-text-muted" />
              <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Other Assets</h2>
            </div>
            <button onClick={() => openAddForm('other')} className="text-accent-teal text-xs hover:underline">+ Add</button>
          </div>
          <div>{otherAccounts.map((a) => <AccountRow key={a.id} acc={a} />)}</div>
        </div>
      )}

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
                placeholder={
                  form.type === 'rrsp' ? 'Wealthsimple RRSP' :
                  form.type === 'tfsa' ? 'Wealthsimple TFSA' :
                  form.type === 'crypto' ? 'Coinbase, Shakepay...' :
                  form.type === 'loan' ? 'Car Loan, Personal Loan...' :
                  form.type === 'loc' ? 'Scotia Line of Credit' :
                  'Account name'
                }
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
                <optgroup label="Banking">
                  <option value="chequing">Chequing</option>
                  <option value="savings">Savings</option>
                </optgroup>
                <optgroup label="Investments">
                  <option value="tfsa">TFSA</option>
                  <option value="rrsp">RRSP</option>
                  <option value="fhsa">FHSA</option>
                  <option value="stock">Stocks / Brokerage</option>
                  <option value="crypto">Crypto</option>
                  <option value="investment">Other Investment</option>
                </optgroup>
                <optgroup label="Debt">
                  <option value="loc">Line of Credit</option>
                  <option value="loan">Loan (Car, Personal, etc.)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="other">Other Asset</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">
                {DEBT_TYPES.includes(form.type) ? 'Amount Owed (CAD)' : 'Current Balance (CAD)'}
              </label>
              <input
                type="number"
                value={form.balance || ''}
                onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
                placeholder={DEBT_TYPES.includes(form.type) ? '15000' : '10000'}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
              {DEBT_TYPES.includes(form.type) && (
                <p className="text-text-muted text-xs mt-1">Enter as a positive number — it will be subtracted from net worth</p>
              )}
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
    </div>
  );
}
