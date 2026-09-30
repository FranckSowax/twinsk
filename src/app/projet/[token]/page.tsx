import type { Metadata, Viewport } from 'next';
import { COUNTRY } from '@/config/countries';
import { clientActor } from '@/lib/projects/auth';
import ClientProject from './ClientProject';
import ThemeSwitch from '@/components/projects/ThemeSwitch';
import { THEME_COLORS, themeBootScript } from '@/lib/projects/theme';

// Espace client d'un projet, ouvert par lien à jeton (une personne = un lien).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: `Suivi de projet — ${COUNTRY.senderName}`, robots: { index: false, follow: false } };
// Plein écran sur mobile (encoche, barre d'accueil) : les marges sont gérées par env(safe-area-inset-*).
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: THEME_COLORS.light }, { media: '(prefers-color-scheme: dark)', color: THEME_COLORS.dark }] };

export default async function ProjectClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await clientActor(token);
  return (
    // data-theme-root : conteneur du thème clair / sombre choisi (ThemeSwitch) ; le script l'applique avant l'affichage.
    <main data-theme-root className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 pb-2.5 pt-[calc(0.625rem+env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="min-w-0 truncate font-display text-base font-bold text-slate-900 dark:text-white sm:text-lg">{COUNTRY.senderName} <span className="text-xs font-normal text-slate-500 sm:text-sm">· suivi de projet</span></p>
          <div className="flex shrink-0 items-center gap-2">
            {c && <p className="max-w-[9rem] truncate text-xs text-slate-500 sm:max-w-none">{c.actor.name}</p>}
            <ThemeSwitch />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-3 py-3 sm:p-4">
        {c ? (
          <ClientProject token={token} viewerName={c.actor.name} />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">Ce lien n’est plus valide. Demandez un nouveau lien à votre interlocuteur {COUNTRY.senderName}.</div>
        )}
      </div>
    </main>
  );
}
