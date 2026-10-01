'use client';

// Surface de travail d'un projet, partagée : l'équipe (/admin/projets/[id])
// et le client (/projet/<jeton>) voient les mêmes onglets, avec des droits
// et des données différents (le client ne reçoit que la projection filtrée).

import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Building2, ClipboardList, FileCheck2, FileText, Factory, FolderOpen, HelpCircle, KeyRound, Loader2, Mail, MoreHorizontal, Newspaper, Package, Scale, X } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import type { Attachment } from '@/lib/projects/types';
import PlanTab from './PlanTab';
import { DocumentsTab, JournalTab, QuestionsTab } from './JournalQuestionsDocs';
import { OrdersTab, QuoteTab } from './QuoteOrdersTab';
import { AccessTab, ReportTab, SuppliersTab } from './TeamTabs';
import { RfqTab } from './RfqTab';
import { FactoryCards } from './FactoryCards';
import { CoverVideo } from './CoverVideo';
import { ComparisonTab } from './Comparison';
import { Badge, type Mode, type WorkspaceApi } from './shared';

type Tab = 'plan' | 'journal' | 'questions' | 'documents' | 'quote' | 'compare' | 'orders' | 'factories' | 'suppliers' | 'rfq' | 'report' | 'access';
const TABS: Tab[] = ['plan', 'journal', 'questions', 'documents', 'quote', 'compare', 'orders', 'factories', 'suppliers', 'rfq', 'report', 'access'];
const ICONS: Record<Tab, ComponentType<{ className?: string }>> = { plan: ClipboardList, journal: Newspaper, questions: HelpCircle, documents: FolderOpen, quote: FileText, compare: Scale, orders: Package, factories: Factory, suppliers: Building2, rfq: Mail, report: FileCheck2, access: KeyRound };
// Barre du bas sur mobile : les onglets les plus utilisés, le reste sous « Plus ».
const MOBILE_MAIN: Record<Mode, Tab[]> = { client: ['plan', 'journal', 'quote', 'questions'], team: ['plan', 'journal', 'quote', 'suppliers'] };
const tabFromHash = (): Tab | null => {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.slice(1) as Tab;
  return TABS.includes(h) ? h : null;
};

export default function ProjectWorkspace({ mode, loadUrl, actionUrl, uploadUrl, pdfUrl, aiUrl, viewerName }: { mode: Mode; loadUrl: string; actionUrl: string; uploadUrl: string; pdfUrl?: string; aiUrl?: string; viewerName: string }) {
  const [data, setData] = useState<(PublicProject & { admin?: TeamExtras }) | null>(null);
  const [error, setError] = useState('');
  const [tab, setTabState] = useState<Tab>('plan');
  const [more, setMore] = useState(false);
  // Onglet dans l'adresse (#devis…) : retour arrière, rechargement et lien partagé gardent la position.
  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    setMore(false);
    if (typeof window !== 'undefined' && window.location.hash.slice(1) !== t) window.history.pushState(null, '', `#${t}`);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  useEffect(() => {
    const sync = () => {
      const h = tabFromHash();
      if (h) setTabState(h);
    };
    const first = setTimeout(sync, 0);
    window.addEventListener('popstate', sync);
    return () => {
      clearTimeout(first);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const reload = useCallback(async () => {
    const r = await fetch(loadUrl, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error || 'Chargement impossible');
      return;
    }
    setError('');
    setData(d.project);
  }, [loadUrl]);
  useEffect(() => {
    // Différé : la règle react-hooks refuse un setState synchrone dans l'effet.
    const first = setTimeout(reload, 0);
    const t = setInterval(reload, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [reload]);

  const api: WorkspaceApi = {
    mode,
    viewerName,
    baseUrl: loadUrl,
    reload,
    act: async (action, payload = {}) => {
      const r = await fetch(actionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Action impossible');
      await reload();
      return d;
    },
    ai: async (action, payload = {}) => {
      if (!aiUrl) throw new Error('Assistant indisponible');
      const r = await fetch(aiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Assistant indisponible');
      return d;
    },
    upload: async (files, opts = {}) => {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('category', opts.category || 'misc');
      if (opts.internal) fd.append('internal', '1');
      const r = await fetch(uploadUrl, { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Envoi impossible');
      await reload();
      return d.documents as { id: string; attachment: Attachment }[];
    },
  };

  if (error) return <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>;
  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-500" /></div>;

  // Questions qui attendent la personne qui regarde : le client répond à celles de l'équipe, l'équipe à celles du client.
  const openQuestions = data.questions.filter((q) => q.status === 'open' && (mode === 'client' ? q.direction === 'to_client' : q.direction !== 'to_client')).length;
  const toValidate = data.quote.lines.filter((l) => l.status === 'draft' && l.unit_price != null && !(l.optional && !l.enabled) && !l.locked).length;
  const tabs: { key: Tab; label: string; badge?: number; team?: boolean; client?: boolean }[] = [
    { key: 'plan', label: 'Plan d’action' },
    { key: 'journal', label: 'Journal', badge: data.updates.length },
    { key: 'questions', label: 'Questions', badge: openQuestions },
    { key: 'documents', label: 'Documents', badge: data.documents.length },
    { key: 'quote', label: 'Devis', badge: toValidate },
    { key: 'compare', label: 'Comparaison', badge: mode === 'client' ? data.offers.length : data.admin?.offers.filter((o) => o.status === 'active' && o.client_interested_at).length },
    { key: 'orders', label: 'Commandes', badge: data.orders.length },
    { key: 'factories', label: 'Usines', client: true, badge: data.suppliers.length },
    { key: 'report', label: 'Rapport & voyage' },
    { key: 'suppliers', label: 'Usines & échanges', team: true, badge: data.admin?.suppliers.length },
    { key: 'rfq', label: 'Messages usines', team: true, badge: data.admin?.rfq.length },
    { key: 'access', label: 'Accès client', team: true, badge: data.admin?.shares.filter((s) => !s.revoked_at).length },
  ];

  const visible = tabs.filter((t) => (!t.team || mode === 'team') && (!t.client || mode === 'client'));
  const main = visible.filter((t) => MOBILE_MAIN[mode].includes(t.key));
  const rest = visible.filter((t) => !MOBILE_MAIN[mode].includes(t.key));
  const restBadge = rest.reduce((n, t) => n + (t.key === 'questions' ? t.badge || 0 : 0), 0);
  const current = visible.find((t) => t.key === tab);
  const badgeCls = (k: Tab) => (k === 'questions' || k === 'quote' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-700');

  return (
    <div className="space-y-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div>
        <h1 className="font-display text-xl font-bold leading-tight text-slate-900 dark:text-white sm:text-2xl">{data.title}</h1>
        {/* Vidéo de couverture : onglet Plan d'action seulement, entre le titre et le statut */}
        {tab === 'plan' && (data.cover_video || mode === 'team') && <div className="mt-3"><CoverVideo cover={data.cover_video} baseUrl={loadUrl} api={api} /></div>}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {data.status === 'closed' ? <Badge>Clôturé</Badge> : <Badge tone="emerald">En cours</Badge>}
          <span>{Math.round(data.progress.global * 100)} % réalisé</span>
          <span>· devise {data.currency}</span>
          {mode === 'client' && <span className="hidden sm:inline">· Bonjour {viewerName}</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(data.progress.global * 100)}%` }} /></div>
      </div>
      <details className="group rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        <summary className="cursor-pointer list-none marker:hidden"><span className="line-clamp-1 group-open:line-clamp-none">{data.disclaimer}</span></summary>
      </details>

      {/* Onglets : barre défilante en haut sur tablette et ordinateur */}
      <div className="hidden gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60 sm:flex [scrollbar-width:none]">
        {visible.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
            {!!t.badge && <span className={`rounded-full px-1.5 text-[10px] ${badgeCls(t.key)}`}>{t.badge}</span>}
          </button>
        ))}
      </div>
      {/* Mobile : titre de l'onglet courant */}
      <p className="font-display text-lg font-bold text-slate-900 dark:text-white sm:hidden">{current?.label}</p>

      {tab === 'plan' && <PlanTab p={data} api={api} />}
      {tab === 'journal' && <JournalTab p={data} api={api} />}
      {tab === 'questions' && <QuestionsTab p={data} api={api} admin={data.admin} />}
      {tab === 'documents' && <DocumentsTab p={data} api={api} internalIds={data.admin?.documents_internal} />}
      {tab === 'quote' && <QuoteTab p={data} api={api} admin={data.admin} pdfUrl={pdfUrl} />}
      {tab === 'compare' && <ComparisonTab p={data} api={api} admin={data.admin} />}
      {tab === 'orders' && <OrdersTab p={data} api={api} />}
      {tab === 'report' && <ReportTab p={data} api={api} />}
      {tab === 'factories' && <FactoryCards suppliers={data.suppliers} />}
      {tab === 'suppliers' && data.admin && <SuppliersTab p={data} admin={data.admin} api={api} />}
      {tab === 'rfq' && data.admin && <RfqTab admin={data.admin} api={api} />}
      {tab === 'access' && data.admin && <AccessTab admin={data.admin} api={api} />}

      {/* Mobile : barre d'onglets en bas, au pouce */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:hidden" aria-label="Sections du projet">
        <div className="grid grid-cols-5">
          {main.map((t) => {
            const Icon = ICONS[t.key];
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${tab === t.key ? 'text-emerald-600' : 'text-slate-500'}`} aria-current={tab === t.key ? 'page' : undefined}>
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate px-1">{t.label}</span>
                {!!t.badge && <span className={`absolute right-[22%] top-2 min-w-4 rounded-full px-1 text-[9px] leading-4 ${badgeCls(t.key)}`}>{t.badge}</span>}
              </button>
            );
          })}
          <button type="button" onClick={() => setMore(true)} className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${rest.some((t) => t.key === tab) ? 'text-emerald-600' : 'text-slate-500'}`}>
            <MoreHorizontal className="h-5 w-5" />
            <span>{rest.some((t) => t.key === tab) ? current?.label : 'Plus'}</span>
            {restBadge > 0 && <span className="absolute right-[22%] top-2 min-w-4 rounded-full bg-amber-500 px-1 text-[9px] leading-4 text-white">{restBadge}</span>}
          </button>
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-900/50 sm:hidden" onClick={() => setMore(false)}>
          <div className="w-full rounded-t-3xl bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">Autres sections</p>
              <button type="button" onClick={() => setMore(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {rest.map((t) => {
                const Icon = ICONS[t.key];
                return (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`relative flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold ${tab === t.key ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-200'}`}>
                    <Icon className="h-5 w-5" />
                    <span className="px-1 text-center leading-tight">{t.label}</span>
                    {!!t.badge && <span className={`absolute right-2 top-2 rounded-full px-1.5 text-[10px] ${badgeCls(t.key)}`}>{t.badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
