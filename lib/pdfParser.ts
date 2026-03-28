// Scotiabank PDF statement parser (client-side)
// Handles 3 account types:
// 1. Day-to-Day Banking (chequing/savings) — columns: Date, Transactions, withdrawn($), deposited($), Balance($)
// 2. ScotiaLine Personal Line of Credit — columns: REF#, TRANS DATE, POST DATE, DETAILS, AMOUNT($)
// 3. Scotiabank Visa cards — same as LOC format

import { Transaction, DataSource } from './types';
import { categorizeTransaction } from './categories';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Detect which Scotiabank account type from the text
export type ScotiaType = 'chequing' | 'loc' | 'visa';

export function detectScotiaType(text: string): ScotiaType {
  const lower = text.toLowerCase();
  if (lower.includes('scotialine') || lower.includes('line of credit')) return 'loc';
  if (lower.includes('visa') || lower.includes('passport') || lower.includes('scene+')) return 'visa';
  return 'chequing';
}

// Extract statement year from text like "March 18 to April 17, 2024" or "Statement Period Mar 23, 2024"
function extractStatementYear(text: string): number {
  // Look for 4-digit year
  const yearMatch = text.match(/20\d{2}/);
  return yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();
}

// Parse month abbreviations
const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function resolveDate(monthStr: string, day: string, year: number): string {
  const mon = MONTHS[monthStr.toLowerCase().substring(0, 3)];
  if (!mon) return '';
  return `${year}-${mon}-${day.padStart(2, '0')}`;
}

function cleanAmount(raw: string): number {
  if (!raw) return 0;
  const isCredit = raw.includes('-') && raw.indexOf('-') === raw.length - 1; // trailing minus = credit
  const isNeg = raw.startsWith('-') || isCredit;
  const cleaned = raw.replace(/[$,\-\s]/g, '');
  const val = parseFloat(cleaned) || 0;
  return isNeg ? -val : val;
}

// ─── Parse Day-to-Day Banking (Chequing/Savings) ─────────────────────────────
// Lines look like:
//   Mar 25     Withdrawal                               270.00                       843.91
//              42861757 Free Interac E-Transfer
//   Apr 1      MB-Transfer from                                      2,000.00      2,808.87
//              Credit Card
function parseChequing(text: string, accountName: string): Transaction[] {
  const lines = text.split('\n');
  const year = extractStatementYear(text);
  const transactions: Transaction[] = [];

  // Match transaction lines: date + description + amounts
  // Pattern: Mon DD  Description  [withdrawn]  [deposited]  balance
  const txRegex = /^\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(.+)/i;
  const amountRegex = /[\d,]+\.\d{2}/g;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(txRegex);

    if (match) {
      const monthStr = match[1];
      const day = match[2];
      const rest = match[3];

      // Skip Opening/Closing Balance lines
      if (rest.includes('Opening Balance') || rest.includes('Closing Balance')) {
        i++;
        continue;
      }

      // Extract amounts from the line
      const amounts = rest.match(amountRegex) || [];

      // Extract description (text before the first number)
      const descMatch = rest.match(/^(.*?)(?:\s{2,}[\d,]+\.\d{2}|\s*$)/);
      let description = descMatch ? descMatch[1].trim() : rest.trim();

      // Look ahead for continuation lines (indented, no date prefix)
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (!nextLine || nextLine.match(txRegex) || nextLine.includes('Closing Balance') ||
            nextLine.includes('continued on') || nextLine.includes('Page ') ||
            nextLine.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d/i)) {
          break;
        }
        // Skip barcode/noise lines
        if (nextLine.match(/^\d{6}$/) || nextLine.match(/^[A-Z]{3}\s*-/) || nextLine.match(/^SBSAV/) ||
            nextLine.match(/^Here's/) || nextLine.match(/^Date\s/) || nextLine.match(/^Amounts/)) {
          j++;
          continue;
        }
        description += ' ' + nextLine;
        j++;
      }

      const date = resolveDate(monthStr, day, year);
      if (!date) { i = j; continue; }

      let amount = 0;
      if (amounts.length >= 2) {
        // Has withdrawn and balance, or deposited and balance
        const firstAmt = cleanAmount(amounts[0]);
        const secondAmt = amounts.length >= 2 ? cleanAmount(amounts[1]) : 0;

        // Determine if the first amount is in withdrawn or deposited column
        // by checking position in the original line
        const firstAmtStr = amounts[0];
        const firstAmtIdx = rest.indexOf(firstAmtStr);
        const restLen = rest.length;

        // Rough column detection: withdrawn is ~middle, deposited is ~right-of-middle
        // If there are 3 amounts: withdrawn, deposited, balance
        // If there are 2 amounts: one of (withdrawn|deposited) + balance
        if (amounts.length >= 3) {
          // withdrawn, deposited, balance
          amount = cleanAmount(amounts[1]) - cleanAmount(amounts[0]);
        } else {
          // 2 amounts: determine which column the first one is in
          // Check the text layout — if description is followed by gap then amount, it's usually withdrawn
          // Deposits tend to appear more to the right
          const amtPos = line.indexOf(firstAmtStr, line.indexOf(description) + description.length);
          const lineLen = line.length;
          const relPos = amtPos / lineLen;

          // The balance is always the last amount
          // If there's a deposit, description usually says "Transfer from", "Deposit", "Investment"
          const isDeposit = /deposit|transfer from|investment|mb-transfer|pc transfer/i.test(description);
          amount = isDeposit ? firstAmt : -firstAmt;
        }
      } else if (amounts.length === 1) {
        // Only balance shown (e.g. Opening Balance) — skip
        i = j;
        continue;
      }

      if (amount !== 0) {
        transactions.push({
          id: generateId(),
          date,
          description: description.replace(/\s+/g, ' ').trim(),
          rawDescription: description.replace(/\s+/g, ' ').trim(),
          amount,
          category: categorizeTransaction(description),
          source: 'scotiabank',
          account: accountName,
        });
      }

      i = j;
    } else {
      i++;
    }
  }

  return transactions;
}

// ─── Parse LOC / Visa Statements ─────────────────────────────────────────────
// Lines look like:
//   003 Apr 1   Apr 1   MB - CASH ADVANCE TO - *****02*36 27   2,000.00
//   023   Mar 7   Mar 8   MIKE'S INDEPENDENT CIT TORONTO ON    134.88
//   027   Mar 12 Mar 12 MB-CREDIT CARD/LOC PAY. FROM -       1,170.57-  (trailing minus = credit)
function parseLOCVisa(text: string, accountName: string, type: ScotiaType): Transaction[] {
  const lines = text.split('\n');
  const year = extractStatementYear(text);
  const transactions: Transaction[] = [];

  // Match: ref# date1 date2 description amount
  // The ref# is 3 digits, dates are Mon DD
  const txRegex = /^\s*(\d{3})\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2})\s+(.+)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(txRegex);
    if (!match) continue;

    const transDateStr = match[2]; // e.g. "Apr 1"
    const dateMatch = transDateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
    if (!dateMatch) continue;

    const date = resolveDate(dateMatch[1], dateMatch[2], year);
    if (!date) continue;

    const detailsAndAmount = match[4].trim();

    // Extract amount (last number on the line, possibly with trailing minus)
    const amountMatch = detailsAndAmount.match(/([\d,]+\.\d{2}-?)(?:\s|$)/g);
    if (!amountMatch) continue;

    // Last amount match is the CAD amount (foreign amounts come before)
    const lastAmountStr = amountMatch[amountMatch.length - 1].trim();
    const rawAmount = cleanAmount(lastAmountStr);

    // Description is everything before the last amount
    const lastIdx = detailsAndAmount.lastIndexOf(lastAmountStr.replace('-', ''));
    let description = detailsAndAmount.substring(0, lastIdx).trim();

    // Clean up foreign amount text
    description = description.replace(/AMT\s*[\d,.]+\s*(?:YEN|USD|EUR|GBP|MXN|AUD)\s*/gi, '').trim();
    description = description.replace(/\s+/g, ' ');

    // Skip interest charges and subtotals
    if (/INTEREST CHARGES|SUB-TOTAL|TOTAL CREDITS|TOTAL DEBITS/i.test(description)) continue;

    // LOC/Visa: positive amounts = charges (expenses), trailing minus = credits (payments)
    // We want expenses negative, payments positive
    const amount = lastAmountStr.endsWith('-') ? Math.abs(rawAmount) : -Math.abs(rawAmount);

    if (amount !== 0) {
      transactions.push({
        id: generateId(),
        date,
        description,
        rawDescription: description,
        amount,
        category: categorizeTransaction(description),
        source: 'scotiabank',
        account: accountName,
      });
    }
  }

  return transactions;
}

// ─── Main parse function ─────────────────────────────────────────────────────
export function parseScotiaPDF(
  text: string,
  accountName: string
): { transactions: Transaction[]; type: ScotiaType; count: number; errors: string[] } {
  const type = detectScotiaType(text);
  const errors: string[] = [];
  let transactions: Transaction[] = [];

  try {
    if (type === 'chequing') {
      transactions = parseChequing(text, accountName);
    } else {
      transactions = parseLOCVisa(text, accountName, type);
    }
  } catch (e) {
    errors.push(`PDF parsing error: ${e}`);
  }

  return { transactions, type, count: transactions.length, errors };
}
