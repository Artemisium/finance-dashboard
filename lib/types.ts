export type DataSource = 'scotiabank' | 'amex' | 'wealthsimple' | 'manual';

export type AccountType =
  | 'chequing'
  | 'savings'
  | 'credit'
  | 'loan'
  | 'loc'
  | 'investment'
  | 'stock'
  | 'crypto'
  | 'rrsp'
  | 'tfsa'
  | 'fhsa'
  | 'other';

export interface Transaction {
  id: string;
  date: string; // ISO string
  description: string;
  amount: number; // negative = expense, positive = income/deposit
  category: string;
  source: DataSource;
  account: string;
  rawDescription: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  source: DataSource;
  lastUpdated: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number; // expected/flat rate per period
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  category: string;
  dayOfMonth?: number;
  notes?: string;
  active: boolean;
  // --- Transaction matching ---
  matchKeyword?: string;        // auto-match transactions by keyword (case-insensitive)
  matchAccount?: string;        // restrict matching to specific account
  linkedTransactionIds?: string[]; // manually linked transactions (for generic descriptions like "withdrawal")
}

export interface BudgetCategory {
  id: string;
  category: string;
  monthlyLimit: number;
  color?: string;
}

export interface IncomeEntry {
  id: string;
  date: string;
  grossAmount: number;
  netAmount: number;
  type: 'salary' | 'bonus' | 'freelance' | 'other';
  notes?: string;
}

export interface TaxSettings {
  province: string;
  filingStatus: 'single' | 'married';
  rrspContributionRoom: number;
  tfsaContributionRoom: number;
  ytdRrspContributions: number;
  ytdTfsaContributions: number;
}

export interface SalarySettings {
  annualSalary: number;
  annualBonus: number;
  bonusMonth: number; // 0-11 (January = 0)
  payFrequency: 'biweekly' | 'semimonthly' | 'monthly';
  employer: string;
}

export interface CategoryRule {
  id: string;
  keyword: string;        // substring match (case-insensitive)
  category: string;       // target category
  enabled: boolean;
}

export interface AppData {
  transactions: Transaction[];
  accounts: Account[];
  recurringExpenses: RecurringExpense[];
  budgetCategories: BudgetCategory[];
  incomeEntries: IncomeEntry[];
  taxSettings: TaxSettings;
  salarySettings: SalarySettings;
  categoryRules: CategoryRule[];
  lastUpdated: string;
}
