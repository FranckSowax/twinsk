'use client';

import { useCallback, useRef, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import type {
  ConditionState,
  SourcingCondition,
  SourcingContactLogEntry,
  SourcingImage,
  SourcingProject,
} from '@/lib/sourcing/types';
import type { SupplierEntry } from './SupplierCard';
import { useAutosave } from './useAutosave';
import { Field, SaveIndicator, Section, Select, TextArea, TextInput } from './ui';

/* ═══ 8. Journal de contact ═══ */

const emptyEntry = (): Partial<SourcingContactLogEntry> => ({
  happened_on: null,
  supplier_id: null,
  channel: null,
  contact_name: null,
  subject: null,
  outcome: null,
});

export function ContactLog({
  projectId,
  entries,
  suppliers,
  onChange,
}: {
  projectId: string;
  entries: SourcingContactLogEntry[];
  suppliers: SupplierEntry[];
  onChange: (entries: SourcingContactLogEntry[]) => void;
}) {
  const [draft, setDraft] = useState(emptyEntry());
  const [busy, setBusy] = useState(false);

  const supplierOptions = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const nameOf = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? '—') : '—';

  const add = async () => {
    if (!Object.values(draft).some((v) => v)) return;
    setBusy(true);
    const res = await fetch(`/api/sourcing/projects/${projectId}/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    setBusy(false);
    if (!res.ok) return;
    onChange([(await res.json()) as SourcingContactLogEntry, ...entries]);
    setDraft(emptyEntry());
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/sourcing/log/${id}`, { method: 'DELETE' });
    if (res.ok) onChange(entries.filter((e) => e.id !== id));
  };

  return (
    <Section
      id="journal"
      title="8. Journal de contact"
      subtitle="Qui a été contacté, quand, par quel canal, et ce que ça a donné."
    >
      <div className="mb-4 grid gap-3 rounded border border-line bg-mist/50 p-3 sm:grid-cols-2 lg:grid-cols-6 print:hidden">
        <Field label="Date">
          <TextInput
            type="date"
            value={draft.happened_on}
            onChange={(v) => setDraft({ ...draft, happened_on: v })}
          />
        </Field>
        <Field label="Fournisseur">
          <Select
            value={draft.supplier_id}
            onChange={(v) => setDraft({ ...draft, supplier_id: v })}
            options={supplierOptions}
          />
        </Field>
        <Field label="Canal">
          <TextInput
            value={draft.channel}
            onChange={(v) => setDraft({ ...draft, channel: v })}
            placeholder="e-mail, WeChat…"
          />
        </Field>
        <Field label="Interlocuteur">
          <TextInput
            value={draft.contact_name}
            onChange={(v) => setDraft({ ...draft, contact_name: v })}
          />
        </Field>
        <Field label="Objet">
          <TextInput value={draft.subject} onChange={(v) => setDraft({ ...draft, subject: v })} />
        </Field>
        <div className="flex items-end">
          <button
            onClick={add}
            disabled={busy}
            className="inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded bg-forest px-3 text-sm font-medium text-white hover:bg-forest-soft disabled:opacity-60"
          >
            <Plus className="size-4" /> Ajouter
          </button>
        </div>
        <div className="sm:col-span-2 lg:col-span-6">
          <Field label="Résultat">
            <TextInput value={draft.outcome} onChange={(v) => setDraft({ ...draft, outcome: v })} />
          </Field>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
          Aucun échange consigné.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Fournisseur</th>
                <th className="px-3 py-2 font-medium">Canal</th>
                <th className="px-3 py-2 font-medium">Interlocuteur</th>
                <th className="px-3 py-2 font-medium">Objet / résultat</th>
                <th className="w-10 px-3 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-soft">
                    {e.happened_on ? new Date(e.happened_on).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-3 py-2 text-ink">{nameOf(e.supplier_id)}</td>
                  <td className="px-3 py-2 text-ink-soft">{e.channel ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">{e.contact_name ?? '—'}</td>
                  <td className="px-3 py-2 text-ink">
                    {e.subject && <span className="font-medium">{e.subject}</span>}
                    {e.subject && e.outcome && ' — '}
                    {e.outcome}
                  </td>
                  <td className="px-3 py-2 print:hidden">
                    <button
                      onClick={() => remove(e.id)}
                      className="rounded p-1 text-ink-soft hover:bg-mist hover:text-red-700"
                      aria-label="Supprimer cette ligne"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/* ═══ 9. Décision et conditions suspensives ═══ */

interface DecisionShape {
  question?: string;
  options?: string[];
  answer?: string;
  winner?: string;
  backup?: string;
  date?: string;
  rationale?: string;
  actions?: string;
}

const STATE_OPTIONS: ReadonlyArray<{ value: ConditionState; label: string }> = [
  { value: 'oui', label: 'Oui' },
  { value: 'non', label: 'Non' },
  { value: 'na', label: 'Sans objet' },
];

function ConditionRow({
  condition,
  index,
  onChange,
}: {
  condition: SourcingCondition;
  index: number;
  onChange: (next: SourcingCondition) => void;
}) {
  const send = useCallback(
    (patch: Record<string, unknown>) =>
      fetch(`/api/sourcing/conditions/${condition.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    [condition.id],
  );
  const save = useAutosave(send);

  const set = (patch: Partial<SourcingCondition>) => {
    onChange({ ...condition, ...patch });
    save.push(patch as Record<string, unknown>);
  };

  return (
    <tr className="border-t border-line align-top">
      <td className="px-3 py-2 tabular-nums text-ink-soft">{index + 1}</td>
      <td className="px-3 py-2">
        <p className="font-medium text-ink">{condition.title}</p>
        {condition.detail && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{condition.detail}</p>
        )}
      </td>
      <td className="px-3 py-2">
        <Select
          value={condition.state}
          onChange={(v) => set({ state: v })}
          options={STATE_OPTIONS}
          placeholder="—"
        />
      </td>
      <td className="px-3 py-2">
        <TextInput
          type="date"
          value={condition.resolved_on}
          onChange={(v) => set({ resolved_on: v })}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TextInput value={condition.evidence} onChange={(v) => set({ evidence: v })} />
          </div>
          <SaveIndicator state={save.state} onRetry={save.retry} />
        </div>
      </td>
    </tr>
  );
}

export function Decision({
  project,
  conditions,
  suppliers,
  onProjectChange,
  onConditionsChange,
}: {
  project: SourcingProject;
  conditions: SourcingCondition[];
  suppliers: SupplierEntry[];
  onProjectChange: (patch: Partial<SourcingProject>) => void;
  onConditionsChange: (next: SourcingCondition[]) => void;
}) {
  const d = (project.decision ?? {}) as DecisionShape;
  const lifted = conditions.filter((c) => c.state === 'oui').length;
  const applicable = conditions.filter((c) => c.state !== 'na').length;

  const set = (patch: Partial<DecisionShape>) =>
    onProjectChange({ decision: { ...d, ...patch } as Record<string, unknown> });

  const supplierNames = suppliers.map((s) => ({ value: s.name, label: s.name }));

  return (
    <Section
      id="decision"
      title="9. Décision et prochaines étapes"
      subtitle="Rien ne se signe tant que les conditions suspensives ne sont pas levées."
    >
      <h3 className="mb-2 text-sm font-semibold text-ink">
        9.1 Les conditions suspensives avant tout acompte d’outillage
      </h3>

      {conditions.length === 0 ? (
        <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
          Aucune condition suspensive définie pour ce projet. Dupliquer un projet existant reprend
          les siennes.
        </p>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-soft">
            {lifted} levée{lifted > 1 ? 's' : ''} sur {applicable} applicable
            {applicable > 1 ? 's' : ''}.
          </p>
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="w-8 px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Condition</th>
                  <th className="w-36 px-3 py-2 font-medium">Levée</th>
                  <th className="w-40 px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Preuve reçue / commentaire</th>
                </tr>
              </thead>
              <tbody>
                {conditions.map((c, i) => (
                  <ConditionRow
                    key={c.id}
                    condition={c}
                    index={i}
                    onChange={(next) =>
                      onConditionsChange(conditions.map((x) => (x.id === next.id ? next : x)))
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">9.2 Décision de sortie</h3>

      <div className="rounded border border-line p-3">
        <Field
          label="La question qui tranche"
          hint="Formulez-la de façon qu’une preuve, et non une déclaration, puisse y répondre."
        >
          <TextArea
            value={d.question}
            onChange={(v) => set({ question: v })}
            rows={2}
            placeholder="Quelle démonstration technique conditionne le choix ?"
          />
        </Field>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Field label="Réponse">
              {d.options?.length ? (
                <Select
                  value={d.answer}
                  onChange={(v) => set({ answer: v ?? undefined })}
                  options={d.options.map((o) => ({ value: o, label: o }))}
                  placeholder="— en attente —"
                />
              ) : (
                <TextInput
                  value={d.answer}
                  onChange={(v) => set({ answer: v })}
                  placeholder="— en attente —"
                />
              )}
            </Field>
          </div>
          <Field label="Fournisseur retenu">
            {supplierNames.length ? (
              <Select
                value={d.winner}
                onChange={(v) => set({ winner: v ?? undefined })}
                options={supplierNames}
              />
            ) : (
              <TextInput value={d.winner} onChange={(v) => set({ winner: v })} />
            )}
          </Field>
          <Field label="Fournisseur de secours">
            {supplierNames.length ? (
              <Select
                value={d.backup}
                onChange={(v) => set({ backup: v ?? undefined })}
                options={supplierNames}
              />
            ) : (
              <TextInput value={d.backup} onChange={(v) => set({ backup: v })} />
            )}
          </Field>
          <Field label="Date de décision">
            <TextInput type="date" value={d.date} onChange={(v) => set({ date: v })} />
          </Field>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Motivation de la décision">
            <TextArea value={d.rationale} onChange={(v) => set({ rationale: v })} rows={4} />
          </Field>
          <Field label="Actions et échéances">
            <TextArea value={d.actions} onChange={(v) => set({ actions: v })} rows={4} />
          </Field>
        </div>
      </div>
    </Section>
  );
}

/* ═══ 10. Annexes visuelles ═══ */

const MAX_EDGE = 1600;

/**
 * Réduit l'image à 1 600 px sur le plus grand côté et la convertit en WebP, dans
 * le navigateur : l'envoi est plus léger et le serveur n'a pas besoin d'un
 * encodeur natif. Si la conversion échoue, on envoie le fichier d'origine.
 */
async function shrink(file: File): Promise<{ file: File; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponible');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', 0.85),
    );
    if (!blob) throw new Error('conversion impossible');

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return { file: new File([blob], name, { type: 'image/webp' }), width, height };
  } catch {
    return { file, width: 0, height: 0 };
  }
}

export function Annexes({
  projectId,
  images,
  suppliers,
  onChange,
}: {
  projectId: string;
  images: Array<SourcingImage & { url?: string }>;
  suppliers: SupplierEntry[];
  onChange: (next: Array<SourcingImage & { url?: string }>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    const form = new FormData();
    let width = 0;
    let height = 0;
    for (const f of Array.from(files)) {
      const shrunk = await shrink(f);
      form.append('files', shrunk.file);
      width = shrunk.width;
      height = shrunk.height;
    }
    if (supplierId) form.append('supplier_id', supplierId);
    if (width) form.append('width', String(width));
    if (height) form.append('height', String(height));

    const res = await fetch(`/api/sourcing/projects/${projectId}/images`, {
      method: 'POST',
      body: form,
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? 'Téléversement impossible.');
      return;
    }
    onChange([...images, ...((await res.json()) as SourcingImage[])]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/sourcing/images/${id}`, { method: 'DELETE' });
    if (res.ok) onChange(images.filter((i) => i.id !== id));
  };

  const nameOf = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? null) : null;

  return (
    <Section
      id="annexes"
      title="10. Annexes visuelles"
      subtitle="Photos de moule, échantillons, certificats. Les images sont réduites à 1 600 px et converties en WebP avant l’envoi."
      actions={
        <div className="flex items-center gap-2 print:hidden">
          <select
            value={supplierId ?? ''}
            onChange={(e) => setSupplierId(e.target.value || null)}
            className="rounded border border-line bg-white px-2 py-1.5 text-xs text-ink"
          >
            <option value="">Annexe de projet</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-mist disabled:opacity-60"
          >
            <Upload className="size-3.5" /> {busy ? 'Envoi…' : 'Ajouter'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      }
    >
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <p className="rounded border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
          Aucune annexe. Ajoutez les photos de moule et les certificats reçus — ce sont eux qui font
          la différence entre une déclaration et une preuve.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <figure key={img.id} className="break-inside-avoid rounded border border-line p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption ?? img.filename}
                className="aspect-[4/3] w-full rounded object-cover"
                loading="lazy"
              />
              <figcaption className="mt-1.5 flex items-start justify-between gap-2">
                <span className="min-w-0 text-xs text-ink-soft">
                  {nameOf(img.supplier_id) && (
                    <span className="block font-medium text-ink">{nameOf(img.supplier_id)}</span>
                  )}
                  <span className="block truncate">{img.caption ?? img.filename}</span>
                </span>
                <button
                  onClick={() => remove(img.id)}
                  className="shrink-0 rounded p-1 text-ink-soft hover:bg-mist hover:text-red-700 print:hidden"
                  aria-label="Supprimer cette annexe"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Section>
  );
}
