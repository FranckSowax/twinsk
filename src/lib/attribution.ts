// Attribution marketing — rattache un lead à la campagne qui l'a amené.
// Capture côté client (cookie `tw_attr`), lecture côté serveur dans les routes API.
// Modèle first-touch + last-touch : on garde la source d'origine ET la dernière.

export const ATTRIBUTION_COOKIE = 'tw_attr';
export const ATTRIBUTION_MAX_AGE_DAYS = 90;

/** Paramètres d'URL retenus. Les click ids servent au rapprochement plateforme. */
export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

export const CLICK_ID_KEYS = ['fbclid', 'gclid', 'ttclid'] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type ClickIdKey = (typeof CLICK_ID_KEYS)[number];

/** Une prise de contact : d'où vient le visiteur, et quand. */
export interface TouchPoint {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  referrer?: string;
  landing_path?: string;
  at: string; // ISO
}

export interface Attribution {
  first: TouchPoint;
  last: TouchPoint;
}

/** Valeur bornée : évite qu'une URL forgée ne gonfle le cookie ou la base. */
const MAX_VALUE_LENGTH = 200;

function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
  return trimmed || undefined;
}

/**
 * Construit un point de contact depuis une query string.
 * Retourne null si aucun signal marketing n'est présent (visite directe) —
 * on n'écrase alors pas une attribution déjà connue.
 */
export function parseTouchPoint(
  search: string,
  opts: { referrer?: string; path?: string; now?: Date } = {},
): TouchPoint | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const touch: TouchPoint = { at: (opts.now ?? new Date()).toISOString() };

  let hasSignal = false;
  for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
    const value = clean(params.get(key));
    if (value) {
      touch[key] = value;
      hasSignal = true;
    }
  }

  // Un referrer externe est un signal en soi (ex. lien partagé dans un groupe WhatsApp).
  const referrer = clean(opts.referrer);
  if (referrer) {
    touch.referrer = referrer;
    hasSignal = true;
  }

  if (!hasSignal) return null;

  const path = clean(opts.path);
  if (path) touch.landing_path = path;
  return touch;
}

/** Fusionne un nouveau contact dans l'attribution existante (first figé, last remplacé). */
export function mergeAttribution(
  existing: Attribution | null,
  touch: TouchPoint,
): Attribution {
  if (!existing) return { first: touch, last: touch };
  return { first: existing.first, last: touch };
}

export function serializeAttribution(attribution: Attribution): string {
  return encodeURIComponent(JSON.stringify(attribution));
}

/** Tolérant aux cookies corrompus ou d'une version antérieure : renvoie null. */
export function deserializeAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<Attribution>;
    if (!candidate.first?.at || !candidate.last?.at) return null;
    return { first: candidate.first as TouchPoint, last: candidate.last as TouchPoint };
  } catch {
    return null;
  }
}

/** Libellé court pour l'admin : « meta · omg-communaute » ou « direct ». */
export function describeTouchPoint(touch: TouchPoint | null | undefined): string {
  if (!touch) return 'direct';
  const source = touch.utm_source || (touch.fbclid ? 'meta' : undefined);
  const campaign = touch.utm_campaign;
  if (source && campaign) return `${source} · ${campaign}`;
  if (source) return source;
  if (touch.referrer) {
    try {
      return new URL(touch.referrer).hostname;
    } catch {
      return touch.referrer;
    }
  }
  return 'direct';
}
