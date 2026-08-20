'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  CURRENCIES,
  DEFAULT_PARAMS,
  DEFAULT_WEIGHTS,
  PARAM_WARNINGS,
  SPEC_ROWS,
  type MarketBlock,
  type SpecRow,
} from '@/lib/sourcing/defaults';
import { computeProject } from '@/lib/sourcing/compute';
import type { SourcingParams, SourcingProject, SourcingWeights } from '@/lib/sourcing/types';
import { Comparison, Dashboard, PriceGrid } from './analysis';
import { SupplierCard, type SupplierEntry } from './SupplierCard';
import { useAutosave } from './useAutosave';
import { Field, NumberInput, SaveIndicator, Section, Select, TextArea, TextInput } from './ui';

const PROJECT_STATUS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'active', label: 'Consultation en cours' },
  { value: 'decided', label: 'Décidé' },
  { value: 'archived', label: 'Archivé' },
];

const WEIGHT_LABELS: Array<{ key: keyof SourcingWeights; label: string }> = [
  { key: 'twist', label: 'Faisabilité twist-lock' },
  { key: 'conf', label: 'Conformité vérifiable' },
  { key: 'solid', label: 'Solidité / contrepartie' },
  { key: 'cost', label: 'Coût débarqué' },
  { key: 'moq', label: 'Compatibilité MOQ' },
  { key: 'lead', label: 'Délai total' },
];

/** Sections déjà construites — le sommaire ne propose jamais une ancre morte. */
const NAV = [
  { id: 'projet', label: 'Projet' },
  { id: 'cahier-des-charges', label: '1. Cahier des charges' },
  { id: 'constat-marche', label: '2. Constat de marché' },
  { id: 'parametres', label: '3. Paramètres de calcul' },
  { id: 'consultation', label: '4. Consultation fournisseurs' },
  { id: 'grille-prix', label: '5. Grille de prix' },
  { id: 'comparatif', label: '6. Comparatif et scoring' },
  { id: 'tableau-de-bord', label: '7. Tableau de bord' },
];

interface CockpitData {
  project: SourcingProject;
  suppliers: SupplierEntry[];
}

export function SourcingCockpit({ slug }: { slug: string }) {
  const [data, setData] = useState<CockpitData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [active, setActive] = useState('projet');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sourcing/projects/${encodeURIComponent(slug)}`);
      if (cancelled) return;
      if (!res.ok) {
        setError(
          res.status === 401
            ? 'Session expirée — reconnectez-vous depuis le menu d’administration.'
            : 'Projet introuvable.',
        );
        return;
      }
      const json = await res.json();
      setData({ project: json.project, suppliers: json.suppliers ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const projectId = data?.project.id;
  const sendProject = useCallback(
    (patch: Record<string, unknown>) =>
      fetch(`/api/sourcing/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    [projectId],
  );
  const save = useAutosave(sendProject);

  const setProject = useCallback(
    (patch: Partial<SourcingProject>) => {
      setData((d) => (d ? { ...d, project: { ...d.project, ...patch } } : d));
      save.push(patch as Record<string, unknown>);
    },
    [save],
  );

  // Surligne dans le sommaire la section à l'écran.
  useEffect(() => {
    if (!data) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    for (const s of NAV) {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [data]);

  const params: SourcingParams = data?.project.params ?? DEFAULT_PARAMS;
  const weights: SourcingWeights = data?.project.weights ?? DEFAULT_WEIGHTS;
  const weightsSum = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights]);

  const spec = useMemo<SpecRow[]>(() => {
    const rows = (data?.project.spec as { rows?: SpecRow[] } | undefined)?.rows;
    if (rows?.length) return rows;
    return SPEC_ROWS.map((label) => ({ label, value: '', tolerance: '' }));
  }, [data?.project.spec]);

  const market = useMemo<MarketBlock[]>(
    () => (data?.project.market_finding as { blocks?: MarketBlock[] } | undefined)?.blocks ?? [],
    [data?.project.market_finding],
  );

  /**
   * Recalcul à chaque frappe : les grilles et graphiques suivent la saisie sans
   * attendre l'aller-retour serveur. Un seul moteur, celui des tests de parité.
   */
  const result = useMemo(
    () =>
      computeProject({
        params,
        weights,
        entries: (data?.suppliers ?? []).map((s) => ({ supplier: s, quote: s.quote })),
      }),
    [params, weights, data?.suppliers],
  );

  if (error) return <p className="p-6 text-sm text-ink-soft">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-ink-soft">Chargement du cockpit…</p>;

  const { project, suppliers } = data;

  const setSpecRow = (i: number, patch: Partial<SpecRow>) => {
    const rows = spec.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    setProject({ spec: { ...(project.spec ?? {}), rows } });
  };

  const setMarket = (blocks: MarketBlock[]) =>
    setProject({ market_finding: { ...(project.market_finding ?? {}), blocks } });

  const setParam = (patch: Partial<SourcingParams>) => setProject({ params: { ...params, ...patch } });

  const setFx = (code: string, value: number | null) =>
    setParam({ fx: { ...params.fx, [code]: value ?? 0 } });

  const setWeight = (key: keyof SourcingWeights, value: number | null) =>
    setProject({ weights: { ...weights, [key]: value ?? 0 } });

  const toggleAll = (open: boolean) =>
    setOpenIds(open ? new Set(suppliers.map((s) => s.id)) : new Set());

  return (
    <div className="flex gap-8">
      {/* ── Sommaire latéral collant ── */}
      <nav className="sticky top-4 hidden h-fit w-52 shrink-0 lg:block print:hidden">
        <ul className="space-y-0.5 border-l border-line">
          {NAV.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className={`-ml-px block border-l-2 py-1.5 pl-3 text-sm transition ${
                  active === s.id
                    ? 'border-forest font-medium text-ink'
                    : 'border-transparent text-ink-soft hover:border-line hover:text-ink'
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0 flex-1">
        {/* ── En-tête projet ── */}
        <Section
          id="projet"
          title={project.title}
          subtitle={
            <>
              Mis à jour le{' '}
              {new Date(project.updated_at).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </>
          }
          actions={<SaveIndicator state={save.state} onRetry={save.retry} />}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Titre">
              <TextInput value={project.title} onChange={(v) => setProject({ title: v })} />
            </Field>
            <Field label="Client">
              <TextInput value={project.client} onChange={(v) => setProject({ client: v })} />
            </Field>
            <Field label="Acheteur">
              <TextInput value={project.buyer} onChange={(v) => setProject({ buyer: v })} />
            </Field>
            <Field label="Statut">
              <Select
                value={project.status}
                onChange={(v) => setProject({ status: (v ?? 'draft') as SourcingProject['status'] })}
                options={PROJECT_STATUS as ReadonlyArray<{ value: string; label: string }>}
                placeholder="Brouillon"
              />
            </Field>
          </div>
        </Section>

        {/* ── 1. Cahier des charges ── */}
        <Section
          id="cahier-des-charges"
          title="1. Cahier des charges"
          subtitle="Chaque caractéristique porte sa valeur et sa tolérance. Un champ laissé vide reste vide : on n’estime pas une spécification."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="w-56 pb-2 font-medium">Caractéristique</th>
                  <th className="pb-2 font-medium">Valeur</th>
                  <th className="pb-2 font-medium">Tolérance / commentaire</th>
                </tr>
              </thead>
              <tbody>
                {spec.map((row, i) => (
                  <tr key={row.label + i} className="border-b border-line/60 last:border-0">
                    <td className="py-1.5 pr-3 align-middle font-medium text-ink">{row.label}</td>
                    <td className="py-1.5 pr-3">
                      <TextInput value={row.value} onChange={(v) => setSpecRow(i, { value: v })} />
                    </td>
                    <td className="py-1.5">
                      <TextInput
                        value={row.tolerance}
                        onChange={(v) => setSpecRow(i, { tolerance: v })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 2. Constat de marché ── */}
        <Section
          id="constat-marche"
          title="2. Rappel du constat de marché"
          subtitle="Ce qui a été cherché, ce que ça a donné, et les références les plus proches."
          actions={
            <button
              onClick={() => setMarket([...market, { title: '', body: '' }])}
              className="inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
            >
              <Plus className="size-3.5" /> Ajouter un constat
            </button>
          }
        >
          {market.length === 0 ? (
            <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
              Aucun constat consigné. Ajoutez-en un pour rappeler ce que la recherche a montré —
              c’est ce qui justifie la consultation.
            </p>
          ) : (
            <div className="space-y-3">
              {market.map((block, i) => (
                <div key={i} className="rounded border border-line p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex-1">
                      <TextInput
                        value={block.title}
                        onChange={(v) =>
                          setMarket(market.map((b, idx) => (idx === i ? { ...b, title: v } : b)))
                        }
                        placeholder="Titre du constat"
                      />
                    </div>
                    <button
                      onClick={() => setMarket(market.filter((_, idx) => idx !== i))}
                      className="rounded p-1.5 text-ink-soft hover:bg-mist hover:text-red-700"
                      aria-label="Supprimer ce constat"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <TextArea
                    value={block.body}
                    onChange={(v) =>
                      setMarket(market.map((b, idx) => (idx === i ? { ...b, body: v } : b)))
                    }
                    rows={4}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── 3. Paramètres de calcul ── */}
        <Section
          id="parametres"
          title="3. Paramètres de calcul"
          subtitle="Ces valeurs pilotent le coût débarqué et le score. Elles sont propres à ce projet."
        >
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Commande et logistique
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Field label="Quantité (sets)">
                  <NumberInput value={params.qty} onChange={(v) => setParam({ qty: v ?? 0 })} />
                </Field>
                <Field label="Fret LCL (€/m³)">
                  <NumberInput
                    value={params.freight_rate_eur_m3}
                    onChange={(v) => setParam({ freight_rate_eur_m3: v ?? 0 })}
                  />
                </Field>
                <Field label="Assurance (%)">
                  <NumberInput
                    step="0.1"
                    value={params.insurance_pct}
                    onChange={(v) => setParam({ insurance_pct: v ?? 0 })}
                  />
                </Field>
                <Field label="Droits de douane (%)">
                  <NumberInput
                    value={params.duty_pct}
                    onChange={(v) => setParam({ duty_pct: v ?? 0 })}
                  />
                </Field>
                <Field label="TVA (%)">
                  <NumberInput value={params.vat_pct} onChange={(v) => setParam({ vat_pct: v ?? 0 })} />
                </Field>
              </div>
              <p className="mt-2 text-xs text-ink-soft">{PARAM_WARNINGS.dutyVat}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Taux de change vers l’euro
              </p>
              <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8">
                {CURRENCIES.map((code) => (
                  <Field key={code} label={code}>
                    <NumberInput
                      step="0.000001"
                      value={params.fx?.[code] ?? null}
                      onChange={(v) => setFx(code, v)}
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-soft">{PARAM_WARNINGS.fx}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Pondérations du score
              </p>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {WEIGHT_LABELS.map((w) => (
                  <Field key={w.key} label={w.label}>
                    <NumberInput value={weights[w.key]} onChange={(v) => setWeight(w.key, v)} />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                Somme des poids :{' '}
                <b className={weightsSum === 100 ? 'text-emerald-700' : 'text-amber-700'}>
                  {weightsSum}
                </b>
                {weightsSum !== 100 &&
                  ' — ajustez pour revenir à 100 (le score reste correct, il est renormalisé).'}
              </p>
            </div>
          </div>
        </Section>

        {/* ── 4. Consultation fournisseurs ── */}
        <Section
          id="consultation"
          title="4. Consultation fournisseurs — saisie des réponses"
          subtitle={`${suppliers.filter((s) => s.included).length} au panel sur ${suppliers.length} fournisseurs.`}
          actions={
            <>
              <button
                onClick={() => toggleAll(true)}
                className="rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
              >
                Tout déplier
              </button>
              <button
                onClick={() => toggleAll(false)}
                className="rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist"
              >
                Tout replier
              </button>
            </>
          }
        >
          {suppliers.length === 0 ? (
            <p className="rounded border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
              Aucun fournisseur au panel. Ajoutez-en un, ou dupliquez un projet existant pour
              reprendre son panel et ses conditions.
            </p>
          ) : (
            <div className="space-y-2">
              {suppliers.map((entry) => (
                <SupplierCard
                  key={entry.id}
                  entry={entry}
                  open={openIds.has(entry.id)}
                  onToggle={() =>
                    setOpenIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(entry.id)) next.delete(entry.id);
                      else next.add(entry.id);
                      return next;
                    })
                  }
                  onChange={(next) =>
                    setData((d) =>
                      d
                        ? { ...d, suppliers: d.suppliers.map((s) => (s.id === next.id ? next : s)) }
                        : d,
                    )
                  }
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── 5 à 7 : analyse. Tout est dérivé de la saisie ci-dessus. ── */}
        <PriceGrid result={result} />
        <Comparison result={result} />
        <Dashboard result={result} />
      </div>
    </div>
  );
}
