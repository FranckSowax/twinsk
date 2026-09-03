// Plan de publication d'un listing vers le catalogue WhatsApp Business.
//
// Règle métier (décision du 2 sept. 2026) : le catalogue est une VITRINE, pas un
// miroir des listings — WhatsApp plafonne à 500 fiches pour tout le catalogue.
//   - une COLLECTION par phase, nommée du titre de la phase ;
//   - dans chaque phase, le PREMIER produit éligible de chaque catégorie
//     (les catégories sont déjà « classées par taux de réachat » : le premier
//     est le meilleur) ;
//   - une fiche par produit, jamais par variante — la fiche affiche le prix
//     « à partir de » et renvoie vers la page listing où sont les variantes.
// Sans phases : une seule collection au nom du listing, même règle par catégorie.
//
// Module pur (aucun appel réseau) : c'est lui qu'on teste.

import type { PublicOfferData } from '@/lib/offer-public-fetch';
import type { WhapiProductInput } from '@/lib/whapi';
import { FX_RATES, roundXafUp } from '@/lib/utils/formatCurrency';

/** WhatsApp accepte jusqu'à 10 images par fiche ; on reste prudent. */
export const MAX_IMAGES = 8;
/** Meta rejette au-delà (« Product Title Is Too Long ») : titre court, coupé sur un mot. */
export const PRODUCT_NAME_MAX = 60;
/** Longueur max d'un nom de collection côté WhatsApp. */
export const COLLECTION_NAME_MAX = 60;
/** Groupe de repli pour les catégories sans phase dans un listing phasé. */
const NO_PHASE_KEY = '';

// Les prix du listing sont en CNY **marge déjà appliquée** (cf. offer-public-fetch).
// Le catalogue est vu par des clients au Gabon → FCFA, arrondis comme la page listing.
const toFcfa = (cny: number) => roundXafUp(cny * FX_RATES.XAF);

type Item = PublicOfferData['items'][number];
type Product = Item['products'][number];

export interface PlanEntry {
  /** Clé de synchro (= offer_products.id, aussi product_retailer_id côté WhatsApp). */
  key: string;
  categoryId: string;
  input: WhapiProductInput;
}

export interface PlanCollection {
  /** Clé stable de la collection : id de phase, ou id du listing sans phases. */
  key: string;
  name: string;
  /** Catégories ayant fourni au moins une fiche. */
  categories: number;
  entries: PlanEntry[];
}

export interface CatalogPlan {
  groupedBy: 'phase' | 'listing';
  collections: PlanCollection[];
  /** Produits écartés (sur devis, prix nul, sans image) ou au-delà du quota par catégorie. */
  skipped: number;
  totalFiches: number;
}

export interface PlanOptions {
  /** URL publique du listing — cible du bouton « Voir » de chaque fiche. */
  offerUrl: string;
  currency?: string;
  /** Fiches retenues par catégorie (défaut 1 = le premier produit). */
  perCategory?: number;
  /** Restreint aux groupes cochés (ids de phases, ou id du listing). null = tout. */
  groupIds?: Set<string> | null;
}

/** Une fiche WhatsApp exige un prix affiché et une image. */
export function isEligible(p: Product): boolean {
  return !p.on_quote && p.from_price > 0 && !!p.image_url;
}

/** Coupe un titre à la limite Meta, sur une frontière de mot quand c'est possible. */
export function shortProductName(title: string, max = PRODUCT_NAME_MAX): string {
  const t = title.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const atWord = cut.lastIndexOf(' ');
  return (atWord > max * 0.6 ? cut.slice(0, atWord) : cut).replace(/[\s,;:—–-]+$/, '');
}

/**
 * Galerie sans doublon : Meta refuse deux fois la même image sur une fiche
 * (« Duplicate Media Added »). L'image principale reste en tête.
 */
export function uniqueGallery(p: Pick<Product, 'image_url' | 'gallery'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of [p.image_url, ...p.gallery]) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

/** Fiche WhatsApp d'un produit : galerie complète, prix « à partir de » en FCFA. */
export function toProductInput(p: Product, offerUrl: string, currency: string): WhapiProductInput {
  const gallery = uniqueGallery(p);
  return {
    name: shortProductName(p.title),
    description: (p.description || p.title).slice(0, 280),
    price: toFcfa(p.from_price),
    currency,
    images: gallery,
    url: `${offerUrl}?p=${encodeURIComponent(p.id)}`, // bouton « Voir » → la fiche du produit
    retailerId: p.id,
  };
}

function collectionName(raw: string | null | undefined, fallback: string): string {
  return (raw?.trim() || fallback).slice(0, COLLECTION_NAME_MAX);
}

export function buildCatalogPlan(data: PublicOfferData, opts: PlanOptions): CatalogPlan {
  const currency = opts.currency || 'XAF';
  const perCategory = Math.max(1, opts.perCategory ?? 1);
  const groupedBy: CatalogPlan['groupedBy'] = data.phases.length ? 'phase' : 'listing';
  const phaseTitles = new Map(data.phases.map((ph) => [ph.id, ph.title]));

  const collections = new Map<string, PlanCollection>();
  const seenProducts = new Set<string>();
  let skipped = 0;

  for (const item of data.items) {
    const key = groupedBy === 'phase' ? item.phase_id || NO_PHASE_KEY : data.offer.id;
    if (opts.groupIds && !opts.groupIds.has(key)) continue;

    const eligible = item.products.filter(isEligible);
    const picks = eligible.slice(0, perCategory);
    skipped += item.products.length - picks.length;
    if (!picks.length) continue; // catégorie sans fiche publiable : n'existe pas au catalogue

    let coll = collections.get(key);
    if (!coll) {
      const name =
        groupedBy === 'phase'
          ? collectionName(phaseTitles.get(key), 'Sans phase')
          : collectionName(data.offer.title, 'Catalogue');
      coll = { key, name, categories: 0, entries: [] };
      collections.set(key, coll);
    }

    let added = 0;
    for (const p of picks) {
      if (seenProducts.has(p.id)) continue; // même produit dans deux catégories : une seule fiche
      seenProducts.add(p.id);
      coll.entries.push({ key: p.id, categoryId: item.id, input: toProductInput(p, opts.offerUrl, currency) });
      added += 1;
    }
    if (added) coll.categories += 1;
  }

  const list = [...collections.values()];
  return {
    groupedBy,
    collections: list,
    skipped,
    totalFiches: list.reduce((n, c) => n + c.entries.length, 0),
  };
}
