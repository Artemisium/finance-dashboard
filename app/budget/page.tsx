'use client';

import { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { loadData, saveData, getExpenses, groupByCategory } from '@/lib/store';
import { AppData, BudgetCategory } from '@/lib/types';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}
function generateId() { return Math.random().toString(36).substring(2) + Date.now().toString(36); }

export default function BudgetPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<{ category: string; monthlyLimit: number }>({ category: 'Groceries', monthlyLimit: 0 });

  useEffect(() => { setData(loadData()); }, []);
  if (!data) return null;

  const { transactions, budgetCategories } = data;

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const spent = groupByCategory(getExpenses(monthTx));

  const budgetData = budgetCategories.map((b) => ({
    ...b,
    spent: spent[b.category] || 0,
    remaining: Math.max(0, b.monthlyLimit - (spent[b.category] || 0)),
    over: Math.max(0, (spent[b.category] || 0) - b.monthlyLimit),
    pct: b.monthlyLimit > 0 ? Math.min(((spent[b.category] || 0) / b.monthlyLimit) * 100, 100) : 0,
  }));

  const totalBudgeted = budgetCategories.reduce((s, b) => s + b.monthlyLimit, 0);
  const totalSpent = budgetData.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgetData.filter((b) => b.over > 0).length;

  function saveBudget() {
    if (!form.category || form.monthlyLimit <= 0 || !data) return;
    const updated = { ...data };
    if (editId) {
      updated.budgetCategories = data.budgetCategories.map((b) =>
        b.id === editId ? { ...b, category: form.category, monthlyLimit: form.monthlyLimit } : b
      );
    } else {
      updated.budgetCategories = [
        ...data.budgetCategories,
        { id: generateId(), category: form.category, monthlyLimit: form.monthlyLimit },
      ];
    }
    saveData(updated);
    setData(updated);
    setShowForm(false);
    setEditId(null);
  }

  function removeBudget(id: string) {
    if (!data) return;
    const updated = { ...data, budgetCategories: data.budgetCategories.filter((b) => b.id !== id) };
    saveData(updated);
    setData(updated);
  }

  const monthOptions = Array.from({ length: 13 }, (_, i) => subMonths(new Date(), i));

  // Chart data
  const chartData = budgetData.map((b) => ({
    name: b.category.length > 12 ? b.category.split(' ').slice(0, 2).join(' ') : b.category,
    budget: b.monthlyLimit,
    spent: b.spent,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Budget</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {fmt(totalSpent)} spent of {fmt(totalBudgeted)} budgeted
            {overBudgetCount > 0 && <span className="text-accent-red ml-2">· {overBudgetCount} over budget</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={format(selectedMonth, 'yyyy-MM')}
            onChange={(e) => setSelectedMonth(new Date(e.target.value + '-15'))}
            className="bg-bg-card border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
          >
            {monthOptions.map((m) => (
              <option key={format(m, 'yyyy-MM')} value={format(m, 'yyyy-MM')}>
                {format(m, 'MMMM yyyy')}
              </option>
            ))}
          </select>
          <button
            onClick={() => { setShowForm(true); setEditId(null); setForm({ category: 'Groceries', monthlyLimit: 0 }); }}
            className="flex items-center gap-2 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-text-secondary text-sm">Overall Budget</span>
          <span className="text-text-primary text-sm font-medium">{fmt(totalSpent)} / {fmt(totalBudgeted)}</span>
        </div>
        <div className="h-3 bg-bg-hover rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0, 100)}%`,
              backgroundColor: totalSpent > totalBudgeted ? '#ef4444' : '#4ecca3',
            }}
          />
        </div>
        <div className="flex justify-between mt-2 text-text-muted text-xs">
          <span>{totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(0) : 0}% used</span>
          <span>{fmt(Math.max(0, totalBudgeted - totalSpent))} remaining</span>
        </div>
      </div>

      {/* Budget vs Actual chart */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Budget vs Actual</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8888aa' }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={40} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="budget" name="Budget" fill="#2a2a45" radius={[3, 3, 0, 0]} />
              <Bar dataKey="spent" name="Spent" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.spent > entry.budget ? '#ef4444' : '#4ecca3'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-text-muted text-sm">No budget categories</div>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-primary mb-4">{editId ? 'Edit' : 'Add'} Budget Category</h2>
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className="text-text-secondary text-xs mb-1.5 block">Monthly Limit (CAD)</label>
              <input
                type="number"
                value={form.monthlyLimit || ''}
                onChange={(e) => setForm({ ...form, monthlyLimit: parseFloat(e.target.value) || 0 })}
                placeholder="500"
                className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={saveBudget}
              disabled={form.monthlyLimit <= 0}
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

      {/* Budget categories grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetData.map((b) => {
          const color = CATEGORY_COLORS[b.category] || '#6b7280';
          const isOver = b.over > 0;
          return (
            <div key={b.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-text-primary text-sm font-medium">{b.category}</h3>
                  <p className="text-text-muted text-xs mt-0.5">
                    {fmt(b.spent)} spent · {fmt(b.monthlyLimit)} limit
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditId(b.id); setForm({ category: b.category, monthlyLimit: b.monthlyLimit }); setShowForm(true); }}
                    className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeBudget(b.id)}
                    className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="h-2 bg-bg-hover rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${b.pct}%`, backgroundColor: isOver ? '#ef4444' : color }}
                />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">{b.pct.toFixed(0)}% used</span>
                {isOver ? (
                  <span className="text-accent-red font-medium">{fmt(b.over)} over</span>
                ) : (
                  <span className="text-accent-teal">{fmt(b.remaining)} left</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
