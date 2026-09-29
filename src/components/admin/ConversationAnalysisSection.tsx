'use client';

// Tableau de bord › « Analyse des conversations » (IA) : stades d'achat,
// intentions, produits demandés (dont hors catalogue), objections par listing,
// chiffre d'affaires en suspens (paniers réels + estimations), zones,
// questions mal traitées (→ phrase rapide en un clic), relances à faire,
// dernier rapport quotidien. Données : /api/admin/stats/conversation-analysis.

import { useEffect, useState } from 'react';
import { Brain, Flame, Loader2, MessageSquarePlus, Receipt, TriangleAlert, Wallet } from 'lucide-react';
import { INTENTS, labelOf, OBJECTIONS, STAGES } from '@/lib/conversation-analysis/taxonomy';
import type { ReportBreakdown } from '@/lib/conversation-analysis/report';
import type { Period } from '@/lib/admin-activity';

interface Report {
  report_date: string;
  analyzed_count: number;
  insights: string[];
  recommendations: string | null;
  pending_carts: number;
  pending_carts_total: number;
  cost_fcfa: number;
  updated_at?: string;
}
interface Data {
  available: boolean;
  error?: string;
  breakdown?: ReportBreakdown;
  costFcfa?: number;
  pendingCarts?: { count: number; total: number };
  report?: Report | null;
  llm: { provider: string; model: string; configured: boolean; keyVar?: string };
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800';
const h3 = 'font-display text-lg uppercase tracking-tight text-slate-900 dark:text-white';
const STAGE_COLOR: Record<string, string> = { BROWSING: '#94a3b8', CONSIDERING: '#38bdf8', READY_TO_BUY: '#10b981', ORDERED: '#8b5cf6', POST_PURCHASE: '#6366f1', LOST: '#ef4444' };

export default function ConversationAnalysisSection({ period }: { period: Period }) {
  const [data, setData] = useState<Data | null>(null);
  const [building, setBuilding] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/stats/conversation-analysis?period=${period}`)
      .then((r) => r.json())
      .then((d: Data) => alive && setData(d))
      .catch(() => alive && setData({ available: false, error: 'Synthèse indisponible', llm: { provider: '', model: '', configured: false } }));
    return () => {
      alive = false;
    };
  }, [period]);

  const buildReport = async () => {
    setBuilding(true);
    setMsg('');
    try {
      const r = await fetch('/api/cron/conversation-report', { method: 'POST' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d.error || 'Rapport impossible');
      else setData((x) => (x ? { ...x, report: d.report } : x));
    } finally {
      setBuilding(false);
    }
  };

  const addQuickReply = async (question: string, answer: string) => {
    setMsg('');
    const cur = await fetch('/api/inbox/quick-replies').then((r) => r.json()).catch(() => ({ items: [] }));
    const items = [...(cur.items || []), { id: `ia${Date.now().toString(36)}`, label: question.slice(0, 40), text: answer }];
    const r = await fetch('/api/inbox/quick-replies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    setMsg(r.ok ? `Phrase rapide ajoutée : « ${question.slice(0, 40)} »` : r.status === 403 ? 'Réservé à l’admin' : 'Ajout impossible');
  };

  if (!data) {
    return (
      <div className={`${card} flex justify-center py-8`}>
        <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
      </div>
    );
  }

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className={`${h3} flex items-center gap-2`}><Brain className="h-5 w-5 text-violet-500" /> Analyse des conversations (IA)</h3>
      <span className="text-[11px] text-slate-500">{data.llm.provider} · {data.llm.model}{data.costFcfa != null ? ` · coût sur la période : ${data.costFcfa.toLocaleString('fr-FR')} FCFA` : ''}</span>
    </div>
  );
  if (!data.available || !data.breakdown) {
    return (
      <div className={card}>
        {header}
        <p className="mt-3 text-sm text-amber-700">{data.error || 'Analyse indisponible.'}</p>
      </div>
    );
  }
  const b = data.breakdown;
  const stagesTotal = Object.values(b.stages).reduce((s, n) => s + n, 0) || 1;
  const pc = data.pendingCarts || { count: 0, total: 0 };

  return (
    <div className="space-y-4">
      <div className={card}>
        {header}
        {!data.llm.configured && <p className="mt-2 text-sm text-amber-700">Clé du fournisseur IA absente ({data.llm.keyVar || 'clé'} dans les variables Railway du site) : aucune nouvelle analyse ne peut tourner.</p>}
        {b.analyzed === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucune conversation analysée sur la période. L’analyse tourne toutes les heures (conversations d’au moins 2 messages client, calmes depuis 30 min).</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Mini icon={Brain} label="Conversations analysées" value={String(b.analyzed)} sub={b.avgIntentScore != null ? `intention moyenne ${b.avgIntentScore} %` : '—'} />
              <Mini icon={Wallet} label="CA en suspens (paniers)" value={fcfa(pc.total)} sub={`${pc.count} panier(s) non payé(s) avec transport, 30 j`} />
              <Mini icon={Receipt} label="Estimé sans panier" value={fcfa(b.estimatedPendingRevenue)} sub={`${b.readyWithoutCart} client(s) prêt(s) à acheter sans panier`} />
              <Mini icon={TriangleAlert} label="Risque d’abandon élevé" value={b.highRiskRate != null ? `${Math.round(b.highRiskRate * 100)} %` : '—'} sub={`${b.followUps.length} relance(s) à faire (> 24 h)`} />
            </div>
            {/* Stades */}
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Stade d’achat</p>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                {STAGES.filter((s) => b.stages[s.value]).map((s) => (
                  <div key={s.value} title={`${s.label} : ${b.stages[s.value]}`} style={{ width: `${(b.stages[s.value] / stagesTotal) * 100}%`, background: STAGE_COLOR[s.value] }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-3">
                {STAGES.filter((s) => b.stages[s.value]).map((s) => (
                  <span key={s.value} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: STAGE_COLOR[s.value] }} /> {s.label} {b.stages[s.value]}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
        {msg && <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-200">{msg}</p>}
      </div>

      {b.analyzed > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h3 className={`${h3} mb-3`}>Ce que demandent les clients</h3>
            <Bars items={Object.entries(b.intents).map(([k, v]) => ({ label: labelOf(INTENTS, k), value: v }))} color="#8b5cf6" />
            {b.topProducts.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Produits demandés</p>
                <ul className="space-y-1 text-sm">
                  {b.topProducts.map((p) => (
                    <li key={p.label} className="flex justify-between gap-2">
                      <span className="truncate">{p.label}</span>
                      <span className="shrink-0 tabular-nums text-slate-500">{p.count}{p.unanswered ? <span className="ml-1 text-amber-600">({p.unanswered} sans réponse)</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {b.sourcingRequests.length > 0 && (
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                <strong>Hors catalogue (idées de listings) :</strong> {b.sourcingRequests.map((s) => `${s.label} (${s.count})`).join(', ')}
              </p>
            )}
          </div>
          <div className={card}>
            <h3 className={`${h3} mb-3`}>Objections</h3>
            <Bars items={b.objections.map((o) => ({ label: labelOf(OBJECTIONS, o.value), value: o.count }))} color="#f59e0b" />
            {b.objectionsByListing.length > 0 && (
              <table className="mt-4 w-full text-xs">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {b.objectionsByListing.map((l) => (
                    <tr key={l.listing}>
                      <td className="max-w-[12rem] truncate py-1.5 pr-2 font-medium" title={l.listing}>{l.listing}</td>
                      <td className="py-1.5 text-slate-600 dark:text-slate-300">{Object.entries(l.objections).sort((a, c) => c[1] - a[1]).map(([k, v]) => `${labelOf(OBJECTIONS, k)} ${v}`).join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {b.deliveryZones.length > 0 && <p className="mt-3 text-xs text-slate-600 dark:text-slate-300"><strong>Zones demandées :</strong> {b.deliveryZones.map((z) => `${z.zone} (${z.count})`).join(', ')}</p>}
          </div>
        </div>
      )}

      {b.analyzed > 0 && (b.teamGaps.length > 0 || b.followUps.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={card}>
            <h3 className={`${h3} mb-1`}>Questions mal traitées</h3>
            <p className="mb-3 text-xs text-slate-500">Questions restées sans vraie réponse : une phrase rapide les réglera la prochaine fois.</p>
            {b.teamGaps.length === 0 ? (
              <p className="text-sm text-slate-500">Rien à signaler.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {b.teamGaps.map((g) => (
                  <li key={g.question} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/40">
                    <p className="font-medium">« {g.question} » <span className="text-xs text-slate-500">× {g.count}</span></p>
                    {g.suggestedAnswer && (
                      <div className="mt-1 flex items-start gap-2">
                        <p className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">{g.suggestedAnswer}</p>
                        <button type="button" onClick={() => addQuickReply(g.question, g.suggestedAnswer!)} className="flex shrink-0 items-center gap-1 rounded-lg border border-violet-200 px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-50">
                          <MessageSquarePlus className="h-3 w-3" /> Phrase rapide
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={card}>
            <h3 className={`${h3} mb-1 flex items-center gap-2`}><Flame className="h-4 w-4 text-orange-500" /> Relances à faire</h3>
            <p className="mb-3 text-xs text-slate-500">Clients chauds sans réponse de l’équipe depuis plus de 24 h. Filtre « 🔥 Chauds » dans la messagerie.</p>
            {b.followUps.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune relance en retard.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {b.followUps.map((f) => (
                  <li key={f.conversation_id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1">{f.summary || 'Client chaud'}</span>
                    <span className="shrink-0 text-xs text-slate-500">{labelOf(STAGES, f.stage)} · {f.intent ?? '—'} % · {f.hoursWaiting} h</span>
                  </li>
                ))}
              </ul>
            )}
            <a href="/admin/inbox" className="mt-3 inline-block text-xs font-semibold text-violet-700 hover:underline">Ouvrir la messagerie →</a>
          </div>
        </div>
      )}

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={h3}>Rapport du jour</h3>
          <button type="button" onClick={buildReport} disabled={building} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200">
            {building && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Générer maintenant
          </button>
        </div>
        {!data.report ? (
          <p className="mt-2 text-sm text-slate-500">Pas encore de rapport. Il se génère chaque soir à 21 h (heure locale).</p>
        ) : (
          <div className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <p className="text-xs text-slate-500">
              {new Date(`${data.report.report_date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} · {data.report.analyzed_count} conversation(s) · {data.report.pending_carts} panier(s) en attente pour {fcfa(Number(data.report.pending_carts_total) || 0)} · coût {Number(data.report.cost_fcfa).toLocaleString('fr-FR')} FCFA
            </p>
            {data.report.insights.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {data.report.insights.map((i, k) => <li key={k}>{i}</li>)}
              </ul>
            )}
            {data.report.recommendations && <p className="rounded-xl bg-violet-50 px-3 py-2 dark:bg-violet-950/30">{data.report.recommendations}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, sub }: { icon: typeof Brain; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500"><Icon className="h-3.5 w-3.5" /> {label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function Bars({ items, color }: { items: { label: string; value: number }[]; color: string }) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, 8);
  const max = Math.max(...sorted.map((i) => i.value), 1);
  if (!sorted.length) return <p className="text-sm text-slate-500">Rien à signaler.</p>;
  return (
    <ul className="space-y-2">
      {sorted.map((i) => (
        <li key={i.label}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{i.value}</span>
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className="h-full rounded-full" style={{ width: `${Math.max(3, (i.value / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
