export type DataSource = 'scotiabank' | 'amex' | 'wealthsimple' | 'manual';

export type AccountType =
  | 'chequing'
  | 'savings'
  | 'credit'
  | 'investment'
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
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  category: string;
  dayOfMonth?: number;
  notes?: string;
  active: boolean;
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

export interface AppData {
  transactions: Transaction[];
  accounts: Account[];
  recurringExpenses: RecurringExpense[];
  budgetCategories: BudgetCategory[];
  incomeEntries: IncomeEntry[];
  taxSettings: TaxSettings;
  lastUpdated: string;
}
