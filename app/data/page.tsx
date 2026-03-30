'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { Trash2, AlertTriangle, Search, Filter, Database, ChevronDown, ChevronUp, Copy, Plus, X, Zap, Tag, ArrowUpDown, Calendar } from 'lucide-react';
import {
  loadData, saveData, wipeTransactionsByAccount, deleteTransaction,
  getUniqueAccounts, findDuplicates, removeDuplicates,
  updateTransactionCategory, applyUserCategoryRules,
} from '@/lib/store';
import { AppData, Transaction, CategoryRule } from '@/lib/types';
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/categories';

function fmt(n: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n);
}
function generateId() { return Math.random().toString(36).substring(2) + Date.now().toString(36); }

type TabId = 'transactions' | 'rules';

function TransactionRow({ t, selectedIds, toggleSelect, handleChangeCategory, handleDeleteOne }: {
  t: Transaction;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  handleChangeCategory: (id: string, cat: string) => void;
  handleDeleteOne: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-bg-hover/50 transition-colors">
      <input
        type="checkbox"
        checked={selectedIds.has(t.id)}
        onChange={() => toggleSelect(t.id)}
        className="accent-accent-teal w-3.5 h-3.5 flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-text-primary text-sm truncate">{t.description}</span>
          <select
            value={t.category}
            onChange={(e) => handleChangeCategory(t.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs px-1.5 py-0.5 rounded border-0 bg-bg-hover text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent-teal cursor-pointer flex-shrink-0"
            style={{ borderLeft: `3px solid ${CATEGORY_COLORS[t.category] || '#6b7280'}` }}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
  );
}

export default function DataManagementPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showWipeConfirm, setShowWipeConfirm] = useState<string | null>(null);
  const [showWipeAllConfirm, setShowWipeAllConfirm] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabId>('transactions');
  // Sort & date range
  const [sortBy, setSortBy] = useState<'date' | 'amount-asc' | 'amount-desc'>('date');
  const [dateRange, setDateRange] = useState<'all' | '1m' | '3m' | '6m' | '12m' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  // Rules form state
  const [newRuleKeyword, setNewRuleKeyword] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('Transfers');
  // Bulk recategorize state
  const [bulkCategory, setBulkCategory] = useState('Transfers');

  useEffect(() => {
    setData(loadData());
  }, []);

  const transactions = data?.transactions || [];
  const accounts = getUniqueAccounts(transactions);
  const sourceSet: Record<string, boolean> = {};
  transactions.forEach((t) => { if (t.source) sourceSet[t.source] = true; });
  const sources = Object.keys(sourceSet).sort();

  // Unique categories in use
  const categoriesInUse = useMemo(() => {
    const cats = new Set(transactions.map((t) => t.category));
    return Array.from(cats).sort();
  }, [transactions]);

  // Date range bounds
  const dateRangeBounds = useMemo(() => {
    if (dateRange === 'all') return { from: '', to: '' };
    if (dateRange === 'custom') return { from: customFrom, to: customTo };
    const now = new Date();
    const months = dateRange === '1m' ? 1 : dateRange === '3m' ? 3 : dateRange === '6m' ? 6 : 12;
    const from = format(subMonths(now, months), 'yyyy-MM-dd');
    return { from, to: '' };
  }, [dateRange, customFrom, customTo]);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (filterAccount !== 'all' && t.account !== filterAccount) return false;
      if (filterSource !== 'all' && t.source !== filterSource) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (dateRangeBounds.from && t.date < dateRangeBounds.from) return false;
      if (dateRangeBounds.to && t.date > dateRangeBounds.to) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!t.description.toLowerCase().includes(s) && !t.category.toLowerCase().includes(s) && !t.date.includes(s)) return false;
      }
      return true;
    });
  }, [transactions, filterAccount, filterSource, filterCategory, dateRangeBounds, search]);

  // Sorted flat list (for amount sort modes)
  const sortedFlat = useMemo(() => {
    const copy = [...filtered];
    if (sortBy === 'amount-desc') copy.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    else if (sortBy === 'amount-asc') copy.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
    else copy.sort((a, b) => b.date.localeCompare(a.date));
    return copy;
  }, [filtered, sortBy]);

  // Group by month (only used in date sort mode)
  const groupedByMonth = useMemo(() => {
    if (sortBy !== 'date') return [];
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
  }, [filtered, sortBy]);

  // Account stats
  const accountStats = useMemo(() => {
    const map: Record<string, { count: number; source: string }> = {};
    transactions.forEach((t) => {
      if (!map[t.account]) map[t.account] = { count: 0, source: t.source || 'unknown' };
      map[t.account].count++;
    });
    return Object.entries(map).sort(([, a], [, b]) => b.count - a.count);
  }, [transactions]);

  const duplicateGroups = useMemo(() => findDuplicates(transactions), [transactions]);
  const totalDuplicates = duplicateGroups.reduce((s, g) => s + g.transactions.length - 1, 0);

  const categoryRules = data?.categoryRules || [];

  if (!data) return null;

  // ─── Handlers ─────────────────────────────────────────────────────────

  function persist(updated: AppData) {
    saveData(updated);
    setData(updated);
  }

  function handleChangeCategory(txId: string, newCategory: string) {
    if (!data) return;
    persist(updateTransactionCategory(data, txId, newCategory));
  }

  function handleBulkRecategorize() {
    if (!data || selectedIds.size === 0) return;
    const updated = {
      ...data,
      transactions: data.transactions.map((t) =>
        selectedIds.has(t.id) ? { ...t, category: bulkCategory } : t
      ),
    };
    persist(updated);
    setSelectedIds(new Set());
  }

  function handleWipeAccount(account: string) {
    if (!data) return;
    persist(wipeTransactionsByAccount(data, account));
    setShowWipeConfirm(null);
    setSelectedIds(new Set());
  }

  function handleWipeAll() {
    if (!data) return;
    persist({ ...data, transactions: [] });
    setShowWipeAllConfirm(false);
    setSelectedIds(new Set());
  }

  function handleDeleteOne(id: string) {
    if (!data) return;
    persist(deleteTransaction(data, id));
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }

  function handleDeleteSelected() {
    if (!data || selectedIds.size === 0) return;
    persist({
      ...data,
      transactions: data.transactions.filter((t) => !selectedIds.has(t.id)),
    });
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

  function handleRemoveDuplicates() {
    if (!data) return;
    const result = removeDuplicates(data);
    persist(result.data);
    setSelectedIds(new Set());
  }

  // ─── Rules handlers ───────────────────────────────────────────────────

  function handleAddRule() {
    if (!data || !newRuleKeyword.trim()) return;
    const rule: CategoryRule = {
      id: generateId(),
      keyword: newRuleKeyword.trim(),
      category: newRuleCategory,
      enabled: true,
    };
    persist({ ...data, categoryRules: [...(data.categoryRules || []), rule] });
    setNewRuleKeyword('');
  }

  function handleDeleteRule(ruleId: string) {
    if (!data) return;
    persist({ ...data, categoryRules: (data.categoryRules || []).filter((r) => r.id !== ruleId) });
  }

  function handleToggleRule(ruleId: string) {
    if (!data) return;
    persist({
      ...data,
      categoryRules: (data.categoryRules || []).map((r) =>
        r.id === ruleId ? { ...r, enabled: !r.enabled } : r
      ),
    });
  }

  function handleApplyAllRules() {
    if (!data) return;
    persist(applyUserCategoryRules(data));
  }

  function handleRuleChangeCategory(ruleId: string, newCat: string) {
    if (!data) return;
    persist({
      ...data,
      categoryRules: (data.categoryRules || []).map((r) =>
        r.id === ruleId ? { ...r, category: newCat } : r
      ),
    });
  }

  // Count how many transactions each rule would match
  function ruleMatchCount(keyword: string): number {
    const lower = keyword.toLowerCase();
    return transactions.filter((t) => t.description.toLowerCase().includes(lower)).length;
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const TABS: { id: TabId; label: string }[] = [
    { id: 'transactions', label: 'Transactions' },
    { id: 'rules', label: 'Category Rules' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Data Management</h1>
        <p className="text-text-secondary text-sm mt-0.5">
          {transactions.length.toLocaleString()} transactions across {accounts.length} accounts
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-card border border-border rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-accent-teal/10 text-accent-teal'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ TRANSACTIONS TAB ═══ */}
      {activeTab === 'transactions' && (
        <>
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

          {/* Duplicate detection */}
          {totalDuplicates > 0 && (
            <div className="card p-4 border border-amber-500/20 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Copy className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-text-primary text-sm font-medium">
                      {totalDuplicates} duplicate{totalDuplicates !== 1 ? 's' : ''} detected
                    </p>
                    <p className="text-text-muted text-xs">
                      {duplicateGroups.length} group{duplicateGroups.length !== 1 ? 's' : ''} of matching transactions
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveDuplicates}
                  className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Remove All Duplicates
                </button>
              </div>
              <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto">
                {duplicateGroups.slice(0, 10).map((g) => (
                  <div key={g.fingerprint} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-bg-hover/50">
                    <span className="text-text-secondary truncate flex-1">
                      {g.transactions[0].description} — {format(new Date(g.transactions[0].date), 'MMM d, yyyy')} — {fmt(g.transactions[0].amount)}
                    </span>
                    <span className="text-amber-400 font-medium ml-2">{g.transactions.length}x</span>
                  </div>
                ))}
                {duplicateGroups.length > 10 && (
                  <p className="text-text-muted text-xs pl-2">...and {duplicateGroups.length - 10} more groups</p>
                )}
              </div>
            </div>
          )}

          {/* Search / filter / actions bar */}
          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
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
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                >
                  <option value="all">All Categories</option>
                  {categoriesInUse.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Sort & Date Range row */}
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-4 h-4 text-text-muted" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  className="bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                >
                  <option value="date">Sort by Date</option>
                  <option value="amount-desc">Largest Amount First</option>
                  <option value="amount-asc">Smallest Amount First</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                  className="bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                >
                  <option value="all">All Time</option>
                  <option value="1m">Last Month</option>
                  <option value="3m">Last 3 Months</option>
                  <option value="6m">Last 6 Months</option>
                  <option value="12m">Last 12 Months</option>
                  <option value="custom">Custom Range</option>
                </select>
                {dateRange === 'custom' && (
                  <>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="bg-bg-hover border border-border text-text-primary text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-accent-teal"
                    />
                    <span className="text-text-muted text-xs">to</span>
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="bg-bg-hover border border-border text-text-primary text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-accent-teal"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Selection actions */}
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border">
                <span className="text-text-secondary text-sm">{selectedIds.size} selected</span>

                {/* Bulk recategorize */}
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-accent-teal" />
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value)}
                    className="bg-bg-hover border border-border text-text-primary text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-accent-teal"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    onClick={handleBulkRecategorize}
                    className="flex items-center gap-1.5 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Re-categorize
                  </button>
                </div>

                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1.5 bg-accent-red/10 hover:bg-accent-red/20 text-accent-red text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            )}

            {/* Wipe all */}
            <div className="flex items-center justify-between mt-3">
              <p className="text-text-muted text-xs">
                Showing {filtered.length.toLocaleString()} of {transactions.length.toLocaleString()} transactions
              </p>
              {showWipeAllConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleWipeAll}
                    className="flex items-center gap-1.5 bg-accent-red text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-accent-red/90 transition-colors"
                  >
                    <AlertTriangle className="w-3 h-3" /> Yes, Wipe Everything
                  </button>
                  <button
                    onClick={() => setShowWipeAllConfirm(false)}
                    className="text-text-muted text-xs px-3 py-1.5 rounded-lg hover:bg-bg-hover transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowWipeAllConfirm(true)}
                  className="flex items-center gap-1.5 text-accent-red/60 hover:text-accent-red text-xs font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Wipe All
                </button>
              )}
            </div>
          </div>

          {/* Transaction list */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="card p-12 text-center">
                <p className="text-text-muted text-sm">No transactions found</p>
              </div>
            )}

            {/* ── Grouped by month (date sort) ── */}
            {sortBy === 'date' && groupedByMonth.map(({ month, label, transactions: txns, total, count }) => {
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
                        <TransactionRow key={t.id} t={t} selectedIds={selectedIds} toggleSelect={toggleSelect} handleChangeCategory={handleChangeCategory} handleDeleteOne={handleDeleteOne} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Flat list (amount sort) ── */}
            {sortBy !== 'date' && filtered.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-text-secondary text-sm font-medium">
                    {sortBy === 'amount-desc' ? 'Largest first' : 'Smallest first'}
                  </span>
                  <span className="text-text-muted text-xs">{sortedFlat.length} transactions</span>
                </div>
                <div className="divide-y divide-border/50 max-h-[70vh] overflow-y-auto">
                  {sortedFlat.map((t) => (
                    <TransactionRow key={t.id} t={t} selectedIds={selectedIds} toggleSelect={toggleSelect} handleChangeCategory={handleChangeCategory} handleDeleteOne={handleDeleteOne} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══ RULES TAB ═══ */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Explanation */}
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-accent-teal flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-text-primary text-sm font-medium mb-1">Category Rules</h3>
                <p className="text-text-muted text-xs leading-relaxed">
                  Create rules to automatically re-categorize transactions based on keywords in their description.
                  This is useful for bulk-fixing miscategorized transactions — for example, marking all &quot;PAYMENT THANK YOU&quot; transactions as &quot;Debt Payment&quot;
                  or all e-transfers from a specific person as &quot;Reimbursement&quot;. Rules are applied in order — the first match wins.
                </p>
              </div>
            </div>
          </div>

          {/* Add new rule */}
          <div className="card p-5">
            <h3 className="text-text-primary text-sm font-medium mb-3">Add New Rule</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-text-muted text-xs whitespace-nowrap">If description contains</span>
                <input
                  type="text"
                  value={newRuleKeyword}
                  onChange={(e) => setNewRuleKeyword(e.target.value)}
                  placeholder="e.g. PAYMENT THANK YOU"
                  className="flex-1 bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddRule(); }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-text-muted text-xs whitespace-nowrap">then set to</span>
                <select
                  value={newRuleCategory}
                  onChange={(e) => setNewRuleCategory(e.target.value)}
                  className="bg-bg-hover border border-border text-text-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent-teal"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button
                onClick={handleAddRule}
                disabled={!newRuleKeyword.trim()}
                className="flex items-center gap-1.5 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Add Rule
              </button>
            </div>
            {newRuleKeyword.trim() && (
              <p className="text-text-muted text-xs mt-2">
                This rule would match {ruleMatchCount(newRuleKeyword)} transaction{ruleMatchCount(newRuleKeyword) !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Existing rules */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="text-text-primary text-sm font-medium">{categoryRules.length} Rule{categoryRules.length !== 1 ? 's' : ''}</h3>
              {categoryRules.length > 0 && (
                <button
                  onClick={handleApplyAllRules}
                  className="flex items-center gap-1.5 bg-accent-teal/10 hover:bg-accent-teal/20 text-accent-teal text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Zap className="w-3 h-3" /> Apply All Rules Now
                </button>
              )}
            </div>
            {categoryRules.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-text-muted text-sm">No rules yet. Add one above to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {categoryRules.map((rule) => (
                  <div key={rule.id} className={`flex items-center gap-3 px-5 py-3 ${!rule.enabled ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      className="accent-accent-teal w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="text-text-muted text-xs">contains</span>
                      <span className="text-text-primary text-sm font-medium bg-bg-hover px-2 py-0.5 rounded truncate">
                        &quot;{rule.keyword}&quot;
                      </span>
                      <span className="text-text-muted text-xs">→</span>
                      <select
                        value={rule.category}
                        onChange={(e) => handleRuleChangeCategory(rule.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded bg-bg-hover border border-border text-text-primary focus:outline-none focus:border-accent-teal"
                        style={{ borderLeft: `3px solid ${CATEGORY_COLORS[rule.category] || '#6b7280'}` }}
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="text-text-muted text-xs">({ruleMatchCount(rule.keyword)} matches)</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1.5 rounded hover:bg-bg-hover text-text-muted hover:text-accent-red transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
