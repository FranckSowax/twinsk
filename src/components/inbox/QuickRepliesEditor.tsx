'use client';

// Gestion des phrases rapides (admin) : texte sur plusieurs lignes, emoji
// (teinte marron clair par défaut), liens de listings insérés au curseur,
// variables {nom} {prenom} {numero}, et aperçu du message tel que le client
// le recevra (bulle WhatsApp + carte d'aperçu du lien).

import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, X } from 'lucide-react';
import { fillTemplate, type QuickReply } from '@/lib/wa-inbox';
import { EmojiPicker, firstUrl, insertAtCursor, LinkInsertMenu, LinkPreviewCard, MessageText, type Fetcher } from './inbox-ui';
import { CONTENT } from '@/content';

const SAMPLE = { name: 'Hermine Prisca', phone: CONTENT.sampleClientPhone };

export default function QuickRepliesEditor({ initial, fetcher, onClose, onSaved }: { initial: QuickReply[]; fetcher: Fetcher; onClose: () => void; onSaved: (items: QuickReply[]) => void }) {
  const [items, setItems] = useState<QuickReply[]>(initial.length ? initial : [{ id: `q${Date.now()}`, label: '', text: '' }]);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const cur = items[index];

  const patch = (p: Partial<QuickReply>) => setItems((l) => l.map((x, i) => (i === index ? { ...x, ...p } : x)));
  const setText = (v: string) => patch({ text: v });
  const insert = (v: string) => insertAtCursor(textRef.current, cur?.text || '', v, setText);
  const add = () => {
    setItems((l) => [...l, { id: `q${Date.now()}`, label: '', text: '' }]);
    setIndex(items.length);
  };
  const remove = () => {
    setItems((l) => l.filter((_, i) => i !== index));
    setIndex((i) => Math.max(0, i - 1));
  };
  const move = (d: -1 | 1) => {
    const j = index + d;
    if (j < 0 || j >= items.length) return;
    setItems((l) => {
      const n = [...l];
      [n[index], n[j]] = [n[j], n[index]];
      return n;
    });
    setIndex(j);
  };
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const r = await fetcher('/api/inbox/quick-replies', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: items.filter((x) => x.text.trim()) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d.error || 'Enregistrement impossible');
        return;
      }
      onSaved(d.items || []);
    } finally {
      setSaving(false);
    }
  };

  const previewText = cur ? fillTemplate(cur.text, SAMPLE) : '';
  const url = firstUrl(previewText);
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="font-display text-lg font-bold uppercase text-slate-900 dark:text-white">Phrases rapides</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Liste */}
          <div className="flex max-h-40 flex-shrink-0 flex-col border-b border-slate-200 dark:border-slate-700 md:max-h-none md:w-56 md:border-b-0 md:border-r">
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {items.map((x, i) => (
                <button key={x.id + i} type="button" onClick={() => setIndex(i)} className={`mb-1 block w-full truncate rounded-lg px-3 py-2 text-left text-sm ${i === index ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'}`}>
                  ⚡ {x.label || x.text.slice(0, 24) || 'Nouvelle phrase'}
                </button>
              ))}
            </div>
            <button type="button" onClick={add} className="m-2 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-600 hover:border-emerald-400 dark:border-slate-600 dark:text-slate-300">
              <Plus className="h-4 w-4" /> Ajouter
            </button>
          </div>

          {/* Édition + aperçu */}
          {cur ? (
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Titre (bouton)</label>
                  <input value={cur.label} onChange={(e) => patch({ label: e.target.value })} placeholder="Ex : Catalogue canapés" maxLength={40} className={field} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Message</label>
                  <textarea ref={textRef} value={cur.text} onChange={(e) => setText(e.target.value)} rows={9} placeholder={'Bonjour {prenom} 👋🏽\n\nVoici notre catalogue…'} className={`${field} resize-y leading-relaxed`} />
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <EmojiPicker onPick={insert} />
                    <LinkInsertMenu fetcher={fetcher} onPick={(u) => insert(u)} />
                    {['{nom}', '{prenom}', '{numero}'].map((v) => (
                      <button key={v} type="button" onClick={() => insert(v)} className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">Entrée = saut de ligne. Les variables sont remplacées par le nom et le numéro du client.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => move(-1)} disabled={index === 0} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30 dark:border-slate-600" title="Monter"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(1)} disabled={index === items.length - 1} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 disabled:opacity-30 dark:border-slate-600" title="Descendre"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={remove} className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/50"><Trash2 className="h-3.5 w-3.5" /> Supprimer</button>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Aperçu côté client</p>
                <div className="min-h-[12rem] rounded-2xl bg-[#efeae2] p-3 dark:bg-slate-900/60">
                  {previewText.trim() ? (
                    <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-[#d9fdd3] px-3 py-2 text-sm text-slate-900 shadow-sm">
                      {url && <LinkPreviewCard url={url} fetcher={fetcher} />}
                      <MessageText text={previewText} mine />
                    </div>
                  ) : (
                    <p className="pt-10 text-center text-xs text-slate-500">L’aperçu apparaît ici.</p>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Exemple avec le client « {SAMPLE.name} ».</p>
              </div>
            </div>
          ) : (
            <p className="flex-1 p-8 text-center text-sm text-slate-500">Aucune phrase. Cliquez sur « Ajouter ».</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          {error && <p className="mr-auto text-sm text-red-600">{error}</p>}
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Annuler</button>
          <button type="button" onClick={save} disabled={saving} className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
