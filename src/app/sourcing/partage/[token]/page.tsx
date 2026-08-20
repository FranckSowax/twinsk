import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import type { PublicProjection } from '@/lib/sourcing/publicProjection';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Avancement du sourcing',
  // Un lien de partage n'a pas vocation à être indexé.
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Préparation',
  active: 'Consultation en cours',
  decided: 'Décidé',
  archived: 'Clôturé',
};

async function load(token: string): Promise<PublicProjection | null> {
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const res = await fetch(`${proto}://${host}/api/sourcing/shared/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as PublicProjection;
}

function Kpi({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="rounded border border-line bg-white px-3 py-2.5">
      <div className="text-2xl font-bold leading-none text-forest">
        {value}
        {unit && <span className="ml-0.5 text-sm font-semibold text-ink-soft">{unit}</span>}
      </div>
      <div className="mt-1 text-[10.5px] uppercase tracking-wide text-ink-soft">{label}</div>
    </div>
  );
}

const note = (v: number | null) => (v == null ? '—' : Math.round(v));

export default async function SharedSourcingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await load(token);

  // Jeton inconnu, révoqué ou expiré : la page se comporte comme si elle
  // n'existait pas, exactement comme la route.
  if (!data) notFound();

  const { project, spec, market, kpis, ranking, conditions, decision } = data;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="border-b border-line pb-6">
        <p className="text-xs uppercase tracking-wide text-ink-soft">Avancement du sourcing</p>
        <h1 className="mt-1 font-display text-2xl tracking-tight text-ink">{project.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {project.client && <>{project.client} · </>}
          {STATUS_LABELS[project.status] ?? project.status} · mis à jour le{' '}
          {new Date(project.updated_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </header>

      {/* ── Indicateurs ── */}
      <section className="grid grid-cols-2 gap-2.5 py-6 lg:grid-cols-4">
        <Kpi
          value={String(kpis.consulted)}
          unit={`/ ${kpis.panelSize}`}
          label="Fournisseurs consultés"
        />
        <Kpi value={String(kpis.responseRate)} unit="%" label="Taux de réponse" />
        <Kpi value={String(kpis.provenTwistLock)} label="Faisabilité prouvée" />
        <Kpi
          value={kpis.spreadPct != null ? `+${kpis.spreadPct}` : '—'}
          unit="%"
          label="Écart entre offres"
        />
      </section>

      {/* ── Cahier des charges ── */}
      {spec.length > 0 && (
        <section className="border-t border-line py-6">
          <h2 className="mb-3 font-display text-lg tracking-tight text-ink">Cahier des charges</h2>
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[32rem] text-sm">
              <tbody>
                {spec.map((row, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0">
                    <td className="w-52 px-3 py-2 font-medium text-ink">{row.label}</td>
                    <td className="px-3 py-2 text-ink">{row.value || '—'}</td>
                    <td className="px-3 py-2 text-xs text-ink-soft">{row.tolerance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Constat de marché ── */}
      {market.length > 0 && (
        <section className="border-t border-line py-6">
          <h2 className="mb-3 font-display text-lg tracking-tight text-ink">Constat de marché</h2>
          <div className="space-y-3">
            {market.map((b, i) => (
              <div key={i} className="rounded border border-line p-3">
                {b.title && <h3 className="mb-1 text-sm font-semibold text-ink">{b.title}</h3>}
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{b.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Classement anonymisé ── */}
      <section className="border-t border-line py-6">
        <h2 className="mb-1 font-display text-lg tracking-tight text-ink">Comparatif</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Les fournisseurs sont anonymisés. Les écarts de coût sont exprimés en pourcentage par
          rapport à l’offre la moins chère.
        </p>

        {ranking.length === 0 ? (
          <p className="rounded border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">
            Aucune offre n’est encore notable : la consultation est en cours.
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="bg-mist text-left text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">Rang</th>
                  <th className="px-3 py-2 font-medium">Fournisseur</th>
                  <th className="px-3 py-2 font-medium">Voie</th>
                  <th className="px-3 py-2 font-medium">Pays</th>
                  <th className="px-3 py-2 text-right font-medium">Faisabilité</th>
                  <th className="px-3 py-2 text-right font-medium">Conformité</th>
                  <th className="px-3 py-2 text-right font-medium">Coût</th>
                  <th className="px-3 py-2 text-right font-medium">MOQ</th>
                  <th className="px-3 py-2 text-right font-medium">Délai</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 text-right font-medium">Écart</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {ranking.map((r) => (
                  <tr key={r.alias} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold text-ink">#{r.rank}</td>
                    <td className="px-3 py-2 font-medium text-ink">{r.alias}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.track ?? '—'}</td>
                    <td className="px-3 py-2 text-ink-soft">{r.country ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{note(r.scores.twist)}</td>
                    <td className="px-3 py-2 text-right">{note(r.scores.conformity)}</td>
                    <td className="px-3 py-2 text-right">{note(r.scores.cost)}</td>
                    <td className="px-3 py-2 text-right">{note(r.scores.moqFit)}</td>
                    <td className="px-3 py-2 text-right">{note(r.scores.lead)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">{r.score}</td>
                    <td className="px-3 py-2 text-right text-ink-soft">
                      {r.costPremiumPct == null
                        ? '—'
                        : r.costPremiumPct === 0
                          ? 'référence'
                          : `+${r.costPremiumPct} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Conditions ── */}
      {conditions.total > 0 && (
        <section className="border-t border-line py-6">
          <h2 className="mb-2 font-display text-lg tracking-tight text-ink">
            Conditions suspensives
          </h2>
          <p className="text-sm text-ink-soft">
            <b className="text-ink">
              {conditions.lifted} sur {conditions.applicable}
            </b>{' '}
            levée{conditions.lifted > 1 ? 's' : ''}. Aucun engagement d’outillage n’est pris avant
            que toutes le soient.
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full bg-forest transition-all"
              style={{
                width: `${conditions.applicable ? (100 * conditions.lifted) / conditions.applicable : 0}%`,
              }}
            />
          </div>
        </section>
      )}

      {/* ── Décision ── */}
      {decision && (
        <section className="border-t border-line py-6">
          <h2 className="mb-3 font-display text-lg tracking-tight text-ink">Décision</h2>
          <div className="rounded border border-line p-3">
            {decision.answer && <p className="font-medium text-ink">{decision.answer}</p>}
            {decision.winner && (
              <p className="mt-1 text-sm text-ink">
                Fournisseur retenu : <b>{decision.winner}</b>
              </p>
            )}
            {decision.date && (
              <p className="mt-1 text-xs text-ink-soft">
                Décidé le {new Date(decision.date).toLocaleDateString('fr-FR')}
              </p>
            )}
            {decision.rationale && (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {decision.rationale}
              </p>
            )}
          </div>
        </section>
      )}

      <footer className="border-t border-line pt-6 text-xs leading-relaxed text-ink-soft">
        Extrait en lecture seule d’un dossier de sourcing Twinsk. Les fournisseurs sont anonymisés
        et les montants ne sont pas communiqués. Aucune donnée n’est extrapolée : un champ vide
        signale une information non obtenue, jamais une estimation.
      </footer>
    </main>
  );
}
