// Tableau de bord « Activité » (29 sept. 2026) : catalogue, WhatsApp (volume,
// temps de réponse, heures de pointe, origine), entonnoir de vente et tableau
// par listing. Module pur : la route /api/admin/stats/activity lit les données
// et appelle ces fonctions (testées).

export type Period = '7' | '30' | '90' | 'all';
export const PERIODS: { key: Period; label: string }[] = [
  { key: '7', label: '7 j' },
  { key: '30', label: '30 j' },
  { key: '90', label: '90 j' },
  { key: 'all', label: 'Tout' },
];

export function parsePeriod(v: string | null | undefined): Period {
  return v === '7' || v === '90' || v === 'all' ? v : '30';
}

/** Début de la période (ISO), null pour « tout ». */
export function periodStart(p: Period, now: Date = new Date()): string | null {
  if (p === 'all') return null;
  return new Date(now.getTime() - Number(p) * 86_400_000).toISOString();
}

/** Graphiques par jour jusqu'à 30 j, par semaine au-delà. */
export function bucketUnit(p: Period): 'day' | 'week' {
  return p === '7' || p === '30' ? 'day' : 'week';
}

// ---- Dates dans le fuseau du pays ----
function parts(iso: string, tz: string): { y: number; m: number; d: number; h: number; wd: number } {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(iso))) o[p.type] = p.value;
  const wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(o.weekday);
  return { y: Number(o.year), m: Number(o.month), d: Number(o.day), h: Number(o.hour) % 24, wd };
}
/** Clé du jour (AAAA-MM-JJ) ou du lundi de la semaine, dans le fuseau du pays. */
export function bucketKey(iso: string, unit: 'day' | 'week', tz: string): string {
  const p = parts(iso, tz);
  const day = new Date(Date.UTC(p.y, p.m - 1, p.d));
  if (unit === 'week') day.setUTCDate(day.getUTCDate() - p.wd);
  return day.toISOString().slice(0, 10);
}
/** Toutes les clés de la période (pour des graphiques sans trou). */
export function bucketKeys(fromIso: string, toIso: string, unit: 'day' | 'week', tz: string): string[] {
  const out: string[] = [];
  const start = bucketKey(fromIso, unit, tz);
  const end = bucketKey(toIso, unit, tz);
  const step = unit === 'week' ? 7 : 1;
  for (let d = new Date(`${start}T00:00:00Z`); d.toISOString().slice(0, 10) <= end && out.length < 400; d.setUTCDate(d.getUTCDate() + step)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
export function bucketLabel(key: string, unit: 'day' | 'week'): string {
  const d = new Date(`${key}T00:00:00Z`);
  const s = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return unit === 'week' ? `sem. ${s}` : s;
}

// ---- Temps de réponse WhatsApp ----
export interface ActivityMessage {
  conversation_id: string;
  from_me: boolean;
  sent_at: string;
  sent_by: string | null;
  sender_name: string | null;
}

export interface ResponseSample {
  conversation_id: string;
  asked: string;
  answered: string | null;
  minutes: number | null;
  responder: string | null;
}

/** Qui a répondu : admin, collaborateur / agent (nom), ou réponse depuis le téléphone. */
export function responderLabel(m: Pick<ActivityMessage, 'sent_by' | 'sender_name'>): string {
  if (m.sent_by === 'admin') return 'Admin';
  if (m.sent_by) return m.sender_name || 'Équipe';
  return 'Téléphone';
}

/**
 * Une « demande » = le premier message client d'une rafale (début de
 * conversation ou premier message après notre réponse). Sa réponse = notre
 * premier message qui suit. Les messages sont comptés 24 h/24.
 */
export function responseSamples(messages: ActivityMessage[]): ResponseSample[] {
  const byConv = new Map<string, ActivityMessage[]>();
  for (const m of messages) byConv.set(m.conversation_id, [...(byConv.get(m.conversation_id) || []), m]);
  const out: ResponseSample[] = [];
  for (const [conv, list] of byConv) {
    const sorted = [...list].sort((a, b) => a.sent_at.localeCompare(b.sent_at));
    let pending: ActivityMessage | null = null;
    let prevMine: boolean | null = null;
    for (const m of sorted) {
      if (!m.from_me) {
        if (prevMine === null || prevMine) pending = m;
      } else if (pending) {
        const minutes = (new Date(m.sent_at).getTime() - new Date(pending.sent_at).getTime()) / 60_000;
        out.push({ conversation_id: conv, asked: pending.sent_at, answered: m.sent_at, minutes, responder: responderLabel(m) });
        pending = null;
      }
      prevMine = m.from_me;
    }
    if (pending) out.push({ conversation_id: conv, asked: pending.sent_at, answered: null, minutes: null, responder: null });
  }
  return out;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface ResponseSummary {
  requests: number;
  answered: number;
  unanswered: number;
  medianMinutes: number | null;
  meanMinutes: number | null;
  within15: number | null; // part (0-1) des réponses en moins de 15 min
  within60: number | null;
}
export function summarizeResponses(samples: ResponseSample[]): ResponseSummary {
  const mins = samples.map((s) => s.minutes).filter((v): v is number => v != null);
  return {
    requests: samples.length,
    answered: mins.length,
    unanswered: samples.length - mins.length,
    medianMinutes: median(mins),
    meanMinutes: mins.length ? mins.reduce((a, b) => a + b, 0) / mins.length : null,
    within15: mins.length ? mins.filter((v) => v <= 15).length / mins.length : null,
    within60: mins.length ? mins.filter((v) => v <= 60).length / mins.length : null,
  };
}

/** Réponses par personne : nombre et médiane. */
export function responsesByPerson(samples: ResponseSample[]): { name: string; answered: number; medianMinutes: number | null }[] {
  const m = new Map<string, number[]>();
  for (const s of samples) if (s.responder && s.minutes != null) m.set(s.responder, [...(m.get(s.responder) || []), s.minutes]);
  return [...m.entries()].map(([name, v]) => ({ name, answered: v.length, medianMinutes: median(v) })).sort((a, b) => b.answered - a.answered);
}

/** Carte jour × heure des messages clients (lundi = 0), dans le fuseau du pays. */
export function heatmap(inboundIso: string[], tz: string): number[][] {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const iso of inboundIso) {
    const p = parts(iso, tz);
    if (p.wd >= 0) grid[p.wd][p.h] += 1;
  }
  return grid;
}

// ---- Rattachement conversation → listing ----
const LISTING_RE = /\/offer\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
export function listingIdIn(text: string | null | undefined): string | null {
  const m = (text || '').match(LISTING_RE);
  return m ? m[1].toLowerCase() : null;
}

export interface ConversationOrigin {
  /** Listing rattaché (lien dans la pub, sinon premier lien de listing de la conversation). */
  listingId: string | null;
  /** Titre de la pub quand elle ne contient pas de lien de listing. */
  adTitle: string | null;
  fromAd: boolean;
}
/**
 * Origine d'une conversation : la pub (son texte contient souvent le lien du
 * listing), sinon le premier lien de listing échangé dans la conversation.
 */
export function conversationOrigin(args: { adBodies: string[]; adTitle: string | null; fromAd: boolean; linkTexts: string[] }): ConversationOrigin {
  for (const b of args.adBodies) {
    const id = listingIdIn(b);
    if (id) return { listingId: id, adTitle: args.adTitle, fromAd: true };
  }
  for (const t of args.linkTexts) {
    const id = listingIdIn(t);
    if (id) return { listingId: id, adTitle: args.adTitle, fromAd: args.fromAd };
  }
  return { listingId: null, adTitle: args.adTitle, fromAd: args.fromAd };
}

// ---- Entonnoir ----
export interface FunnelOrder {
  transport_mode: string | null;
  payment_status: string | null;
}
export function funnel(conversations: number, orders: FunnelOrder[]): { key: string; label: string; value: number }[] {
  return [
    { key: 'conversations', label: 'Conversations WhatsApp', value: conversations },
    { key: 'carts', label: 'Paniers créés', value: orders.length },
    { key: 'transport', label: 'Transport choisi', value: orders.filter((o) => !!o.transport_mode).length },
    { key: 'engaged', label: 'Paiement engagé', value: orders.filter((o) => o.payment_status === 'submitted' || o.payment_status === 'paid').length },
    { key: 'paid', label: 'Payés', value: orders.filter((o) => o.payment_status === 'paid').length },
  ];
}
