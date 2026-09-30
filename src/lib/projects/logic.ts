// Onglet « Projets » : logique pure, testée (aucun accès base ni réseau).
// Plan généré depuis un modèle, échéances, verrouillage des phases,
// progression, règles de validation des tâches, devis (totaux, validation
// ligne par ligne), stepper des commandes, jours ouvrés du journal.

import type { ChecklistItem, OrderStatus, Phase, ProjectTemplate, QuoteLineStatus, StepTemplate, TaskOwner, TaskStatus } from './types';
import { ORDER_STEPS } from './types';

// ---- Plan d'action ----
export interface PlannedTask {
  key: string;
  step_key: string;
  title: string;
  description: string;
  owner: TaskOwner;
  phase: string | null;
  due_weeks: number;
  due_at: string;
  checklist: ChecklistItem[];
  position: number;
}
export interface PlannedStep {
  key: string;
  title: string;
  description: string;
  position: number;
}

const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();

/** Échéance absolue d'une tâche : lancement + semaines. */
export function dueDate(startIso: string, dueWeeks: number): string {
  return addDays(startIso, dueWeeks * 7);
}

/** Étapes et tâches d'un projet créé depuis un modèle, échéances calculées depuis le lancement. */
export function buildPlan(template: ProjectTemplate, startIso: string): { steps: PlannedStep[]; tasks: PlannedTask[] } {
  const steps: PlannedStep[] = [];
  const tasks: PlannedTask[] = [];
  template.steps.forEach((s: StepTemplate, si) => {
    steps.push({ key: s.key, title: s.title, description: s.description, position: si });
    s.tasks.forEach((t, ti) => {
      tasks.push({
        key: t.key,
        step_key: s.key,
        title: t.title,
        description: t.description,
        owner: t.owner,
        phase: t.phase,
        due_weeks: t.due_weeks,
        due_at: dueDate(startIso, t.due_weeks),
        checklist: t.checklist.map((label, i) => ({ id: `${t.key}-${i + 1}`, label, done: false })),
        position: ti,
      });
    });
  });
  return { steps, tasks };
}

/** Phases initiales d'un projet (aucune réceptionnée). */
export function initialPhases(template: ProjectTemplate): Phase[] {
  return template.phases.map((p) => ({ ...p, received_at: null }));
}

/**
 * Une phase est verrouillée tant que la phase précédente n'est pas réceptionnée.
 * Les tâches communes (phase null) ne sont jamais verrouillées.
 */
export function isPhaseLocked(phases: Phase[], phaseId: string | null): boolean {
  if (!phaseId) return false;
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((p) => p.id === phaseId);
  if (idx <= 0) return false;
  return sorted.slice(0, idx).some((p) => !p.received_at);
}

/**
 * Qui peut solder une tâche : une tâche « client » seulement par le client ;
 * une tâche « équipe » par l'équipe (le client peut la commenter, pas la clore).
 * Une tâche verrouillée ne se solde pas.
 */
export function canCompleteTask(task: { owner: TaskOwner; phase: string | null }, by: 'team' | 'client', phases: Phase[]): { ok: true } | { ok: false; reason: string } {
  if (isPhaseLocked(phases, task.phase)) return { ok: false, reason: 'Phase verrouillée tant que la phase précédente n’est pas réceptionnée.' };
  if (task.owner === 'client' && by !== 'client') return { ok: false, reason: 'Cette tâche de validation ne peut être soldée que par le client.' };
  if (task.owner === 'team' && by !== 'team') return { ok: false, reason: 'Cette tâche est à la charge de l’équipe.' };
  return { ok: true };
}

/** Progression (0-1) : part des tâches terminées, par étape et globale. */
export function progress(tasks: { step_key: string; status: TaskStatus }[]): { global: number; bySteps: Record<string, number> } {
  const by: Record<string, { done: number; total: number }> = {};
  let done = 0;
  for (const t of tasks) {
    const b = (by[t.step_key] ||= { done: 0, total: 0 });
    b.total += 1;
    if (t.status === 'done') {
      b.done += 1;
      done += 1;
    }
  }
  const bySteps: Record<string, number> = {};
  for (const [k, v] of Object.entries(by)) bySteps[k] = v.total ? v.done / v.total : 0;
  return { global: tasks.length ? done / tasks.length : 0, bySteps };
}

export function toggleChecklist(items: ChecklistItem[], id: string, done: boolean): ChecklistItem[] {
  return items.map((i) => (i.id === id ? { ...i, done } : i));
}

// ---- Devis ----
export interface QuoteLineLike {
  id: string;
  lot: string;
  quantity: number;
  client_quantity: number | null;
  unit_price: number | null;
  optional: boolean;
  enabled: boolean;
  status: QuoteLineStatus;
  phase: string | null;
}

/** Quantité effective : celle du client si elle est renseignée, sinon la proposée. */
export function effectiveQuantity(l: Pick<QuoteLineLike, 'quantity' | 'client_quantity'>): number {
  const q = l.client_quantity ?? l.quantity;
  return Number.isFinite(q) && q > 0 ? q : 0;
}
export function lineTotal(l: QuoteLineLike): number | null {
  if (l.unit_price == null) return null;
  if (l.optional && !l.enabled) return 0;
  return Math.round(effectiveQuantity(l) * l.unit_price * 100) / 100;
}

export interface QuoteTotals {
  /** Lignes validées ou commandées. */
  committed: number;
  /** Lignes chiffrées, actives, pas encore validées. */
  pending: number;
  /** Programme estimé : toutes les lignes actives chiffrées. */
  estimated: number;
  /** Lignes actives sans prix. */
  unpriced: number;
}
export function quoteTotals(lines: QuoteLineLike[]): QuoteTotals {
  const t: QuoteTotals = { committed: 0, pending: 0, estimated: 0, unpriced: 0 };
  for (const l of lines) {
    if (l.optional && !l.enabled) continue;
    const total = lineTotal(l);
    if (total == null) {
      t.unpriced += 1;
      continue;
    }
    t.estimated += total;
    if (l.status === 'draft') t.pending += total;
    else t.committed += total;
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { committed: r(t.committed), pending: r(t.pending), estimated: r(t.estimated), unpriced: t.unpriced };
}

/** Le client peut valider une ligne chiffrée, active, non verrouillée, encore en brouillon. */
export function canValidateLine(l: QuoteLineLike, phases: Phase[]): { ok: true } | { ok: false; reason: string } {
  if (l.status !== 'draft') return { ok: false, reason: 'Ligne déjà validée.' };
  if (l.unit_price == null) return { ok: false, reason: 'Ligne pas encore chiffrée.' };
  if (l.optional && !l.enabled) return { ok: false, reason: 'Option désactivée.' };
  if (effectiveQuantity(l) <= 0) return { ok: false, reason: 'Quantité nulle.' };
  if (isPhaseLocked(phases, l.phase)) return { ok: false, reason: 'Phase verrouillée.' };
  return { ok: true };
}
/** Annulation possible tant que la ligne n'est pas passée en commande. */
export function canUnvalidateLine(l: Pick<QuoteLineLike, 'status'>): boolean {
  return l.status === 'validated';
}

/** Regroupe les lignes par lot, dans l'ordre d'apparition. */
export function groupByLot<T extends { lot: string }>(lines: T[]): { lot: string; lines: T[] }[] {
  const out: { lot: string; lines: T[] }[] = [];
  for (const l of lines) {
    let g = out.find((x) => x.lot === l.lot);
    if (!g) out.push((g = { lot: l.lot, lines: [] }));
    g.lines.push(l);
  }
  return out;
}

// ---- Commandes ----
const ORDER_RANK = new Map(ORDER_STEPS.map((s, i) => [s.value, i]));
/** Transition permise : un pas en avant, ou un pas en arrière (correction), jamais de saut. */
export function canAdvanceOrder(from: OrderStatus, to: OrderStatus): boolean {
  const a = ORDER_RANK.get(from);
  const b = ORDER_RANK.get(to);
  if (a == null || b == null) return false;
  return b === a + 1 || b === a - 1;
}
export function nextOrderStatus(from: OrderStatus): OrderStatus | null {
  const a = ORDER_RANK.get(from);
  return a == null || a + 1 >= ORDER_STEPS.length ? null : ORDER_STEPS[a + 1].value;
}
export function orderStatusLabel(s: string): string {
  return ORDER_STEPS.find((x) => x.value === s)?.label || s;
}

// ---- Journal : jours ouvrés ----
/** Jour ouvré précédent (lundi à vendredi) dans le fuseau donné, clé AAAA-MM-JJ. */
export function previousBusinessDay(now: Date, tz: string): string {
  const key = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const weekday = (d: Date) => d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
  let d = new Date(now.getTime() - 86_400_000);
  while (['Sat', 'Sun'].includes(weekday(d))) d = new Date(d.getTime() - 86_400_000);
  return key(d);
}
export function isBusinessDay(now: Date, tz: string): boolean {
  return !['Sat', 'Sun'].includes(now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' }));
}
/** Vrai si aucune mise à jour n'a été publiée le dernier jour ouvré (rappel équipe). */
export function missingDailyUpdate(updateDates: string[], now: Date, tz: string): boolean {
  if (!isBusinessDay(now, tz)) return false;
  const target = previousBusinessDay(now, tz);
  return !updateDates.some((iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz }) === target);
}

/** Alias d'un fournisseur par rang dans son lot : A, B, C… */
export function supplierAlias(index: number): string {
  return `Fournisseur ${String.fromCharCode(65 + (index % 26))}`;
}
