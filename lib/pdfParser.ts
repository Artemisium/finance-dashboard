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
// PDF text extraction produces multi-line blocks per transaction:
//   003                   ← 3-digit ref#
//   Apr 1                 ← trans date
//   Apr 1                 ← post date
//   MB - CASH ADVANCE     ← description (may span multiple lines)
//   TO - *****02*36 27
//   2,000.00              ← CAD amount (trailing minus = credit, e.g. 1,170.57-)
//
// Foreign currency entries have extra lines:
//   SEVEN-ELEVEN TOKYO AMT           172.00 YEN
//   1.56                  ← CAD amount on next line

function parseLOCVisa(text: string, accountName: string, type: ScotiaType): Transaction[] {
  const lines = text.split('\n');
  const year = extractStatementYear(text);
  const transactions: Transaction[] = [];

  const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i;
  const refRegex = /^\d{3}$/;
  const amountRegex = /^[\d,]+\.\d{2}-?$/;
  const skipRegex = /^(SUB-TOTAL|INTEREST CHARGES|Page|Statement|Account|REF|TRANS|POST|DETAILS|AMOUNT|Transactions|Continued|MR |ScotiaLine|Scotiabank|SBVREP|Scene|Based on|Beginning|Points|Ending|Your |For more|If you|Payment|Total|Current|Previous|Interest|Credit|New balance|Overdue|Protect|Please|ACCOUNT|You can|Borrowers|through|TTY|We have|1-|416-|www\.|https:|Review|Other|Agreements|We reserve|earned|\*\*Your|I[Ss]cene|This statement|Annual|On July|estimate|0[0-9]{2}\s)/i;
  const sectionEndRegex = /^(Interest charges posted|SBVREP|Estimate of)/i;

  // First pass: split into transaction blocks anchored by ref numbers
  interface TxBlock {
    refNum: string;
    lines: string[];
  }
  const blocks: TxBlock[] = [];
  let currentBlock: TxBlock | null = null;
  let inTransactionSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect start of transaction section
    if (line.includes('Transactions since') || line.includes('Transactions - continued')) {
      inTransactionSection = true;
      continue;
    }

    // End of transaction section
    if (inTransactionSection && sectionEndRegex.test(line)) {
      if (currentBlock && currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      inTransactionSection = false;
      continue;
    }

    if (!inTransactionSection) continue;

    // New transaction block starts with a 3-digit ref number
    if (refRegex.test(line)) {
      if (currentBlock && currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = { refNum: line, lines: [] };
      continue;
    }

    // Accumulate lines into current block
    if (currentBlock) {
      // Skip noise lines
      if (skipRegex.test(line)) continue;
      // Skip dollar-prefixed subtotal values (e.g. "$0.00", "$176.52")
      if (line.startsWith('$')) continue;
      currentBlock.lines.push(line);
    }
  }
  // Push last block
  if (currentBlock && currentBlock.lines.length > 0) {
    blocks.push(currentBlock);
  }

  // Second pass: parse each block into a transaction
  for (const block of blocks) {
    const bLines = block.lines;
    if (bLines.length < 3) continue; // need at least: transDate, postDate, amount

    // Extract dates (first two date-like lines)
    let transDate = '';
    let dateCount = 0;
    let descStartIdx = 0;

    for (let i = 0; i < Math.min(bLines.length, 4); i++) {
      const dm = bLines[i].match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i);
      if (dm) {
        dateCount++;
        if (dateCount === 1) {
          transDate = resolveDate(dm[1], dm[2], year);
        }
        descStartIdx = i + 1;
        if (dateCount >= 2) break;
      } else if (dateCount === 0) {
        // Sometimes date is on same line as something else, try partial match
        const partialDm = bLines[i].match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})/i);
        if (partialDm) {
          dateCount++;
          if (dateCount === 1) {
            transDate = resolveDate(partialDm[1], partialDm[2], year);
          }
          descStartIdx = i + 1;
        }
      }
    }

    if (!transDate) continue;

    // Everything between dates and the last amount is description
    // The CAD amount is always the last numeric line (format: digits.dd or digits.dd-)
    let amountStr = '';
    let amountIdx = -1;

    // Find the last amount-like line in the block
    for (let i = bLines.length - 1; i >= descStartIdx; i--) {
      if (amountRegex.test(bLines[i].trim())) {
        amountStr = bLines[i].trim();
        amountIdx = i;
        break;
      }
    }

    if (!amountStr || amountIdx < 0) continue;

    // Description is everything between dates and the amount line
    const descLines: string[] = [];
    for (let i = descStartIdx; i < amountIdx; i++) {
      const dl = bLines[i].trim();
      // Skip pure amount lines that are foreign currency amounts
      if (amountRegex.test(dl)) continue;
      descLines.push(dl);
    }

    let description = descLines.join(' ').trim();

    // Clean up foreign currency info
    description = description.replace(/AMT\s*[\d,. ]+\s*(?:YEN|USD|EUR|GBP|MXN|AUD|UNIT\s*ED\s*STATES\s*DOL\s*LAR)\s*/gi, '').trim();
    description = description.replace(/\(SAMSUNG PAY\)/gi, '').trim();
    description = description.replace(/\s+/g, ' ').trim();

    // Skip interest charges, subtotals, fees, and empty-description fallback entries
    if (/^(INTEREST CHARGES|SUB-TOTAL|TOTAL CREDITS|TOTAL DEBITS|FOREIGN CASH ADVANCE FEE)/i.test(description)) continue;
    if (!description || description.startsWith('Transaction ')) continue;

    const rawAmount = cleanAmount(amountStr);

    // LOC/Visa: positive amounts = charges (expenses), trailing minus = credits (payments)
    // We want expenses negative, payments positive
    const amount = amountStr.endsWith('-') ? Math.abs(rawAmount) : -Math.abs(rawAmount);

    if (amount !== 0) {
      transactions.push({
        id: generateId(),
        date: transDate,
        description: description || `Transaction ${block.refNum}`,
        rawDescription: description || `Transaction ${block.refNum}`,
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
