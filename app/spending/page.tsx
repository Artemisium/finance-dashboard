'use client';

import { useState, useEffect } from 'react';
import { format, subMonths } from 'date-fns';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { loadData, getExpenses, groupByCategory, getMonthlyTotals } from '@/lib/store';
import { AppData } from '@/lib/types';
import { CATEGORY_COLORS, CATEGORIES } from '@/lib/categories';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-border rounded-lg px-3 py-2.5 text-xs shadow-xl">
      <p className="text-text-secondary mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function SpendingPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => { setData(loadData()); }, []);
  if (!data) return null;

  const { transactions } = data;

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();

  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const expenses = getExpenses(monthTx);
  const totalSpend = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const byCat = groupByCategory(expenses);

  const pieData = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value]) => ({ name, value }));

  // Month-over-month bar data (last 6 months, by category)
  const last6 = Array.from({ length: 6 }, (_, i) => subMonths(selectedMonth, 5 - i));
  const momData = last6.map((m) => {
    const ytx = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
    });
    const exps = getExpenses(ytx);
    const cats = groupByCategory(exps);
    return {
      month: format(m, 'MMM'),
      ...cats,
      total: Object.values(cats).reduce((s, v) => s + v, 0),
    };
  });

  // Category breakdown list
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  // Filtered transactions
  const filteredTx = selectedCategory
    ? expenses.filter((t) => t.category === selectedCategory)
    : expenses;

  // Year-over-year comparison
  const thisYear = new Date().getFullYear();
  const yearlyData = Array.from({ length: 12 }, (_, i) => {
    const mLabel = format(new Date(thisYear, i, 1), 'MMM');
    const curYearTx = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === thisYear && d.getMonth() === i;
    });
    const prevYearTx = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === thisYear - 1 && d.getMonth() === i;
    });
    return {
      month: mLabel,
      thisYear: getExpenses(curYearTx).reduce((s, t) => s + Math.abs(t.amount), 0),
      lastYear: getExpenses(prevYearTx).reduce((s, t) => s + Math.abs(t.amount), 0),
    };
  });

  const monthOptions = Array.from({ length: 24 }, (_, i) => subMonths(new Date(), i));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Spending Analysis</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            {expenses.length} transactions · {fmt(totalSpend)} spent in {format(selectedMonth, 'MMMM yyyy')}
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

      {/* Category breakdown + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Pie chart */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-1">By Category</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={(d) => setSelectedCategory(d.name === selectedCategory ? null : d.name)}
                >
                  {pieData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={CATEGORY_COLORS[entry.name] || '#6b7280'}
                      opacity={selectedCategory && selectedCategory !== entry.name ? 0.3 : 1}
                      cursor="pointer"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ background: '#16162a', border: '1px solid #2a2a45', borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">No data</div>
          )}
        </div>

        {/* Category list */}
        <div className="card p-5 lg:col-span-3 overflow-auto max-h-80">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
            Categories {selectedCategory && <button onClick={() => setSelectedCategory(null)} className="ml-2 text-accent-teal text-xs">× clear</button>}
          </h2>
          <div className="space-y-2.5">
            {catList.map(([cat, amount]) => {
              const pct = totalSpend > 0 ? (amount / totalSpend) * 100 : 0;
              const color = CATEGORY_COLORS[cat] || '#6b7280';
              const active = !selectedCategory || selectedCategory === cat;
              return (
                <div
                  key={cat}
                  className={`cursor-pointer transition-opacity ${active ? 'opacity-100' : 'opacity-30'}`}
                  onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-text-primary text-sm">{cat}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-xs">{pct.toFixed(1)}%</span>
                      <span className="text-text-primary text-sm font-medium w-20 text-right">{fmt(amount)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Month-over-month bar chart */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Monthly Trend — Last 6 Months</h2>
        {momData.some((d) => d.total > 0) ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={momData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e38" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8888aa' }} />
              <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={45} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" name="Total Spend" fill="#7c6af7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-text-muted text-sm">No data</div>
        )}
      </div>

      {/* Year-over-year */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Year-over-Year Comparison</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={yearlyData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e38" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8888aa' }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={45} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, color: '#8888aa' }} />
            <Bar dataKey="thisYear" name={`${thisYear}`} fill="#4ecca3" radius={[3, 3, 0, 0]} />
            <Bar dataKey="lastYear" name={`${thisYear - 1}`} fill="#4ecca340" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction list */}
      <div className="card p-5">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
          Transactions{selectedCategory ? ` · ${selectedCategory}` : ''} — {format(selectedMonth, 'MMMM yyyy')}
        </h2>
        {filteredTx.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredTx.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-text-primary text-sm truncate">{tx.description}</p>
                  <p className="text-text-muted text-xs">{format(new Date(tx.date), 'MMM d, yyyy')} · {tx.account}</p>
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `${CATEGORY_COLORS[tx.category] || '#6b7280'}20`,
                      color: CATEGORY_COLORS[tx.category] || '#6b7280',
                    }}
                  >
                    {tx.category}
                  </span>
                  <span className="text-text-primary text-sm font-medium">{fmt(Math.abs(tx.amount))}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm text-center py-6">No transactions for this period</p>
        )}
      </div>
    </div>
  );
}
