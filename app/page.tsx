'use client';

import { useState, useEffect } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { loadData, getExpenses, getIncome, sumAmount, getMonthlyTotals, groupByCategory } from '@/lib/store';
import { AppData, Transaction } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/categories';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}

function StatCard({
  label, value, sub, icon: Icon, positive,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; positive?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-text-secondary text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center">
          <Icon className="w-4 h-4 text-text-secondary" />
        </div>
      </div>
      <div className={`text-2xl font-semibold ${positive === true ? 'text-accent-teal' : positive === false ? 'text-accent-red' : 'text-text-primary'}`}>
        {value}
      </div>
      {sub && <div className="text-text-muted text-xs mt-1">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg px-3 py-2.5 text-xs shadow-xl">
      <p className="text-text-secondary mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function OverviewPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  useEffect(() => {
    setData(loadData());
  }, []);

  if (!data) return null;

  const { transactions, accounts, recurringExpenses } = data;

  const hasData = transactions.length > 0;

  // Current month stats
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const monthExpenses = Math.abs(sumAmount(getExpenses(monthTx)));
  const monthIncome = sumAmount(getIncome(monthTx));
  const monthNet = monthIncome - monthExpenses;

  // Net worth
  const totalAssets = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  // Monthly trend (last 12 months)
  const monthlyTotals = getMonthlyTotals(transactions).slice(-12);

  // Top spending categories this month
  const monthExpenseTx = getExpenses(monthTx);
  const byCat = groupByCategory(monthExpenseTx);
  const topCategories = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent transactions
  const recent = [...transactions].slice(0, 8);

  // Recurring monthly total
  const recurringMonthly = recurringExpenses
    .filter(r => r.active)
    .reduce((s, r) => {
      if (r.frequency === 'monthly') return s + r.amount;
      if (r.frequency === 'annual') return s + r.amount / 12;
      if (r.frequency === 'weekly') return s + r.amount * 4.33;
      if (r.frequency === 'quarterly') return s + r.amount / 3;
      return s;
    }, 0);

  // Month selector — last 12 months
  const monthOptions = Array.from({ length: 13 }, (_, i) => subMonths(new Date(), i));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Overview</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {hasData
              ? `${transactions.length.toLocaleString()} transactions · Last updated ${format(new Date(data.lastUpdated), 'MMM d, yyyy')}`
              : 'No data yet — import your statements to get started'}
          </p>
        </div>
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
      </div>

      {/* Empty state */}
      {!hasData && (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-accent-teal/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-accent-teal" />
          </div>
          <h3 className="text-text-primary font-medium mb-2">No transaction data</h3>
          <p className="text-text-secondary text-sm mb-4">
            Import your Scotiabank, Amex, or Wealthsimple CSV exports to get started.
          </p>
          <a
            href="/upload"
            className="inline-flex items-center gap-2 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Import Data
          </a>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Net Worth" value={fmt(netWorth)} sub={`${accounts.length} accounts`} icon={Wallet} positive={netWorth > 0} />
        <StatCard label="Monthly Income" value={fmt(monthIncome)} sub={format(selectedMonth, 'MMMM yyyy')} icon={TrendingUp} positive={true} />
        <StatCard label="Monthly Expenses" value={fmt(monthExpenses)} sub={format(selectedMonth, 'MMMM yyyy')} icon={TrendingDown} positive={false} />
        <StatCard
          label="Net Cash Flow"
          value={fmt(monthNet)}
          sub="income minus expenses"
          icon={CreditCard}
          positive={monthNet >= 0 ? true : false}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Cash flow area chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Cash Flow — Last 12 Months</h2>
          {monthlyTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyTotals} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ecca3" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4ecca3" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e38" />
                <XAxis dataKey="month" tickFormatter={(v) => format(new Date(v + '-01'), 'MMM')} tick={{ fontSize: 11, fill: '#8888aa' }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={45} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="income" name="Income" stroke="#4ecca3" strokeWidth={2} fill="url(#incomeGrad)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">Import data to see trends</div>
          )}
        </div>

        {/* Top categories donut-style */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            Top Spending · {format(selectedMonth, 'MMM')}
          </h2>
          {topCategories.length > 0 ? (
            <div className="space-y-3">
              {topCategories.map(([cat, amount]) => {
                const pct = monthExpenses > 0 ? (amount / monthExpenses) * 100 : 0;
                const color = CATEGORY_COLORS[cat] || '#6b7280';
                return (
                  <div key={cat}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-text-secondary text-xs truncate">{cat}</span>
                      <span className="text-text-primary text-xs font-medium ml-2 flex-shrink-0">{fmt(amount)}</span>
                    </div>
                    <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-text-muted text-sm">No spending data</div>
          )}
          {recurringMonthly > 0 && (
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3 text-text-muted" />
                <span className="text-text-muted text-xs">Recurring / mo</span>
              </div>
              <span className="text-text-secondary text-xs font-medium">{fmt(recurringMonthly)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Accounts + Recent transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Accounts */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Accounts</h2>
          {accounts.length > 0 ? (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-text-primary text-sm font-medium">{acc.name}</p>
                    <p className="text-text-muted text-xs capitalize">{acc.source} · {acc.type}</p>
                  </div>
                  <span className={`text-sm font-semibold ${acc.balance >= 0 ? 'text-accent-teal' : 'text-accent-red'}`}>
                    {fmt(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-6">Add accounts via Import Data</p>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Recent Transactions</h2>
          {recent.length > 0 ? (
            <div className="space-y-1">
              {recent.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-text-primary text-sm truncate">{tx.description}</p>
                    <p className="text-text-muted text-xs">{format(new Date(tx.date), 'MMM d')} · {tx.category}</p>
                  </div>
                  <span className={`text-sm font-medium ml-3 flex-shrink-0 ${tx.amount >= 0 ? 'text-accent-teal' : 'text-text-primary'}`}>
                    {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-6">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
