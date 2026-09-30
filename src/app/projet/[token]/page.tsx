import type { Metadata } from 'next';
import { COUNTRY } from '@/config/countries';
import { clientActor } from '@/lib/projects/auth';
import ClientProject from './ClientProject';

// Espace client d'un projet, ouvert par lien à jeton (une personne = un lien).
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: `Suivi de projet — ${COUNTRY.senderName}`, robots: { index: false, follow: false } };

export default async function ProjectClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = await clientActor(token);
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <p className="font-display text-lg font-bold text-slate-900 dark:text-white">{COUNTRY.senderName} <span className="text-sm font-normal text-slate-500">· suivi de projet</span></p>
          {c && <p className="text-xs text-slate-500">{c.actor.name}</p>}
        </div>
      </header>
      <div className="mx-auto max-w-6xl p-4">
        {c ? (
          <ClientProject token={token} viewerName={c.actor.name} />
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm text-amber-800">Ce lien n’est plus valide. Demandez un nouveau lien à votre interlocuteur {COUNTRY.senderName}.</div>
        )}
      </div>
    </main>
  );
}
