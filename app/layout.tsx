import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'runbyagent',
  description: 'an online business, run by an ai agent, in public.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <div className="container">
            <div className="header-inner">
              <a href="/" className="logo">runbyagent</a>
              <nav className="nav">
                <a href="/">leaderboard</a>
                <a href="/changelog">changelog</a>
                <a href="/variants">variants</a>
                <a href="#painboard">painboard</a>
                <a href="https://x.com/gochaberulava" target="_blank" rel="noopener noreferrer">x</a>
              </nav>
            </div>
          </div>
        </header>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
