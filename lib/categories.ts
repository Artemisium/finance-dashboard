export const CATEGORIES = [
  'Groceries',
  'Dining & Restaurants',
  'Coffee & Cafes',
  'Transportation',
  'Gas & Fuel',
  'Parking',
  'Travel & Flights',
  'Hotels & Accommodation',
  'Shopping & Retail',
  'Clothing & Apparel',
  'Electronics',
  'Health & Medical',
  'Pharmacy',
  'Fitness & Gym',
  'Entertainment',
  'Streaming Services',
  'Subscriptions',
  'Utilities',
  'Internet & Phone',
  'Insurance',
  'Housing & Rent',
  'Home & Garden',
  'Personal Care',
  'Education',
  'Investments',
  'Transfers',
  'Income',
  'ATM & Cash',
  'Fees & Charges',
  'Government & Taxes',
  'Charity & Donations',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

// Keyword → category mapping for auto-categorization
const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  {
    keywords: ['loblaws', 'metro', 'sobeys', 'no frills', 'food basics', 'superstore', 'freshco', 'walmart', 'costco', 'aldi', 'whole foods', 'grocery', 'groceries', 'farm boy', 'longos'],
    category: 'Groceries',
  },
  {
    keywords: ['tim hortons', 'tims', 'starbucks', 'second cup', 'coffee', 'cafe', 'espresso', 'blenz'],
    category: 'Coffee & Cafes',
  },
  {
    keywords: ['uber eats', 'doordash', 'skip the dishes', 'mcdonalds', 'kfc', 'subway', 'pizza', 'sushi', 'restaurant', 'dining', 'pho', 'burger', 'wendy', 'harveys', 'popeyes', 'chipotle', 'boston pizza'],
    category: 'Dining & Restaurants',
  },
  {
    keywords: ['presto', 'ttc', 'transit', 'go train', 'via rail', 'uber', 'lyft', 'taxi', 'parking meter', 'impark', 'greenp'],
    category: 'Transportation',
  },
  {
    keywords: ['petro', 'esso', 'shell', 'sunoco', 'husky', 'gas station', 'fuel'],
    category: 'Gas & Fuel',
  },
  {
    keywords: ['parking', 'park plus'],
    category: 'Parking',
  },
  {
    keywords: ['air canada', 'westjet', 'porter', 'flight', 'expedia', 'booking.com', 'airbnb', 'vrbo'],
    category: 'Travel & Flights',
  },
  {
    keywords: ['marriott', 'hilton', 'sheraton', 'hyatt', 'holiday inn', 'hotel', 'motel', 'inn'],
    category: 'Hotels & Accommodation',
  },
  {
    keywords: ['amazon', 'bestbuy', 'best buy', 'the bay', 'hbc', 'winners', 'marshalls', 'homesense', 'dollarama', 'ikea', 'staples'],
    category: 'Shopping & Retail',
  },
  {
    keywords: ['h&m', 'zara', 'gap', 'uniqlo', 'roots', 'lululemon', 'aritzia', 'nike', 'adidas', 'sport chek', 'clothing', 'apparel'],
    category: 'Clothing & Apparel',
  },
  {
    keywords: ['apple', 'microsoft', 'bestbuy electronics', 'canada computers', 'newegg', 'electronics'],
    category: 'Electronics',
  },
  {
    keywords: ['clinic', 'doctor', 'hospital', 'medical', 'dental', 'vision', 'optometrist', 'ohip'],
    category: 'Health & Medical',
  },
  {
    keywords: ['shoppers', 'rexall', 'pharmasave', 'pharmacy', 'prescription', 'drug'],
    category: 'Pharmacy',
  },
  {
    keywords: ['goodlife', 'ymca', 'equinox', 'anytime fitness', 'gym', 'fitness', 'sport', 'yoga', 'crossfit', 'planet fitness'],
    category: 'Fitness & Gym',
  },
  {
    keywords: ['netflix', 'spotify', 'disney', 'prime video', 'hulu', 'crave', 'tidal', 'apple tv', 'youtube premium', 'streaming'],
    category: 'Streaming Services',
  },
  {
    keywords: ['subscription', 'monthly fee', 'annual fee', 'membership'],
    category: 'Subscriptions',
  },
  {
    keywords: ['hydro', 'enbridge', 'gas', 'electric', 'water', 'utilities', 'toronto hydro', 'ontario hydro'],
    category: 'Utilities',
  },
  {
    keywords: ['rogers', 'bell', 'telus', 'fido', 'koodo', 'public mobile', 'internet', 'phone', 'mobile', 'wireless', 'cable'],
    category: 'Internet & Phone',
  },
  {
    keywords: ['insurance', 'intact', 'aviva', 'td insurance', 'manulife', 'sunlife', 'great-west', 'desjardins insurance'],
    category: 'Insurance',
  },
  {
    keywords: ['rent', 'lease', 'mortgage', 'property management', 'landlord'],
    category: 'Housing & Rent',
  },
  {
    keywords: ['home depot', 'rona', 'canadian tire', 'hardware', 'home & garden', 'plumbing', 'renovation'],
    category: 'Home & Garden',
  },
  {
    keywords: ['spa', 'salon', 'barber', 'haircut', 'beauty', 'massage', 'sephora', 'lush', 'personal care'],
    category: 'Personal Care',
  },
  {
    keywords: ['tuition', 'school', 'university', 'college', 'course', 'udemy', 'coursera', 'textbook', 'education'],
    category: 'Education',
  },
  {
    keywords: ['wealthsimple', 'questrade', 'invest', 'etf', 'stock', 'mutual fund', 'rrsp', 'tfsa', 'fhsa'],
    category: 'Investments',
  },
  {
    keywords: ['transfer', 'e-transfer', 'interac', 'send money', 'wire', 'zelle', 'paypal transfer'],
    category: 'Transfers',
  },
  {
    keywords: ['payroll', 'salary', 'direct deposit', 'employment income', 'paycheque', 'paycheck'],
    category: 'Income',
  },
  {
    keywords: ['atm', 'cash withdrawal', 'withdrawal'],
    category: 'ATM & Cash',
  },
  {
    keywords: ['service fee', 'bank fee', 'nsf', 'overdraft', 'interest charge', 'annual fee'],
    category: 'Fees & Charges',
  },
  {
    keywords: ['cra', 'revenue canada', 'tax', 'government', 'service canada', 'hst', 'gst'],
    category: 'Government & Taxes',
  },
  {
    keywords: ['charity', 'donate', 'donation', 'food bank', 'red cross', 'unicef'],
    category: 'Charity & Donations',
  },
];

export function categorizeTransaction(description: string): string {
  const lower = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'Other';
}

export const CATEGORY_COLORS: Record<string, string> = {
  'Groceries': '#4ecca3',
  'Dining & Restaurants': '#f5a623',
  'Coffee & Cafes': '#c084fc',
  'Transportation': '#60a5fa',
  'Gas & Fuel': '#fbbf24',
  'Parking': '#94a3b8',
  'Travel & Flights': '#34d399',
  'Hotels & Accommodation': '#6ee7b7',
  'Shopping & Retail': '#f87171',
  'Clothing & Apparel': '#fb7185',
  'Electronics': '#818cf8',
  'Health & Medical': '#4ade80',
  'Pharmacy': '#86efac',
  'Fitness & Gym': '#2dd4bf',
  'Entertainment': '#a78bfa',
  'Streaming Services': '#c084fc',
  'Subscriptions': '#e879f9',
  'Utilities': '#fb923c',
  'Internet & Phone': '#38bdf8',
  'Insurance': '#64748b',
  'Housing & Rent': '#ef4444',
  'Home & Garden': '#84cc16',
  'Personal Care': '#f472b6',
  'Education': '#6366f1',
  'Investments': '#10b981',
  'Transfers': '#71717a',
  'Income': '#22c55e',
  'ATM & Cash': '#a3a3a3',
  'Fees & Charges': '#dc2626',
  'Government & Taxes': '#9ca3af',
  'Charity & Donations': '#fde047',
  'Other': '#6b7280',
};
