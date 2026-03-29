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
        const firstAmt = cleanAmount(amounts[0] ?? '');
        const secondAmt = amounts.length >= 2 ? cleanAmount(amounts[1] ?? '') : 0;

        // Determine if the first amount is in withdrawn or deposited column
        // by checking position in the original line
        const firstAmtStr = amounts[0] ?? '';
        const firstAmtIdx = rest.indexOf(firstAmtStr);
        const restLen = rest.length;

        // Rough column detection: withdrawn is ~middle, deposited is ~right-of-middle
        // If there are 3 amounts: withdrawn, deposited, balance
        // If there are 2 amounts: one of (withdrawn|deposited) + balance
        if (amounts.length >= 3) {
          // withdrawn, deposited, balance
          amount = cleanAmount(amounts[1] ?? '') - cleanAmount(amounts[0] ?? '');
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
// pdf.js (browser) produces single-line format:
//   003 Apr 1Apr 1MB - CASH ADVANCETO - *****02*36 27 2,000.00
//   027 Mar 12Mar 12MB-CREDIT CARD/LOC PAY.FROM -   1,170.57-
//   002 Mar 2Mar 5SEVEN-ELEVEN TOKYO AMT172.00 YEN   1.56
// Some entries have continuation lines for wrapped descriptions.

function parseLOCVisa(text: string, accountName: string, type: ScotiaType): Transaction[] {
  const lines = text.split('\n');
  const year = extractStatementYear(text);
  const transactions: Transaction[] = [];

  // Regex to match a transaction start line:
  // 3-digit ref# + space + transDate(Mon DD) + postDate(Mon DD, no space before it) + rest
  const MON = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
  const txStartRegex = new RegExp(
    `^(\\d{3})\\s+(${MON})\\s+(\\d{1,2})(${MON})\\s+(\\d{1,2})(.+)$`, 'i'
  );
  // Match the last decimal amount on the line, possibly followed by trailing junk digits (page codes)
  const amountOnLineRegex = /([\d,]+\.\d{2}-?)\s*(?:\d{5,}.*)?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const match = line.match(txStartRegex);
    if (!match) continue;

    const transMonth = match[2];
    const transDay = match[3];
    const rest = match[6].trim(); // everything after post date

    const date = resolveDate(transMonth, transDay, year);
    if (!date) continue;

    // Extract the CAD amount from the FIRST line only (before joining continuations)
    // The CAD amount is always the last decimal number on the transaction start line
    const amountMatch = rest.match(amountOnLineRegex);
    if (!amountMatch) continue;

    const amountStr = amountMatch[1];
    const rawAmount = cleanAmount(amountStr);

    // Description is everything before the amount on the first line
    const amountPos = rest.lastIndexOf(amountStr);
    let description = rest.substring(0, amountPos).trim();

    // Skip to next transaction line (consume continuations but don't need them for description)
    let j = i + 1;
    while (j < lines.length) {
      const nextLine = lines[j].trim();
      if (!nextLine) { j++; continue; }
      if (nextLine.match(txStartRegex)) break;
      if (/^(SUB-TOTAL|INTEREST|Page|Statement|Account|REF|TRANS|POST|DETAILS|AMOUNT|Transactions|Continued|MR |Scotiabank|ScotiaLine|SBVREP|Scene|Based on|Beginning|Points|Ending|If you|Payment|Total|Current|Previous|Credit|New balance|Overdue|Please|ACCOUNT|TTY|We have|1-|416-|www\.|https:|Review|Annual|On July|This statement|Protect|Borrowers|HRI|estimate|\d{5,}$)/i.test(nextLine)) break;
      if (nextLine.startsWith('$')) break;
      j++;
    }

    // Clean up foreign currency info and noise from description
    description = description.replace(/AMT\s*[\d,. ]+\s*(?:YEN|USD|EUR|GBP|MXN|AUD|UNIT\s*ED\s*STATES\s*DOL\s*LAR)\s*/gi, '').trim();
    description = description.replace(/AMT\s*$/i, '').trim(); // trailing AMT with no currency (split across lines)
    description = description.replace(/\(SAMSUNG\s*(?:PAY)?\)?/gi, '').trim();
    description = description.replace(/FROM\s*-\s*$/, 'FROM').trim();
    description = description.replace(/\s+/g, ' ').trim();

    // Skip interest charges, subtotals, fees
    if (/^(INTEREST CHARGES|SUB-TOTAL|TOTAL CREDITS|TOTAL DEBITS|FOREIGN CASH ADVANCE FEE)/i.test(description)) continue;
    if (!description) continue;

    // LOC/Visa: positive amounts = charges (expenses), trailing minus = credits (payments)
    // We want expenses negative, payments positive
    const amount = amountStr.endsWith('-') ? Math.abs(rawAmount) : -Math.abs(rawAmount);

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

    // Skip continuation lines we already consumed
    i = j - 1;
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
