'use client';

import type { ReactNode } from 'react';
import type { SaveState } from './useAutosave';

/* ═══ Indicateur de sauvegarde ═══ */

export function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'idle') return null;
  if (state === 'error') {
    return (
      <button
        onClick={onRetry}
        className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
      >
        Échec — réessayer
      </button>
    );
  }
  return (
    <span className="text-xs text-ink-soft">
      {state === 'saving' ? 'Enregistrement…' : 'Enregistré'}
    </span>
  );
}

/* ═══ Coquille de section, avec ancre pour le sommaire ═══ */

export function Section({
  id,
  title,
  subtitle,
  actions,
  children,
}: {
  id: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-b border-line py-8 last:border-0">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/* ═══ Champs ═══ */

const inputClass =
  'w-full rounded border border-line bg-white px-2.5 py-1.5 text-sm text-ink outline-none transition focus:border-forest focus:ring-1 focus:ring-forest/20 disabled:bg-mist';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-soft/80">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date' | 'url';
}) {
  return (
    <input
      type={type}
      className={inputClass}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * Saisie chiffrée. Le champ vide reste vide et remonte null : dans ce module,
 * l'absence de réponse ne doit jamais être stockée comme un zéro.
 */
export function NumberInput({
  value,
  onChange,
  placeholder,
  step,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      step={step}
      className={`${inputClass} text-right tabular-nums`}
      value={value ?? ''}
      placeholder={placeholder ?? '—'}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === '' ? null : Number(raw.replace(',', '.')));
      }}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      rows={rows}
      className={`${inputClass} resize-y leading-relaxed`}
      value={value ?? ''}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = '—',
}: {
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      className={inputClass}
      value={value ?? ''}
      onChange={(e) => onChange((e.target.value || null) as T | null)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-line accent-forest"
      />
      {label}
    </label>
  );
}

/* ═══ Pastilles ═══ */

const VERDICT_TONE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  grey: 'bg-slate-100 text-slate-700 border-slate-200',
  red: 'bg-red-50 text-red-800 border-red-200',
};

export function Tag({ tone, children }: { tone?: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
        VERDICT_TONE[tone ?? 'grey'] ?? VERDICT_TONE.grey
      }`}
    >
      {children}
    </span>
  );
}

/** Valeur absente : un tiret, jamais un zéro. */
export function Dash() {
  return <span className="text-ink-soft/60">—</span>;
}

export const fr = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function eur(v: number | null | undefined) {
  if (v == null) return '—';
  return `${v.toLocaleString('fr-FR', {
    minimumFractionDigits: v < 10 ? 2 : 0,
    maximumFractionDigits: v < 10 ? 2 : 0,
  })} €`;
}
