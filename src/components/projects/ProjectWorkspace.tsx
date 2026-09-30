'use client';

// Surface de travail d'un projet, partagée : l'équipe (/admin/projets/[id])
// et le client (/projet/<jeton>) voient les mêmes onglets, avec des droits
// et des données différents (le client ne reçoit que la projection filtrée).

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import type { Attachment } from '@/lib/projects/types';
import PlanTab from './PlanTab';
import { DocumentsTab, JournalTab, QuestionsTab } from './JournalQuestionsDocs';
import { OrdersTab, QuoteTab } from './QuoteOrdersTab';
import { AccessTab, ReportTab, SuppliersTab } from './TeamTabs';
import { Badge, type Mode, type WorkspaceApi } from './shared';

type Tab = 'plan' | 'journal' | 'questions' | 'documents' | 'quote' | 'orders' | 'suppliers' | 'report' | 'access';

export default function ProjectWorkspace({ mode, loadUrl, actionUrl, uploadUrl, viewerName }: { mode: Mode; loadUrl: string; actionUrl: string; uploadUrl: string; viewerName: string }) {
  const [data, setData] = useState<(PublicProject & { admin?: TeamExtras }) | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('plan');

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
    reload,
    act: async (action, payload = {}) => {
      const r = await fetch(actionUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...payload }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Action impossible');
      await reload();
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

  const openQuestions = data.questions.filter((q) => q.status === 'open').length;
  const toValidate = data.quote.lines.filter((l) => l.status === 'draft' && l.unit_price != null && !(l.optional && !l.enabled) && !l.locked).length;
  const tabs: { key: Tab; label: string; badge?: number; team?: boolean }[] = [
    { key: 'plan', label: 'Plan d’action' },
    { key: 'journal', label: 'Journal', badge: data.updates.length },
    { key: 'questions', label: 'Questions', badge: openQuestions },
    { key: 'documents', label: 'Documents', badge: data.documents.length },
    { key: 'quote', label: 'Devis', badge: toValidate },
    { key: 'orders', label: 'Commandes', badge: data.orders.length },
    { key: 'report', label: 'Rapport & voyage' },
    { key: 'suppliers', label: 'Usines & échanges', team: true, badge: data.admin?.exchanges.length },
    { key: 'access', label: 'Accès client', team: true, badge: data.admin?.shares.filter((s) => !s.revoked_at).length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{data.title}</h1>
          <p className="text-xs text-slate-500">
            {data.status === 'closed' ? <Badge>Clôturé</Badge> : <Badge tone="emerald">En cours</Badge>} · {Math.round(data.progress.global * 100)} % réalisé · devise {data.currency}
            {mode === 'client' && ` · Bonjour ${viewerName}`}
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900">{data.disclaimer}</div>
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-700/60 [scrollbar-width:none]">
        {tabs.filter((t) => !t.team || mode === 'team').map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${tab === t.key ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
            {!!t.badge && <span className={`rounded-full px-1.5 text-[10px] ${t.key === 'questions' || t.key === 'quote' ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-700'}`}>{t.badge}</span>}
          </button>
        ))}
      </div>
      {tab === 'plan' && <PlanTab p={data} api={api} />}
      {tab === 'journal' && <JournalTab p={data} api={api} />}
      {tab === 'questions' && <QuestionsTab p={data} api={api} />}
      {tab === 'documents' && <DocumentsTab p={data} api={api} internalIds={data.admin?.documents_internal} />}
      {tab === 'quote' && <QuoteTab p={data} api={api} admin={data.admin} />}
      {tab === 'orders' && <OrdersTab p={data} api={api} />}
      {tab === 'report' && <ReportTab p={data} api={api} />}
      {tab === 'suppliers' && data.admin && <SuppliersTab admin={data.admin} api={api} />}
      {tab === 'access' && data.admin && <AccessTab admin={data.admin} api={api} />}
    </div>
  );
}
