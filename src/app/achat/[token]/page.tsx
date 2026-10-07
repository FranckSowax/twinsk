import type { Metadata, Viewport } from 'next';
import { COUNTRY } from '@/config/countries';
import { clientBundle } from '@/lib/achats/auth';
import AchatClient from '@/components/achats/AchatClient';
import ThemeSwitch from '@/components/projects/ThemeSwitch';
import { THEME_COLORS, themeBootScript } from '@/lib/projects/theme';

// Achats sur place — espace du client, ouvert par lien à jeton : il compose sa
// liste, puis, sur place, coche, chiffre, note et photographie ses achats.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: `Mes achats — ${COUNTRY.senderName}`, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: THEME_COLORS.light }, { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark }] };

export default async function AchatPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await clientBundle(token);
  return (
    <main data-theme-root className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <p className="min-w-0 truncate font-display text-base font-bold text-slate-900 dark:text-white sm:text-lg">{COUNTRY.senderName} <span className="text-xs font-normal text-slate-500 sm:text-sm">· mes achats sur place</span></p>
          <div className="flex shrink-0 items-center gap-2">
            {b && <p className="max-w-[9rem] truncate text-xs text-slate-500 sm:max-w-none">{b.trip.client_name}</p>}
            <ThemeSwitch />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-3 py-3 pb-28 sm:p-4 sm:pb-28">
        {b ? <AchatClient token={token} /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">Ce lien n’est plus valide. Demandez un nouveau lien à votre interlocuteur {COUNTRY.senderName}.</div>}
      </div>
    </main>
  );
}
