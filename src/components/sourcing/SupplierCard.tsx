'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import {
  CURRENCIES,
  MOULD_OWNERSHIP_LABELS,
  QUOTE_STATUS_LABELS,
  TWIST_SCALE,
} from '@/lib/sourcing/defaults';
import type { SourcingQuote, SourcingSupplier, SupplierContact } from '@/lib/sourcing/types';
import { useAutosave } from './useAutosave';
import { Checkbox, Field, NumberInput, SaveIndicator, Select, Tag, TextArea, TextInput } from './ui';

const STATUS_OPTIONS = (
  Object.keys(QUOTE_STATUS_LABELS) as Array<keyof typeof QUOTE_STATUS_LABELS>
).map((value) => ({ value, label: QUOTE_STATUS_LABELS[value] }));
const TWIST_OPTIONS = TWIST_SCALE.map((t) => ({ value: t.value, label: t.label }));
const OWNERSHIP_OPTIONS = Object.entries(MOULD_OWNERSHIP_LABELS).map(([value, label]) => ({
  value,
  label,
}));
const CURRENCY_OPTIONS = CURRENCIES.map((c) => ({ value: c, label: c }));

const STATUS_TONE: Record<string, string> = {
  a_repondu: 'green',
  contacte: 'amber',
  relance: 'amber',
  a_refuse: 'red',
  ecarte: 'red',
  a_contacter: 'grey',
};

export interface SupplierEntry extends SourcingSupplier {
  quote: SourcingQuote | null;
}

export function SupplierCard({
  entry,
  open,
  onToggle,
  onChange,
}: {
  entry: SupplierEntry;
  open: boolean;
  onToggle: () => void;
  onChange: (next: SupplierEntry) => void;
}) {
  const [local, setLocal] = useState<SupplierEntry>(entry);

  const sendSupplier = useCallback(
    (patch: Record<string, unknown>) =>
      fetch(`/api/sourcing/suppliers/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    [entry.id],
  );
  const sendQuote = useCallback(
    (patch: Record<string, unknown>) =>
      fetch(`/api/sourcing/suppliers/${entry.id}/quote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }),
    [entry.id],
  );

  const supplierSave = useAutosave(sendSupplier);
  const quoteSave = useAutosave(sendQuote);

  /** L'état local part immédiatement (le calcul suit la frappe), l'envoi est différé. */
  const setSupplier = (patch: Partial<SourcingSupplier>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
    supplierSave.push(patch as Record<string, unknown>);
  };
  const setQuote = (patch: Partial<SourcingQuote>) => {
    const next = { ...local, quote: { ...(local.quote as SourcingQuote), ...patch } };
    setLocal(next);
    onChange(next);
    quoteSave.push(patch as Record<string, unknown>);
  };

  const q = local.quote;
  const contacts = (local.contacts ?? []) as SupplierContact[];
  const warnings = (local.warnings ?? []) as string[];

  return (
    <div
      className={`rounded border border-line bg-white transition ${local.included ? '' : 'opacity-55'}`}
    >
      {/* En-tête, toujours visible. Un fournisseur écarté reste lisible, en retrait. */}
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-4 shrink-0 text-ink-soft" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-ink-soft" />
          )}
          <span className="truncate font-medium text-ink">{local.name}</span>
          {local.country && <span className="text-xs text-ink-soft">{local.country}</span>}
          {local.track && (
            <span className="rounded bg-mist px-1.5 py-0.5 text-xs text-ink-soft">
              Voie {local.track}
            </span>
          )}
          {local.verdict && <Tag tone={local.verdict}>{local.verdict_label ?? local.verdict}</Tag>}
        </button>
        {q?.status && <Tag tone={STATUS_TONE[q.status]}>{QUOTE_STATUS_LABELS[q.status]}</Tag>}
        <SaveIndicator
          state={quoteSave.state === 'idle' ? supplierSave.state : quoteSave.state}
          onRetry={() => {
            supplierSave.retry();
            quoteSave.retry();
          }}
        />
        <Checkbox
          checked={local.included}
          onChange={(v) => setSupplier({ included: v })}
          label="Au panel"
        />
      </div>

      {open && (
        <div className="space-y-5 border-t border-line px-3 py-4">
          {warnings.length > 0 && (
            <ul className="space-y-1 rounded border border-amber-200 bg-amber-50 p-2.5">
              {warnings.map((w, i) => (
                <li key={i} className="flex gap-2 text-xs text-amber-900">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          )}

          {(local.legal_name || local.registration || contacts.length > 0) && (
            <div className="rounded bg-mist p-3 text-xs leading-relaxed text-ink-soft">
              {local.legal_name && (
                <p>
                  <span className="font-medium text-ink">Raison sociale : </span>
                  {local.legal_name}
                </p>
              )}
              {local.registration && (
                <p>
                  <span className="font-medium text-ink">Immatriculation : </span>
                  {local.registration}
                </p>
              )}
              {contacts.length > 0 && (
                <p className="mt-1">
                  <span className="font-medium text-ink">Contacts : </span>
                  {contacts.map((c) => `${c.label} ${c.value}`).join(' · ')}
                </p>
              )}
            </div>
          )}

          {(local.strengths || local.weaknesses) && (
            <div className="grid gap-3 md:grid-cols-2">
              {local.strengths && (
                <div className="rounded border border-emerald-200 bg-emerald-50/50 p-2.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
                    Arguments favorables
                  </p>
                  <p className="text-xs leading-relaxed text-ink">{local.strengths}</p>
                </div>
              )}
              {local.weaknesses && (
                <div className="rounded border border-red-200 bg-red-50/50 p-2.5">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-800">
                    Points négatifs
                  </p>
                  <p className="text-xs leading-relaxed text-ink">{local.weaknesses}</p>
                </div>
              )}
            </div>
          )}

          <Block title="Suivi de la consultation">
            <Field label="Statut">
              <Select
                value={q?.status}
                onChange={(v) => setQuote({ status: v ?? 'a_contacter' })}
                options={STATUS_OPTIONS}
              />
            </Field>
            <Field label="Interlocuteur">
              <TextInput value={q?.contact_name} onChange={(v) => setQuote({ contact_name: v })} />
            </Field>
            <Field label="Canal">
              <TextInput
                value={q?.channel}
                onChange={(v) => setQuote({ channel: v })}
                placeholder="e-mail, WeChat…"
              />
            </Field>
            <Field label="Envoyé le">
              <TextInput type="date" value={q?.sent_at} onChange={(v) => setQuote({ sent_at: v })} />
            </Field>
            <Field label="Réponse le">
              <TextInput
                type="date"
                value={q?.replied_at}
                onChange={(v) => setQuote({ replied_at: v })}
              />
            </Field>
            <Field label="Solidité (0-100)" hint="Issue de la due diligence, ajustable.">
              <NumberInput value={local.solidity} onChange={(v) => setSupplier({ solidity: v })} />
            </Field>
          </Block>

          <Block title="Faisabilité twist-lock" cols={2}>
            <Field label="Réponse">
              <Select
                value={q?.twist_lock}
                onChange={(v) => setQuote({ twist_lock: v })}
                options={TWIST_OPTIONS}
                placeholder="— non répondu —"
              />
            </Field>
            <Field label="Nature de la preuve" hint="Photos de moule, référence client joignable.">
              <TextInput value={q?.twist_proof} onChange={(v) => setQuote({ twist_proof: v })} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Notes techniques (DFM)">
                <TextArea
                  value={q?.dfm_notes}
                  onChange={(v) => setQuote({ dfm_notes: v })}
                  rows={2}
                />
              </Field>
            </div>
          </Block>

          <Block title="Prix par palier et MOQ">
            <Field label="Devise">
              <Select
                value={q?.currency}
                onChange={(v) => setQuote({ currency: v })}
                options={CURRENCY_OPTIONS}
              />
            </Field>
            <Field label="Prix set — 5 000">
              <NumberInput
                step="0.01"
                value={q?.price_5k}
                onChange={(v) => setQuote({ price_5k: v })}
              />
            </Field>
            <Field label="Prix set — 10 000">
              <NumberInput
                step="0.01"
                value={q?.price_10k}
                onChange={(v) => setQuote({ price_10k: v })}
              />
            </Field>
            <Field label="Prix set — 20 000">
              <NumberInput
                step="0.01"
                value={q?.price_20k}
                onChange={(v) => setQuote({ price_20k: v })}
              />
            </Field>
            <Field label="MOQ imposé (sets)">
              <NumberInput value={q?.moq} onChange={(v) => setQuote({ moq: v })} />
            </Field>
            <Field label="Conditions de paiement">
              <TextInput value={q?.payment_terms} onChange={(v) => setQuote({ payment_terms: v })} />
            </Field>
          </Block>

          <Block title="Outillage">
            <Field label="Moule assiette">
              <NumberInput
                value={q?.mould_plate_cost}
                onChange={(v) => setQuote({ mould_plate_cost: v })}
              />
            </Field>
            <Field label="Moule couvercle">
              <NumberInput
                value={q?.mould_lid_cost}
                onChange={(v) => setQuote({ mould_lid_cost: v })}
              />
            </Field>
            <Field label="Empreintes">
              <TextInput value={q?.cavities} onChange={(v) => setQuote({ cavities: v })} />
            </Field>
            <Field label="Durée de vie (cycles)">
              <NumberInput
                value={q?.mould_life_cycles}
                onChange={(v) => setQuote({ mould_life_cycles: v })}
              />
            </Field>
            <Field label="Propriété du moule">
              <Select
                value={q?.mould_ownership}
                onChange={(v) => setQuote({ mould_ownership: v as never })}
                options={OWNERSHIP_OPTIONS}
              />
            </Field>
          </Block>

          <Block title="Délais et échantillon">
            <Field label="Échantillon — coût">
              <NumberInput value={q?.sample_cost} onChange={(v) => setQuote({ sample_cost: v })} />
            </Field>
            <Field label="Échantillon — jours">
              <NumberInput value={q?.sample_days} onChange={(v) => setQuote({ sample_days: v })} />
            </Field>
            <Field label="Outillage T1 — jours">
              <NumberInput value={q?.tooling_days} onChange={(v) => setQuote({ tooling_days: v })} />
            </Field>
            <Field label="Production — jours">
              <NumberInput
                value={q?.production_days}
                onChange={(v) => setQuote({ production_days: v })}
              />
            </Field>
          </Block>

          <Block
            title="Colisage et expédition"
            hint="Sans sets par carton ni volume de carton, le coût débarqué ne peut pas être calculé — la ligne reste à « — »."
          >
            <Field label="Sets par carton">
              <NumberInput
                value={q?.sets_per_carton}
                onChange={(v) => setQuote({ sets_per_carton: v })}
              />
            </Field>
            <Field label="Volume carton (m³)">
              <NumberInput
                step="0.001"
                value={q?.carton_volume_m3}
                onChange={(v) => setQuote({ carton_volume_m3: v })}
              />
            </Field>
            <Field label="Poids carton (kg)">
              <NumberInput
                step="0.1"
                value={q?.carton_weight_kg}
                onChange={(v) => setQuote({ carton_weight_kg: v })}
              />
            </Field>
            <Field label="Port de départ">
              <TextInput value={q?.port} onChange={(v) => setQuote({ port: v })} />
            </Field>
            <Field label="Incoterm">
              <TextInput
                value={q?.incoterm}
                onChange={(v) => setQuote({ incoterm: v })}
                placeholder="FOB, EXW…"
              />
            </Field>
          </Block>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Conformité — cocher ce qui a été REÇU (pas déclaré)
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <Checkbox
                checked={!!q?.cert_fda}
                onChange={(v) => setQuote({ cert_fda: v })}
                label="FDA"
              />
              <Checkbox
                checked={!!q?.cert_lfgb}
                onChange={(v) => setQuote({ cert_lfgb: v })}
                label="LFGB"
              />
              <Checkbox
                checked={!!q?.cert_iso}
                onChange={(v) => setQuote({ cert_iso: v })}
                label="ISO 9001"
              />
              <Checkbox
                checked={!!q?.cert_migration}
                onChange={(v) => setQuote({ cert_migration: v })}
                label="Test de migration"
              />
            </div>
          </div>

          <Field label="Notes">
            <TextArea value={q?.notes} onChange={(v) => setQuote({ notes: v })} rows={2} />
          </Field>
        </div>
      )}
    </div>
  );
}

function Block({
  title,
  hint,
  cols = 3,
  children,
}: {
  title: string;
  hint?: string;
  cols?: number;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{title}</p>
      {hint && <p className="mb-2 text-xs text-ink-soft/80">{hint}</p>}
      <div className={`grid gap-3 sm:grid-cols-2 ${cols === 3 ? 'lg:grid-cols-3' : ''}`}>
        {children}
      </div>
    </div>
  );
}
