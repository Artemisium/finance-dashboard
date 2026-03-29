'use client';

import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Trash2, AlertTriangle, Search, Filter, Database, ChevronDown, ChevronUp } from 'lucide-react';
import { loadData, saveData, wipeTransactionsByAccount, deleteTransaction, getUniqueAccounts } from '@/lib/store';
import { AppData, Transaction } from '@/lib/types';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n);
}

export default function DataManagementPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [showWipeConfirm, setShowWipeConfirm] = useState<string | null>(null);
  const [showWipeAllConfirm, setShowWipeAllConfirm] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setData(loadData());
  }, []);

  if (!data) return null;

  const accounts = getUniqueAccounts(data.transactions);
  const sources = Array.from(new Set(data.transactions.map((t) => t.source))).sort();

  // Filtered transactions
  const filtered = useMemo(() => {
    return data.transactions.filter((t) => {
      if (filterAccount !== 'all' && t.account !== filterAccount) return false;
      if (filterSource !== 'all' && t.source !== filterSource) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.description.toLowerCase().includes(s) && !t.category.toLowerCase().includes(s) && !t.date.includes(s)) return false;
      }
      return true;
    });
  }, [data.transactions, filterAccount, filterSource, search]);

  // Group by month
  const groupedByMonth = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    filtered.forEach((t) => {
      const key = t.date.substring(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, txns]) => ({
        month,
        label: format(new Date(month + '-01'), 'MMMM yyyy'),
        transactions: txns.sort((a, b) => b.date.localeCompare(a.date)),
        total: txns.reduce((s, t) => s + t.amount, 0),
        count: txns.length,
      }));
  }, [filtered]);

  // Account stats
  const accountStats = useMemo(() => {
    const map: Record<string, { count: number; source: string }> = {};
    data.transactions.forEach((t) => {
      if (!map[t.account]) map[t.account] = { count: 0, source: t.source };
      map[t.account].count++;
    });
    return Object.entries(map).sort(([, a], [, b]) => b.count - a.count);
  }, [data.transactions]);

  function handleWipeAccount(account: string) {
    if (!data) return;
    const updated = wipeTransactionsByAccount(data, account);
    saveData(updated);
    setData(updated);
    setShowWipeConfirm(null);
    setSelectedIds(new Set());
  }

  function handleWipeAll() {
    if (!data) return;
    const updated = { ...data, transactions: [] };
    saveData(updated);
    setData(updated);
    setShowWipeAllConfirm(false);
    setSelectedIds(new Set());
  }

  function handleDeleteOne(id: string) {
    if (!data) return;
    const updated = deleteTransaction(data, id);
    saveData(updated);
    setData(updated);
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function handleDeleteSelected() {
    if (!data || selectedIds.size === 0) return;
    const updated = {
      ...data,
      transactions: data.transactions.filter((t) => !selectedIds.has(t.id)),
    };
    saveData(updated);
    setData(updated);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectMonth(month: string) {
    const txns = groupedByMonth.find((g) => g.month === month)?.transactions || [];
    const ids = txns.map((t) => t.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Data Management</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          {data.transactions.length.toLocaleString()} transactions across {accounts.length} accounts
        </p>
      </div>

      {/* Account cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accountStats.map(([account, stats]) => (
          <div key={account} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-text-muted" />
                <span className="text-text-primary text-sm font-medium truncate">{account}</span>
              </div>
              <span className="text-xs text-text-muted px-2 py-0.5 bg-bg-hover rounded-full">{stats.source}</span>
            </div>
            <p className="text-text-secondary text-xs mb-3">{stats.count.toLocaleString()} transactions</p>
            {showWipeConfirm === account ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleWipeAccount(account)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-accent-red/10 hover:bg-accent-red/20 text-accent-red text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" /> Confirm Wipe
                </button>
                <button
                  onClick={() => setShowWipeConfirm(null)}
                  className="text-text-muted text-xs px-3 py-1.5 rounded-lg hover:bg-bg-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowWipeConfirm(account)}
                className="flex items-center gap-1.5 text-accent-red/70 hover:text-accent-red text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Wipe Account
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bulk actions bar */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions..."
              className="w-full bg-bg-hover border border-border text-text-primary text-sm rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-accent-teal"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
            >
              <option value="all">All Accounts</option>
              {accounts.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
            >
              <option value="all">All Sources</option>
              {sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Bulk delete */}
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 bg-accent-red/10 hover:bg-accent-red/20 text-accent-red text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete {selectedIds.size} selected
            </button>
          )}

          {/* Wipe all */}
          {showWipeAllConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleWipeAll}
                className="flex items-center gap-1.5 bg-accent-red text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-accent-red/90 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" /> Yes, Wipe Everything
              </button>
              <button
                onClick={() => setShowWipeAllConfirm(false)}
                className="text-text-muted text-sm px-3 py-2 rounded-lg hover:bg-bg-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowWipeAllConfirm(true)}
              className="flex items-center gap-1.5 text-accent-red/60 hover:text-accent-red text-sm font-medium px-3 py-2 rounded-lg hover:bg-accent-red/5 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Wipe All
            </button>
          )}
        </div>

        <p className="text-text-muted text-xs mt-2">
          Showing {filtered.length.toLocaleString()} of {data.transactions.length.toLocaleString()} transactions
        </p>
      </div>

      {/* Transaction list grouped by month */}
      <div className="space-y-3">
        {groupedByMonth.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-text-muted text-sm">No transactions found</p>
          </div>
        )}
        {groupedByMonth.map(({ month, label, transactions: txns, total, count }) => {
          const isExpanded = expandedMonth === month;
          const monthAllSelected = txns.every((t) => selectedIds.has(t.id));
          return (
            <div key={month} className="card overflow-hidden">
              <button
                onClick={() => setExpandedMonth(isExpanded ? null : month)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-bg-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={monthAllSelected}
                    onChange={(e) => { e.stopPropagation(); toggleSelectMonth(month); }}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-accent-teal w-3.5 h-3.5"
                  />
                  <span className="text-text-primary text-sm font-medium">{label}</span>
                  <span className="text-text-muted text-xs">{count} transactions</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-medium ${total < 0 ? 'text-accent-red' : 'text-accent-teal'}`}>
                    {fmt(total)}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-border divide-y divide-border/50">
                  {txns.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-5 py-2.5 hover:bg-bg-hover/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="accent-accent-teal w-3.5 h-3.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-text-primary text-sm truncate">{t.description}</span>
                          <span className="text-text-muted text-xs px-1.5 py-0.5 bg-bg-hover rounded flex-shrink-0">{t.category}</span>
                        </div>
                        <div className="flex items-center gap-2 text-text-muted text-xs mt-0.5">
                          <span>{format(new Date(t.date), 'MMM d, yyyy')}</span>
                          <span>·</span>
                          <span>{t.account}</span>
                          <span>·</span>
                          <span>{t.source}</span>
                        </div>
                      </div>
                      <span className={`text-sm font-medium flex-shrink-0 ${t.amount < 0 ? 'text-accent-red' : 'text-accent-teal'}`}>
                        {fmt(t.amount)}
                      </span>
                      <button
                        onClick={() => handleDeleteOne(t.id)}
                        className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
