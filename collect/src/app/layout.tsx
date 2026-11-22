import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import Ornament from '@/components/Ornament';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1c1915',
  viewportFit: 'cover',
};

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  const description =
    'Aidez à entraîner KwèGbaTché. Quelques phrases en fon, en yoruba ou en français, depuis votre téléphone.';
  return {
    metadataBase: new URL(`${proto}://${host}`),
    title: 'KwèGbaTché, donner sa voix',
    description,
    applicationName: 'KwèGbaTché',
    openGraph: {
      title: 'KwèGbaTché, donner sa voix',
      description,
      locale: 'fr_FR',
      type: 'website',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'KwèGbaTché, collecte de voix' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'KwèGbaTché, donner sa voix',
      description,
    },
    robots: { index: false, follow: false },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a className="skip" href="#contenu">Aller au contenu</a>
        <Ornament />
        <div className="page">
          <header className="topbar">
            <div className="topbar-inner">
              <a className="brand" href="/">
                <span className="brand-mark" aria-hidden="true" />
                <span className="brand-text">
                  <span className="brand-name">KwèGbaTché</span>
                  <span className="brand-sub">Collecte de voix</span>
                </span>
              </a>
            </div>
          </header>
          <noscript>
            <p className="noscript">Activez JavaScript pour enregistrer votre voix.</p>
          </noscript>
          {children}
        </div>
      </body>
    </html>
  );
}
