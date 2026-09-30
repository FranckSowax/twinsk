'use client';

// Fiches d'usines anonymisées, par lot : classement due diligence (/25 sur
// 5 critères), statut de sélection décidé par l'équipe, description et
// caractéristiques de l'usine et du produit. Même composant côté client
// (onglet « Usines ») et côté équipe (aperçu de ce que voit le client) : il ne
// reçoit que la projection publique, jamais les noms ni les contacts.

import { Award, CheckCircle2, FlaskConical } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import { SAMPLE_STATUS, SCORE_CRITERIA, SUPPLIER_STATUS, type SupplierStatus } from '@/lib/projects/types';
import { Badge, Empty, card } from './shared';

type Card = PublicProject['suppliers'][number];

// Libellés courts pour les cases de notation (écran étroit) ; le libellé complet reste en info-bulle.
const SHORT: Record<string, string> = { certifications: 'Certifs', tropical: 'Climat', installation: 'Installation', price: 'Prix', transparency: 'Transparence' };
const STATUS_TONE: Record<SupplierStatus, 'emerald' | 'blue' | 'slate' | 'red'> = { selected: 'emerald', shortlisted: 'blue', candidate: 'slate', rejected: 'red' };
export const statusLabel = (s: SupplierStatus) => SUPPLIER_STATUS.find((x) => x.value === s)?.label || s;

export function FactoryCards({ suppliers, lots }: { suppliers: Card[]; lots?: string[] }) {
  const order = [...new Set([...(lots || []), ...suppliers.map((s) => s.lot)])].filter((l) => suppliers.some((s) => s.lot === l));
  if (!suppliers.length) return <Empty>Les usines consultées apparaîtront ici, sous alias, avec leur classement et leur fiche produit.</Empty>;
  return (
    <div className="space-y-4">
      {order.map((lot) => {
        const list = suppliers.filter((s) => s.lot === lot);
        const selected = list.filter((s) => s.status === 'selected').length;
        return (
          <div key={lot} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">{lot}</p>
              <p className="text-xs text-slate-500">{list.length} usine{list.length > 1 ? 's' : ''} consultée{list.length > 1 ? 's' : ''}{selected ? ` · ${selected} retenue${selected > 1 ? 's' : ''}` : ''}</p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {list.map((s) => <FactoryCard key={`${s.lot}-${s.alias}`} s={s} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FactoryCard({ s }: { s: Card }) {
  const scored = SCORE_CRITERIA.filter((c) => typeof s.scores[c.key] === 'number');
  const sample = s.sample_status && s.sample_status !== 'none' ? SAMPLE_STATUS.find((x) => x.value === s.sample_status)?.label : null;
  return (
    <div className={`rounded-xl border p-3 ${s.status === 'selected' ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-900/10' : s.status === 'rejected' ? 'border-slate-100 opacity-60 dark:border-slate-700' : 'border-slate-200 dark:border-slate-700'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-white dark:text-slate-900">{s.rank}</span>
          <span className="font-semibold text-slate-900 dark:text-white">{s.alias}</span>
          {s.country && <span className="text-xs text-slate-500">· {s.country}</span>}
        </span>
        <span className="flex items-center gap-2">
          {s.score != null && <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100"><Award className="h-4 w-4 text-amber-500" />{s.score}<span className="text-[10px] font-normal text-slate-500">/25</span></span>}
          <Badge tone={STATUS_TONE[s.status]}>{s.status === 'selected' ? <><CheckCircle2 className="mr-0.5 inline h-3 w-3" />Retenue</> : statusLabel(s.status)}</Badge>
        </span>
      </div>
      {s.description && <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{s.description}</p>}
      {scored.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-5">
          {scored.map((c) => (
            <div key={c.key} className="rounded-lg bg-slate-50 px-1.5 py-1 text-center dark:bg-slate-900/40" title={`${c.label} — ${c.hint}`}>
              <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{s.scores[c.key]}<span className="text-[9px] font-normal text-slate-400">/5</span></p>
              <p className="truncate text-[9px] uppercase tracking-wide text-slate-500">{SHORT[c.key] || c.label}</p>
            </div>
          ))}
        </div>
      )}
      {(s.years_experience != null || s.capacity || s.lead_time || s.moq) && (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {s.years_experience != null && <><dt className="text-slate-500">Expérience</dt><dd className="text-slate-800 dark:text-slate-100">{s.years_experience} ans</dd></>}
          {s.capacity && <><dt className="text-slate-500">Capacité</dt><dd className="text-slate-800 dark:text-slate-100">{s.capacity}</dd></>}
          {s.lead_time && <><dt className="text-slate-500">Délai de production</dt><dd className="text-slate-800 dark:text-slate-100">{s.lead_time}</dd></>}
          {s.moq && <><dt className="text-slate-500">Minimum de commande</dt><dd className="text-slate-800 dark:text-slate-100">{s.moq}</dd></>}
        </dl>
      )}
      {s.product_specs.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Produit proposé</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {s.product_specs.map((x, i) => <li key={i}><span className="text-slate-500">{x.label} : </span><span className="text-slate-800 dark:text-slate-100">{x.value}</span></li>)}
          </ul>
        </div>
      )}
      {(s.certifications.length > 0 || sample) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {s.certifications.map((c) => <Badge key={c} tone="violet">{c}</Badge>)}
          {sample && <Badge tone="amber"><FlaskConical className="mr-0.5 inline h-3 w-3" />{sample}</Badge>}
        </div>
      )}
    </div>
  );
}
