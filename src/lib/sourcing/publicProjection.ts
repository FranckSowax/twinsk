/**
 * Projection publique d'un projet de sourcing — section la plus sensible du module.
 *
 * Le cockpit contient des prix d'achat, des coûts d'outillage, des extraits de
 * registres d'entreprises et des coordonnées fournisseurs. RIEN de tout cela ne
 * doit sortir par un lien de partage.
 *
 * RÈGLE DE CONSTRUCTION, non négociable : la sortie est bâtie CHAMP PAR CHAMP,
 * nommément. Sont interdits dans ce fichier :
 *   - l'opérateur de décomposition sur un objet fournisseur, devis ou projet ;
 *   - JSON.parse(JSON.stringify(...)) ;
 *   - toute fonction du type omit(supplier, ['price']).
 * Une liste blanche se relit d'un coup d'œil ; une liste noire laisse passer la
 * colonne que quelqu'un ajoutera dans six mois.
 *
 * publicProjection.test.ts échoue si un champ interdit réapparaît en sortie.
 */

import { computeProject, type ComputedRow, type SupplierWithQuote } from './compute';
import { DEFAULT_PARAMS, DEFAULT_WEIGHTS } from './defaults';
import type { ProjectStatus, SourcingCondition, SourcingProject, SupplierTrack } from './types';

export interface PublicRankingEntry {
  /** « Fournisseur A », « Fournisseur B »… attribué par rang de score. */
  alias: string;
  rank: number;
  score: number;
  /** Masqué si ce fournisseur est le seul de son pays : ce serait l'identifier. */
  country: string | null;
  track: SupplierTrack | null;
  /**
   * Notes de critère sur 100. Nommées pour qu'aucune ne puisse être confondue
   * avec la donnée brute dont elle dérive : moqFit est une compatibilité, pas
   * un MOQ en unités.
   */
  scores: {
    twist: number | null;
    conformity: number | null;
    cost: number | null;
    moqFit: number | null;
    lead: number | null;
  };
  /** Écart au moins-disant, en %. Jamais une valeur monétaire. 0 = le moins cher. */
  costPremiumPct: number | null;
}

export interface PublicProjection {
  project: {
    title: string;
    client: string | null;
    status: ProjectStatus;
    updated_at: string;
  };
  spec: Array<{ label: string; value: string; tolerance: string }>;
  market: Array<{ title: string; body: string }>;
  kpis: {
    panelSize: number;
    consulted: number;
    replied: number;
    responseRate: number;
    provenTwistLock: number;
    quotedCount: number;
    /** Écart min → max en %, jamais les montants. */
    spreadPct: number | null;
  };
  ranking: PublicRankingEntry[];
  conditions: { total: number; applicable: number; lifted: number };
  decision: {
    answered: boolean;
    answer: string | null;
    date: string | null;
    rationale: string | null;
    /** Nommé seulement si le lien a été créé avec reveal_winner. */
    winner: string | null;
  } | null;
}

interface SpecRowShape {
  label?: unknown;
  value?: unknown;
  tolerance?: unknown;
}
interface MarketBlockShape {
  title?: unknown;
  body?: unknown;
}
interface DecisionShape {
  answer?: unknown;
  date?: unknown;
  rationale?: unknown;
  winner?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

export interface ProjectionInput {
  project: SourcingProject;
  entries: SupplierWithQuote[];
  conditions: SourcingCondition[];
  /** Coché explicitement à la création du lien. Faux par défaut. */
  revealWinner?: boolean;
}

export function toPublicProjection({
  project,
  entries,
  conditions,
  revealWinner = false,
}: ProjectionInput): PublicProjection {
  const result = computeProject({
    params: project.params ?? DEFAULT_PARAMS,
    weights: project.weights ?? DEFAULT_WEIGHTS,
    entries,
  });

  // Seuls les fournisseurs notés apparaissent : un fournisseur en attente de
  // réponse n'a pas de rang, et le faire figurer trahirait la taille du panel.
  const ranked: ComputedRow[] = result.ranked;

  // Un pays représenté par un seul fournisseur du classement l'identifie :
  // on le masque, alors qu'un pays partagé reste une information de stratégie.
  const countryCount = new Map<string, number>();
  for (const r of ranked) {
    const c = r.supplier.country;
    if (c) countryCount.set(c, (countryCount.get(c) ?? 0) + 1);
  }

  const bestCost = result.withCost.length ? result.withCost[0].landed!.costPerSet : null;

  const ranking: PublicRankingEntry[] = ranked.map((r, i) => {
    const country = r.supplier.country;
    const cost = r.landed?.costPerSet ?? null;
    return {
      alias: `Fournisseur ${String.fromCharCode(65 + i)}`,
      rank: r.rank ?? i + 1,
      score: Math.round(r.score!),
      country: country && (countryCount.get(country) ?? 0) > 1 ? country : null,
      track: r.supplier.track,
      scores: {
        twist: r.twist,
        conformity: r.conf,
        cost: r.nCost == null ? null : Math.round(r.nCost),
        moqFit: r.nMoq,
        lead: r.nLead == null ? null : Math.round(r.nLead),
        // La note « solidité » vaut exactement le champ solidity, que le cahier
        // des charges du partage interdit de publier. Elle est donc omise, et le
        // score reste la seule synthèse visible de ce critère.
      },
      costPremiumPct:
        cost != null && bestCost != null ? Math.round((cost / bestCost - 1) * 100) : null,
    };
  });

  const specRows = (project.spec as { rows?: SpecRowShape[] } | null)?.rows ?? [];
  const marketBlocks =
    (project.market_finding as { blocks?: MarketBlockShape[] } | null)?.blocks ?? [];

  const decisionSource = (project.decision ?? {}) as DecisionShape;
  const answer = strOrNull(decisionSource.answer);
  const rationale = strOrNull(decisionSource.rationale);
  const decisionDate = strOrNull(decisionSource.date);
  const hasDecision = !!(answer || rationale || decisionDate);

  const applicable = conditions.filter((c) => c.state !== 'na').length;

  return {
    project: {
      title: project.title,
      client: project.client,
      status: project.status,
      updated_at: project.updated_at,
    },

    // Le cahier des charges est la spécification du produit, pas un secret.
    spec: specRows.map((row) => ({
      label: str(row.label),
      value: str(row.value),
      tolerance: str(row.tolerance),
    })),

    market: marketBlocks.map((b) => ({ title: str(b.title), body: str(b.body) })),

    kpis: {
      panelSize: result.kpis.activeCount,
      consulted: result.kpis.consulted,
      replied: result.kpis.replied,
      responseRate: Math.round(result.kpis.responseRate),
      provenTwistLock: result.kpis.provenTwistLock,
      quotedCount: result.kpis.quotedCount,
      spreadPct: result.kpis.spreadPct == null ? null : Math.round(result.kpis.spreadPct),
      // bestCostPerSet est délibérément absent : c'est une valeur monétaire absolue.
    },

    ranking,

    conditions: {
      total: conditions.length,
      applicable,
      lifted: conditions.filter((c) => c.state === 'oui').length,
    },

    decision: hasDecision
      ? {
          answered: true,
          answer,
          date: decisionDate,
          rationale,
          winner: revealWinner ? strOrNull(decisionSource.winner) : null,
        }
      : null,
  };
}
