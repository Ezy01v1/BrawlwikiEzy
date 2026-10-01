import type { Metadata, Viewport } from 'next';
import { Inter, Lilita_One } from 'next/font/google';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { HydrationFlag } from '@/components/layout/HydrationFlag';
import { NavLinks } from '@/components/layout/NavLinks';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import './globals.css';

const lilita = Lilita_One({ weight: '400', subsets: ['latin'], variable: '--font-lilita', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'BrawlWiki', template: '%s · BrawlWiki' },
  description: 'Stats de jugadores, clubes y rankings de Brawl Stars. Fan page no oficial.',
};

export const viewport: Viewport = { themeColor: '#0b0b0f', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="es" data-theme={theme} className={`${lilita.variable} ${inter.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-chip focus:bg-primary-fill focus:px-3 focus:py-2 focus:text-on-primary"
        >
          Saltar al contenido
        </a>
        <Header theme={theme} />
        <main id="contenido" className="mx-auto w-full max-w-5xl px-4 md:px-6">
          {children}
        </main>
        <Footer />
        <NavLinks variant="bottom" />
        <HydrationFlag />
      </body>
    </html>
  );
}
