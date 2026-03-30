'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { ArrowRightLeft, RefreshCw, AlertCircle, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  loadData, groupByCategory,
  estimateTax, getMonthlyMoneyFlow, isRealExpense, isTransferPayment,
} from '@/lib/store';
import { AppData } from '@/lib/types';
import { CATEGORY_COLORS } from '@/lib/categories';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
}

function StatCard({
  label, value, sub, icon: Icon, positive, accent,
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; positive?: boolean; accent?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-text-secondary text-xs font-medium uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-bg-hover flex items-center justify-center">
          <Icon className="w-4 h-4 text-text-secondary" />
        </div>
      </div>
      <div className={`text-2xl font-semibold ${
        accent ? accent : positive === true ? 'text-accent-teal' : positive === false ? 'text-accent-red' : 'text-text-primary'
      }`}>
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

  // All hooks before early return
  const taxEst = useMemo(() => {
    if (!data) return { federal: 0, provincial: 0, cpp: 0, ei: 0, total: 0, effectiveRate: 0, netIncome: 0 };
    const annualTotal = data.salarySettings.annualSalary + data.salarySettings.annualBonus;
    return estimateTax(annualTotal, data.taxSettings.ytdRrspContributions);
  }, [data]);

  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();

  const moneyFlow = useMemo(() => {
    if (!data) return { netSalary: 0, otherIncome: 0, reimbursements: 0, totalMoneyIn: 0, realExpenses: 0, transferPayments: 0, totalMoneyOut: 0, netCashFlow: 0 };
    return getMonthlyMoneyFlow(data.transactions, data.salarySettings, month, year, taxEst);
  }, [data, month, year, taxEst]);

  // 12-month trend data
  const trendData = useMemo(() => {
    if (!data) return [];
    return Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(new Date(), 11 - i);
      const m = d.getMonth();
      const y = d.getFullYear();
      const flow = getMonthlyMoneyFlow(data.transactions, data.salarySettings, m, y, taxEst);
      return {
        month: format(d, 'MMM'),
        moneyIn: flow.totalMoneyIn,
        realExpenses: flow.realExpenses,
        transfers: flow.transferPayments,
        net: flow.netCashFlow,
      };
    });
  }, [data, taxEst]);

  // Current month transactions
  const monthTx = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }, [data, year, month]);

  // Top real spending categories this month
  const topCategories = useMemo(() => {
    const realExpenseTx = monthTx.filter(isRealExpense);
    const byCat = groupByCategory(realExpenseTx);
    return Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [monthTx]);

  // Transfer breakdown this month
  const transferBreakdown = useMemo(() => {
    const transferTx = monthTx.filter((t) => t.amount < 0 && isTransferPayment(t));
    const byCat = groupByCategory(transferTx);
    return Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  }, [monthTx]);

  if (!data) return null;

  const { transactions, accounts, recurringExpenses, salarySettings } = data;
  const hasData = transactions.length > 0;

  // Net worth
  const totalAssets = accounts.filter(a => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.balance < 0).reduce((s, a) => s + Math.abs(a.balance), 0);
  const netWorth = totalAssets - totalLiabilities;

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

      {/* ═══ Money In / Money Out summary cards ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Money In"
          value={fmt(moneyFlow.totalMoneyIn)}
          sub={salarySettings.annualSalary > 0
            ? `${fmt(moneyFlow.netSalary)} salary + ${fmt(moneyFlow.otherIncome + moneyFlow.reimbursements)} other`
            : format(selectedMonth, 'MMMM yyyy')}
          icon={ArrowUpRight}
          positive={true}
        />
        <StatCard
          label="Real Spending"
          value={fmt(moneyFlow.realExpenses)}
          sub={format(selectedMonth, 'MMMM yyyy')}
          icon={ArrowDownRight}
          positive={false}
        />
        <StatCard
          label="Transfers Out"
          value={fmt(moneyFlow.transferPayments)}
          sub="Debt payments, investments, transfers"
          icon={ArrowRightLeft}
          accent="text-text-muted"
        />
        <StatCard
          label="Net Cash Flow"
          value={fmt(moneyFlow.netCashFlow)}
          sub="money in minus real spending"
          icon={DollarSign}
          positive={moneyFlow.netCashFlow >= 0}
        />
      </div>

      {/* Money In breakdown */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-5">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Money In Breakdown</h2>
            <div className="space-y-3">
              {moneyFlow.netSalary > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-text-secondary text-xs">Net Salary</span>
                    <span className="text-accent-teal text-xs font-medium">{fmt(moneyFlow.netSalary)}</span>
                  </div>
                  <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-teal transition-all"
                      style={{ width: `${moneyFlow.totalMoneyIn > 0 ? (moneyFlow.netSalary / moneyFlow.totalMoneyIn) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {moneyFlow.reimbursements > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-text-secondary text-xs">Reimbursements</span>
                    <span className="text-text-primary text-xs font-medium">{fmt(moneyFlow.reimbursements)}</span>
                  </div>
                  <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${moneyFlow.totalMoneyIn > 0 ? (moneyFlow.reimbursements / moneyFlow.totalMoneyIn) * 100 : 0}%`,
                        backgroundColor: '#a3e635',
                      }}
                    />
                  </div>
                </div>
              )}
              {moneyFlow.otherIncome > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-text-secondary text-xs">Other Income</span>
                    <span className="text-text-primary text-xs font-medium">{fmt(moneyFlow.otherIncome)}</span>
                  </div>
                  <div className="h-1.5 bg-bg-hover rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400 transition-all"
                      style={{ width: `${moneyFlow.totalMoneyIn > 0 ? (moneyFlow.otherIncome / moneyFlow.totalMoneyIn) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              {moneyFlow.totalMoneyIn === 0 && (
                <p className="text-text-muted text-sm text-center py-4">No income this month</p>
              )}
            </div>
          </div>

          {/* Top real spending */}
          <div className="card p-5">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
              Real Spending · {format(selectedMonth, 'MMM')}
            </h2>
            {topCategories.length > 0 ? (
              <div className="space-y-3">
                {topCategories.map(([cat, amount]) => {
                  const pct = moneyFlow.realExpenses > 0 ? (amount / moneyFlow.realExpenses) * 100 : 0;
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

          {/* Transfer payments (not real spending) */}
          <div className="card p-5">
            <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">
              Transfers · {format(selectedMonth, 'MMM')}
            </h2>
            <p className="text-text-muted text-xs mb-3">
              Money moving between your accounts — not real spending
            </p>
            {transferBreakdown.length > 0 ? (
              <div className="space-y-3">
                {transferBreakdown.map(([cat, amount]) => {
                  const color = CATEGORY_COLORS[cat] || '#6b7280';
                  return (
                    <div key={cat} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-text-secondary text-xs">{cat}</span>
                      </div>
                      <span className="text-text-muted text-xs font-medium">{fmt(amount)}</span>
                    </div>
                  );
                })}
                <div className="pt-2 border-t border-border flex justify-between">
                  <span className="text-text-muted text-xs font-medium">Total</span>
                  <span className="text-text-secondary text-xs font-medium">{fmt(moneyFlow.transferPayments)}</span>
                </div>
              </div>
            ) : (
              <div className="h-20 flex items-center justify-center text-text-muted text-sm">No transfers</div>
            )}
          </div>
        </div>
      )}

      {/* 12-month trend chart */}
      {hasData && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Money In vs Real Spending — Last 12 Months</h2>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e38" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8888aa' }} />
                <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8888aa' }} width={45} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', color: '#8888aa' }}
                />
                <Bar dataKey="moneyIn" name="Money In" fill="#4ecca3" radius={[3, 3, 0, 0]} />
                <Bar dataKey="realExpenses" name="Real Spending" fill="#ef4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="transfers" name="Transfers" fill="#71717a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">Import data to see trends</div>
          )}
        </div>
      )}

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
          {accounts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border flex justify-between">
              <span className="text-text-muted text-xs font-medium">Net Worth</span>
              <span className={`text-sm font-semibold ${netWorth >= 0 ? 'text-accent-teal' : 'text-accent-red'}`}>
                {fmt(netWorth)}
              </span>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider mb-4">Recent Transactions</h2>
          {recent.length > 0 ? (
            <div className="space-y-1">
              {recent.map((tx) => {
                const isTransfer = isTransferPayment(tx);
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className={`text-sm truncate ${isTransfer ? 'text-text-muted' : 'text-text-primary'}`}>{tx.description}</p>
                      <p className="text-text-muted text-xs">
                        {format(new Date(tx.date), 'MMM d')} · {tx.category}
                        {isTransfer && <span className="ml-1 text-text-muted/60">(transfer)</span>}
                      </p>
                    </div>
                    <span className={`text-sm font-medium ml-3 flex-shrink-0 ${
                      isTransfer ? 'text-text-muted' : tx.amount >= 0 ? 'text-accent-teal' : 'text-text-primary'
                    }`}>
                      {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-text-muted text-sm text-center py-6">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
