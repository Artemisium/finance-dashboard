import Papa from 'papaparse';
import { parse, isValid } from 'date-fns';
import { Transaction, DataSource } from './types';
import { categorizeTransaction } from './categories';
// Simple UUID-like ID generator
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function parseDate(raw: string): string | null {
  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'dd/MM/yyyy',
    'MMM dd, yyyy',
    'MMMM dd, yyyy',
    'yyyy/MM/dd',
    'MM-dd-yyyy',
  ];
  for (const fmt of formats) {
    try {
      const d = parse(raw.trim(), fmt, new Date());
      if (isValid(d)) return d.toISOString().split('T')[0];
    } catch {
      // try next
    }
  }
  return null;
}

function cleanAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/\((.+)\)/, '-$1');
  return parseFloat(cleaned) || 0;
}

// ─── Scotiabank ──────────────────────────────────────────────────────────────
// Expected columns: Date, Description, Withdrawals, Deposits, Balance
// OR: Date, Transaction, Name, Memo, Amount
function parseScotiabank(rows: Record<string, string>[], accountName: string): Transaction[] {
  return rows
    .filter((r) => r['Date'] || r['date'])
    .map((r): Transaction | null => {
      const dateRaw = r['Date'] || r['date'] || '';
      const date = parseDate(dateRaw);
      if (!date) return null;

      const description = r['Description'] || r['description'] || r['Name'] || r['Memo'] || '';
      const withdrawals = cleanAmount(r['Withdrawals'] || r['withdrawals'] || '');
      const deposits = cleanAmount(r['Deposits'] || r['deposits'] || '');
      const directAmount = cleanAmount(r['Amount'] || r['amount'] || '');

      let amount: number;
      if (r['Withdrawals'] !== undefined || r['Deposits'] !== undefined) {
        // Withdrawals are expenses (negative), deposits are income (positive)
        amount = deposits > 0 ? deposits : -withdrawals;
      } else {
        amount = directAmount;
      }

      return {
        id: generateId(),
        date,
        description: description.trim(),
        rawDescription: description.trim(),
        amount,
        category: categorizeTransaction(description),
        source: 'scotiabank',
        account: accountName,
      };
    })
    .filter((t): t is Transaction => t !== null && t.amount !== 0);
}

// ─── American Express Canada ─────────────────────────────────────────────────
// Expected columns: Date, Description, Amount  (amount negative = charge)
function parseAmex(rows: Record<string, string>[], accountName: string): Transaction[] {
  return rows
    .filter((r) => r['Date'] || r['date'])
    .map((r): Transaction | null => {
      const dateRaw = r['Date'] || r['date'] || '';
      const date = parseDate(dateRaw);
      if (!date) return null;

      const description = r['Description'] || r['description'] || r['Merchant'] || '';
      const rawAmount = cleanAmount(r['Amount'] || r['amount'] || '');
      // Amex: negative = charge to card (expense), positive = credit/payment
      const amount = -rawAmount; // flip: negative becomes expense

      return {
        id: generateId(),
        date,
        description: description.trim(),
        rawDescription: description.trim(),
        amount,
        category: categorizeTransaction(description),
        source: 'amex',
        account: accountName,
      };
    })
    .filter((t): t is Transaction => t !== null && t.amount !== 0);
}

// ─── Wealthsimple ─────────────────────────────────────────────────────────────
// Expected columns: Date, Activity Type, Description, Symbol, Quantity, Price, Net Amount, Currency
function parseWealthsimple(rows: Record<string, string>[], accountName: string): Transaction[] {
  return rows
    .filter((r) => r['Date'] || r['date'])
    .map((r): Transaction | null => {
      const dateRaw = r['Date'] || r['date'] || '';
      const date = parseDate(dateRaw);
      if (!date) return null;

      const activityType = r['Activity Type'] || r['activity_type'] || r['Type'] || '';
      const description =
        r['Description'] || r['description'] ||
        `${activityType} ${r['Symbol'] || ''}`.trim();
      const netAmount = cleanAmount(r['Net Amount'] || r['net_amount'] || r['Amount'] || '');

      // For investments: buys are negative (money out), sells/dividends are positive
      const amount = netAmount;

      return {
        id: generateId(),
        date,
        description: description.trim(),
        rawDescription: description.trim(),
        amount,
        category: 'Investments',
        source: 'wealthsimple',
        account: accountName,
      };
    })
    .filter((t): t is Transaction => t !== null && t.amount !== 0);
}

export type ParsedCSVResult = {
  transactions: Transaction[];
  accountName: string;
  source: DataSource;
  count: number;
  errors: string[];
};

export function detectSource(headers: string[]): DataSource {
  const h = headers.map((s) => s.toLowerCase().trim());
  if (h.includes('withdrawals') || h.includes('deposits')) return 'scotiabank';
  if (h.includes('activity type') || h.includes('symbol') || h.includes('net amount')) return 'wealthsimple';
  if (h.some((x) => x === 'amount') && !h.includes('balance')) return 'amex';
  return 'scotiabank'; // fallback
}

export function parseCSVFile(
  content: string,
  source: DataSource,
  accountName: string
): ParsedCSVResult {
  const errors: string[] = [];

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((e) => errors.push(e.message));
  }

  const rows = result.data;
  let transactions: Transaction[] = [];

  try {
    if (source === 'scotiabank') {
      transactions = parseScotiabank(rows, accountName);
    } else if (source === 'amex') {
      transactions = parseAmex(rows, accountName);
    } else if (source === 'wealthsimple') {
      transactions = parseWealthsimple(rows, accountName);
    }
  } catch (e) {
    errors.push(`Parsing error: ${e}`);
  }

  return {
    transactions,
    accountName,
    source,
    count: transactions.length,
    errors,
  };
}
