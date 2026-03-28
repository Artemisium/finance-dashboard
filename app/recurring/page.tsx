'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { loadData, saveData } from '@/lib/store';
import { AppData, RecurringExpense } from '@/lib/types';
import { CATEGORIES } from '@/lib/categories';

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

const DEFAULT_FORM: Omit<RecurringExpense, 'id'> = {
  name: '',
  amount: 0,
  frequency: 'monthly',
  category: 'Subscriptions',
  active: true,
  notes: '',
};

export default function RecurringPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<RecurringExpense, 'id'>>(DEFAULT_FORM);

  useEffect(() => { setData(loadData()); }, []);
  if (!data) return null;

  const { recurringExpenses } = data;

  const activeExpenses = recurringExpenses.filter((r) => r.active);
  const inactiveExpenses = recurringExpenses.filter((r) => !r.active);

  const totalMonthly = activeExpenses.reduce((s, r) => s + toMonthly(r), 0);
  const totalAnnual = totalMonthly * 12;

  function save() {
    if (!form.name || form.amount <= 0 || !data) return;
    const updated = { ...data };
    if (editId) {
      updated.recurringExpenses = data.recurringExpenses.map((r) =>
        r.id === editId ? { ...form, id: editId } : r
      );
    } else {
      updated.recurringExpenses = [...data.recurringExpenses, { ...form, id: generateId() }];
    }
    saveData(updated);
    setData(updated);
    setShowForm(false);
    setEditId(null);
    setForm(DEFAULT_FORM);
  }

  function remove(id: string) {
    if (!data) return;
    const updated = { ...data, recurringExpenses: data.recurringExpenses.filter((r) => r.id !== id) };
    saveData(updated);
    setData(updated);
  }

  function toggleActive(id: string) {
    if (!data) return;
    const updated = {
      ...data,
      recurringExpenses: data.recurringExpenses.map((r) =>
        r.id === id ? { ...r, active: !r.active } : r
      ),
    };
    saveData(updated);
    setData(updated);
  }

  function startEdit(r: RecurringExpense) {
    setEditId(r.id);
    setForm({ name: r.name, amount: r.amount, frequency: r.frequency, category: r.category, active: r.active, notes: r.notes });
    setShowForm(true);
  }

  const FREQ_LABELS: Record<string, string> = {
    weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
  };

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
          <Plus className="w-4 h-4" />
          Add Recurring
        </button>
      </div>

      {/* Summary cards */}
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

      {/* Add/Edit form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-primary mb-4">{editId ? 'Edit' : 'Add'} Recurring Expense</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Netflix, Rent, Gym..."
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Amount (CAD)</label>
              <input
                type="number"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as RecurringExpense['frequency'] })}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-text-secondary text-xs mb-1.5 block">Notes (optional)</label>
              <input
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional note..."
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={save}
              disabled={!form.name || form.amount <= 0}
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

      {/* Active expenses table */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Active Recurring</h2>
        {activeExpenses.length > 0 ? (
          <div className="divide-y divide-border">
            {activeExpenses.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm font-medium truncate">{r.name}</p>
                    <p className="text-text-muted text-xs">{r.category} · {FREQ_LABELS[r.frequency]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-text-primary text-sm font-semibold">{fmt(r.amount)}</p>
                    {r.frequency !== 'monthly' && (
                      <p className="text-text-muted text-xs">{fmt(toMonthly(r))}/mo</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => toggleActive(r.id)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-amber transition-colors" title="Deactivate">
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm text-center py-6">No recurring expenses yet</p>
        )}
      </div>

      {/* Inactive expenses */}
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
