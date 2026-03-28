import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import MountainBackground from '@/components/MountainBackground';

export const metadata: Metadata = {
  title: 'FinanceOS',
  description: 'Personal financial planning dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary min-h-screen">
        <MountainBackground />
        <Sidebar />
        <main className="ml-56 min-h-screen relative z-10">
          <div className="p-8 max-w-7xl">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
