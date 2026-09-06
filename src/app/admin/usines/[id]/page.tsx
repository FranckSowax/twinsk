'use client';

// Dossier d'usines — le classement importé, tel qu'il a été produit : rang,
// capacité industrielle vérifiable, fiabilité commerciale, réserves et
// ateliers écartés. Rien n'est recalculé ici ; seul l'ordre d'affichage peut
// changer (le rang publié reste la vue par défaut).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  ClipboardList,
  Factory,
  Loader2,
  MapPin,
} from 'lucide-react';

interface FactoryRecord {
  id: string;
  rang: number | null;
  nom_cn: string | null;
  nom_fr: string | null;
  boutique: string | null;
  specialite: string | null;
  statut: string | null;
  labels_1688: string[] | null;
  distinctions: string[] | null;
  activite_30j: Record<string, string | number> | null;
  qualite: Record<string, string | number> | null;
  fiche_retenue: Record<string, unknown> | null;
  cree_en: number | null;
  anciennete_ans: number | null;
  atelier_m2: number | null;
  effectif: string | null;
  credit_1688: string | null;
  credit_rang: number | null;
  note_service: number | null;
  reachat: string | null;
  reachat_pct: number | null;
  abonnes: string | null;
  ventes_90j: string | null;
  meilleure_fiche: string | null;
  pourquoi: string | null;
  reserve: string | null;
}

interface Dossier {
  id: string;
  label: string;
  objet: string | null;
  perimetre_arbitre: string | null;
  marche_cible: string | null;
  devise: string | null;
  methode: string | null;
  classement: string | null;
  repere_de_prix: string | null;
  genere_le: string | null;
  bassins: Record<string, string> | null;
  ecartes: { nom_cn?: string; nom_fr?: string; offer?: string | null; motif?: string }[] | null;
  a_demander: string[] | null;
  factory_count: number;
  ecarte_count: number;
  created_at: string;
}

type Tri = 'rang' | 'credit' | 'note' | 'reachat' | 'atelier';

const TRIS: { valeur: Tri; libelle: string }[] = [
  { valeur: 'rang', libelle: 'Rang publié' },
  { valeur: 'credit', libelle: 'Note de crédit 1688' },
  { valeur: 'note', libelle: 'Note de service' },
  { valeur: 'reachat', libelle: 'Taux de réachat' },
  { valeur: 'atelier', libelle: 'Surface d’atelier' },
];

/** Les usines sans valeur relevée passent en fin de liste, jamais en tête. */
function comparer(tri: Tri) {
  const cle = (u: FactoryRecord): number | null =>
    tri === 'credit'
      ? u.credit_rang
      : tri === 'note'
        ? u.note_service
        : tri === 'reachat'
          ? u.reachat_pct
          : tri === 'atelier'
            ? u.atelier_m2
            : u.rang;
  return (a: FactoryRecord, b: FactoryRecord) => {
    const x = cle(a);
    const y = cle(b);
    if (x === null && y === null) return (a.rang ?? 99) - (b.rang ?? 99);
    if (x === null) return 1;
    if (y === null) return -1;
    // Le rang se lit à l'endroit (1 en tête) ; tout le reste, du plus fort au plus faible.
    return tri === 'rang' ? x - y : y - x;
  };
}

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
      {children}
    </span>
  );
}

function Donnee({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{libelle}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{valeur ?? '—'}</dd>
    </div>
  );
}

export default function UsineDossierPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [usines, setUsines] = useState<FactoryRecord[]>([]);
  const [tri, setTri] = useState<Tri>('rang');
  const [loading, setLoading] = useState(true);
  const [erreur, setErreur] = useState('');

  const charger = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/usines/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setErreur(data?.error || 'Dossier introuvable');
        return;
      }
      setDossier(data.dossier);
      setUsines(data.usines || []);
    } catch {
      setErreur('Erreur réseau');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (erreur || !dossier) {
    return (
      <div className="space-y-4">
        <Link href="/admin/usines" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Usines
        </Link>
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {erreur || 'Dossier introuvable'}
        </p>
      </div>
    );
  }

  const classees = [...usines].sort(comparer(tri));
  const bassins = Object.entries(dossier.bassins || {});
  const ecartes = dossier.ecartes || [];
  const aDemander = dossier.a_demander || [];

  return (
    <div className="space-y-6">
      <Link href="/admin/usines" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Usines
      </Link>

      {/* En-tête du dossier */}
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{dossier.label}</h1>
        {dossier.objet && dossier.objet !== dossier.label && (
          <p className="text-sm text-slate-500">{dossier.objet}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Etiquette>{dossier.factory_count} usine(s) classée(s)</Etiquette>
          {dossier.ecarte_count > 0 && <Etiquette>{dossier.ecarte_count} écartée(s)</Etiquette>}
          {dossier.devise && <Etiquette>Prix en {dossier.devise}</Etiquette>}
          {dossier.marche_cible && <Etiquette>{dossier.marche_cible}</Etiquette>}
        </div>
      </div>

      {/* Méthode et repères */}
      {(dossier.perimetre_arbitre || dossier.methode || dossier.classement || dossier.repere_de_prix) && (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-2">
          {dossier.perimetre_arbitre && <Donnee libelle="Périmètre arbitré" valeur={dossier.perimetre_arbitre} />}
          {dossier.classement && <Donnee libelle="Critère de classement" valeur={dossier.classement} />}
          {dossier.methode && <Donnee libelle="Méthode" valeur={dossier.methode} />}
          {dossier.repere_de_prix && <Donnee libelle="Repère de prix" valeur={dossier.repere_de_prix} />}
        </div>
      )}

      {/* Bassins industriels */}
      {bassins.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-slate-500">
            <MapPin className="h-4 w-4" /> Bassins industriels
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {bassins.map(([nom, texte]) => (
              <Donnee key={nom} libelle={nom} valeur={texte} />
            ))}
          </dl>
        </div>
      )}

      {/* Tri du classement */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">
            Classer par
          </label>
          <select
            value={tri}
            onChange={(e) => setTri(e.target.value as Tri)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            {TRIS.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </select>
        </div>
        {tri !== 'rang' && (
          <p className="pb-2 text-xs text-slate-500">
            Ordre d’affichage seulement — le rang publié dans le dossier reste celui du badge.
          </p>
        )}
      </div>

      {/* Usines classées */}
      <div className="space-y-4">
        {classees.map((u) => (
          <article
            key={u.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-sm font-bold text-white">
                  {u.rang ?? '—'}
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {u.nom_fr || u.nom_cn || 'Usine sans nom'}
                  </h2>
                  {u.nom_cn && u.nom_fr && <p className="text-sm text-slate-500">{u.nom_cn}</p>}
                  {u.specialite && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{u.specialite}</p>}
                </div>
              </div>
              {u.boutique && (
                <a
                  href={u.boutique}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-50 dark:border-slate-600 dark:text-sky-400 dark:hover:bg-sky-900/20"
                >
                  Boutique 1688 <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>

            {(u.statut || (u.labels_1688 || []).length > 0) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {u.statut && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {u.statut}
                  </span>
                )}
                {(u.labels_1688 || []).map((l, i) => (
                  <Etiquette key={i}>{String(l)}</Etiquette>
                ))}
              </div>
            )}

            <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-slate-700 sm:grid-cols-3 lg:grid-cols-4">
              <Donnee libelle="Crédit 1688" valeur={u.credit_1688} />
              <Donnee
                libelle="Note de service"
                valeur={u.note_service !== null ? `${u.note_service} / 5` : null}
              />
              <Donnee libelle="Réachat" valeur={u.reachat} />
              <Donnee
                libelle="Atelier"
                valeur={u.atelier_m2 !== null ? `${u.atelier_m2.toLocaleString('fr-FR')} m²` : null}
              />
              <Donnee libelle="Effectif" valeur={u.effectif} />
              <Donnee
                libelle="Ancienneté 1688"
                valeur={u.anciennete_ans !== null ? `${u.anciennete_ans} an(s)` : null}
              />
              <Donnee libelle="Créée en" valeur={u.cree_en} />
              <Donnee libelle="Ventes 90 j" valeur={u.ventes_90j} />
              <Donnee libelle="Abonnés" valeur={u.abonnes} />
            </dl>

            {Object.keys(u.activite_30j || {}).length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Activité sur 30 jours
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {Object.entries(u.activite_30j || {}).map(([k, v]) => (
                    <Etiquette key={k}>
                      {k.replace(/_/g, ' ')} : <strong className="ml-1">{String(v)}</strong>
                    </Etiquette>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(u.qualite || {}).length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Qualité</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {Object.entries(u.qualite || {}).map(([k, v]) => (
                    <Etiquette key={k}>
                      {k.replace(/_/g, ' ')} : <strong className="ml-1">{String(v)}</strong>
                    </Etiquette>
                  ))}
                </div>
              </div>
            )}

            {(u.distinctions || []).length > 0 && (
              <ul className="mt-3 space-y-0.5 text-sm text-slate-600 dark:text-slate-300">
                {(u.distinctions || []).map((d, i) => (
                  <li key={i}>• {String(d)}</li>
                ))}
              </ul>
            )}

            {u.fiche_retenue && (
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-800 dark:bg-sky-900/20">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  Fiche retenue
                </p>
                <dl className="mt-2 grid gap-2 sm:grid-cols-3">
                  {Object.entries(u.fiche_retenue).map(([k, v]) => (
                    <Donnee
                      key={k}
                      libelle={k.replace(/_/g, ' ')}
                      valeur={typeof v === 'boolean' ? (v ? 'oui' : 'non') : String(v)}
                    />
                  ))}
                </dl>
              </div>
            )}

            {u.meilleure_fiche && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Meilleure fiche :</span> {u.meilleure_fiche}
              </p>
            )}

            {u.pourquoi && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Pourquoi
                </p>
                {u.pourquoi}
              </div>
            )}

            {u.reserve && (
              <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                    Réserve
                  </p>
                  {u.reserve}
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Ateliers écartés */}
      {ecartes.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 dark:border-red-900 dark:bg-red-900/10">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-red-700 dark:text-red-300">
            <Ban className="h-4 w-4" /> Écartés ({ecartes.length})
          </h2>
          <ul className="mt-3 space-y-3">
            {ecartes.map((e, i) => (
              <li key={i} className="text-sm text-red-900 dark:text-red-200">
                <p className="font-semibold">
                  {e.nom_fr || e.nom_cn || 'Atelier'}
                  {e.offer && <span className="ml-2 font-normal opacity-70">fiche {e.offer}</span>}
                </p>
                {e.motif && <p className="mt-0.5 opacity-90">{e.motif}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions à poser */}
      {aDemander.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-slate-500">
            <ClipboardList className="h-4 w-4" /> À demander à chaque usine
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {aDemander.map((q, i) => (
              <li key={i} className="flex gap-2">
                <Factory className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                <span>{String(q)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
