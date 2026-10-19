import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Qurilish Qalqoni', template: '%s · Qurilish Qalqoni' },
  description: "Sun'iy intellekt yordamida qurilish obyektlarida xavfsizlik nazorati",
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { themeColor: '#14161A', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="font-sans">{children}</body>
    </html>
  );
}
