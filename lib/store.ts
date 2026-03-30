'use client';

import { AppData, Transaction, RecurringExpense, BudgetCategory, IncomeEntry, TaxSettings, SalarySettings, CategoryRule } from './types';

const STORAGE_KEY = 'finance_dashboard_v1';

const DEFAULT_TAX_SETTINGS: TaxSettings = {
  province: 'ON',
  filingStatus: 'single',
  rrspContributionRoom: 31560,
  tfsaContributionRoom: 7000,
  ytdRrspContributions: 0,
  ytdTfsaContributions: 0,
};

const DEFAULT_SALARY_SETTINGS: SalarySettings = {
  annualSalary: 0,
  annualBonus: 0,
  bonusMonth: 2, // March default
  payFrequency: 'biweekly',
  employer: '',
};

const DEFAULT_DATA: AppData = {
  transactions: [],
  accounts: [],
  recurringExpenses: [],
  budgetCategories: [
    { id: '1', category: 'Groceries', monthlyLimit: 600, color: '#4ecca3' },
    { id: '2', category: 'Dining & Restaurants', monthlyLimit: 300, color: '#f5a623' },
    { id: '3', category: 'Transportation', monthlyLimit: 200, color: '#60a5fa' },
    { id: '4', category: 'Entertainment', monthlyLimit: 150, color: '#a78bfa' },
    { id: '5', category: 'Shopping & Retail', monthlyLimit: 400, color: '#f87171' },
    { id: '6', category: 'Health & Medical', monthlyLimit: 100, color: '#4ade80' },
  ],
  incomeEntries: [],
  taxSettings: DEFAULT_TAX_SETTINGS,
  salarySettings: DEFAULT_SALARY_SETTINGS,
  categoryRules: [],
  lastUpdated: new Date().toISOString(),
};

export function loadData(): AppData {
  if (typeof window === 'undefined') return DEFAULT_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as AppData;
    return { ...DEFAULT_DATA, ...parsed };
  } catch {
    return DEFAULT_DATA;
  }
}

export function saveData(data: AppData): void {
  if (typeof window === 'undefined') return;
  const updated = { ...data, lastUpdated: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save data', e);
  }
  // Auto-sync to server in background (fire and forget)
  syncToServer(updated).catch(() => {});
}

// ─── Server sync ─────────────────────────────────────────────────────────────

async function syncToServer(data: AppData): Promise<void> {
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch {
    // Server unavailable — localStorage is the fallback
  }
}


function txFingerprint(t: { date: string; amount: number; description: string; account?: string }): string {
  // Normalize description: lowercase, collapse whitespace, trim
  const desc = t.description.toLowerCase().replace(/\s+/g, ' ').trim();
  return `${t.date}|${t.amount}|${desc}|${t.account || ''}`;
}

export function mergeTransactions(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  // Deduplicate by date + amount + normalized description + account
  const existingKeys = new Set(existing.map(txFingerprint));
  const newOnes = incoming.filter((t) => !existingKeys.has(txFingerprint(t)));
  return [...existing, ...newOnes].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export interface DuplicateGroup {
  fingerprint: string;
  transactions: Transaction[];
}

export function findDuplicates(transactions: Transaction[]): DuplicateGroup[] {
  const groups: Record<string, Transaction[]> = {};
  transactions.forEach((t) => {
    const key = txFingerprint(t);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return Object.entries(groups)
    .filter(([, txns]) => txns.length > 1)
    .map(([fingerprint, txns]) => ({ fingerprint, transactions: txns }))
    .sort((a, b) => b.transactions.length - a.transactions.length);
}

export function removeDuplicates(data: AppData): { data: AppData; removed: number } {
  const seen = new Set<string>();
  const unique: Transaction[] = [];
  let removed = 0;
  // Keep the first occurrence, remove subsequent duplicates
  for (const t of data.transactions) {
    const key = txFingerprint(t);
    if (seen.has(key)) {
      removed++;
    } else {
      seen.add(key);
      unique.push(t);
    }
  }
  return { data: { ...data, transactions: unique }, removed };
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

export function getTransactionsByMonth(transactions: Transaction[], year: number, month: number): Transaction[] {
  return transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

const EXCLUDED_FROM_SPENDING = ['Transfers', 'Investments', 'Debt Payment'];
const EXCLUDED_FROM_INCOME = ['Transfers', 'Investments', 'Reimbursement'];

export function getExpenses(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.amount < 0 && !EXCLUDED_FROM_SPENDING.includes(t.category));
}

export function getIncome(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.amount > 0 && !EXCLUDED_FROM_INCOME.includes(t.category));
}

export function getDebtPayments(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.category === 'Debt Payment');
}

export function getReimbursements(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.category === 'Reimbursement');
}

export function sumAmount(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

export function groupByCategory(transactions: Transaction[]): Record<string, number> {
  return transactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);
}

export function getMonthlyTotals(transactions: Transaction[]): { month: string; income: number; expenses: number; net: number }[] {
  const map: Record<string, { income: number; expenses: number }> = {};

  transactions.forEach((t) => {
    if (EXCLUDED_FROM_SPENDING.includes(t.category) && t.amount < 0) return;
    if (EXCLUDED_FROM_INCOME.includes(t.category) && t.amount > 0) return;
    const key = t.date.substring(0, 7); // "YYYY-MM"
    if (!map[key]) map[key] = { income: 0, expenses: 0 };
    if (t.amount > 0) map[key].income += t.amount;
    else map[key].expenses += Math.abs(t.amount);
  });

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { income, expenses }]) => ({
      month,
      income: Math.round(income * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      net: Math.round((income - expenses) * 100) / 100,
    }));
}

// ─── Data Management helpers ─────────────────────────────────────────────────

export function wipeTransactionsByAccount(data: AppData, accountName: string): AppData {
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.account !== accountName),
  };
}

export function wipeTransactionsBySource(data: AppData, source: string): AppData {
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.source !== source),
  };
}

export function deleteTransaction(data: AppData, id: string): AppData {
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.id !== id),
  };
}

export function getUniqueAccounts(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((t) => t.account))).sort();
}

export function getUniqueSources(transactions: Transaction[]): string[] {
  return Array.from(new Set(transactions.map((t) => t.source))).sort();
}

// ─── Category rule helpers ──────────────────────────────────────────────────

export function applyUserCategoryRules(data: AppData): AppData {
  // Apply user-defined category rules to all transactions
  const rules = (data.categoryRules || []).filter((r) => r.enabled);
  if (rules.length === 0) return data;
  const updated = data.transactions.map((t) => {
    for (const rule of rules) {
      if (t.description.toLowerCase().includes(rule.keyword.toLowerCase())) {
        return { ...t, category: rule.category };
      }
    }
    return t;
  });
  return { ...data, transactions: updated };
}

export function updateTransactionCategory(data: AppData, transactionId: string, newCategory: string): AppData {
  return {
    ...data,
    transactions: data.transactions.map((t) =>
      t.id === transactionId ? { ...t, category: newCategory } : t
    ),
  };
}

// ─── Money Flow helpers ─────────────────────────────────────────────────────

// Categories that represent money moving between your own accounts — NOT real spending or income
const TRANSFER_CATEGORIES = ['Transfers', 'Debt Payment', 'Investments'];
const NOT_REAL_INCOME = ['Transfers', 'Investments', 'Reimbursement', 'Debt Payment'];

export function isRealExpense(t: Transaction): boolean {
  return t.amount < 0 && !TRANSFER_CATEGORIES.includes(t.category);
}

export function isRealIncome(t: Transaction): boolean {
  // Real income = positive amounts that aren't transfers/reimbursements/debt payments
  // Reimbursements are money-in but offset group expenses, not "income"
  return t.amount > 0 && !NOT_REAL_INCOME.includes(t.category);
}

export function isReimbursement(t: Transaction): boolean {
  return t.amount > 0 && t.category === 'Reimbursement';
}

export function isTransferPayment(t: Transaction): boolean {
  return TRANSFER_CATEGORIES.includes(t.category);
}

export function getMonthlyNetSalary(settings: SalarySettings, month: number, taxEst: { total: number }): number {
  // Net salary for a given month = gross for that month minus monthly tax share
  const gross = getExpectedMonthlyGross(settings, month);
  const monthlyTax = taxEst.total / 12;
  return gross - monthlyTax;
}

export interface MoneyFlowSummary {
  netSalary: number;
  otherIncome: number;     // real income that's not salary (freelance, side income)
  reimbursements: number;  // e-transfer paybacks for group expenses
  totalMoneyIn: number;
  realExpenses: number;
  transferPayments: number;
  totalMoneyOut: number;
  netCashFlow: number;
}

export function getMonthlyMoneyFlow(
  transactions: Transaction[],
  salarySettings: SalarySettings,
  month: number,
  year: number,
  taxEst: { total: number },
): MoneyFlowSummary {
  const monthTx = transactions.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  // Net salary from salary settings (not from transactions)
  const netSalary = salarySettings.annualSalary > 0 ? getMonthlyNetSalary(salarySettings, month, taxEst) : 0;

  // Other income from transactions (non-salary, non-transfer positive amounts)
  const otherIncomeTx = monthTx.filter((t) => t.amount > 0 && !NOT_REAL_INCOME.includes(t.category) && t.category !== 'Income');
  const otherIncome = otherIncomeTx.reduce((s, t) => s + t.amount, 0);

  // Reimbursements
  const reimbursements = monthTx.filter(isReimbursement).reduce((s, t) => s + t.amount, 0);

  const totalMoneyIn = netSalary + otherIncome + reimbursements;

  // Real expenses (negative amounts, excluding transfers)
  const realExpenses = Math.abs(monthTx.filter(isRealExpense).reduce((s, t) => s + t.amount, 0));

  // Transfer payments (debt payments, account transfers, investments)
  const transferPayments = Math.abs(monthTx.filter((t) => t.amount < 0 && isTransferPayment(t)).reduce((s, t) => s + t.amount, 0));

  const totalMoneyOut = realExpenses;

  return {
    netSalary: Math.round(netSalary),
    otherIncome: Math.round(otherIncome),
    reimbursements: Math.round(reimbursements),
    totalMoneyIn: Math.round(totalMoneyIn),
    realExpenses: Math.round(realExpenses),
    transferPayments: Math.round(transferPayments),
    totalMoneyOut: Math.round(totalMoneyOut),
    netCashFlow: Math.round(totalMoneyIn - totalMoneyOut),
  };
}

// ─── Salary / Income helpers ─────────────────────────────────────────────────

export function getMonthlyGrossSalary(settings: SalarySettings): number {
  if (!settings.annualSalary) return 0;
  switch (settings.payFrequency) {
    case 'monthly': return settings.annualSalary / 12;
    case 'semimonthly': return settings.annualSalary / 24;
    case 'biweekly': return settings.annualSalary / 26;
    default: return settings.annualSalary / 12;
  }
}

export function getPayPerPeriod(settings: SalarySettings): number {
  if (!settings.annualSalary) return 0;
  switch (settings.payFrequency) {
    case 'monthly': return settings.annualSalary / 12;
    case 'semimonthly': return settings.annualSalary / 24;
    case 'biweekly': return settings.annualSalary / 26;
    default: return settings.annualSalary / 12;
  }
}

export function getExpectedMonthlyGross(settings: SalarySettings, month: number): number {
  // month is 0-11
  let gross = settings.annualSalary / 12;
  if (settings.annualBonus > 0 && settings.bonusMonth === month) {
    gross += settings.annualBonus;
  }
  return gross;
}

export function detectSalaryDeposits(transactions: Transaction[]): Transaction[] {
  // Find deposits on chequing/debit accounts that look like salary or payroll
  // Salary deposits are typically: positive amounts, from chequing accounts,
  // with patterns like "PAYROLL", "SALARY", "DIRECT DEPOSIT", "PAY", employer names, etc.
  const salaryKeywords = [
    'payroll', 'salary', 'direct deposit', 'paycheque', 'paycheck',
    'pay', 'employment', 'bi-weekly pay', 'semi-monthly', 'compensation',
    'deposit from', 'electronic deposit',
  ];

  return transactions
    .filter((t) => {
      if (t.amount <= 0) return false; // must be a deposit
      if (t.category === 'Transfers' || t.category === 'Investments') return false;
      const lower = t.description.toLowerCase();
      // Match salary keywords
      if (salaryKeywords.some((kw) => lower.includes(kw))) return true;
      // Also detect large recurring deposits (> $1000) that aren't transfers
      if (t.amount >= 1000 && t.source === 'scotiabank') return true;
      return false;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Canadian Tax Estimate (simplified) ───────────────────────────────────────
interface TaxBracket { min: number; max: number; rate: number }

const FEDERAL_BRACKETS_2024: TaxBracket[] = [
  { min: 0, max: 55867, rate: 0.15 },
  { min: 55867, max: 111733, rate: 0.205 },
  { min: 111733, max: 154906, rate: 0.26 },
  { min: 154906, max: 220000, rate: 0.29 },
  { min: 220000, max: Infinity, rate: 0.33 },
];

const ONTARIO_BRACKETS_2024: TaxBracket[] = [
  { min: 0, max: 51446, rate: 0.0505 },
  { min: 51446, max: 102894, rate: 0.0915 },
  { min: 102894, max: 150000, rate: 0.1116 },
  { min: 150000, max: 220000, rate: 0.1216 },
  { min: 220000, max: Infinity, rate: 0.1316 },
];

function calcBracketTax(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    const taxable = Math.min(income, b.max) - b.min;
    tax += taxable * b.rate;
  }
  return tax;
}

export function estimateTax(grossIncome: number, rrspContributions: number = 0): {
  federal: number;
  provincial: number;
  cpp: number;
  ei: number;
  total: number;
  effectiveRate: number;
  netIncome: number;
} {
  const taxableIncome = Math.max(0, grossIncome - rrspContributions - 15705); // basic personal amount

  const federal = calcBracketTax(taxableIncome, FEDERAL_BRACKETS_2024);
  const provincial = calcBracketTax(taxableIncome, ONTARIO_BRACKETS_2024);

  // CPP2024: 5.95% on earnings between $3,500 and $68,500
  const cpp = Math.min(Math.max(grossIncome - 3500, 0), 65000) * 0.0595;
  // EI 2024: 1.66% up to $63,200
  const ei = Math.min(grossIncome, 63200) * 0.0166;

  const total = federal + provincial + cpp + ei;
  const effectiveRate = grossIncome > 0 ? (total / grossIncome) * 100 : 0;

  return {
    federal: Math.round(federal),
    provincial: Math.round(provincial),
    cpp: Math.round(cpp),
    ei: Math.round(ei),
    total: Math.round(total),
    effectiveRate: Math.round(effectiveRate * 10) / 10,
    netIncome: Math.round(grossIncome - total),
  };
}
