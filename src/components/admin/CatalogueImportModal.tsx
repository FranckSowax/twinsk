'use client';

// Import & nettoyage d'un catalogue twinsk_catalogue_v3.1 : dépôt du .json → pipeline
// déterministe côté serveur (rapport AVANT écriture) → confirmation → bulk-load.
import { useState } from 'react';
import {
  X,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  FileText,
  Download,
  Wrench,
  Send,
  ClipboardCheck,
  ExternalLink,
} from 'lucide-react';

interface JournalEntry {
  offer_id: string;
  niveau: string;
  nom: string;
  champ: string;
  avant: unknown;
  apres: unknown;
  motif: string;
}
interface Anomaly {
  offer_id: string;
  niveau: string;
  code: string;
  nom: string;
  detail: string;
}
interface BlockingIssue {
  code: string;
  offer_id?: string;
  detail: string;
}
interface SupplierRequest {
  offer_id: string;
  url: string;
  titre: string;
  manque: string;
}
interface CatVariant { weight?: unknown; volume?: unknown }
interface CatProduct { weight?: unknown; volume?: unknown; variants?: CatVariant[] }
interface CleanResult {
  catalogue: { categories?: { products?: CatProduct[] }[] };
  journal: JournalEntry[];
  anomalies: Anomaly[];
  demandes: SupplierRequest[];
  blocking: BlockingIssue[];
  stats: { categories: number; produits: number; variantes: number; corrections: number };
}

const ANOMALY_LABEL: Record<string, string> = {
  poids_absent: 'Poids absent',
  dims_absentes: 'Dimensions absentes',
  volume_absent: 'Volume absent',
  densite_absurde: 'Densité absurde',
  dims_vs_volume_incoherent: 'Dims ≠ volume',
  video_orpheline: 'Vidéo orpheline',
};

const DEMANDE_MSG = `您好，我们打算批量采购贵司这款产品，出口到非洲（加蓬）。
麻烦提供以下外箱信息，用于海运报价：
1. 每箱毛重（kg）
2. 外箱尺寸 长×宽×高（cm）
3. 每箱装几台 / 每台体积（CBM）
4. 是否可以拆机发货（缩小体积）
谢谢！`;

// Fiche incomplète = au moins un emplacement (variante, sinon produit) sans poids OU volume.
function countIncomplete(cat: CleanResult['catalogue']): number {
  const pos = (v: unknown) => Number(v) > 0;
  let n = 0;
  for (const c of cat.categories || [])
    for (const p of c.products || []) {
      const vs = Array.isArray(p.variants) ? p.variants : [];
      const inc = vs.length ? vs.some((v) => !pos(v.weight) || !pos(v.volume)) : !pos(p.weight) || !pos(p.volume);
      if (inc) n++;
    }
  return n;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(rows: JournalEntry[]): string {
  const cols = ['offer_id', 'niveau', 'nom', 'champ', 'avant', 'apres', 'motif'] as const;
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function toDemandeMd(demandes: SupplierRequest[]): string {
  let md = '# Données de colisage à demander aux fournisseurs\n\n';
  md += `${demandes.length} fiche(s). Message à coller dans le chat 1688 (旺旺), un envoi par fournisseur :\n\n`;
  md += '```\n' + DEMANDE_MSG + '\n```\n\n';
  md += '(FR : bonjour, nous prévoyons un achat en gros pour export vers le Gabon. Merci de fournir poids brut par carton, dimensions du carton en cm, nombre d’unités par carton / CBM par unité, et si la machine peut être démontée pour réduire le volume.)\n\n';
  md += '| offer_id | manque | titre | fiche |\n|---|---|---|---|\n';
  for (const d of demandes) md += `| \`${d.offer_id}\` | ${d.manque} | ${d.titre.replace(/\|/g, '/')} | ${d.url} |\n`;
  return md;
}

export default function CatalogueImportModal({
  offerId,
  onClose,
  onImported,
}: {
  offerId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [fileName, setFileName] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [report, setReport] = useState<CleanResult | null>(null);
  const [error, setError] = useState('');
  const [currencyOk, setCurrencyOk] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ incomplets: number; created: number; skipped: number } | null>(null);

  const incompleteCount = report ? countIncomplete(report.catalogue) : 0;

  const sendReview = async () => {
    setSendingReview(true);
    setError('');
    try {
      const res = await fetch(`/api/offers/${offerId}/send-incomplete-review`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Envoi en révision échoué');
        return;
      }
      setReviewResult(data);
    } finally {
      setSendingReview(false);
    }
  };

  const hasDeviseBlock = !!report?.blocking.some((b) => b.code === 'devise_invalide');

  const onFile = async (file: File) => {
    setError('');
    setReport(null);
    setDone(false);
    setCurrencyOk(false);
    setFileName(file.name);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setError('Fichier JSON illisible.');
      return;
    }
    setCleaning(true);
    try {
      const res = await fetch(`/api/offers/${offerId}/catalogue-clean`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Nettoyage échoué');
        return;
      }
      setReport(data as CleanResult);
    } finally {
      setCleaning(false);
    }
  };

  const confirmImport = async () => {
    if (!report) return;
    setConfirming(true);
    setError('');
    try {
      const res = await fetch(`/api/offers/${offerId}/bulk-load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: report.catalogue.categories || [] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import échoué');
        return;
      }
      setDone(true);
      onImported();
    } finally {
      setConfirming(false);
    }
  };

  const prixAbsents = report?.blocking.filter((b) => b.code === 'prix_absent_ou_nul') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="min-h-full w-full max-w-3xl bg-white shadow-2xl dark:bg-slate-900 sm:my-6 sm:min-h-0 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
            <Wrench className="h-5 w-5 text-emerald-500" /> Importer & nettoyer un catalogue
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Dépôt du fichier */}
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 px-4 py-8 text-center hover:bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10">
            <Upload className="h-8 w-8 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {fileName || 'Déposer un fichier .json (twinsk_catalogue_v3.1)'}
            </span>
            <span className="text-xs text-slate-500">Nettoyage déterministe, rapport avant écriture</span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>

          {cleaning && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" /> Nettoyage en cours…
            </div>
          )}
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          {done && (
            <div className="space-y-4 rounded-2xl border border-green-300 bg-green-50 p-5 text-center dark:border-green-700 dark:bg-green-900/15">
              <div>
                <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
                <p className="mt-2 font-semibold text-green-800 dark:text-green-300">Import confirmé.</p>
              </div>

              {/* Envoi en révision des fiches incomplètes (poids ou volume manquant) */}
              {reviewResult ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/15 dark:text-blue-200">
                  <ClipboardCheck className="mx-auto h-6 w-6 text-blue-500" />
                  <p className="mt-1 font-semibold">
                    {reviewResult.created} fiche(s) envoyée(s) en révision
                    {reviewResult.skipped > 0 ? ` · ${reviewResult.skipped} déjà en attente` : ''}.
                  </p>
                  <p className="text-xs">Chaque fiche arrive avec ses variantes à remplir (poids / volume / dimensions).</p>
                  <a href="/admin/revisions" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white">
                    <ExternalLink className="h-3.5 w-3.5" /> Ouvrir les révisions
                  </a>
                </div>
              ) : incompleteCount > 0 ? (
                <button
                  onClick={sendReview}
                  disabled={sendingReview}
                  className="mx-auto flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                >
                  {sendingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                  Envoyer {incompleteCount} fiche(s) incomplète(s) en révision
                </button>
              ) : (
                <p className="text-xs text-green-700 dark:text-green-300">Aucune fiche incomplète — rien à envoyer en révision. 👍</p>
              )}

              <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-600 dark:text-slate-300">Fermer</button>
            </div>
          )}

          {report && !done && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Catégories', value: report.stats.categories },
                  { label: 'Produits', value: report.stats.produits },
                  { label: 'Variantes', value: report.stats.variantes },
                  { label: 'Corrections', value: report.stats.corrections },
                ].map((k) => (
                  <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-3 text-center dark:border-slate-700 dark:bg-slate-800">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{k.value}</p>
                    <p className="text-[11px] font-medium text-slate-500">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* Blocages */}
              {report.blocking.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/15">
                  <p className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" /> Points bloquants ({report.blocking.length})
                  </p>
                  {hasDeviseBlock && (
                    <>
                      {report.blocking.filter((b) => b.code === 'devise_invalide').map((b, i) => (
                        <p key={i} className="text-xs text-red-700 dark:text-red-300">{b.detail}</p>
                      ))}
                      <label className="flex items-center gap-2 text-xs font-semibold text-red-800 dark:text-red-200">
                        <input type="checkbox" checked={currencyOk} onChange={(e) => setCurrencyOk(e.target.checked)} className="h-4 w-4 rounded" />
                        Je confirme que les prix sont bien en CNY (yuan).
                      </label>
                    </>
                  )}
                  {prixAbsents.length > 0 && (
                    <details className="text-xs text-red-700 dark:text-red-300">
                      <summary className="cursor-pointer font-semibold">{prixAbsents.length} produit(s) sans prix — non importés</summary>
                      <ul className="mt-1 list-disc pl-5">
                        {prixAbsents.slice(0, 20).map((b, i) => (<li key={i}>{b.detail}</li>))}
                      </ul>
                    </details>
                  )}
                </div>
              )}

              {/* Anomalies (arbitrage humain) */}
              <div className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700">
                  Anomalies à arbitrer ({report.anomalies.length})
                </p>
                {report.anomalies.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-emerald-600">Aucune anomalie de vraisemblance. 👍</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {report.anomalies.slice(0, 100).map((a, i) => (
                          <tr key={i} className="border-b border-slate-50 dark:border-slate-700/50">
                            <td className="px-3 py-1.5">
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                {ANOMALY_LABEL[a.code] || a.code}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">{a.offer_id}</td>
                            <td className="max-w-[220px] truncate px-3 py-1.5 text-slate-600 dark:text-slate-300" title={a.nom}>{a.nom}</td>
                            <td className="px-3 py-1.5 text-slate-500">{a.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.anomalies.length > 100 && (
                      <p className="px-3 py-1.5 text-[11px] text-slate-400">+ {report.anomalies.length - 100} autres (voir le CSV).</p>
                    )}
                  </div>
                )}
              </div>

              {/* Demandes fournisseur */}
              {report.demandes.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/15 dark:text-amber-200">
                  <b>{report.demandes.length} fiche(s)</b> restent sans poids ni dimensions → à demander au fournisseur (bouton « Demande .md »).
                </div>
              )}

              {/* Téléchargements */}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => download('catalogue_nettoye.json', JSON.stringify(report.catalogue, null, 2), 'application/json')} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                  <FileJson className="h-3.5 w-3.5" /> Catalogue nettoyé (.json)
                </button>
                <button onClick={() => download('journal_corrections.csv', toCsv(report.journal), 'text/csv')} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
                  <Download className="h-3.5 w-3.5" /> Journal ({report.journal.length}) (.csv)
                </button>
                <button onClick={() => download('demande_fournisseur.md', toDemandeMd(report.demandes), 'text/markdown')} disabled={report.demandes.length === 0} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300">
                  <FileText className="h-3.5 w-3.5" /> Demande fournisseur (.md)
                </button>
              </div>

              {/* Confirmer */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 dark:border-slate-600 dark:text-slate-300">Annuler</button>
                <button
                  onClick={confirmImport}
                  disabled={confirming || (hasDeviseBlock && !currencyOk)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Confirmer l’import
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
