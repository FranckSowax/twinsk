'use client';

// Onglet « Usines » (client) et aperçu côté équipe : usines consultées,
// anonymisées, en liste regroupée par lot. Une ligne compacte par usine
// (rang, alias, statut, note /25) ; au tap, une fenêtre avec la notation
// critère par critère, la fiche de l'usine et du produit, et le passage à
// l'usine précédente / suivante du lot. Ne reçoit que la projection publique.

import { useEffect, useRef, useState } from 'react';
import { Award, Camera, CheckCircle2, ChevronLeft, ChevronRight, FlaskConical, X } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import { SAMPLE_STATUS, SCORE_CRITERIA, SUPPLIER_STATUS, type SupplierStatus } from '@/lib/projects/types';
import { Badge, Empty, Modal, btn, card } from './shared';

type Card = PublicProject['suppliers'][number];

const STATUS_TONE: Record<SupplierStatus, 'emerald' | 'blue' | 'slate' | 'red'> = { selected: 'emerald', shortlisted: 'blue', candidate: 'slate', rejected: 'red' };
export const statusLabel = (s: SupplierStatus) => SUPPLIER_STATUS.find((x) => x.value === s)?.label || s;
/** Couleur de la note ramenée sur 25 : ≥ 20 très bien, ≥ 15 correct, sinon faible. */
const scoreTone = (n: number | null) => (n == null ? 'bg-slate-300' : n >= 20 ? 'bg-emerald-500' : n >= 15 ? 'bg-amber-500' : 'bg-slate-400');
const keyOf = (s: Card) => `${s.lot}|${s.alias}`;

function StatusBadge({ s }: { s: SupplierStatus }) {
  return <Badge tone={STATUS_TONE[s]}>{s === 'selected' ? <><CheckCircle2 className="mr-0.5 inline h-3 w-3" />Retenue</> : statusLabel(s)}</Badge>;
}
function ScoreBar({ score, max = 25, className = '' }: { score: number | null; max?: number; className?: string }) {
  return (
    <span className={`block h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700 ${className}`}>
      <span className={`block h-full rounded-full ${scoreTone(score == null ? null : (score / max) * 25)}`} style={{ width: `${score == null ? 0 : Math.round((score / max) * 100)}%` }} />
    </span>
  );
}

export function FactoryCards({ suppliers, lots }: { suppliers: Card[]; lots?: string[] }) {
  const [lot, setLot] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  if (!suppliers.length) return <Empty>Les usines consultées apparaîtront ici, sous alias, avec leur classement et leur fiche produit.</Empty>;

  const order = [...new Set([...(lots || []), ...suppliers.map((s) => s.lot)])].filter((l) => suppliers.some((s) => s.lot === l));
  const selected = suppliers.filter((s) => s.status === 'selected').length;
  const shown = order.filter((l) => !lot || l === lot);
  const current = suppliers.find((s) => keyOf(s) === open) || null;
  const siblings = current ? suppliers.filter((s) => s.lot === current.lot) : [];
  const idx = current ? siblings.findIndex((s) => keyOf(s) === open) : -1;

  return (
    <div className="space-y-3">
      {/* Synthèse */}
      <div className={`${card} grid grid-cols-3 divide-x divide-slate-100 !p-0 text-center dark:divide-slate-700`}>
        {[
          { n: suppliers.length, l: 'usines consultées' },
          { n: order.length, l: order.length > 1 ? 'lots' : 'lot' },
          { n: selected, l: selected > 1 ? 'retenues' : 'retenue' },
        ].map((x) => (
          <div key={x.l} className="px-2 py-3">
            <p className="font-display text-xl font-bold tabular-nums text-slate-900 dark:text-white">{x.n}</p>
            <p className="text-[11px] text-slate-500">{x.l}</p>
          </div>
        ))}
      </div>

      {/* Filtres par lot : défilement horizontal sur mobile */}
      {order.length > 1 && (
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ v: '', l: 'Tous', n: suppliers.length }, ...order.map((l) => ({ v: l, l, n: suppliers.filter((s) => s.lot === l).length }))].map((f) => (
            <button key={f.v || 'all'} type="button" onClick={() => setLot(f.v)} className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${lot === f.v ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
              {f.l}
              <span className={`rounded-full px-1.5 text-[10px] ${lot === f.v ? 'bg-white/25' : 'bg-slate-100 dark:bg-slate-700'}`}>{f.n}</span>
            </button>
          ))}
        </div>
      )}

      {/* Liste regroupée par lot : une ligne par usine, détail au tap */}
      {shown.map((l) => {
        const list = suppliers.filter((s) => s.lot === l);
        const kept = list.filter((s) => s.status === 'selected').length;
        return (
          <section key={l} className={`${card} overflow-hidden !p-0`}>
            <header className="flex items-baseline justify-between gap-2 border-b border-slate-100 px-3.5 py-2.5 dark:border-slate-700 sm:px-4">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">{l}</h3>
              <p className="text-[11px] text-slate-500">{list.length} usine{list.length > 1 ? 's' : ''}{kept ? ` · ${kept} retenue${kept > 1 ? 's' : ''}` : ''}</p>
            </header>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {list.map((s) => (
                <li key={keyOf(s)}>
                  <button type="button" onClick={() => setOpen(keyOf(s))} className={`flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-700/40 sm:px-4 ${s.status === 'rejected' ? 'opacity-55' : ''} ${s.status === 'selected' ? 'bg-emerald-50/70 dark:bg-emerald-900/15' : ''}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.rank === 1 && s.status !== 'rejected' ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>{s.rank}</span>
                    {s.photos.length > 0 && (
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.photos[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        {s.photos.length > 1 && <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/60 px-1 text-[9px] font-bold text-white">{s.photos.length}</span>}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-white">{s.alias}</span>
                        <StatusBadge s={s.status} />
                      </span>
                      {s.description && <span className="mt-0.5 block truncate text-xs text-slate-500">{s.description}</span>}
                    </span>
                    <span className="w-14 shrink-0 text-right">
                      <span className="block text-sm font-bold tabular-nums text-slate-900 dark:text-white">{s.score ?? '—'}<span className="text-[10px] font-normal text-slate-400">/25</span></span>
                      <ScoreBar score={s.score} className="mt-1" />
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <p className="px-1 text-[11px] text-slate-500">Classement par lot : usines retenues, puis présélectionnées, puis par note due diligence /25 (certifications, adéquation au climat, installation, prix, transparence). Identités communiquées à la signature des accords-cadres.</p>

      {current && (
        <Modal title={<span className="flex flex-wrap items-center gap-2">{current.alias}<StatusBadge s={current.status} /></span>} onClose={() => setOpen(null)}>
          <FactoryDetail s={current} />
          {siblings.length > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
              <button type="button" disabled={idx <= 0} onClick={() => setOpen(keyOf(siblings[idx - 1]))} className={btn}><ChevronLeft className="h-4 w-4" /> Précédente</button>
              <span className="text-xs tabular-nums text-slate-500">{current.lot} · {idx + 1}/{siblings.length}</span>
              <button type="button" disabled={idx >= siblings.length - 1} onClick={() => setOpen(keyOf(siblings[idx + 1]))} className={btn}>Suivante <ChevronRight className="h-4 w-4" /></button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function FactoryDetail({ s }: { s: Card }) {
  const scored = SCORE_CRITERIA.filter((c) => typeof s.scores[c.key] === 'number');
  const sample = s.sample_status && s.sample_status !== 'none' ? SAMPLE_STATUS.find((x) => x.value === s.sample_status)?.label : null;
  const facts = [
    { l: 'Lot', v: s.lot },
    { l: 'Rang dans le lot', v: String(s.rank) },
    { l: 'Pays', v: s.country },
    { l: 'Expérience', v: s.years_experience != null ? `${s.years_experience} ans` : null },
    { l: 'Capacité', v: s.capacity },
    { l: 'Délai de production', v: s.lead_time },
    { l: 'Minimum de commande', v: s.moq },
  ].filter((f): f is { l: string; v: string } => !!f.v);
  return (
    <div className="space-y-4">
      {s.photos.length > 0 && <PhotoGallery photos={s.photos} />}
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
        <Award className="h-8 w-8 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Note due diligence</p>
          <p className="font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{s.score ?? '—'}<span className="text-sm font-normal text-slate-400"> / 25</span></p>
          <ScoreBar score={s.score} className="mt-1" />
        </div>
      </div>

      {scored.length > 0 && (
        <div className="space-y-2.5">
          {scored.map((c) => (
            <div key={c.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-100">{c.label}</span>
                <span className="font-bold tabular-nums text-slate-900 dark:text-white">{s.scores[c.key]}<span className="text-[10px] font-normal text-slate-400">/5</span></span>
              </div>
              <ScoreBar score={s.scores[c.key] ?? null} max={5} className="mt-1" />
              <p className="mt-0.5 text-[11px] text-slate-500">{c.hint}</p>
            </div>
          ))}
        </div>
      )}

      {s.description && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">L’usine</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{s.description}</p>
        </div>
      )}

      {facts.length > 0 && (
        <dl className="grid grid-cols-2 gap-2">
          {facts.map((f) => (
            <div key={f.l} className="rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-700">
              <dt className="text-[10px] uppercase tracking-wider text-slate-400">{f.l}</dt>
              <dd className="text-sm font-medium text-slate-900 dark:text-white">{f.v}</dd>
            </div>
          ))}
        </dl>
      )}

      {s.product_specs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Produit proposé</p>
          <dl className="mt-1 divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-slate-700 dark:border-slate-700">
            {s.product_specs.map((x, i) => (
              <div key={i} className="flex justify-between gap-3 px-3 py-2 text-sm">
                <dt className="text-slate-500">{x.label}</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{x.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {(s.certifications.length > 0 || sample) && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Certifications et échantillon</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {s.certifications.map((c) => <Badge key={c} tone="violet">{c}</Badge>)}
            {sample && <Badge tone="amber"><FlaskConical className="mr-0.5 inline h-3 w-3" />{sample}</Badge>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Photos du produit : carrousel à faire glisser (points de position), agrandissement plein écran au tap. */
function PhotoGallery({ photos }: { photos: Card['photos'] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const go = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };
  useEffect(() => {
    if (zoom == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setZoom(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [zoom]);
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><Camera className="h-3.5 w-3.5" /> Photos du produit</p>
      <div className="relative overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800">
        <div ref={track} onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]">
          {photos.map((p, i) => (
            <button key={p.url} type="button" onClick={() => setZoom(i)} className="relative w-full shrink-0 snap-center" aria-label={`Agrandir la photo ${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || `Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" loading={i === 0 ? 'eager' : 'lazy'} />
              {p.caption && <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-left text-xs font-medium text-white">{p.caption}</span>}
            </button>
          ))}
        </div>
        {photos.length > 1 && (
          <>
            <button type="button" onClick={() => go(Math.max(0, index - 1))} disabled={index === 0} className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-0 sm:flex" aria-label="Photo précédente"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => go(Math.min(photos.length - 1, index + 1))} disabled={index === photos.length - 1} className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white disabled:opacity-0 sm:flex" aria-label="Photo suivante"><ChevronRight className="h-5 w-5" /></button>
            <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white">{index + 1}/{photos.length}</div>
          </>
        )}
      </div>
      {photos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {photos.map((p, i) => <button key={p.url} type="button" onClick={() => go(i)} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-emerald-500' : 'w-1.5 bg-slate-300 dark:bg-slate-600'}`} aria-label={`Photo ${i + 1}`} />)}
        </div>
      )}
      {zoom != null && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={() => setZoom(null)} role="dialog" aria-modal="true">
          <div className="flex items-center justify-between px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white">
            <span className="text-sm tabular-nums">{zoom + 1}/{photos.length}</span>
            <button type="button" onClick={() => setZoom(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Fermer"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex flex-1 items-center justify-center p-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[zoom].url} alt={photos[zoom].caption || ''} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-white" onClick={(e) => e.stopPropagation()}>
            <button type="button" disabled={zoom === 0} onClick={() => setZoom(zoom - 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Précédente"><ChevronLeft className="h-5 w-5" /></button>
            <p className="min-w-0 flex-1 text-center text-sm">{photos[zoom].caption}</p>
            <button type="button" disabled={zoom === photos.length - 1} onClick={() => setZoom(zoom + 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30" aria-label="Suivante"><ChevronRight className="h-5 w-5" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
