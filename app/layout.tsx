import type { Metadata } from 'next';
import Script from 'next/script';
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

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-BG0STH000M';
const isProduction = process.env.NODE_ENV === 'production';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AnalyticsBeacon />
        {isProduction && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}', {
                  anonymize_ip: true,
                  send_page_view: true
                });
              `}
            </Script>
          </>
        )}
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
