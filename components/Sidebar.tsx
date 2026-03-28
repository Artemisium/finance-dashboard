'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingDown,
  RefreshCw,
  Target,
  BarChart3,
  Briefcase,
  Upload,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/spending', label: 'Spending', icon: TrendingDown },
  { href: '/recurring', label: 'Recurring', icon: RefreshCw },
  { href: '/budget', label: 'Budget', icon: Target },
  { href: '/assets', label: 'Assets', icon: BarChart3 },
  { href: '/income', label: 'Income & Tax', icon: Briefcase },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-bg-secondary border-r border-border flex flex-col z-50">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent-teal/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-accent-teal fill-current">
              <path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-text-primary font-semibold text-sm tracking-wide">FinanceOS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-accent-teal/10 text-accent-teal'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Upload button */}
      <div className="px-3 pb-4 border-t border-border pt-4">
        <Link
          href="/upload"
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full',
            pathname === '/upload'
              ? 'bg-accent-teal/10 text-accent-teal'
              : 'text-text-secondary hover:text-accent-teal hover:bg-accent-teal/10'
          )}
        >
          <Upload className="w-4 h-4 flex-shrink-0" />
          Import Data
        </Link>
      </div>
    </aside>
  );
}
