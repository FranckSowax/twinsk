'use client';

import { useState } from 'react';
import { Ban, Check, Copy, Link2 } from 'lucide-react';
import type { SourcingShare } from '@/lib/sourcing/types';
import { Checkbox, Field, Section, TextInput } from './ui';

type Share = SourcingShare & { path?: string };

function statusOf(s: Share): { label: string; tone: string } {
  if (s.revoked_at) return { label: 'Révoqué', tone: 'bg-red-50 text-red-800' };
  if (s.expires_at && new Date(s.expires_at) < new Date())
    return { label: 'Expiré', tone: 'bg-slate-100 text-slate-600' };
  return { label: 'Actif', tone: 'bg-emerald-50 text-emerald-800' };
}

export function ShareLinks({
  projectId,
  shares,
  onChange,
}: {
  projectId: string;
  shares: Share[];
  onChange: (next: Share[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [revealWinner, setRevealWinner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/sourcing/projects/${projectId}/shares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: label.trim() || null,
        expires_at: expiresAt || null,
        reveal_winner: revealWinner,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? 'Création impossible.');
      return;
    }
    onChange([(await res.json()) as Share, ...shares]);
    setLabel('');
    setExpiresAt('');
    setRevealWinner(false);
  };

  const revoke = async (token: string) => {
    const res = await fetch(`/api/sourcing/shares/${encodeURIComponent(token)}`, {
      method: 'DELETE',
    });
    if (!res.ok) return;
    const { revoked_at } = (await res.json()) as { revoked_at: string };
    onChange(shares.map((s) => (s.token === token ? { ...s, revoked_at } : s)));
  };

  const copy = async (token: string) => {
    const url = `${window.location.origin}/sourcing/partage/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Section
      id="partage"
      title="Liens de partage"
      subtitle="Un lien montre l’avancement et le comparatif anonymisé. Ni les noms de fournisseurs, ni les prix, ni les coordonnées n’en sortent."
    >
      <div className="mb-4 grid items-end gap-3 rounded border border-line bg-mist/50 p-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Field label="Destinataire" hint="Pour savoir à qui ce lien a été donné.">
          <TextInput value={label} onChange={setLabel} placeholder="Comité, banque, partenaire…" />
        </Field>
        <Field label="Expire le" hint="Facultatif.">
          <TextInput type="date" value={expiresAt} onChange={setExpiresAt} />
        </Field>
        <div className="pb-2">
          <Checkbox
            checked={revealWinner}
            onChange={setRevealWinner}
            label="Nommer le fournisseur retenu"
          />
          <p className="mt-1 text-xs text-ink-soft/80">
            Décoché, la décision reste publiée sans nommer personne.
          </p>
        </div>
        <button
          onClick={create}
          disabled={busy}
          className="inline-flex h-[34px] items-center justify-center gap-1.5 rounded bg-forest px-3 text-sm font-medium text-white hover:bg-forest-soft disabled:opacity-60"
        >
          <Link2 className="size-4" /> Créer un lien
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {shares.length === 0 ? (
        <p className="rounded border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
          Aucun lien de partage créé.
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-3 py-2 font-medium">Destinataire</th>
                <th className="px-3 py-2 font-medium">État</th>
                <th className="px-3 py-2 font-medium">Expire</th>
                <th className="px-3 py-2 text-right font-medium">Consultations</th>
                <th className="px-3 py-2 font-medium">Retenu nommé</th>
                <th className="px-3 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => {
                const st = statusOf(s);
                const active = !s.revoked_at;
                return (
                  <tr key={s.token} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{s.label ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium ${st.tone}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">
                      {s.expires_at ? new Date(s.expires_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{s.views}</td>
                    <td className="px-3 py-2 text-ink-soft">{s.reveal_winner ? 'Oui' : 'Non'}</td>
                    <td className="px-3 py-2 print:hidden">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => copy(s.token)}
                          className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-ink hover:bg-mist"
                        >
                          {copied === s.token ? (
                            <>
                              <Check className="size-3.5" /> Copié
                            </>
                          ) : (
                            <>
                              <Copy className="size-3.5" /> Copier
                            </>
                          )}
                        </button>
                        {active && (
                          <button
                            onClick={() => revoke(s.token)}
                            className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-ink-soft hover:bg-mist hover:text-red-700"
                          >
                            <Ban className="size-3.5" /> Révoquer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-xs text-ink-soft">
        Un lien révoqué reste listé pour l’historique — qui l’a eu, combien de fois il a été consulté
        — mais il répond comme une page inexistante.
      </p>
    </Section>
  );
}
