'use client';

// Espace agents du pays : deux rubriques, Messagerie (réponses aux clients
// WhatsApp, au nom de l'agent) et Commandes (payées ou au paiement engagé).
// Barre latérale en desktop, barre d'onglets en bas sur mobile. Les deux vues
// restent montées : on retrouve sa conversation ou son filtre en revenant.
// La rubrique courante est gardée dans l'URL (#messagerie / #commandes).

import { useCallback, useEffect, useState } from 'react';
import { LogOut, MessagesSquare, ShoppingBag } from 'lucide-react';
import InboxPage from '@/components/inbox/InboxPage';
import AgentOrders from './AgentOrders';
import { COUNTRY } from '@/config/countries';

type Agent = { id: string; name: string };
type View = 'messagerie' | 'commandes';

const NAV: { key: View; label: string; icon: typeof MessagesSquare }[] = [
  { key: 'messagerie', label: 'Messagerie', icon: MessagesSquare },
  { key: 'commandes', label: 'Commandes', icon: ShoppingBag },
];

function viewFromHash(): View {
  if (typeof window === 'undefined') return 'messagerie';
  return window.location.hash === '#commandes' ? 'commandes' : 'messagerie';
}

export default function AgentShell({ agent, onLogout }: { agent: Agent; onLogout: () => void }) {
  const [view, setView] = useState<View>('messagerie');
  const [inboxTodo, setInboxTodo] = useState(0);
  const [ordersTodo, setOrdersTodo] = useState(0);

  // Rubrique lue dans l'URL après le montage (pas au rendu serveur), suivie au retour arrière.
  useEffect(() => {
    const sync = () => setView(viewFromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const go = (v: View) => {
    setView(v);
    if (window.location.hash !== `#${v}`) window.history.replaceState(window.history.state, '', `#${v}`);
  };
  const onInboxCounts = useCallback((c: { todo: number }) => setInboxTodo(c.todo), []);
  const badge = (v: View) => (v === 'messagerie' ? inboxTodo : ordersTodo);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Barre latérale (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 flex-shrink-0 flex-col bg-slate-900 text-slate-300 lg:flex">
        <div className="px-5 py-6">
          <p className="font-display text-lg font-bold tracking-tight text-white">{COUNTRY.senderName}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">Agents {COUNTRY.name}</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = view === n.key;
            const count = badge(n.key);
            return (
              <button
                key={n.key}
                type="button"
                onClick={() => go(n.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-emerald-500/15 text-emerald-300' : 'hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{n.label}</span>
                {count > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${active ? 'bg-emerald-500 text-white' : n.key === 'messagerie' ? 'bg-red-500 text-white' : 'bg-white/10 text-slate-300'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-white">{agent.name.charAt(0).toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
              <p className="text-[11px] text-slate-400">Agent</p>
            </div>
            <button type="button" onClick={onLogout} title="Se déconnecter" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu (marge basse sur mobile pour la barre d'onglets) */}
      <div className="min-w-0 flex-1 pb-16 lg:pb-0">
        <div className={view === 'messagerie' ? '' : 'hidden'}>
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <div className="lg:hidden">
                <p className="font-display text-sm font-bold leading-tight text-slate-900">{COUNTRY.senderName}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-600">Agents</p>
              </div>
              <h1 className="font-display text-lg font-bold text-slate-900 max-lg:ml-auto max-lg:text-base">Messagerie</h1>
            </div>
          </header>
          <div className="px-3 py-3 sm:px-6 sm:py-4">
            <InboxPage as="agent" hideTitle onCounts={onInboxCounts} heightClass="h-[calc(100dvh-8.75rem)] lg:h-[calc(100dvh-5.5rem)]" />
          </div>
        </div>
        <div className={view === 'commandes' ? '' : 'hidden'}>
          <AgentOrders agent={agent} onLogout={onLogout} onTodoCount={setOrdersTodo} />
        </div>
      </div>

      {/* Barre d'onglets (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map((n) => {
          const Icon = n.icon;
          const active = view === n.key;
          const count = badge(n.key);
          return (
            <button key={n.key} type="button" onClick={() => go(n.key)} className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${active ? 'text-emerald-600' : 'text-slate-500'}`}>
              <span className="relative">
                <Icon className="h-5 w-5" />
                {count > 0 && (
                  <span className={`absolute -right-3 -top-1.5 rounded-full px-1.5 text-[10px] font-bold text-white ${n.key === 'messagerie' ? 'bg-red-500' : 'bg-slate-700'}`}>{count}</span>
                )}
              </span>
              {n.label}
            </button>
          );
        })}
        <button type="button" onClick={onLogout} className="flex w-16 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold text-slate-400">
          <LogOut className="h-5 w-5" />
          Sortir
        </button>
      </nav>
    </div>
  );
}
