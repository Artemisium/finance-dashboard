# FinanceOS — Setup & Deployment

## Local Development

```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push this folder to a GitHub repo
2. Go to [vercel.com](https://vercel.com) → New Project → Import the repo
3. No environment variables needed — all data is stored in your browser's localStorage
4. Deploy — done

## Importing Your Data

Navigate to **Import Data** in the sidebar, then:

- **Scotiabank:** Online Banking → Accounts → Select account → Download Transactions → CSV → pick your date range
- **American Express:** amex.com → Statements & Activity → Download → CSV
- **Wealthsimple:** App/Web → Account → Activity → Export → CSV

Drop the files into the upload page. The dashboard auto-detects the source institution from the CSV headers, but you can override it. Name each file with a recognizable account name (e.g. "Scotia Chequing", "Amex Platinum").

## Monthly Update Workflow

Once a month (when your latest statement is ready):
1. Export fresh CSVs from each institution
2. Go to Import Data and upload them
3. The dashboard deduplicates automatically — no double-counting

## Pages

| Page | What it shows |
|------|---------------|
| Overview | Net worth, monthly cash flow, top categories, recent transactions |
| Spending | Category breakdown, trends, year-over-year comparison, transaction list |
| Recurring | Fixed monthly costs — manage subscriptions, rent, insurance |
| Budget | Set monthly limits per category, track actuals vs. budget |
| Assets | All accounts, allocation pie chart, Wealthsimple activity |
| Income & Tax | Paycheque logging, Ontario tax estimator, RRSP/TFSA tracking |
| Import Data | Upload CSV files from Scotiabank, Amex, Wealthsimple |

## Notes

- All data is stored **locally in your browser** (localStorage). No data is sent anywhere.
- Tax estimator is a simplified estimate for Ontario residents — not a substitute for professional tax advice.
- To clear all data: browser DevTools → Application → localStorage → delete `finance_dashboard_v1`
