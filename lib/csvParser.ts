import Papa from 'papaparse';
import { parse, isValid } from 'date-fns';
import { Transaction, DataSource } from './types';
import { categorizeTransaction } from './categories';

// Simple UUID-like ID generator
function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Month abbreviation map (handles "Mar." and "Mar" formats)
const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // Try "dd MMM. yyyy" or "dd MMM yyyy" (e.g. "26 Mar. 2026", "26 Mar 2026")
  const amexMatch = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\.?\s+(\d{4})$/);
  if (amexMatch) {
    const day = amexMatch[1].padStart(2, '0');
    const mon = MONTH_MAP[amexMatch[2].toLowerCase()];
    const year = amexMatch[3];
    if (mon) return `${year}-${mon}-${day}`;
  }

  // Try standard date-fns formats
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
      const d = parse(s, fmt, new Date());
      if (isValid(d)) return d.toISOString().split('T')[0];
    } catch {
      // try next
    }
  }
  return null;
}

function cleanAmount(raw: string): number {
  if (!raw) return 0;
  // Handle negative like -$277.16 or ($277.16) or $277.16
  const isNeg = raw.includes('-') || raw.includes('(');
  const cleaned = raw.replace(/[$,\s()]/g, '').replace(/^-/, '');
  const val = parseFloat(cleaned) || 0;
  return isNeg ? -val : val;
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
        amount = deposits > 0 ? deposits : -Math.abs(withdrawals);
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
// Real format has 11 metadata rows, then headers on row 12:
// Date,Date Processed,Description,Amount,Foreign Spend Amount,Commission,Exchange Rate,Merchant,Merchant Address,Additional Information
// Dates: "26 Mar. 2026", Amounts: "$62.94" (positive = charge, negative = payment/credit)
function parseAmex(rows: Record<string, string>[], accountName: string): Transaction[] {
  return rows
    .map((r): Transaction | null => {
      // Try multiple possible column names
      const dateRaw = r['Date'] || r['date'] || '';
      const date = parseDate(dateRaw);
      if (!date) return null;

      const description = (
        r['Description'] || r['description'] || r['Merchant'] || r['merchant'] || ''
      ).trim().replace(/\s+/g, ' '); // collapse multiple spaces

      if (!description) return null;

      const rawAmount = cleanAmount(r['Amount'] || r['amount'] || '');
      // Amex Canada: positive = charge (expense), negative = payment/credit
      // We want expenses as negative, income/payments as positive
      const amount = -rawAmount;

      return {
        id: generateId(),
        date,
        description,
        rawDescription: description,
        amount,
        category: categorizeTransaction(description),
        source: 'amex',
        account: accountName,
      };
    })
    .filter((t): t is Transaction => t !== null && t.amount !== 0);
}

// ─── Wealthsimple ─────────────────────────────────────────────────────────────
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
  if (h.includes('date processed') || h.includes('foreign spend amount') || h.includes('merchant address')) return 'amex';
  if (h.some((x) => x === 'amount') && !h.includes('balance')) return 'amex';
  return 'scotiabank'; // fallback
}

// ─── Pre-process Amex CSV ────────────────────────────────────────────────────
// Amex Canada CSVs have metadata rows before the real headers.
// We find the actual header row and return only the data portion.
function preprocessAmexCSV(content: string): string {
  const lines = content.split(/\r?\n/);
  // Find the row that starts with "Date,Date Processed" or just has the data headers
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.startsWith('date,date processed') || lower.startsWith('date,description,')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    // Try to find any row that looks like it has "Date" as first column and multiple commas
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      if (/^date,/i.test(lines[i].trim()) && lines[i].split(',').length >= 4) {
        headerIdx = i;
        break;
      }
    }
  }
  if (headerIdx > 0) {
    return lines.slice(headerIdx).join('\n');
  }
  return content;
}

export function parseCSVFile(
  content: string,
  source: DataSource,
  accountName: string
): ParsedCSVResult {
  const errors: string[] = [];

  // Pre-process Amex CSVs to strip metadata rows
  let processedContent = content;
  if (source === 'amex') {
    processedContent = preprocessAmexCSV(content);
  } else {
    // Auto-detect: check if this looks like an Amex file even if not tagged as such
    const firstLines = content.split(/\r?\n/).slice(0, 5).join(' ').toLowerCase();
    if (firstLines.includes('american express') || firstLines.includes('amex')) {
      processedContent = preprocessAmexCSV(content);
      source = 'amex';
    }
  }

  const result = Papa.parse<Record<string, string>>(processedContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length > 0) {
    result.errors.forEach((e) => errors.push(e.message));
  }

  // Auto-detect source from actual parsed headers
  const headers = result.meta.fields || [];
  if (source !== 'amex' && source !== 'wealthsimple') {
    const detected = detectSource(headers);
    if (detected !== source) source = detected;
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
