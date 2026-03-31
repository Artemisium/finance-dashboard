'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Edit2, Check, X, RefreshCw, Search, Link2, Unlink, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { loadData, saveData, getUniqueAccounts } from '@/lib/store';
import { AppData, RecurringExpense, Transaction } from '@/lib/types';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(n);
}

function toMonthly(expense: RecurringExpense): number {
  switch (expense.frequency) {
    case 'weekly': return expense.amount * 4.33;
    case 'monthly': return expense.amount;
    case 'quarterly': return expense.amount / 3;
    case 'annual': return expense.amount / 12;
    default: return expense.amount;
  }
}

function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/** Find transactions matching a recurring expense */
function findMatchingTransactions(expense: RecurringExpense, transactions: Transaction[]): Transaction[] {
  const keyword = expense.matchKeyword?.toLowerCase();
  const linkedIds = new Set(expense.linkedTransactionIds || []);

  return transactions.filter((t) => {
    // Always include manually linked transactions
    if (linkedIds.has(t.id)) return true;
    // Auto-match by keyword if set
    if (keyword && t.description.toLowerCase().includes(keyword)) {
      if (expense.matchAccount && t.account !== expense.matchAccount) return false;
      if (t.amount > 0) return false; // only expenses
      return true;
    }
    return false;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Group matched transactions by month and compute variance */
function getMonthlyVariance(expense: RecurringExpense, matched: Transaction[]): {
  month: string; label: string; expected: number; actual: number; variance: number; txCount: number;
}[] {
  const byMonth: Record<string, Transaction[]> = {};
  matched.forEach((t) => {
    const key = t.date.substring(0, 7);
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(t);
  });

  return Object.entries(byMonth)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, txns]) => {
      const actual = Math.abs(txns.reduce((s, t) => s + t.amount, 0));
      const expected = expense.amount;
      return {
        month,
        label: format(new Date(month + '-15'), 'MMM yyyy'),
        expected,
        actual,
        variance: actual - expected,
        txCount: txns.length,
      };
    });
}

const DEFAULT_FORM: Omit<RecurringExpense, 'id'> = {
  name: '',
  amount: 0,
  frequency: 'monthly',
  category: 'Subscriptions',
  active: true,
  notes: '',
  matchKeyword: '',
  matchAccount: '',
  linkedTransactionIds: [],
};

const FREQ_LABELS: Record<string, string> = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
};

export default function RecurringPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<RecurringExpense, 'id'>>(DEFAULT_FORM);
  const [txSearch, setTxSearch] = useState('');
  const [txSearchAccount, setTxSearchAccount] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null); // which recurring expense we're linking transactions to
  const [linkSearch, setLinkSearch] = useState('');

  useEffect(() => { setData(loadData()); }, []);

  const accounts = useMemo(() => getUniqueAccounts(data?.transactions || []), [data?.transactions]);

  // Unique expense-like transactions grouped by description (for "create from transaction" search)
  const txSearchResults = useMemo(() => {
    if (!data || !txSearch || txSearch.length < 2) return [];
    const s = txSearch.toLowerCase();
    const seen = new Map<string, { tx: Transaction; count: number; totalAmt: number }>();
    data.transactions.forEach((t) => {
      if (t.amount > 0) return; // only expenses
      if (txSearchAccount !== 'all' && t.account !== txSearchAccount) return;
      const lower = t.description.toLowerCase();
      if (!lower.includes(s)) return;
      const key = lower.trim();
      if (!seen.has(key)) {
        seen.set(key, { tx: t, count: 0, totalAmt: 0 });
      }
      const entry = seen.get(key)!;
      entry.count++;
      entry.totalAmt += t.amount;
    });
    return Array.from(seen.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [data, txSearch, txSearchAccount]);

  // Link-mode: transactions available to manually link
  const linkCandidates = useMemo(() => {
    if (!data || !linkingId) return [];
    const expense = data.recurringExpenses.find((r) => r.id === linkingId);
    if (!expense) return [];
    const alreadyLinked = new Set(expense.linkedTransactionIds || []);
    const s = linkSearch.toLowerCase();
    return data.transactions
      .filter((t) => {
        if (t.amount > 0) return false;
        if (alreadyLinked.has(t.id)) return false;
        if (s && !t.description.toLowerCase().includes(s) && !t.date.includes(s)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 50);
  }, [data, linkingId, linkSearch]);

  if (!data) return null;

  const { recurringExpenses, transactions } = data;
  const activeExpenses = recurringExpenses.filter((r) => r.active);
  const inactiveExpenses = recurringExpenses.filter((r) => !r.active);
  const totalMonthly = activeExpenses.reduce((s, r) => s + toMonthly(r), 0);
  const totalAnnual = totalMonthly * 12;

  function persist(updated: AppData) { saveData(updated); setData(updated); }

  function save() {
    if (!form.name || form.amount <= 0 || !data) return;
    const entry: RecurringExpense = {
      ...form,
      id: editId || generateId(),
      linkedTransactionIds: form.linkedTransactionIds || [],
    };
    if (editId) {
      persist({ ...data, recurringExpenses: data.recurringExpenses.map((r) => r.id === editId ? entry : r) });
    } else {
      persist({ ...data, recurringExpenses: [...data.recurringExpenses, entry] });
    }
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  }

  function remove(id: string) {
    persist({ ...data!, recurringExpenses: data!.recurringExpenses.filter((r) => r.id !== id) });
  }

  function toggleActive(id: string) {
    persist({ ...data!, recurringExpenses: data!.recurringExpenses.map((r) => r.id === id ? { ...r, active: !r.active } : r) });
  }

  function startEdit(r: RecurringExpense) {
    setEditId(r.id);
    setForm({
      name: r.name, amount: r.amount, frequency: r.frequency, category: r.category,
      active: r.active, notes: r.notes, dayOfMonth: r.dayOfMonth,
      matchKeyword: r.matchKeyword || '', matchAccount: r.matchAccount || '',
      linkedTransactionIds: r.linkedTransactionIds || [],
    });
    setShowForm(true);
  }

  /** Create a recurring expense from a transaction search result */
  function createFromTransaction(tx: Transaction, count: number) {
    const keyword = tx.description.toLowerCase().trim();
    // If there are many matches, it's a good auto-match candidate
    setForm({
      name: tx.description,
      amount: Math.abs(tx.amount),
      frequency: 'monthly',
      category: tx.category,
      active: true,
      notes: '',
      matchKeyword: keyword,
      matchAccount: tx.account,
      linkedTransactionIds: [],
    });
    setEditId(null);
    setShowForm(true);
    setTxSearch('');
  }

  /** Link a transaction to a recurring expense */
  function linkTransaction(recurringId: string, txId: string) {
    persist({
      ...data!,
      recurringExpenses: data!.recurringExpenses.map((r) => {
        if (r.id !== recurringId) return r;
        const existing = r.linkedTransactionIds || [];
        if (existing.includes(txId)) return r;
        return { ...r, linkedTransactionIds: [...existing, txId] };
      }),
    });
  }

  /** Unlink a transaction from a recurring expense */
  function unlinkTransaction(recurringId: string, txId: string) {
    persist({
      ...data!,
      recurringExpenses: data!.recurringExpenses.map((r) => {
        if (r.id !== recurringId) return r;
        return { ...r, linkedTransactionIds: (r.linkedTransactionIds || []).filter((id) => id !== txId) };
      }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Recurring Expenses</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {activeExpenses.length} active · {fmt(totalMonthly)}/mo · {fmt(totalAnnual)}/yr
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(DEFAULT_FORM); }}
          className="flex items-center gap-2 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Recurring
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Monthly Total', value: fmt(totalMonthly) },
          { label: 'Annual Total', value: fmt(totalAnnual) },
          { label: 'Active Items', value: activeExpenses.length.toString() },
        ].map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-text-secondary text-xs uppercase tracking-wider mb-2">{c.label}</p>
            <p className="text-2xl font-semibold text-text-primary">{c.value}</p>
          </div>
        ))}
      </div>

      {/* ═══ Create from Transaction ═══ */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-3">Create from Transaction</h2>
        <p className="text-text-muted text-xs mb-3">Search your transactions to quickly set up a recurring expense</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text" value={txSearch} onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Search transactions (e.g. disney, insurance, gym...)"
              className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-accent-teal"
            />
          </div>
          <select value={txSearchAccount} onChange={(e) => setTxSearchAccount(e.target.value)}
            className="bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal">
            <option value="all">All Accounts</option>
            {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {txSearchResults.length > 0 && (
          <div className="mt-3 divide-y divide-border/50 max-h-60 overflow-y-auto border border-border rounded-lg">
            {txSearchResults.map(({ tx, count, totalAmt }) => (
              <button
                key={tx.description}
                onClick={() => createFromTransaction(tx, count)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-bg-hover transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-text-primary text-sm truncate">{tx.description}</p>
                  <p className="text-text-muted text-xs">{tx.account} · {count} occurrences</p>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span className="text-text-secondary text-sm">{fmt(totalAmt / count)} avg</span>
                  <ArrowRight className="w-4 h-4 text-accent-teal" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Add/Edit form ═══ */}
      {showForm && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-primary mb-4">{editId ? 'Edit' : 'Add'} Recurring Expense</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Netflix, Rent, Gym..."
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal" />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Expected Amount (CAD)</label>
              <input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00"
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal" />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringExpense['frequency'] })}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Match Keyword <span className="text-text-muted">(auto-finds transactions)</span></label>
              <input value={form.matchKeyword || ''} onChange={(e) => setForm({ ...form, matchKeyword: e.target.value })} placeholder="e.g. disney plus, insurance"
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal" />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Match Account <span className="text-text-muted">(optional)</span></label>
              <select value={form.matchAccount || ''} onChange={(e) => setForm({ ...form, matchAccount: e.target.value })}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal">
                <option value="">Any Account</option>
                {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-text-secondary text-xs mb-1.5 block">Notes (optional)</label>
              <input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional note..."
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal" />
            </div>
          </div>

          {/* Preview matched transactions */}
          {form.matchKeyword && form.matchKeyword.length >= 2 && (
            <div className="mt-4 p-3 bg-bg-hover rounded-lg">
              <p className="text-text-muted text-xs mb-2">
                Preview: {findMatchingTransactions(form as RecurringExpense, transactions).length} matching transactions found
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {findMatchingTransactions(form as RecurringExpense, transactions).slice(0, 8).map((t) => (
                  <div key={t.id} className="flex justify-between text-xs">
                    <span className="text-text-secondary">{format(new Date(t.date), 'MMM d, yyyy')}</span>
                    <span className="text-text-primary">{fmt(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button onClick={save} disabled={!form.name || form.amount <= 0}
              className="flex items-center gap-2 bg-accent-teal text-bg-primary text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent-teal/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Check className="w-4 h-4" /> Save
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }}
              className="flex items-center gap-2 text-text-secondary text-sm px-4 py-2 rounded-lg hover:bg-bg-hover transition-colors">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* ═══ Link Transactions Modal ═══ */}
      {linkingId && (
        <div className="card p-5 border-2 border-accent-teal/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-medium text-text-primary">
                Link Transactions to: {recurringExpenses.find((r) => r.id === linkingId)?.name}
              </h2>
              <p className="text-text-muted text-xs mt-0.5">Search and select transactions to manually associate with this recurring expense</p>
            </div>
            <button onClick={() => setLinkingId(null)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Already linked */}
          {(() => {
            const expense = recurringExpenses.find((r) => r.id === linkingId);
            const linked = (expense?.linkedTransactionIds || [])
              .map((id) => transactions.find((t) => t.id === id))
              .filter(Boolean) as Transaction[];
            return linked.length > 0 ? (
              <div className="mb-4">
                <p className="text-text-muted text-xs uppercase tracking-wider mb-2">Linked ({linked.length})</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {linked.sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-1.5 px-3 bg-accent-teal/5 rounded">
                      <div className="text-xs">
                        <span className="text-text-secondary">{format(new Date(t.date), 'MMM d, yyyy')}</span>
                        <span className="text-text-muted ml-2">{t.description.substring(0, 30)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary text-xs font-medium">{fmt(t.amount)}</span>
                        <button onClick={() => unlinkTransaction(linkingId!, t.id)} className="text-text-muted hover:text-accent-red transition-colors">
                          <Unlink className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input type="text" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)}
              placeholder="Search transactions to link..."
              className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-accent-teal" />
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-border/50">
            {linkCandidates.map((t) => (
              <button key={t.id} onClick={() => linkTransaction(linkingId!, t.id)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-bg-hover transition-colors text-left">
                <div className="text-xs min-w-0">
                  <span className="text-text-secondary">{format(new Date(t.date), 'MMM d, yyyy')}</span>
                  <span className="text-text-muted ml-2 truncate">{t.description.substring(0, 35)}</span>
                  <span className="text-text-muted ml-2">{t.account}</span>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-text-primary text-xs font-medium">{fmt(t.amount)}</span>
                  <Link2 className="w-3 h-3 text-accent-teal" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Active recurring expenses with matching + variance ═══ */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Active Recurring</h2>
        {activeExpenses.length > 0 ? (
          <div className="divide-y divide-border">
            {activeExpenses.map((r) => {
              const matched = findMatchingTransactions(r, transactions);
              const monthlyVar = getMonthlyVariance(r, matched);
              const isExpanded = expandedId === r.id;
              const latestActual = monthlyVar.length > 0 ? monthlyVar[0].actual : null;
              const latestVariance = monthlyVar.length > 0 ? monthlyVar[0].variance : null;
              const hasMatching = r.matchKeyword || (r.linkedTransactionIds && r.linkedTransactionIds.length > 0);

              return (
                <div key={r.id}>
                  {/* Main row */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center flex-shrink-0 hover:bg-bg-card transition-colors">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-text-muted" />}
                      </button>
                      <div className="min-w-0">
                        <p className="text-text-primary text-sm font-medium truncate">{r.name}</p>
                        <p className="text-text-muted text-xs">
                          {r.category} · {FREQ_LABELS[r.frequency]}
                          {hasMatching && <span className="text-accent-teal ml-1">· {matched.length} matched</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-text-primary text-sm font-semibold">{fmt(r.amount)}</p>
                        {latestVariance !== null && latestVariance !== 0 && (
                          <p className={`text-xs ${latestVariance > 0 ? 'text-accent-red' : 'text-accent-teal'}`}>
                            {latestVariance > 0 ? '+' : ''}{fmt(latestVariance)} last
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => { setLinkingId(r.id); setLinkSearch(''); }} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-teal transition-colors" title="Link transactions">
                          <Link2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleActive(r.id)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-amber-400 transition-colors" title="Deactivate">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: monthly variance table */}
                  {isExpanded && (
                    <div className="pb-4 pl-11">
                      {monthlyVar.length > 0 ? (
                        <div className="bg-bg-hover rounded-lg overflow-hidden">
                          <div className="grid grid-cols-4 gap-4 px-4 py-2 text-text-muted text-xs uppercase tracking-wider border-b border-border">
                            <span>Month</span>
                            <span className="text-right">Expected</span>
                            <span className="text-right">Actual</span>
                            <span className="text-right">Variance</span>
                          </div>
                          {monthlyVar.slice(0, 12).map((mv) => (
                            <div key={mv.month} className="grid grid-cols-4 gap-4 px-4 py-2 text-sm border-b border-border/30 last:border-0">
                              <span className="text-text-secondary text-xs">{mv.label}</span>
                              <span className="text-text-muted text-xs text-right">{fmt(mv.expected)}</span>
                              <span className="text-text-primary text-xs text-right">{fmt(mv.actual)}</span>
                              <span className={`text-xs text-right font-medium ${
                                mv.variance === 0 ? 'text-text-muted' : mv.variance > 0 ? 'text-accent-red' : 'text-accent-teal'
                              }`}>
                                {mv.variance === 0 ? '—' : `${mv.variance > 0 ? '+' : ''}${fmt(mv.variance)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-text-muted text-xs py-2">
                          No matched transactions yet.
                          {!r.matchKeyword && ' Set a match keyword or link transactions manually.'}
                        </p>
                      )}
                      {r.matchKeyword && (
                        <p className="text-text-muted text-xs mt-2">
                          Auto-matching: &ldquo;{r.matchKeyword}&rdquo;
                          {r.matchAccount && <span> on {r.matchAccount}</span>}
                        </p>
                      )}
                      {r.linkedTransactionIds && r.linkedTransactionIds.length > 0 && (
                        <p className="text-text-muted text-xs mt-1">
                          + {r.linkedTransactionIds.length} manually linked transaction{r.linkedTransactionIds.length === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-text-muted text-sm text-center py-6">No recurring expenses yet — search your transactions above to get started</p>
        )}
      </div>

      {/* Inactive */}
      {inactiveExpenses.length > 0 && (
        <div className="card p-5 opacity-60">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Inactive / Paused</h2>
          <div className="divide-y divide-border">
            {inactiveExpenses.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-text-secondary text-sm line-through">{r.name}</p>
                  <p className="text-text-muted text-xs">{r.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-sm">{fmt(r.amount)}</span>
                  <button onClick={() => toggleActive(r.id)} className="text-accent-teal text-xs hover:underline">Reactivate</button>
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
