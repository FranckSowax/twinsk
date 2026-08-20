// Helpers partagés par les routes /api/sourcing.
// Forme des réponses calquée sur /api/offers : { error: string } + code HTTP.

import { NextResponse } from 'next/server';
import { num } from './compute';

export function unauthorized() {
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
}

export function notFound(what = 'Ressource') {
  return NextResponse.json({ error: `${what} introuvable` }, { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Erreur de base. Le détail Supabase est journalisé côté serveur et ne part pas
 * au client : il expose noms de tables, de colonnes et contraintes.
 */
export function dbError(scope: string, error: unknown, message = 'Erreur serveur') {
  console.error(`[sourcing] ${scope}`, error);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Allowlist explicite : seuls les champs nommés sont repris du corps de requête. */
export function pickAllowed<T extends string>(
  body: unknown,
  allowed: readonly T[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!body || typeof body !== 'object') return out;
  const src = body as Record<string, unknown>;
  for (const key of allowed) {
    if (key in src) out[key] = src[key];
  }
  return out;
}

/**
 * Normalise les champs chiffrés d'un patch : une chaîne vide devient null, jamais 0.
 * L'absence de réponse et une réponse à zéro ne doivent jamais être confondues.
 */
export function normalizeNumeric(
  patch: Record<string, unknown>,
  numericFields: readonly string[],
): Record<string, unknown> {
  for (const key of numericFields) {
    if (key in patch) patch[key] = num(patch[key]);
  }
  return patch;
}

/** Chaîne vide -> null, pour ne pas stocker du vide à la place d'une absence. */
export function normalizeText(
  patch: Record<string, unknown>,
  textFields: readonly string[],
): Record<string, unknown> {
  for (const key of textFields) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (v == null) patch[key] = null;
    else if (typeof v === 'string') patch[key] = v.trim() || null;
  }
  return patch;
}

export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/["'’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'projet'
  );
}
