'use client';

// Vocabulaire visuel partagé de l'espace agents (liste + détail) :
// mêmes icônes, mêmes teintes, mêmes libellés partout — un agent apprend
// le code couleur une fois et le retrouve dans toute l'interface.
import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  HandCoins,
  HandHeart,
  Plane,
  Ship,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';

export const fmtFcfa = (n: number | null | undefined) =>
  n != null ? `${Math.round(n).toLocaleString('fr-FR')} FCFA` : '—';

export const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

// ---- Étape de la commande (pipeline agent) ----
export type StageKey = 'to_collect' | 'paid' | 'shipped' | 'at_agency' | 'delivered';

export function stageOf(paymentStatus: string, orderStatus: string | null): StageKey {
  if (paymentStatus !== 'paid') return 'to_collect';
  if (orderStatus === 'shipped') return 'shipped';
  if (orderStatus === 'at_agency') return 'at_agency';
  if (orderStatus === 'delivered') return 'delivered';
  return 'paid';
}

// Nombre d'étapes franchies (0 → 4) pour la barre de progression.
export const stageIdx: Record<StageKey, number> = {
  to_collect: 0,
  paid: 1,
  shipped: 2,
  at_agency: 3,
  delivered: 4,
};

export const STAGE_META: Record<StageKey, { label: string; chip: string; dot: string }> = {
  to_collect: { label: 'À encaisser', chip: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' },
  paid: { label: 'Payée', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  shipped: { label: 'Expédiée', chip: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  at_agency: { label: 'À l’agence', chip: 'bg-teal-50 text-teal-700 ring-teal-200', dot: 'bg-teal-500' },
  delivered: { label: 'Remise', chip: 'bg-violet-50 text-violet-700 ring-violet-200', dot: 'bg-violet-500' },
};

export function StageChip({ stage, label }: { stage: StageKey; label?: string }) {
  const m = STAGE_META[stage];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${m.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {label ?? m.label}
    </span>
  );
}

// ---- Paiement / transport : icône encadrée + libellé ----
export const PAY_META: Record<string, { icon: LucideIcon; label: string; box: string }> = {
  cash: { icon: Banknote, label: 'Cash agence', box: 'bg-amber-50 text-amber-600 ring-amber-200' },
  airtel: { icon: Smartphone, label: 'Airtel Money', box: 'bg-red-50 text-red-600 ring-red-200' },
  ebilling: { icon: CreditCard, label: 'eBilling', box: 'bg-emerald-50 text-emerald-600 ring-emerald-200' },
};
export const PAY_FALLBACK = { icon: CreditCard, label: 'Non choisi', box: 'bg-slate-50 text-slate-400 ring-slate-200' };

export const TRANSPORT_META: Record<string, { icon: LucideIcon; label: string; box: string }> = {
  air: { icon: Plane, label: 'Aérien', box: 'bg-sky-50 text-sky-600 ring-sky-200' },
  sea: { icon: Ship, label: 'Maritime', box: 'bg-blue-50 text-blue-600 ring-blue-200' },
  quote: { icon: FileText, label: 'Sur devis', box: 'bg-slate-50 text-slate-500 ring-slate-200' },
};
export const TRANSPORT_FALLBACK = { icon: FileText, label: 'Non choisi', box: 'bg-slate-50 text-slate-400 ring-slate-200' };

/** Petite icône encadrée (paiement / transport) avec libellé optionnel. */
export function IconTag({
  meta,
  showLabel = true,
}: {
  meta: { icon: LucideIcon; label: string; box: string };
  showLabel?: boolean;
}) {
  const Icon = meta.icon;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2">
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ring-1 ${meta.box}`}>
        <Icon className="h-4 w-4" />
      </span>
      {showLabel && <span className="min-w-0 truncate text-xs font-medium text-slate-600">{meta.label}</span>}
    </span>
  );
}

// ---- Barre pipeline (élément signature) ----
const PIPE_STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: HandCoins, label: 'Encaissé' },
  { icon: Plane, label: 'Expédié' },
  { icon: Building2, label: 'Agence' },
  { icon: HandHeart, label: 'Remis' },
];

/**
 * Frise des 4 étapes logistiques. `done` = nombre d'étapes franchies (0-4).
 * Compacte (points + segments) ou étendue (avec libellés).
 */
export function PipelineStrip({ done, labels = false }: { done: number; labels?: boolean }) {
  return (
    <div className="flex items-center" aria-label={`Étape ${done}/4`}>
      {PIPE_STEPS.map((s, i) => {
        const Icon = s.icon;
        const isDone = i < done;
        const isCurrent = i === done;
        return (
          <div key={s.label} className="flex items-center">
            {i > 0 && (
              <span className={`h-0.5 w-4 sm:w-7 ${i <= done - 1 ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
            <span className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full ring-2 transition-colors ${
                  isDone
                    ? 'bg-emerald-500 text-white ring-emerald-500'
                    : isCurrent
                      ? 'bg-white text-emerald-600 ring-emerald-400'
                      : 'bg-white text-slate-300 ring-slate-200'
                }`}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </span>
              {labels && (
                <span className={`text-[10px] font-medium ${isDone || isCurrent ? 'text-slate-700' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
