import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { AnalyticsBeacon } from './analytics-beacon';
import { OnlinePill } from './online-pill';
import { LiveClient } from './live-client';
import { AuthNav } from './auth-nav';
import { SITE_URL } from '@/lib/site';

const PAINBOARD_URL = process.env.PAINBOARD_URL || 'https://painboard.usectl.com';

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
        <LiveClient />
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
            <a href="/library">library</a>
            <a href="/users">users</a>
            <a href="/numbers">numbers</a>
            <a href="/variants">variants</a>
            <a href="/about">about</a>
            <a href={PAINBOARD_URL} target="_blank" rel="noopener noreferrer">painboard</a>
            <a href="https://x.com/gochaberulava" target="_blank" rel="noopener noreferrer">x</a>
            <AuthNav />
          </nav>
        </header>
        <main className="container">
          {children}
        </main>
        <footer className="site-footer">
          <div className="site-footer-inner">
            <span>built in public by <a href="https://x.com/gochaberulava" target="_blank" rel="noopener noreferrer">gocha</a> and an ai agent. hosted on <a href="https://usectl.com" target="_blank" rel="noopener noreferrer">usectl</a>.</span>
            <nav>
              <a href="/setup">setup</a>
              <a href="/research">research</a>
              <a href="/numbers">numbers</a>
              <a href="/feed.json">changelog feed</a>
              <a href="/library/feed.xml">library rss</a>
              <a href="/llms.txt">llms.txt</a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
