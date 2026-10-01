// Notifications de l'onglet « Projets » : les événements marqués `notify`
// (project_events) sont envoyés par lots — au client sur WhatsApp (s'il a un
// numéro), à l'équipe sur Telegram — puis marqués. Rappel « mise à jour du
// jour non publiée » un jour ouvré sur deux passages du matin. Partie pure
// (textes) testée ; envois best-effort, jamais bloquants.

import { supabaseAdmin } from '@/lib/supabase/server';
import { COUNTRY } from '@/config/countries';
import { sendTelegramMessage } from '@/lib/telegram';
import { sendWhapiText } from '@/lib/whapi';
import { resolveWhatsappChatId } from '@/lib/whatsapp-number';
import { missingDailyUpdate, isBusinessDay } from './logic';

export interface PendingEvent {
  id: string;
  project_id: string;
  type: string;
  actor_name: string | null;
  detail: string | null;
  notify: 'client' | 'team';
}

const LABELS: Record<string, string> = {
  'update.published': 'Nouvelle mise à jour',
  'update.comment': 'Commentaire sur une mise à jour',
  'question.replied': 'Réponse à une question',
  'question.asked': 'Nouvelle question du client',
  'question.to_client': 'Question de l’équipe : votre réponse est attendue',
  'task.done': 'Tâche terminée',
  'task.reopened': 'Tâche rouverte',
  'task.comment': 'Commentaire sur une tâche',
  'task.created': 'Nouvelle tâche',
  'quote.line_added': 'Nouvelle ligne au devis',
  'quote.line_validated': 'Ligne de devis validée',
  'quote.line_unvalidated': 'Validation annulée',
  'order.created': 'Commande émise',
  'order.status': 'Commande : nouveau statut',
  'phase.received': 'Phase réceptionnée',
  'phase.reopened': 'Phase rouverte',
  'report.delivered': 'Rapport final remis',
  'supplier.selected': 'Usine retenue pour un lot',
  'fx.currency': 'Devise du devis changée',
  'offer.published': 'Nouvelle offre de prix à comparer',
  'offer.interest': 'Le client s’intéresse à une offre',
  'document.uploaded': 'Document déposé',
  'trip.interested': 'Intérêt pour le voyage d’audit',
  'trip.quote_requested': 'Devis du voyage demandé',
  'journal.missing': 'Mise à jour du jour non publiée',
};
export function eventLabel(type: string): string {
  return LABELS[type] || type;
}

/** Message WhatsApp au client : nouveautés groupées d'un projet, avec le lien s'il existe. */
export function buildClientMessage(projectTitle: string, events: Pick<PendingEvent, 'type' | 'detail'>[], link: string | null): string {
  const lines = events.slice(0, 8).map((e) => `• ${eventLabel(e.type)}${e.detail ? ` : ${e.detail.slice(0, 90)}` : ''}`);
  const more = events.length > 8 ? `\n• … et ${events.length - 8} autre(s)` : '';
  return `📁 *${projectTitle}* — ${COUNTRY.senderName}\n\n${lines.join('\n')}${more}${link ? `\n\n👉 Votre espace projet : ${link}` : ''}`;
}
/** Message Telegram à l'équipe (HTML). */
export function buildTeamMessage(projectTitle: string, events: Pick<PendingEvent, 'type' | 'detail' | 'actor_name'>[], adminLink: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = events.slice(0, 10).map((e) => `• <b>${esc(eventLabel(e.type))}</b>${e.actor_name ? ` — ${esc(e.actor_name)}` : ''}${e.detail ? ` : ${esc(e.detail.slice(0, 120))}` : ''}`);
  return `📁 <b>${esc(projectTitle)}</b>\n${lines.join('\n')}${events.length > 10 ? `\n• … et ${events.length - 10} autre(s)` : ''}\n<a href="${adminLink}">Ouvrir le projet</a>`;
}

/** Envoie les notifications en attente ; renvoie ce qui a été fait. */
export async function dispatchProjectNotifications(origin: string): Promise<{ client: number; team: number; skipped: number; errors: string[] }> {
  const out = { client: 0, team: 0, skipped: 0, errors: [] as string[] };
  const { data, error } = await supabaseAdmin.from('project_events').select('id, project_id, type, actor_name, detail, notify').not('notify', 'is', null).is('notified_at', null).order('created_at').limit(200);
  if (error) {
    out.errors.push(/does not exist|schema cache/i.test(error.message) ? 'Migration « projects » non appliquée' : error.message);
    return out;
  }
  const events = (data || []) as PendingEvent[];
  if (!events.length) return out;
  const projectIds = [...new Set(events.map((e) => e.project_id))];
  const [{ data: projects }, { data: shares }] = await Promise.all([
    supabaseAdmin.from('projects').select('id, title, client_phone, status').in('id', projectIds),
    supabaseAdmin.from('project_shares').select('project_id, token, created_at').in('project_id', projectIds).is('revoked_at', null).order('created_at', { ascending: false }),
  ]);
  const byProject = new Map(((projects || []) as { id: string; title: string; client_phone: string | null; status: string }[]).map((p) => [p.id, p]));
  const linkOf = new Map<string, string>();
  for (const s of (shares || []) as { project_id: string; token: string }[]) if (!linkOf.has(s.project_id)) linkOf.set(s.project_id, `${origin}/projet/${s.token}`);

  for (const pid of projectIds) {
    const p = byProject.get(pid);
    const mine = events.filter((e) => e.project_id === pid);
    if (!p) {
      await markNotified(mine.map((e) => e.id));
      out.skipped += mine.length;
      continue;
    }
    const toClient = mine.filter((e) => e.notify === 'client');
    const toTeam = mine.filter((e) => e.notify === 'team');
    if (toClient.length) {
      const chat = p.client_phone ? await resolveWhatsappChatId(p.client_phone) : null;
      if (chat) {
        const r = await sendWhapiText(buildClientMessage(p.title, toClient, linkOf.get(pid) || null), chat);
        if (r.ok) out.client += toClient.length;
        else out.errors.push(`WhatsApp ${p.title} : ${r.error}`);
      } else out.skipped += toClient.length;
      await markNotified(toClient.map((e) => e.id));
    }
    if (toTeam.length) {
      const ok = await sendTelegramMessage(buildTeamMessage(p.title, toTeam, `${origin}/admin/projets/${pid}`));
      if (ok) out.team += toTeam.length;
      else out.skipped += toTeam.length;
      await markNotified(toTeam.map((e) => e.id));
    }
  }
  return out;
}
async function markNotified(ids: string[]) {
  if (ids.length) await supabaseAdmin.from('project_events').update({ notified_at: new Date().toISOString() }).in('id', ids);
}

/**
 * Rappel équipe : projets actifs sans mise à jour publiée le dernier jour
 * ouvré. Une fois par jour et par projet (événement `journal.missing`).
 */
export async function remindMissingUpdates(origin: string, now: Date = new Date()): Promise<{ reminded: string[] }> {
  const tz = COUNTRY.timezone;
  const reminded: string[] = [];
  if (!isBusinessDay(now, tz)) return { reminded };
  const today = now.toLocaleDateString('en-CA', { timeZone: tz });
  const { data: projects } = await supabaseAdmin.from('projects').select('id, title').eq('status', 'active');
  for (const p of (projects || []) as { id: string; title: string }[]) {
    const since = new Date(now.getTime() - 5 * 86_400_000).toISOString();
    const [{ data: updates }, { data: already }] = await Promise.all([
      supabaseAdmin.from('project_updates').select('published_at').eq('project_id', p.id).gte('published_at', since),
      supabaseAdmin.from('project_events').select('id, created_at').eq('project_id', p.id).eq('type', 'journal.missing').gte('created_at', new Date(now.getTime() - 86_400_000).toISOString()),
    ]);
    const doneToday = ((already || []) as { created_at: string }[]).some((e) => new Date(e.created_at).toLocaleDateString('en-CA', { timeZone: tz }) === today);
    if (doneToday) continue;
    if (!missingDailyUpdate(((updates || []) as { published_at: string }[]).map((u) => u.published_at), now, tz)) continue;
    await supabaseAdmin.from('project_events').insert({ project_id: p.id, type: 'journal.missing', actor: 'system', actor_name: 'Rappel', detail: 'Aucune mise à jour publiée le dernier jour ouvré', notify: 'team' });
    reminded.push(p.title);
  }
  if (reminded.length) await dispatchProjectNotifications(origin);
  return { reminded };
}
