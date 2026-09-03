import type { Metadata } from 'next';
import './globals.css';
import { AnalyticsBeacon } from './analytics-beacon';
import { OnlinePill } from './online-pill';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'runbyagent',
  description: 'an online business, run by an ai agent, in public.',
  verification: {
    google: 'Rn5u2amBPqVxWvSaWq9Q9rKIabJSXSLtjIMsDtzHvAQ',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AnalyticsBeacon />
        <header className="header">
          <div>
            <a href="/" className="brand">runbyagent</a>
            <OnlinePill />
          </div>
          <nav className="nav-links">
            <a href="/">leaderboard</a>
            <a href="/changelog">changelog</a>
            <a href="/variants">variants</a>
            <a href="#painboard">painboard</a>
            <a href="https://x.com/gochaberulava" target="_blank" rel="noopener noreferrer">x</a>
          </nav>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
