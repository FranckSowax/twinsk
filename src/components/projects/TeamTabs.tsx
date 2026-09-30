'use client';

// Onglets réservés à l'équipe : fournisseurs par lot (alias côté client,
// identité réelle ici) et suivi des échanges avec les usines (captures
// d'écran WeChat / WhatsApp, e-mails, appels) ; accès client (liens à jeton).
// Rapport final et voyage d'audit : partagés.

import { useState } from 'react';
import { Copy, Link2, Loader2, Plus, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import type { PublicProject } from '@/lib/projects/public';
import type { TeamExtras } from '@/lib/projects/public-server';
import { EXCHANGE_CHANNELS, type Attachment } from '@/lib/projects/types';
import { AttachButton, AttachmentList, Badge, Empty, Modal, btn, btnPrimary, card, dateShort, dateTime, input, label, type WorkspaceApi } from './shared';

export function SuppliersTab({ admin, api }: { admin: TeamExtras; api: WorkspaceApi }) {
  const [editing, setEditing] = useState<TeamExtras['suppliers'][number] | 'new' | null>(null);
  const [exchange, setExchange] = useState<string | null | false>(false); // supplier_id | null (sans fournisseur) | false (fermé)
  const [filter, setFilter] = useState('');
  const bySupplier = (id: string | null) => admin.exchanges.filter((e) => e.supplier_id === id);
  const shown = admin.exchanges.filter((e) => !filter || e.supplier_id === filter);
  const name = (id: string | null) => (id ? admin.suppliers.find((s) => s.id === id) : null);
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <ShieldAlert className="mr-1 inline h-4 w-4" /> Tout ce qui figure ici (noms d’usines, contacts, prix d’achat, captures d’échanges) est réservé à l’équipe. Le client ne voit que les alias « Fournisseur A, B… ».
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">Fournisseurs par lot</p>
          <button type="button" onClick={() => setEditing('new')} className={btn}><Plus className="h-3.5 w-3.5" /> Fournisseur</button>
        </div>
        {admin.suppliers.length === 0 ? (
          <Empty>Aucun fournisseur. Ajoutez-en un par lot : l’alias (A, B, C…) est attribué automatiquement.</Empty>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="pb-2 text-left font-semibold">Lot</th><th className="pb-2 text-left font-semibold">Alias (client)</th><th className="pb-2 text-left font-semibold">Usine réelle</th><th className="pb-2 text-left font-semibold">Contact</th><th className="pb-2 text-right font-semibold">Score /25</th><th className="pb-2 text-right font-semibold">Échanges</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {admin.suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-2">{s.lot}</td>
                  <td className="py-2 pr-2"><Badge tone="blue">{s.alias}</Badge></td>
                  <td className="py-2 pr-2 font-medium">{s.real_name || '—'}{s.country ? <span className="text-xs text-slate-500"> · {s.country}</span> : null}</td>
                  <td className="max-w-[12rem] truncate py-2 pr-2 text-xs text-slate-600" title={s.contact || ''}>{s.contact || '—'}</td>
                  <td className="py-2 text-right tabular-nums">{s.score ?? '—'}</td>
                  <td className="py-2 text-right tabular-nums">{bySupplier(s.id).length}</td>
                  <td className="py-2 text-right"><span className="inline-flex gap-1"><button type="button" onClick={() => setExchange(s.id)} className={btn}>+ Échange</button><button type="button" onClick={() => setEditing(s)} className={btn}>Modifier</button><button type="button" onClick={() => { if (confirm(`Retirer ${s.alias} (${s.real_name || s.lot}) ?`)) api.act('supplier.delete', { id: s.id }); }} className={btn}><Trash2 className="h-3.5 w-3.5 text-red-500" /></button></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-base font-bold text-slate-900 dark:text-white">Échanges avec les usines</p>
            <p className="text-xs text-slate-500">Captures d’écran de conversations (WeChat, WhatsApp), e-mails, comptes rendus d’appels : le fil de ce qui a été dit et promis.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className={input} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Tous les fournisseurs</option>{admin.suppliers.map((s) => <option key={s.id} value={s.id}>{s.alias} · {s.real_name || s.lot}</option>)}</select>
            <button type="button" onClick={() => setExchange(null)} className={btnPrimary}><Plus className="h-3.5 w-3.5" /> Nouvel échange</button>
          </div>
        </div>
        {shown.length === 0 ? (
          <Empty>Aucun échange enregistré.</Empty>
        ) : (
          <ul className="mt-3 space-y-3">
            {shown.map((e) => {
              const s = name(e.supplier_id);
              return (
                <li key={e.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone="slate">{EXCHANGE_CHANNELS.find((c) => c.value === e.channel)?.label || e.channel}</Badge>
                      {s ? <span className="font-semibold text-slate-800 dark:text-slate-100">{s.real_name || s.alias} <span className="font-normal text-slate-500">({s.alias} · {s.lot})</span></span> : <span>Sans fournisseur</span>}
                      <span>{dateTime(e.exchanged_at)}</span>
                      {e.author_name && <span>· {e.author_name}</span>}
                    </span>
                    <button type="button" onClick={() => { if (confirm('Supprimer cet échange ?')) api.act('exchange.delete', { id: e.id }); }} className="rounded p-1 text-red-500 hover:bg-red-50" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100">{e.summary}</p>
                  <AttachmentList items={e.attachments} />
                  {e.next_action && <p className="mt-2 text-xs"><span className="font-semibold text-amber-700">À faire :</span> {e.next_action}{e.next_action_at ? ` (${dateShort(e.next_action_at)})` : ''}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && <SupplierModal s={editing === 'new' ? null : editing} lots={admin.lots} api={api} onClose={() => setEditing(null)} />}
      {exchange !== false && <ExchangeModal supplierId={exchange} admin={admin} api={api} onClose={() => setExchange(false)} />}
    </div>
  );
}

function SupplierModal({ s, lots, api, onClose }: { s: TeamExtras['suppliers'][number] | null; lots: string[]; api: WorkspaceApi; onClose: () => void }) {
  const [f, setF] = useState({ lot: s?.lot || lots[0] || '', real_name: s?.real_name || '', contact: s?.contact || '', country: s?.country || '', score: s?.score == null ? '' : String(s.score), internal_note: s?.internal_note || '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <Modal title={s ? `${s.alias} — ${s.lot}` : 'Nouveau fournisseur'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Lot</label><input list="lots2" className={input} value={f.lot} onChange={(e) => setF({ ...f, lot: e.target.value })} /><datalist id="lots2">{lots.map((x) => <option key={x} value={x} />)}</datalist></div>
        <div><label className={label}>Pays / ville</label><input className={input} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Nom réel de l’usine (équipe seulement)</label><input className={input} value={f.real_name} onChange={(e) => setF({ ...f, real_name: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Contact (WeChat, e-mail, téléphone)</label><input className={input} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></div>
        <div><label className={label}>Score /25 (certifs, tropical, installation, prix, transparence)</label><input type="number" min={0} max={25} className={input} value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Note interne</label><textarea className={input} rows={2} value={f.internal_note} onChange={(e) => setF({ ...f, internal_note: e.target.value })} /></div>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button type="button" disabled={busy || !f.lot.trim()} onClick={async () => { setBusy(true); setErr(''); try { await api.act('supplier.upsert', { id: s?.id, ...f, score: f.score === '' ? null : Number(f.score) }); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={`${btnPrimary} mt-4`}>Enregistrer</button>
    </Modal>
  );
}

function ExchangeModal({ supplierId, admin, api, onClose }: { supplierId: string | null; admin: TeamExtras; api: WorkspaceApi; onClose: () => void }) {
  const [f, setF] = useState({ supplier_id: supplierId || '', channel: 'wechat', exchanged_at: new Date().toISOString().slice(0, 16), summary: '', next_action: '', next_action_at: '' });
  const [files, setFiles] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiInfo, setAiInfo] = useState('');
  // Captures → résumé, relance et canal proposés par l'IA (GLM 5.3 Flash lit l'image), à relire.
  const summarize = async () => {
    setAiBusy(true);
    setErr('');
    try {
      const ids = files.map((a) => /\/documents\/([0-9a-f-]{36})$/i.exec(a.url || '')?.[1]).filter((x): x is string => !!x);
      const r = await api.ai('exchange.summarize', { document_ids: ids, notes: f.summary });
      const res = r.result as { summary: string; next_action: string | null; next_action_days: number | null; channel: string; key_figures: string[] };
      const figures = res.key_figures?.length ? `\n\nChiffres cités : ${res.key_figures.join(' · ')}` : '';
      setF((x) => ({
        ...x,
        summary: `${res.summary}${figures}`,
        channel: ['wechat', 'email', 'whatsapp', 'phone', 'visit', 'other'].includes(res.channel) ? res.channel : x.channel,
        next_action: res.next_action || x.next_action,
        next_action_at: res.next_action_days != null && !x.next_action_at ? new Date(Date.now() + res.next_action_days * 86_400_000).toISOString().slice(0, 10) : x.next_action_at,
      }));
      const u = r.usage as { model: string; costFcfa: number };
      setAiInfo(`${u.model} · ${u.costFcfa} FCFA — à relire avant d’enregistrer`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Résumé impossible');
    } finally {
      setAiBusy(false);
    }
  };
  return (
    <Modal title="Nouvel échange avec une usine" onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={label}>Fournisseur</label><select className={input} value={f.supplier_id} onChange={(e) => setF({ ...f, supplier_id: e.target.value })}><option value="">— sans fournisseur —</option>{admin.suppliers.map((s) => <option key={s.id} value={s.id}>{s.alias} · {s.real_name || s.lot}</option>)}</select></div>
        <div><label className={label}>Canal</label><select className={input} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value })}>{EXCHANGE_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
        <div><label className={label}>Date et heure</label><input type="datetime-local" className={input} value={f.exchanged_at} onChange={(e) => setF({ ...f, exchanged_at: e.target.value })} /></div>
        <div><label className={label}>Relance prévue</label><input type="date" className={input} value={f.next_action_at} onChange={(e) => setF({ ...f, next_action_at: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>Résumé (ce qui a été dit, promis, chiffré)</label><textarea className={input} rows={4} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className={label}>À faire ensuite</label><input className={input} value={f.next_action} onChange={(e) => setF({ ...f, next_action: e.target.value })} placeholder="Ex. relancer pour la fiche technique du shockpad" /></div>
        <div className="sm:col-span-2">
          <label className={label}>Captures d’écran, e-mails, pièces</label>
          <AttachmentList items={files} onRemove={(i) => setFiles((x) => x.filter((_, k) => k !== i))} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <AttachButton api={api} internal category="misc" label="Joindre des captures" accept="image/*,application/pdf,.eml,.txt" onAttached={(a) => setFiles((x) => [...x, ...a])} />
            <button type="button" disabled={aiBusy || (!files.some((a) => a.kind === 'image') && !f.summary.trim())} onClick={summarize} className={btn} title="Lire les captures et proposer résumé, chiffres cités et relance">{aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Résumer avec l’IA</button>
            {aiInfo && <span className="text-[11px] text-slate-500">{aiInfo}</span>}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Stockées dans l’espace privé, réservées à l’équipe. Le chinois et l’anglais des captures sont traduits dans le résumé.</p>
        </div>
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      <button type="button" disabled={busy || (!f.summary.trim() && !files.length)} onClick={async () => { setBusy(true); setErr(''); try { await api.act('exchange.add', { ...f, supplier_id: f.supplier_id || null, exchanged_at: f.exchanged_at ? new Date(f.exchanged_at).toISOString() : undefined, next_action_at: f.next_action_at ? new Date(f.next_action_at).toISOString() : null, attachments: files }); onClose(); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={`${btnPrimary} mt-4`}>Enregistrer l’échange</button>
    </Modal>
  );
}

export function AccessTab({ admin, api }: { admin: TeamExtras; api: WorkspaceApi }) {
  const [f, setF] = useState({ person_name: '', role_label: '', expires_at: '' });
  const [created, setCreated] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return (
    <div className="space-y-4">
      <div className={card}>
        <p className="font-display text-base font-bold text-slate-900 dark:text-white">Donner un accès au client</p>
        <p className="mb-3 text-xs text-slate-500">Un lien par personne, sans mot de passe. Il peut être révoqué à tout moment. Le client voit le plan, le journal, les documents partagés et le devis ; jamais les fournisseurs réels, les prix d’achat ni les échanges avec les usines.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className={label}>Nom de la personne</label><input className={input} value={f.person_name} onChange={(e) => setF({ ...f, person_name: e.target.value })} /></div>
          <div><label className={label}>Rôle (facultatif)</label><input className={input} placeholder="Directeur, responsable site…" value={f.role_label} onChange={(e) => setF({ ...f, role_label: e.target.value })} /></div>
          <div><label className={label}>Expire le (facultatif)</label><input type="date" className={input} value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></div>
        </div>
        <button type="button" disabled={busy || !f.person_name.trim()} onClick={async () => { setBusy(true); setErr(''); try { const r = await api.act('share.create', { ...f, expires_at: f.expires_at ? new Date(f.expires_at).toISOString() : null }); setCreated(`${origin}${r.path}`); setF({ person_name: '', role_label: '', expires_at: '' }); } catch (e) { setErr(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }} className={`${btnPrimary} mt-3`}><Link2 className="h-3.5 w-3.5" /> Créer le lien</button>
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
        {created && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            <span className="break-all">{created}</span>
            <button type="button" onClick={() => navigator.clipboard?.writeText(created)} className={btn}><Copy className="h-3.5 w-3.5" /> Copier</button>
          </div>
        )}
      </div>
      <div className={card}>
        <p className="mb-2 font-display text-base font-bold text-slate-900 dark:text-white">Liens existants</p>
        {admin.shares.length === 0 ? (
          <Empty>Aucun lien.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="pb-2 text-left font-semibold">Personne</th><th className="pb-2 text-left font-semibold">Lien</th><th className="pb-2 text-right font-semibold">Vues</th><th className="pb-2 text-left font-semibold">Dernière visite</th><th className="pb-2 text-left font-semibold">État</th><th></th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {admin.shares.map((s) => {
                const url = `${origin}/projet/${s.token}`;
                const expired = s.expires_at && new Date(s.expires_at) < new Date();
                return (
                  <tr key={s.id} className={s.revoked_at ? 'opacity-50' : ''}>
                    <td className="py-2 pr-2 font-medium">{s.person_name}{s.role_label ? <span className="text-xs text-slate-500"> · {s.role_label}</span> : null}</td>
                    <td className="py-2 pr-2"><button type="button" onClick={() => navigator.clipboard?.writeText(url)} className={btn} title={url}><Copy className="h-3.5 w-3.5" /> Copier</button></td>
                    <td className="py-2 text-right tabular-nums">{s.views}</td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{s.last_seen_at ? dateTime(s.last_seen_at) : '—'}</td>
                    <td className="py-2 pr-2">{s.revoked_at ? <Badge tone="red">Révoqué</Badge> : expired ? <Badge tone="amber">Expiré</Badge> : <Badge tone="emerald">Actif</Badge>}</td>
                    <td className="py-2 text-right">{!s.revoked_at && <button type="button" onClick={() => { if (confirm(`Révoquer le lien de ${s.person_name} ?`)) api.act('share.revoke', { share_id: s.id }); }} className={btn}>Révoquer</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className={card}>
        <p className="mb-2 font-display text-base font-bold text-slate-900 dark:text-white">Journal d’audit</p>
        <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
          {admin.events.slice(0, 150).map((e) => (
            <li key={e.id} className="flex gap-2"><span className="shrink-0 tabular-nums text-slate-400">{dateTime(e.created_at)}</span><span className="shrink-0 font-semibold">{e.actor_name || e.actor}</span><span className="text-slate-500">{e.type}</span><span className="min-w-0 truncate text-slate-700 dark:text-slate-200" title={e.detail || ''}>{e.detail}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ReportTab({ p, api }: { p: PublicProject; api: WorkspaceApi }) {
  const [busy, setBusy] = useState(false);
  const bt = p.business_trip;
  return (
    <div className="space-y-4">
      {p.final_reports.map((r) => {
        const ph = p.phases.find((x) => x.id === r.phase);
        const done = r.checklist.filter((c) => c.done).length;
        return (
          <div key={r.phase} className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">Rapport final — {ph?.name || r.phase}</p>
              {r.delivered_at ? <Badge tone="emerald">Remis le {dateShort(r.delivered_at)}</Badge> : <Badge tone="amber">Remis à la réception</Badge>}
            </div>
            <p className="text-xs text-slate-500">{done}/{r.checklist.length} éléments prêts</p>
            <ul className="mt-2 space-y-1.5">
              {r.checklist.map((c) => (
                <li key={c.id}>
                  <label className={`flex items-center gap-2 text-sm ${api.mode === 'team' ? 'cursor-pointer' : ''}`}>
                    <input type="checkbox" checked={c.done} disabled={api.mode !== 'team' || busy} onChange={async (e) => { setBusy(true); try { await api.act('report.set', { phase: r.phase, checklist: r.checklist.map((x) => (x.id === c.id ? { ...x, done: e.target.checked } : x)) }); } finally { setBusy(false); } }} className="h-4 w-4 rounded border-slate-300 text-emerald-600" />
                    <span className={c.done ? 'text-slate-400 line-through' : ''}>{c.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.download_path && <a href={r.download_path} target="_blank" rel="noopener noreferrer" className={btnPrimary}>Télécharger le rapport</a>}
              {api.mode === 'team' && (
                <>
                  <AttachButton api={api} category="reports" label={r.download_path ? 'Remplacer le PDF' : 'Joindre le PDF du rapport'} accept="application/pdf" onAttached={async (a) => { const m = /\/documents\/([0-9a-f-]{36})$/i.exec(a[0]?.url || ''); if (m) await api.act('report.set', { phase: r.phase, file_id: m[1] }); }} />
                  <button type="button" onClick={() => api.act('report.set', { phase: r.phase, delivered: !r.delivered_at })} className={btn}>{r.delivered_at ? 'Marquer non remis' : 'Marquer remis au client'}</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      <div className={card}>
        <p className="font-display text-base font-bold text-slate-900 dark:text-white">{bt.title} (option)</p>
        <p className="text-xs text-slate-500">Auditer les usines retenues, sous alias, avant la signature des accords-cadres.</p>
        <ol className="mt-2 space-y-1 text-sm">{bt.days.map((d) => <li key={d.day}><span className="font-semibold">J{d.day} · {d.city}</span> — {d.program}</li>)}</ol>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {api.mode === 'client' ? (
            <>
              <button type="button" disabled={!!bt.interested_at} onClick={() => api.act('trip.interested')} className={btnPrimary}>{bt.interested_at ? `Intérêt signalé le ${dateShort(bt.interested_at)}` : 'Je suis intéressé'}</button>
              <button type="button" disabled={!!bt.quote_requested_at} onClick={() => api.act('trip.quote')} className={btn}>{bt.quote_requested_at ? `Devis demandé le ${dateShort(bt.quote_requested_at)}` : 'Recevoir le devis du voyage'}</button>
            </>
          ) : (
            <p className="text-xs text-slate-600">{bt.interested_at ? `Client intéressé le ${dateShort(bt.interested_at)}.` : 'Le client n’a pas encore signalé d’intérêt.'} {bt.quote_requested_at ? `Devis du voyage demandé le ${dateShort(bt.quote_requested_at)} : chiffrer la ligne « Voyage d’audit » du devis.` : ''}</p>
          )}
        </div>
      </div>
    </div>
  );
}
