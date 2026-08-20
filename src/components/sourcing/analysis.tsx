'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ComputedRow, ComputeResult } from '@/lib/sourcing/compute';
import { QUOTE_STATUS_LABELS } from '@/lib/sourcing/defaults';
import { CostChart, ScatterChart, ScoreChart } from './charts';
import { Dash, eur, Section, Tag } from './ui';

const num = (v: number | null | undefined, digits = 0) =>
  v == null
    ? null
    : v.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

/** Cellule chiffrée : une valeur absente reste un tiret, jamais un zéro. */
function Num({ value, suffix }: { value: string | null; suffix?: string }) {
  if (value == null) return <Dash />;
  return (
    <>
      {value}
      {suffix ? ` ${suffix}` : ''}
    </>
  );
}

/* ═══ 5. Grille de prix et coût débarqué ═══ */

export function PriceGrid({ result }: { result: ComputeResult }) {
  const { active, withCost } = result;
  const best = withCost.length ? withCost[0].landed!.costPerSet : null;

  // Tri par coût croissant ; les fournisseurs sans coût calculable ferment la marche.
  const rows = [...active].sort(
    (a, b) => (a.landed?.costPerSet ?? Infinity) - (b.landed?.costPerSet ?? Infinity),
  );
  const priced = active.filter((r) => r.price5k != null);

  return (
    <Section
      id="grille-prix"
      title="5. Grille de prix et coût débarqué"
      subtitle="Un fournisseur n’entre dans la grille que s’il a un prix set, des sets par carton et un volume de carton. Sinon la ligne affiche « — » : aucune valeur manquante n’est estimée."
    >
      {active.length === 0 ? (
        <p className="rounded border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
          Aucun fournisseur actif au panel.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Fournisseur</th>
                <th className="px-3 py-2 text-right font-medium">Prix set</th>
                <th className="px-3 py-2 text-right font-medium">Prix set €</th>
                <th className="px-3 py-2 text-right font-medium">Outillage</th>
                <th className="px-3 py-2 text-right font-medium">Amort.</th>
                <th className="px-3 py-2 text-right font-medium">Volume m³</th>
                <th className="px-3 py-2 text-right font-medium">Poids kg</th>
                <th className="px-3 py-2 text-right font-medium">Fret+ass.</th>
                <th className="px-3 py-2 text-right font-medium">Droits+TVA</th>
                <th className="px-3 py-2 text-right font-medium">Total débarqué</th>
                <th className="px-3 py-2 text-right font-medium">€/set</th>
                <th className="px-3 py-2 text-right font-medium">Écart</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => {
                const l = r.landed;
                const isBest = l != null && best != null && l.costPerSet === best;
                return (
                  <tr key={r.supplier.id} className="border-t border-line">
                    <td className="px-3 py-2 font-medium text-ink">{r.supplier.name}</td>
                    <td className="px-3 py-2 text-right">
                      <Num value={num(r.price5k, 2)} suffix={r.currency ?? ''} />
                    </td>
                    <td className="px-3 py-2 text-right">{l ? eur(l.pricePerSetEur) : <Dash />}</td>
                    <td className="px-3 py-2 text-right">
                      {l?.toolingEur != null ? eur(l.toolingEur) : <Dash />}
                    </td>
                    <td className="px-3 py-2 text-right">{l ? eur(l.amortPerSet) : <Dash />}</td>
                    <td className="px-3 py-2 text-right">
                      <Num value={num(l?.volumeM3, 2)} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Num value={num(l?.weightKg)} />
                    </td>
                    <td className="px-3 py-2 text-right">{l ? eur(l.freightTotalEur) : <Dash />}</td>
                    <td className="px-3 py-2 text-right">{l ? eur(l.taxTotalEur) : <Dash />}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">
                      {l ? eur(l.totalEur) : <Dash />}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">
                      {l ? eur(l.costPerSet) : <Dash />}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l == null || best == null ? (
                        <Dash />
                      ) : isBest ? (
                        <span className="font-semibold text-emerald-700">mini</span>
                      ) : (
                        `+${Math.round((l.costPerSet / best - 1) * 100)} %`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Paliers de quantité ── */}
      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">Paliers de quantité</h3>
      {priced.length === 0 ? (
        <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
          Aucun prix saisi.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Fournisseur</th>
                <th className="px-3 py-2 text-right font-medium">5 000 sets</th>
                <th className="px-3 py-2 text-right font-medium">10 000 sets</th>
                <th className="px-3 py-2 text-right font-medium">20 000 sets</th>
                <th className="px-3 py-2 text-right font-medium">Dégressivité 5k→20k</th>
                <th className="px-3 py-2 font-medium">Lecture</th>
              </tr>
            </thead>
            <tbody>
              {priced.map((r) => {
                const deg = r.degressivityPct;
                const lecture =
                  deg == null
                    ? '—'
                    : deg < 5
                      ? 'Dégressivité faible : outillage probablement déjà amorti ou inclus ailleurs.'
                      : deg < 20
                        ? 'Dégressivité normale.'
                        : 'Forte dégressivité : une part importante du prix à 5 000 est de l’amortissement d’outillage — à négocier.';
                return (
                  <tr key={r.supplier.id} className="border-t border-line">
                    <td className="px-3 py-2 font-medium text-ink">{r.supplier.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Num value={num(r.price5k, 2)} suffix={r.currency ?? ''} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Num value={num(r.price10k, 2)} suffix={r.currency ?? ''} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Num value={num(r.price20k, 2)} suffix={r.currency ?? ''} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {deg == null ? <Dash /> : `−${Math.round(deg)} %`}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{lecture}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ═══ 6. Tableau comparatif et scoring ═══ */

type SortKey = 'name' | 'twist' | 'conf' | 'solid' | 'nCost' | 'nMoq' | 'nLead' | 'score';

const COLUMNS: Array<{ key: SortKey | null; label: string; align?: 'right' }> = [
  { key: 'name', label: 'Fournisseur' },
  { key: null, label: 'Pays' },
  { key: null, label: 'Voie' },
  { key: null, label: 'Statut' },
  { key: 'twist', label: 'Twist-lock', align: 'right' },
  { key: 'conf', label: 'Conformité', align: 'right' },
  { key: 'solid', label: 'Solidité', align: 'right' },
  { key: 'nCost', label: 'Coût', align: 'right' },
  { key: 'nMoq', label: 'MOQ', align: 'right' },
  { key: 'nLead', label: 'Délai', align: 'right' },
  { key: 'score', label: 'Score /100', align: 'right' },
  { key: null, label: 'Rang' },
];

const STATUS_TONE: Record<string, string> = {
  a_repondu: 'green',
  contacte: 'amber',
  relance: 'amber',
  a_refuse: 'red',
  ecarte: 'red',
  a_contacter: 'grey',
};

export function Comparison({ result }: { result: ComputeResult }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'score', desc: true });

  const value = (r: ComputedRow, key: SortKey): number | string | null =>
    key === 'name' ? r.supplier.name : (r[key] as number | null);

  const rows = [...result.active].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    if (typeof va === 'string' || typeof vb === 'string') {
      return String(va).localeCompare(String(vb), 'fr') * (sort.desc ? -1 : 1);
    }
    // Une valeur absente reste en fin de tri, quel que soit le sens.
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va - vb) * (sort.desc ? -1 : 1);
  });

  const cell = (v: number | null) => (v == null ? <Dash /> : Math.round(v));

  return (
    <Section
      id="comparatif"
      title="6. Tableau comparatif et scoring"
      subtitle="Un fournisseur sans réponse n’a ni note ni rang : lui donner zéro serait un jugement, pas une mesure."
    >
      {result.active.length === 0 ? (
        <p className="rounded border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
          Aucun fournisseur actif au panel.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[62rem] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    className={`px-3 py-2 font-medium ${col.align === 'right' ? 'text-right' : ''}`}
                  >
                    {col.key ? (
                      <button
                        onClick={() =>
                          setSort((s) =>
                            s.key === col.key
                              ? { key: s.key, desc: !s.desc }
                              : { key: col.key as SortKey, desc: true },
                          )
                        }
                        className={`inline-flex items-center gap-1 hover:text-ink ${
                          col.align === 'right' ? 'flex-row-reverse' : ''
                        }`}
                      >
                        {col.label}
                        {sort.key === col.key &&
                          (sort.desc ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUp className="size-3" />
                          ))}
                      </button>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.supplier.id} className="border-t border-line">
                  <td className="px-3 py-2 font-medium text-ink">{r.supplier.name}</td>
                  <td className="px-3 py-2 text-ink-soft">{r.supplier.country ?? <Dash />}</td>
                  <td className="px-3 py-2 text-ink-soft">{r.supplier.track ?? <Dash />}</td>
                  <td className="px-3 py-2">
                    {r.quote?.status ? (
                      <Tag tone={STATUS_TONE[r.quote.status]}>
                        {QUOTE_STATUS_LABELS[r.quote.status]}
                      </Tag>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{cell(r.twist)}</td>
                  <td className="px-3 py-2 text-right">{cell(r.conf)}</td>
                  <td className="px-3 py-2 text-right">{cell(r.solid)}</td>
                  <td className="px-3 py-2 text-right">{cell(r.nCost)}</td>
                  <td className="px-3 py-2 text-right">{cell(r.nMoq)}</td>
                  <td className="px-3 py-2 text-right">{cell(r.nLead)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-ink">
                    {r.score == null ? <Dash /> : Math.round(r.score)}
                  </td>
                  <td className="px-3 py-2">
                    {r.rank ? (
                      <span className="font-semibold text-ink">#{r.rank}</span>
                    ) : (
                      <span className="text-xs text-ink-soft">{r.pending ?? '—'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ═══ 7. Tableau de bord ═══ */

function Kpi({
  value,
  unit,
  label,
  sub,
  tone,
}: {
  value: string;
  unit?: string;
  label: string;
  sub: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div className="break-inside-avoid rounded border border-line bg-white px-3 py-2.5">
      <div
        className={`text-2xl font-bold leading-none ${
          tone === 'good' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-forest'
        }`}
      >
        {value}
        {unit && <span className="ml-0.5 text-sm font-semibold text-ink-soft">{unit}</span>}
      </div>
      <div className="mt-1 text-[10.5px] uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="mt-0.5 text-xs text-ink-soft/80">{sub}</div>
    </div>
  );
}

export function Dashboard({ result }: { result: ComputeResult }) {
  const k = result.kpis;
  const plural = (n: number, s: string) => `${n} ${s}${n > 1 ? 's' : ''}`;

  return (
    <Section
      id="tableau-de-bord"
      title="7. Tableau de bord"
      subtitle="Les mêmes chiffres que la grille et le comparatif, vus d’ensemble."
    >
      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-5">
        <Kpi
          value={String(k.consulted)}
          unit={`/ ${k.activeCount}`}
          label="Fournisseurs consultés"
          sub={`sur ${k.activeCount} actifs au panel`}
        />
        <Kpi
          value={String(Math.round(k.responseRate))}
          unit="%"
          label="Taux de réponse"
          sub={`${plural(k.replied, 'réponse')} reçue${k.replied > 1 ? 's' : ''}`}
        />
        <Kpi
          value={String(k.provenTwistLock)}
          label="Twist-lock prouvé"
          sub="preuve fournie, pas déclaration"
          tone={k.provenTwistLock ? 'good' : 'warn'}
        />
        <Kpi
          value={k.bestCostPerSet != null ? eur(k.bestCostPerSet) : '—'}
          label="Meilleur coût débarqué"
          sub="par set, tout compris"
        />
        <Kpi
          value={k.spreadPct != null ? `+${Math.round(k.spreadPct)}` : '—'}
          unit="%"
          label="Écart min → max"
          sub={`${plural(k.quotedCount, 'offre')} chiffrée${k.quotedCount > 1 ? 's' : ''}`}
        />
      </div>

      <div className="space-y-4">
        <CostChart rows={result.withCost} />
        <ScoreChart rows={result.ranked} />
        <ScatterChart rows={result.active} />
      </div>
    </Section>
  );
}
