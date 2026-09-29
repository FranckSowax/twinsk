'use client';

// Volet « Analyse IA » d'une conversation (messagerie /admin/inbox et /agent) :
// besoin du client, stade d'achat (corrigé par les commandes), intention,
// objections, prochaine action en un clic vers l'outil existant (panier,
// sélection, lien du listing, épingle…), réponses types suggérées pour les
// questions mal traitées. Bouton « Ré-analyser ». Libellés : taxonomie.

import { useCallback, useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronUp, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import {
  INTENTS,
  labelOf,
  NEXT_ACTIONS,
  OBJECTIONS,
  PAYMENT_METHODS,
  RISK_TONE,
  RISKS,
  STAGE_TONE,
  STAGES,
  TRANSPORT_PREFS,
} from '@/lib/conversation-analysis/taxonomy';
import type { ConversationAnalysis } from '@/lib/conversation-analysis/analysis';

type Stored = ConversationAnalysis & { analyzed_at: string; cost_fcfa: number; model: string | null; listing_id: string | null; triggered_by: string | null };

export interface AnalysisActions {
  openCart: () => void;
  openSelection: () => void;
  insertText: (text: string) => void;
  pin: () => void;
  note: (text: string) => void;
}

const COLLAPSE_KEY = 'inbox_analysis_open';

export function StageBadge({ stage, intent, risk, compact = false }: { stage?: string | null; intent?: number | null; risk?: string | null; compact?: boolean }) {
  if (!stage && intent == null) return null;
  return (
    <>
      {stage && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${STAGE_TONE[stage] || 'bg-slate-100 text-slate-600'}`}>{labelOf(STAGES, stage)}</span>}
      {intent != null && (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${intent >= 70 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`} title="Intention d’achat estimée">
          {intent >= 70 ? '🔥' : ''}
          {intent}
          {compact ? '' : ' %'}
        </span>
      )}
      {risk === 'HIGH' && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${RISK_TONE.HIGH}`}>Risque</span>}
    </>
  );
}

export default function AnalysisPanel({
  conversationId,
  fetcher,
  actions,
  origin,
}: {
  conversationId: string;
  fetcher: (url: string, init?: RequestInit) => Promise<Response>;
  actions: AnalysisActions;
  origin: string;
}) {
  const [data, setData] = useState<Stored | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) !== '0';
    } catch {
      return true;
    }
  });

  const load = useCallback(async () => {
    const r = await fetcher(`/api/inbox/conversations/${conversationId}/analyze`);
    const d = await r.json().catch(() => ({}));
    setData(r.ok ? d.analysis || null : null);
    setLoaded(true);
  }, [conversationId, fetcher]);

  useEffect(() => {
    let alive = true;
    fetcher(`/api/inbox/conversations/${conversationId}/analyze`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        setData(ok ? d.analysis || null : null);
        setLoaded(true);
        setError('');
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [conversationId, fetcher]);

  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        /* stockage indisponible : sans effet */
      }
      return !v;
    });
  };

  const reanalyze = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetcher(`/api/inbox/conversations/${conversationId}/analyze`, { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || 'Analyse impossible');
      else if (d.analysis) setData(d.analysis);
      else await load();
    } finally {
      setBusy(false);
    }
  };

  // Prochaine action → outil existant de la messagerie.
  const runAction = (a: Stored) => {
    const note = a.nextBestActionNote || labelOf(NEXT_ACTIONS, a.nextBestAction);
    switch (a.nextBestAction) {
      case 'CREATE_CART':
        return actions.openCart();
      case 'SEND_SELECTION':
        return actions.openSelection();
      case 'SEND_LISTING':
        return actions.insertText(a.listing_id ? `${origin}/offer/${a.listing_id}` : `${origin}/bio`);
      case 'FOLLOW_UP_24H':
        actions.pin();
        return actions.note(`À relancer : ${note}`);
      case 'ESCALATE_ADMIN':
      case 'SOURCING_REQUEST':
        return actions.note(note);
      default:
        return actions.insertText(note);
    }
  };

  const box = 'border-b border-violet-200 bg-violet-50/60 px-3 py-2 dark:border-violet-900/40 dark:bg-violet-950/20';
  const btn = 'inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-800 dark:bg-transparent dark:text-violet-200';

  return (
    <div className={box}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-violet-800 dark:text-violet-200">
          <Brain className="h-3.5 w-3.5" /> Analyse IA {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {data && <StageBadge stage={data.purchaseStage} intent={data.purchaseIntentScore} risk={data.abandonRisk} />}
        {data && !open && data.customerNeedSummary && <span className="min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300">{data.customerNeedSummary}</span>}
        <span className="ml-auto flex items-center gap-2">
          {data && <span className="text-[10px] text-slate-400">{new Date(data.analyzed_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>}
          <button type="button" onClick={reanalyze} disabled={busy} className={btn} title="Relancer l’analyse IA de cette conversation">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} {data ? 'Ré-analyser' : 'Analyser'}
          </button>
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {open && loaded && !data && !error && <p className="mt-1 text-xs text-slate-500">Pas encore analysée (analyse automatique toutes les heures, à partir de 2 messages du client).</p>}
      {open && data && (
        <div className="mt-2 space-y-2 text-xs text-slate-700 dark:text-slate-200">
          {data.customerNeedSummary && <p className="text-sm font-medium text-slate-900 dark:text-white">{data.customerNeedSummary}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span><span className="text-slate-500">Intention :</span> {labelOf(INTENTS, data.intentCategory)}</span>
            {data.transportPreference !== 'UNKNOWN' && <span><span className="text-slate-500">Transport :</span> {labelOf(TRANSPORT_PREFS, data.transportPreference)}</span>}
            {data.paymentMethodMentioned !== 'NONE' && <span><span className="text-slate-500">Paiement :</span> {labelOf(PAYMENT_METHODS, data.paymentMethodMentioned)}</span>}
            {data.deliveryZone && <span><span className="text-slate-500">Zone :</span> {data.deliveryZone}</span>}
            {data.factStage && data.factStage !== data.llmStage && <span className="text-slate-500">Stade corrigé par les commandes ({labelOf(STAGES, data.llmStage)} → {labelOf(STAGES, data.purchaseStage)})</span>}
          </div>
          {data.productsMentioned.length > 0 && (
            <p><span className="text-slate-500">Produits :</span> {data.productsMentioned.map((p) => `${p.label}${p.quantity ? ` × ${p.quantity}` : ''}`).join(', ')}</p>
          )}
          {data.objections.filter((o) => o !== 'NONE').length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-slate-500">Objections :</span>
              {data.objections.filter((o) => o !== 'NONE').map((o) => (
                <span key={o} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{labelOf(OBJECTIONS, o)}</span>
              ))}
            </div>
          )}
          {data.abandonRisk !== 'LOW' && (
            <p><span className="text-slate-500">Risque d’abandon :</span> {labelOf(RISKS, data.abandonRisk)}{data.abandonReason ? ` — ${data.abandonReason}` : ''}</p>
          )}
          {data.upsellOpportunity && <p><span className="text-slate-500">À proposer aussi :</span> {data.upsellOpportunity}</p>}
          {data.nextBestAction !== 'NONE' && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5 dark:bg-slate-900/40">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              <span className="min-w-0 flex-1">{data.nextBestActionNote || labelOf(NEXT_ACTIONS, data.nextBestAction)}</span>
              <button type="button" onClick={() => runAction(data)} className={btn}>{labelOf(NEXT_ACTIONS, data.nextBestAction)}</button>
            </div>
          )}
          {data.teamGaps.length > 0 && (
            <div className="space-y-1">
              <p className="text-slate-500">Questions restées sans vraie réponse :</p>
              {data.teamGaps.map((g, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1">« {g.question} »</span>
                  {g.suggestedAnswer && (
                    <button type="button" onClick={() => actions.insertText(g.suggestedAnswer!)} className={btn} title={g.suggestedAnswer}>
                      Insérer une réponse
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
